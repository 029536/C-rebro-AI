import { describe, expect, it } from "vitest";
import { extractJsonFromText } from "@/lib/ai/structuredTool";

describe("extractJsonFromText", () => {
  it("extrai JSON de dentro de cercas ```json", () => {
    const text = '```json\n{"a": 1, "b": "texto"}\n```';
    expect(extractJsonFromText(text)).toEqual({ a: 1, b: "texto" });
  });

  it("extrai JSON de dentro de cercas simples, sem a palavra json", () => {
    const text = '```\n{"a": 1}\n```';
    expect(extractJsonFromText(text)).toEqual({ a: 1 });
  });

  it("tira prosa antes e depois do JSON, sem cercas", () => {
    const text = 'Claro, aqui está: {"a": 1} — espero ter ajudado!';
    expect(extractJsonFromText(text)).toEqual({ a: 1 });
  });

  it("devolve undefined quando não há chaves de objeto no texto", () => {
    expect(extractJsonFromText("desculpe, não posso ajudar com isso")).toBeUndefined();
  });

  it("devolve undefined quando o conteúdo entre chaves não é JSON válido", () => {
    expect(extractJsonFromText("{isso não é json}")).toBeUndefined();
  });

  it("lida com objetos aninhados dentro do texto", () => {
    const text = 'Resultado: {"a": {"b": [1, 2, 3]}} fim.';
    expect(extractJsonFromText(text)).toEqual({ a: { b: [1, 2, 3] } });
  });
});
