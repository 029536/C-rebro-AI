import { planContentSchema, planTaskListSchema, type PlanContent, type PlanTaskStub } from "@/lib/plans/schema";
import { mapWithConcurrencyLimit } from "@/lib/concurrency";
import { PLAN_TASK_PROMPT_CONCURRENCY_LIMIT } from "@/lib/config";
import { extractText, getAnthropicClient } from "./anthropic";
import { ExpectedAIError, redactSecrets, summarizeZodIssues } from "./env";
import { PLAN_INPUT_SCHEMA, PLAN_TOOL_NAME, planSystemPrompt, planTaskPromptSystemPrompt } from "./prompts";
import { callStructuredTool } from "./structuredTool";

const TASK_LIST_MAX_TOKENS = 4_000;
const TASK_PROMPT_MAX_TOKENS = 3_000;

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

export type PlanContextParams = {
  companyContext: string;
  meetingContext?: string;
  ataFormal?: string | null;
  reviewSummary?: string | null;
  doneTasksBlock?: string | null;
  projectContext?: string | null;
  hasProject: boolean;
};

/** Etapa 1: só a lista de tarefas (sem prompt_md) — saída bem menor, longe do teto de tokens. */
async function generatePlanTaskList(
  params: PlanContextParams & { transcript: string }
): Promise<{ summary: string; tasks: PlanTaskStub[] }> {
  const input = await callStructuredTool({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    maxTokens: TASK_LIST_MAX_TOKENS,
    system: planSystemPrompt(params),
    messages: [{ role: "user", content: `<transcricao>\n${params.transcript}\n</transcricao>` }],
    toolName: PLAN_TOOL_NAME,
    toolDescription: "Salva a lista de tarefas do plano de execução da reunião.",
    inputSchema: PLAN_INPUT_SCHEMA,
  });

  const parsed = planTaskListSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlanGenerationError(
      "O Claude não devolveu a lista de tarefas num formato válido.",
      summarizeZodIssues(parsed.error)
    );
  }
  return parsed.data;
}

const FALLBACK_PROMPT_SUFFIX =
  "Confirme seu entendimento e liste dúvidas antes de codar. Rode lint, typecheck e testes ao final.";

function fallbackTaskPrompt(task: PlanTaskStub): string {
  return `# ${task.title}\n\nNão foi possível gerar automaticamente o prompt completo desta tarefa — use isto como ponto de partida.\n\n**Objetivo:** ${task.description}\n\n**Critério de aceite:** ${task.acceptance}\n\n${FALLBACK_PROMPT_SUFFIX}`;
}

/**
 * Etapa 2: o `prompt_md` de UMA tarefa, texto livre (não é saída estruturada
 * — só um campo). Nunca lança: uma falha numa tarefa não deve derrubar o
 * plano inteiro, cai num prompt de reserva a partir do que já se sabe dela.
 */
async function generateTaskPrompt(params: PlanContextParams & { task: PlanTaskStub }): Promise<string> {
  try {
    const message = await getAnthropicClient().messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
      max_tokens: TASK_PROMPT_MAX_TOKENS,
      system: planTaskPromptSystemPrompt(params),
      messages: [
        {
          role: "user",
          content: `<tarefa>\nTítulo: ${params.task.title}\nDescrição: ${params.task.description}\nCritério de aceite: ${params.task.acceptance}\n</tarefa>`,
        },
      ],
    });
    const text = extractText(message.content).trim();
    if (text) return text;
  } catch (error) {
    console.error(
      `generateTaskPrompt ("${params.task.title}") falhou, usando prompt de reserva:`,
      redactSecrets(error instanceof Error ? error.message : String(error))
    );
  }
  return fallbackTaskPrompt(params.task);
}

export async function generatePlanContent(
  params: PlanContextParams & { transcript: string }
): Promise<PlanContent> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_CONTENT;
  }

  const taskList = await generatePlanTaskList(params);

  const tasks = await mapWithConcurrencyLimit(taskList.tasks, PLAN_TASK_PROMPT_CONCURRENCY_LIMIT, async (stub) => {
    const prompt_md = await generateTaskPrompt({ ...params, task: stub });
    return { ...stub, prompt_md };
  });

  const parsed = planContentSchema.safeParse({ summary: taskList.summary, tasks });
  if (!parsed.success) {
    throw new PlanGenerationError(
      "O Claude não devolveu o plano num formato válido.",
      summarizeZodIssues(parsed.error)
    );
  }
  return parsed.data;
}
