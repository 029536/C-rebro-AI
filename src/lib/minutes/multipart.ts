// Orquestra a ata em partes (map-reduce, CLAUDE.md) para reuniões longas:
// divide a transcrição, gera cada parte em paralelo (limite de concorrência),
// salva o resultado de cada uma (pra "Tentar de novo" refazer só as que
// falharam) e fecha com uma chamada pequena só com os resumos.

import { generateMinutesContent } from "@/lib/ai/minutes";
import {
  generateMinutesFinalFields,
  generateMinutesPartContent,
  generatePartQuickSummary,
} from "@/lib/ai/minutesParts";
import { splitTranscriptIntoChunks } from "@/lib/ai/textChunking";
import { mapWithConcurrencyLimit } from "@/lib/concurrency";
import { MINUTES_PART_CONCURRENCY_LIMIT } from "@/lib/config";
import { redactSecrets, ExpectedAIError } from "@/lib/ai/env";
import { mergeMinutesParts } from "@/lib/minutes/mergeParts";
import { minutesPartContentSchema, type MinutesContent } from "@/lib/minutes/schema";
import { formatParticipant, type Participant } from "@/lib/participants";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type MinutesPartRow = Database["public"]["Tables"]["meeting_minutes_parts"]["Row"];

/** Uma ou mais partes da ata não puderam ser geradas, mesmo depois de tentar — mas as que deram certo ficam salvas. */
export class MultipartMinutesError extends ExpectedAIError {}

export type GenerateMinutesAutoParams = {
  companyContext: string;
  meetingType: "client" | "internal";
  clientName: string | null;
  participants: Participant[];
  meetingContext?: string;
  date: string;
  time: string;
  transcript: string;
};

/**
 * Gera o conteúdo da ata: chamada única para reuniões que cabem inteiras
 * (ver `splitTranscriptIntoChunks`), ou em partes (map-reduce) para
 * reuniões longas — nesse caso, com persistência por parte em
 * `meeting_minutes_parts` para retomar só o que falhou.
 */
export async function generateMinutesContentAuto(
  supabase: Supabase,
  minutesId: string,
  meetingId: string,
  params: GenerateMinutesAutoParams
): Promise<MinutesContent> {
  const chunks = splitTranscriptIntoChunks(params.transcript);

  if (chunks.length <= 1) {
    return generateMinutesContent(params);
  }

  await ensurePartsExist(supabase, meetingId, minutesId, chunks.length);
  let partRows = await fetchParts(supabase, minutesId);

  // Resumos rápidos (CLAUDE_FAST_MODEL): só para quem ainda não tem — dá contexto
  // às partes seguintes sem reenviar a transcrição inteira de novo.
  await Promise.all(
    partRows.map(async (row) => {
      if (row.quick_summary) return;
      const summary = await generatePartQuickSummary(chunks[row.part_index]);
      await supabase.from("meeting_minutes_parts").update({ quick_summary: summary }).eq("id", row.id);
      row.quick_summary = summary;
    })
  );

  const pending = partRows.filter((row) => row.status !== "ready");

  await mapWithConcurrencyLimit(pending, MINUTES_PART_CONCURRENCY_LIMIT, async (row) => {
    await supabase.from("meeting_minutes_parts").update({ status: "generating" }).eq("id", row.id);
    try {
      const previousSummaries = partRows
        .filter((other) => other.part_index < row.part_index)
        .map((other) => other.quick_summary)
        .filter((summary): summary is string => Boolean(summary));

      const content = await generateMinutesPartContent({
        companyContext: params.companyContext,
        meetingContext: params.meetingContext,
        partNumber: row.part_index + 1,
        totalParts: chunks.length,
        previousPartsSummaryBlock: previousSummaries.length > 0 ? previousSummaries.join("\n\n") : null,
        transcriptChunk: chunks[row.part_index],
      });

      await supabase
        .from("meeting_minutes_parts")
        .update({ status: "ready", content, error: null })
        .eq("id", row.id);
      row.status = "ready";
    } catch (error) {
      // Nunca o texto da reunião: só a mensagem segura do erro, com o detalhe
      // (campo e motivo da validação — nunca o valor) quando existir, para
      // "2 de 3 partes falharam" não virar a única informação disponível.
      const baseMessage = error instanceof Error ? error.message : String(error);
      const detail = error instanceof ExpectedAIError && error.detail ? ` (${error.detail})` : "";
      const message = redactSecrets(`${baseMessage}${detail}`);
      await supabase.from("meeting_minutes_parts").update({ status: "error", error: message }).eq("id", row.id);
      row.status = "error";
      row.error = message;
    }
  });

  partRows = await fetchParts(supabase, minutesId);
  const failed = partRows.filter((row) => row.status !== "ready");
  if (failed.length > 0) {
    throw new MultipartMinutesError(
      `${failed.length} de ${partRows.length} parte(s) da ata não puderam ser geradas. As partes que deram certo ficam salvas — "Tentar de novo" refaz só as que faltam.`,
      failed.map((row) => `parte ${row.part_index + 1}: ${row.error ?? "motivo desconhecido"}`).join(" · ")
    );
  }

  const ordered = [...partRows].sort((a, b) => a.part_index - b.part_index);
  const orderedContents = ordered.map((row) => minutesPartContentSchema.parse(row.content));
  const merged = mergeMinutesParts(orderedContents);

  const summariesBlock = ordered.map((row) => `Parte ${row.part_index + 1}: ${row.quick_summary ?? ""}`).join("\n\n");

  const finalFields = await generateMinutesFinalFields({
    companyContext: params.companyContext,
    meetingContext: params.meetingContext,
    partSummariesBlock: summariesBlock,
  });

  const ataFormal = buildAtaFormal({
    titulo: finalFields.titulo,
    date: params.date,
    time: params.time,
    meetingType: params.meetingType,
    clientName: params.clientName,
    participants: params.participants,
    body: merged.body,
    resumoExecutivo: finalFields.resumo_executivo,
    observacoes: finalFields.observacoes,
    proximosEncontros: finalFields.proximos_encontros,
  });

  return {
    titulo: finalFields.titulo,
    resumo_executivo: finalFields.resumo_executivo,
    observacoes: finalFields.observacoes,
    proximos_encontros: finalFields.proximos_encontros,
    assuntos_discutidos: merged.assuntos_discutidos,
    decisoes: merged.decisoes,
    responsabilidades: merged.responsabilidades,
    acoes_futuras: merged.acoes_futuras,
    ata_formal: ataFormal,
  };
}

/**
 * Cria as linhas de parte que ainda não existem para `minutesId` — herdando
 * partes já prontas de uma tentativa anterior da MESMA reunião (mesmo
 * `part_index`), para "Tentar de novo" não refazer o que já deu certo.
 */
async function ensurePartsExist(
  supabase: Supabase,
  meetingId: string,
  minutesId: string,
  totalParts: number
): Promise<void> {
  const { data: existingRows } = await supabase
    .from("meeting_minutes_parts")
    .select("part_index")
    .eq("minutes_id", minutesId);
  const existingIndexes = new Set((existingRows ?? []).map((row) => row.part_index));
  if (existingIndexes.size >= totalParts) return;

  const { data: previousReadyRows } = await supabase
    .from("meeting_minutes_parts")
    .select("part_index, content, quick_summary")
    .eq("meeting_id", meetingId)
    .neq("minutes_id", minutesId)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  const inheritedByIndex = new Map<number, { content: Database["public"]["Tables"]["meeting_minutes_parts"]["Row"]["content"]; quick_summary: string | null }>();
  for (const row of previousReadyRows ?? []) {
    if (!inheritedByIndex.has(row.part_index)) {
      inheritedByIndex.set(row.part_index, { content: row.content, quick_summary: row.quick_summary });
    }
  }

  const rowsToInsert: Database["public"]["Tables"]["meeting_minutes_parts"]["Insert"][] = [];
  for (let index = 0; index < totalParts; index++) {
    if (existingIndexes.has(index)) continue;
    const inherited = inheritedByIndex.get(index);
    rowsToInsert.push({
      meeting_id: meetingId,
      minutes_id: minutesId,
      part_index: index,
      status: inherited ? "ready" : "pending",
      content: inherited?.content ?? null,
      quick_summary: inherited?.quick_summary ?? null,
    });
  }
  if (rowsToInsert.length > 0) {
    await supabase.from("meeting_minutes_parts").insert(rowsToInsert);
  }
}

async function fetchParts(supabase: Supabase, minutesId: string): Promise<MinutesPartRow[]> {
  const { data } = await supabase
    .from("meeting_minutes_parts")
    .select("*")
    .eq("minutes_id", minutesId)
    .order("part_index", { ascending: true });
  return data ?? [];
}

/**
 * Monta o `ata_formal` final: cabeçalho e fechamento montados aqui, com os
 * fatos confirmados pelo servidor (nunca pela IA — regras D1-D3), e o corpo
 * é o texto de cada parte, já unido por `mergeMinutesParts`.
 */
function buildAtaFormal(params: {
  titulo: string;
  date: string;
  time: string;
  meetingType: "client" | "internal";
  clientName: string | null;
  participants: Participant[];
  body: string;
  resumoExecutivo: string;
  observacoes: string | null;
  proximosEncontros: { data?: string | null; objetivo: string }[];
}): string {
  const participantsLine =
    params.participants.length > 0
      ? `Participantes: ${params.participants.map(formatParticipant).join(", ")}`
      : "Participantes: não informados";
  const clientLine =
    params.meetingType === "internal"
      ? "Tipo: reunião interna"
      : `Cliente ou empresa: ${params.clientName ?? "não informado"}`;

  const lines = [
    "ATA DE REUNIÃO",
    "",
    `Título: ${params.titulo}`,
    `Data: ${params.date}, ${params.time}`,
    clientLine,
    participantsLine,
    "",
    "Resumo executivo:",
    params.resumoExecutivo,
    "",
    params.body,
  ];

  if (params.observacoes) {
    lines.push("", "Observações:", params.observacoes);
  }
  if (params.proximosEncontros.length > 0) {
    lines.push("", "Próximos encontros:");
    for (const encontro of params.proximosEncontros) {
      lines.push(`- ${encontro.data ? `${encontro.data}: ` : ""}${encontro.objetivo}`);
    }
  }

  return lines.join("\n");
}
