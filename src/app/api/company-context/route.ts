import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const DEFAULTS = { context: "", vocabulary: "", letterhead: "", letterhead_logo: null as string | null };

// ~150 KB de imagem crua, antes de virar base64 (upload "pequeno", pedido no texto).
const MAX_LOGO_DATA_URI_CHARS = 220_000;

const patchSchema = z.object({
  context: z.string().trim().max(4_000).optional(),
  vocabulary: z.string().trim().max(2_000).optional(),
  letterhead: z.string().trim().max(1_000).optional(),
  letterhead_logo: z
    .union([z.string().trim().max(MAX_LOGO_DATA_URI_CHARS).startsWith("data:image/"), z.null()])
    .optional(),
});

/** Contexto da empresa, vocabulário e cabeçalho da ata (aba Configurações). */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_context")
    .select("context, vocabulary, letterhead, letterhead_logo")
    .maybeSingle();

  return NextResponse.json(data ?? DEFAULTS);
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos. Confira o tamanho dos campos (e da imagem)." }, { status: 400 });
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
    .from("company_context")
    .upsert({ owner_id: user.id, ...parsed.data }, { onConflict: "owner_id" })
    .select("context, vocabulary, letterhead, letterhead_logo")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível salvar as configurações." }, { status: 500 });
  }

  return NextResponse.json(data);
}
