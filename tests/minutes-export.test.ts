import { describe, expect, it } from "vitest";
import { buildMinutesExportHtml } from "@/lib/minutes/export";

describe("buildMinutesExportHtml", () => {
  it("usa tabela no cabeçalho, nunca flexbox", () => {
    const html = buildMinutesExportHtml({
      titulo: "Reunião de teste",
      ataFormal: "Corpo da ata.",
      letterhead: { text: "Saber Crescer\nRua Exemplo, 123", logo: null },
    });
    expect(html).toContain("<table");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("display: flex");
  });

  it("logo com width e height como atributo da tag, não por CSS", () => {
    const html = buildMinutesExportHtml({
      titulo: "Reunião",
      ataFormal: "Corpo.",
      letterhead: { text: "", logo: "data:image/png;base64,abc123" },
    });
    expect(html).toMatch(/<img[^>]*width="\d+"/);
    expect(html).toMatch(/<img[^>]*height="\d+"/);
  });

  it("sem cabeçalho (sem texto nem logo), não desenha a tabela", () => {
    const html = buildMinutesExportHtml({
      titulo: "Reunião",
      ataFormal: "Corpo.",
      letterhead: { text: "", logo: null },
    });
    expect(html).not.toContain("<table");
  });

  it("escapa HTML do conteúdo da ata (nunca injeta marcação não intencional)", () => {
    const html = buildMinutesExportHtml({
      titulo: "Reunião",
      ataFormal: "<script>alert(1)</script>",
      letterhead: { text: "", logo: null },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("inclui o texto da ata no corpo do documento", () => {
    const html = buildMinutesExportHtml({
      titulo: "Reunião",
      ataFormal: "Decisão importante tomada aqui.",
      letterhead: { text: "", logo: null },
    });
    expect(html).toContain("Decisão importante tomada aqui.");
  });
});
