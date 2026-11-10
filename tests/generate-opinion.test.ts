import { afterEach, describe, expect, it, vi } from "vitest";
import { generateOpinion } from "@/lib/ai/copilot";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PARAMS = {
  kind: "opiniao" as const,
  companyContext: "",
  recentTranscript: "algo foi dito sobre o projeto",
};

describe("generateOpinion", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e devolve uma opinião simulada", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const opinion = await generateOpinion(BASE_PARAMS);
    expect(opinion).toContain("MOCK_AI=1");
  });

  it("com MOCK_AI=1, o tipo 'pergunta' devolve uma resposta simulada diferente da opinião", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const questions = await generateOpinion({ ...BASE_PARAMS, kind: "pergunta" });
    const opinion = await generateOpinion(BASE_PARAMS);
    expect(questions).not.toBe(opinion);
  });

  it("com MOCK_AI=1, o tipo 'resposta' nunca devolve null, mesmo sem pergunta explícita", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const answer = await generateOpinion({ ...BASE_PARAMS, kind: "resposta", question: "Isso já foi decidido?" });
    expect(answer).not.toBeNull();
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para o chamador tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(generateOpinion(BASE_PARAMS)).rejects.toThrow(AnthropicKeyMissingError);
  });
});

describe("generateOpinion — resposta SEM_CONTRIBUICAO", () => {
  it("no tipo 'opiniao', devolve null (não exibe nem salva) quando o Claude não tem nada a acrescentar", async () => {
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

  it("manda o system prompt com cache_control (prefixo estável, sem transcrição)", async () => {
    vi.resetModules();
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "uma opinião" }] });
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

    await isolated.generateOpinion(BASE_PARAMS);

    const sentParams = create.mock.calls[0][0];
    expect(Array.isArray(sentParams.system)).toBe(true);
    expect(sentParams.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(sentParams.system[0].text).not.toContain(BASE_PARAMS.recentTranscript);

    vi.doUnmock("@anthropic-ai/sdk");
    vi.resetModules();
  });
});
