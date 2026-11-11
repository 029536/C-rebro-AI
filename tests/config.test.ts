import { describe, expect, it } from "vitest";
import {
  CHUNK_SECONDS,
  FULL_TRANSCRIPT_MAX_CHARS,
  PART_MINUTES,
} from "@/lib/config";

describe("config", () => {
  it("define os limites básicos de gravação", () => {
    // Curto de propósito, para a transcrição aparecer ao vivo (25-30s).
    expect(CHUNK_SECONDS).toBe(27);
    expect(PART_MINUTES).toBe(45);
    expect(FULL_TRANSCRIPT_MAX_CHARS).toBe(80_000);
  });
});
