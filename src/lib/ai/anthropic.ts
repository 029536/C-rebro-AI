import Anthropic from "@anthropic-ai/sdk";

/** Erro esperado (não é bug): sem ANTHROPIC_API_KEY, as rotas que usam o Claude devem
 * avisar com uma mensagem clara em vez de derrubar o app. Ver CLAUDE.md, restrição 6. */
export class AnthropicKeyMissingError extends Error {
  constructor() {
    super("Chave da Anthropic não configurada.");
    this.name = "AnthropicKeyMissingError";
  }
}

let client: Anthropic | null = null;

/** Cliente Anthropic (singleton), usado só no servidor. */
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnthropicKeyMissingError();
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Extrai o texto de uma resposta do Claude (ignora blocos que não sejam texto). */
export function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
