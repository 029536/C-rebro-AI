import { describe, expect, it } from "vitest";
import { renderPdfDocuments } from "@/lib/pdf/writer";
import type { PdfDocumentBlocks } from "@/lib/pdf/blocks";

const NO_LETTERHEAD = { text: "", logo: null };

// 1x1 pixel PNG, só para exercitar o caminho com logo sem depender de um arquivo real.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function doc(overrides: Partial<PdfDocumentBlocks> = {}): PdfDocumentBlocks {
  return { kind: "ata", title: "Documento de teste", metaLines: [], blocks: [], ...overrides };
}

/** Conta páginas lendo os objetos "/Type /Page" direto dos bytes do PDF — não precisa de outra biblioteca. */
async function countPdfPages(blob: Blob): Promise<number> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const matches = buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

describe("renderPdfDocuments", () => {
  it("gera um PDF válido (não vazio) com texto acentuado, sem lançar", async () => {
    const blob = await renderPdfDocuments(
      [
        doc({
          blocks: [
            { type: "paragraph", text: "Reunião sobre o alinhamento do sistema jurídico: ação, inscrição, não, café, José." },
          ],
        }),
      ],
      NO_LETTERHEAD
    );
    expect(blob.size).toBeGreaterThan(0);
  });

  it("quebra em várias páginas quando o texto é longo demais para uma só", async () => {
    const longText = "Uma frase qualquer bem repetida para encher a página inteira de texto. ".repeat(400);
    const blobOnePage = await renderPdfDocuments(
      [doc({ blocks: [{ type: "paragraph", text: "Texto curto." }] })],
      NO_LETTERHEAD
    );
    const blobManyPages = await renderPdfDocuments(
      [doc({ blocks: [{ type: "paragraph", text: longText }] })],
      NO_LETTERHEAD
    );

    expect(await countPdfPages(blobOnePage)).toBe(1);
    expect(await countPdfPages(blobManyPages)).toBeGreaterThan(3);
  });

  it("renderiza um prompt_md com blocos de código markdown sem lançar", async () => {
    const promptWithCode = [
      "# Tarefa",
      "",
      "Implemente a função:",
      "",
      "```ts",
      "export function soma(a: number, b: number): number {",
      "  return a + b;",
      "}",
      "```",
      "",
      "Depois rode os testes.",
    ].join("\n");

    await expect(
      renderPdfDocuments([doc({ blocks: [{ type: "monospace", text: promptWithCode }] })], NO_LETTERHEAD)
    ).resolves.toBeInstanceOf(Blob);
  });

  it("cada documento combinado começa numa página nova, exceto o primeiro", async () => {
    const blob = await renderPdfDocuments(
      [doc({ kind: "ata", title: "Ata" }), doc({ kind: "parecer", title: "Parecer" }), doc({ kind: "plano", title: "Plano" })],
      NO_LETTERHEAD
    );
    expect(await countPdfPages(blob)).toBe(3);
  });

  it("aceita um timbre com logo (data URI) sem lançar", async () => {
    await expect(
      renderPdfDocuments([doc()], { text: "Saber Crescer\nContato: time@sabercrescer.com", logo: TINY_PNG })
    ).resolves.toBeInstanceOf(Blob);
  });

  it("lança quando nenhum documento é passado", async () => {
    await expect(renderPdfDocuments([], NO_LETTERHEAD)).rejects.toThrow();
  });
});
