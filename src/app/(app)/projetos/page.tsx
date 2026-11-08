import Link from "next/link";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, file_count, total_bytes, imported_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">Projetos</h1>
        <CreateProjectForm />
      </div>

      {projects && projects.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projetos/${project.id}`}
                className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4"
              >
                <p className="font-semibold text-text">{project.name}</p>
                <p className="text-sm text-text-secondary">
                  {project.file_count} arquivo(s) · {formatBytes(project.total_bytes)}
                  {" · "}
                  {project.imported_at ? formatDateTime(project.imported_at) : "ainda não importado"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-secondary">Nenhum projeto ainda.</p>
      )}
    </div>
  );
}
