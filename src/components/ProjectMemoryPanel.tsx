"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";

export function ProjectMemoryPanel({
  projectId,
  initialSummary,
  initialLockedNote,
  initialUpdatedAt,
}: {
  projectId: string;
  initialSummary: string;
  initialLockedNote: string;
  initialUpdatedAt: string | null;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [lockedNote, setLockedNote] = useState(initialLockedNote);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/memory/refresh`, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Não foi possível atualizar agora.");
      setRefreshing(false);
      return;
    }
    setSummary(data.summary ?? "");
    setLockedNote(data.locked_note ?? "");
    setUpdatedAt(data.updated_at ?? null);
    setRefreshing(false);
  }

  async function saveLockedNote() {
    setSavingNote(true);
    const response = await fetch(`/api/projects/${projectId}/memory`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked_note: lockedNote }),
    });
    setSavingNote(false);
    if (response.ok) {
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1500);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          {updatedAt ? `Atualizada em ${formatDateTime(updatedAt)}` : "Ainda não atualizada"}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Atualizando..." : "Atualizar agora"}
        </button>
      </div>

      {error && <p className="text-sm text-record">{error}</p>}

      {summary ? (
        <p className="whitespace-pre-wrap text-sm text-text">{summary}</p>
      ) : (
        <p className="text-text-secondary">
          Ainda não há memória deste projeto — ela é construída sozinha ao encerrar reuniões
          ligadas a ele, ou agora mesmo com &ldquo;Atualizar agora&rdquo;.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Nota fixa (a IA nunca sobrescreve)
        </h3>
        <p className="text-xs text-text-secondary">
          Decisões ou fatos que você quer garantir que fiquem sempre certos na memória, mesmo
          quando ela for atualizada de novo.
        </p>
        <textarea
          value={lockedNote}
          onChange={(event) => setLockedNote(event.target.value)}
          rows={4}
          placeholder="Ex.: o prazo final é 30/03, não negociar."
          className="rounded-lg border border-border bg-background p-3 text-sm text-text outline-none"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveLockedNote}
            disabled={savingNote}
            className="flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingNote ? "Salvando..." : "Salvar"}
          </button>
          {noteSaved && <span className="text-xs font-semibold text-accent">Salvo.</span>}
        </div>
      </div>
    </div>
  );
}
