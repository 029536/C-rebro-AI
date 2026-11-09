import {
  describeAnthropicError,
  describeAnthropicErrorDetail,
  statusForAnthropicError,
} from "@/lib/ai/anthropic";
import { buildContext } from "@/lib/ai/context";
import { redactSecrets } from "@/lib/ai/env";
import { buildMeetingContextBlock } from "@/lib/ai/prompts";
import { generateReviewContent } from "@/lib/ai/review";
import { isTranscriptTooSparse } from "@/lib/minutes/rules";
import { minutesDocumentSchema } from "@/lib/minutes/schema";
import { participantsSchema } from "@/lib/participants";
import { reviewContentSchema } from "@/lib/reviews/schema";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type MeetingReviewRow = Database["public"]["Tables"]["meeting_reviews"]["Row"];

export type GenerateReviewResult =
  | { ok: true; review: MeetingReviewRow }
  | { ok: false; status: number; error: string; errorDetail: string | null };

/**
 * Gera (ou regenera, "Gerar de novo") o parecer de uma reunião e grava em
 * `meeting_reviews`. Mesmo desenho de lib/minutes/service.ts: nunca lança,
 * toda falha vira `{ ok: false }` e também fica salva na linha, para a
 * aba "Parecer da IA" mostrar o motivo.
 */
export async function generateMeetingReview(
  supabase: Supabase,
  meetingId: string
): Promise<GenerateReviewResult> {
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, status, meeting_type, client_name, participants, context, started_at")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    return { ok: false, status: 404, error: "Reunião não encontrada.", errorDetail: null };
  }
  if (meeting.status === "recording") {
    return {
      ok: false,
      status: 409,
      error: "Encerre a gravação antes de gerar o parecer.",
      errorDetail: null,
    };
  }

  const [{ data: chunks }, { data: checkpoints }, { data: companyContext }, { data: minutesRow }] =
    await Promise.all([
      supabase
        .from("meeting_chunks")
        .select("idx, part_no, transcript")
        .eq("meeting_id", meetingId)
        .order("idx", { ascending: true }),
      supabase.from("meeting_checkpoints").select("part_no, summary").eq("meeting_id", meetingId),
      supabase.from("company_context").select("context").maybeSingle(),
      supabase
        .from("meeting_minutes")
        .select("status, content")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const allChunks = chunks ?? [];
  if (allChunks.length === 0) {
    return {
      ok: false,
      status: 409,
      error: "Essa reunião ainda não tem transcrição.",
      errorDetail: null,
    };
  }

  const fullTranscript = allChunks
    .map((chunk) => chunk.transcript.trim())
    .filter(Boolean)
    .join(" ");

  const { data: pendingRow, error: pendingError } = await supabase
    .from("meeting_reviews")
    .insert({ meeting_id: meetingId, status: "generating" })
    .select("*")
    .single();
  if (pendingError || !pendingRow) {
    return {
      ok: false,
      status: 500,
      error: "Não foi possível iniciar a geração do parecer.",
      errorDetail: null,
    };
  }

  async function fail(
    status: number,
    rawMessage: string,
    rawDetail: string | null = null
  ): Promise<GenerateReviewResult> {
    const message = redactSecrets(rawMessage);
    const detail = rawDetail ? redactSecrets(rawDetail) : null;
    await supabase
      .from("meeting_reviews")
      .update({ status: "error", error: message, error_detail: detail })
      .eq("id", pendingRow!.id);
    return { ok: false, status, error: message, errorDetail: detail };
  }

  // Regra D4 (mesma da ata): áudio mudo ou transcrição sem sentido não vira parecer inventado.
  if (isTranscriptTooSparse(fullTranscript)) {
    return fail(
      422,
      "A transcrição está vazia ou não tem conteúdo suficiente para gerar um parecer confiável."
    );
  }

  const built = buildContext({
    checkpoints: (checkpoints ?? []).map((checkpoint) => ({
      partNo: checkpoint.part_no,
      summary: checkpoint.summary,
    })),
    chunks: allChunks.map((chunk) => ({
      idx: chunk.idx,
      partNo: chunk.part_no,
      transcript: chunk.transcript,
    })),
    currentPartNo: allChunks[allChunks.length - 1].part_no,
  });
  const transcript = built.checkpointsBlock
    ? `<resumos_das_partes_anteriores>\n${built.checkpointsBlock}\n</resumos_das_partes_anteriores>\n\n${built.transcriptBlock}`
    : built.transcriptBlock;

  const participantsParsed = participantsSchema.safeParse(meeting.participants);
  const participants = participantsParsed.success ? participantsParsed.data : [];
  const meetingContext = buildMeetingContextBlock({
    meetingType: meeting.meeting_type,
    clientName: meeting.client_name,
    participants,
    context: meeting.context,
  });

  const ataParsed =
    minutesRow?.status === "ready" ? minutesDocumentSchema.safeParse(minutesRow.content) : null;
  const ataFormal = ataParsed?.success ? ataParsed.data.ata_formal : null;

  const model = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

  try {
    const content = await generateReviewContent({
      companyContext: companyContext?.context ?? "",
      meetingContext: meetingContext || undefined,
      ataFormal,
      transcript,
    });

    const contentParsed = reviewContentSchema.safeParse(content);
    if (!contentParsed.success) {
      return fail(502, "O Claude devolveu um parecer num formato inválido.");
    }

    const { data: updated, error: updateError } = await supabase
      .from("meeting_reviews")
      .update({ content: contentParsed.data, status: "ready", error: null, model })
      .eq("id", pendingRow.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      return fail(500, "O parecer foi gerado, mas não foi possível salvá-lo.");
    }
    return { ok: true, review: updated };
  } catch (error) {
    return fail(
      statusForAnthropicError(error),
      describeAnthropicError(error),
      describeAnthropicErrorDetail(error)
    );
  }
}
