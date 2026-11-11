import { afterEach, describe, expect, it, vi } from "vitest";

const generateProjectMemory = vi.fn();
vi.mock("@/lib/ai/projectMemory", () => ({ generateProjectMemory }));

const { updateProjectMemoryAfterMeeting } = await import("@/lib/projects/memory");

afterEach(() => {
  generateProjectMemory.mockReset();
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

function makeSupabaseStub(params: {
  meeting: { id: string; title: string; project_id: string | null };
  previousMemory?: { summary: string } | null;
  minutes?: { status: string; content: unknown } | null;
  review?: { status: string; content: unknown } | null;
  tasks?: { title: string; status: string; progress_note: string }[];
}) {
  const upserts: { table: string; payload: unknown }[] = [];

  const supabase = {
    from(table: string) {
      return {
        select() {
          if (table === "meetings") return makeFinalQuery({ data: params.meeting });
          if (table === "project_memory") return makeFinalQuery({ data: params.previousMemory ?? null });
          if (table === "meeting_minutes") return makeFinalQuery({ data: params.minutes ?? null });
          if (table === "meeting_reviews") return makeFinalQuery({ data: params.review ?? null });
          if (table === "dev_tasks") return makeFinalQuery({ data: params.tasks ?? [] });
          return makeFinalQuery({ data: null });
        },
        upsert(payload: unknown) {
          upserts.push({ table, payload });
          return makeFinalQuery({ data: null, error: null });
        },
      };
    },
  };

  return { supabase, upserts };
}

describe("updateProjectMemoryAfterMeeting", () => {
  it("não faz nada quando a reunião não tem projeto", async () => {
    const { supabase, upserts } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: null },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1");
    expect(generateProjectMemory).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
  });

  it("não chama o Claude quando não há ata, parecer nem tarefas ainda", async () => {
    const { supabase } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: null,
      review: null,
      tasks: [],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1");
    expect(generateProjectMemory).not.toHaveBeenCalled();
  });

  it("atualiza a memória do projeto quando a ata já está pronta", async () => {
    generateProjectMemory.mockResolvedValue("Resumo atualizado do projeto.");
    const { supabase, upserts } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: { status: "ready", content: VALID_MINUTES_CONTENT },
      tasks: [],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateProjectMemoryAfterMeeting(supabase as any, "m1");
    expect(generateProjectMemory).toHaveBeenCalledTimes(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].payload).toMatchObject({ project_id: "p1", summary: "Resumo atualizado do projeto." });
  });

  it("nunca lança: engole o erro quando a geração falha", async () => {
    generateProjectMemory.mockRejectedValue(new Error("falha de rede"));
    const { supabase } = makeSupabaseStub({
      meeting: { id: "m1", title: "Reunião", project_id: "p1" },
      minutes: { status: "ready", content: VALID_MINUTES_CONTENT },
      tasks: [],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(updateProjectMemoryAfterMeeting(supabase as any, "m1")).resolves.toBeUndefined();
  });
});
