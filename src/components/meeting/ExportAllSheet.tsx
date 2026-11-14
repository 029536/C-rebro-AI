"use client";

import { Download, Loader2, X } from "lucide-react";
import { useState } from "react";
import {
  selectPdfDocuments,
  type PdfExportSelection,
  type PlanPdfTask,
  type TranscriptPdfChunk,
} from "@/lib/pdf/blocks";
import { buildExportFilename } from "@/lib/pdf/filename";
import { shareOrDownloadFile } from "@/lib/pdf/share";
import { renderPdfDocuments, type PdfLetterhead } from "@/lib/pdf/writer";
import { buildPdfZip } from "@/lib/pdf/zip";
import type { MinutesDocument } from "@/lib/minutes/schema";
import type { ReviewContent } from "@/lib/reviews/schema";

type ExportAllData = {
  meetingTitle: string;
  letterhead: PdfLetterhead;
  ata: MinutesDocument | null;
  review: ReviewContent | null;
  plan: { summary: string; tasks: PlanPdfTask[] } | null;
  chunks: TranscriptPdfChunk[];
};

const DEFAULT_SELECTION: PdfExportSelection = { ata: true, parecer: true, plano: true, transcricao: false };

/** Botão "Exportar tudo" que abre a folha de seleção — ver ExportAllSheet. */
export function ExportAllButton(data: ExportAllData) {
  const [open, setOpen] = useState(false);
  const hasAnyDocument = Boolean(data.ata || data.review || data.plan || data.chunks.length > 0);
  if (!hasAnyDocument) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent"
      >
        <Download size={14} /> Exportar tudo
      </button>
      {open && <ExportAllSheet {...data} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportAllSheet({
  meetingTitle,
  letterhead,
  ata,
  review,
  plan,
  chunks,
  onClose,
}: ExportAllData & { onClose: () => void }) {
  const [selection, setSelection] = useState<PdfExportSelection>(DEFAULT_SELECTION);
  const [asZip, setAsZip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docs = selectPdfDocuments({ selection, ata, review, plan, chunks, meetingTitle });

  function toggle(key: keyof PdfExportSelection) {
    setSelection((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  async function handleExport() {
    if (docs.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      if (asZip) {
        const files = await Promise.all(
          docs.map(async (doc) => ({
            filename: buildExportFilename(PREFIX_BY_KIND[doc.kind], meetingTitle, "pdf"),
            blob: await renderPdfDocuments([doc], letterhead),
          }))
        );
        const zipBlob = await buildPdfZip(files);
        await shareOrDownloadFile(
          zipBlob,
          buildExportFilename("Documentos", meetingTitle, "zip"),
          "application/zip",
          `Documentos — ${meetingTitle}`
        );
      } else {
        const blob = await renderPdfDocuments(docs, letterhead);
        await shareOrDownloadFile(
          blob,
          buildExportFilename("Documentos", meetingTitle, "pdf"),
          "application/pdf",
          `Documentos — ${meetingTitle}`
        );
      }
      onClose();
    } catch {
      setError("Não foi possível gerar a exportação agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={() => !busy && onClose()}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-4 pb-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-text">Exportar tudo</span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center text-text-secondary disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <ExportCheckbox
            label="Ata completa"
            checked={selection.ata}
            disabled={!ata}
            onChange={() => toggle("ata")}
          />
          <ExportCheckbox
            label="Parecer da IA"
            checked={selection.parecer}
            disabled={!review}
            onChange={() => toggle("parecer")}
          />
          <ExportCheckbox
            label="Plano de execução"
            checked={selection.plano}
            disabled={!plan || plan.tasks.length === 0}
            onChange={() => toggle("plano")}
          />
          <ExportCheckbox
            label="Transcrição (texto bruto da reunião)"
            checked={selection.transcricao}
            disabled={chunks.length === 0}
            onChange={() => toggle("transcricao")}
          />
        </div>

        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={asZip} onChange={() => setAsZip((value) => !value)} className="h-4 w-4" />
          Um arquivo .zip por documento (em vez de um PDF único)
        </label>

        {error && <p className="mt-2 text-sm text-record">{error}</p>}

        <button
          type="button"
          onClick={handleExport}
          disabled={busy || docs.length === 0}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? "Gerando..." : `Exportar ${docs.length} documento(s)`}
        </button>
      </div>
    </div>
  );
}

const PREFIX_BY_KIND: Record<"ata" | "parecer" | "plano" | "transcricao", string> = {
  ata: "Ata",
  parecer: "Parecer",
  plano: "Plano",
  transcricao: "Transcrição",
};

function ExportCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`flex min-h-11 items-center gap-2 text-sm ${disabled ? "text-text-secondary opacity-50" : "text-text"}`}>
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={onChange}
        className="h-4 w-4"
      />
      {label}
      {disabled && <span className="text-xs">(indisponível)</span>}
    </label>
  );
}
