import { describe, expect, it } from "vitest";
import {
  CHUNK_SECONDS,
  FULL_TRANSCRIPT_MAX_CHARS,
  PART_MINUTES,
} from "@/lib/config";

describe("config", () => {
  it("define os limites básicos de gravação", () => {
    expect(CHUNK_SECONDS).toBe(180);
    expect(PART_MINUTES).toBe(45);
    expect(FULL_TRANSCRIPT_MAX_CHARS).toBe(80_000);
  });
});
