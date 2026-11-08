import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readZipFile } from "@/lib/projects/zip";

function makeZipFile(entries: Record<string, string>): File {
  const zipped = zipSync(
    Object.fromEntries(Object.entries(entries).map(([path, content]) => [path, strToU8(content)]))
  );
  return new File([zipped as BlobPart], "project.zip");
}

describe("readZipFile", () => {
  it("aceita código normal e ignora node_modules, lock files e segredos", async () => {
    const file = makeZipFile({
      "src/app/page.tsx": "export default function Page() { return null; }",
      "node_modules/pkg/index.js": "module.exports = {};",
      "package-lock.json": "{}",
      ".env": "ANTHROPIC_API_KEY=sk-ant-abcdef1234567890",
      "README.md": "# Projeto de teste",
    });

    const summary = await readZipFile(file);

    expect(summary.accepted.map((entry) => entry.path).sort()).toEqual(["README.md", "src/app/page.tsx"]);
    const rejectedPaths = summary.rejected.map((entry) => entry.path);
    expect(rejectedPaths).toContain("node_modules/pkg/index.js");
    expect(rejectedPaths).toContain("package-lock.json");
    expect(rejectedPaths).toContain(".env");
  });

  it("rejeita um arquivo .env mesmo sem a extensão bater em nenhum filtro de binário", async () => {
    const file = makeZipFile({ ".env.production": "SECRET=1" });
    const summary = await readZipFile(file);
    expect(summary.accepted).toHaveLength(0);
    expect(summary.rejected[0].reason).toContain("segredo");
  });

  it("soma o tamanho total só dos arquivos aceitos", async () => {
    const file = makeZipFile({ "a.ts": "export const a = 1;", "node_modules/x.js": "x" });
    const summary = await readZipFile(file);
    expect(summary.totalBytes).toBe(new TextEncoder().encode("export const a = 1;").length);
  });
});
