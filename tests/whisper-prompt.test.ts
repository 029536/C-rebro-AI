import { describe, expect, it } from "vitest";
import { buildWhisperPrompt } from "@/lib/ai/transcribe";

describe("buildWhisperPrompt", () => {
  it("junta o vocabulário e o final do trecho anterior", () => {
    const prompt = buildWhisperPrompt("Saber Crescer, Cérebro IA", "...e por isso fechamos o escopo assim.");
    expect(prompt).toBe("Saber Crescer, Cérebro IA\n...e por isso fechamos o escopo assim.");
  });

  it("corta o trecho anterior nos últimos 400 caracteres", () => {
    const long = "a".repeat(500);
    const prompt = buildWhisperPrompt("", long);
    expect(prompt).toHaveLength(400);
    expect(prompt).toBe("a".repeat(400));
  });

  it("funciona sem vocabulário nem trecho anterior", () => {
    expect(buildWhisperPrompt("", "")).toBe("");
  });
});
