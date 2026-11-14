/** Nome de arquivo seguro (sem caracteres inválidos em Windows/macOS), igual ao padrão de lib/minutes/docx.ts. */
function sanitizeFilenamePart(text: string, maxLength = 150): string {
  return text
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

/** "Ata - título.pdf", "Parecer - título.pdf", "Plano - título.pdf" etc. */
export function buildExportFilename(prefix: string, title: string, extension: string): string {
  const safeTitle = sanitizeFilenamePart(title);
  const name = safeTitle ? `${prefix} - ${safeTitle}` : prefix;
  return `${sanitizeFilenamePart(name, 160)}.${extension}`;
}
