import { afterEach, describe, expect, it, vi } from "vitest";

const generateProjectMemoryChanges = vi.fn();
vi.mock("@/lib/ai/projectMemory", () => ({ generateProjectMemoryChanges }));

const { updateProjectMemoryAfterMeeting, refreshProjectMemory } = await import("@/lib/projects/memory");

afterEach(() => {
  generateProjectMemoryChanges.mockReset();
});

function makeFinalQuery(result: unknown) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = chain;
  query.eq = chain;
  query.order = chain;
  query.limit = chain;
  query.maybeSingle = async () => result;
  query.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

const VALID_MINUTES_CONTENT = {
  titulo: "Reunião de teste",
  data: "2026-01-01",
  horario: "10:00",
  tipo: "client" as const,
  cliente_ou_empresa: "Cliente",
  participantes: [],
  assuntos_discutidos: [],
  decisoes: [],
  responsabilidades: [],
  acoes_futuras: [],
  observacoes: null,
  resumo_executivo: "Resumo da ata.",
  proximos_encontros: [],
  ata_formal: "Texto da ata.",
};

const EMPTY_CHANGE = { novos: [], alterados: [], resolvidos: [], observacoes: [] };

function makeSupabaseStub(params: {
  meeting: { id: string; title: string; project_id: string | null } | null;
  minutes?: { status: string; content: unknown } | null;
  review?: { status: string; content: unknown } | null;
  tasks?: { title: string; status: string; progress_note: string }[];
  existingItems?: unknown[];
}) {
  const upserts: { table: string; payload: unknown }[] = [];
  const inserts: { table: string; rows: unknown[] }[] = [];

  const supabase = {
    from(table: string) {
      return {
        select() {
          if (table === "meetings") return makeFinalQuery({ data: params.meeting });
          if (table === "meeting_minutes") return makeFinalQuery({ data: params.minutes ?? null });
          if (table === "meeting_reviews") return makeFinalQuery({ data: params.review ?? null });
          if (table === "dev_tasks") return makeFinalQuery({ data: params.tasks ?? [] });
          if (table === "project_memory_items") return makeFinalQuery({ data: params.existingItems ?? [] });
          return makeFinalQuery({ data: null });
        },
        update() {
          return {
            eq() {
              return { eq: async () => ({ error: null }) };
            },
          };
        },
        insert(rows: unknown[]) {
          inserts.push({ table, rows });
          return Promise.resolve({ error: null });
        },
        upsert(payload: unknown) {
          upserts.push({ table, payload });
          return makeFinalQuery({ data: null, error: null });
        },
      };
    },
  };

  return { supabase, upserts, inserts };
}

describe("updateProjectMemoryAfterMeeting", () => {
  it("não faz nada quando a reunião não tem projeto", async () => {
    const { supabase, inserts } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: null },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1");
    expect(generateProjectMemoryChanges).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it("não chama o Claude quando não há ata, parecer, tarefas nem itens ainda", async () => {
    const { supabase } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: null,
      review: null,
      tasks: [],
      existingItems: [],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1");
    expect(generateProjectMemoryChanges).not.toHaveBeenCalled();
  });

  it("gera e aplica a diferença quando a ata já está pronta", async () => {
    generateProjectMemoryChanges.mockResolvedValue({
      novos: [{ tipo: "decisao", texto: "Decisão nova" }],
      alterados: [],
      resolvidos: [],
      observacoes: [],
    });
    const { supabase, inserts } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: { status: "ready", content: VALID_MINUTES_CONTENT },
      tasks: [],
      existingItems: [],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1");
    expect(generateProjectMemoryChanges).toHaveBeenCalledTimes(1);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].rows[0]).toMatchObject({ project_id: "p1", tipo: "decisao", origem_meeting_id: "m1" });
  });

  it("sem conteúdo novo desta reunião e sem force, não chama o Claude mesmo havendo itens existentes", async () => {
    const { supabase } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: null,
      review: null,
      tasks: [],
      existingItems: [{ id: "x1", travado: false, tipo: "estado", texto: "Item antigo", resolvido: false }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1");
    expect(generateProjectMemoryChanges).not.toHaveBeenCalled();
  });

  it("com force=true, atualiza mesmo sem conteúdo novo desta reunião, se houver itens existentes", async () => {
    generateProjectMemoryChanges.mockResolvedValue(EMPTY_CHANGE);
    const { supabase } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: null,
      review: null,
      tasks: [],
      existingItems: [{ id: "x1", travado: false, tipo: "estado", texto: "Item antigo", resolvido: false }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1", { force: true });
    expect(generateProjectMemoryChanges).toHaveBeenCalledTimes(1);
  });

  it("com force=true mas sem absolutamente nada (projeto novo), ainda não chama o Claude", async () => {
    const { supabase } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: null,
      review: null,
      tasks: [],
      existingItems: [],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1", { force: true });
    expect(generateProjectMemoryChanges).not.toHaveBeenCalled();
  });

  it("nunca lança: engole o erro quando a geração falha", async () => {
    generateProjectMemoryChanges.mockRejectedValue(new Error("falha de rede"));
    const { supabase } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: { status: "ready", content: VALID_MINUTES_CONTENT },
      tasks: [],
      existingItems: [],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(updateProjectMemoryAfterMeeting(supabase as any, "m1")).resolves.toBeUndefined();
  });
});

describe("refreshProjectMemory", () => {
  it("devolve erro claro quando o projeto ainda não tem nenhuma reunião", async () => {
    const { supabase } = makeSupabaseStub({ meeting: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await refreshProjectMemory(supabase as any, "p1");
    expect(result).toEqual({
      ok: false,
      error: "Este projeto ainda não tem reuniões para basear a memória.",
    });
    expect(generateProjectMemoryChanges).not.toHaveBeenCalled();
  });

  it("atualiza com base na reunião mais recente do projeto, forçando mesmo sem conteúdo novo", async () => {
    generateProjectMemoryChanges.mockResolvedValue(EMPTY_CHANGE);
    const { supabase } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: null,
      review: null,
      tasks: [],
      existingItems: [{ id: "x1", travado: false, tipo: "estado", texto: "Item antigo", resolvido: false }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await refreshProjectMemory(supabase as any, "p1");
    expect(result).toEqual({ ok: true });
    expect(generateProjectMemoryChanges).toHaveBeenCalledTimes(1);
  });
});
