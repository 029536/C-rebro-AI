import { describe, expect, it } from "vitest";
import { buildTaskRows } from "@/lib/plans/service";
import type { PlanTask } from "@/lib/plans/schema";

const CANDIDATE_TASKS: PlanTask[] = [
  {
    title: "Primeira tarefa nova",
    description: "desc",
    acceptance: "aceite",
    priority: "alta",
    depends_on: [],
    prompt_md: "prompt 1",
  },
  {
    title: "Segunda tarefa nova",
    description: "desc",
    acceptance: "aceite",
    priority: "media",
    depends_on: [1],
    prompt_md: "prompt 2",
  },
];

function doneTask(overrides: Partial<ReturnType<typeof baseDoneTask>> = {}) {
  return { ...baseDoneTask(), ...overrides };
}

function baseDoneTask() {
  return {
    id: "done-1",
    meeting_id: "m1",
    plan_id: "plan-old",
    project_id: null as string | null,
    position: 1,
    title: "Tarefa já feita",
    description: "já pronta",
    acceptance: "aceite",
    priority: "baixa" as const,
    depends_on: [] as number[],
    prompt_md: "prompt antigo",
    status: "done" as const,
    progress_note: "entregue",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("buildTaskRows", () => {
  it("sem tarefas feitas a preservar, numera as novas a partir de 1 sem deslocar depends_on", () => {
    const rows = buildTaskRows("m1", "plan-new", [], CANDIDATE_TASKS);
    expect(rows.map((row) => row.position)).toEqual([1, 2]);
    expect(rows[1].depends_on).toEqual([1]);
    expect(rows.every((row) => row.status === "todo")).toBe(true);
  });

  it("preserva tarefas feitas nas primeiras posições, intactas (título, status, nota)", () => {
    const rows = buildTaskRows("m1", "plan-new", [doneTask()], CANDIDATE_TASKS);
    expect(rows[0]).toMatchObject({
      position: 1,
      title: "Tarefa já feita",
      status: "done",
      progress_note: "entregue",
    });
  });

  it("desloca a posição e o depends_on das tarefas novas pelo número de tarefas feitas", () => {
    const rows = buildTaskRows("m1", "plan-new", [doneTask(), doneTask({ id: "done-2" })], CANDIDATE_TASKS);
    // 2 tarefas feitas primeiro (posições 1-2), depois as novas (posições 3-4)
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4]);
    // a segunda tarefa nova dependia da posição 1 (dentro do próprio lote) → agora posição 3
    expect(rows[3].depends_on).toEqual([3]);
    expect(rows[2].depends_on).toEqual([]);
  });
});
