import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

class MockAnthropic {
  messages = { create };
}

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: MockAnthropic };
});

const { generateTaskPrompt, shortenTaskPrompt, PlanTaskPromptError } = await import("@/lib/ai/plan");

afterEach(() => {
  vi.unstubAllEnvs();
  create.mockReset();
});

const BASE_PARAMS = {
  companyContext: "",
  hasProject: false,
  skeletonBlock: "1. Tarefa 1\n2. Tarefa 2",
  task: { title: "Tarefa 1", description: "desc", acceptance: "aceite" },
};

function textResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

describe("generateTaskPrompt (etapa 2 do plano)", () => {
  it("manda o contexto estável (empresa/ata/parecer/esqueleto) com cache_control, e a tarefa fora dele", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(textResponse("Prompt gerado."));

    const text = await generateTaskPrompt(BASE_PARAMS);

    expect(text).toBe("Prompt gerado.");
    const call = create.mock.calls[0][0];
    expect(Array.isArray(call.system)).toBe(true);
    expect(call.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(call.system[0].text).toContain("Tarefa 1\n2. Tarefa 2");
    expect(call.messages[0].content).toContain("Tarefa 1");
    expect(call.messages[0].content).not.toContain("1. Tarefa 1\n2. Tarefa 2");
  });

  it("lança PlanTaskPromptError se o Claude responder vazio", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(textResponse(""));

    await expect(generateTaskPrompt(BASE_PARAMS)).rejects.toThrow(PlanTaskPromptError);
  });
});

describe("shortenTaskPrompt", () => {
  it("devolve o texto encurtado pelo Claude", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(textResponse("Versão encurtada."));

    const text = await shortenTaskPrompt("texto original bem grande", 100);
    expect(text).toBe("Versão encurtada.");
  });

  it("cai no texto original se o Claude responder vazio", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(textResponse(""));

    const text = await shortenTaskPrompt("texto original", 100);
    expect(text).toBe("texto original");
  });
});
