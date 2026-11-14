"use client";

import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { shareOrDownloadFile } from "@/lib/pdf/share";

/**
 * Botão "Baixar PDF" reutilizável: gera o PDF (callback síncrono, sem pedir
 * nada à IA — só o que já está salvo) e compartilha/baixa. Usado em cada aba
 * (ata, parecer, plano) — ver lib/pdf para a montagem do documento.
 */
export function PdfDownloadButton({
  label = "Baixar PDF",
  filename,
  shareTitle,
  buildPdf,
}: {
  label?: string;
  filename: string;
  shareTitle: string;
  buildPdf: () => Promise<Blob>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const blob = await buildPdf();
      await shareOrDownloadFile(blob, filename, "application/pdf", shareTitle);
    } catch {
      setError("Não foi possível gerar o PDF agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
        {label}
      </button>
      {error && <p className="text-xs text-record">{error}</p>}
    </div>
  );
}
