import { afterEach, describe, expect, it, vi } from "vitest";

const generateOpinion = vi.fn();
vi.mock("@/lib/ai/copilot", () => ({ generateOpinion }));

const { generateMeetingOpinion } = await import("@/lib/opinions/service");

afterEach(() => {
  vi.unstubAllEnvs();
  generateOpinion.mockReset();
});

const MEETING_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  meeting_type: "client" as const,
  client_name: "Cliente de teste",
  participants: [],
  context: null,
};

const REAL_CHUNKS = [
  {
    transcript:
      "Bom dia a todos, vamos começar a reunião de hoje sobre o andamento do projeto e definir os próximos passos.",
    audio_seconds: 30,
  },
];

function makeFinalQuery(result: unknown) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = chain;
  query.eq = chain;
  query.order = chain;
  query.limit = chain;
  query.maybeSingle = async () => result;
  query.single = async () => result;
  query.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

function makeSupabaseStub(chunks: { transcript: string; audio_seconds?: number }[]) {
  const writes: { table: string; payload: unknown }[] = [];

  const supabase = {
    from(table: string) {
      return {
        select() {
          if (table === "meetings") return makeFinalQuery({ data: MEETING_ROW });
          if (table === "meeting_chunks") return makeFinalQuery({ data: chunks });
          if (table === "company_context") return makeFinalQuery({ data: { context: "" } });
          if (table === "meeting_checkpoints") return makeFinalQuery({ data: null });
          if (table === "meeting_opinions") return makeFinalQuery({ data: null });
          return makeFinalQuery({ data: null });
        },
        insert(payload: unknown) {
          writes.push({ table, payload });
          const record = payload as {
            meeting_id: string;
            offset_seconds: number;
            text: string;
            kind: string;
            prompt: string | null;
          };
          return makeFinalQuery({
            data: {
              id: "op-1",
              meeting_id: record.meeting_id,
              created_at: new Date().toISOString(),
              offset_seconds: record.offset_seconds,
              text: record.text,
              kind: record.kind,
              prompt: record.prompt,
            },
            error: null,
          });
        },
      };
    },
  };

  return { supabase, writes };
}

describe("generateMeetingOpinion", () => {
  it("recusa sem chamar o Claude quando a transcrição está vazia ou sem sentido (regra D4)", async () => {
    const { supabase } = makeSupabaseStub([{ transcript: "ok", audio_seconds: 5 }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateMeetingOpinion(supabase as any, MEETING_ROW.id, {
      offsetSeconds: 60,
      kind: "opiniao",
    });

    expect(result.ok).toBe(false);
    expect(generateOpinion).not.toHaveBeenCalled();
  });

  it("recusa 'resposta' sem pergunta, sem sequer consultar o banco", async () => {
    const { supabase } = makeSupabaseStub(REAL_CHUNKS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateMeetingOpinion(supabase as any, MEETING_ROW.id, {
      offsetSeconds: 60,
      kind: "resposta",
      question: "   ",
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Escreva a pergunta antes de enviar.",
      errorDetail: null,
    });
    expect(generateOpinion).not.toHaveBeenCalled();
  });

  it("salva a opinião com o offset_seconds mandado pelo cliente e kind 'opiniao' por padrão", async () => {
    generateOpinion.mockResolvedValue("Opinião de teste.");
    const { supabase, writes } = makeSupabaseStub(REAL_CHUNKS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateMeetingOpinion(supabase as any, MEETING_ROW.id, {
      offsetSeconds: 125,
      kind: "opiniao",
    });

    expect(result.ok).toBe(true);
    if (result.ok && !result.skipped) {
      expect(result.opinion.offset_seconds).toBe(125);
      expect(result.opinion.text).toBe("Opinião de teste.");
      expect(result.opinion.kind).toBe("opiniao");
      expect(result.opinion.prompt).toBeNull();
    }
    const insertWrites = writes.filter((write) => write.table === "meeting_opinions");
    expect(insertWrites).toHaveLength(1);
  });

  it("no tipo 'resposta', salva a pergunta do usuário em `prompt`", async () => {
    generateOpinion.mockResolvedValue("A resposta do Claude.");
    const { supabase } = makeSupabaseStub(REAL_CHUNKS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateMeetingOpinion(supabase as any, MEETING_ROW.id, {
      offsetSeconds: 10,
      kind: "resposta",
      question: "Isso já foi decidido?",
    });

    expect(result.ok).toBe(true);
    if (result.ok && !result.skipped) {
      expect(result.opinion.kind).toBe("resposta");
      expect(result.opinion.prompt).toBe("Isso já foi decidido?");
    }
  });

  it("não salva nada e devolve skipped quando o Claude não tem nada a acrescentar", async () => {
    generateOpinion.mockResolvedValue(null);
    const { supabase, writes } = makeSupabaseStub(REAL_CHUNKS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateMeetingOpinion(supabase as any, MEETING_ROW.id, {
      offsetSeconds: 10,
      kind: "opiniao",
    });

    expect(result).toEqual({ ok: true, skipped: true });
    expect(writes.filter((write) => write.table === "meeting_opinions")).toHaveLength(0);
  });
});
