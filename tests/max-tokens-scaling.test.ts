import { describe, expect, it } from "vitest";
import { minutesMaxTokens } from "@/lib/ai/minutes";
import { reviewMaxTokens } from "@/lib/ai/review";

describe("minutesMaxTokens", () => {
  it("usa o teto base para transcrição vazia", () => {
    expect(minutesMaxTokens(0)).toBe(8_000);
  });

  it("cresce com o tamanho da transcrição (reunião de 1h+)", () => {
    // ~1h10 de fala, em torno de 56 mil caracteres.
    const longMeeting = minutesMaxTokens(56_000);
    expect(longMeeting).toBeGreaterThan(8_000);
  });

  it("nunca passa do teto máximo, mesmo para transcrições enormes", () => {
    expect(minutesMaxTokens(1_000_000)).toBe(24_000);
  });
});

describe("reviewMaxTokens", () => {
  it("usa o teto base para transcrição vazia", () => {
    expect(reviewMaxTokens(0)).toBe(4_000);
  });

  it("nunca passa do teto máximo", () => {
    expect(reviewMaxTokens(1_000_000)).toBe(12_000);
  });
});
