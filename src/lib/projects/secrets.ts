// Detecção de segredos, para código e para texto extraído de documentos (CLAUDE.md,
// restrição 8 e seção "Projetos: código e material de apoio"). Nunca sobe nada que bata
// aqui — o arquivo inteiro é excluído, não só a linha.

const ENV_FILENAME_PATTERN = /(^|\/)\.env(\..*)?$/;

const PRIVATE_KEY_BLOCK_PATTERN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;

const API_KEY_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bsk-[A-Za-z0-9_-]{10,}\b/, label: "chave estilo sk-" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, label: "chave de acesso AWS" },
  { pattern: /\bghp_[A-Za-z0-9]{30,}\b/, label: "token do GitHub" },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: "token do Slack" },
  { pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/, label: "chave de API do Google" },
];

/** Devolve o motivo da rejeição, ou null se nada suspeito foi encontrado. */
export function detectSecret(params: { path?: string; content: string }): string | null {
  if (params.path && ENV_FILENAME_PATTERN.test(params.path)) {
    return "nome de arquivo .env";
  }
  if (PRIVATE_KEY_BLOCK_PATTERN.test(params.content)) {
    return "bloco de chave privada";
  }
  for (const { pattern, label } of API_KEY_PATTERNS) {
    if (pattern.test(params.content)) {
      return label;
    }
  }
  return null;
}
