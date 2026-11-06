import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIO_CHUNK_MAX_BYTES } from "@/lib/config";
import { buildWhisperPrompt, transcribeAudio } from "@/lib/ai/transcribe";
import { createClient } from "@/lib/supabase/server";

// Transcrever um trecho de 3 minutos é rápido; 60s é folga de sobra mesmo no plano Hobby
// (que em 2026 já tem 300s de padrão). Ver CLAUDE.md sobre maxDuration nas rotas pesadas.
export const maxDuration = 60;

const fieldsSchema = z.object({
  idx: z.coerce.number().int().min(0),
  audioSeconds: z.coerce.number().int().min(1),
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
  });
  if (!parsedFields.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { idx, audioSeconds } = parsedFields.data;

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
    return NextResponse.json({ transcript: existing.transcript, part_no: existing.part_no });
  }

  const [{ data: previousChunk }, { data: companyContext }] = await Promise.all([
    supabase
      .from("meeting_chunks")
      .select("transcript")
      .eq("meeting_id", meetingId)
      .eq("idx", idx - 1)
      .maybeSingle(),
    supabase.from("company_context").select("vocabulary").maybeSingle(),
  ]);

  const prompt = buildWhisperPrompt(companyContext?.vocabulary ?? "", previousChunk?.transcript ?? "");

  let transcript: string;
  try {
    transcript = await transcribeAudio(audio, prompt);
  } catch {
    return NextResponse.json({ error: "Falha ao transcrever o áudio." }, { status: 502 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("meeting_chunks")
    .insert({ meeting_id: meetingId, idx, transcript, audio_seconds: audioSeconds, status: "done" })
    .select("transcript, part_no")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: "Não foi possível salvar o trecho." }, { status: 500 });
  }

  return NextResponse.json({ transcript: inserted.transcript, part_no: inserted.part_no });
}
