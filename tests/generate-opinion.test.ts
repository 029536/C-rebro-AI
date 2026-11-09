import { afterEach, describe, expect, it, vi } from "vitest";
import { generateOpinion } from "@/lib/ai/copilot";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PARAMS = {
  companyContext: "",
  previousOpinions: [] as string[],
  transcript: "algo foi dito sobre o projeto",
};

describe("generateOpinion", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e devolve uma opinião simulada", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const opinion = await generateOpinion(BASE_PARAMS);
    expect(opinion).toContain("MOCK_AI=1");
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para o chamador tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(generateOpinion(BASE_PARAMS)).rejects.toThrow(AnthropicKeyMissingError);
  });
});

describe("generateOpinion — resposta SEM_CONTRIBUICAO", () => {
  it("devolve null (não exibe nem salva) quando o Claude não tem nada a acrescentar", async () => {
    vi.resetModules();
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "SEM_CONTRIBUICAO" }] });
    class MockAnthropic {
      messages = { create };
    }
    vi.doMock("@anthropic-ai/sdk", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
      return { ...actual, default: MockAnthropic };
    });

    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    const isolated = await import("@/lib/ai/copilot");

    const opinion = await isolated.generateOpinion(BASE_PARAMS);
    expect(opinion).toBeNull();

    vi.doUnmock("@anthropic-ai/sdk");
    vi.resetModules();
  });
});
