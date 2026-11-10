import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  chunkKey,
  computeBackoffMs,
  enqueueChunk,
  listDueChunks,
  listExhaustedChunks,
  listPendingChunks,
  markChunkFailed,
  markChunkSent,
  resetBackoff,
} from "@/lib/recorder/uploadQueue";

const meetingId = "11111111-1111-1111-1111-111111111111";

function makeChunk(idx: number) {
  return {
    meetingId,
    idx,
    blob: new Blob(["audio"], { type: "audio/webm" }),
    mimeType: "audio/webm;codecs=opus",
    extension: "webm",
    audioSeconds: 180,
  };
}

beforeEach(async () => {
  // Esvazia a fila entre testes removendo o que cada teste tiver enfileirado.
  const pending = await listPendingChunks(meetingId);
  await Promise.all(pending.map((chunk) => markChunkSent(chunk.key)));
});

describe("computeBackoffMs", () => {
  it("cresce exponencialmente e satura em 60s", () => {
    expect(computeBackoffMs(0)).toBe(2_000);
    expect(computeBackoffMs(1)).toBe(4_000);
    expect(computeBackoffMs(2)).toBe(8_000);
    expect(computeBackoffMs(10)).toBe(60_000);
  });
});

describe("fila de upload (IndexedDB)", () => {
  it("enfileira e lista um trecho pendente, em ordem de idx", async () => {
    await enqueueChunk(makeChunk(2));
    await enqueueChunk(makeChunk(1));

    const pending = await listPendingChunks(meetingId);
    expect(pending.map((chunk) => chunk.idx)).toEqual([1, 2]);
  });

  it("remove o trecho da fila quando o servidor confirma", async () => {
    await enqueueChunk(makeChunk(1));
    await markChunkSent(chunkKey(meetingId, 1));

    const pending = await listPendingChunks(meetingId);
    expect(pending).toHaveLength(0);
  });

  it("adia a próxima tentativa ao falhar, sem remover o trecho", async () => {
    await enqueueChunk(makeChunk(1));
    const key = chunkKey(meetingId, 1);

    await markChunkFailed(key);

    const due = await listDueChunks(meetingId, Date.now());
    expect(due).toHaveLength(0);

    const dueLater = await listDueChunks(meetingId, Date.now() + computeBackoffMs(1) + 1);
    expect(dueLater).toHaveLength(1);
    expect(dueLater[0].attempts).toBe(1);
  });

  it("resetBackoff libera os trechos pendentes para tentar imediatamente", async () => {
    await enqueueChunk(makeChunk(1));
    await markChunkFailed(chunkKey(meetingId, 1));

    await resetBackoff(meetingId);

    const due = await listDueChunks(meetingId, Date.now());
    expect(due).toHaveLength(1);
  });

  it("para de tentar sozinho depois de esgotar as tentativas automáticas, sem perder o trecho", async () => {
    const key = chunkKey(meetingId, 1);
    await enqueueChunk(makeChunk(1));
    await markChunkFailed(key); // 1
    await markChunkFailed(key); // 2
    await markChunkFailed(key); // 3 — esgotou (CHUNK_MAX_AUTO_RETRIES = 3)

    const farFuture = Date.now() + 10 * 60_000;
    expect(await listDueChunks(meetingId, farFuture)).toHaveLength(0);

    const exhausted = await listExhaustedChunks(meetingId);
    expect(exhausted).toHaveLength(1);
    expect(exhausted[0].attempts).toBe(3);

    // O áudio continua na fila — "Reenviar agora" (resetBackoff) dá outra chance.
    expect(await listPendingChunks(meetingId)).toHaveLength(1);
  });

  it("'Reenviar agora' zera as tentativas, não só o prazo — resgata um trecho esgotado", async () => {
    const key = chunkKey(meetingId, 1);
    await enqueueChunk(makeChunk(1));
    await markChunkFailed(key);
    await markChunkFailed(key);
    await markChunkFailed(key);

    await resetBackoff(meetingId);

    const due = await listDueChunks(meetingId, Date.now());
    expect(due).toHaveLength(1);
    expect(due[0].attempts).toBe(0);
  });
});
