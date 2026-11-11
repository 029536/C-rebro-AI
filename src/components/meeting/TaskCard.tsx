"use client";

import { Check, Clipboard } from "lucide-react";
import { useState } from "react";

export type PlanTaskRow = {
  id: string;
  position: number;
  title: string;
  description: string;
  acceptance: string;
  priority: "alta" | "media" | "baixa";
  depends_on: number[];
  prompt_md: string;
  status: "todo" | "doing" | "done";
  progress_note: string;
};

const PRIORITY_LABEL: Record<PlanTaskRow["priority"], string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const PRIORITY_STYLE: Record<PlanTaskRow["priority"], string> = {
  alta: "bg-record-soft text-record",
  media: "bg-badge-andamento-bg text-badge-andamento-text",
  baixa: "bg-border text-text-secondary",
};

const STATUS_LABEL: Record<PlanTaskRow["status"], string> = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Feito",
};

/** Tarefa do plano: título editável, status, prompt pronto para colar no Claude Code. */
export function TaskCard({
  task,
  allTasks,
  onUpdate,
}: {
  task: PlanTaskRow;
  allTasks: PlanTaskRow[];
  onUpdate: (patch: Partial<Pick<PlanTaskRow, "status" | "title" | "progress_note">>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const dependsOnTitles = task.depends_on
    .map((position) => allTasks.find((other) => other.position === position)?.title)
    .filter((title): title is string => Boolean(title));

  function copyPrompt() {
    navigator.clipboard.writeText(task.prompt_md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title.trim() && title.trim() !== task.title) onUpdate({ title: title.trim() });
          }}
          className="flex-1 bg-transparent font-semibold text-text outline-none"
        />
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      {dependsOnTitles.length > 0 && (
        <p className="text-xs text-text-secondary">Depende de: {dependsOnTitles.join(", ")}</p>
      )}

      <button type="button" onClick={() => setExpanded((value) => !value)} className="text-left text-sm text-text-secondary">
        {expanded ? task.description : `${task.description.slice(0, 120)}${task.description.length > 120 ? "…" : ""}`}
      </button>
      {expanded && task.acceptance && (
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text">Critério de aceite: </span>
          {task.acceptance}
        </p>
      )}

      <div className="flex gap-1.5">
        {(["todo", "doing", "done"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onUpdate({ status })}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg text-xs font-semibold ${
              task.status === status ? "bg-accent text-white" : "bg-background text-text-secondary"
            }`}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={copyPrompt}
        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-accent"
      >
        {copied ? <Check size={16} /> : <Clipboard size={16} />}
        {copied ? "Prompt copiado" : "Copiar prompt"}
      </button>
    </div>
  );
}
