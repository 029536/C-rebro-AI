import type { PlanTaskStub } from "@/lib/plans/schema";
import { planTaskListSchema } from "@/lib/plans/schema";
import { extractText, getAnthropicClient } from "./anthropic";
import { ExpectedAIError, summarizeZodIssues } from "./env";
import {
  PLAN_INPUT_SCHEMA,
  PLAN_TOOL_NAME,
  planShortenPromptSystemPrompt,
  planSystemPrompt,
  planTaskPromptSystemPrompt,
  planTaskPromptUserMessage,
} from "./prompts";
import { callStructuredTool } from "./structuredTool";

const TASK_LIST_MAX_TOKENS = 4_000;
const TASK_PROMPT_MAX_TOKENS = 3_000;
const SHORTEN_PROMPT_MAX_TOKENS = 3_000;

/** O Claude não devolveu a lista de tarefas (etapa 1) num formato válido. */
export class PlanGenerationError extends ExpectedAIError {}
/** Falhou ao gerar o prompt_md de UMA tarefa (etapa 2) — não derruba o plano inteiro, ver lib/plans/multistage.ts. */
export class PlanTaskPromptError extends ExpectedAIError {}

const MOCK_TASK_LIST: { summary: string; tasks: PlanTaskStub[] } = {
  summary: "Plano simulado (MOCK_AI=1): duas tarefas, a segunda depende da primeira.",
  tasks: [
    {
      title: "Mapear o fluxo atual",
      description: "Entender como o processo funciona hoje antes de mudar qualquer coisa.",
      acceptance: "Documento curto com o fluxo atual, revisado pela equipe.",
      priority: "alta",
      depends_on: [],
    },
    {
      title: "Construir a primeira versão",
      description: "Implementar a versão mínima combinada na reunião.",
      acceptance: "Versão mínima funcionando, com testes passando.",
      priority: "media",
      depends_on: [1],
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

/**
 * Etapa 1: só a lista de tarefas (sem `prompt_md`) — a partir da ata
 * consolidada, do parecer e do contexto do projeto, nunca da transcrição
 * crua (CLAUDE.md).
 */
export async function generatePlanTaskList(
  params: PlanContextParams
): Promise<{ summary: string; tasks: PlanTaskStub[] }> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_TASK_LIST;
  }

  const input = await callStructuredTool({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    maxTokens: TASK_LIST_MAX_TOKENS,
    system: planSystemPrompt(params),
    messages: [{ role: "user", content: "Gere a lista de tarefas do plano, de acordo com as instruções acima." }],
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

const MOCK_PROMPT_SUFFIX =
  "Confirme seu entendimento e liste dúvidas antes de codar. Rode lint, typecheck e testes ao final.";

/**
 * Etapa 2: o `prompt_md` de UMA tarefa, texto livre. O prefixo (empresa,
 * reunião, ata, parecer, projeto e o esqueleto inteiro do plano) é IDÊNTICO
 * nas N chamadas em paralelo de uma mesma geração, por isso vai com
 * `cache_control: ephemeral` — só a tarefa específica desta chamada muda, na
 * mensagem do usuário. Lança em caso de falha: cada tarefa é salva e
 * retomada isoladamente por lib/plans/multistage.ts, sem cair num prompt de
 * reserva silencioso.
 */
export async function generateTaskPrompt(
  params: PlanContextParams & {
    task: { title: string; description: string; acceptance: string };
    skeletonBlock: string;
  }
): Promise<string> {
  if (process.env.MOCK_AI === "1") {
    return `# Prompt simulado (MOCK_AI=1) — ${params.task.title}\n\n${params.task.description}\n\n${MOCK_PROMPT_SUFFIX}`;
  }

  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: TASK_PROMPT_MAX_TOKENS,
    system: [
      {
        type: "text",
        text: planTaskPromptSystemPrompt(params),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: planTaskPromptUserMessage(params.task) }],
  });

  const text = extractText(message.content).trim();
  if (!text) {
    throw new PlanTaskPromptError(`O Claude não devolveu o prompt da tarefa "${params.task.title}".`);
  }
  return text;
}

/**
 * Pede pra encurtar um `prompt_md` que passou do limite de caracteres do
 * esquema — em vez de reprovar a tarefa inteira (CLAUDE.md). Texto livre,
 * sem ferramenta; nunca lança, cai no próprio texto original se a chamada
 * falhar (o chamador trunca como último recurso).
 */
export async function shortenTaskPrompt(promptMd: string, maxChars: number): Promise<string> {
  if (process.env.MOCK_AI === "1") {
    return promptMd.slice(0, maxChars);
  }

  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: SHORTEN_PROMPT_MAX_TOKENS,
    system: planShortenPromptSystemPrompt(maxChars),
    messages: [{ role: "user", content: promptMd }],
  });

  const text = extractText(message.content).trim();
  return text || promptMd;
}
