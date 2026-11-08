import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultMeetingTitle } from "@/lib/meetings";
import { participantsSchema } from "@/lib/participants";
import { createClient } from "@/lib/supabase/server";

const createMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  meeting_type: z.enum(["client", "internal"]).optional(),
  client_name: z.string().trim().max(200).optional(),
  participants: participantsSchema.optional(),
  context: z.string().trim().max(2000).optional(),
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
    .insert({
      title: parsed.data.title?.trim() || defaultMeetingTitle(),
      meeting_type: parsed.data.meeting_type ?? "client",
      client_name: parsed.data.client_name || null,
      participants: parsed.data.participants ?? [],
      context: parsed.data.context || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível criar a reunião." }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
