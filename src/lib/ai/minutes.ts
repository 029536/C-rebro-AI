import type { Participant } from "@/lib/participants";
import { minutesContentSchema, type MinutesContent } from "@/lib/minutes/schema";
import { getAnthropicClient } from "./anthropic";
import { MINUTES_TOOL_NAME, minutesSystemPrompt } from "./prompts";

const MAX_TOKENS = 8_000;

/** O Claude respondeu, mas não no formato esperado — não é falta de chave nem erro de rede. */
export class MinutesGenerationError extends Error {}

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

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: MAX_TOKENS,
    system: minutesSystemPrompt(params),
    tools: [
      {
        name: MINUTES_TOOL_NAME,
        description: "Salva o conteúdo estruturado da ata da reunião.",
        strict: true,
        input_schema: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            assuntos_discutidos: { type: "array", items: { type: "string" } },
            decisoes: { type: "array", items: { type: "string" } },
            responsabilidades: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  parte: { type: "string" },
                  itens: { type: "array", items: { type: "string" } },
                },
                required: ["parte", "itens"],
              },
            },
            acoes_futuras: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  acao: { type: "string" },
                  responsavel: { type: ["string", "null"] },
                  prazo: { type: ["string", "null"] },
                },
                required: ["acao"],
              },
            },
            observacoes: { type: ["string", "null"] },
            resumo_executivo: { type: "string" },
            proximos_encontros: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  data: { type: ["string", "null"] },
                  objetivo: { type: "string" },
                },
                required: ["objetivo"],
              },
            },
            ata_formal: { type: "string" },
          },
          required: [
            "titulo",
            "assuntos_discutidos",
            "decisoes",
            "responsabilidades",
            "acoes_futuras",
            "observacoes",
            "resumo_executivo",
            "proximos_encontros",
            "ata_formal",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: MINUTES_TOOL_NAME },
    messages: [{ role: "user", content: `<transcricao>\n${params.transcript}\n</transcricao>` }],
  });

  const toolUse = message.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );
  const parsed = minutesContentSchema.safeParse(toolUse?.input);
  if (!parsed.success) {
    throw new MinutesGenerationError("O Claude não devolveu a ata num formato válido.");
  }
  return parsed.data;
}
