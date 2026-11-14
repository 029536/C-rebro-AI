// Orquestra o plano em duas etapas com persistência por tarefa (CLAUDE.md,
// "map-reduce" do plano): etapa 1 (esqueleto) uma vez por rascunho; etapa 2
// (prompt_md de cada tarefa) em paralelo, com limite de concorrência, salva
// assim que cada uma fica pronta. Se um rascunho anterior desta mesma
// reunião ainda não tiver dado certo (status "error" ou travado em
// "generating" por uma função que caiu no meio), retoma-o — refaz só as
// tarefas que faltam, sem gerar a lista de novo. Um rascunho que já deu
// certo não é reaproveitado: "Gerar de novo" começa do zero, para refletir
// uma ata/parecer que podem ter mudado.

import { generatePlanTaskList, generateTaskPrompt, shortenTaskPrompt, type PlanContextParams } from "@/lib/ai/plan";
import { ExpectedAIError, redactSecrets, summarizeZodIssues } from "@/lib/ai/env";
import { mapWithConcurrencyLimit } from "@/lib/concurrency";
import { PLAN_TASK_PROMPT_CONCURRENCY_LIMIT } from "@/lib/config";
import { cleanDependsOn } from "@/lib/plans/dependsOn";
import { planContentSchema, type PlanContent } from "@/lib/plans/schema";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type TaskDraftRow = Database["public"]["Tables"]["dev_plan_task_drafts"]["Row"];

/** Uma ou mais tarefas do plano não puderam ser geradas, mesmo depois de tentar — mas as que deram certo ficam salvas. */
export class PlanDraftError extends ExpectedAIError {}

/** Limite de caracteres do `prompt_md`, igual ao esquema (lib/plans/schema.ts) — mantido aqui só para o encurtamento. */
const PROMPT_MD_MAX_CHARS = 8_000;

/**
 * Gera o plano de uma reunião, em duas etapas, com retomada por tarefa. Ver
 * o cabeçalho do arquivo para quando um rascunho anterior é reaproveitado.
 */
export async function generatePlanDraftAuto(supabase: Supabase, meetingId: string, params: PlanContextParams): Promise<PlanContent> {
  const draft = await ensureDraft(supabase, meetingId, params);

  const taskRows = await fetchTaskDrafts(supabase, draft.id);
  const skeletonBlock = buildSkeletonBlock(taskRows);
  const pending = taskRows.filter((row) => row.status !== "ready");

  await mapWithConcurrencyLimit(pending, PLAN_TASK_PROMPT_CONCURRENCY_LIMIT, async (row) => {
    await supabase.from("dev_plan_task_drafts").update({ status: "generating" }).eq("id", row.id);
    try {
      let promptMd = await generateTaskPrompt({
        ...params,
        skeletonBlock,
        task: { title: row.title, description: row.description, acceptance: row.acceptance },
      });

      if (promptMd.length > PROMPT_MD_MAX_CHARS) {
        promptMd = await shortenTaskPrompt(promptMd, PROMPT_MD_MAX_CHARS);
      }
      if (promptMd.length > PROMPT_MD_MAX_CHARS) {
        promptMd = promptMd.slice(0, PROMPT_MD_MAX_CHARS);
      }

      await supabase
        .from("dev_plan_task_drafts")
        .update({ status: "ready", prompt_md: promptMd, error: null })
        .eq("id", row.id);
      row.status = "ready";
      row.prompt_md = promptMd;
    } catch (error) {
      // Nunca o texto da reunião: só a mensagem segura do erro (ExpectedAIError já garante isso).
      const message = redactSecrets(error instanceof Error ? error.message : String(error));
      await supabase.from("dev_plan_task_drafts").update({ status: "error", error: message }).eq("id", row.id);
      row.status = "error";
      row.error = message;
    }
  });

  const refreshed = await fetchTaskDrafts(supabase, draft.id);
  const failed = refreshed.filter((row) => row.status !== "ready");
  if (failed.length > 0) {
    await supabase
      .from("dev_plan_drafts")
      .update({ status: "error", error: `${failed.length} de ${refreshed.length} tarefa(s) não puderam ser geradas.` })
      .eq("id", draft.id);
    throw new PlanDraftError(
      `${failed.length} de ${refreshed.length} tarefa(s) do plano não puderam ser geradas. As que deram certo ficam salvas — "Tentar de novo" refaz só as que faltam.`,
      failed.map((row) => `tarefa "${row.title}": ${row.error ?? "motivo desconhecido"}`).join(" · ")
    );
  }

  await supabase.from("dev_plan_drafts").update({ status: "ready", error: null }).eq("id", draft.id);

  const ordered = [...refreshed].sort((a, b) => a.position - b.position);
  const tasks = ordered.map((row) => ({
    title: row.title,
    description: row.description,
    acceptance: row.acceptance,
    priority: row.priority,
    depends_on: row.depends_on,
    prompt_md: row.prompt_md ?? "",
  }));

  const parsed = planContentSchema.safeParse({ summary: draft.summary ?? "", tasks });
  if (!parsed.success) {
    throw new PlanDraftError("O plano gerado não veio num formato válido.", summarizeZodIssues(parsed.error));
  }
  return parsed.data;
}

/**
 * Acha o rascunho a usar: retoma o mais recente desta reunião se ele ainda
 * não tiver dado certo (gera só as tarefas que faltam); senão, gera a etapa
 * 1 (esqueleto) do zero e cria um rascunho novo, já com `depends_on`
 * validado (sem posição inexistente, autorreferência ou ciclo).
 */
async function ensureDraft(
  supabase: Supabase,
  meetingId: string,
  params: PlanContextParams
): Promise<{ id: string; summary: string | null }> {
  const { data: previous } = await supabase
    .from("dev_plan_drafts")
    .select("id, status, summary")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previous && previous.status !== "ready") {
    await supabase.from("dev_plan_drafts").update({ status: "generating", error: null }).eq("id", previous.id);
    return { id: previous.id, summary: previous.summary };
  }

  const taskList = await generatePlanTaskList(params);
  const cleanedDeps = cleanDependsOn(taskList.tasks.map((task) => task.depends_on));

  const { data: draft, error: draftError } = await supabase
    .from("dev_plan_drafts")
    .insert({ meeting_id: meetingId, status: "generating", summary: taskList.summary })
    .select("id, summary")
    .single();
  if (draftError || !draft) {
    throw new PlanDraftError("Não foi possível iniciar a geração do plano.");
  }

  const rows = taskList.tasks.map((task, index) => ({
    draft_id: draft.id,
    meeting_id: meetingId,
    position: index + 1,
    title: task.title,
    description: task.description,
    acceptance: task.acceptance,
    priority: task.priority,
    depends_on: cleanedDeps[index],
    status: "pending" as const,
  }));
  await supabase.from("dev_plan_task_drafts").insert(rows);

  return { id: draft.id, summary: draft.summary };
}

async function fetchTaskDrafts(supabase: Supabase, draftId: string): Promise<TaskDraftRow[]> {
  const { data } = await supabase
    .from("dev_plan_task_drafts")
    .select("*")
    .eq("draft_id", draftId)
    .order("position", { ascending: true });
  return data ?? [];
}

function buildSkeletonBlock(rows: TaskDraftRow[]): string {
  return rows
    .map(
      (row) =>
        `${row.position}. ${row.title} (prioridade ${row.priority}${
          row.depends_on.length > 0 ? `, depende de: ${row.depends_on.join(", ")}` : ""
        })\n   ${row.description}`
    )
    .join("\n");
}
