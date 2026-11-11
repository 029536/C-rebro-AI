import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildMinutesDocxBlob, safeFilename } from "@/lib/minutes/docx";
import { MOCK_MINUTES_EXAMPLE } from "@/lib/minutes/mockExample";

const TINY_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAScy0lUAAAAASUVORK5CYII=";

async function unzipBlob(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  return unzipSync(buffer);
}

describe("buildMinutesDocxBlob", () => {
  it("gera um pacote OOXML válido: Content_Types, _rels e document.xml presentes", async () => {
    const blob = await buildMinutesDocxBlob({
      document: MOCK_MINUTES_EXAMPLE,
      letterhead: { text: "", logo: null },
    });
    const entries = await unzipBlob(blob);

    expect(entries["[Content_Types].xml"]).toBeDefined();
    expect(entries["_rels/.rels"]).toBeDefined();
    expect(entries["word/document.xml"]).toBeDefined();
  });

  it("document.xml contém o título e o resumo executivo da ata", async () => {
    const blob = await buildMinutesDocxBlob({
      document: MOCK_MINUTES_EXAMPLE,
      letterhead: { text: "", logo: null },
    });
    const entries = await unzipBlob(blob);
    const documentXml = new TextDecoder().decode(entries["word/document.xml"]);

    expect(documentXml).toContain("automação de contratos");
    expect(documentXml).toContain("Resumo executivo");
  });

  it("sem logo, não embute nenhuma imagem no pacote", async () => {
    const blob = await buildMinutesDocxBlob({
      document: MOCK_MINUTES_EXAMPLE,
      letterhead: { text: "Saber Crescer", logo: null },
    });
    const entries = await unzipBlob(blob);
    const hasImage = Object.keys(entries).some((path) => path.startsWith("word/media/"));
    expect(hasImage).toBe(false);
  });

  it("com logo, embute a imagem como PNG válido (assinatura de arquivo correta)", async () => {
    const blob = await buildMinutesDocxBlob({
      document: MOCK_MINUTES_EXAMPLE,
      letterhead: { text: "Saber Crescer", logo: TINY_PNG_DATA_URI },
    });
    const entries = await unzipBlob(blob);
    const image = entries["word/media/image1.png"];

    expect(image).toBeDefined();
    expect([image[0], image[1], image[2], image[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

describe("safeFilename", () => {
  it("remove caracteres inválidos em nome de arquivo (Windows/macOS)", () => {
    const name = safeFilename('Ata: "teste"? <2026>', "docx");
    expect(name).not.toMatch(/["*/:<>?\\|]/);
    expect(name.endsWith(".docx")).toBe(true);
  });

  it("usa um nome padrão quando o título fica vazio depois de limpar", () => {
    expect(safeFilename("   ", "docx")).toBe("ata.docx");
  });

  it("mantém um título normal intacto", () => {
    expect(safeFilename("Reunião de alinhamento", "docx")).toBe("Reunião de alinhamento.docx");
  });
});
