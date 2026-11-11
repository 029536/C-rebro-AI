import { NextResponse } from "next/server";
import { refreshProjectMemory } from "@/lib/projects/memory";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** "Atualizar agora": regenera a memória viva do projeto na hora, sem esperar o próximo gatilho. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const result = await refreshProjectMemory(supabase, projectId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const { data } = await supabase
    .from("project_memory")
    .select("summary, locked_note, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();

  return NextResponse.json(data ?? { summary: "", locked_note: "", updated_at: null });
}
