import { NextResponse } from "next/server";
import { z } from "zod";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";
import { generateCheckpoint } from "@/lib/ai/checkpoint";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({ part_no: z.coerce.number().int().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { part_no: partNo } = parsed.data;

  const supabase = await createClient();

  // Imutável e idempotente: se já existe checkpoint dessa parte, devolve o existente.
  const { data: existing } = await supabase
    .from("meeting_checkpoints")
    .select("*")
    .eq("meeting_id", meetingId)
    .eq("part_no", partNo)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(existing);
  }

  const { data: chunks } = await supabase
    .from("meeting_chunks")
    .select("idx, transcript")
    .eq("meeting_id", meetingId)
    .eq("part_no", partNo)
    .order("idx", { ascending: true });

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ error: "Essa parte ainda não tem trechos." }, { status: 409 });
  }

  const [{ data: previousCheckpoint }, { data: companyContext }] = await Promise.all([
    supabase
      .from("meeting_checkpoints")
      .select("summary")
      .eq("meeting_id", meetingId)
      .eq("part_no", partNo - 1)
      .maybeSingle(),
    supabase.from("company_context").select("context").maybeSingle(),
  ]);

  const transcript = chunks
    .map((chunk) => chunk.transcript.trim())
    .filter(Boolean)
    .join(" ");

  let summary: string;
  try {
    summary = await generateCheckpoint({
      companyContext: companyContext?.context ?? "",
      previousSummary: previousCheckpoint?.summary ?? null,
      transcript,
    });
  } catch (error) {
    if (error instanceof AnthropicKeyMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: "Falha ao gerar o checkpoint." }, { status: 502 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("meeting_checkpoints")
    .insert({
      meeting_id: meetingId,
      part_no: partNo,
      from_chunk_idx: chunks[0].idx,
      to_chunk_idx: chunks[chunks.length - 1].idx,
      summary,
    })
    .select("*")
    .single();

  if (insertError) {
    // Corrida: outra chamada inseriu entre a checagem e agora. Devolve a existente
    // (o checkpoint nunca é reescrito).
    const { data: race } = await supabase
      .from("meeting_checkpoints")
      .select("*")
      .eq("meeting_id", meetingId)
      .eq("part_no", partNo)
      .maybeSingle();
    if (race) return NextResponse.json(race);
    return NextResponse.json({ error: "Não foi possível salvar o checkpoint." }, { status: 500 });
  }

  return NextResponse.json(inserted);
}
