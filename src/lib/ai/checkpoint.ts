import { extractText, getAnthropicClient } from "./anthropic";
import { checkpointSystemPrompt, checkpointUserMessage } from "./prompts";

const MOCK_SUMMARY = "Resumo simulado desta parte (MOCK_AI=1).";
const MAX_TOKENS = 1_200;

export async function generateCheckpoint(params: {
  companyContext: string;
  previousSummary: string | null;
  transcript: string;
}): Promise<string> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_SUMMARY;
  }

  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5",
    max_tokens: MAX_TOKENS,
    system: checkpointSystemPrompt(params.companyContext),
    messages: [
      {
        role: "user",
        content: checkpointUserMessage({
          previousSummary: params.previousSummary,
          transcript: params.transcript,
        }),
      },
    ],
  });

  return extractText(message.content);
}
