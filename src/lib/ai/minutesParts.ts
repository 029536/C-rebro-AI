import {
  minutesFinalFieldsSchema,
  minutesPartContentSchema,
  type MinutesFinalFields,
  type MinutesPartContent,
} from "@/lib/minutes/schema";
import { normalizeMinutesPartContent } from "@/lib/minutes/normalizePartContent";
import { extractText, getAnthropicClient } from "./anthropic";
import { ExpectedAIError, summarizeZodIssues } from "./env";
import {
  MINUTES_FINAL_FIELDS_INPUT_SCHEMA,
  MINUTES_FINAL_FIELDS_TOOL_NAME,
  MINUTES_PART_INPUT_SCHEMA,
  MINUTES_PART_TOOL_NAME,
  minutesFinalFieldsSystemPrompt,
  minutesPartQuickSummarySystemPrompt,
  minutesPartSystemPrompt,
} from "./prompts";
import { callStructuredTool } from "./structuredTool";

/** O Claude respondeu, mas não no formato esperado — não é falta de chave nem erro de rede. */
export class MinutesPartGenerationError extends ExpectedAIError {}

const PART_MAX_TOKENS = 6_000;
const QUICK_SUMMARY_MAX_TOKENS = 400;
const FINAL_FIELDS_MAX_TOKENS = 2_000;

const MOCK_PART_CONTENT: MinutesPartContent = {
  assuntos_discutidos: ["Assunto simulado desta parte (MOCK_AI=1)."],
  decisoes: ["Decisão simulada desta parte."],
  responsabilidades: [{ parte: "Equipe", itens: ["Item de responsabilidade simulado."] }],
  acoes_futuras: [{ acao: "Ação futura simulada desta parte.", responsavel: null, prazo: null }],
  ata_formal_trecho: "Trecho de ata simulado desta parte (MOCK_AI=1).",
};

const MOCK_QUICK_SUMMARY = "Resumo rápido simulado desta parte (MOCK_AI=1).";

const MOCK_FINAL_FIELDS: MinutesFinalFields = {
  titulo: "Reunião longa (ata simulada em partes — MOCK_AI=1)",
  resumo_executivo: "Resumo executivo simulado, a partir dos resumos das partes (MOCK_AI=1).",
  observacoes: null,
  proximos_encontros: [],
};

type QuickSummaryAttempt = { text: string; stopReason: string | null; blockTypes: string[] };

async function tryGenerateQuickSummary(
  model: string,
  maxTokens: number,
  transcriptChunk: string
): Promise<QuickSummaryAttempt> {
  const message = await getAnthropicClient().messages.create({
    model,
    max_tokens: maxTokens,
    system: minutesPartQuickSummarySystemPrompt(),
    messages: [{ role: "user", content: `<transcricao>\n${transcriptChunk}\n</transcricao>` }],
  });
  return {
    text: extractText(message.content).trim(),
    stopReason: message.stop_reason,
    blockTypes: message.content.map((block) => block.type),
  };
}

/**
 * Resumo rápido (texto livre) de uma parte — vira contexto das partes
 * seguintes. NUNCA devolve vazio: se a primeira tentativa (CLAUDE_FAST_MODEL)
 * vier em branco, tenta de novo com mais espaço; persistindo, troca para o
 * CLAUDE_MODEL normal. Se mesmo assim vier vazio, lança — quem chama
 * (lib/minutes/multipart.ts) nunca salva um resumo vazio, deixa `null` e
 * tenta de novo depois. Loga só stop_reason e os tipos de bloco recebidos,
 * nunca texto da reunião (CLAUDE.md).
 */
export async function generatePartQuickSummary(transcriptChunk: string): Promise<string> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_QUICK_SUMMARY;
  }

  const fastModel = process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5";
  const mainModel = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
  const attempts = [
    { model: fastModel, maxTokens: QUICK_SUMMARY_MAX_TOKENS },
    { model: fastModel, maxTokens: QUICK_SUMMARY_MAX_TOKENS * 2 },
    { model: mainModel, maxTokens: QUICK_SUMMARY_MAX_TOKENS * 2 },
  ];

  let last: QuickSummaryAttempt | null = null;
  for (const { model, maxTokens } of attempts) {
    last = await tryGenerateQuickSummary(model, maxTokens, transcriptChunk);
    if (last.text) return last.text;
    console.warn(
      `generatePartQuickSummary: resumo vazio (modelo=${model}, max_tokens=${maxTokens}, stop_reason=${
        last.stopReason ?? "desconhecido"
      }, blocos=${last.blockTypes.join(",") || "nenhum"}).`
    );
  }

  throw new MinutesPartGenerationError(
    "O resumo rápido de uma parte da ata veio vazio, mesmo depois de tentar de novo e trocar de modelo.",
    `stop_reason=${last?.stopReason ?? "desconhecido"} · blocos=${last?.blockTypes.join(",") || "nenhum"}`
  );
}

/** Conteúdo estruturado de UMA parte (CLAUDE_MODEL — registro fiel, não é resumo barato). */
export async function generateMinutesPartContent(params: {
  companyContext: string;
  meetingContext?: string;
  partNumber: number;
  totalParts: number;
  previousPartsSummaryBlock?: string | null;
  transcriptChunk: string;
}): Promise<MinutesPartContent> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_PART_CONTENT;
  }

  const input = await callStructuredTool({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    maxTokens: PART_MAX_TOKENS,
    system: minutesPartSystemPrompt(params),
    messages: [{ role: "user", content: `<transcricao>\n${params.transcriptChunk}\n</transcricao>` }],
    toolName: MINUTES_PART_TOOL_NAME,
    toolDescription: "Salva o conteúdo estruturado de uma parte da ata.",
    inputSchema: MINUTES_PART_INPUT_SCHEMA,
  });

  const parsed = minutesPartContentSchema.safeParse(normalizeMinutesPartContent(input));
  if (!parsed.success) {
    throw new MinutesPartGenerationError(
      `A parte ${params.partNumber} de ${params.totalParts} da ata não veio num formato válido.`,
      summarizeZodIssues(parsed.error)
    );
  }
  return parsed.data;
}

/** Título, resumo executivo, observações e próximos encontros — só a partir dos resumos das partes. */
export async function generateMinutesFinalFields(params: {
  companyContext: string;
  meetingContext?: string;
  partSummariesBlock: string;
}): Promise<MinutesFinalFields> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_FINAL_FIELDS;
  }

  const input = await callStructuredTool({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    maxTokens: FINAL_FIELDS_MAX_TOKENS,
    system: minutesFinalFieldsSystemPrompt(params),
    messages: [
      { role: "user", content: `<resumos_das_partes>\n${params.partSummariesBlock}\n</resumos_das_partes>` },
    ],
    toolName: MINUTES_FINAL_FIELDS_TOOL_NAME,
    toolDescription: "Salva os campos finais da ata.",
    inputSchema: MINUTES_FINAL_FIELDS_INPUT_SCHEMA,
  });

  const parsed = minutesFinalFieldsSchema.safeParse(input);
  if (!parsed.success) {
    throw new MinutesPartGenerationError(
      "Os campos finais da ata não vieram num formato válido.",
      summarizeZodIssues(parsed.error)
    );
  }
  return parsed.data;
}
