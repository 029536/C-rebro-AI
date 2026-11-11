import { NextResponse } from "next/server";
import { z } from "zod";
import { memoryItemTipoSchema } from "@/lib/projects/memorySchema";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  tipo: memoryItemTipoSchema,
  texto: z.string().trim().min(1).max(500),
  travado: z.boolean().optional(),
});

/** Adiciona um item manual à memória do projeto (decisão, pendência, estado ou risco). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  // RLS (owns_project) garante que só o dono do projeto grava aqui.
  const { data, error } = await supabase
    .from("project_memory_items")
    .insert({
      project_id: projectId,
      tipo: parsed.data.tipo,
      texto: parsed.data.texto,
      travado: parsed.data.travado ?? false,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível adicionar o item." }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
