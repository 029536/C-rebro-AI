import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { buildPdfZip } from "@/lib/pdf/zip";

describe("buildPdfZip", () => {
  it("empacota cada PDF com o nome certo, e o conteúdo abre de volta igual", async () => {
    const files = [
      { filename: "Ata - Reunião.pdf", blob: new Blob(["conteúdo da ata"], { type: "application/pdf" }) },
      { filename: "Parecer - Reunião.pdf", blob: new Blob(["conteúdo do parecer"], { type: "application/pdf" }) },
    ];

    const zipBlob = await buildPdfZip(files);
    const entries = unzipSync(new Uint8Array(await zipBlob.arrayBuffer()));

    expect(Object.keys(entries).sort()).toEqual(["Ata - Reunião.pdf", "Parecer - Reunião.pdf"].sort());
    expect(Buffer.from(entries["Ata - Reunião.pdf"]).toString("utf-8")).toBe("conteúdo da ata");
    expect(Buffer.from(entries["Parecer - Reunião.pdf"]).toString("utf-8")).toBe("conteúdo do parecer");
  });
});
