// Leitura/validação de chaves de API e redação de segredos antes de logar
// qualquer coisa ligada a um erro de provedor. Nunca devolver uma chave de
// API — inteira ou em parte — ao navegador (CLAUDE.md, restrição 6): já
// aconteceu de um erro de rede ecoar o cabeçalho "Authorization: Bearer
// sk-ant-..." inteiro na mensagem de erro, e essa mensagem foi parar na tela.

/**
 * Erro cuja mensagem nós mesmos escrevemos — sempre seguro mostrar ao
 * usuário, ao contrário de um erro vindo do SDK do provedor ou do runtime
 * (fetch, rede), que pode ecoar cabeçalhos, URLs ou outro detalhe sensível.
 * `detail`, quando presente, é um diagnóstico técnico igualmente seguro
 * (motivo estrutural — stop_reason, tentativas, limites — nunca o texto da
 * reunião nem o que o Claude respondeu) para a linha pequena na tela.
 */
export class ExpectedAIError extends Error {
  detail?: string;

  constructor(message: string, detail?: string) {
    super(message);
    this.detail = detail;
  }
}

/**
 * Lê uma variável de ambiente de chave de API: remove espaços e quebras de
 * linha nas pontas (causa real de um vazamento visto em produção) e confere
 * o prefixo esperado. Nunca devolve a chave quando falta ou está malformada.
 */
export function readApiKey(
  rawValue: string | undefined,
  prefix: string
): { key: string | null; invalid: boolean } {
  if (!rawValue) return { key: null, invalid: false };
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) return { key: null, invalid: false };
  const pattern = new RegExp(`^${prefix}[A-Za-z0-9_-]+$`);
  if (!pattern.test(trimmed)) {
    return { key: null, invalid: true };
  }
  return { key: trimmed, invalid: false };
}

/**
 * Resume os problemas de um `z.ZodError` numa linha curta e segura — nome do
 * campo e a regra que falhou (ex.: "ata_formal: muito grande"), nunca o
 * valor que o Claude mandou. Usado como `detail` quando a saída estruturada
 * bate no formato esperado pela Anthropic (tool_use válido) mas não no
 * nosso próprio esquema — para a tela mostrar qual campo, não só "inválido".
 */
export function summarizeZodIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
    .join("; ");
}

// Qualquer coisa com essa cara (chave da Anthropic ou da OpenAI) é removida de
// um log, mesmo que não seja exatamente a chave configurada agora (chave
// antiga em cache, por exemplo).
const SECRET_LIKE_PATTERN = /sk-[A-Za-z0-9_-]{10,}/g;

/** Nunca logar (nem devolver ao navegador) uma chave de API inteira. */
export function redactSecrets(text: string): string {
  let redacted = text.replace(SECRET_LIKE_PATTERN, "[REDACTED]");
  for (const raw of [process.env.ANTHROPIC_API_KEY, process.env.OPENAI_API_KEY]) {
    const trimmed = raw?.trim();
    if (trimmed && trimmed.length >= 8) {
      redacted = redacted.split(trimmed).join("[REDACTED]");
    }
  }
  return redacted;
}
