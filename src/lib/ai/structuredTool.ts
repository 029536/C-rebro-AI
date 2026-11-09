import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic";
import { ExpectedAIError } from "./env";
import { toStrictInputSchema } from "./strictSchema";

/** O Claude respondeu, mas nunca chamou a ferramenta esperada (nem depois de tentar de novo). */
export class StructuredToolError extends ExpectedAIError {}

// 1 tentativa inicial + até 2 novas, como pedido — nunca mais que isso.
const MAX_ATTEMPTS = 3;

/**
 * Único ponto de chamada para toda saída estruturada do app (ata, preparo de
 * reunião e o que vier depois — parecer, plano, copiloto, seleção de
 * arquivos). Existe por causa de um 400 real da Anthropic: alguns modelos
 * (Claude Sonnet 5.5 entre eles) recusam `tool_choice` forçado ("tool" ou
 * "any") — por isso usamos sempre "auto", com `strict: true` no esquema
 * (ver lib/ai/strictSchema.ts) para garantir o formato QUANDO a ferramenta é
 * chamada, mais uma instrução no prompt e até duas tentativas de novo se o
 * Claude responder só com texto.
 */
export async function callStructuredTool(params: {
  model: string;
  maxTokens: number;
  system: string;
  messages: Anthropic.MessageParam[];
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
}): Promise<unknown> {
  const client = getAnthropicClient();
  const system = `${params.system}\n\nResponda SOMENTE chamando a ferramenta "${params.toolName}", com todos os campos preenchidos. Não escreva texto fora da ferramenta.`;
  const tools: Anthropic.Tool[] = [
    {
      name: params.toolName,
      description: params.toolDescription,
      strict: true,
      input_schema: toStrictInputSchema(params.inputSchema) as Anthropic.Tool.InputSchema,
    },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const message = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system,
      tools,
      tool_choice: { type: "auto" },
      messages: params.messages,
    });

    const toolUse = message.content.find(
      (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
    );
    if (toolUse) {
      return toolUse.input;
    }
  }

  throw new StructuredToolError(
    "O Claude respondeu sem usar a ferramenta esperada, mesmo depois de tentar de novo."
  );
}
