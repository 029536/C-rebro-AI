import { afterEach, describe, expect, it, vi } from "vitest";
import { streamChatReply } from "@/lib/ai/chat";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

describe("streamChatReply", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e o stream bate com `done`", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");

    const { stream, done } = streamChatReply({
      system: "system de teste",
      messages: [{ role: "user", content: "oi" }],
    });

    const [streamed, final] = await Promise.all([readAll(stream), done]);
    expect(streamed).toBe(final);
    expect(streamed.length).toBeGreaterThan(0);
  });
});
