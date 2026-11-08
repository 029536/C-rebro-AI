import { NextResponse } from "next/server";
import { z } from "zod";
import { PROJECT_MAX_FILES } from "@/lib/config";
import { buildRepoMap } from "@/lib/projects/repoMap";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  // Lista completa (não só os novos) do que deve existir depois desta importação —
  // é assim que sabemos o que sumiu numa reimportação.
  codePaths: z.array(z.string()).max(PROJECT_MAX_FILES),
  documentFilenames: z.array(z.string()).max(PROJECT_MAX_FILES),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();

  const [{ data: existingFiles }, { data: existingDocuments }] = await Promise.all([
    supabase.from("project_files").select("path").eq("project_id", projectId),
    supabase.from("project_documents").select("filename").eq("project_id", projectId),
  ]);

  const keepPaths = new Set(parsed.data.codePaths);
  const stalePaths = (existingFiles ?? []).map((file) => file.path).filter((path) => !keepPaths.has(path));
  const keepFilenames = new Set(parsed.data.documentFilenames);
  const staleFilenames = (existingDocuments ?? [])
    .map((doc) => doc.filename)
    .filter((filename) => !keepFilenames.has(filename));

  await Promise.all([
    stalePaths.length > 0
      ? supabase.from("project_files").delete().eq("project_id", projectId).in("path", stalePaths)
      : null,
    staleFilenames.length > 0
      ? supabase.from("project_documents").delete().eq("project_id", projectId).in("filename", staleFilenames)
      : null,
  ]);

  const [{ data: files }, { data: fileSizes }, { data: documentSizes }] = await Promise.all([
    supabase.from("project_files").select("path, content").eq("project_id", projectId),
    supabase.from("project_files").select("size_bytes").eq("project_id", projectId),
    supabase.from("project_documents").select("size_bytes").eq("project_id", projectId),
  ]);

  const repoMap = buildRepoMap((files ?? []).map((file) => ({ path: file.path, content: file.content })));
  const totalBytes = [...(fileSizes ?? []), ...(documentSizes ?? [])].reduce(
    (sum, row) => sum + row.size_bytes,
    0
  );

  const { error } = await supabase
    .from("projects")
    .update({
      repo_map: repoMap,
      file_count: (files ?? []).length,
      total_bytes: totalBytes,
      imported_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    return NextResponse.json({ error: "Não foi possível finalizar a importação." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, file_count: (files ?? []).length, total_bytes: totalBytes });
}
