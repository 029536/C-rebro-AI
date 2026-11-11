import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { taskStatusSchema } from "@/lib/plans/schema";
import { createClient } from "@/lib/supabase/server";

type DevTaskUpdate = Database["public"]["Tables"]["dev_tasks"]["Update"];

const patchSchema = z.object({
  status: taskStatusSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  progress_note: z.string().trim().max(500).optional(),
});

/** Muda o status, o título ou a nota de andamento de uma tarefa do plano. */
export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const update: DevTaskUpdate = {};
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.progress_note !== undefined) update.progress_note = parsed.data.progress_note;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const supabase = await createClient();
  // RLS (owns_meeting) já garante que só o dono da reunião consegue atualizar;
  // uma tarefa de outro usuário simplesmente não bate nenhuma linha.
  const { data, error } = await supabase
    .from("dev_tasks")
    .update(update)
    .eq("id", taskId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Não foi possível atualizar a tarefa." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  return NextResponse.json(data);
}
