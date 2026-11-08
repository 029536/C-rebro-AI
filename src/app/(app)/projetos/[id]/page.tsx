import { notFound } from "next/navigation";
import { ProjectManager } from "@/components/ProjectManager";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).maybeSingle();
  if (!project) {
    notFound();
  }

  const [{ data: files }, { data: documents }] = await Promise.all([
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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-text">{project.name}</h1>
      <ProjectManager projectId={id} initialFiles={files ?? []} initialDocuments={documents ?? []} />
    </div>
  );
}
