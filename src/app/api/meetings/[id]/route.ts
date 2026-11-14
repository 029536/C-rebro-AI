import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { generateMeetingMinutes } from "@/lib/minutes/service";
import { participantsSchema } from "@/lib/participants";
import { updateProjectMemoryAfterMeeting } from "@/lib/projects/memory";
import { createClient } from "@/lib/supabase/server";

// "finish" dispara a ata sozinha, que pode sair em várias partes numa reunião
// longa (map-reduce) — folga maior, ainda dentro do teto do plano Hobby (300s).
export const maxDuration = 280;

type MeetingUpdate = Database["public"]["Tables"]["meetings"]["Update"];

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("finish") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("unarchive") }),
  z.object({
    action: z.literal("update_setup"),
    meeting_type: z.enum(["client", "internal"]).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    client_name: z.string().trim().max(200).nullable().optional(),
    participants: participantsSchema.optional(),
    context: z.string().trim().max(2000).nullable().optional(),
    project_id: z.uuid().nullable().optional(),
  }),
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
      .select("status, title")
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
      title: meeting.title,
      part_no: (latestChunk?.part_no ?? 0) + 1,
      next_idx: (latestChunk?.idx ?? -1) + 1,
    });
  }

  if (parsed.data.action === "archive" || parsed.data.action === "unarchive") {
    const { error: updateError } = await supabase
      .from("meetings")
      .update({ archived_at: parsed.data.action === "archive" ? new Date().toISOString() : null })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Não foi possível atualizar a reunião." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "update_setup") {
    const fields = parsed.data;
    const update: MeetingUpdate = {};
    if (fields.meeting_type !== undefined) update.meeting_type = fields.meeting_type;
    if (fields.title !== undefined) update.title = fields.title;
    if (fields.client_name !== undefined) update.client_name = fields.client_name;
    if (fields.participants !== undefined) update.participants = fields.participants;
    if (fields.context !== undefined) update.context = fields.context;

    if (fields.project_id !== undefined) {
      if (fields.project_id === null) {
        update.project_id = null;
      } else {
        // Só aceita o project_id se o projeto for mesmo do usuário (RLS decide isso sozinha).
        const { data: project } = await supabase
          .from("projects")
          .select("id")
          .eq("id", fields.project_id)
          .maybeSingle();
        update.project_id = project?.id ?? null;
      }
    }

    const { error: updateError } = await supabase.from("meetings").update(update).eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: "Não foi possível salvar as alterações." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // action === "finish" (também usado por "Encerrar sem gravar mais", numa reunião
  // interrompida: funciona igual, sem precisar retomar a gravação antes).
  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", id)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
  }

  // Soma dos trechos, não o relógio de parede: numa reunião que ficou "interrompida"
  // por horas antes de ser encerrada, a duração real é o áudio gravado, não o tempo
  // corrido desde o início.
  const { data: chunks } = await supabase
    .from("meeting_chunks")
    .select("audio_seconds")
    .eq("meeting_id", id);
  const durationSeconds = (chunks ?? []).reduce((sum, chunk) => sum + (chunk.audio_seconds ?? 0), 0);

  const { error: updateError } = await supabase
    .from("meetings")
    .update({
      status: "ready",
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Não foi possível encerrar a reunião." }, { status: 500 });
  }

  // Dispara a ata sozinho ao encerrar (CLAUDE.md, fluxo de dados). Não falha o
  // "Encerrar": se a geração der erro, fica registrado em `meeting_minutes`
  // (status "error") e a pessoa usa "Tentar de novo" na aba Ata.
  await generateMeetingMinutes(supabase, id);
  await updateProjectMemoryAfterMeeting(supabase, id);

  return NextResponse.json({ ok: true, duration_seconds: durationSeconds });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Não foi possível excluir a reunião." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
