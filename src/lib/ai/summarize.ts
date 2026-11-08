import { z } from "zod";
import { extractText, getAnthropicClient } from "./anthropic";
import { summarizeDocumentSystemPrompt, summarizeFileSystemPrompt } from "./prompts";

const MOCK_FILE_SUMMARY = "Resumo simulado deste arquivo (MOCK_AI=1).";
const MOCK_DOCUMENT_SUMMARY = "Resumo simulado deste documento (MOCK_AI=1).";
const CONTENT_PREVIEW_CHARS = 4_000;

const fileSummariesSchema = z.object({
  summaries: z.array(z.object({ path: z.string(), summary: z.string() })),
});
const documentSummariesSchema = z.object({
  summaries: z.array(z.object({ filename: z.string(), summary: z.string() })),
});

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Resume um lote de arquivos de código com `CLAUDE_FAST_MODEL`. Chave do resultado: `path`. */
export async function generateFileSummaries(
  files: { path: string; content: string }[]
): Promise<Record<string, string>> {
  if (files.length === 0) return {};
  if (process.env.MOCK_AI === "1") {
    return Object.fromEntries(files.map((file) => [file.path, MOCK_FILE_SUMMARY]));
  }

  const list = files
    .map((file) => `<arquivo caminho="${file.path}">\n${file.content.slice(0, CONTENT_PREVIEW_CHARS)}\n</arquivo>`)
    .join("\n\n");

  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5",
    max_tokens: 1_000,
    system: summarizeFileSystemPrompt(),
    messages: [{ role: "user", content: list }],
  });

  const parsed = fileSummariesSchema.safeParse(safeJsonParse(extractText(message.content)));
  if (!parsed.success) return {};
  return Object.fromEntries(parsed.data.summaries.map((item) => [item.path, item.summary]));
}

/** Resume um lote de documentos de apoio com `CLAUDE_FAST_MODEL`. Chave do resultado: `filename`. */
export async function generateDocumentSummaries(
  documents: { filename: string; content: string }[]
): Promise<Record<string, string>> {
  if (documents.length === 0) return {};
  if (process.env.MOCK_AI === "1") {
    return Object.fromEntries(documents.map((doc) => [doc.filename, MOCK_DOCUMENT_SUMMARY]));
  }

  const list = documents
    .map(
      (doc) => `<documento nome="${doc.filename}">\n${doc.content.slice(0, CONTENT_PREVIEW_CHARS)}\n</documento>`
    )
    .join("\n\n");

  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5",
    max_tokens: 1_000,
    system: summarizeDocumentSystemPrompt(),
    messages: [{ role: "user", content: list }],
  });

  const parsed = documentSummariesSchema.safeParse(safeJsonParse(extractText(message.content)));
  if (!parsed.success) return {};
  return Object.fromEntries(parsed.data.summaries.map((item) => [item.filename, item.summary]));
}
