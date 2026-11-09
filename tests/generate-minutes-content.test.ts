import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMinutesContent } from "@/lib/ai/minutes";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";
import { minutesContentSchema } from "@/lib/minutes/schema";

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PARAMS = {
  companyContext: "",
  meetingType: "client" as const,
  clientName: null,
  participants: [],
  date: "2026-11-09",
  time: "16:31",
  transcript: "algo foi dito",
};

describe("generateMinutesContent", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e devolve um conteúdo válido", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const content = await generateMinutesContent(BASE_PARAMS);
    expect(minutesContentSchema.safeParse(content).success).toBe(true);
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para o chamador tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(generateMinutesContent(BASE_PARAMS)).rejects.toThrow(AnthropicKeyMissingError);
  });
});
