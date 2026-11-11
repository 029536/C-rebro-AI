"use client";

import Link from "next/link";
import { useState } from "react";

export type ProjectTaskRow = {
  id: string;
  meeting_id: string;
  meeting_title: string;
  title: string;
  priority: "alta" | "media" | "baixa";
  status: "todo" | "doing" | "done";
  progress_note: string;
};

const PRIORITY_STYLE: Record<ProjectTaskRow["priority"], string> = {
  alta: "bg-record-soft text-record",
  media: "bg-badge-andamento-bg text-badge-andamento-text",
  baixa: "bg-border text-text-secondary",
};

const STATUS_LABEL: Record<ProjectTaskRow["status"], string> = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Feito",
};

/** Tarefa do plano, vista pela tela do projeto (soma de todas as reuniões). */
export function ProjectTaskCard({ task }: { task: ProjectTaskRow }) {
  const [progressNote, setProgressNote] = useState(task.progress_note);
  const [status, setStatus] = useState(task.status);

  async function updateTask(patch: Partial<Pick<ProjectTaskRow, "status" | "progress_note">>) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 font-semibold text-text">{task.title}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[task.priority]}`}>
          {task.priority === "alta" ? "Alta" : task.priority === "media" ? "Média" : "Baixa"}
        </span>
      </div>
      <Link href={`/reunioes/${task.meeting_id}`} className="text-xs font-semibold text-accent">
        {task.meeting_title}
      </Link>
      <div className="flex gap-1.5">
        {(["todo", "doing", "done"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus(value);
              updateTask({ status: value });
            }}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg text-xs font-semibold ${
              status === value ? "bg-accent text-white" : "bg-background text-text-secondary"
            }`}
          >
            {STATUS_LABEL[value]}
          </button>
        ))}
      </div>
      <input
        value={progressNote}
        onChange={(event) => setProgressNote(event.target.value)}
        onBlur={() => updateTask({ progress_note: progressNote })}
        placeholder="Nota de andamento (ex.: entregue em 05/11, falta testar)"
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-text outline-none"
      />
    </div>
  );
}
