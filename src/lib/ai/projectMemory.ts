import { memoryChangeSchema, type MemoryChange } from "@/lib/projects/memorySchema";
import { ExpectedAIError, summarizeZodIssues } from "./env";
import {
  PROJECT_MEMORY_INPUT_SCHEMA,
  PROJECT_MEMORY_TOOL_NAME,
  projectMemoryItemsSystemPrompt,
  projectMemoryItemsUserMessage,
} from "./prompts";
import { callStructuredTool } from "./structuredTool";

const MAX_TOKENS = 2_000;

/** O Claude respondeu, mas não no formato esperado — não é falta de chave nem erro de rede. */
export class ProjectMemoryGenerationError extends ExpectedAIError {}

const MOCK_CHANGE: MemoryChange = {
  novos: [{ tipo: "estado", texto: "Mudança simulada (MOCK_AI=1): item novo de teste." }],
  alterados: [],
  resolvidos: [],
  observacoes: [],
};

/**
 * Gera a DIFERENÇA estruturada da memória do projeto (itens novos, alterados
 * por id, resolvidos por id) — nunca o texto corrido inteiro. CLAUDE_MODEL
 * (não o rápido): é síntese de verdade, não um resumo de 1-2 linhas.
 */
export async function generateProjectMemoryChanges(params: {
  currentItemsBlock: string | null;
  meetingTitle: string;
  ataResumo?: string | null;
  parecerResumo?: string | null;
  andamento?: string | null;
}): Promise<MemoryChange> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_CHANGE;
  }

  const input = await callStructuredTool({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    maxTokens: MAX_TOKENS,
    system: projectMemoryItemsSystemPrompt(),
    messages: [{ role: "user", content: projectMemoryItemsUserMessage(params) }],
    toolName: PROJECT_MEMORY_TOOL_NAME,
    toolDescription: "Salva as mudanças estruturadas na memória do projeto.",
    inputSchema: PROJECT_MEMORY_INPUT_SCHEMA,
  });

  const parsed = memoryChangeSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProjectMemoryGenerationError(
      "O Claude não devolveu a atualização da memória num formato válido.",
      summarizeZodIssues(parsed.error)
    );
  }
  return parsed.data;
}
