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

function messageWithTruncatedToolUse(input: unknown) {
  return {
    stop_reason: "max_tokens",
    content: [{ type: "tool_use", id: "toolu_1", name: "ferramenta", input }],
  };
}

function messageWithJsonInText(payload: unknown) {
  return {
    content: [
      { type: "text", text: `Claro! Aqui está:\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`\nEspero ter ajudado.` },
    ],
  };
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

  it("não aceita um tool_use cortado por max_tokens como sucesso — tenta de novo com mais espaço", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValueOnce(messageWithTruncatedToolUse({ a: "incompleto" }));
    create.mockResolvedValueOnce(messageWithToolUse({ a: "completo" }));

    const result = await callStructuredTool(BASE_PARAMS);

    expect(result).toEqual({ a: "completo" });
    expect(create).toHaveBeenCalledTimes(2);
    // a segunda tentativa pede mais tokens que a primeira (dobro, até o teto de 4x).
    expect(create.mock.calls[1][0].max_tokens).toBeGreaterThan(create.mock.calls[0][0].max_tokens);
  });

  it("nunca escala o max_tokens além de 4x o pedido originalmente", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValue(messageWithTruncatedToolUse({ a: "sempre incompleto" }));

    await expect(callStructuredTool(BASE_PARAMS)).rejects.toThrow(StructuredToolError);
    const maxTokensUsed = create.mock.calls.map((call) => call[0].max_tokens);
    expect(Math.max(...maxTokensUsed)).toBeLessThanOrEqual(BASE_PARAMS.maxTokens * 4);
  });

  it("o erro final por max_tokens carrega o motivo real em `detail`, não só a mensagem genérica", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValue(messageWithTruncatedToolUse({ a: "sempre incompleto" }));

    await expect(callStructuredTool(BASE_PARAMS)).rejects.toMatchObject({
      message: expect.stringContaining("limite de tamanho"),
      detail: expect.stringContaining("stop_reason=max_tokens"),
    });
  });

  it("como último recurso, extrai um JSON de dentro de cercas ```json quando não há tool_use", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    create.mockResolvedValueOnce(messageWithJsonInText({ a: "veio em texto" }));

    const result = await callStructuredTool(BASE_PARAMS);

    expect(result).toEqual({ a: "veio em texto" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
