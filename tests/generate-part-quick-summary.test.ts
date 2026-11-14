import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

class MockAnthropic {
  messages = { create };
}

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: MockAnthropic };
});

const { generatePartQuickSummary } = await import("@/lib/ai/minutesParts");

afterEach(() => {
  vi.unstubAllEnvs();
  create.mockReset();
});

function textResponse(text: string, stopReason = "end_turn") {
  return { content: [{ type: "text", text }], stop_reason: stopReason };
}

describe("generatePartQuickSummary", () => {
  it("devolve o resumo já na primeira tentativa, sem escalar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(textResponse("Resumo da parte."));

    const summary = await generatePartQuickSummary("transcrição desta parte");

    expect(summary).toBe("Resumo da parte.");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("se vier vazio, tenta de novo com mais max_tokens antes de trocar de modelo", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(textResponse(""));
    create.mockResolvedValueOnce(textResponse("Resumo na segunda tentativa."));

    const summary = await generatePartQuickSummary("transcrição desta parte");

    expect(summary).toBe("Resumo na segunda tentativa.");
    expect(create).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = create.mock.calls.map((call) => call[0]);
    expect(secondCall.max_tokens).toBeGreaterThan(firstCall.max_tokens);
    expect(firstCall.model).toBe(secondCall.model);
  });

  it("se continuar vazio, troca para o CLAUDE_MODEL normal", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    vi.stubEnv("CLAUDE_FAST_MODEL", "modelo-rapido");
    vi.stubEnv("CLAUDE_MODEL", "modelo-principal");
    create.mockResolvedValueOnce(textResponse(""));
    create.mockResolvedValueOnce(textResponse(""));
    create.mockResolvedValueOnce(textResponse("Resumo com o modelo principal."));

    const summary = await generatePartQuickSummary("transcrição desta parte");

    expect(summary).toBe("Resumo com o modelo principal.");
    expect(create).toHaveBeenCalledTimes(3);
    const calls = create.mock.calls.map((call) => call[0]);
    expect(calls[0].model).toBe("modelo-rapido");
    expect(calls[1].model).toBe("modelo-rapido");
    expect(calls[2].model).toBe("modelo-principal");
  });

  it("lança se vier vazio em todas as tentativas, em vez de devolver string vazia", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValue(textResponse("", "max_tokens"));

    await expect(generatePartQuickSummary("transcrição desta parte")).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(3);
  });
});
