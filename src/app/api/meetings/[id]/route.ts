import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// "resume" (retomar gravação interrompida) entra na Fase 3.
const patchSchema = z.object({
  action: z.literal("finish"),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
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
