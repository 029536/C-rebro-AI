import { generateProjectMemoryChanges } from "@/lib/ai/projectMemory";
import { redactSecrets } from "@/lib/ai/env";
import { minutesDocumentSchema } from "@/lib/minutes/schema";
import { applyMemoryChanges, buildMemoryItemsBlock, fetchMemoryItems } from "@/lib/projects/memoryItems";
import { reviewContentSchema } from "@/lib/reviews/schema";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Atualiza a memória ESTRUTURADA do projeto (itens, não texto corrido) com o
 * que esta reunião já tiver pronto (ata, parecer, tarefas) — chamada depois
 * que a ata é gerada (ao encerrar), depois que o parecer é gerado e depois
 * que o plano é gerado. Nunca lança: uma falha aqui não deve derrubar a ação
 * principal que a chamou.
 */
export async function updateProjectMemoryAfterMeeting(
  supabase: Supabase,
  meetingId: string,
  options: { force?: boolean } = {}
): Promise<void> {
  try {
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, title, project_id")
      .eq("id", meetingId)
      .maybeSingle();

    if (!meeting?.project_id) return;

    const [{ data: minutesRow }, { data: reviewRow }, { data: tasks }, existingItems] = await Promise.all([
      supabase
        .from("meeting_minutes")
        .select("status, content")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("meeting_reviews")
        .select("status, content")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("dev_tasks")
        .select("title, status, progress_note")
        .eq("meeting_id", meetingId)
        .order("position", { ascending: true }),
      fetchMemoryItems(supabase, meeting.project_id),
    ]);

    const ataParsed =
      minutesRow?.status === "ready" ? minutesDocumentSchema.safeParse(minutesRow.content) : null;
    const reviewParsed =
      reviewRow?.status === "ready" ? reviewContentSchema.safeParse(reviewRow.content) : null;

    const hasNewFromThisMeeting = Boolean(ataParsed?.success || reviewParsed?.success || (tasks ?? []).length > 0);
    const hasAnythingAtAll = hasNewFromThisMeeting || existingItems.length > 0;

    // Nada mesmo para trabalhar (projeto novo, sem ata/parecer/tarefas/itens): não vale a chamada.
    if (!hasAnythingAtAll) return;
    // Nada NOVO desta reunião: só atualiza se foi um pedido explícito de "Atualizar agora".
    if (!hasNewFromThisMeeting && !options.force) return;

    const andamento =
      (tasks ?? []).length > 0
        ? tasks!
            .map((task) => `- [${task.status}] ${task.title}${task.progress_note ? ` (${task.progress_note})` : ""}`)
            .join("\n")
        : null;

    const change = await generateProjectMemoryChanges({
      currentItemsBlock: buildMemoryItemsBlock(existingItems),
      meetingTitle: meeting.title,
      ataResumo: ataParsed?.success ? ataParsed.data.resumo_executivo : null,
      parecerResumo: reviewParsed?.success
        ? `Diagnóstico: ${reviewParsed.data.diagnostico}\nAvaliação: ${reviewParsed.data.avaliacao}`
        : null,
      andamento,
    });

    await applyMemoryChanges(supabase, meeting.project_id, meetingId, change);
  } catch (error) {
    console.error("Falha ao atualizar a memória do projeto:", redactSecrets(String(error)));
  }
}

export type RefreshMemoryResult = { ok: true } | { ok: false; error: string };

/**
 * "Atualizar agora" (tela do projeto): roda a mesma atualização incremental,
 * tomando a reunião mais recente do projeto como base.
 */
export async function refreshProjectMemory(supabase: Supabase, projectId: string): Promise<RefreshMemoryResult> {
  const { data: latestMeeting } = await supabase
    .from("meetings")
    .select("id")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestMeeting) {
    return { ok: false, error: "Este projeto ainda não tem reuniões para basear a memória." };
  }

  await updateProjectMemoryAfterMeeting(supabase, latestMeeting.id, { force: true });
  return { ok: true };
}
