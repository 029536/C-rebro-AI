import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

class MockAnthropic {
  messages = { create };
}

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: MockAnthropic };
});

const { callStructuredTool, StructuredToolError } = await import("@/lib/ai/structuredTool");

function messageWithToolUse(input: unknown) {
  return { content: [{ type: "tool_use", id: "toolu_1", name: "ferramenta", input }] };
}

function messageWithOnlyText() {
  return { content: [{ type: "text", text: "desculpe, não vou usar a ferramenta" }] };
}

const BASE_PARAMS = {
  model: "claude-sonnet-5-5",
  maxTokens: 100,
  system: "sistema",
  messages: [{ role: "user" as const, content: "oi" }],
  toolName: "ferramenta",
  toolDescription: "uma ferramenta de teste",
  inputSchema: { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
};

afterEach(() => {
  vi.unstubAllEnvs();
  create.mockReset();
});

describe("callStructuredTool", () => {
  it("nunca manda tool_choice do tipo 'tool' nem 'any' — sempre 'auto' (Claude Sonnet 5.5 recusa forçado com 400)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValueOnce(messageWithToolUse({ a: "1" }));

    await callStructuredTool(BASE_PARAMS);

    expect(create).toHaveBeenCalledTimes(1);
    const sentParams = create.mock.calls[0][0];
    expect(sentParams.tool_choice).toEqual({ type: "auto" });
  });

  it("devolve o input assim que vem um tool_use, sem tentar de novo à toa", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValueOnce(messageWithToolUse({ a: "1" }));

    const result = await callStructuredTool(BASE_PARAMS);

    expect(result).toEqual({ a: "1" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("tenta de novo se vier só texto, e usa o tool_use assim que aparecer", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValueOnce(messageWithOnlyText());
    create.mockResolvedValueOnce(messageWithToolUse({ a: "2" }));

    const result = await callStructuredTool(BASE_PARAMS);

    expect(result).toEqual({ a: "2" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("desiste depois de até 2 tentativas extras (3 chamadas no total) e lança StructuredToolError", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValue(messageWithOnlyText());

    await expect(callStructuredTool(BASE_PARAMS)).rejects.toThrow(StructuredToolError);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("reforça no prompt de sistema para responder só chamando a ferramenta", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValueOnce(messageWithToolUse({ a: "1" }));

    await callStructuredTool(BASE_PARAMS);

    const sentParams = create.mock.calls[0][0];
    expect(sentParams.system).toContain("SOMENTE chamando a ferramenta");
  });
});
