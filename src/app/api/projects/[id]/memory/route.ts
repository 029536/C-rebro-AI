import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const patchSchema = z.object({
  locked_note: z.string().trim().max(4_000),
});

/** Edita a nota fixa da memória do projeto (a IA nunca a sobrescreve ao regenerar). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  // RLS (owns_project) garante que só o dono do projeto grava aqui.
  const { data, error } = await supabase
    .from("project_memory")
    .upsert({ project_id: projectId, locked_note: parsed.data.locked_note }, { onConflict: "project_id" })
    .select("summary, locked_note, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível salvar a nota fixa." }, { status: 500 });
  }

  return NextResponse.json(data);
}
