import { APIError } from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { describeAnthropicError } from "@/lib/ai/anthropic";

function apiError(status: number, message = "deu erro"): APIError {
  return new APIError(status, undefined, message, undefined);
}

describe("describeAnthropicError", () => {
  it("traduz 401 como falha de autenticação, não como chave ausente", () => {
    expect(describeAnthropicError(apiError(401))).toContain("autenticação inválida");
  });

  it("traduz 429 como limite de uso (créditos ou taxa de chamadas)", () => {
    expect(describeAnthropicError(apiError(429))).toContain("Limite de uso");
  });

  it("traduz 500 e 529 como instabilidade do lado da Anthropic", () => {
    expect(describeAnthropicError(apiError(500))).toContain("instável");
    expect(describeAnthropicError(apiError(529))).toContain("instável");
  });

  it("para um status sem tradução específica, inclui o status e a mensagem originais", () => {
    const message = describeAnthropicError(apiError(418, "sou um bule de chá"));
    expect(message).toContain("418");
    expect(message).toContain("sou um bule de chá");
  });

  it("para um erro que não é da Anthropic, usa a mensagem do próprio erro", () => {
    expect(describeAnthropicError(new Error("falha de rede"))).toBe("falha de rede");
  });

  it("para algo que nem é um Error, devolve uma mensagem genérica em português", () => {
    expect(describeAnthropicError("x")).toBe("Falha desconhecida ao chamar a Anthropic.");
  });
});
