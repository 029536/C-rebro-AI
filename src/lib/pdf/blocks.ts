// Monta o CONTEÚDO de cada documento exportável em PDF (ata, parecer, plano,
// transcrição) como uma lista de blocos simples — sem tocar no jsPDF. Mantém
// a lógica de "o que vai no documento, em que ordem" pura e testável sem
// precisar renderizar um PDF de verdade (ver lib/pdf/writer.ts, que só lê
// esses blocos e desenha).

import { formatParticipant } from "@/lib/participants";
import type { MinutesDocument } from "@/lib/minutes/schema";
import type { ReviewContent } from "@/lib/reviews/schema";

export type PdfBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "monospace"; text: string };

export type PdfDocumentBlocks = {
  /** Usado no filename ("Ata", "Parecer", "Plano", "Transcrição") e no rodapé. */
  kind: "ata" | "parecer" | "plano" | "transcricao";
  title: string;
  metaLines: string[];
  blocks: PdfBlock[];
};

export function buildAtaPdfBlocks(document: MinutesDocument): PdfDocumentBlocks {
  const metaLines = [`Data: ${document.data} às ${document.horario}`];
  if (document.tipo === "internal") {
    metaLines.push("Tipo: reunião interna");
  } else if (document.cliente_ou_empresa) {
    metaLines.push(`Cliente ou empresa: ${document.cliente_ou_empresa}`);
  }
  if (document.participantes.length > 0) {
    metaLines.push(`Participantes: ${document.participantes.map(formatParticipant).join(", ")}`);
  }

  return {
    kind: "ata",
    title: document.titulo,
    metaLines,
    blocks: [{ type: "paragraph", text: document.ata_formal }],
  };
}

export function buildReviewPdfBlocks(content: ReviewContent, meetingTitle: string): PdfDocumentBlocks {
  const blocks: PdfBlock[] = [
    { type: "heading", text: "Meu diagnóstico" },
    { type: "paragraph", text: content.diagnostico },
    { type: "heading", text: "Minha avaliação das ideias" },
    { type: "paragraph", text: content.avaliacao },
  ];
  if (content.como_desenvolveria.length > 0) {
    blocks.push({ type: "heading", text: "Como eu desenvolveria" }, { type: "bullets", items: content.como_desenvolveria });
  }
  if (content.perguntas_criticas.length > 0) {
    blocks.push({ type: "heading", text: "Perguntas críticas" }, { type: "bullets", items: content.perguntas_criticas });
  }

  return { kind: "parecer", title: `Parecer da IA — ${meetingTitle}`, metaLines: [], blocks };
}

export type PlanPdfTask = {
  position: number;
  title: string;
  description: string;
  acceptance: string;
  priority: "alta" | "media" | "baixa";
  depends_on: number[];
  prompt_md: string;
};

const PRIORITY_LABEL: Record<PlanPdfTask["priority"], string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export function buildPlanPdfBlocks(
  plan: { summary: string; tasks: PlanPdfTask[] },
  meetingTitle: string
): PdfDocumentBlocks {
  const blocks: PdfBlock[] = [{ type: "paragraph", text: plan.summary }];

  for (const task of plan.tasks) {
    const dependsOnTitles = task.depends_on
      .map((position) => plan.tasks.find((other) => other.position === position)?.title)
      .filter((title): title is string => Boolean(title));

    blocks.push({ type: "heading", text: `${task.position}. ${task.title}` });
    const meta = [`Prioridade: ${PRIORITY_LABEL[task.priority]}`];
    if (dependsOnTitles.length > 0) meta.push(`Depende de: ${dependsOnTitles.join(", ")}`);
    blocks.push({ type: "paragraph", text: meta.join(" · ") });
    blocks.push({ type: "paragraph", text: task.description });
    blocks.push({ type: "paragraph", text: `Critério de aceite: ${task.acceptance}` });
    blocks.push({ type: "monospace", text: task.prompt_md });
  }

  return { kind: "plano", title: `Plano de execução — ${meetingTitle}`, metaLines: [], blocks };
}

export type TranscriptPdfChunk = { part_no: number; transcript: string };

export function buildTranscriptPdfBlocks(chunks: TranscriptPdfChunk[], meetingTitle: string): PdfDocumentBlocks {
  const blocks: PdfBlock[] = [];
  let currentPart: number | null = null;
  for (const chunk of chunks) {
    if (chunk.part_no !== currentPart) {
      blocks.push({ type: "heading", text: `Parte ${chunk.part_no}` });
      currentPart = chunk.part_no;
    }
    blocks.push({ type: "paragraph", text: chunk.transcript });
  }

  return { kind: "transcricao", title: `Transcrição — ${meetingTitle}`, metaLines: [], blocks };
}

export type PdfExportSelection = { ata: boolean; parecer: boolean; plano: boolean; transcricao: boolean };

/**
 * Decide quais documentos entram na exportação ("Exportar tudo"), na ordem
 * fixa ata → parecer → plano → transcrição, pulando o que foi desmarcado ou
 * não existe ainda — nunca falha por faltar um dos quatro.
 */
export function selectPdfDocuments(params: {
  selection: PdfExportSelection;
  ata?: MinutesDocument | null;
  review?: ReviewContent | null;
  plan?: { summary: string; tasks: PlanPdfTask[] } | null;
  chunks?: TranscriptPdfChunk[] | null;
  meetingTitle: string;
}): PdfDocumentBlocks[] {
  const docs: PdfDocumentBlocks[] = [];
  if (params.selection.ata && params.ata) docs.push(buildAtaPdfBlocks(params.ata));
  if (params.selection.parecer && params.review) docs.push(buildReviewPdfBlocks(params.review, params.meetingTitle));
  if (params.selection.plano && params.plan && params.plan.tasks.length > 0) {
    docs.push(buildPlanPdfBlocks(params.plan, params.meetingTitle));
  }
  if (params.selection.transcricao && params.chunks && params.chunks.length > 0) {
    docs.push(buildTranscriptPdfBlocks(params.chunks, params.meetingTitle));
  }
  return docs;
}
