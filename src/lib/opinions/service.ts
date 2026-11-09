import { describeAnthropicError, describeAnthropicErrorDetail, statusForAnthropicError } from "@/lib/ai/anthropic";
import { generateOpinion } from "@/lib/ai/copilot";
import { buildMeetingContextBlock } from "@/lib/ai/prompts";
import { isTranscriptTooSparse } from "@/lib/minutes/rules";
import { participantsSchema } from "@/lib/participants";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type MeetingOpinionRow = Database["public"]["Tables"]["meeting_opinions"]["Row"];

const MAX_PREVIOUS_OPINIONS = 8;

export type GenerateOpinionResult =
  | { ok: true; skipped: false; opinion: MeetingOpinionRow }
  | { ok: true; skipped: true }
  | { ok: false; status: number; error: string; errorDetail: string | null };

/**
 * Pede uma opinião do copiloto ("Claude opinando") a partir da transcrição
 * acumulada até agora. Diferente da ata/parecer: não tem status/erro salvos
 * no banco (`meeting_opinions` só guarda o texto) — numa falha, só devolve
 * o erro para a tela, sem gravar nada; e quando o Claude não tem nada a
 * acrescentar (COPILOT_NO_CONTRIBUTION), não salva e devolve `skipped: true`.
 */
export async function generateMeetingOpinion(
  supabase: Supabase,
  meetingId: string,
  offsetSeconds: number
): Promise<GenerateOpinionResult> {
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, meeting_type, client_name, participants, context")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    return { ok: false, status: 404, error: "Reunião não encontrada.", errorDetail: null };
  }

  const [{ data: chunks }, { data: companyContext }, { data: previousOpinions }] = await Promise.all([
    supabase
      .from("meeting_chunks")
      .select("transcript")
      .eq("meeting_id", meetingId)
      .order("idx", { ascending: true }),
    supabase.from("company_context").select("context").maybeSingle(),
    supabase
      .from("meeting_opinions")
      .select("text")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false })
      .limit(MAX_PREVIOUS_OPINIONS),
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

  try {
    const text = await generateOpinion({
      companyContext: companyContext?.context ?? "",
      meetingContext: meetingContext || undefined,
      previousOpinions: (previousOpinions ?? []).map((row) => row.text).reverse(),
      transcript: fullTranscript,
    });

    if (!text) {
      return { ok: true, skipped: true };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("meeting_opinions")
      .insert({ meeting_id: meetingId, offset_seconds: offsetSeconds, text })
      .select("*")
      .single();

    if (insertError || !inserted) {
      return {
        ok: false,
        status: 500,
        error: "A opinião foi gerada, mas não foi possível salvá-la.",
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
