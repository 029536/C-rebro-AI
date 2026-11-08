import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({ name: z.string().trim().min(1).max(200) });

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, file_count, total_bytes, imported_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Não foi possível listar os projetos." }, { status: 500 });
  }
  return NextResponse.json({ projects: data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dê um nome para o projeto." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ name: parsed.data.name })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível criar o projeto." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
