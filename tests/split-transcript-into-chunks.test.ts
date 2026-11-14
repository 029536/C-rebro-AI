import { describe, expect, it } from "vitest";
import { splitTranscriptIntoChunks } from "@/lib/ai/textChunking";

describe("splitTranscriptIntoChunks", () => {
  it("devolve lista vazia para transcrição vazia", () => {
    expect(splitTranscriptIntoChunks("")).toEqual([]);
    expect(splitTranscriptIntoChunks("   ")).toEqual([]);
  });

  it("devolve um único pedaço quando cabe inteiro no alvo", () => {
    const transcript = "Uma reunião curta, sem precisar dividir em partes.";
    expect(splitTranscriptIntoChunks(transcript, 1_000)).toEqual([transcript]);
  });

  it("divide uma transcrição longa em mais de uma parte", () => {
    const sentence = "Isso é uma frase de teste repetida muitas vezes. ";
    const transcript = sentence.repeat(50); // ~2450 caracteres
    const chunks = splitTranscriptIntoChunks(transcript, 1_000);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("nunca corta no meio de uma frase quando há um ponto final por perto", () => {
    const transcript =
      "Primeira frase aqui, com bastante conteúdo para ocupar espaço. " +
      "Segunda frase também longa, cobrindo mais um pedaço do texto. " +
      "Terceira frase final, fechando o trecho de teste por aqui.";
    const chunks = splitTranscriptIntoChunks(transcript, 70);
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.trim().endsWith(".")).toBe(true);
    }
  });

  it("junta tudo de volta sem perder nem repetir conteúdo (menos espaços nas bordas)", () => {
    const sentence = "Frase número um. Frase número dois. Frase número três. ";
    const transcript = sentence.repeat(30);
    const chunks = splitTranscriptIntoChunks(transcript, 200);
    const rejoined = chunks.join(" ").replace(/\s+/g, " ").trim();
    const original = transcript.replace(/\s+/g, " ").trim();
    expect(rejoined).toBe(original);
  });

  it("corta 'a seco' no tamanho alvo quando não há fim de frase por perto", () => {
    const transcript = "a".repeat(100) + " " + "b".repeat(100);
    const chunks = splitTranscriptIntoChunks(transcript, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
  });
});
