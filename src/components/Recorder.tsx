"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AudioWave } from "@/components/AudioWave";
import { OpinionCard } from "@/components/OpinionCard";
import { formatOffset } from "@/lib/format";
import { shouldAutoGenerateOpinion } from "@/lib/meetings";
import { MeetingRecorder, type RecorderError } from "@/lib/recorder/recorder";
import {
  chunkKey,
  enqueueChunk,
  listDueChunks,
  listPendingChunks,
  markChunkFailed,
  markChunkSent,
  resetBackoff,
  type QueuedChunk,
} from "@/lib/recorder/uploadQueue";
import { requestWakeLock, type WakeLockHandle } from "@/lib/recorder/wakeLock";

const CONSENT_KEY = "cerebro-ia:consentimento-gravacao";
const RETRY_INTERVAL_MS = 5_000;

type TranscriptSegment = { idx: number; partNo: number; text: string; at: string };
type Opinion = { id: string; offsetSeconds: number; text: string };

function formatClock(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function errorMessage(error: RecorderError): string {
  switch (error.type) {
    case "mic-denied":
      return "Não consegui acessar o microfone. Verifique a permissão e tente de novo.";
    case "unsupported":
      return "Este navegador não sabe gravar áudio. Tente outro navegador.";
    case "recorder-error":
      return "A gravação parou por um erro inesperado.";
  }
}

export function Recorder({
  meetingId,
  meetingTitle,
  initialPartNo = 1,
  initialIdx = 0,
}: {
  meetingId: string;
  meetingTitle: string;
  initialPartNo?: number;
  initialIdx?: number;
}) {
  const router = useRouter();
  const [consentGiven, setConsentGiven] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(CONSENT_KEY) === "1"
  );
  const [showConsent, setShowConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "recording" | "finishing">("idle");
  const [autoOpine, setAutoOpine] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [chunkUploadError, setChunkUploadError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [opinions, setOpinions] = useState<Opinion[]>([]);
  const [isGeneratingOpinion, setIsGeneratingOpinion] = useState(false);
  const [opinionError, setOpinionError] = useState<string | null>(null);

  const recorderRef = useRef<MeetingRecorder | null>(null);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const nextIdxRef = useRef(initialIdx);
  const pendingCheckpointsRef = useRef<Set<number>>(new Set());
  const isGeneratingOpinionRef = useRef(false);
  const lastOpinionCharsRef = useRef(0);
  const segmentsCharsRef = useRef(0);
  const elapsedSecondsRef = useRef(0);
  const autoOpineRef = useRef(autoOpine);

  useEffect(() => {
    autoOpineRef.current = autoOpine;
  }, [autoOpine]);

  async function requestCheckpoint(partNo: number) {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_no: partNo }),
      });
      if (!response.ok) throw new Error("checkpoint falhou");
      pendingCheckpointsRef.current.delete(partNo);
    } catch {
      // Sem travar a gravação: tenta de novo no próximo tick (ver retryPendingCheckpoints).
      pendingCheckpointsRef.current.add(partNo);
    }
  }

  async function retryPendingCheckpoints() {
    for (const partNo of pendingCheckpointsRef.current) {
      await requestCheckpoint(partNo);
    }
  }

  async function requestOpinion(offsetSeconds: number) {
    if (isGeneratingOpinionRef.current) return;
    isGeneratingOpinionRef.current = true;
    setIsGeneratingOpinion(true);
    setOpinionError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offset_seconds: offsetSeconds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setOpinionError(data?.error ?? "Não foi possível pedir uma opinião agora.");
        return;
      }
      if (data && !data.skipped) {
        setOpinions((prev) => [
          ...prev,
          { id: data.id as string, offsetSeconds: data.offset_seconds as number, text: data.text as string },
        ]);
      }
      // Conta a partir de agora, gerada ou não (SEM_CONTRIBUICAO também não deve repetir à toa).
      lastOpinionCharsRef.current = segmentsCharsRef.current;
    } finally {
      isGeneratingOpinionRef.current = false;
      setIsGeneratingOpinion(false);
    }
  }

  async function uploadChunk(chunk: QueuedChunk) {
    const formData = new FormData();
    formData.append("audio", chunk.blob, `chunk-${chunk.idx}.${chunk.extension}`);
    formData.append("clientChunkId", String(chunk.idx));
    formData.append("audioSeconds", String(chunk.audioSeconds));
    if (chunk.forcePartNo !== undefined) {
      formData.append("forcePartNo", String(chunk.forcePartNo));
    }

    try {
      const response = await fetch(`/api/meetings/${meetingId}/chunks`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Falha ao enviar o trecho. Tente de novo.");
      }

      const data: { transcript: string; part_no: number; closed_part_no: number | null } =
        await response.json();
      setChunkUploadError(null);
      await markChunkSent(chunk.key);
      setSegments((prev) => {
        if (prev.some((segment) => segment.idx === chunk.idx)) return prev;
        segmentsCharsRef.current += data.transcript.length;
        return [
          ...prev,
          { idx: chunk.idx, partNo: data.part_no, text: data.transcript, at: new Date().toISOString() },
        ].sort((a, b) => a.idx - b.idx);
      });
      if (data.closed_part_no !== null) {
        await requestCheckpoint(data.closed_part_no);
      }

      const newChars = segmentsCharsRef.current - lastOpinionCharsRef.current;
      if (
        shouldAutoGenerateOpinion({
          autoOpineEnabled: autoOpineRef.current,
          isGenerating: isGeneratingOpinionRef.current,
          newTranscriptChars: newChars,
        })
      ) {
        requestOpinion(elapsedSecondsRef.current);
      }
    } catch (error) {
      // Nunca engole em silêncio: o áudio já está salvo no IndexedDB (ver
      // enqueueChunk) e tenta de novo sozinho, com espera crescente
      // (computeBackoffMs) — só avisa na tela o motivo da última falha.
      setChunkUploadError(error instanceof Error ? error.message : "Falha ao enviar o trecho.");
      await markChunkFailed(chunk.key);
    } finally {
      const pending = await listPendingChunks(meetingId);
      setPendingCount(pending.length);
    }
  }

  async function retryDueChunks() {
    const due = await listDueChunks(meetingId);
    for (const chunk of due) {
      await uploadChunk(chunk);
    }
  }

  useEffect(() => {
    function tick() {
      retryDueChunks();
      retryPendingCheckpoints();
    }
    const interval = setInterval(tick, RETRY_INTERVAL_MS);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && recorderRef.current?.isRecording && !wakeLockRef.current) {
        requestWakeLock().then((handle) => {
          wakeLockRef.current = handle;
        });
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function handleStart() {
    if (!consentGiven) {
      setShowConsent(true);
      return;
    }
    await startRecording();
  }

  async function acceptConsent() {
    localStorage.setItem(CONSENT_KEY, "1");
    setConsentGiven(true);
    setShowConsent(false);
    await startRecording();
  }

  async function startRecording() {
    setError(null);
    wakeLockRef.current = await requestWakeLock();

    const recorder = new MeetingRecorder({
      onTick: (seconds) => {
        elapsedSecondsRef.current = seconds;
        setElapsedSeconds(seconds);
      },
      onError: (recorderError) => setError(errorMessage(recorderError)),
      onChunk: async (chunk) => {
        const idx = nextIdxRef.current;
        const isFirstChunkOfSession = idx === initialIdx;
        nextIdxRef.current += 1;

        const entry = {
          meetingId,
          idx,
          ...chunk,
          forcePartNo: isFirstChunkOfSession ? initialPartNo : undefined,
        };
        await enqueueChunk(entry);
        await uploadChunk({
          key: chunkKey(meetingId, idx),
          attempts: 0,
          nextAttemptAt: Date.now(),
          createdAt: Date.now(),
          ...entry,
        });
      },
    });

    recorderRef.current = recorder;
    setStatus("recording");
    await recorder.start();
    setMediaStream(recorder.mediaStream);
  }

  async function handleFinish() {
    recorderRef.current?.stop();
    await wakeLockRef.current?.release();
    wakeLockRef.current = null;
    setStatus("finishing");
    setMediaStream(null);

    // Dá um instante para o último trecho parcial (onstop do MediaRecorder) ser
    // enfileirado e para as tentativas pendentes mais recentes saírem.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await retryDueChunks();
    await retryPendingCheckpoints();

    await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finish" }),
    });

    router.push("/");
  }

  function handleBack() {
    if (status === "recording") {
      const confirmed = confirm(
        "Sair agora não encerra a reunião direito — prefira \"Encerrar reunião\". Sair mesmo assim?"
      );
      if (!confirmed) return;
    }
    router.push("/");
  }

  const lastSegment = segments[segments.length - 1];

  return (
    <div className="flex flex-1 flex-col">
      {showConsent && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-w-sm flex-col gap-4 rounded-2xl bg-surface p-6">
            <p className="text-text">
              Antes de gravar, lembre os participantes de que esta reunião será gravada e
              transcrita.
            </p>
            <button
              type="button"
              onClick={acceptConsent}
              className="h-14 rounded-xl bg-accent text-base font-semibold text-white"
            >
              Entendi, começar a gravar
            </button>
          </div>
        </div>
      )}

      <header className="flex h-14 items-center justify-between px-4">
        <button type="button" onClick={handleBack} className="flex h-11 w-11 items-center justify-center text-text">
          <ArrowLeft size={22} />
        </button>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Opinar automaticamente</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoOpine}
            onClick={() => setAutoOpine((value) => !value)}
            className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${
              autoOpine ? "bg-accent" : "bg-border"
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white transition-transform ${
                autoOpine ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 pb-32">
        {status === "recording" || status === "finishing" ? (
          <div className="flex flex-col items-center gap-1 pt-2 text-center">
            <span className="flex items-center gap-2 text-sm font-semibold text-record">
              <span className="h-2.5 w-2.5 rounded-full bg-record" />
              {status === "finishing" ? "Encerrando..." : "Gravando"}
            </span>
            <span className="text-4xl font-bold tabular-nums text-text">
              {formatOffset(elapsedSeconds)}
            </span>
            <span className="text-sm text-text-secondary">{meetingTitle}</span>
          </div>
        ) : (
          <p className="pt-2 text-center text-sm text-text-secondary">
            Mantenha a tela ligada e o aparelho carregando.
          </p>
        )}

        <AudioWave stream={mediaStream} active={status === "recording"} />

        {error && (
          <p role="alert" className="text-sm text-record">
            {error}
          </p>
        )}

        {pendingCount > 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{pendingCount} trecho(s) aguardando envio.</span>
              <button
                type="button"
                onClick={async () => {
                  await resetBackoff(meetingId);
                  await retryDueChunks();
                }}
                className="font-semibold text-accent"
              >
                Reenviar agora
              </button>
            </div>
            {chunkUploadError && (
              <p className="text-xs text-record">
                Última tentativa: {chunkUploadError} O áudio está salvo no aparelho e a gente
                tenta de novo sozinho.
              </p>
            )}
          </div>
        )}

        {lastSegment && (
          <p className="rounded-xl bg-surface px-4 py-3 text-sm italic text-text-secondary shadow-sm">
            ...{lastSegment.text}...
          </p>
        )}

        <div className="flex flex-1 flex-col gap-2">
          <div>
            <h2 className="text-lg font-bold text-text">Claude opinando</h2>
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Opiniões da IA (Claude)
            </span>
          </div>
          {opinionError && (
            <p role="alert" className="text-sm text-record">
              {opinionError}
            </p>
          )}
          {opinions.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {isGeneratingOpinion ? "Pedindo a primeira opinião..." : "Nenhuma opinião ainda."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...opinions].reverse().map((opinion, index) => (
                <OpinionCard
                  key={opinion.id}
                  text={opinion.text}
                  timeLabel={formatOffset(opinion.offsetSeconds)}
                  highlighted={index === 0}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {segments.map((segment, index) => {
            const previous = segments[index - 1];
            const showMarker = !previous || previous.partNo !== segment.partNo;
            return (
              <div key={segment.idx}>
                {showMarker && (
                  <p className="pb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
                    Parte {segment.partNo}, {formatClock(new Date(segment.at))}
                  </p>
                )}
                <p className="text-text">{segment.text}</p>
              </div>
            );
          })}
        </div>
      </main>

      {status === "idle" ? (
        <div className="fixed inset-x-0 bottom-0 p-4">
          <button
            type="button"
            onClick={handleStart}
            className="h-[60px] w-full rounded-xl bg-accent text-base font-semibold text-white"
          >
            Começar a gravar
          </button>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 flex gap-3 border-t border-border bg-surface-bottom p-4">
          <button
            type="button"
            onClick={() => requestOpinion(elapsedSecondsRef.current)}
            disabled={isGeneratingOpinion || status === "finishing"}
            className="flex h-14 flex-1 items-center justify-center rounded-xl border border-record text-sm font-semibold text-record disabled:opacity-60"
          >
            {isGeneratingOpinion ? "Pedindo..." : "Pedir opinião agora"}
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={status === "finishing"}
            className="flex h-14 flex-1 items-center justify-center rounded-xl bg-record text-sm font-semibold text-white disabled:opacity-60"
          >
            {status === "finishing" ? "Encerrando..." : "Encerrar reunião"}
          </button>
        </div>
      )}
    </div>
  );
}
