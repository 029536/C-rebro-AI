import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePlanContent } from "@/lib/ai/plan";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";
import { planContentSchema } from "@/lib/plans/schema";

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PARAMS = {
  companyContext: "",
  hasProject: false,
  transcript: "algo foi dito sobre o projeto",
};

describe("generatePlanContent", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e devolve um plano válido", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const content = await generatePlanContent(BASE_PARAMS);
    expect(planContentSchema.safeParse(content).success).toBe(true);
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para o chamador tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(generatePlanContent(BASE_PARAMS)).rejects.toThrow(AnthropicKeyMissingError);
  });
});
