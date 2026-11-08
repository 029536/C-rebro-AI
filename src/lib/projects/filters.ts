// Regras de filtro para a importação de código (ver CLAUDE.md, "Projetos: código e
// material de apoio"). Lógica pura, sem tocar em arquivo nenhum.

const IGNORED_DIR_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".venv",
  "__pycache__",
]);

const IGNORED_FILENAMES = new Set(["package-lock.json"]);

const BINARY_OR_MEDIA_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp",
  ".mp3", ".mp4", ".wav", ".mov", ".avi", ".webm",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".exe", ".dll", ".so", ".dylib", ".class", ".jar", ".node", ".wasm",
]);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/** Linha única muito longa é um bom sinal de arquivo minificado, mesmo sem ".min." no nome. */
export function looksMinified(content: string): boolean {
  if (content.length < 500) return false;
  const longestLine = content.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  return longestLine > 1000;
}

export type FilterResult = { ignore: boolean; reason?: string };

/** Decide se um caminho do zip entra na importação de código, e por quê não, quando não entra. */
export function filterCodeFile(params: {
  path: string;
  sizeBytes: number;
  content: string;
  maxFileBytes: number;
}): FilterResult {
  const segments = params.path.split("/");
  if (segments.some((segment) => IGNORED_DIR_SEGMENTS.has(segment))) {
    return { ignore: true, reason: "dentro de uma pasta ignorada" };
  }

  const filename = segments[segments.length - 1] ?? "";
  if (IGNORED_FILENAMES.has(filename) || filename.endsWith(".lock")) {
    return { ignore: true, reason: "arquivo de lock" };
  }

  if (BINARY_OR_MEDIA_EXTENSIONS.has(getExtension(filename))) {
    return { ignore: true, reason: "arquivo binário ou de mídia" };
  }

  if (/\.min\.(js|css)$/i.test(filename) || looksMinified(params.content)) {
    return { ignore: true, reason: "arquivo minificado" };
  }

  if (params.sizeBytes > params.maxFileBytes) {
    return { ignore: true, reason: "acima do limite de tamanho por arquivo" };
  }

  return { ignore: false };
}

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([".md", ".txt", ".pdf", ".docx", ".csv"]);

/** Verifica só a extensão: o conteúdo dos documentos é extraído à parte (lib/projects/documents.ts). */
export function isAllowedDocumentExtension(filename: string): boolean {
  return ALLOWED_DOCUMENT_EXTENSIONS.has(getExtension(filename));
}
