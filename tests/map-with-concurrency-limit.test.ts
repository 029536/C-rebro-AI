import { describe, expect, it } from "vitest";
import { mapWithConcurrencyLimit } from "@/lib/concurrency";

describe("mapWithConcurrencyLimit", () => {
  it("devolve os resultados na mesma ordem dos itens, mesmo terminando fora de ordem", async () => {
    const items = [30, 10, 20];
    const results = await mapWithConcurrencyLimit(items, 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(results).toEqual([30, 10, 20]);
  });

  it("nunca roda mais que `limit` chamadas ao mesmo tempo", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let running = 0;
    let maxRunning = 0;

    await mapWithConcurrencyLimit(items, 3, async (item) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return item;
    });

    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it("processa todos os itens mesmo com limite maior que a lista", async () => {
    const items = [1, 2];
    const results = await mapWithConcurrencyLimit(items, 10, async (item) => item * 2);
    expect(results).toEqual([2, 4]);
  });

  it("devolve lista vazia para lista vazia, sem chamar fn", async () => {
    let called = false;
    const results = await mapWithConcurrencyLimit([], 3, async () => {
      called = true;
      return null;
    });
    expect(results).toEqual([]);
    expect(called).toBe(false);
  });

  it("propaga um erro de uma das chamadas", async () => {
    const items = [1, 2, 3];
    await expect(
      mapWithConcurrencyLimit(items, 2, async (item) => {
        if (item === 2) throw new Error("falhou");
        return item;
      })
    ).rejects.toThrow("falhou");
  });
});
