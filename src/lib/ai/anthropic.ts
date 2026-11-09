import Anthropic, { APIError } from "@anthropic-ai/sdk";

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

/**
 * Traduz uma falha da chamada à Anthropic num motivo real em português
 * (autenticação, crédito/limite, instabilidade), em vez de um erro genérico —
 * para mostrar na tela em vez de "Chave da Anthropic não configurada" quando
 * a chave existe, mas a chamada falhou por outro motivo.
 */
export function describeAnthropicError(error: unknown): string {
  if (error instanceof APIError) {
    switch (error.status) {
      case 401:
        return "A Anthropic recusou a chave de API (autenticação inválida). Confira ANTHROPIC_API_KEY.";
      case 403:
        return "A Anthropic recusou a chamada por permissão (verifique a conta ou organização).";
      case 429:
        return "Limite de uso da Anthropic atingido (créditos esgotados ou muitas chamadas). Tente novamente mais tarde.";
      case 500:
      case 502:
      case 503:
      case 529:
        return "A Anthropic está instável no momento. Tente novamente em instantes.";
      default:
        return `Falha ao chamar a Anthropic (${error.status ?? "erro"}): ${error.message}`;
    }
  }
  return error instanceof Error ? error.message : "Falha desconhecida ao chamar a Anthropic.";
}

/** Extrai o texto de uma resposta do Claude (ignora blocos que não sejam texto). */
export function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
