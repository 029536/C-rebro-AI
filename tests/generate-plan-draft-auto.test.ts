import { afterEach, describe, expect, it, vi } from "vitest";

const generatePlanTaskList = vi.fn();
const generateTaskPrompt = vi.fn();
const shortenTaskPrompt = vi.fn();

vi.mock("@/lib/ai/plan", () => ({ generatePlanTaskList, generateTaskPrompt, shortenTaskPrompt }));

const { generatePlanDraftAuto, PlanDraftError } = await import("@/lib/plans/multistage");

afterEach(() => {
  generatePlanTaskList.mockReset();
  generateTaskPrompt.mockReset();
  shortenTaskPrompt.mockReset();
});

const BASE_PARAMS = {
  companyContext: "",
  hasProject: false,
};

const BASE_TASK_LIST = {
  summary: "Resumo do plano.",
  tasks: [
    { title: "Tarefa 1", description: "desc 1", acceptance: "aceite 1", priority: "alta" as const, depends_on: [] },
    { title: "Tarefa 2", description: "desc 2", acceptance: "aceite 2", priority: "media" as const, depends_on: [1] },
  ],
};

/** Tabelas `dev_plan_drafts`/`dev_plan_task_drafts` em memória — suporta só o que o código realmente usa. */
function makeSupabaseStub() {
  const tables: Record<string, Record<string, unknown>[]> = { dev_plan_drafts: [], dev_plan_task_drafts: [] };
  let idCounter = 0;

  function matches(row: Record<string, unknown>, filters: [string, unknown][]): boolean {
    return filters.every(([column, value]) => row[column] === value);
  }

  function sortRows(rows: Record<string, unknown>[], order: { column: string; ascending: boolean } | null) {
    if (!order) return rows;
    return [...rows].sort((a, b) => {
      const direction = (a[order.column] as number) > (b[order.column] as number) ? 1 : -1;
      return order.ascending ? direction : -direction;
    });
  }

  function selectBuilder(
    table: string,
    filters: [string, unknown][] = [],
    order: { column: string; ascending: boolean } | null = null
  ) {
    const builder = {
      eq(column: string, value: unknown) {
        return selectBuilder(table, [...filters, [column, value]], order);
      },
      order(column: string, opts?: { ascending?: boolean }) {
        return selectBuilder(table, filters, { column, ascending: opts?.ascending !== false });
      },
      limit() {
        return selectBuilder(table, filters, order);
      },
      async maybeSingle() {
        const rows = sortRows(tables[table].filter((row) => matches(row, filters)), order);
        return { data: rows[0] ?? null };
      },
      async single() {
        const rows = sortRows(tables[table].filter((row) => matches(row, filters)), order);
        return { data: rows[0] ?? null, error: rows[0] ? null : new Error("não encontrado") };
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        const rows = sortRows(tables[table].filter((row) => matches(row, filters)), order);
        return Promise.resolve({ data: rows }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const supabase = {
    from(table: string) {
      return {
        select() {
          return selectBuilder(table);
        },
        insert(newRows: Record<string, unknown> | Record<string, unknown>[]) {
          const toInsert = Array.isArray(newRows) ? newRows : [newRows];
          const inserted = toInsert.map((row) => ({
            id: `${table}-${idCounter++}`,
            created_at: new Date(idCounter).toISOString(),
            status: "pending",
            error: null,
            prompt_md: null,
            ...row,
          }));
          tables[table].push(...inserted);
          return {
            select() {
              return { async single() { return { data: inserted[0], error: null }; } };
            },
            then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
              return Promise.resolve({ data: inserted, error: null }).then(onFulfilled, onRejected);
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              for (const row of tables[table]) {
                if (row[column] === value) Object.assign(row, patch);
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };

  return { supabase, tables };
}

describe("generatePlanDraftAuto", () => {
  it("gera o esqueleto uma vez e o prompt_md de cada tarefa em chamadas separadas, salvando cada uma", async () => {
    generatePlanTaskList.mockResolvedValue(BASE_TASK_LIST);
    generateTaskPrompt.mockImplementation(async ({ task }: { task: { title: string } }) => `Prompt de ${task.title}.`);

    const { supabase, tables } = makeSupabaseStub();
    const content = await generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS);

    expect(generatePlanTaskList).toHaveBeenCalledTimes(1);
    expect(generateTaskPrompt).toHaveBeenCalledTimes(2);
    expect(content.tasks.map((t) => t.prompt_md)).toEqual(["Prompt de Tarefa 1.", "Prompt de Tarefa 2."]);
    expect(tables.dev_plan_task_drafts.every((row) => row.status === "ready")).toBe(true);
  });

  it("limpa depends_on inválido (ciclo) antes de salvar o esqueleto", async () => {
    generatePlanTaskList.mockResolvedValue({
      summary: "Resumo.",
      tasks: [
        { title: "A", description: "a", acceptance: "a", priority: "alta" as const, depends_on: [2] },
        { title: "B", description: "b", acceptance: "b", priority: "alta" as const, depends_on: [1] },
      ],
    });
    generateTaskPrompt.mockResolvedValue("Prompt.");

    const { supabase } = makeSupabaseStub();
    const content = await generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS);

    // Um ciclo direto (A<->B) não pode sobreviver: pelo menos uma das ligações precisa sumir.
    const hasCycle = content.tasks[0].depends_on.includes(2) && content.tasks[1].depends_on.includes(1);
    expect(hasCycle).toBe(false);
  });

  it("pede pra encurtar um prompt_md que passou do limite, em vez de reprovar a tarefa", async () => {
    generatePlanTaskList.mockResolvedValue(BASE_TASK_LIST);
    const oversized = "x".repeat(9_000);
    generateTaskPrompt.mockResolvedValue(oversized);
    shortenTaskPrompt.mockResolvedValue("y".repeat(500));

    const { supabase } = makeSupabaseStub();
    const content = await generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS);

    expect(shortenTaskPrompt).toHaveBeenCalled();
    for (const task of content.tasks) {
      expect(task.prompt_md.length).toBeLessThanOrEqual(8_000);
    }
  });

  it("trunca como último recurso se o encurtamento também vier grande demais", async () => {
    generatePlanTaskList.mockResolvedValue(BASE_TASK_LIST);
    generateTaskPrompt.mockResolvedValue("x".repeat(9_000));
    shortenTaskPrompt.mockResolvedValue("z".repeat(8_500));

    const { supabase } = makeSupabaseStub();
    const content = await generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS);

    for (const task of content.tasks) {
      expect(task.prompt_md.length).toBeLessThanOrEqual(8_000);
    }
  });

  it("quando uma tarefa falha, lança com detalhe de qual falhou, mas salva as que deram certo", async () => {
    generatePlanTaskList.mockResolvedValue(BASE_TASK_LIST);
    generateTaskPrompt.mockImplementation(async ({ task }: { task: { title: string } }) => {
      if (task.title === "Tarefa 2") throw new Error("falha simulada");
      return "Prompt ok.";
    });

    const { supabase, tables } = makeSupabaseStub();
    await expect(generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS)).rejects.toThrow(PlanDraftError);

    const rows = tables.dev_plan_task_drafts;
    expect(rows.some((row) => row.status === "ready")).toBe(true);
    expect(rows.some((row) => row.status === "error")).toBe(true);
  });

  it("'Tentar de novo' reaproveita o esqueleto já gerado e refaz só a tarefa que faltou", async () => {
    generatePlanTaskList.mockResolvedValue(BASE_TASK_LIST);
    let secondTaskAttempts = 0;
    generateTaskPrompt.mockImplementation(async ({ task }: { task: { title: string } }) => {
      if (task.title === "Tarefa 2") {
        secondTaskAttempts++;
        if (secondTaskAttempts === 1) throw new Error("falha simulada só na primeira tentativa");
      }
      return "Prompt ok.";
    });

    const { supabase } = makeSupabaseStub();
    await expect(generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS)).rejects.toThrow();

    await generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS);

    // só a etapa 1 da primeira tentativa: a segunda chamada não deve gerar a lista de novo.
    expect(generatePlanTaskList).toHaveBeenCalledTimes(1);
    // 2 tarefas na 1ª tentativa + 1 retomada na 2ª = 3.
    expect(generateTaskPrompt).toHaveBeenCalledTimes(3);
  });

  it("depois de um rascunho pronto, uma nova geração começa do zero (gera a lista de novo)", async () => {
    generatePlanTaskList.mockResolvedValue(BASE_TASK_LIST);
    generateTaskPrompt.mockResolvedValue("Prompt ok.");

    const { supabase } = makeSupabaseStub();
    await generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS);
    await generatePlanDraftAuto(supabase as never, "meeting-1", BASE_PARAMS);

    expect(generatePlanTaskList).toHaveBeenCalledTimes(2);
  });
});
