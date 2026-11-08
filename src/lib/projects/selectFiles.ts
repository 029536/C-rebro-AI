import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { selectRelevantItemsSystemPrompt } from "@/lib/ai/prompts";
import { PROJECT_MAX_RELEVANT_FILES } from "@/lib/config";

const responseSchema = z.object({ paths: z.array(z.string()) });

/**
 * Valida a resposta do Claude: só aceita caminhos/nomes que realmente existem na
 * lista oferecida, e corta no máximo de itens. Função pura, testável sem rede.
 */
export function parseSelectedItems(responseText: string, validPaths: string[]): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return [];
  }

  const result = responseSchema.safeParse(parsed);
  if (!result.success) return [];

  const valid = new Set(validPaths);
  return result.data.paths.filter((path) => valid.has(path)).slice(0, PROJECT_MAX_RELEVANT_FILES);
}

export type SelectableItem = { path: string; summary: string };

const MOCK_SELECTED_COUNT = 3;

/**
 * Escolhe até `PROJECT_MAX_RELEVANT_FILES` itens (arquivos de código e/ou
 * documentos) relevantes para o trecho recente da conversa, com `CLAUDE_FAST_MODEL`.
 */
export async function selectRelevantItems(params: {
  recentText: string;
  items: SelectableItem[];
}): Promise<string[]> {
  if (params.items.length === 0) return [];

  if (process.env.MOCK_AI === "1") {
    return params.items.slice(0, MOCK_SELECTED_COUNT).map((item) => item.path);
  }

  const list = params.items.map((item) => `${item.path}: ${item.summary}`).join("\n");
  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5",
    max_tokens: 300,
    system: selectRelevantItemsSystemPrompt(),
    messages: [
      {
        role: "user",
        content: `<conversa_recente>\n${params.recentText}\n</conversa_recente>\n\n<itens>\n${list}\n</itens>`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
  return parseSelectedItems(
    text,
    params.items.map((item) => item.path)
  );
}
