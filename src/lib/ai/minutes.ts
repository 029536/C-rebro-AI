import type { Participant } from "@/lib/participants";
import { minutesContentSchema, type MinutesContent } from "@/lib/minutes/schema";
import { ExpectedAIError } from "./env";
import { MINUTES_INPUT_SCHEMA, MINUTES_TOOL_NAME, minutesSystemPrompt } from "./prompts";
import { callStructuredTool } from "./structuredTool";

const MAX_TOKENS = 8_000;

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
    maxTokens: MAX_TOKENS,
    system: minutesSystemPrompt(params),
    messages: [{ role: "user", content: `<transcricao>\n${params.transcript}\n</transcricao>` }],
    toolName: MINUTES_TOOL_NAME,
    toolDescription: "Salva o conteúdo estruturado da ata da reunião.",
    inputSchema: MINUTES_INPUT_SCHEMA,
  });

  const parsed = minutesContentSchema.safeParse(input);
  if (!parsed.success) {
    throw new MinutesGenerationError("O Claude não devolveu a ata num formato válido.");
  }
  return parsed.data;
}
