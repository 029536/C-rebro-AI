import { afterEach, describe, expect, it, vi } from "vitest";
import { generateProjectMemory } from "@/lib/ai/projectMemory";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PARAMS = { previousSummary: null, meetingTitle: "Reunião de teste" };

describe("generateProjectMemory", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e devolve um resumo", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const summary = await generateProjectMemory(BASE_PARAMS);
    expect(summary.length).toBeGreaterThan(0);
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para o chamador tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(generateProjectMemory(BASE_PARAMS)).rejects.toThrow(AnthropicKeyMissingError);
  });
});
