import { describe, expect, it } from "vitest";
import { parseSelectedItems } from "@/lib/projects/selectFiles";

const validPaths = ["src/app/page.tsx", "src/lib/config.ts", "README.md"];

describe("parseSelectedItems", () => {
  it("aceita só os caminhos que existem na lista", () => {
    const response = JSON.stringify({ paths: ["src/app/page.tsx", "caminho/inventado.ts", "README.md"] });
    expect(parseSelectedItems(response, validPaths)).toEqual(["src/app/page.tsx", "README.md"]);
  });

  it("devolve lista vazia para JSON inválido", () => {
    expect(parseSelectedItems("não é json", validPaths)).toEqual([]);
  });

  it("devolve lista vazia quando o formato não bate com o esperado", () => {
    expect(parseSelectedItems(JSON.stringify({ paths: [123] }), validPaths)).toEqual([]);
    expect(parseSelectedItems(JSON.stringify({ outraCoisa: [] }), validPaths)).toEqual([]);
  });

  it("aceita {paths: []} quando nada é relevante", () => {
    expect(parseSelectedItems(JSON.stringify({ paths: [] }), validPaths)).toEqual([]);
  });

  it("corta no máximo de itens configurado", () => {
    const many = Array.from({ length: 20 }, (_, i) => `arquivo-${i}.ts`);
    const response = JSON.stringify({ paths: many });
    expect(parseSelectedItems(response, many).length).toBe(12);
  });
});
