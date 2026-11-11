import type { MemoryChange } from "@/lib/projects/memorySchema";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type MemoryItemRow = Database["public"]["Tables"]["project_memory_items"]["Row"];

/** Itens do projeto, não resolvidos primeiro (ordem que também vai pro contexto da IA). */
export async function fetchMemoryItems(supabase: Supabase, projectId: string): Promise<MemoryItemRow[]> {
  const { data } = await supabase
    .from("project_memory_items")
    .select("*")
    .eq("project_id", projectId)
    .order("resolvido", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

const TIPO_LABEL: Record<MemoryItemRow["tipo"], string> = {
  decisao: "decisão",
  pendencia: "pendência",
  estado: "estado",
  risco: "risco",
};

/**
 * Formato compacto dos itens para o prompt da IA (atualização incremental E
 * contexto do copiloto/parecer/plano/chat) — não resolvidos primeiro, com id
 * só para os não travados (a IA só precisa do id para editar/resolver, e
 * nunca deve tentar isso num travado).
 */
export function buildMemoryItemsBlock(items: MemoryItemRow[], options: { includeResolved?: boolean } = {}): string | null {
  const relevant = options.includeResolved ? items : items.filter((item) => !item.resolvido);
  if (relevant.length === 0) return null;

  return relevant
    .map((item) => {
      const flags = [item.travado ? "TRAVADO" : null, item.resolvido ? "resolvido" : null].filter(Boolean);
      const flagsText = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
      const idText = item.travado ? "" : ` (id=${item.id})`;
      return `- [${TIPO_LABEL[item.tipo]}]${idText}${flagsText} ${item.texto}`;
    })
    .join("\n");
}

export type ApplyMemoryChangesResult = {
  insertedCount: number;
  updatedCount: number;
  resolvedCount: number;
  observationCount: number;
  skippedLockedAttempts: number;
};

/**
 * Aplica a diferença estruturada que a IA devolveu — nunca confia nela: só
 * altera/resolve ids que existem de verdade e não são travados. Discordância
 * sobre um item travado vira um item novo (observação), nunca uma edição
 * daquele item.
 */
export async function applyMemoryChanges(
  supabase: Supabase,
  projectId: string,
  meetingId: string | null,
  change: MemoryChange
): Promise<ApplyMemoryChangesResult> {
  const existing = await fetchMemoryItems(supabase, projectId);
  const existingById = new Map(existing.map((item) => [item.id, item]));

  let updatedCount = 0;
  let resolvedCount = 0;
  let skippedLockedAttempts = 0;

  for (const alteracao of change.alterados) {
    const current = existingById.get(alteracao.id);
    if (!current) continue;
    if (current.travado) {
      skippedLockedAttempts++;
      continue;
    }
    const { error } = await supabase
      .from("project_memory_items")
      .update({ texto: alteracao.texto })
      .eq("id", alteracao.id)
      .eq("project_id", projectId);
    if (!error) updatedCount++;
  }

  for (const id of change.resolvidos) {
    const current = existingById.get(id);
    if (!current) continue;
    if (current.travado) {
      skippedLockedAttempts++;
      continue;
    }
    const { error } = await supabase
      .from("project_memory_items")
      .update({ resolvido: true })
      .eq("id", id)
      .eq("project_id", projectId);
    if (!error) resolvedCount++;
  }

  const novosRows = change.novos.map((item) => ({
    project_id: projectId,
    tipo: item.tipo,
    texto: item.texto,
    origem_meeting_id: meetingId,
  }));

  const observacaoRows = change.observacoes
    .filter((observacao) => existingById.has(observacao.item_id))
    .map((observacao) => {
      const original = existingById.get(observacao.item_id)!;
      return {
        project_id: projectId,
        tipo: original.tipo,
        texto: `Observação sobre item travado ("${original.texto}"): ${observacao.observacao}`,
        origem_meeting_id: meetingId,
      };
    });

  const rowsToInsert = [...novosRows, ...observacaoRows];
  let insertedCount = 0;
  let observationCount = 0;
  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from("project_memory_items").insert(rowsToInsert);
    if (!error) {
      insertedCount = novosRows.length;
      observationCount = observacaoRows.length;
    }
  }

  return { insertedCount, updatedCount, resolvedCount, observationCount, skippedLockedAttempts };
}
