"use client";

import { Check, Clipboard, Printer, Share2 } from "lucide-react";
import { useState } from "react";
import { buildMinutesExportHtml } from "@/lib/minutes/export";

/** Barra de ações da ata: imprimir/PDF, exportar DOCX, copiar texto, compartilhar. */
export function MinutesExportBar({
  ataFormal,
  titulo,
  letterhead,
}: {
  ataFormal: string;
  titulo: string;
  letterhead: { text: string; logo: string | null };
}) {
  const [copied, setCopied] = useState(false);

  function printPdf() {
    const html = buildMinutesExportHtml({ titulo, ataFormal, letterhead });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }

  function exportDocx() {
    const html = buildMinutesExportHtml({ titulo, ataFormal, letterhead });
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${titulo || "ata"}.doc`;
    link.click();
    URL.revokeObjectURL(url);
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
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent"
      >
        Exportar DOCX
      </button>
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
  );
}
