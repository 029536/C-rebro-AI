// Exportação DOCX real (OOXML), com a biblioteca "docx" — substitui o HTML
// disfarçado de .doc. Gerado no navegador (CLAUDE.md, stack). Cabeçalho em
// tabela (a própria biblioteca já gera OOXML de verdade, então a regra
// "nunca flexbox" não se aplica aqui — é só relevante para o HTML de
// impressão/PDF, em lib/minutes/export.ts).

import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
  type ParagraphChild,
} from "docx";
import type { MinutesDocument } from "@/lib/minutes/schema";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 25;
const LOGO_SIZE_PX = 60;
const MUTED_COLOR = "5B606B";

function imageTypeFromDataUri(dataUri: string): "png" | "jpg" {
  return dataUri.startsWith("data:image/png") ? "png" : "jpg";
}

function buildHeaderTable(letterhead: { text: string; logo: string | null }): Table {
  const lines = letterhead.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const textParagraphs =
    lines.length > 0
      ? lines.map(
          (line) =>
            new Paragraph({ children: [new TextRun({ text: line, size: 18, color: MUTED_COLOR })] })
        )
      : [new Paragraph({ text: "" })];

  const textCell = new TableCell({
    width: { size: letterhead.logo ? 80 : 100, type: WidthType.PERCENTAGE },
    children: textParagraphs,
  });

  if (!letterhead.logo) {
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [textCell] })] });
  }

  const logoCell = new TableCell({
    width: { size: 20, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: imageTypeFromDataUri(letterhead.logo),
            data: letterhead.logo,
            transformation: { width: LOGO_SIZE_PX, height: LOGO_SIZE_PX },
          }),
        ],
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [logoCell, textCell] })],
  });
}

function bulletParagraphs(items: string[]): Paragraph[] {
  return items.map((item) => new Paragraph({ text: item, bullet: { level: 0 } }));
}

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
}

/** Monta o corpo do documento (sem cabeçalho/seção) a partir da ata estruturada. */
function buildBody(doc: MinutesDocument): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({ text: doc.titulo, heading: HeadingLevel.TITLE }));

  const metaRuns: ParagraphChild[] = [
    new TextRun({ text: `Data: ${doc.data} às ${doc.horario}`, italics: true, color: MUTED_COLOR }),
  ];
  children.push(new Paragraph({ children: metaRuns, spacing: { after: 120 } }));

  if (doc.participantes.length > 0) {
    const participantesText = doc.participantes
      .map((participante) => (participante.role ? `${participante.name} (${participante.role})` : participante.name))
      .join(", ");
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Participantes: ${participantesText}`, color: MUTED_COLOR })],
        spacing: { after: 120 },
      })
    );
  }

  if (doc.resumo_executivo) {
    children.push(heading("Resumo executivo"));
    children.push(new Paragraph({ text: doc.resumo_executivo }));
  }

  if (doc.assuntos_discutidos.length > 0) {
    children.push(heading("Assuntos discutidos"));
    children.push(...bulletParagraphs(doc.assuntos_discutidos));
  }

  if (doc.decisoes.length > 0) {
    children.push(heading("Decisões"));
    children.push(...bulletParagraphs(doc.decisoes));
  }

  if (doc.responsabilidades.length > 0) {
    children.push(heading("Responsabilidades"));
    for (const grupo of doc.responsabilidades) {
      children.push(new Paragraph({ children: [new TextRun({ text: grupo.parte, bold: true })] }));
      children.push(...bulletParagraphs(grupo.itens));
    }
  }

  if (doc.acoes_futuras.length > 0) {
    children.push(heading("Ações futuras"));
    children.push(
      ...doc.acoes_futuras.map((acao) => {
        const parts = [acao.acao];
        if (acao.responsavel) parts.push(`Responsável: ${acao.responsavel}`);
        if (acao.prazo) parts.push(`Prazo: ${acao.prazo}`);
        return new Paragraph({ text: parts.join(" — "), bullet: { level: 0 } });
      })
    );
  }

  if (doc.observacoes) {
    children.push(heading("Observações"));
    children.push(new Paragraph({ text: doc.observacoes }));
  }

  if (doc.proximos_encontros.length > 0) {
    children.push(heading("Próximos encontros"));
    children.push(
      ...doc.proximos_encontros.map(
        (encontro) =>
          new Paragraph({
            text: encontro.data ? `${encontro.data} — ${encontro.objetivo}` : encontro.objetivo,
            bullet: { level: 0 },
          })
      )
    );
  }

  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Documento gerado pelo Cérebro IA.", size: 16, color: MUTED_COLOR })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 480 },
    })
  );

  return children;
}

/** Gera o .docx real (OOXML) da ata, pronto para baixar (Packer.toBlob). */
export async function buildMinutesDocxBlob(params: {
  document: MinutesDocument;
  letterhead: { text: string; logo: string | null };
}): Promise<Blob> {
  const hasHeader = Boolean(params.letterhead.text || params.letterhead.logo);
  const children: (Paragraph | Table)[] = [];
  if (hasHeader) {
    children.push(buildHeaderTable(params.letterhead));
    children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
  }
  children.push(...buildBody(params.document));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(A4_WIDTH_MM), height: convertMillimetersToTwip(A4_HEIGHT_MM) },
            margin: {
              top: convertMillimetersToTwip(MARGIN_MM),
              bottom: convertMillimetersToTwip(MARGIN_MM),
              left: convertMillimetersToTwip(MARGIN_MM),
              right: convertMillimetersToTwip(MARGIN_MM),
            },
          },
        },
        children,
      },
    ],
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
  });

  return Packer.toBlob(doc);
}

/** Nome de arquivo seguro (sem caracteres inválidos em Windows/macOS) a partir do título. */
export function safeFilename(title: string, extension: string): string {
  const base = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 150);
  return `${base || "ata"}.${extension}`;
}
