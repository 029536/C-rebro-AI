import { describe, expect, it } from "vitest";
import { filterCodeFile, isAllowedDocumentExtension, looksMinified } from "@/lib/projects/filters";

const maxFileBytes = 150 * 1024;

describe("filterCodeFile", () => {
  it("ignora arquivos dentro de node_modules e .git", () => {
    expect(
      filterCodeFile({ path: "node_modules/pkg/index.js", sizeBytes: 10, content: "x", maxFileBytes })
        .ignore
    ).toBe(true);
    expect(
      filterCodeFile({ path: ".git/HEAD", sizeBytes: 10, content: "x", maxFileBytes }).ignore
    ).toBe(true);
  });

  it("ignora package-lock.json e arquivos *.lock", () => {
    expect(
      filterCodeFile({ path: "package-lock.json", sizeBytes: 10, content: "{}", maxFileBytes })
        .ignore
    ).toBe(true);
    expect(
      filterCodeFile({ path: "yarn.lock", sizeBytes: 10, content: "x", maxFileBytes }).ignore
    ).toBe(true);
  });

  it("ignora imagens e outros binários", () => {
    expect(
      filterCodeFile({ path: "src/logo.png", sizeBytes: 10, content: "", maxFileBytes }).ignore
    ).toBe(true);
  });

  it("ignora arquivos minificados pelo nome ou pelo conteúdo", () => {
    expect(
      filterCodeFile({ path: "dist/app.min.js", sizeBytes: 10, content: "x", maxFileBytes }).ignore
    ).toBe(true);
    const oneGiantLine = "a".repeat(2000);
    expect(
      filterCodeFile({ path: "src/weird.js", sizeBytes: oneGiantLine.length, content: oneGiantLine, maxFileBytes })
        .ignore
    ).toBe(true);
  });

  it("ignora arquivos acima do limite de tamanho", () => {
    expect(
      filterCodeFile({ path: "src/big.ts", sizeBytes: maxFileBytes + 1, content: "x", maxFileBytes })
        .ignore
    ).toBe(true);
  });

  it("aceita um arquivo de código normal", () => {
    const result = filterCodeFile({
      path: "src/app/page.tsx",
      sizeBytes: 500,
      content: "export default function Page() { return null; }",
      maxFileBytes,
    });
    expect(result.ignore).toBe(false);
  });
});

describe("looksMinified", () => {
  it("não marca texto normal como minificado", () => {
    expect(looksMinified("linha 1\nlinha 2\nlinha 3")).toBe(false);
  });

  it("marca um texto curto como não minificado mesmo numa linha só", () => {
    expect(looksMinified("const x = 1;")).toBe(false);
  });
});

describe("isAllowedDocumentExtension", () => {
  it("aceita .md, .txt, .pdf, .docx e .csv", () => {
    for (const name of ["a.md", "a.txt", "a.pdf", "a.docx", "a.csv"]) {
      expect(isAllowedDocumentExtension(name)).toBe(true);
    }
  });

  it("rejeita outras extensões", () => {
    expect(isAllowedDocumentExtension("a.exe")).toBe(false);
    expect(isAllowedDocumentExtension("a.js")).toBe(false);
  });
});
