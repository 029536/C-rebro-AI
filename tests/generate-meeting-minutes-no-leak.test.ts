import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/minutes", () => ({
  generateMinutesContent: vi.fn().mockRejectedValue(
    new Error('Headers.append: "Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz" is an invalid header value.')
  ),
}));

const { generateMeetingMinutes } = await import("@/lib/minutes/service");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const MEETING_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "ready",
  meeting_type: "client" as const,
  client_name: "Cliente de teste",
  participants: [],
  context: null,
  started_at: "2026-11-09T19:31:00Z",
};

const CHUNKS = [
  {
    idx: 0,
    part_no: 1,
    transcript:
      "Bom dia a todos, vamos começar a reunião de hoje sobre o andamento do projeto e definir os próximos passos.",
  },
];

function makeFinalQuery(result: unknown) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = chain;
  query.eq = chain;
  query.order = chain;
  query.maybeSingle = async () => result;
  query.single = async () => result;
  query.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

/** Stub mínimo do cliente Supabase: só o suficiente para generateMeetingMinutes rodar. */
function makeSupabaseStub() {
  const writes: { table: string; payload: unknown }[] = [];

  const supabase = {
    from(table: string) {
      return {
        select() {
          if (table === "meetings") return makeFinalQuery({ data: MEETING_ROW });
          if (table === "meeting_chunks") return makeFinalQuery({ data: CHUNKS });
          if (table === "meeting_checkpoints") return makeFinalQuery({ data: [] });
          if (table === "company_context") return makeFinalQuery({ data: { context: "" } });
          return makeFinalQuery({ data: null });
        },
        insert(payload: unknown) {
          writes.push({ table, payload });
          return makeFinalQuery({
            data: { id: "ppppppp-pppp-pppp-pppp-pppppppppppp", status: "generating" },
            error: null,
          });
        },
        update(payload: unknown) {
          writes.push({ table, payload });
          return makeFinalQuery({ data: null, error: null });
        },
      };
    },
  };

  return { supabase, writes };
}

describe("generateMeetingMinutes — nunca vaza a chave, nem na resposta nem no que grava", () => {
  it("quando generateMinutesContent lança um erro que ecoa a chave, a resposta e o que é gravado em meeting_minutes.error ficam limpos", async () => {
    const { supabase, writes } = makeSupabaseStub();
    vi.spyOn(console, "error").mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateMeetingMinutes(supabase as any, MEETING_ROW.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("sk-ant-");
      expect(result.error).not.toContain("Bearer");
    }

    const errorWrites = writes.filter(
      (write) => write.table === "meeting_minutes" && (write.payload as { error?: string })?.error
    );
    expect(errorWrites.length).toBeGreaterThan(0);
    for (const write of errorWrites) {
      const savedError = (write.payload as { error?: string }).error ?? "";
      expect(savedError).not.toContain("sk-ant-");
      expect(savedError).not.toContain("Bearer");
    }
  });
});
