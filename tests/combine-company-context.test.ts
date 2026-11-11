import { describe, expect, it } from "vitest";
import { combineCompanyContext } from "@/lib/ai/prompts";

describe("combineCompanyContext", () => {
  it("junta contexto e vocabulário quando ambos existem", () => {
    const combined = combineCompanyContext({ context: "Empresa de educação.", vocabulary: "Lumi, ENEM" });
    expect(combined).toContain("Empresa de educação.");
    expect(combined).toContain("Lumi, ENEM");
  });

  it("devolve só o contexto quando não há vocabulário", () => {
    const combined = combineCompanyContext({ context: "Empresa de educação.", vocabulary: "" });
    expect(combined).toBe("Empresa de educação.");
  });

  it("devolve string vazia quando a linha é nula", () => {
    expect(combineCompanyContext(null)).toBe("");
  });

  it("devolve só o vocabulário quando não há contexto", () => {
    const combined = combineCompanyContext({ context: "", vocabulary: "Lumi, ENEM" });
    expect(combined).toContain("Lumi, ENEM");
    expect(combined).not.toContain("\n\n\n");
  });
});
