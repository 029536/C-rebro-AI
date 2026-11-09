import { afterEach, describe, expect, it, vi } from "vitest";
import { readApiKey, redactSecrets } from "@/lib/ai/env";
import { AnthropicKeyInvalidError, AnthropicKeyMissingError, getAnthropicClient } from "@/lib/ai/anthropic";
import { OpenAIKeyInvalidError, OpenAIKeyMissingError, getOpenAIClient } from "@/lib/ai/openai";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readApiKey", () => {
  it("corta espaços e quebras de linha nas pontas", () => {
    expect(readApiKey("  sk-ant-abc123  \n", "sk-ant-")).toEqual({
      key: "sk-ant-abc123",
      invalid: false,
    });
  });

  it("considera ausente quando a variável não está definida ou é só espaço", () => {
    expect(readApiKey(undefined, "sk-ant-")).toEqual({ key: null, invalid: false });
    expect(readApiKey("   ", "sk-ant-")).toEqual({ key: null, invalid: false });
  });

  it("considera inválida uma chave com o prefixo errado", () => {
    expect(readApiKey("sk-proj-abc123", "sk-ant-")).toEqual({ key: null, invalid: true });
  });

  it("considera inválida uma chave com espaço ou quebra de linha no meio", () => {
    expect(readApiKey("sk-ant-abc\n123", "sk-ant-")).toEqual({ key: null, invalid: true });
    expect(readApiKey("sk-ant-abc 123", "sk-ant-")).toEqual({ key: null, invalid: true });
  });
});

describe("redactSecrets", () => {
  it("remove qualquer coisa com a cara de uma chave de API", () => {
    expect(redactSecrets("Bearer sk-ant-api03-abcdefghijklmnop")).toBe("Bearer [REDACTED]");
  });

  it("remove a chave configurada mesmo que ela não bata com o padrão genérico", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "segredo-interno-999888777");
    expect(redactSecrets("erro com segredo-interno-999888777 no meio")).toBe(
      "erro com [REDACTED] no meio"
    );
  });

  it("não mexe em texto sem nada parecido com segredo", () => {
    expect(redactSecrets("falha de rede comum")).toBe("falha de rede comum");
  });
});

describe("getAnthropicClient", () => {
  it("lança AnthropicKeyMissingError quando a variável está vazia", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => getAnthropicClient()).toThrow(AnthropicKeyMissingError);
  });

  it("lança AnthropicKeyInvalidError para uma chave malformada, em vez de tentar usá-la", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-abc\ndef");
    expect(() => getAnthropicClient()).toThrow(AnthropicKeyInvalidError);
  });

  it("aceita uma chave válida com espaço nas pontas (variável de ambiente malformada)", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "  sk-ant-chave-de-teste-valida  ");
    expect(() => getAnthropicClient()).not.toThrow();
  });
});

describe("getOpenAIClient", () => {
  it("lança OpenAIKeyMissingError quando a variável está vazia", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => getOpenAIClient()).toThrow(OpenAIKeyMissingError);
  });

  it("lança OpenAIKeyInvalidError para uma chave malformada", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk proj abc");
    expect(() => getOpenAIClient()).toThrow(OpenAIKeyInvalidError);
  });
});
