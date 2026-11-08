import { describe, expect, it } from "vitest";
import { minutesDocumentSchema } from "@/lib/minutes/schema";

const validDocument = {
  titulo: "Reunião de alinhamento",
  data: "2026-11-08",
  horario: "14:30",
  tipo: "client" as const,
  cliente_ou_empresa: "Dra. Marina — escritório de advocacia",
  participantes: [{ name: "Ana Julia", role: "Sócia" }],
  assuntos_discutidos: ["Automação de contratos"],
  decisoes: ["Começar pelo contrato de prestação de serviços"],
  responsabilidades: [{ parte: "Nossa equipe", itens: ["Mapear o fluxo atual"] }],
  acoes_futuras: [{ acao: "Enviar proposta", responsavel: "Isaias", prazo: "2026-11-15" }],
  observacoes: null,
  resumo_executivo: "Reunião definiu o escopo inicial da automação de contratos.",
  proximos_encontros: [{ data: "2026-11-20", objetivo: "Revisar a proposta" }],
  ata_formal: "ATA DE REUNIÃO\n\n...",
};

describe("minutesDocumentSchema", () => {
  it("aceita um documento completo e válido", () => {
    expect(minutesDocumentSchema.safeParse(validDocument).success).toBe(true);
  });

  it("aceita listas vazias e campos opcionais ausentes", () => {
    const minimal = {
      ...validDocument,
      participantes: [],
      assuntos_discutidos: [],
      decisoes: [],
      responsabilidades: [],
      acoes_futuras: [],
      proximos_encontros: [],
      observacoes: null,
      cliente_ou_empresa: null,
    };
    expect(minutesDocumentSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejeita data fora do formato AAAA-MM-DD", () => {
    expect(minutesDocumentSchema.safeParse({ ...validDocument, data: "08/11/2026" }).success).toBe(
      false
    );
  });

  it("rejeita horário fora do formato HH:mm", () => {
    expect(minutesDocumentSchema.safeParse({ ...validDocument, horario: "2:30pm" }).success).toBe(
      false
    );
  });

  it("rejeita tipo fora de client/internal", () => {
    expect(minutesDocumentSchema.safeParse({ ...validDocument, tipo: "outro" }).success).toBe(false);
  });

  it("exige título e resumo executivo", () => {
    expect(minutesDocumentSchema.safeParse({ ...validDocument, titulo: "" }).success).toBe(false);
    expect(minutesDocumentSchema.safeParse({ ...validDocument, resumo_executivo: "" }).success).toBe(
      false
    );
  });

  it("exige ata_formal não vazia", () => {
    expect(minutesDocumentSchema.safeParse({ ...validDocument, ata_formal: "" }).success).toBe(false);
  });
});
