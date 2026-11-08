// Extração de texto de documentos de apoio, sempre no navegador (nunca sobe o
// arquivo original, só o texto). pdf.js e mammoth são bibliotecas de navegador;
// por isso este arquivo não é coberto por teste automatizado (ver checklist
// manual no CLAUDE.md) — só a decisão "parece escaneado" (isScannedWithoutText)
// é lógica pura e tem teste.

const MIN_TEXT_CHARS_PER_PAGE = 10;

/** PDF com pouco texto por página, mesmo tendo páginas, provavelmente é escaneado sem OCR. */
export function isScannedWithoutText(pageCount: number, totalTextLength: number): boolean {
  if (pageCount <= 0) return false;
  return totalTextLength < pageCount * MIN_TEXT_CHARS_PER_PAGE;
}

export class DocumentRejectedError extends Error {}

async function extractPdfText(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions, PasswordException } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await getDocument({ data: buffer }).promise;
  } catch (error) {
    if (error instanceof PasswordException) {
      throw new DocumentRejectedError("PDF protegido por senha");
    }
    throw new DocumentRejectedError("Não foi possível abrir o PDF");
  }

  const pageTexts: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  const fullText = pageTexts.join("\n\n").trim();
  if (isScannedWithoutText(pdf.numPages, fullText.length)) {
    throw new DocumentRejectedError("PDF parece escaneado, sem texto reconhecível (sem OCR nesta versão)");
  }
  return fullText;
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = result.value.trim();
  if (!text) {
    throw new DocumentRejectedError("Não encontrei texto no documento");
  }
  return text;
}

async function extractPlainText(file: File): Promise<string> {
  const text = (await file.text()).trim();
  if (!text) {
    throw new DocumentRejectedError("Arquivo vazio");
  }
  return text;
}

/** Extrai o texto de um documento de apoio, ou lança DocumentRejectedError com o motivo. */
export async function extractDocumentText(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return extractPdfText(file);
    case "docx":
      return extractDocxText(file);
    case "md":
    case "txt":
    case "csv":
      return extractPlainText(file);
    default:
      throw new DocumentRejectedError("Tipo de arquivo não suportado");
  }
}
