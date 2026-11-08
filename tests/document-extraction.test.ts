import { describe, expect, it } from "vitest";
import { isScannedWithoutText } from "@/lib/projects/documents";

describe("isScannedWithoutText", () => {
  it("marca como escaneado um PDF com páginas mas quase sem texto", () => {
    expect(isScannedWithoutText(5, 3)).toBe(true);
  });

  it("não marca como escaneado um PDF com texto de verdade", () => {
    expect(isScannedWithoutText(5, 2_000)).toBe(false);
  });

  it("não quebra com zero páginas", () => {
    expect(isScannedWithoutText(0, 0)).toBe(false);
  });

  it("usa a média por página: pouco texto num PDF grande ainda conta como escaneado", () => {
    expect(isScannedWithoutText(100, 500)).toBe(true); // 5 chars/página
    expect(isScannedWithoutText(100, 5_000)).toBe(false); // 50 chars/página
  });
});
