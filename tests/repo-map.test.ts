import { describe, expect, it } from "vitest";
import { buildRepoMap } from "@/lib/projects/repoMap";

describe("buildRepoMap", () => {
  it("inclui a árvore, o README, o package.json e o CLAUDE.md quando existem", () => {
    const map = buildRepoMap([
      { path: "README.md", content: "# Meu projeto" },
      { path: "package.json", content: '{"name":"meu-projeto"}' },
      { path: "CLAUDE.md", content: "Contexto do projeto." },
      { path: "src/index.ts", content: "export {}" },
    ]);

    expect(map).toContain("## Árvore de arquivos");
    expect(map).toContain("src/index.ts");
    expect(map).toContain("## README\n# Meu projeto");
    expect(map).toContain("## package.json");
    expect(map).toContain("## CLAUDE.md\nContexto do projeto.");
  });

  it("lista rotas (page/route/layout) e arquivos .sql", () => {
    const map = buildRepoMap([
      { path: "src/app/page.tsx", content: "" },
      { path: "src/app/api/meetings/route.ts", content: "" },
      { path: "supabase/migrations/0001_init.sql", content: "" },
      { path: "src/lib/util.ts", content: "" },
    ]);

    expect(map).toContain("## Rotas");
    expect(map).toContain("src/app/page.tsx");
    expect(map).toContain("src/app/api/meetings/route.ts");
    expect(map).toContain("## Arquivos de esquema do banco");
    expect(map).toContain("supabase/migrations/0001_init.sql");

    const routesSection = map.split("## Rotas\n")[1].split("\n\n")[0];
    expect(routesSection).not.toContain("src/lib/util.ts");
  });

  it("não inclui seções para o que não existe", () => {
    const map = buildRepoMap([{ path: "src/index.ts", content: "" }]);
    expect(map).not.toContain("README");
    expect(map).not.toContain("package.json");
  });

  it("corta no limite de caracteres", () => {
    const files = Array.from({ length: 50 }, (_, i) => ({ path: `src/file-${i}.ts`, content: "" }));
    const map = buildRepoMap(files, 50);
    expect(map.length).toBe(50);
  });
});
