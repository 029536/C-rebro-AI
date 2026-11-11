import { generateProjectMemory } from "@/lib/ai/projectMemory";
import { redactSecrets } from "@/lib/ai/env";
import { minutesDocumentSchema } from "@/lib/minutes/schema";
import { reviewContentSchema } from "@/lib/reviews/schema";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Atualiza a memória viva do projeto com o que esta reunião já tiver pronto
 * (ata, parecer, tarefas) — chamada depois que a ata é gerada (ao encerrar),
 * depois que o parecer é gerado e depois que o plano é gerado, para o resumo
 * ir incorporando cada peça assim que existir. Nunca lança: uma falha aqui
 * (rede, chave, etc.) não deve derrubar a ação principal que a chamou.
 */
export async function updateProjectMemoryAfterMeeting(supabase: Supabase, meetingId: string): Promise<void> {
  try {
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, title, project_id")
      .eq("id", meetingId)
      .maybeSingle();

    if (!meeting?.project_id) return;

    const [{ data: previousMemory }, { data: minutesRow }, { data: reviewRow }, { data: tasks }] =
      await Promise.all([
        supabase.from("project_memory").select("summary").eq("project_id", meeting.project_id).maybeSingle(),
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
      ]);

    const ataParsed =
      minutesRow?.status === "ready" ? minutesDocumentSchema.safeParse(minutesRow.content) : null;
    const reviewParsed =
      reviewRow?.status === "ready" ? reviewContentSchema.safeParse(reviewRow.content) : null;

    // Nada novo ainda para incorporar (reunião recém-criada, sem ata/parecer/tarefas) — não vale a chamada.
    if (!ataParsed?.success && !reviewParsed?.success && (tasks ?? []).length === 0) return;

    const andamento =
      (tasks ?? []).length > 0
        ? tasks!
            .map((task) => `- [${task.status}] ${task.title}${task.progress_note ? ` (${task.progress_note})` : ""}`)
            .join("\n")
        : null;

    const summary = await generateProjectMemory({
      previousSummary: previousMemory?.summary ?? null,
      meetingTitle: meeting.title,
      ataResumo: ataParsed?.success ? ataParsed.data.resumo_executivo : null,
      parecerResumo: reviewParsed?.success
        ? `Diagnóstico: ${reviewParsed.data.diagnostico}\nAvaliação: ${reviewParsed.data.avaliacao}`
        : null,
      andamento,
    });

    if (!summary.trim()) return;

    await supabase
      .from("project_memory")
      .upsert({ project_id: meeting.project_id, summary }, { onConflict: "project_id" });
  } catch (error) {
    console.error("Falha ao atualizar a memória do projeto:", redactSecrets(String(error)));
  }
}
