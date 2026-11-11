"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { PROJECT_UPLOAD_BATCH_MAX_BYTES } from "@/lib/config";
import { DocumentRejectedError, extractDocumentText } from "@/lib/projects/documents";
import { readZipFile, type AcceptedZipEntry, type RejectedZipEntry } from "@/lib/projects/zip";

type ProjectFileRow = { path: string; size_bytes: number; summary: string | null; updated_at: string };
type ProjectDocumentRow = {
  filename: string;
  size_bytes: number;
  summary: string | null;
  updated_at: string;
};

/** `id` é o caminho (código) ou o nome do arquivo (documento) — o nome do campo
 * na requisição ("path" ou "filename") depende do endpoint, resolvido em `sendBatches`. */
type BatchItem = { id: string; content: string; sizeBytes: number };

type PendingImport =
  | { kind: "code"; accepted: AcceptedZipEntry[]; rejected: RejectedZipEntry[] }
  | { kind: "documents"; accepted: { filename: string; content: string; sizeBytes: number }[]; rejected: RejectedZipEntry[] };

type ImportStage = "idle" | "reading" | "sending" | "summarizing" | "done";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Divide os arquivos aceitos em lotes de até ~3 MB, para não passar do limite da Vercel. */
function splitIntoBatches<T extends { sizeBytes: number }>(items: T[], maxBatchBytes: number): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;

  for (const item of items) {
    if (current.length > 0 && currentBytes + item.sizeBytes > maxBatchBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += item.sizeBytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function toRequestPayload(items: BatchItem[], field: "files" | "documents") {
  return field === "files"
    ? items.map((item) => ({ path: item.id, content: item.content, sizeBytes: item.sizeBytes }))
    : items.map((item) => ({ filename: item.id, content: item.content, sizeBytes: item.sizeBytes }));
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function ProjectManager({
  projectId,
  initialFiles,
  initialDocuments,
}: {
  projectId: string;
  initialFiles: ProjectFileRow[];
  initialDocuments: ProjectDocumentRow[];
}) {
  const router = useRouter();
  const [files] = useState(initialFiles);
  const [documents] = useState(initialDocuments);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<ImportStage>("idle");
  const [batchDone, setBatchDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [fileDone, setFileDone] = useState(0);
  const [fileTotal, setFileTotal] = useState(0);
  const [serverRejected, setServerRejected] = useState<{ path: string; reason: string }[]>([]);
  const [batchErrors, setBatchErrors] = useState<number[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const [summarizeStatus, setSummarizeStatus] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const batchesRef = useRef<BatchItem[][]>([]);
  const batchEndpointRef = useRef<string>("");
  const batchFieldRef = useRef<"files" | "documents">("files");
  const codeDocFinalizeRef = useRef<{ codePaths: string[]; documentFilenames: string[] } | null>(null);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const documentsInputRef = useRef<HTMLInputElement>(null);

  async function handleZipSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setStage("reading");
    setBusy(true);
    try {
      const summary = await readZipFile(file);
      setPending({ kind: "code", accepted: summary.accepted, rejected: summary.rejected });
    } catch {
      setError("Não foi possível abrir esse .zip.");
    } finally {
      setBusy(false);
      setStage("idle");
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  }

  async function handleDocumentsSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    setError(null);
    setStage("reading");
    setBusy(true);

    const accepted: { filename: string; content: string; sizeBytes: number }[] = [];
    const rejected: RejectedZipEntry[] = [];

    for (const file of selected) {
      try {
        const content = await extractDocumentText(file);
        accepted.push({ filename: file.name, content, sizeBytes: file.size });
      } catch (extractionError) {
        const reason =
          extractionError instanceof DocumentRejectedError
            ? extractionError.message
            : "não foi possível extrair o texto";
        rejected.push({ path: file.name, reason });
      }
    }

    setPending({ kind: "documents", accepted, rejected });
    setBusy(false);
    setStage("idle");
    if (documentsInputRef.current) documentsInputRef.current.value = "";
  }

  /**
   * Envia os lotes já montados, a partir de `startIndex` (para retomar sem
   * reenviar o que já foi confirmado). Idempotente: cada lote é upsert por
   * caminho+hash no servidor, então reenviar o mesmo lote nunca duplica.
   * Um lote que falhar não trava os demais — fica marcado em `batchErrors`.
   */
  async function sendBatches(
    batches: BatchItem[][],
    endpoint: string,
    field: "files" | "documents",
    startIndex: number
  ): Promise<{ cancelledNow: boolean; failedNow: number[] }> {
    batchesRef.current = batches;
    batchEndpointRef.current = endpoint;
    batchFieldRef.current = field;

    const controller = new AbortController();
    abortRef.current = controller;
    setCancelled(false);
    setStage("sending");
    const failedNow: number[] = [];

    for (let i = startIndex; i < batches.length; i++) {
      if (controller.signal.aborted) {
        setCancelled(true);
        return { cancelledNow: true, failedNow };
      }
      setBatchDone(i);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: toRequestPayload(batches[i], field) }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("falha no lote");
        const data: { rejected?: { path?: string; filename?: string; reason: string }[] } = await response.json();
        setServerRejected((previous) => [
          ...previous,
          ...(data.rejected ?? []).map((item) => ({ path: item.path ?? item.filename ?? "?", reason: item.reason })),
        ]);
        setFileDone((previous) => previous + batches[i].length);
      } catch {
        if (controller.signal.aborted) {
          setCancelled(true);
          return { cancelledNow: true, failedNow };
        }
        failedNow.push(i);
        setBatchErrors((previous) => [...previous, i]);
      }
    }
    setBatchDone(batches.length);
    return { cancelledNow: false, failedNow };
  }

  function cancelImport() {
    abortRef.current?.abort();
  }

  async function resumeImport() {
    setCancelled(false);
    setBusy(true);
    const result = await sendBatches(batchesRef.current, batchEndpointRef.current, batchFieldRef.current, batchDone);
    setBusy(false);
    await afterBatchesSent(result.cancelledNow, result.failedNow.length > 0);
  }

  async function retryFailedBatches() {
    setBusy(true);
    const failed = [...batchErrors];
    setBatchErrors([]);
    const stillFailed: number[] = [];
    for (const index of failed) {
      if (abortRef.current?.signal.aborted) break;
      try {
        const response = await fetch(batchEndpointRef.current, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [batchFieldRef.current]: toRequestPayload(batchesRef.current[index], batchFieldRef.current),
          }),
        });
        if (!response.ok) throw new Error("falha no lote");
        const data: { rejected?: { path?: string; filename?: string; reason: string }[] } = await response.json();
        setServerRejected((previous) => [
          ...previous,
          ...(data.rejected ?? []).map((item) => ({ path: item.path ?? item.filename ?? "?", reason: item.reason })),
        ]);
        setFileDone((previous) => previous + batchesRef.current[index].length);
      } catch {
        stillFailed.push(index);
        setBatchErrors((previous) => [...previous, index]);
      }
    }
    setBusy(false);
    await afterBatchesSent(false, stillFailed.length > 0);
  }

  async function afterBatchesSent(cancelledNow: boolean, hasFailures: boolean) {
    if (cancelledNow || hasFailures) return;
    const finalize = codeDocFinalizeRef.current;
    if (!finalize) return;
    setStage("summarizing");
    setSummarizeStatus("Organizando o projeto...");
    await fetch(`/api/projects/${projectId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalize),
    });
    setPending(null);
    router.refresh();
    await runSummarize();
    setStage("done");
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setBatchErrors([]);
    setServerRejected([]);
    setFileDone(0);
    setCancelled(false);

    try {
      let result: { cancelledNow: boolean; failedNow: number[] };
      if (pending.kind === "code") {
        const items: BatchItem[] = pending.accepted.map((file) => ({
          id: file.path,
          content: file.content,
          sizeBytes: file.sizeBytes,
        }));
        const batches = splitIntoBatches(items, PROJECT_UPLOAD_BATCH_MAX_BYTES);
        setBatchTotal(batches.length);
        setFileTotal(items.length);
        codeDocFinalizeRef.current = {
          codePaths: Array.from(new Set([...files.map((f) => f.path), ...pending.accepted.map((f) => f.path)])),
          documentFilenames: documents.map((doc) => doc.filename),
        };
        result = await sendBatches(batches, `/api/projects/${projectId}/files`, "files", 0);
      } else {
        const items: BatchItem[] = pending.accepted.map((doc) => ({
          id: doc.filename,
          content: doc.content,
          sizeBytes: doc.sizeBytes,
        }));
        const batches = splitIntoBatches(items, PROJECT_UPLOAD_BATCH_MAX_BYTES);
        setBatchTotal(batches.length);
        setFileTotal(items.length);
        codeDocFinalizeRef.current = {
          codePaths: files.map((f) => f.path),
          documentFilenames: Array.from(
            new Set([...documents.map((d) => d.filename), ...pending.accepted.map((d) => d.filename)])
          ),
        };
        result = await sendBatches(batches, `/api/projects/${projectId}/documents`, "documents", 0);
      }
      await afterBatchesSent(result.cancelledNow, result.failedNow.length > 0);
    } catch {
      setError("Falha ao enviar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function runSummarize() {
    let initialRemaining: number | null = null;
    for (let i = 0; i < 20; i++) {
      const response = await fetch(`/api/projects/${projectId}/summarize`, { method: "POST" });
      if (!response.ok) {
        const data: { error?: string } = await response.json().catch(() => ({}));
        setSummarizeStatus(data.error ?? "Não foi possível gerar os resumos.");
        return;
      }
      const data: { summarized: number; remaining: number } = await response.json();
      if (initialRemaining === null) initialRemaining = data.remaining + data.summarized;
      if (data.remaining === 0) break;
      const percent = initialRemaining ? Math.round(((initialRemaining - data.remaining) / initialRemaining) * 100) : 0;
      setSummarizeStatus(`Resumindo... ${percent}% (faltam ${data.remaining})`);
    }
    setSummarizeStatus(null);
    router.refresh();
  }

  async function deleteProject() {
    if (!confirm("Excluir este projeto, com todo o código e documentos? Essa ação não pode ser desfeita.")) {
      return;
    }
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    router.push("/projetos");
  }

  const stageLabel: Record<ImportStage, string> = {
    idle: "",
    reading: "Lendo e filtrando o arquivo...",
    sending: `Enviando... lote ${Math.min(batchDone + 1, batchTotal)} de ${batchTotal}`,
    summarizing: summarizeStatus ?? "Organizando o projeto...",
    done: "Importação concluída.",
  };
  const filePercent = fileTotal > 0 ? Math.round((fileDone / fileTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-accent-soft p-3 text-xs text-text-secondary">
        O código e os documentos deste projeto são enviados à Anthropic quando o Claude usa o
        projeto. Documentos não vão para a OpenAI (só o áudio das reuniões vai).
      </p>

      {error && (
        <p role="alert" className="text-sm text-record">
          {error}
        </p>
      )}

      {stage !== "idle" && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium text-text">{stageLabel[stage]}</p>
          {stage === "sending" && (
            <>
              <ProgressBar percent={filePercent} />
              <p className="text-xs text-text-secondary">
                {fileDone} de {fileTotal} arquivo(s) · {filePercent}%
              </p>
            </>
          )}
          {stage === "sending" && !cancelled && (
            <button
              type="button"
              onClick={cancelImport}
              className="flex h-10 items-center justify-center rounded-lg border border-border text-sm font-semibold text-record"
            >
              Cancelar envio
            </button>
          )}
          {cancelled && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resumeImport}
                disabled={busy}
                className="flex h-10 flex-1 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white disabled:opacity-60"
              >
                Continuar envio
              </button>
            </div>
          )}
          {batchErrors.length > 0 && !cancelled && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-record">
                {batchErrors.length} lote(s) falharam ao enviar — os demais foram enviados normalmente.
              </p>
              <button
                type="button"
                onClick={retryFailedBatches}
                disabled={busy}
                className="flex h-10 items-center justify-center rounded-lg border border-border text-sm font-semibold text-accent disabled:opacity-60"
              >
                Tentar de novo os que falharam
              </button>
            </div>
          )}
          {serverRejected.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-text-secondary">
                {serverRejected.length} excluído(s) ao salvar:
              </p>
              <ul className="max-h-32 overflow-y-auto text-xs text-text-secondary">
                {serverRejected.map((item, index) => (
                  <li key={`${item.path}-${index}`}>
                    {item.path} — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {pending && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="font-semibold text-text">
            {pending.accepted.length} {pending.kind === "code" ? "arquivo(s)" : "documento(s)"} prontos
            para enviar
          </p>
          {pending.rejected.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-text-secondary">
                {pending.rejected.length} excluído(s) ao ler:
              </p>
              <ul className="max-h-40 overflow-y-auto text-xs text-text-secondary">
                {pending.rejected.map((item) => (
                  <li key={item.path}>
                    {item.path} — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmImport}
              disabled={busy || pending.accepted.length === 0}
              className="flex h-11 flex-1 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white disabled:opacity-60"
            >
              Confirmar e enviar
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy}
              className="flex h-11 items-center justify-center px-4 text-sm font-semibold text-text-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold text-accent">
          Importar código (.zip)
          <input ref={zipInputRef} type="file" accept=".zip" onChange={handleZipSelected} className="hidden" />
        </label>
        <label className="flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold text-accent">
          Importar documentos (.md, .txt, .pdf, .docx, .csv)
          <input
            ref={documentsInputRef}
            type="file"
            multiple
            accept=".md,.txt,.pdf,.docx,.csv"
            onChange={handleDocumentsSelected}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Arquivos de código ({files.length})
        </h2>
        {files.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum arquivo importado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {files.map((file) => (
              <li key={file.path} className="rounded-lg border border-border bg-surface p-2 text-sm">
                <p className="text-text">{file.path}</p>
                <p className="text-xs text-text-secondary">
                  {formatBytes(file.size_bytes)} · {file.summary ?? "sem resumo ainda"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Documentos de apoio ({documents.length})
        </h2>
        {documents.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum documento importado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {documents.map((doc) => (
              <li key={doc.filename} className="rounded-lg border border-border bg-surface p-2 text-sm">
                <p className="text-text">{doc.filename}</p>
                <p className="text-xs text-text-secondary">
                  {formatBytes(doc.size_bytes)} · {doc.summary ?? "sem resumo ainda"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={deleteProject}
        className="flex min-h-11 items-center justify-center font-semibold text-record"
      >
        Excluir projeto
      </button>
    </div>
  );
}

export function formatImportedAt(value: string | null): string {
  return value ? formatDateTime(value) : "Ainda não importado";
}
