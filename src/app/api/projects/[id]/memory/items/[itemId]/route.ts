import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type MemoryItemUpdate = Database["public"]["Tables"]["project_memory_items"]["Update"];

const patchSchema = z.object({
  texto: z.string().trim().min(1).max(500).optional(),
  travado: z.boolean().optional(),
  resolvido: z.boolean().optional(),
});

/** Edita texto, trava/destrava ou marca resolvido um item da memória do projeto. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const update: MemoryItemUpdate = { ...parsed.data };
  const supabase = await createClient();
  // RLS (owns_project) garante que só o dono do projeto grava aqui.
  const { data, error } = await supabase
    .from("project_memory_items")
    .update(update)
    .eq("id", itemId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Não foi possível atualizar o item." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  return NextResponse.json(data);
}

/** Exclui um item da memória do projeto. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("project_memory_items").delete().eq("id", itemId);
  if (error) {
    return NextResponse.json({ error: "Não foi possível excluir o item." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
