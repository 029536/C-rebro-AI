import { describe, expect, it } from "vitest";
import { normalizeMinutesPartContent } from "@/lib/minutes/normalizePartContent";
import { minutesPartContentSchema } from "@/lib/minutes/schema";

describe("normalizeMinutesPartContent", () => {
  it("remove itens vazios ou só com espaço de todas as listas", () => {
    const result = normalizeMinutesPartContent({
      assuntos_discutidos: ["Assunto real.", "", "   "],
      decisoes: ["  ", "Decisão real."],
      responsabilidades: [{ parte: "Equipe", itens: ["Item real.", ""] }],
      acoes_futuras: [{ acao: "  ", responsavel: null, prazo: null }, { acao: "Ação real.", responsavel: null, prazo: null }],
      ata_formal_trecho: "Texto.",
    }) as Record<string, unknown>;

    expect(result.assuntos_discutidos).toEqual(["Assunto real."]);
    expect(result.decisoes).toEqual(["Decisão real."]);
    expect((result.responsabilidades as { itens: string[] }[])[0].itens).toEqual(["Item real."]);
    // a ação vazia some inteira (acao é obrigatório e não pode ficar em branco).
    expect(result.acoes_futuras).toEqual([{ acao: "Ação real.", responsavel: null, prazo: null }]);
  });

  it("divide um assunto/decisão acima de 500 caracteres no último ponto final, sem perder conteúdo", () => {
    const first = "Primeira frase bem longa sobre o sistema jurídico do cliente. ".repeat(10); // ~640 chars, termina em ". "
    const second = "Segunda parte do assunto, mais curta.";
    const long = (first + second).trim();

    const result = normalizeMinutesPartContent({
      assuntos_discutidos: [long],
      decisoes: [],
      responsabilidades: [],
      acoes_futuras: [],
      ata_formal_trecho: "Texto.",
    }) as Record<string, unknown>;

    const parts = result.assuntos_discutidos as string[];
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(500);
    }
    // nenhum caractere do conteúdo original pode ter sumido.
    expect(parts.join(" ").replace(/\s+/g, " ")).toContain("Segunda parte do assunto");
    expect(minutesPartContentSchema.safeParse(result).success).toBe(true);
  });

  it("divide um item de responsabilidade e uma ação futura acima de 300 caracteres, duplicando responsável/prazo", () => {
    const longAcao = ("Faça a migração do sistema jurídico com cuidado. ".repeat(8)).trim(); // > 300 chars
    const result = normalizeMinutesPartContent({
      assuntos_discutidos: [],
      decisoes: [],
      responsabilidades: [{ parte: "Equipe", itens: [longAcao] }],
      acoes_futuras: [{ acao: longAcao, responsavel: "Fulano", prazo: "até sexta" }],
      ata_formal_trecho: "Texto.",
    }) as Record<string, unknown>;

    const itens = (result.responsabilidades as { itens: string[] }[])[0].itens;
    expect(itens.length).toBeGreaterThan(1);
    for (const item of itens) expect(item.length).toBeLessThanOrEqual(300);

    const acoes = result.acoes_futuras as { acao: string; responsavel: string | null; prazo: string | null }[];
    expect(acoes.length).toBeGreaterThan(1);
    for (const acao of acoes) {
      expect(acao.acao.length).toBeLessThanOrEqual(300);
      expect(acao.responsavel).toBe("Fulano");
      expect(acao.prazo).toBe("até sexta");
    }
  });

  it("corta no limite mesmo sem ponto final (sem perder nenhum caractere ao juntar de volta)", () => {
    const noSentenceEnd = "palavra ".repeat(100).trim(); // > 500 chars, nunca tem ". "
    const result = normalizeMinutesPartContent({
      assuntos_discutidos: [noSentenceEnd],
      decisoes: [],
      responsabilidades: [],
      acoes_futuras: [],
      ata_formal_trecho: "Texto.",
    }) as Record<string, unknown>;

    const parts = result.assuntos_discutidos as string[];
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(500);
    // sem espaços (que o corte pode reorganizar), nenhuma letra do conteúdo original sumiu.
    expect(parts.join("").replace(/\s+/g, "")).toBe(noSentenceEnd.replace(/\s+/g, ""));
  });

  it("trunca nome de parte, responsável e prazo acima de 100 caracteres, sem cortar no meio de uma palavra", () => {
    const longName =
      "Equipe de desenvolvimento responsável pela integração completa do sistema jurídico do cliente final, com apoio jurídico";
    expect(longName.length).toBeGreaterThan(100);

    const result = normalizeMinutesPartContent({
      assuntos_discutidos: [],
      decisoes: [],
      responsabilidades: [{ parte: longName, itens: ["Item."] }],
      acoes_futuras: [{ acao: "Ação.", responsavel: longName, prazo: longName }],
      ata_formal_trecho: "Texto.",
    }) as Record<string, unknown>;

    const parte = (result.responsabilidades as { parte: string }[])[0].parte;
    expect(parte.length).toBeLessThanOrEqual(100);
    expect(longName.startsWith(parte)).toBe(true);
    expect(parte.endsWith(" ")).toBe(false);

    const acao = (result.acoes_futuras as { responsavel: string; prazo: string }[])[0];
    expect(acao.responsavel.length).toBeLessThanOrEqual(100);
    expect(acao.prazo.length).toBeLessThanOrEqual(100);
  });

  it("nunca limita ou mexe em ata_formal_trecho", () => {
    const hugeText = "x".repeat(5_000);
    const result = normalizeMinutesPartContent({
      assuntos_discutidos: [],
      decisoes: [],
      responsabilidades: [],
      acoes_futuras: [],
      ata_formal_trecho: hugeText,
    }) as Record<string, unknown>;

    expect(result.ata_formal_trecho).toBe(hugeText);
  });
});
