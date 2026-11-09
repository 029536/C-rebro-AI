import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { ExpectedAIError, readApiKey, redactSecrets } from "./env";

/** Erro esperado (não é bug): sem ANTHROPIC_API_KEY, as rotas que usam o Claude devem
 * avisar com uma mensagem clara em vez de derrubar o app. Ver CLAUDE.md, restrição 6. */
export class AnthropicKeyMissingError extends ExpectedAIError {
  constructor() {
    super("Chave da Anthropic não configurada.");
    this.name = "AnthropicKeyMissingError";
  }
}

/** A variável existe, mas não tem a cara de uma chave da Anthropic (espaço, quebra de
 * linha, prefixo errado etc.) — nunca tentamos usá-la mesmo assim. */
export class AnthropicKeyInvalidError extends ExpectedAIError {
  constructor() {
    super("Chave da Anthropic inválida; confira a configuração.");
    this.name = "AnthropicKeyInvalidError";
  }
}

let client: Anthropic | null = null;
let cachedKey: string | null = null;

/** Cliente Anthropic (singleton), usado só no servidor. */
export function getAnthropicClient(): Anthropic {
  const { key, invalid } = readApiKey(process.env.ANTHROPIC_API_KEY, "sk-ant-");
  if (invalid) {
    throw new AnthropicKeyInvalidError();
  }
  if (!key) {
    throw new AnthropicKeyMissingError();
  }
  if (!client || cachedKey !== key) {
    client = new Anthropic({ apiKey: key });
    cachedKey = key;
  }
  return client;
}

/** Status HTTP a devolver para uma falha de chamada à Anthropic. */
export function statusForAnthropicError(error: unknown): number {
  if (error instanceof AnthropicKeyMissingError || error instanceof AnthropicKeyInvalidError) {
    return 503;
  }
  return 502;
}

/**
 * Traduz uma falha da chamada à Anthropic numa mensagem segura para mostrar
 * na tela — nunca o texto bruto do erro, que pode ecoar cabeçalhos, URLs ou
 * outro detalhe sensível (já aconteceu). O detalhe completo, com qualquer
 * coisa parecida com uma chave removida, vai só para o log do servidor.
 */
export function describeAnthropicError(error: unknown): string {
  const rawDetail = error instanceof Error ? error.message : String(error);
  console.error("Falha ao chamar a Anthropic:", redactSecrets(rawDetail));

  // Mensagens que nós mesmos escrevemos (AnthropicKeyMissingError e afins) já
  // são seguras — é o texto fixo da classe, não algo ecoado do provedor/rede.
  if (error instanceof ExpectedAIError) {
    return error.message;
  }

  if (error instanceof APIError) {
    switch (error.status) {
      case 401:
        return "Chave da Anthropic inválida; confira a configuração.";
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
        return "Falha ao chamar a Anthropic. Tente novamente em instantes.";
    }
  }

  return "Falha ao chamar a Anthropic. Tente novamente em instantes.";
}

/** Extrai o texto de uma resposta do Claude (ignora blocos que não sejam texto). */
export function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
