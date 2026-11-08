import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/hash";

describe("sha256Hex", () => {
  it("é determinístico", () => {
    expect(sha256Hex("olá")).toBe(sha256Hex("olá"));
  });

  it("muda quando o conteúdo muda", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });

  it("bate com o valor conhecido de sha256('')", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
