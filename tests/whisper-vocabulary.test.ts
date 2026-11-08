import { describe, expect, it } from "vitest";
import { buildMeetingVocabulary } from "@/lib/ai/transcribe";

describe("buildMeetingVocabulary", () => {
  it("junta vocabulário da empresa, cliente, participantes (com cargo) e contexto", () => {
    const vocabulary = buildMeetingVocabulary({
      companyVocabulary: "Saber Crescer, Cérebro IA",
      clientName: "Dra. Marina — escritório de advocacia",
      participants: [{ name: "Ana Julia", role: "Sócia" }, { name: "Isaias" }],
      context: "Automação de contratos",
    });

    expect(vocabulary).toBe(
      "Saber Crescer, Cérebro IA, Dra. Marina — escritório de advocacia, Ana Julia (Sócia), Isaias, Automação de contratos"
    );
  });

  it("ignora partes vazias ou ausentes", () => {
    const vocabulary = buildMeetingVocabulary({
      companyVocabulary: "",
      clientName: null,
      participants: [],
      context: null,
    });
    expect(vocabulary).toBe("");
  });

  it("funciona só com participantes, sem cliente nem contexto", () => {
    const vocabulary = buildMeetingVocabulary({
      companyVocabulary: "",
      participants: [{ name: "Ana Julia" }],
    });
    expect(vocabulary).toBe("Ana Julia");
  });
});
