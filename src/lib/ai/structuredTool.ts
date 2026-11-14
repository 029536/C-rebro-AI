import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic";
import { ExpectedAIError } from "./env";
import { toStrictInputSchema } from "./strictSchema";

/** O Claude respondeu, mas nunca chamou a ferramenta esperada (nem depois de tentar de novo). */
export class StructuredToolError extends ExpectedAIError {}

// 1 tentativa inicial + até 2 novas, como pedido — nunca mais que isso.
const MAX_ATTEMPTS = 3;
// Nunca mais que 4x o max_tokens pedido pelo chamador, mesmo escalando por causa de max_tokens.
const MAX_TOKENS_MULTIPLIER_CAP = 4;

function isToolUseBlock(
  block: Anthropic.ContentBlock
): block is Extract<Anthropic.ContentBlock, { type: "tool_use" }> {
  return block.type === "tool_use";
}

function isTextBlock(block: Anthropic.ContentBlock): block is Anthropic.TextBlock {
  return block.type === "text";
}

/**
 * Último recurso quando o Claude responde só com texto em vez de chamar a
 * ferramenta: tira cercas ```json ou ``` e qualquer prosa antes/depois do
 * primeiro `{`...último `}`, e tenta interpretar como JSON. Função pura,
 * testável sem rede.
 */
export function extractJsonFromText(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return undefined;
  }
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch {
    return undefined;
  }
}

/**
 * Único ponto de chamada para toda saída estruturada do app (ata, parecer,
 * plano, preparo de reunião, copiloto, seleção de arquivos). Existe por
 * causa de um 400 real da Anthropic: alguns modelos recusam `tool_choice`
 * forçado ("tool" ou "any") — por isso usamos sempre "auto", com
 * `strict: true` no esquema (ver lib/ai/strictSchema.ts), mais uma
 * instrução no prompt e até duas tentativas de novo se o Claude responder
 * só com texto.
 *
 * Também cobre resposta CORTADA por `max_tokens`: quando o Claude começa a
 * chamar a ferramenta mas o limite de tokens acaba no meio, o JSON vem
 * incompleto — em vez de aceitar isso como sucesso, tenta de novo com o
 * dobro do espaço (até 4x o pedido originalmente). Se mesmo assim nada
 * funcionar, o erro final carrega o motivo real (stop_reason, tentativas,
 * limite) em `detail`, para a tela mostrar algo além de "formato inválido"
 * — nunca o texto da reunião nem o que o Claude respondeu, só diagnóstico
 * estrutural (ver CLAUDE.md, "nunca logar texto de reuniões").
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

  let currentMaxTokens = params.maxTokens;
  const maxTokensCeiling = params.maxTokens * MAX_TOKENS_MULTIPLIER_CAP;
  let lastStopReason: string | null = null;
  let hadTextWithoutTool = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const message = await client.messages.create({
      model: params.model,
      max_tokens: currentMaxTokens,
      system,
      tools,
      tool_choice: { type: "auto" },
      messages: params.messages,
    });

    lastStopReason = message.stop_reason;
    const truncated = message.stop_reason === "max_tokens";
    const toolUse = message.content.find(isToolUseBlock);

    if (toolUse && !truncated) {
      return toolUse.input;
    }

    if (!toolUse) {
      // Sem chamada de ferramenta: último recurso, tenta achar JSON solto no texto.
      const textBlock = message.content.find(isTextBlock);
      if (textBlock && !truncated) {
        hadTextWithoutTool = true;
        const extracted = extractJsonFromText(textBlock.text);
        if (extracted !== undefined) {
          return extracted;
        }
      }
    }

    // tool_use cortado no meio (JSON incompleto) ou qualquer tentativa que bateu o
    // teto de tokens: não adianta tentar de novo do mesmo jeito, precisa de mais espaço.
    if (truncated) {
      console.warn(
        `callStructuredTool (${params.toolName}): resposta cortada por max_tokens na tentativa ${attempt} (max_tokens=${currentMaxTokens}).`
      );
      currentMaxTokens = Math.min(currentMaxTokens * 2, maxTokensCeiling);
    }
  }

  const detail = [
    `stop_reason=${lastStopReason ?? "desconhecido"}`,
    `tentativas=${MAX_ATTEMPTS}`,
    `max_tokens final=${currentMaxTokens}`,
    hadTextWithoutTool ? "o Claude respondeu com texto em vez de chamar a ferramenta" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  console.error(`callStructuredTool (${params.toolName}) falhou: ${detail}`);

  const friendlyMessage =
    lastStopReason === "max_tokens"
      ? "O Claude cortou a resposta por limite de tamanho, mesmo depois de tentar com mais espaço."
      : "O Claude respondeu sem usar a ferramenta esperada, mesmo depois de tentar de novo.";

  throw new StructuredToolError(friendlyMessage, detail);
}
