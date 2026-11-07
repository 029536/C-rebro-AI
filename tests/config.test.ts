import { describe, expect, it } from "vitest";
import {
  CHUNK_SECONDS,
  FULL_TRANSCRIPT_MAX_CHARS,
  PART_MINUTES,
} from "@/lib/config";

describe("config", () => {
  it("define os limites básicos de gravação", () => {
    expect(CHUNK_SECONDS).toBe(180);
    // PART_MINUTES está temporariamente em 1 para o teste acelerado da Fase 3.
    expect(PART_MINUTES).toBe(1);
    expect(FULL_TRANSCRIPT_MAX_CHARS).toBe(80_000);
  });
});
