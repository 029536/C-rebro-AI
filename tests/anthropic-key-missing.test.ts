import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicKeyMissingError, getAnthropicClient } from "@/lib/ai/anthropic";
import { generateCheckpoint } from "@/lib/ai/checkpoint";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAnthropicClient sem ANTHROPIC_API_KEY", () => {
  it("lança AnthropicKeyMissingError em vez de uma exceção genérica do SDK", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => getAnthropicClient()).toThrow(AnthropicKeyMissingError);
  });
});

describe("generateCheckpoint", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic, mesmo sem chave", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const summary = await generateCheckpoint({
      companyContext: "",
      previousSummary: null,
      transcript: "algo foi dito",
    });
    expect(summary).toContain("MOCK_AI=1");
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para a rota tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(
      generateCheckpoint({ companyContext: "", previousSummary: null, transcript: "x" })
    ).rejects.toThrow(AnthropicKeyMissingError);
  });
});
