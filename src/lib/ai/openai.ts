import OpenAI from "openai";
import { ExpectedAIError, readApiKey, redactSecrets } from "./env";

export class OpenAIKeyMissingError extends ExpectedAIError {
  constructor() {
    super("Chave da OpenAI não configurada.");
    this.name = "OpenAIKeyMissingError";
  }
}

/** A variável existe, mas não tem a cara de uma chave da OpenAI (espaço, quebra de
 * linha, prefixo errado etc.) — nunca tentamos usá-la mesmo assim. */
export class OpenAIKeyInvalidError extends ExpectedAIError {
  constructor() {
    super("Chave da OpenAI inválida; confira a configuração.");
    this.name = "OpenAIKeyInvalidError";
  }
}

let client: OpenAI | null = null;
let cachedKey: string | null = null;

/** Cliente OpenAI (singleton), usado só no servidor. */
export function getOpenAIClient(): OpenAI {
  const { key, invalid } = readApiKey(process.env.OPENAI_API_KEY, "sk-");
  if (invalid) {
    throw new OpenAIKeyInvalidError();
  }
  if (!key) {
    throw new OpenAIKeyMissingError();
  }
  if (!client || cachedKey !== key) {
    client = new OpenAI({ apiKey: key });
    cachedKey = key;
  }
  return client;
}

/**
 * Traduz uma falha da chamada à OpenAI numa mensagem segura para mostrar na
 * tela — nunca o texto bruto do erro. O detalhe completo, com qualquer coisa
 * parecida com uma chave removida, vai só para o log do servidor.
 */
export function describeOpenAIError(error: unknown): string {
  const rawDetail = error instanceof Error ? error.message : String(error);
  console.error("Falha ao chamar a OpenAI:", redactSecrets(rawDetail));

  if (error instanceof ExpectedAIError) {
    return error.message;
  }

  const status = (error as { status?: number } | null)?.status;
  switch (status) {
    case 401:
      return "Chave da OpenAI inválida; confira a configuração.";
    case 429:
      return "Limite de uso da OpenAI atingido (créditos esgotados ou muitas chamadas). Tente novamente mais tarde.";
    case 500:
    case 502:
    case 503:
      return "A OpenAI está instável no momento. Tente novamente em instantes.";
    default:
      return "Falha ao transcrever o áudio. Tente novamente em instantes.";
  }
}
