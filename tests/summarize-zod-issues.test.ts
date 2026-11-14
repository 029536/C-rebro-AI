import { describe, expect, it } from "vitest";
import { z } from "zod";
import { summarizeZodIssues } from "@/lib/ai/env";

describe("summarizeZodIssues", () => {
  it("resume campo e regra que falhou, sem o valor em si", () => {
    const schema = z.object({ ata_formal: z.string().max(5) });
    const result = schema.safeParse({ ata_formal: "um texto bem mais longo que cinco" });
    expect(result.success).toBe(false);
    if (result.success) return;

    const summary = summarizeZodIssues(result.error);
    expect(summary).toContain("ata_formal");
    expect(summary).not.toContain("um texto bem mais longo");
  });

  it("corta em no máximo 5 problemas, mesmo com mais erros que isso", () => {
    const schema = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string(),
      d: z.string(),
      e: z.string(),
      f: z.string(),
    });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;

    const summary = summarizeZodIssues(result.error);
    expect(summary.split("; ")).toHaveLength(5);
  });
});
