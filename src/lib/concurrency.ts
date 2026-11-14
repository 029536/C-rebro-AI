/**
 * Roda `fn` para cada item de `items`, no máximo `limit` chamadas por vez,
 * devolvendo os resultados na MESMA ordem de `items` (não na ordem em que
 * terminam). Usado para gerar partes da ata/plano em paralelo sem disparar
 * todas as chamadas de uma vez (CLAUDE.md, "limite de concorrência").
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
