"use client";

import { Check, Clipboard, Loader2, Printer, Share2 } from "lucide-react";
import { useState } from "react";
import { PdfDownloadButton } from "@/components/PdfDownloadButton";
import { buildMinutesDocxBlob, safeFilename } from "@/lib/minutes/docx";
import { buildMinutesExportHtml } from "@/lib/minutes/export";
import { buildAtaPdfBlocks } from "@/lib/pdf/blocks";
import { buildExportFilename } from "@/lib/pdf/filename";
import { renderPdfDocuments } from "@/lib/pdf/writer";
import type { MinutesDocument } from "@/lib/minutes/schema";

/** Barra de ações da ata: imprimir/PDF, exportar DOCX (OOXML real), copiar texto, compartilhar. */
export function MinutesExportBar({
  document: minutesDocument,
  letterhead,
}: {
  document: MinutesDocument;
  letterhead: { text: string; logo: string | null };
}) {
  const [copied, setCopied] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  const titulo = minutesDocument.titulo;
  const ataFormal = minutesDocument.ata_formal;

  function printPdf() {
    const html = buildMinutesExportHtml({ titulo, ataFormal, letterhead });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }

  async function exportDocx() {
    setDocxError(null);
    setExportingDocx(true);
    try {
      const blob = await buildMinutesDocxBlob({ document: minutesDocument, letterhead });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeFilename(titulo, "docx");
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setDocxError("Não foi possível gerar o DOCX agora. Tente de novo.");
    } finally {
      setExportingDocx(false);
    }
  }

  function copyText() {
    navigator.clipboard.writeText(ataFormal).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, text: ataFormal });
        return;
      } catch {
        // usuário cancelou ou API indisponível — cai para o mailto abaixo
      }
    }
    window.location.href = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(ataFormal)}`;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={printPdf}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent"
        >
          <Printer size={14} /> Imprimir / PDF
        </button>
        <button
          type="button"
          onClick={exportDocx}
          disabled={exportingDocx}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent disabled:opacity-60"
        >
          {exportingDocx && <Loader2 size={14} className="animate-spin" />}
          Exportar DOCX
        </button>
        <PdfDownloadButton
          filename={buildExportFilename("Ata", titulo, "pdf")}
          shareTitle={titulo}
          buildPdf={() => renderPdfDocuments([buildAtaPdfBlocks(minutesDocument)], letterhead)}
        />
        <button
          type="button"
          onClick={copyText}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent"
        >
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          {copied ? "Copiado" : "Copiar texto"}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent"
        >
          <Share2 size={14} /> Compartilhar
        </button>
      </div>
      {docxError && <p className="text-xs text-record">{docxError}</p>}
    </div>
  );
}
