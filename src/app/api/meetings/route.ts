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
  // Reuniões das quais esta "parte" (memória entre reuniões, Fase 2.8). Só vira
  // ligação de verdade para as que realmente pertencem ao usuário (RLS cuida disso).
  previous_meeting_ids: z.array(z.uuid()).max(20).optional(),
  // project_id é aceito desde já (ver PROMPT_INICIAL.md), mas a coluna só existe
  // a partir da migração 0007 (Fase 3.6); por ora o valor é ignorado.
  project_id: z.uuid().optional(),
});

/** Reuniões já encerradas, para o seletor "Partir de reuniões anteriores". */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, started_at, client_name")
    .in("status", ["ready", "analyzed"])
    .is("archived_at", null)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Não foi possível listar as reuniões." }, { status: 500 });
  }

  return NextResponse.json({ meetings: data });
}

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

  if (parsed.data.previous_meeting_ids && parsed.data.previous_meeting_ids.length > 0) {
    // A RLS só deixa ver (e portanto ligar) reuniões do próprio usuário: ids de
    // outra pessoa somem aqui, em vez de dar erro.
    const { data: owned } = await supabase
      .from("meetings")
      .select("id")
      .in("id", parsed.data.previous_meeting_ids);

    const links = (owned ?? []).map((meeting) => ({
      meeting_id: data.id,
      previous_meeting_id: meeting.id,
    }));
    if (links.length > 0) {
      await supabase.from("meeting_links").insert(links);
    }
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
