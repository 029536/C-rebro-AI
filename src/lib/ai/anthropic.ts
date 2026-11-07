import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Cliente Anthropic (singleton), usado só no servidor. */
export function getAnthropicClient(): Anthropic {
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
