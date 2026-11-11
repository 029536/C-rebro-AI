import { extractText, getAnthropicClient } from "./anthropic";
import { projectMemorySystemPrompt, projectMemoryUserMessage } from "./prompts";

const MOCK_SUMMARY = "Resumo vivo simulado do projeto (MOCK_AI=1): decisões, estado real e pendências.";
const MAX_TOKENS = 2_000;

/** Gera o resumo vivo ATUALIZADO do projeto (CLAUDE_MODEL — é síntese, não rótulo). */
export async function generateProjectMemory(params: {
  previousSummary: string | null;
  lockedNote?: string | null;
  meetingTitle: string;
  ataResumo?: string | null;
  parecerResumo?: string | null;
  andamento?: string | null;
}): Promise<string> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_SUMMARY;
  }

  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: MAX_TOKENS,
    system: projectMemorySystemPrompt(),
    messages: [{ role: "user", content: projectMemoryUserMessage(params) }],
  });

  return extractText(message.content);
}
