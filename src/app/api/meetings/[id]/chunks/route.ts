import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIO_CHUNK_MAX_BYTES } from "@/lib/config";
import { buildMeetingVocabulary, buildWhisperPrompt, transcribeAudio } from "@/lib/ai/transcribe";
import { describeOpenAIError } from "@/lib/ai/openai";
import { saveChunk } from "@/lib/chunks/service";
import { computeNextPartNo } from "@/lib/meetings";
import { participantsSchema } from "@/lib/participants";
import { createClient } from "@/lib/supabase/server";

// Transcrever um trecho de 3 minutos é rápido; 60s é folga de sobra mesmo no plano Hobby
// (que em 2026 já tem 300s de padrão). Ver CLAUDE.md sobre maxDuration nas rotas pesadas.
export const maxDuration = 60;

const fieldsSchema = z.object({
  // Número local que o navegador já gera, sequencial por reunião (ver
  // Recorder.tsx/nextIdxRef). Não é mais usado como idx de armazenamento —
  // é só a chave de idempotência: o mesmo valor reenviado devolve o trecho
  // já salvo, em vez de duplicar. O idx de verdade quem decide é o servidor
  // (lib/chunks/service.ts, saveChunk), para nunca depender de o cliente
  // numerar certo numa corrida (duas abas, "Continuar gravação" em
  // duplicidade etc.).
  clientChunkId: z.coerce.string().min(1).max(100),
  audioSeconds: z.coerce.number().int().min(1),
  // Enviado só no primeiro trecho depois de "Continuar gravação" (ver action "resume").
  forcePartNo: z.coerce.number().int().min(1).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Áudio ausente." }, { status: 400 });
  }

  if (audio.size > AUDIO_CHUNK_MAX_BYTES) {
    return NextResponse.json({ error: "Trecho de áudio muito grande." }, { status: 413 });
  }

  const parsedFields = fieldsSchema.safeParse({
    // Aceita o nome de campo antigo ("idx") para não exigir trocar o cliente
    // no mesmo instante que o servidor: mesma informação, novo papel.
    clientChunkId: formData.get("clientChunkId") ?? formData.get("idx"),
    audioSeconds: formData.get("audioSeconds"),
    forcePartNo: formData.get("forcePartNo") ?? undefined,
  });
  if (!parsedFields.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { clientChunkId, audioSeconds, forcePartNo } = parsedFields.data;

  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("client_name, participants, context")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) {
    return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
  }

  const [{ data: latestChunk }, { data: companyContext }, { data: existingByClientId }] = await Promise.all([
    supabase
      .from("meeting_chunks")
      .select("idx, part_no")
      .eq("meeting_id", meetingId)
      .order("idx", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("company_context").select("vocabulary").maybeSingle(),
    supabase
      .from("meeting_chunks")
      .select("idx, part_no, transcript")
      .eq("meeting_id", meetingId)
      .eq("client_chunk_id", clientChunkId)
      .maybeSingle(),
  ]);

  // Reenvio do mesmo trecho (o cliente não recebeu a confirmação da vez
  // anterior): devolve o que já existe, sem transcrever nem gravar de novo.
  if (existingByClientId) {
    const closedPartNo =
      latestChunk && latestChunk.part_no > existingByClientId.part_no ? existingByClientId.part_no : null;
    return NextResponse.json({
      transcript: existingByClientId.transcript,
      part_no: existingByClientId.part_no,
      closed_part_no: closedPartNo,
    });
  }

  const currentPartNo = latestChunk?.part_no ?? 1;
  const { data: partChunks } = await supabase
    .from("meeting_chunks")
    .select("audio_seconds")
    .eq("meeting_id", meetingId)
    .eq("part_no", currentPartNo);
  const currentPartSeconds = (partChunks ?? []).reduce(
    (sum, chunk) => sum + (chunk.audio_seconds ?? 0),
    0
  );

  const { partNo, closedPartNo } = computeNextPartNo({
    currentPartNo,
    currentPartSeconds,
    newChunkSeconds: audioSeconds,
    forceNewPartAtLeast: forcePartNo,
  });

  const { data: previousChunk } =
    latestChunk != null
      ? await supabase
          .from("meeting_chunks")
          .select("transcript")
          .eq("meeting_id", meetingId)
          .eq("idx", latestChunk.idx)
          .maybeSingle()
      : { data: null };

  const participants = participantsSchema.safeParse(meeting.participants);
  const vocabulary = buildMeetingVocabulary({
    companyVocabulary: companyContext?.vocabulary ?? "",
    clientName: meeting.client_name,
    participants: participants.success ? participants.data : [],
    context: meeting.context,
  });
  const prompt = buildWhisperPrompt(vocabulary, previousChunk?.transcript ?? "");

  let transcript: string;
  try {
    transcript = await transcribeAudio(audio, prompt);
  } catch (error) {
    return NextResponse.json({ error: describeOpenAIError(error) }, { status: 502 });
  }

  try {
    const { row } = await saveChunk({
      supabase,
      meetingId,
      clientChunkId,
      partNo,
      transcript,
      audioSeconds,
    });
    return NextResponse.json({
      transcript: row.transcript,
      part_no: row.part_no,
      closed_part_no: closedPartNo,
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar o trecho." }, { status: 500 });
  }
}
