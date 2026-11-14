import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePlanTaskList } from "@/lib/ai/plan";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";
import { planTaskListSchema } from "@/lib/plans/schema";

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PARAMS = {
  companyContext: "",
  hasProject: false,
  ataFormal: "Texto da ata.",
  reviewSummary: "Diagnóstico: ok.",
};

describe("generatePlanTaskList", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e devolve uma lista válida", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const content = await generatePlanTaskList(BASE_PARAMS);
    expect(planTaskListSchema.safeParse(content).success).toBe(true);
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para o chamador tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(generatePlanTaskList(BASE_PARAMS)).rejects.toThrow(AnthropicKeyMissingError);
  });
});
