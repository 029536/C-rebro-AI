import type { createClient } from "@/lib/supabase/server";

const MAX_INSERT_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type ChunkRecord = { idx: number; transcript: string; part_no: number };

/**
 * Salva um trecho com `idx` atribuído pelo servidor, nunca pelo cliente —
 * causa real de um 409 repetido visto em produção: dois pedidos (duas abas,
 * "Continuar gravação" em duplicidade, uma retentativa sobrepondo um envio
 * ainda em andamento) podiam calcular o mesmo idx no cliente e colidir na
 * restrição única.
 *
 * Idempotente: se `clientChunkId` (o número local que o navegador já gerava)
 * já foi salvo, devolve o que já existe em vez de duplicar. Numa corrida de
 * verdade, a violação da restrição única faz o laço tentar de novo — a
 * checagem de idempotência resolve o caso de reenvio, e um `idx` recalculado
 * resolve o caso de dois pedidos disputando o mesmo próximo número.
 */
export async function saveChunk(params: {
  supabase: Supabase;
  meetingId: string;
  clientChunkId: string;
  partNo: number;
  transcript: string;
  audioSeconds: number;
}): Promise<{ row: ChunkRecord; isNew: boolean }> {
  const { supabase, meetingId, clientChunkId, partNo, transcript, audioSeconds } = params;

  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    const { data: existing } = await supabase
      .from("meeting_chunks")
      .select("idx, transcript, part_no")
      .eq("meeting_id", meetingId)
      .eq("client_chunk_id", clientChunkId)
      .maybeSingle();
    if (existing) {
      return { row: existing, isNew: false };
    }

    const { data: latest } = await supabase
      .from("meeting_chunks")
      .select("idx")
      .eq("meeting_id", meetingId)
      .order("idx", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIdx = (latest?.idx ?? -1) + 1;

    const { data: inserted, error } = await supabase
      .from("meeting_chunks")
      .insert({
        meeting_id: meetingId,
        idx: nextIdx,
        client_chunk_id: clientChunkId,
        part_no: partNo,
        transcript,
        audio_seconds: audioSeconds,
        status: "done",
      })
      .select("idx, transcript, part_no")
      .single();

    if (!error && inserted) {
      return { row: inserted, isNew: true };
    }
    if (error && error.code !== UNIQUE_VIOLATION) {
      throw error;
    }
    // Corrida (no idx ou no client_chunk_id de outro pedido concorrente):
    // tenta o laço de novo.
  }

  throw new Error("Não foi possível salvar o trecho depois de várias tentativas.");
}
