import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("finish") }),
  z.object({ action: z.literal("resume") }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();

  if (parsed.data.action === "resume") {
    const { data: meeting, error: fetchError } = await supabase
      .from("meetings")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError || !meeting) {
      return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
    }
    if (meeting.status !== "recording") {
      return NextResponse.json({ error: "Essa reunião já foi encerrada." }, { status: 409 });
    }

    const { data: latestChunk } = await supabase
      .from("meeting_chunks")
      .select("idx, part_no")
      .eq("meeting_id", id)
      .order("idx", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Não grava nada: só informa o cliente de onde continuar. Quem abre a nova
    // parte de fato é o próximo envio de trecho, com `forcePartNo`.
    return NextResponse.json({
      part_no: (latestChunk?.part_no ?? 0) + 1,
      next_idx: (latestChunk?.idx ?? -1) + 1,
    });
  }

  // action === "finish"
  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("started_at")
    .eq("id", id)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
  }

  const endedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - new Date(meeting.started_at).getTime()) / 1000)
  );

  const { error: updateError } = await supabase
    .from("meetings")
    .update({
      status: "ready",
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Não foi possível encerrar a reunião." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, duration_seconds: durationSeconds });
}
