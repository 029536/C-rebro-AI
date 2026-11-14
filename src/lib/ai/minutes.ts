import type { Participant } from "@/lib/participants";
import { minutesContentSchema, type MinutesContent } from "@/lib/minutes/schema";
import { ExpectedAIError, summarizeZodIssues } from "./env";
import { MINUTES_INPUT_SCHEMA, MINUTES_TOOL_NAME, minutesSystemPrompt } from "./prompts";
import { callStructuredTool } from "./structuredTool";

const BASE_MAX_TOKENS = 8_000;
const MAX_TOKENS_CEILING = 24_000;
// pt-BR gira em torno de 3-4 caracteres por token; a ata_formal pode chegar perto do
// tamanho da transcrição, então o teto cresce com ela — sem isso, reuniões longas
// (1h+) cortam a resposta no meio (ver callStructuredTool, escalada por max_tokens).
const CHARS_PER_EXTRA_TOKEN = 3;

/** Teto de tokens de saída da ata, maior para transcrições mais longas. Exportado para teste. */
export function minutesMaxTokens(transcriptLength: number): number {
  return Math.min(BASE_MAX_TOKENS + Math.floor(transcriptLength / CHARS_PER_EXTRA_TOKEN), MAX_TOKENS_CEILING);
}

/** O Claude respondeu, mas não no formato esperado — não é falta de chave nem erro de rede. */
export class MinutesGenerationError extends ExpectedAIError {}

const MOCK_CONTENT: MinutesContent = {
  titulo: "Reunião (ata simulada — MOCK_AI=1)",
  assuntos_discutidos: ["Assunto discutido simulado para teste."],
  decisoes: ["Decisão simulada para teste."],
  responsabilidades: [{ parte: "Equipe", itens: ["Item de responsabilidade simulado."] }],
  acoes_futuras: [{ acao: "Ação futura simulada.", responsavel: null, prazo: null }],
  observacoes: null,
  resumo_executivo: "Resumo executivo simulado desta reunião (MOCK_AI=1).",
  proximos_encontros: [],
  ata_formal: "ATA DE REUNIÃO (simulada, MOCK_AI=1)\n\nConteúdo de teste, sem chamada real à Anthropic.",
};

export async function generateMinutesContent(params: {
  companyContext: string;
  meetingType: "client" | "internal";
  clientName: string | null;
  participants: Participant[];
  meetingContext?: string;
  date: string;
  time: string;
  transcript: string;
}): Promise<MinutesContent> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_CONTENT;
  }

  const input = await callStructuredTool({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    maxTokens: minutesMaxTokens(params.transcript.length),
    system: minutesSystemPrompt(params),
    messages: [{ role: "user", content: `<transcricao>\n${params.transcript}\n</transcricao>` }],
    toolName: MINUTES_TOOL_NAME,
    toolDescription: "Salva o conteúdo estruturado da ata da reunião.",
    inputSchema: MINUTES_INPUT_SCHEMA,
  });

  const parsed = minutesContentSchema.safeParse(input);
  if (!parsed.success) {
    throw new MinutesGenerationError(
      "O Claude não devolveu a ata num formato válido.",
      summarizeZodIssues(parsed.error)
    );
  }
  return parsed.data;
}
