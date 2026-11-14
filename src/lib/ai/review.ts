import { reviewContentSchema, type ReviewContent } from "@/lib/reviews/schema";
import { ExpectedAIError, summarizeZodIssues } from "./env";
import { REVIEW_INPUT_SCHEMA, REVIEW_TOOL_NAME, reviewSystemPrompt } from "./prompts";
import { callStructuredTool } from "./structuredTool";

const BASE_MAX_TOKENS = 4_000;
const MAX_TOKENS_CEILING = 12_000;
const CHARS_PER_EXTRA_TOKEN = 3;

/** Teto de tokens de saída do parecer, maior para transcrições mais longas. Exportado para teste. */
export function reviewMaxTokens(transcriptLength: number): number {
  return Math.min(BASE_MAX_TOKENS + Math.floor(transcriptLength / CHARS_PER_EXTRA_TOKEN), MAX_TOKENS_CEILING);
}

/** O Claude respondeu, mas não no formato esperado — não é falta de chave nem erro de rede. */
export class ReviewGenerationError extends ExpectedAIError {}

const MOCK_CONTENT: ReviewContent = {
  diagnostico: "Diagnóstico simulado (MOCK_AI=1): o problema real é de processo, não de ferramenta.",
  avaliacao: "Avaliação simulada: a ideia é boa, mas o escopo inicial está grande demais.",
  como_desenvolveria: ["Mapear o fluxo atual", "Validar com o cliente", "Construir uma versão mínima"],
  perguntas_criticas: ["Quem decide o escopo final?", "Qual é o prazo real?"],
};

export async function generateReviewContent(params: {
  companyContext: string;
  meetingContext?: string;
  ataFormal?: string | null;
  projectContext?: string | null;
  transcript: string;
}): Promise<ReviewContent> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_CONTENT;
  }

  const input = await callStructuredTool({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    maxTokens: reviewMaxTokens(params.transcript.length),
    system: reviewSystemPrompt({
      companyContext: params.companyContext,
      meetingContext: params.meetingContext,
      ataFormal: params.ataFormal,
      projectContext: params.projectContext,
    }),
    messages: [{ role: "user", content: `<transcricao>\n${params.transcript}\n</transcricao>` }],
    toolName: REVIEW_TOOL_NAME,
    toolDescription: "Salva o parecer estruturado da reunião.",
    inputSchema: REVIEW_INPUT_SCHEMA,
  });

  const parsed = reviewContentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ReviewGenerationError(
      "O Claude não devolveu o parecer num formato válido.",
      summarizeZodIssues(parsed.error)
    );
  }
  return parsed.data;
}
