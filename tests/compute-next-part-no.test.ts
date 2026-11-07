import { describe, expect, it } from "vitest";
import { computeNextPartNo } from "@/lib/meetings";

describe("computeNextPartNo", () => {
  it("continua na mesma parte enquanto não passa do limite", () => {
    const result = computeNextPartNo({
      currentPartNo: 1,
      currentPartSeconds: 100,
      newChunkSeconds: 60,
      partMinutes: 3,
    });
    expect(result).toEqual({ partNo: 1, closedPartNo: null });
  });

  it("abre a próxima parte quando a soma passa do limite", () => {
    const result = computeNextPartNo({
      currentPartNo: 1,
      currentPartSeconds: 170,
      newChunkSeconds: 20,
      partMinutes: 3, // 180s
    });
    expect(result).toEqual({ partNo: 2, closedPartNo: 1 });
  });

  it("4 minutos de reunião com PART_MINUTES=1 geram 4 partes e 3 checkpoints", () => {
    const partMinutes = 1; // 60s
    const chunkSeconds = 60;
    let currentPartNo = 1;
    let currentPartSeconds = 0;
    const partsSeen = new Set<number>([1]);
    const closedParts: number[] = [];

    for (let i = 0; i < 4; i++) {
      const { partNo, closedPartNo } = computeNextPartNo({
        currentPartNo,
        currentPartSeconds,
        newChunkSeconds: chunkSeconds,
        partMinutes,
      });
      if (closedPartNo !== null) closedParts.push(closedPartNo);
      if (partNo !== currentPartNo) {
        currentPartNo = partNo;
        currentPartSeconds = 0;
      }
      currentPartSeconds += chunkSeconds;
      partsSeen.add(partNo);
    }

    expect(partsSeen.size).toBe(4);
    expect(closedParts).toEqual([1, 2, 3]);
  });

  it("força uma nova parte depois de 'Continuar gravação', mesmo com a parte atual curta", () => {
    const result = computeNextPartNo({
      currentPartNo: 2,
      currentPartSeconds: 10,
      newChunkSeconds: 5,
      forceNewPartAtLeast: 3,
      partMinutes: 45,
    });
    expect(result).toEqual({ partNo: 3, closedPartNo: 2 });
  });
});
