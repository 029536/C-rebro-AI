import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: files }, { data: documents }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("project_files")
      .select("path, size_bytes, summary, updated_at")
      .eq("project_id", id)
      .order("path"),
    supabase
      .from("project_documents")
      .select("filename, size_bytes, summary, updated_at")
      .eq("project_id", id)
      .order("filename"),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ project, files: files ?? [], documents: documents ?? [] });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Não foi possível excluir o projeto." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
