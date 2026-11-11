import { planContentSchema, type PlanContent } from "@/lib/plans/schema";
import { ExpectedAIError } from "./env";
import { PLAN_INPUT_SCHEMA, PLAN_TOOL_NAME, planSystemPrompt } from "./prompts";
import { callStructuredTool } from "./structuredTool";

const MAX_TOKENS = 6_000;

/** O Claude respondeu, mas não no formato esperado — não é falta de chave nem erro de rede. */
export class PlanGenerationError extends ExpectedAIError {}

const MOCK_CONTENT: PlanContent = {
  summary: "Plano simulado (MOCK_AI=1): duas tarefas, a segunda depende da primeira.",
  tasks: [
    {
      title: "Mapear o fluxo atual",
      description: "Entender como o processo funciona hoje antes de mudar qualquer coisa.",
      acceptance: "Documento curto com o fluxo atual, revisado pela equipe.",
      priority: "alta",
      depends_on: [],
      prompt_md:
        "# Prompt simulado (MOCK_AI=1)\n\nMapeie o fluxo atual do processo discutido na reunião. Confirme seu entendimento e liste dúvidas antes de codar. Rode lint, typecheck e testes ao final.",
    },
    {
      title: "Construir a primeira versão",
      description: "Implementar a versão mínima combinada na reunião.",
      acceptance: "Versão mínima funcionando, com testes passando.",
      priority: "media",
      depends_on: [1],
      prompt_md:
        "# Prompt simulado (MOCK_AI=1)\n\nImplemente a versão mínima combinada. Confirme seu entendimento e liste dúvidas antes de codar. Rode lint, typecheck e testes ao final.",
    },
  ],
};

export async function generatePlanContent(params: {
  companyContext: string;
  meetingContext?: string;
  ataFormal?: string | null;
  reviewSummary?: string | null;
  doneTasksBlock?: string | null;
  hasProject: boolean;
  transcript: string;
}): Promise<PlanContent> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_CONTENT;
  }

  const input = await callStructuredTool({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    maxTokens: MAX_TOKENS,
    system: planSystemPrompt({
      companyContext: params.companyContext,
      meetingContext: params.meetingContext,
      ataFormal: params.ataFormal,
      reviewSummary: params.reviewSummary,
      doneTasksBlock: params.doneTasksBlock,
      hasProject: params.hasProject,
    }),
    messages: [{ role: "user", content: `<transcricao>\n${params.transcript}\n</transcricao>` }],
    toolName: PLAN_TOOL_NAME,
    toolDescription: "Salva o plano de execução estruturado da reunião.",
    inputSchema: PLAN_INPUT_SCHEMA,
  });

  const parsed = planContentSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlanGenerationError("O Claude não devolveu o plano num formato válido.");
  }
  return parsed.data;
}
