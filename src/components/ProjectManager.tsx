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

type PendingImport =
  | { kind: "code"; accepted: AcceptedZipEntry[]; rejected: RejectedZipEntry[] }
  | { kind: "documents"; accepted: { filename: string; content: string; sizeBytes: number }[]; rejected: RejectedZipEntry[] };

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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summarizeProgress, setSummarizeProgress] = useState<string | null>(null);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const documentsInputRef = useRef<HTMLInputElement>(null);

  async function handleZipSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const summary = await readZipFile(file);
      setPending({ kind: "code", accepted: summary.accepted, rejected: summary.rejected });
    } catch {
      setError("Não foi possível abrir esse .zip.");
    } finally {
      setBusy(false);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  }

  async function handleDocumentsSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    setError(null);
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
    if (documentsInputRef.current) documentsInputRef.current.value = "";
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === "code") {
        const batches = splitIntoBatches(pending.accepted, PROJECT_UPLOAD_BATCH_MAX_BYTES);
        for (const batch of batches) {
          setStatus(`Enviando código... (${batch.length} arquivo(s))`);
          const response = await fetch(`/api/projects/${projectId}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              files: batch.map((entry) => ({
                path: entry.path,
                content: entry.content,
                sizeBytes: entry.sizeBytes,
              })),
            }),
          });
          if (!response.ok) throw new Error("falha ao enviar código");
        }

        const documentFilenames = documents.map((doc) => doc.filename);
        const codePaths = Array.from(new Set([...files.map((f) => f.path), ...pending.accepted.map((f) => f.path)]));
        setStatus("Organizando o projeto...");
        await fetch(`/api/projects/${projectId}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codePaths, documentFilenames }),
        });
      } else {
        setStatus(`Enviando ${pending.accepted.length} documento(s)...`);
        const response = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documents: pending.accepted }),
        });
        if (!response.ok) throw new Error("falha ao enviar documentos");

        const codePaths = files.map((f) => f.path);
        const documentFilenames = Array.from(
          new Set([...documents.map((d) => d.filename), ...pending.accepted.map((d) => d.filename)])
        );
        setStatus("Organizando o projeto...");
        await fetch(`/api/projects/${projectId}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codePaths, documentFilenames }),
        });
      }

      setPending(null);
      setStatus(null);
      router.refresh();
      await runSummarize();
    } catch {
      setError("Falha ao enviar. Tente de novo.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function runSummarize() {
    for (let i = 0; i < 20; i++) {
      const response = await fetch(`/api/projects/${projectId}/summarize`, { method: "POST" });
      if (!response.ok) {
        const data: { error?: string } = await response.json().catch(() => ({}));
        setSummarizeProgress(data.error ?? "Não foi possível gerar os resumos.");
        return;
      }
      const data: { summarized: number; remaining: number } = await response.json();
      if (data.remaining === 0) break;
      setSummarizeProgress(`Resumindo... faltam ${data.remaining}`);
    }
    setSummarizeProgress(null);
    router.refresh();
  }

  async function deleteProject() {
    if (!confirm("Excluir este projeto, com todo o código e documentos? Essa ação não pode ser desfeita.")) {
      return;
    }
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    router.push("/projetos");
  }

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
      {status && <p className="text-sm text-text-secondary">{status}</p>}
      {summarizeProgress && <p className="text-sm text-text-secondary">{summarizeProgress}</p>}

      {pending && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="font-semibold text-text">
            {pending.accepted.length} {pending.kind === "code" ? "arquivo(s)" : "documento(s)"} prontos
            para enviar
          </p>
          {pending.rejected.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-text-secondary">
                {pending.rejected.length} excluído(s):
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
