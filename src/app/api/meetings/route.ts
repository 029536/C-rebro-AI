import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { defaultMeetingTitle } from "@/lib/meetings";

const createMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  // project_id é aceito desde já (ver PROMPT_INICIAL.md), mas a coluna só existe
  // a partir da migração 0003 (Fase 7); por ora o valor é ignorado.
  project_id: z.uuid().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = createMeetingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .insert({ title: parsed.data.title?.trim() || defaultMeetingTitle() })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível criar a reunião." }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
