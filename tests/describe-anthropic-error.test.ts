import { APIError } from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeAnthropicError, describeAnthropicErrorDetail } from "@/lib/ai/anthropic";

function apiError(status: number, message = "deu erro", type?: string): APIError {
  return new APIError(status, undefined, message, undefined, type as ConstructorParameters<typeof APIError>[4]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("describeAnthropicError", () => {
  it("traduz 401 como chave inválida", () => {
    expect(describeAnthropicError(apiError(401))).toBe(
      "Chave da Anthropic inválida; confira a configuração."
    );
  });

  it("traduz 429 como limite de uso (créditos ou taxa de chamadas)", () => {
    expect(describeAnthropicError(apiError(429))).toContain("Limite de uso");
  });

  it("traduz 500 e 529 como instabilidade do lado da Anthropic", () => {
    expect(describeAnthropicError(apiError(500))).toContain("instável");
    expect(describeAnthropicError(apiError(529))).toContain("instável");
  });

  it("para um status sem tradução específica, devolve uma mensagem genérica segura, sem o texto original", () => {
    const message = describeAnthropicError(apiError(418, "sou um bule de chá"));
    expect(message).not.toContain("418");
    expect(message).not.toContain("bule de chá");
  });

  // Regressão: um erro de rede chegou a ecoar "Headers.append: ... Bearer
  // sk-ant-..." inteiro, e essa mensagem foi parar na tela do usuário.
  it("nunca devolve o texto bruto de um erro genérico, mesmo que ele contenha uma chave", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const leaky = new Error(
      'Headers.append: "Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz" is an invalid header value.'
    );
    const message = describeAnthropicError(leaky);
    expect(message).not.toContain("sk-ant-");
    expect(message).not.toContain("Bearer");
    expect(message).toBe("Falha ao chamar a Anthropic. Tente novamente em instantes.");
  });

  it("também redige a chave no próprio log do servidor", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    describeAnthropicError(new Error("Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz"));
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("sk-ant-api03-abcdefghijklmnopqrstuvwxyz");
  });

  it("para algo que nem é um Error, devolve a mesma mensagem genérica segura", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(describeAnthropicError("x")).toBe("Falha ao chamar a Anthropic. Tente novamente em instantes.");
  });
});

describe("describeAnthropicErrorDetail", () => {
  it("para um erro vindo de verdade da API (APIError), inclui status, tipo e a mensagem da Anthropic", () => {
    const detail = describeAnthropicErrorDetail(
      apiError(
        400,
        "tools.0.custom: For 'object' type, 'additionalProperties' must be explicitly set to false",
        "invalid_request_error"
      )
    );
    expect(detail).toContain("400");
    expect(detail).toContain("invalid_request_error");
    expect(detail).toContain("additionalProperties");
  });

  // O detalhe só existe para erros que já vieram como resposta da Anthropic
  // (nunca podem ecoar nosso cabeçalho/chave); um erro antes disso — rede,
  // cabeçalho malformado — não tem detalhe nenhum exposto.
  it("para um erro que não é da API (rede, cabeçalho malformado), não expõe detalhe nenhum", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const leaky = new Error('Headers.append: "Bearer sk-ant-api03-abc" is an invalid header value.');
    expect(describeAnthropicErrorDetail(leaky)).toBeNull();
  });

  it("mesmo vindo de uma APIError de verdade, redige qualquer coisa parecida com uma chave na mensagem", () => {
    const detail = describeAnthropicErrorDetail(
      apiError(400, "algo com sk-ant-api03-abcdefghijklmnop no meio", "invalid_request_error")
    );
    expect(detail).not.toContain("sk-ant-");
    expect(detail).toContain("[REDACTED]");
  });
});
