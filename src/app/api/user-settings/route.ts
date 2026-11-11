import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const DEFAULTS = { default_auto_opine: false, chunk_seconds: 27 };

const patchSchema = z.object({
  default_auto_opine: z.boolean().optional(),
  chunk_seconds: z.number().int().min(15).max(60).optional(),
});

/** Configurações simples do usuário (Perfil): padrão do "Opinar automaticamente" e intervalo dos trechos. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("default_auto_opine, chunk_seconds")
    .maybeSingle();

  return NextResponse.json(data ?? DEFAULTS);
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ owner_id: user.id, ...parsed.data }, { onConflict: "owner_id" })
    .select("default_auto_opine, chunk_seconds")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível salvar as configurações." }, { status: 500 });
  }

  return NextResponse.json(data);
}
