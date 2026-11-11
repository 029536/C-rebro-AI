import { describeAnthropicError, describeAnthropicErrorDetail, statusForAnthropicError } from "@/lib/ai/anthropic";
import { selectRecentTranscript } from "@/lib/ai/context";
import { generateOpinion } from "@/lib/ai/copilot";
import { buildMeetingContextBlock, combineCompanyContext } from "@/lib/ai/prompts";
import type { CopilotKind } from "@/lib/ai/prompts";
import { isTranscriptTooSparse } from "@/lib/minutes/rules";
import { participantsSchema } from "@/lib/participants";
import { buildProjectContextBlock } from "@/lib/projects/context";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type MeetingOpinionRow = Database["public"]["Tables"]["meeting_opinions"]["Row"];

export type GenerateOpinionResult =
  | { ok: true; skipped: false; opinion: MeetingOpinionRow }
  | { ok: true; skipped: true }
  | { ok: false; status: number; error: string; errorDetail: string | null };

/**
 * Pede uma opinião/pergunta/resposta do copiloto ("Claude opinando"). Manda
 * o resumo da parte mais recente já fechada (se houver) + só os últimos
 * minutos de transcrição (lib/ai/context.ts, selectRecentTranscript) —
 * nunca a reunião inteira, por custo numa reunião longa. Diferente da
 * ata/parecer: não tem status/erro salvos no banco (`meeting_opinions` só
 * guarda o texto) — numa falha, só devolve o erro para a tela.
 */
export async function generateMeetingOpinion(
  supabase: Supabase,
  meetingId: string,
  params: { offsetSeconds: number; kind: CopilotKind; question?: string | null }
): Promise<GenerateOpinionResult> {
  if (params.kind === "resposta" && !params.question?.trim()) {
    return { ok: false, status: 400, error: "Escreva a pergunta antes de enviar.", errorDetail: null };
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, meeting_type, client_name, participants, context, project_id")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    return { ok: false, status: 404, error: "Reunião não encontrada.", errorDetail: null };
  }

  const [{ data: chunks }, { data: companyContext }, { data: latestCheckpoint }, { data: previousOpinionRow }] =
    await Promise.all([
      supabase
        .from("meeting_chunks")
        .select("transcript, audio_seconds")
        .eq("meeting_id", meetingId)
        .order("idx", { ascending: true }),
      supabase.from("company_context").select("context, vocabulary").maybeSingle(),
      supabase
        .from("meeting_checkpoints")
        .select("summary")
        .eq("meeting_id", meetingId)
        .order("part_no", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("meeting_opinions")
        .select("text")
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
      error: "Ainda não há transcrição para opinar.",
      errorDetail: null,
    };
  }

  const fullTranscript = allChunks
    .map((chunk) => chunk.transcript.trim())
    .filter(Boolean)
    .join(" ");

  if (isTranscriptTooSparse(fullTranscript)) {
    return {
      ok: false,
      status: 422,
      error: "A transcrição ainda não tem conteúdo suficiente para uma opinião confiável.",
      errorDetail: null,
    };
  }

  const participantsParsed = participantsSchema.safeParse(meeting.participants);
  const participants = participantsParsed.success ? participantsParsed.data : [];
  const meetingContext = buildMeetingContextBlock({
    meetingType: meeting.meeting_type,
    clientName: meeting.client_name,
    participants,
    context: meeting.context,
  });

  const recentTranscript = selectRecentTranscript(
    allChunks.map((chunk) => ({ transcript: chunk.transcript, audioSeconds: chunk.audio_seconds ?? 0 }))
  );

  const projectContext = meeting.project_id
    ? await buildProjectContextBlock(supabase, meeting.project_id, recentTranscript)
    : null;

  try {
    const text = await generateOpinion({
      kind: params.kind,
      companyContext: combineCompanyContext(companyContext),
      meetingContext: meetingContext || undefined,
      summary: latestCheckpoint?.summary ?? null,
      previousOpinion: previousOpinionRow?.text ?? null,
      question: params.question,
      recentTranscript,
      projectContext,
    });

    if (!text) {
      return { ok: true, skipped: true };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("meeting_opinions")
      .insert({
        meeting_id: meetingId,
        offset_seconds: params.offsetSeconds,
        text,
        kind: params.kind,
        prompt: params.kind === "resposta" ? (params.question ?? null) : null,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      return {
        ok: false,
        status: 500,
        error: "A resposta foi gerada, mas não foi possível salvá-la.",
        errorDetail: null,
      };
    }
    return { ok: true, skipped: false, opinion: inserted };
  } catch (error) {
    return {
      ok: false,
      status: statusForAnthropicError(error),
      error: describeAnthropicError(error),
      errorDetail: describeAnthropicErrorDetail(error),
    };
  }
}
