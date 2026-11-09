import { NextResponse } from "next/server";
import { describeAnthropicError, statusForAnthropicError } from "@/lib/ai/anthropic";
import { generateDocumentSummaries, generateFileSummaries } from "@/lib/ai/summarize";
import { PROJECT_SUMMARIZE_BATCH_SIZE } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const [{ data: files }, { data: documents }] = await Promise.all([
    supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", projectId)
      .is("summary", null)
      .limit(PROJECT_SUMMARIZE_BATCH_SIZE),
    supabase
      .from("project_documents")
      .select("filename, content")
      .eq("project_id", projectId)
      .is("summary", null)
      .limit(PROJECT_SUMMARIZE_BATCH_SIZE),
  ]);

  let fileSummaries: Record<string, string> = {};
  let documentSummaries: Record<string, string> = {};
  try {
    [fileSummaries, documentSummaries] = await Promise.all([
      generateFileSummaries(files ?? []),
      generateDocumentSummaries(documents ?? []),
    ]);
  } catch (error) {
    return NextResponse.json(
      { error: describeAnthropicError(error) },
      { status: statusForAnthropicError(error) }
    );
  }

  await Promise.all([
    ...Object.entries(fileSummaries).map(([path, summary]) =>
      supabase.from("project_files").update({ summary }).eq("project_id", projectId).eq("path", path)
    ),
    ...Object.entries(documentSummaries).map(([filename, summary]) =>
      supabase
        .from("project_documents")
        .update({ summary })
        .eq("project_id", projectId)
        .eq("filename", filename)
    ),
  ]);

  const [{ count: remainingFiles }, { count: remainingDocuments }] = await Promise.all([
    supabase
      .from("project_files")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("summary", null),
    supabase
      .from("project_documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("summary", null),
  ]);

  return NextResponse.json({
    summarized: Object.keys(fileSummaries).length + Object.keys(documentSummaries).length,
    remaining: (remainingFiles ?? 0) + (remainingDocuments ?? 0),
  });
}
