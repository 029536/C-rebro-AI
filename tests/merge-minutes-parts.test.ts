import { describe, expect, it } from "vitest";
import { dedupeStrings, mergeMinutesParts } from "@/lib/minutes/mergeParts";
import type { MinutesPartContent } from "@/lib/minutes/schema";

function part(overrides: Partial<MinutesPartContent>): MinutesPartContent {
  return {
    assuntos_discutidos: [],
    decisoes: [],
    responsabilidades: [],
    acoes_futuras: [],
    ata_formal_trecho: "",
    ...overrides,
  };
}

describe("dedupeStrings", () => {
  it("remove duplicados ignorando maiúsculas e espaços extras", () => {
    expect(dedupeStrings(["Decisão A", "decisão   a", "Decisão B"])).toEqual(["Decisão A", "Decisão B"]);
  });

  it("mantém a ordem da primeira ocorrência", () => {
    expect(dedupeStrings(["b", "a", "b", "c", "a"])).toEqual(["b", "a", "c"]);
  });
});

describe("mergeMinutesParts", () => {
  it("concatena as listas de todas as partes, na ordem, sem duplicar", () => {
    const merged = mergeMinutesParts([
      part({ assuntos_discutidos: ["Assunto 1"], decisoes: ["Decisão 1"] }),
      part({ assuntos_discutidos: ["Assunto 1", "Assunto 2"], decisoes: ["Decisão 2"] }),
    ]);
    expect(merged.assuntos_discutidos).toEqual(["Assunto 1", "Assunto 2"]);
    expect(merged.decisoes).toEqual(["Decisão 1", "Decisão 2"]);
  });

  it("agrupa responsabilidades pela mesma 'parte', somando os itens sem duplicar", () => {
    const merged = mergeMinutesParts([
      part({ responsabilidades: [{ parte: "Equipe", itens: ["Item A"] }] }),
      part({ responsabilidades: [{ parte: "equipe", itens: ["Item A", "Item B"] }] }),
    ]);
    expect(merged.responsabilidades).toEqual([{ parte: "Equipe", itens: ["Item A", "Item B"] }]);
  });

  it("deduplica ações futuras pelo texto da ação, mantendo a primeira ocorrência", () => {
    const merged = mergeMinutesParts([
      part({ acoes_futuras: [{ acao: "Enviar proposta", responsavel: "Isaias", prazo: "2026-12-01" }] }),
      part({ acoes_futuras: [{ acao: "enviar proposta", responsavel: null, prazo: null }] }),
    ]);
    expect(merged.acoes_futuras).toEqual([
      { acao: "Enviar proposta", responsavel: "Isaias", prazo: "2026-12-01" },
    ]);
  });

  it("junta o texto corrido de cada parte, em ordem, separado por linha em branco", () => {
    const merged = mergeMinutesParts([
      part({ ata_formal_trecho: "Trecho da parte 1." }),
      part({ ata_formal_trecho: "Trecho da parte 2." }),
    ]);
    expect(merged.body).toBe("Trecho da parte 1.\n\nTrecho da parte 2.");
  });
});
