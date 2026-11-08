import { NextResponse } from "next/server";
import { z } from "zod";
import { PROJECT_FILE_MAX_BYTES } from "@/lib/config";
import { sha256Hex } from "@/lib/hash";
import { filterCodeFile } from "@/lib/projects/filters";
import { detectSecret } from "@/lib/projects/secrets";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().trim().min(1).max(500),
        content: z.string(),
        sizeBytes: z.number().int().min(0),
      })
    )
    .min(1)
    .max(200),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // Nunca confia só no filtro do navegador: refaz o filtro e a detecção de segredos aqui.
  const accepted: { path: string; content: string; sizeBytes: number; hash: string }[] = [];
  const rejected: { path: string; reason: string }[] = [];

  for (const file of parsed.data.files) {
    const filterResult = filterCodeFile({
      path: file.path,
      sizeBytes: file.sizeBytes,
      content: file.content,
      maxFileBytes: PROJECT_FILE_MAX_BYTES,
    });
    if (filterResult.ignore) {
      rejected.push({ path: file.path, reason: filterResult.reason ?? "ignorado" });
      continue;
    }
    const secretReason = detectSecret({ path: file.path, content: file.content });
    if (secretReason) {
      rejected.push({ path: file.path, reason: `possível segredo (${secretReason})` });
      continue;
    }
    accepted.push({ ...file, hash: sha256Hex(file.content) });
  }

  if (accepted.length === 0) {
    return NextResponse.json({ saved: 0, skipped: 0, rejected });
  }

  const supabase = await createClient();

  // content_hash igual ao que já está salvo: pula (mantém o resumo existente).
  const { data: existing } = await supabase
    .from("project_files")
    .select("path, content_hash")
    .eq("project_id", projectId)
    .in(
      "path",
      accepted.map((file) => file.path)
    );
  const existingHashes = new Map((existing ?? []).map((row) => [row.path, row.content_hash]));

  const toUpsert = accepted
    .filter((file) => existingHashes.get(file.path) !== file.hash)
    .map((file) => ({
      project_id: projectId,
      path: file.path,
      size_bytes: file.sizeBytes,
      content_hash: file.hash,
      content: file.content,
    }));

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("project_files")
      .upsert(toUpsert, { onConflict: "project_id,path" });
    if (error) {
      return NextResponse.json({ error: "Não foi possível salvar os arquivos." }, { status: 500 });
    }
  }

  return NextResponse.json({
    saved: toUpsert.length,
    skipped: accepted.length - toUpsert.length,
    rejected,
  });
}
