import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

class MockAnthropic {
  messages = { create };
}

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: MockAnthropic };
});

const { generateMinutesPartContent } = await import("@/lib/ai/minutesParts");

afterEach(() => {
  vi.unstubAllEnvs();
  create.mockReset();
});

const BASE_PARAMS = {
  companyContext: "",
  partNumber: 1,
  totalParts: 3,
  transcriptChunk: "algo foi dito nesta parte",
};

function toolUseResponse(input: unknown) {
  return { content: [{ type: "tool_use", id: "toolu_1", name: "salvar_parte_da_ata", input }] };
}

describe("generateMinutesPartContent", () => {
  it("normaliza itens vazios e strings acima do limite antes de validar, em vez de reprovar a parte", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");

    const longAssunto = ("Discussão longa sobre o alinhamento do sistema jurídico do cliente. ".repeat(10)).trim();
    create.mockResolvedValueOnce(
      toolUseResponse({
        assuntos_discutidos: [longAssunto, "", "   "],
        decisoes: ["Decisão válida."],
        responsabilidades: [{ parte: "Equipe", itens: ["Item válido.", ""] }],
        acoes_futuras: [{ acao: "", responsavel: null, prazo: null }],
        ata_formal_trecho: "Texto corrido desta parte.",
      })
    );

    const content = await generateMinutesPartContent(BASE_PARAMS);

    expect(content.assuntos_discutidos.every((item) => item.length <= 500)).toBe(true);
    expect(content.assuntos_discutidos.length).toBeGreaterThan(1);
    expect(content.acoes_futuras).toEqual([]);
    expect(content.ata_formal_trecho).toBe("Texto corrido desta parte.");
  });
});
