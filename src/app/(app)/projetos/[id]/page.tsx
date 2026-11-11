import { notFound } from "next/navigation";
import { ProjectTabs } from "@/components/ProjectTabs";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).maybeSingle();
  if (!project) {
    notFound();
  }

  const [{ data: files }, { data: documents }, { data: memory }, { data: tasks }, { data: meetings }] =
    await Promise.all([
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
      supabase.from("project_memory").select("summary").eq("project_id", id).maybeSingle(),
      supabase
        .from("dev_tasks")
        .select("id, meeting_id, title, priority, status, progress_note")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("meetings")
        .select("id, title, started_at, status")
        .eq("project_id", id)
        .order("started_at", { ascending: false }),
    ]);

  const meetingTitleById = new Map((meetings ?? []).map((meeting) => [meeting.id, meeting.title]));
  const taskRows = (tasks ?? []).map((task) => ({
    ...task,
    meeting_title: meetingTitleById.get(task.meeting_id) ?? "Reunião",
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-text">{project.name}</h1>
      <ProjectTabs
        projectId={id}
        files={files ?? []}
        documents={documents ?? []}
        memorySummary={memory?.summary ?? null}
        tasks={taskRows}
        meetings={meetings ?? []}
      />
    </div>
  );
}
