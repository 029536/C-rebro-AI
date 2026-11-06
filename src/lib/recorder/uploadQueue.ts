// Fila de envio de trechos de áudio, persistida em IndexedDB. Um trecho só sai
// da fila quando o servidor confirmar (markChunkSent); até lá, sobrevive a
// recarregar a página ou perder a rede.

const DB_NAME = "cerebro-ia-uploads";
const DB_VERSION = 1;
const STORE = "chunks";

export type QueuedChunk = {
  key: string;
  meetingId: string;
  idx: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  audioSeconds: number;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("byMeeting", "meetingId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = run(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function chunkKey(meetingId: string, idx: number): string {
  return `${meetingId}:${idx}`;
}

export async function enqueueChunk(entry: {
  meetingId: string;
  idx: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  audioSeconds: number;
}): Promise<void> {
  const now = Date.now();
  const record: QueuedChunk = {
    ...entry,
    key: chunkKey(entry.meetingId, entry.idx),
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
  };
  await withStore("readwrite", (store) => store.put(record));
}

async function listAllForMeeting(meetingId: string): Promise<QueuedChunk[]> {
  const all = await withStore<QueuedChunk[]>("readonly", (store) => store.getAll());
  return all.filter((chunk) => chunk.meetingId === meetingId).sort((a, b) => a.idx - b.idx);
}

/** Trechos pendentes de uma reunião, para mostrar "N por enviar" na tela. */
export const listPendingChunks = listAllForMeeting;

/** Trechos pendentes cujo prazo de nova tentativa já chegou. */
export async function listDueChunks(meetingId: string, now = Date.now()): Promise<QueuedChunk[]> {
  const all = await listAllForMeeting(meetingId);
  return all.filter((chunk) => chunk.nextAttemptAt <= now);
}

export async function markChunkSent(key: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key));
}

/** Espera crescente entre tentativas: 2s, 4s, 8s, ... até um teto de 60s. */
export function computeBackoffMs(attempts: number): number {
  return Math.min(2_000 * 2 ** attempts, 60_000);
}

export async function markChunkFailed(key: string): Promise<void> {
  const current = await withStore<QueuedChunk | undefined>("readonly", (store) => store.get(key));
  if (!current) return;

  const attempts = current.attempts + 1;
  const updated: QueuedChunk = {
    ...current,
    attempts,
    nextAttemptAt: Date.now() + computeBackoffMs(attempts),
  };
  await withStore("readwrite", (store) => store.put(updated));
}

/** Zera o prazo de espera de todos os trechos pendentes (botão "Reenviar"). */
export async function resetBackoff(meetingId: string): Promise<void> {
  const all = await listAllForMeeting(meetingId);
  const now = Date.now();
  await Promise.all(
    all.map((chunk) => withStore("readwrite", (store) => store.put({ ...chunk, nextAttemptAt: now })))
  );
}
