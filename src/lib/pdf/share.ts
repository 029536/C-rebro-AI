// Compartilhar ou baixar um arquivo gerado no navegador (PDF ou .zip de
// PDFs) — CLAUDE.md: no celular, tenta o Web Share API (WhatsApp, e-mail
// etc.); sem suporte ou se falhar, baixa o arquivo.

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Tenta `navigator.share` com o arquivo; sem suporte ou se falhar (inclusive cancelamento), baixa. */
export async function shareOrDownloadFile(
  blob: Blob,
  filename: string,
  mimeType: string,
  shareTitle: string
): Promise<void> {
  const file = new File([blob], filename, { type: mimeType });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: shareTitle });
      return;
    } catch {
      // usuário cancelou ou a API falhou — baixa como alternativa.
    }
  }

  downloadBlob(blob, filename);
}
