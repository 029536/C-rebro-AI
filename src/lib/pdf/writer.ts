// Desenha os blocos de lib/pdf/blocks.ts num PDF de verdade (jsPDF, no
// navegador — CLAUDE.md). Tipografia limpa, cabeçalho com o timbre e logo da
// empresa (mesmo dado que o DOCX da ata já usa), quebra de página manual
// (jsPDF não pagina texto sozinho) e rodapé com paginação em toda página.
//
// jsPDF só é importado dinamicamente (import() dentro de renderPdfDocuments):
// é uma biblioteca pesada, usada só quando alguém pede um PDF — não faz
// sentido ir no JS carregado por toda visita à tela da reunião, no celular.

import type { jsPDF as JsPdf } from "jspdf";
import type { PdfBlock, PdfDocumentBlocks } from "./blocks";

export type PdfLetterhead = { text: string; logo: string | null };

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 20;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const LOGO_SIZE_MM = 14;
const TEXT_COLOR: [number, number, number] = [22, 24, 29];
const MUTED_COLOR: [number, number, number] = [91, 96, 107];
const BORDER_COLOR: [number, number, number] = [230, 226, 219];

function imageFormatFromDataUri(dataUri: string): "PNG" | "JPEG" {
  return dataUri.startsWith("data:image/png") ? "PNG" : "JPEG";
}

/** Layout de baixo nível: cursor de página, quebra manual, uma página por vez. */
class PdfWriter {
  readonly doc: JsPdf;
  private y = MARGIN_MM;
  private hasContent = false;

  constructor(doc: JsPdf) {
    this.doc = doc;
  }

  private ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT_MM - MARGIN_MM) {
      this.doc.addPage();
      this.y = MARGIN_MM;
    }
  }

  /** Começa um novo documento numa página nova — exceto o primeiro, que usa a página já aberta. */
  startNewDocument() {
    if (this.hasContent) {
      this.doc.addPage();
      this.y = MARGIN_MM;
    }
  }

  addLetterhead(letterhead: PdfLetterhead) {
    if (!letterhead.text && !letterhead.logo) return;
    this.hasContent = true;
    const startY = this.y;
    let textX = MARGIN_MM;

    if (letterhead.logo) {
      try {
        this.doc.addImage(letterhead.logo, imageFormatFromDataUri(letterhead.logo), MARGIN_MM, this.y, LOGO_SIZE_MM, LOGO_SIZE_MM);
        textX = MARGIN_MM + LOGO_SIZE_MM + 4;
      } catch {
        // logo num formato que o jsPDF não decodifica — segue sem travar a exportação.
      }
    }

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...MUTED_COLOR);
    let lineY = this.y + 4;
    for (const line of letterhead.text.split("\n").map((l) => l.trim()).filter(Boolean)) {
      this.doc.text(line, textX, lineY);
      lineY += 4;
    }

    this.y = Math.max(startY + (letterhead.logo ? LOGO_SIZE_MM : 0), lineY) + 3;
    this.doc.setDrawColor(...BORDER_COLOR);
    this.doc.line(MARGIN_MM, this.y, PAGE_WIDTH_MM - MARGIN_MM, this.y);
    this.y += 7;
    this.doc.setTextColor(...TEXT_COLOR);
  }

  addTitle(text: string) {
    this.hasContent = true;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.setTextColor(...TEXT_COLOR);
    for (const line of this.doc.splitTextToSize(text, CONTENT_WIDTH_MM) as string[]) {
      this.ensureSpace(8);
      this.doc.text(line, MARGIN_MM, this.y);
      this.y += 8;
    }
    this.y += 1;
  }

  addMeta(lines: string[]) {
    if (lines.length === 0) return;
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...MUTED_COLOR);
    for (const line of lines) {
      for (const wrapped of this.doc.splitTextToSize(line, CONTENT_WIDTH_MM) as string[]) {
        this.ensureSpace(5);
        this.doc.text(wrapped, MARGIN_MM, this.y);
        this.y += 5;
      }
    }
    this.doc.setTextColor(...TEXT_COLOR);
    this.y += 3;
  }

  addHeading(text: string) {
    this.y += 2;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(...TEXT_COLOR);
    for (const line of this.doc.splitTextToSize(text, CONTENT_WIDTH_MM) as string[]) {
      this.ensureSpace(7);
      this.doc.text(line, MARGIN_MM, this.y);
      this.y += 7;
    }
  }

  addParagraph(text: string) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10.5);
    for (const paragraph of text.split("\n")) {
      if (!paragraph.trim()) {
        this.y += 3;
        continue;
      }
      for (const line of this.doc.splitTextToSize(paragraph, CONTENT_WIDTH_MM) as string[]) {
        this.ensureSpace(5.5);
        this.doc.text(line, MARGIN_MM, this.y);
        this.y += 5.5;
      }
    }
    this.y += 2;
  }

  addBullets(items: string[]) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10.5);
    const indentMm = 5;
    for (const item of items) {
      const wrapped = this.doc.splitTextToSize(item, CONTENT_WIDTH_MM - indentMm) as string[];
      wrapped.forEach((line, index) => {
        this.ensureSpace(5.5);
        this.doc.text(index === 0 ? `- ${line}` : `  ${line}`, MARGIN_MM, this.y);
        this.y += 5.5;
      });
    }
    this.y += 2;
  }

  addMonospace(text: string) {
    this.doc.setFont("courier", "normal");
    this.doc.setFontSize(9);
    for (const rawLine of text.split("\n")) {
      const wrapped = rawLine ? (this.doc.splitTextToSize(rawLine, CONTENT_WIDTH_MM) as string[]) : [""];
      for (const line of wrapped) {
        this.ensureSpace(4.5);
        this.doc.text(line, MARGIN_MM, this.y);
        this.y += 4.5;
      }
    }
    this.doc.setFont("helvetica", "normal");
    this.y += 2;
  }

  addBlock(block: PdfBlock) {
    this.hasContent = true;
    if (block.type === "heading") this.addHeading(block.text);
    else if (block.type === "paragraph") this.addParagraph(block.text);
    else if (block.type === "bullets") this.addBullets(block.items);
    else this.addMonospace(block.text);
  }

  finalizeFooter() {
    const totalPages = this.doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page++) {
      this.doc.setPage(page);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED_COLOR);
      this.doc.text(`Página ${page} de ${totalPages}`, PAGE_WIDTH_MM / 2, PAGE_HEIGHT_MM - 10, { align: "center" });
    }
  }

  toBlob(): Blob {
    return this.doc.output("blob");
  }
}

/**
 * Renderiza um ou mais documentos (ata, parecer, plano, transcrição) num
 * único PDF — cada documento começa em página nova, exceto o primeiro.
 * Usado tanto pelo botão "Baixar PDF" de cada aba (array com 1 item) quanto
 * por "Exportar tudo" (vários).
 */
export async function renderPdfDocuments(docs: PdfDocumentBlocks[], letterhead: PdfLetterhead): Promise<Blob> {
  if (docs.length === 0) {
    throw new Error("Nenhum documento selecionado para exportar.");
  }
  const { jsPDF } = await import("jspdf");
  const writer = new PdfWriter(new jsPDF({ unit: "mm", format: "a4" }));
  docs.forEach((doc, index) => {
    if (index > 0) writer.startNewDocument();
    writer.addLetterhead(letterhead);
    writer.addTitle(doc.title);
    writer.addMeta(doc.metaLines);
    for (const block of doc.blocks) writer.addBlock(block);
  });
  writer.finalizeFooter();
  return writer.toBlob();
}
