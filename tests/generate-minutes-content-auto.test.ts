import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpectedAIError } from "@/lib/ai/env";

const generateMinutesPartContent = vi.fn();
const generatePartQuickSummary = vi.fn();
const generateMinutesFinalFields = vi.fn();

vi.mock("@/lib/ai/minutesParts", () => ({
  generateMinutesPartContent,
  generatePartQuickSummary,
  generateMinutesFinalFields,
}));

const { generateMinutesContentAuto, MultipartMinutesError } = await import("@/lib/minutes/multipart");

afterEach(() => {
  generateMinutesPartContent.mockReset();
  generatePartQuickSummary.mockReset();
  generateMinutesFinalFields.mockReset();
  vi.unstubAllEnvs();
});

// ~1h10 de fala: bem acima do tamanho de uma parte só, força o caminho em partes.
const LONG_TRANSCRIPT = "Uma frase qualquer da reunião, repetida bastante para simular duração longa. ".repeat(800);

const BASE_PARAMS = {
  companyContext: "",
  meetingType: "client" as const,
  clientName: "Cliente de teste",
  participants: [],
  date: "2026-11-14",
  time: "10:00",
  transcript: LONG_TRANSCRIPT,
};

function partContent(label: string) {
  return {
    assuntos_discutidos: [`Assunto da ${label}`],
    decisoes: [`Decisão da ${label}`],
    responsabilidades: [],
    acoes_futuras: [],
    ata_formal_trecho: `Texto da ${label}.`,
  };
}

/** Tabela `meeting_minutes_parts` em memória — suporta só o que o código realmente usa. */
function makeSupabaseStub() {
  const rows: Record<string, unknown>[] = [];
  let idCounter = 0;

  function matches(row: Record<string, unknown>, filters: [string, string, unknown][]): boolean {
    return filters.every(([type, column, value]) =>
      type === "eq" ? row[column] === value : row[column] !== value
    );
  }

  function selectBuilder(filters: [string, string, unknown][] = []) {
    const builder = {
      eq(column: string, value: unknown) {
        return selectBuilder([...filters, ["eq", column, value]]);
      },
      neq(column: string, value: unknown) {
        return selectBuilder([...filters, ["neq", column, value]]);
      },
      order() {
        return selectBuilder(filters);
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        const data = rows.filter((row) => matches(row, filters));
        return Promise.resolve({ data }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const supabase = {
    from() {
      return {
        select() {
          return selectBuilder();
        },
        insert(newRows: Record<string, unknown> | Record<string, unknown>[]) {
          const toInsert = Array.isArray(newRows) ? newRows : [newRows];
          const inserted = toInsert.map((row) => ({
            id: `part-${idCounter++}`,
            status: "pending",
            content: null,
            quick_summary: null,
            error: null,
            ...row,
          }));
          rows.push(...inserted);
          return Promise.resolve({ data: inserted, error: null });
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              for (const row of rows) {
                if (row[column] === value) Object.assign(row, patch);
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };

  return { supabase, getRows: () => rows };
}

describe("generateMinutesContentAuto", () => {
  it("usa o caminho de chamada única para transcrições curtas (não cria partes)", async () => {
    vi.stubEnv("MOCK_AI", "1");
    const { supabase, getRows } = makeSupabaseStub();
    await generateMinutesContentAuto(supabase as never, "minutes-1", "meeting-1", {
      ...BASE_PARAMS,
      transcript: "Reunião curta, cabe numa chamada só.",
    });
    expect(generateMinutesPartContent).not.toHaveBeenCalled();
    expect(getRows()).toHaveLength(0);
  });

  it("divide uma transcrição longa em partes, gera cada uma e une o resultado", async () => {
    generatePartQuickSummary.mockImplementation(async () => "resumo rápido");
    generateMinutesPartContent.mockImplementation(async (params: { partNumber: number }) =>
      partContent(`parte ${params.partNumber}`)
    );
    generateMinutesFinalFields.mockResolvedValue({
      titulo: "Reunião longa consolidada",
      resumo_executivo: "Resumo executivo final.",
      observacoes: null,
      proximos_encontros: [],
    });

    const { supabase, getRows } = makeSupabaseStub();
    const content = await generateMinutesContentAuto(supabase as never, "minutes-1", "meeting-1", BASE_PARAMS);

    expect(generateMinutesPartContent.mock.calls.length).toBeGreaterThan(1);
    expect(content.titulo).toBe("Reunião longa consolidada");
    expect(content.assuntos_discutidos.length).toBe(generateMinutesPartContent.mock.calls.length);
    expect(content.ata_formal).toContain("Reunião longa consolidada");
    expect(content.ata_formal).toContain("Texto da parte 1.");
    expect(getRows().every((row) => row.status === "ready")).toBe(true);
  });

  it("passa o resumo das partes anteriores (não das seguintes) para cada parte", async () => {
    generatePartQuickSummary.mockImplementation(async (chunk: string) => `resumo de: ${chunk.slice(0, 10)}`);
    generateMinutesPartContent.mockImplementation(async (params: { partNumber: number }) =>
      partContent(`parte ${params.partNumber}`)
    );
    generateMinutesFinalFields.mockResolvedValue({
      titulo: "T",
      resumo_executivo: "R",
      observacoes: null,
      proximos_encontros: [],
    });

    const { supabase } = makeSupabaseStub();
    await generateMinutesContentAuto(supabase as never, "minutes-1", "meeting-1", BASE_PARAMS);

    const firstCall = generateMinutesPartContent.mock.calls.find((call) => call[0].partNumber === 1);
    expect(firstCall).toBeDefined();
    expect(firstCall![0].previousPartsSummaryBlock).toBeNull();

    const secondCall = generateMinutesPartContent.mock.calls.find((call) => call[0].partNumber === 2);
    expect(secondCall).toBeDefined();
    const secondPartCall = secondCall![0];
    expect(secondPartCall.previousPartsSummaryBlock).toBeTruthy();
  });

  it("quando uma parte falha, lança com detalhe de qual falhou, mas salva as que deram certo", async () => {
    generatePartQuickSummary.mockResolvedValue("resumo");
    generateMinutesPartContent.mockImplementation(async (params: { partNumber: number }) => {
      if (params.partNumber === 2) throw new Error("falha simulada");
      return partContent(`parte ${params.partNumber}`);
    });

    const { supabase, getRows } = makeSupabaseStub();
    await expect(
      generateMinutesContentAuto(supabase as never, "minutes-1", "meeting-1", BASE_PARAMS)
    ).rejects.toThrow(MultipartMinutesError);

    const rows = getRows();
    expect(rows.some((row) => row.status === "error")).toBe(true);
    expect(rows.some((row) => row.status === "ready")).toBe(true);
  });

  it("quando a falha tem detalhe (ExpectedAIError), o detalhe fica salvo na parte, não só a mensagem genérica", async () => {
    generatePartQuickSummary.mockResolvedValue("resumo");
    generateMinutesPartContent.mockImplementation(async (params: { partNumber: number }) => {
      if (params.partNumber === 1) {
        throw new ExpectedAIError(
          "A parte 1 de 3 da ata não veio num formato válido.",
          "assuntos_discutidos.0: String must contain at most 500 character(s)"
        );
      }
      return partContent(`parte ${params.partNumber}`);
    });

    const { supabase, getRows } = makeSupabaseStub();
    await expect(generateMinutesContentAuto(supabase as never, "minutes-1", "meeting-1", BASE_PARAMS)).rejects.toThrow();

    const failedRow = getRows().find((row) => row.status === "error");
    expect(failedRow?.error).toContain("não veio num formato válido");
    expect(failedRow?.error).toContain("assuntos_discutidos.0");
  });

  it("se o resumo de uma parte falhar, o conteúdo das partes ainda é gerado e salvo, mas a chamada final não roda", async () => {
    generatePartQuickSummary.mockImplementation(async () => {
      throw new Error("resumo sempre falha neste teste");
    });
    generateMinutesPartContent.mockImplementation(async (params: { partNumber: number }) =>
      partContent(`parte ${params.partNumber}`)
    );

    const { supabase, getRows } = makeSupabaseStub();
    await expect(
      generateMinutesContentAuto(supabase as never, "minutes-1", "meeting-1", BASE_PARAMS)
    ).rejects.toThrow(MultipartMinutesError);

    expect(generateMinutesFinalFields).not.toHaveBeenCalled();
    // o CONTEÚDO de cada parte foi gerado e salvo normalmente, só o resumo que faltou.
    const rows = getRows();
    expect(rows.every((row) => row.status === "ready")).toBe(true);
    expect(rows.every((row) => !row.quick_summary)).toBe(true);
  });

  it("'Tentar de novo' depois de uma falha só no resumo reaproveita todo o conteúdo pronto e refaz só o resumo que faltou", async () => {
    let summaryAttempts = 0;
    generatePartQuickSummary.mockImplementation(async () => {
      summaryAttempts++;
      // falha sempre na 1ª rodada inteira (3 partes), dá certo a partir da 2ª rodada (retry).
      if (summaryAttempts <= 3) throw new Error("resumo falhou na primeira tentativa");
      return "resumo ok";
    });
    generateMinutesPartContent.mockImplementation(async (params: { partNumber: number }) =>
      partContent(`parte ${params.partNumber}`)
    );
    generateMinutesFinalFields.mockResolvedValue({
      titulo: "T",
      resumo_executivo: "R",
      observacoes: null,
      proximos_encontros: [],
    });

    const { supabase } = makeSupabaseStub();
    await expect(
      generateMinutesContentAuto(supabase as never, "minutes-1", "meeting-1", BASE_PARAMS)
    ).rejects.toThrow(MultipartMinutesError);

    const contentCallsAfterFirstAttempt = generateMinutesPartContent.mock.calls.length;

    await generateMinutesContentAuto(supabase as never, "minutes-2", "meeting-1", BASE_PARAMS);

    // nenhuma parte precisou gerar o CONTEÚDO de novo: já estava tudo pronto.
    expect(generateMinutesPartContent.mock.calls.length).toBe(contentCallsAfterFirstAttempt);
    expect(generateMinutesFinalFields).toHaveBeenCalledTimes(1);
  });

  it("'Tentar de novo' (novo minutes_id) herda as partes prontas e só refaz a que falhou", async () => {
    generatePartQuickSummary.mockResolvedValue("resumo");
    let secondPartAttempts = 0;
    generateMinutesPartContent.mockImplementation(async (params: { partNumber: number }) => {
      if (params.partNumber === 2) {
        secondPartAttempts++;
        if (secondPartAttempts === 1) throw new Error("falha simulada só na primeira tentativa");
      }
      return partContent(`parte ${params.partNumber}`);
    });
    generateMinutesFinalFields.mockResolvedValue({
      titulo: "T",
      resumo_executivo: "R",
      observacoes: null,
      proximos_encontros: [],
    });

    const { supabase } = makeSupabaseStub();

    await expect(
      generateMinutesContentAuto(supabase as never, "minutes-1", "meeting-1", BASE_PARAMS)
    ).rejects.toThrow();

    const totalPartCallsAfterFirstAttempt = generateMinutesPartContent.mock.calls.length;

    // "Tentar de novo": nova linha de ata (novo minutes_id), mesma reunião.
    await generateMinutesContentAuto(supabase as never, "minutes-2", "meeting-1", BASE_PARAMS);

    const newCallsOnRetry = generateMinutesPartContent.mock.calls.length - totalPartCallsAfterFirstAttempt;
    // só a parte que faltava (índice 2) deveria ter sido chamada de novo — nunca as que já estavam prontas.
    expect(newCallsOnRetry).toBe(1);
  });
});
