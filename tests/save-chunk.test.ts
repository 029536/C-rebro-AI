import { describe, expect, it } from "vitest";
import { saveChunk } from "@/lib/chunks/service";

type Row = { meeting_id: string; client_chunk_id: string; idx: number; transcript: string; part_no: number };

/**
 * Stub mínimo de meeting_chunks: guarda linhas em memória e simula a
 * restrição única (meeting_id, idx) — usado para provar que saveChunk nunca
 * confia no idx do cliente e sempre resolve uma corrida tentando de novo.
 */
function makeChunksStub(initialRows: Row[] = []) {
  const rows: Row[] = [...initialRows];
  const insertedIdxCalls: number[] = [];
  // Simula outro pedido concorrente inserindo exatamente no idx que este
  // pedido ia tentar, bem antes do INSERT desta chamada — assim o insert
  // real do teste colide de verdade com a restrição única simulada abaixo.
  let injectConcurrentRowAtIdx: number | null = null;

  function selectQuery(filters: Record<string, unknown>, sortDescByIdx: boolean) {
    return {
      maybeSingle: async () => {
        let matches = rows.filter((row) =>
          Object.entries(filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value)
        );
        if (sortDescByIdx) {
          matches = [...matches].sort((a, b) => b.idx - a.idx);
        }
        return { data: matches[0] ?? null };
      },
    };
  }

  const supabase = {
    from(table: string) {
      if (table !== "meeting_chunks") throw new Error(`tabela inesperada no teste: ${table}`);
      return {
        select() {
          const filters: Record<string, unknown> = {};
          let sortDescByIdx = false;
          const builder = {
            eq(column: string, value: unknown) {
              filters[column] = value;
              return builder;
            },
            order() {
              sortDescByIdx = true;
              return builder;
            },
            limit() {
              return builder;
            },
            maybeSingle: () => selectQuery(filters, sortDescByIdx).maybeSingle(),
          };
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                single: async () => {
                  const idx = payload.idx as number;
                  insertedIdxCalls.push(idx);

                  if (injectConcurrentRowAtIdx === idx) {
                    injectConcurrentRowAtIdx = null;
                    // Simula o pedido concorrente que de fato ocupou esse idx
                    // entre o cálculo e o insert deste pedido — por isso a
                    // nova tentativa do laço vai ver esse idx como ocupado.
                    rows.push({
                      meeting_id: payload.meeting_id as string,
                      client_chunk_id: "outro-pedido-concorrente",
                      idx,
                      transcript: "trecho de outro pedido",
                      part_no: payload.part_no as number,
                    });
                    return {
                      data: null,
                      error: { code: "23505", message: "duplicate key value violates unique constraint" },
                    };
                  }
                  const collides = rows.some(
                    (row) => row.meeting_id === payload.meeting_id && row.idx === idx
                  );
                  if (collides) {
                    return {
                      data: null,
                      error: { code: "23505", message: "duplicate key value violates unique constraint" },
                    };
                  }
                  const row = payload as unknown as Row;
                  rows.push(row);
                  return { data: { idx: row.idx, transcript: row.transcript, part_no: row.part_no }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    supabase,
    rows,
    insertedIdxCalls,
    forceConflictOnNextInsertAt(idx: number) {
      injectConcurrentRowAtIdx = idx;
    },
  };
}

const BASE = { meetingId: "11111111-1111-1111-1111-111111111111", partNo: 1, audioSeconds: 30 };

describe("saveChunk", () => {
  it("atribui idx 0 ao primeiro trecho de uma reunião nova", async () => {
    const { supabase } = makeChunksStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await saveChunk({ supabase: supabase as any, ...BASE, clientChunkId: "0", transcript: "oi" });
    expect(result.row.idx).toBe(0);
    expect(result.isNew).toBe(true);
  });

  it("atribui idx sequencial, sempre decidido pelo servidor", async () => {
    const { supabase, rows } = makeChunksStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveChunk({ supabase: supabase as any, ...BASE, clientChunkId: "0", transcript: "um" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await saveChunk({ supabase: supabase as any, ...BASE, clientChunkId: "1", transcript: "dois" });
    expect(second.row.idx).toBe(1);
    expect(rows).toHaveLength(2);
  });

  it("reenvio do mesmo client_chunk_id é idempotente: devolve o trecho já salvo, sem duplicar", async () => {
    const { supabase, rows } = makeChunksStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = await saveChunk({ supabase: supabase as any, ...BASE, clientChunkId: "5", transcript: "texto original" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resend = await saveChunk({ supabase: supabase as any, ...BASE, clientChunkId: "5", transcript: "não devia usar isto" });

    expect(resend.isNew).toBe(false);
    expect(resend.row.idx).toBe(first.row.idx);
    expect(resend.row.transcript).toBe("texto original");
    expect(rows).toHaveLength(1);
  });

  it("numa corrida de idx (dois client_chunk_id diferentes disputando o mesmo próximo número), tenta de novo e os dois são salvos sem colidir", async () => {
    const { supabase, forceConflictOnNextInsertAt, rows } = makeChunksStub();
    // Força a primeira tentativa de inserir no idx 0 a colidir (simulando um
    // pedido concorrente que já ocupou esse idx entre o cálculo e o insert).
    forceConflictOnNextInsertAt(0);

    const result = await saveChunk({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      ...BASE,
      clientChunkId: "race",
      transcript: "sobrevive à corrida",
    });

    // Recalculou e usou o próximo idx livre (1, já que o 0 foi ocupado pelo
    // pedido concorrente simulado) — nunca insiste cegamente no idx antigo.
    expect(result.row.idx).toBe(1);
    expect(rows).toHaveLength(2);
  });
});
