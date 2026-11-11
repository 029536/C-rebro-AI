import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Busca por texto (Postgres full-text) em reuniões, atas, pareceres e tarefas. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_meetings_content", { search_query: query });

  if (error) {
    return NextResponse.json({ error: "Não foi possível pesquisar agora." }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
