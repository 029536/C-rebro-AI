import { AnthropicKeyMissingError, describeAnthropicError } from "@/lib/ai/anthropic";
import { buildContext } from "@/lib/ai/context";
import { generateMinutesContent, MinutesGenerationError } from "@/lib/ai/minutes";
import { buildMeetingContextBlock } from "@/lib/ai/prompts";
import { formatISODate, formatTime } from "@/lib/format";
import { isTranscriptTooSparse } from "@/lib/minutes/rules";
import { minutesDocumentSchema } from "@/lib/minutes/schema";
import { participantsSchema } from "@/lib/participants";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type MeetingMinutesRow = Database["public"]["Tables"]["meeting_minutes"]["Row"];

export type GenerateMinutesResult =
  | { ok: true; minutes: MeetingMinutesRow }
  | { ok: false; status: number; error: string };

/**
 * Gera (ou regenera) a ata de uma reunião e grava em `meeting_minutes`. Usada
 * tanto pelo disparo automático ao encerrar a gravação quanto pelo botão
 * "Gerar ata"/"Tentar de novo" em reuniões já prontas. Nunca lança — toda
 * falha vira `{ ok: false }` com uma mensagem em português, e o erro também
 * fica salvo na linha de `meeting_minutes` para a próxima leitura.
 */
export async function generateMeetingMinutes(
  supabase: Supabase,
  meetingId: string
): Promise<GenerateMinutesResult> {
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, status, meeting_type, client_name, participants, context, started_at")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    return { ok: false, status: 404, error: "Reunião não encontrada." };
  }
  if (meeting.status === "recording") {
    return { ok: false, status: 409, error: "Encerre a gravação antes de gerar a ata." };
  }

  const [{ data: chunks }, { data: checkpoints }, { data: companyContext }] = await Promise.all([
    supabase
      .from("meeting_chunks")
      .select("idx, part_no, transcript")
      .eq("meeting_id", meetingId)
      .order("idx", { ascending: true }),
    supabase.from("meeting_checkpoints").select("part_no, summary").eq("meeting_id", meetingId),
    supabase.from("company_context").select("context").maybeSingle(),
  ]);

  const allChunks = chunks ?? [];
  if (allChunks.length === 0) {
    return { ok: false, status: 409, error: "Essa reunião ainda não tem transcrição." };
  }

  const fullTranscript = allChunks
    .map((chunk) => chunk.transcript.trim())
    .filter(Boolean)
    .join(" ");

  // Guarda a tentativa antes de checar a transcrição e de chamar o Claude, para
  // o "Gerando ata..." e o erro aparecerem no cartão mesmo que algo falhe cedo.
  const { data: pendingRow, error: pendingError } = await supabase
    .from("meeting_minutes")
    .insert({ meeting_id: meetingId, status: "generating" })
    .select("*")
    .single();
  if (pendingError || !pendingRow) {
    return { ok: false, status: 500, error: "Não foi possível iniciar a geração da ata." };
  }

  async function fail(status: number, message: string): Promise<GenerateMinutesResult> {
    await supabase
      .from("meeting_minutes")
      .update({ status: "error", error: message })
      .eq("id", pendingRow!.id);
    return { ok: false, status, error: message };
  }

  // Regra D4: áudio mudo ou transcrição sem sentido não vira ata inventada.
  if (isTranscriptTooSparse(fullTranscript)) {
    return fail(
      422,
      "A transcrição está vazia ou não tem conteúdo suficiente para gerar uma ata confiável."
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

  const model = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

  try {
    const content = await generateMinutesContent({
      companyContext: companyContext?.context ?? "",
      meetingType: meeting.meeting_type,
      clientName: meeting.meeting_type === "internal" ? null : meeting.client_name,
      participants,
      meetingContext: meetingContext || undefined,
      date: formatISODate(meeting.started_at),
      time: formatTime(meeting.started_at),
      transcript,
    });

    const documentParsed = minutesDocumentSchema.safeParse({
      ...content,
      data: formatISODate(meeting.started_at),
      horario: formatTime(meeting.started_at),
      tipo: meeting.meeting_type,
      cliente_ou_empresa: meeting.meeting_type === "internal" ? null : meeting.client_name,
      participantes: participants,
    });
    if (!documentParsed.success) {
      return fail(502, "O Claude devolveu uma ata num formato inválido.");
    }
    const document = documentParsed.data;

    const { data: updated, error: updateError } = await supabase
      .from("meeting_minutes")
      .update({ content: document, status: "ready", error: null, model })
      .eq("id", pendingRow.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      return fail(500, "A ata foi gerada, mas não foi possível salvá-la.");
    }
    return { ok: true, minutes: updated };
  } catch (error) {
    if (error instanceof AnthropicKeyMissingError) {
      return fail(503, error.message);
    }
    const message =
      error instanceof MinutesGenerationError ? error.message : describeAnthropicError(error);
    return fail(502, message);
  }
}
