"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskCard, type PlanTaskRow } from "@/components/meeting/TaskCard";

export type PlanState = { summary: string; tasks: PlanTaskRow[] } | null;

type CandidateTask = Omit<PlanTaskRow, "id" | "position" | "status" | "progress_note"> & {
  depends_on: number[];
};
type PreviewState = { summary: string; tasks: CandidateTask[]; doneTasksToKeep: PlanTaskRow[] };

export function PlanView({
  meetingId,
  meetingStatus,
  plan,
}: {
  meetingId: string;
  meetingStatus: string;
  plan: PlanState;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PlanTaskRow[]>(plan?.tasks ?? []);
  // Reajusta durante a renderização quando `plan` muda (novo plano gerado) — não
  // num efeito, para não disparar um render em cascata (ver react-hooks/set-state-in-effect).
  const [syncedPlan, setSyncedPlan] = useState(plan);
  if (plan !== syncedPlan) {
    setSyncedPlan(plan);
    setTasks(plan?.tasks ?? []);
  }

  if (meetingStatus === "recording") {
    return <p className="text-text-secondary">O plano fica disponível depois que a gravação for encerrada.</p>;
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setErrorDetail(null);
    const response = await fetch(`/api/meetings/${meetingId}/plan`, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Não foi possível gerar o plano.");
      setErrorDetail(data?.error_detail ?? null);
      setBusy(false);
      return;
    }
    if (data.preview) {
      setPreview({ summary: data.summary, tasks: data.tasks, doneTasksToKeep: data.doneTasksToKeep });
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  async function confirmReplace() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    setErrorDetail(null);
    const response = await fetch(`/api/meetings/${meetingId}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true, summary: preview.summary, tasks: preview.tasks }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Não foi possível salvar o plano.");
      setErrorDetail(data?.error_detail ?? null);
      setBusy(false);
      return;
    }
    setPreview(null);
    router.refresh();
    setBusy(false);
  }

  function copyAll() {
    const text = tasks
      .map((task, index) => `## ${index + 1}. ${task.title}\n\n${task.prompt_md}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
  }

  async function updateTask(id: string, patch: Partial<Pick<PlanTaskRow, "status" | "title">>) {
    setTasks((previous) => previous.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  if (preview) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">{preview.summary}</p>

        {preview.doneTasksToKeep.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Serão mantidas (já marcadas como feitas)
            </h3>
            {preview.doneTasksToKeep.map((task) => (
              <p key={task.id} className="rounded-xl border border-border bg-surface p-3 text-sm text-text">
                {task.title}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Tarefas novas propostas
          </h3>
          {preview.tasks.map((task, index) => (
            <p key={index} className="rounded-xl border border-border bg-surface p-3 text-sm text-text">
              {task.title}
            </p>
          ))}
        </div>

        {error && (
          <div>
            <p className="text-sm text-record">{error}</p>
            {errorDetail && <p className="text-xs text-text-secondary">{errorDetail}</p>}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirmReplace}
            disabled={busy}
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Salvando..." : "Confirmar e substituir"}
          </button>
          <button
            type="button"
            onClick={() => setPreview(null)}
            disabled={busy}
            className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-text-secondary">Esta reunião ainda não tem plano de execução.</p>
        <GenerateButton busy={busy} onClick={generate} label="Gerar plano" />
        {error && (
          <div>
            <p className="text-sm text-record">{error}</p>
            {errorDetail && <p className="text-xs text-text-secondary">{errorDetail}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-secondary">{plan.summary}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyAll}
          className="flex h-10 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-accent"
        >
          Copiar todos
        </button>
        <GenerateButton busy={busy} onClick={generate} label="Gerar de novo" />
      </div>
      {error && (
        <div>
          <p className="text-sm text-record">{error}</p>
          {errorDetail && <p className="text-xs text-text-secondary">{errorDetail}</p>}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            allTasks={tasks}
            onUpdate={(patch) => updateTask(task.id, patch)}
          />
        ))}
      </div>
    </div>
  );
}

function GenerateButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex h-10 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-60"
    >
      {busy ? "Gerando plano..." : label}
    </button>
  );
}
