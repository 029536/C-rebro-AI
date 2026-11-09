import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { glob } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const SRC_DIR = resolve(import.meta.dirname, "../src");

// Pega "tool_choice: { type: "tool" ... }" ou "...: "any" ...", com aspas simples ou duplas.
const FORCED_TOOL_CHOICE = /tool_choice\s*:\s*\{\s*type\s*:\s*["'](tool|any)["']/;

/**
 * Regressão: Claude Sonnet 5.5 (e outros) devolvem 400 para tool_choice
 * forçado ("tool"/"any"). lib/ai/structuredTool.ts é o único lugar que deve
 * montar isso (sempre "auto") — este teste varre todo o código-fonte para
 * garantir que ninguém volte a forçar um tool_choice direto numa rota.
 */
describe("nenhuma chamada à Anthropic força tool_choice 'tool' ou 'any'", () => {
  it("varre todo src/**/*.ts(x), exceto o próprio helper", async () => {
    const offenders: string[] = [];

    for await (const rawEntry of glob("**/*.{ts,tsx}", { cwd: SRC_DIR })) {
      const entry = rawEntry.replaceAll("\\", "/");
      if (entry.endsWith("lib/ai/structuredTool.ts")) continue;
      const filePath = resolve(SRC_DIR, entry);
      const content = readFileSync(filePath, "utf8");
      if (FORCED_TOOL_CHOICE.test(content)) {
        offenders.push(entry);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("o próprio helper central usa 'auto', não 'tool' nem 'any'", () => {
    const content = readFileSync(resolve(SRC_DIR, "lib/ai/structuredTool.ts"), "utf8");
    expect(content).toContain('tool_choice: { type: "auto" }');
    expect(FORCED_TOOL_CHOICE.test(content)).toBe(false);
  });
});
