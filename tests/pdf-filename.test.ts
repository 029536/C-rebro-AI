import { describe, expect, it } from "vitest";
import { buildExportFilename } from "@/lib/pdf/filename";

describe("buildExportFilename", () => {
  it('monta "Prefixo - título.extensão"', () => {
    expect(buildExportFilename("Ata", "Alinhamento do sistema jurídico", "pdf")).toBe(
      "Ata - Alinhamento do sistema jurídico.pdf"
    );
  });

  it("troca caracteres inválidos em nome de arquivo por hífen", () => {
    expect(buildExportFilename("Parecer", 'Reunião: cliente/fornecedor "X"', "pdf")).toBe(
      "Parecer - Reunião- cliente-fornecedor -X-.pdf"
    );
  });

  it("cai só no prefixo quando o título fica vazio depois de sanitizar", () => {
    expect(buildExportFilename("Plano", "   ", "pdf")).toBe("Plano.pdf");
  });

  it("limita o tamanho do nome final", () => {
    const filename = buildExportFilename("Ata", "x".repeat(300), "pdf");
    expect(filename.length).toBeLessThanOrEqual(165);
  });
});
