import { NextResponse } from "next/server";
import { z } from "zod";
import { PROJECT_FILE_MAX_BYTES } from "@/lib/config";
import { sha256Hex } from "@/lib/hash";
import { isAllowedDocumentExtension } from "@/lib/projects/filters";
import { detectSecret } from "@/lib/projects/secrets";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  documents: z
    .array(
      z.object({
        filename: z.string().trim().min(1).max(255),
        content: z.string(),
        sizeBytes: z.number().int().min(0),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const accepted: { filename: string; content: string; sizeBytes: number; hash: string }[] = [];
  const rejected: { filename: string; reason: string }[] = [];

  for (const doc of parsed.data.documents) {
    if (!isAllowedDocumentExtension(doc.filename)) {
      rejected.push({ filename: doc.filename, reason: "tipo de arquivo não suportado" });
      continue;
    }
    if (doc.sizeBytes > PROJECT_FILE_MAX_BYTES) {
      rejected.push({ filename: doc.filename, reason: "acima do limite de tamanho por documento" });
      continue;
    }
    const secretReason = detectSecret({ content: doc.content });
    if (secretReason) {
      rejected.push({ filename: doc.filename, reason: `possível segredo (${secretReason})` });
      continue;
    }
    accepted.push({ ...doc, hash: sha256Hex(doc.content) });
  }

  if (accepted.length === 0) {
    return NextResponse.json({ saved: 0, skipped: 0, rejected });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("project_documents")
    .select("filename, content_hash")
    .eq("project_id", projectId)
    .in(
      "filename",
      accepted.map((doc) => doc.filename)
    );
  const existingHashes = new Map((existing ?? []).map((row) => [row.filename, row.content_hash]));

  const toUpsert = accepted
    .filter((doc) => existingHashes.get(doc.filename) !== doc.hash)
    .map((doc) => ({
      project_id: projectId,
      filename: doc.filename,
      size_bytes: doc.sizeBytes,
      content_hash: doc.hash,
      content: doc.content,
    }));

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("project_documents")
      .upsert(toUpsert, { onConflict: "project_id,filename" });
    if (error) {
      return NextResponse.json({ error: "Não foi possível salvar os documentos." }, { status: 500 });
    }
  }

  return NextResponse.json({
    saved: toUpsert.length,
    skipped: accepted.length - toUpsert.length,
    rejected,
  });
}
