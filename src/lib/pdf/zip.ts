// Agrupa vários PDFs num único .zip ("Exportar tudo" > um arquivo por
// documento), com a mesma biblioteca (fflate) já usada para abrir o zip de
// código importado (lib/projects/zip.ts).

import { zipSync } from "fflate";

export async function buildPdfZip(files: { filename: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.filename] = new Uint8Array(await file.blob.arrayBuffer());
  }
  return new Blob([zipSync(entries)], { type: "application/zip" });
}
