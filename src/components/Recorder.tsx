"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

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
  initialPartNo = 1,
  initialIdx = 0,
}: {
  meetingId: string;
  initialPartNo?: number;
  initialIdx?: number;
}) {
  const router = useRouter();
  const [consentGiven, setConsentGiven] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(CONSENT_KEY) === "1"
  );
  const [showConsent, setShowConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "recording" | "finishing">("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MeetingRecorder | null>(null);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const nextIdxRef = useRef(initialIdx);
  const pendingCheckpointsRef = useRef<Set<number>>(new Set());

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

  async function uploadChunk(chunk: QueuedChunk) {
    const formData = new FormData();
    formData.append("audio", chunk.blob, `chunk-${chunk.idx}.${chunk.extension}`);
    formData.append("idx", String(chunk.idx));
    formData.append("audioSeconds", String(chunk.audioSeconds));
    if (chunk.forcePartNo !== undefined) {
      formData.append("forcePartNo", String(chunk.forcePartNo));
    }

    try {
      const response = await fetch(`/api/meetings/${meetingId}/chunks`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("upload falhou");

      const data: { transcript: string; part_no: number; closed_part_no: number | null } =
        await response.json();
      await markChunkSent(chunk.key);
      setSegments((prev) =>
        prev.some((segment) => segment.idx === chunk.idx)
          ? prev
          : [
              ...prev,
              { idx: chunk.idx, partNo: data.part_no, text: data.transcript, at: new Date().toISOString() },
            ].sort((a, b) => a.idx - b.idx)
      );
      if (data.closed_part_no !== null) {
        await requestCheckpoint(data.closed_part_no);
      }
    } catch {
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
      onTick: setElapsedSeconds,
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
  }

  async function handleFinish() {
    recorderRef.current?.stop();
    await wakeLockRef.current?.release();
    wakeLockRef.current = null;
    setStatus("finishing");

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

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
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

      <div className="flex flex-col items-center gap-2">
        <span className="text-4xl font-semibold tabular-nums text-text">
          {formatElapsed(elapsedSeconds)}
        </span>
        <p className="text-sm text-text-secondary">
          Mantenha a tela ligada e o aparelho carregando.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-record">
          {error}
        </p>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-sm">
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
      )}

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

      {status === "idle" ? (
        <button
          type="button"
          onClick={handleStart}
          className="h-15 rounded-xl bg-accent text-base font-semibold text-white"
        >
          Começar a gravar
        </button>
      ) : (
        <button
          type="button"
          onClick={handleFinish}
          disabled={status === "finishing"}
          className="h-15 rounded-xl bg-record text-base font-semibold text-white disabled:opacity-60"
        >
          {status === "finishing" ? "Encerrando..." : "Encerrar"}
        </button>
      )}
    </div>
  );
}
