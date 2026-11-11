"use client";

import { Brain, Calendar, FileText, ListChecks } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProjectManager } from "@/components/ProjectManager";
import { ProjectTaskCard, type ProjectTaskRow } from "@/components/ProjectTaskCard";
import { formatDateTime } from "@/lib/format";

type TabKey = "arquivos" | "memoria" | "tarefas" | "reunioes";

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: "arquivos", label: "Arquivos", icon: FileText },
  { key: "memoria", label: "Memória", icon: Brain },
  { key: "tarefas", label: "Tarefas", icon: ListChecks },
  { key: "reunioes", label: "Reuniões", icon: Calendar },
];

type ProjectFileRow = { path: string; size_bytes: number; summary: string | null; updated_at: string };
type ProjectDocumentRow = { filename: string; size_bytes: number; summary: string | null; updated_at: string };
type ProjectMeetingRow = { id: string; title: string; started_at: string; status: string };

export function ProjectTabs({
  projectId,
  files,
  documents,
  memorySummary,
  tasks,
  meetings,
}: {
  projectId: string;
  files: ProjectFileRow[];
  documents: ProjectDocumentRow[];
  memorySummary: string | null;
  tasks: ProjectTaskRow[];
  meetings: ProjectMeetingRow[];
}) {
  const [active, setActive] = useState<TabKey>("arquivos");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold tracking-wide uppercase ${
                isActive ? "border-accent text-accent" : "border-transparent text-text-secondary"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-4 py-4">
        {active === "arquivos" && (
          <ProjectManager projectId={projectId} initialFiles={files} initialDocuments={documents} />
        )}

        {active === "memoria" && (
          <div className="flex flex-col gap-2">
            {memorySummary ? (
              <p className="whitespace-pre-wrap text-sm text-text">{memorySummary}</p>
            ) : (
              <p className="text-text-secondary">
                Ainda não há memória deste projeto — ela é construída sozinha ao encerrar reuniões
                ligadas a ele.
              </p>
            )}
          </div>
        )}

        {active === "tarefas" && (
          <div className="flex flex-col gap-2">
            {tasks.length === 0 ? (
              <p className="text-text-secondary">Nenhuma tarefa ainda nas reuniões deste projeto.</p>
            ) : (
              tasks.map((task) => <ProjectTaskCard key={task.id} task={task} />)
            )}
          </div>
        )}

        {active === "reunioes" && (
          <div className="flex flex-col gap-2">
            {meetings.length === 0 ? (
              <p className="text-text-secondary">Nenhuma reunião ligada a este projeto ainda.</p>
            ) : (
              meetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/reunioes/${meeting.id}`}
                  className="flex min-h-11 items-center justify-between rounded-xl border border-border bg-surface px-4 text-text"
                >
                  <span>{meeting.title}</span>
                  <span className="text-xs text-text-secondary">{formatDateTime(meeting.started_at)}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
