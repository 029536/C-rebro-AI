import { describe, expect, it } from "vitest";
import { applyMemoryChanges, buildMemoryItemsBlock } from "@/lib/projects/memoryItems";
import type { MemoryChange } from "@/lib/projects/memorySchema";

type Row = {
  id: string;
  project_id: string;
  tipo: "decisao" | "pendencia" | "estado" | "risco";
  texto: string;
  travado: boolean;
  resolvido: boolean;
  origem_meeting_id: string | null;
  created_at: string;
  updated_at: string;
};

function makeItem(overrides: Partial<Row>): Row {
  return {
    id: "item-1",
    project_id: "p1",
    tipo: "pendencia",
    texto: "Texto original",
    travado: false,
    resolvido: false,
    origem_meeting_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSupabaseStub(existingItems: Row[]) {
  const updates: { id: string; payload: unknown }[] = [];
  const inserts: unknown[][] = [];

  const supabase = {
    from(table: string) {
      if (table !== "project_memory_items") throw new Error(`tabela inesperada: ${table}`);
      return {
        select() {
          return {
            eq() {
              return this;
            },
            order() {
              return this;
            },
            then: (onFulfilled: (value: unknown) => unknown) =>
              Promise.resolve({ data: existingItems }).then(onFulfilled),
          };
        },
        update(payload: unknown) {
          return {
            eq(_column: string, id: string) {
              updates.push({ id, payload });
              return {
                eq() {
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
        insert(rows: unknown[]) {
          inserts.push(rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { supabase, updates, inserts };
}

describe("applyMemoryChanges", () => {
  it("nunca altera um item travado, mesmo que a IA mande alterados/resolvidos com o id dele", async () => {
    const locked = makeItem({ id: "locked-1", travado: true, texto: "Prazo final é 30/03" });
    const { supabase, updates } = makeSupabaseStub([locked]);

    const change: MemoryChange = {
      novos: [],
      alterados: [{ id: "locked-1", texto: "Tentativa de mudar o item travado" }],
      resolvidos: ["locked-1"],
      observacoes: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyMemoryChanges(supabase as any, "p1", "m1", change);

    expect(updates).toHaveLength(0);
    expect(result.updatedCount).toBe(0);
    expect(result.resolvedCount).toBe(0);
    expect(result.skippedLockedAttempts).toBe(2);
  });

  it("registra discordância de item travado como observação nova, sem tocar no item original", async () => {
    const locked = makeItem({ id: "locked-1", travado: true, texto: "Prazo final é 30/03" });
    const { supabase, inserts, updates } = makeSupabaseStub([locked]);

    const change: MemoryChange = {
      novos: [],
      alterados: [],
      resolvidos: [],
      observacoes: [{ item_id: "locked-1", observacao: "O cliente pediu para adiar para 15/04" }],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyMemoryChanges(supabase as any, "p1", "m1", change);

    expect(updates).toHaveLength(0);
    expect(result.observationCount).toBe(1);
    expect(inserts).toHaveLength(1);
    const insertedRow = inserts[0][0] as { texto: string; tipo: string };
    expect(insertedRow.texto).toContain("Prazo final é 30/03");
    expect(insertedRow.texto).toContain("O cliente pediu para adiar para 15/04");
    expect(insertedRow.tipo).toBe("pendencia");
  });

  it("altera e resolve itens não travados normalmente", async () => {
    const open = makeItem({ id: "open-1", travado: false });
    const { supabase, updates } = makeSupabaseStub([open]);

    const change: MemoryChange = {
      novos: [],
      alterados: [{ id: "open-1", texto: "Texto atualizado" }],
      resolvidos: [],
      observacoes: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyMemoryChanges(supabase as any, "p1", "m1", change);

    expect(result.updatedCount).toBe(1);
    expect(updates[0]).toEqual({ id: "open-1", payload: { texto: "Texto atualizado" } });
  });

  it("ignora ids que não existem na lista atual (nunca inventa um alvo)", async () => {
    const { supabase, updates } = makeSupabaseStub([]);

    const change: MemoryChange = {
      novos: [],
      alterados: [{ id: "id-que-nao-existe", texto: "x" }],
      resolvidos: ["outro-id-inexistente"],
      observacoes: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyMemoryChanges(supabase as any, "p1", "m1", change);

    expect(updates).toHaveLength(0);
    expect(result.updatedCount).toBe(0);
    expect(result.resolvedCount).toBe(0);
    expect(result.skippedLockedAttempts).toBe(0);
  });

  it("insere itens novos com a origem (reunião) certa", async () => {
    const { supabase, inserts } = makeSupabaseStub([]);
    const change: MemoryChange = {
      novos: [{ tipo: "decisao", texto: "Decisão nova" }],
      alterados: [],
      resolvidos: [],
      observacoes: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyMemoryChanges(supabase as any, "p1", "m1", change);

    expect(result.insertedCount).toBe(1);
    expect(inserts[0][0]).toMatchObject({ project_id: "p1", tipo: "decisao", origem_meeting_id: "m1" });
  });
});

describe("buildMemoryItemsBlock", () => {
  it("devolve null sem itens não resolvidos", () => {
    const resolved = makeItem({ resolvido: true });
    expect(buildMemoryItemsBlock([resolved])).toBeNull();
  });

  it("inclui o id só para itens não travados (a IA só edita/resolve esses)", () => {
    const locked = makeItem({ id: "locked-1", travado: true });
    const open = makeItem({ id: "open-1", travado: false });
    const block = buildMemoryItemsBlock([locked, open])!;
    expect(block).toContain("TRAVADO");
    expect(block).not.toContain("id=locked-1");
    expect(block).toContain("id=open-1");
  });

  it("com includeResolved, também lista itens resolvidos marcados como tal", () => {
    const resolved = makeItem({ id: "r1", resolvido: true });
    const block = buildMemoryItemsBlock([resolved], { includeResolved: true });
    expect(block).toContain("resolvido");
  });
});
