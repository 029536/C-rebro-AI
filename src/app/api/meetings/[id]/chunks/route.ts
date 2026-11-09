import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIO_CHUNK_MAX_BYTES } from "@/lib/config";
import { buildMeetingVocabulary, buildWhisperPrompt, transcribeAudio } from "@/lib/ai/transcribe";
import { describeOpenAIError } from "@/lib/ai/openai";
import { computeNextPartNo } from "@/lib/meetings";
import { participantsSchema } from "@/lib/participants";
import { createClient } from "@/lib/supabase/server";

// Transcrever um trecho de 3 minutos é rápido; 60s é folga de sobra mesmo no plano Hobby
// (que em 2026 já tem 300s de padrão). Ver CLAUDE.md sobre maxDuration nas rotas pesadas.
export const maxDuration = 60;

const fieldsSchema = z.object({
  idx: z.coerce.number().int().min(0),
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
    idx: formData.get("idx"),
    audioSeconds: formData.get("audioSeconds"),
    forcePartNo: formData.get("forcePartNo") ?? undefined,
  });
  if (!parsedFields.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { idx, audioSeconds, forcePartNo } = parsedFields.data;

  const supabase = await createClient();

  // Idempotente: se esse trecho já foi transcrito (reenvio do cliente após perder
  // a confirmação do servidor), devolve o que já existe em vez de transcrever de novo.
  const { data: existing } = await supabase
    .from("meeting_chunks")
    .select("transcript, part_no")
    .eq("meeting_id", meetingId)
    .eq("idx", idx)
    .maybeSingle();

  if (existing) {
    const { data: latest } = await supabase
      .from("meeting_chunks")
      .select("part_no")
      .eq("meeting_id", meetingId)
      .order("idx", { ascending: false })
      .limit(1)
      .maybeSingle();
    const closedPartNo = latest && latest.part_no > existing.part_no ? existing.part_no : null;
    return NextResponse.json({
      transcript: existing.transcript,
      part_no: existing.part_no,
      closed_part_no: closedPartNo,
    });
  }

  const [{ data: previousChunk }, { data: companyContext }, { data: latestChunk }, { data: meeting }] =
    await Promise.all([
      supabase
        .from("meeting_chunks")
        .select("transcript")
        .eq("meeting_id", meetingId)
        .eq("idx", idx - 1)
        .maybeSingle(),
      supabase.from("company_context").select("vocabulary").maybeSingle(),
      supabase
        .from("meeting_chunks")
        .select("part_no")
        .eq("meeting_id", meetingId)
        .order("idx", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("meetings").select("client_name, participants, context").eq("id", meetingId).maybeSingle(),
    ]);

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

  const participants = participantsSchema.safeParse(meeting?.participants ?? []);
  const vocabulary = buildMeetingVocabulary({
    companyVocabulary: companyContext?.vocabulary ?? "",
    clientName: meeting?.client_name,
    participants: participants.success ? participants.data : [],
    context: meeting?.context,
  });
  const prompt = buildWhisperPrompt(vocabulary, previousChunk?.transcript ?? "");

  let transcript: string;
  try {
    transcript = await transcribeAudio(audio, prompt);
  } catch (error) {
    return NextResponse.json({ error: describeOpenAIError(error) }, { status: 502 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("meeting_chunks")
    .insert({
      meeting_id: meetingId,
      idx,
      part_no: partNo,
      transcript,
      audio_seconds: audioSeconds,
      status: "done",
    })
    .select("transcript, part_no")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: "Não foi possível salvar o trecho." }, { status: 500 });
  }

  return NextResponse.json({
    transcript: inserted.transcript,
    part_no: inserted.part_no,
    closed_part_no: closedPartNo,
  });
}
