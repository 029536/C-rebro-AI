import { afterEach, describe, expect, it, vi } from "vitest";
import { generateReviewContent } from "@/lib/ai/review";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";
import { reviewContentSchema } from "@/lib/reviews/schema";

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PARAMS = {
  companyContext: "",
  transcript: "algo foi dito sobre o projeto",
};

describe("generateReviewContent", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e devolve um parecer válido", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const content = await generateReviewContent(BASE_PARAMS);
    expect(reviewContentSchema.safeParse(content).success).toBe(true);
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para o chamador tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(generateReviewContent(BASE_PARAMS)).rejects.toThrow(AnthropicKeyMissingError);
  });
});
