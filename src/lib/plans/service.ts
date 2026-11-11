import {
  describeAnthropicError,
  describeAnthropicErrorDetail,
  statusForAnthropicError,
} from "@/lib/ai/anthropic";
import { buildContext } from "@/lib/ai/context";
import { redactSecrets } from "@/lib/ai/env";
import { generatePlanContent } from "@/lib/ai/plan";
import { buildMeetingContextBlock } from "@/lib/ai/prompts";
import { isTranscriptTooSparse } from "@/lib/minutes/rules";
import { minutesDocumentSchema } from "@/lib/minutes/schema";
import { participantsSchema } from "@/lib/participants";
import { type PlanTask, planContentSchema } from "@/lib/plans/schema";
import { buildProjectContextBlock } from "@/lib/projects/context";
import { reviewContentSchema } from "@/lib/reviews/schema";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type DevTaskRow = Database["public"]["Tables"]["dev_tasks"]["Row"];
type DevPlanRow = Database["public"]["Tables"]["dev_plans"]["Row"];
type DevTaskInsert = Database["public"]["Tables"]["dev_tasks"]["Insert"];

/**
 * Monta as linhas de `dev_tasks` para um novo plano: as tarefas já feitas
 * (preservadas tal como estão) primeiro, depois as novas geradas agora —
 * `depends_on` das novas é deslocado pelo mesmo tanto que suas posições, para
 * continuar apontando para a tarefa certa dentro do novo plano. Função pura,
 * sem acesso ao banco, para poder testar a regra de mesclagem isoladamente.
 */
export function buildTaskRows(
  meetingId: string,
  planId: string,
  doneTasksToKeep: DevTaskRow[],
  candidateTasks: PlanTask[],
  projectId: string | null = null
): DevTaskInsert[] {
  const offset = doneTasksToKeep.length;
  return [
    ...doneTasksToKeep.map((task, index) => ({
      meeting_id: meetingId,
      plan_id: planId,
      project_id: projectId,
      position: index + 1,
      title: task.title,
      description: task.description,
      acceptance: task.acceptance,
      priority: task.priority,
      depends_on: task.depends_on,
      prompt_md: task.prompt_md,
      status: task.status,
      progress_note: task.progress_note,
    })),
    ...candidateTasks.map((task, index) => ({
      meeting_id: meetingId,
      plan_id: planId,
      project_id: projectId,
      position: offset + index + 1,
      title: task.title,
      description: task.description,
      acceptance: task.acceptance,
      priority: task.priority,
      depends_on: task.depends_on.map((d) => d + offset),
      prompt_md: task.prompt_md,
      status: "todo" as const,
      progress_note: "",
    })),
  ];
}

export type PlanFailure = { ok: false; status: number; error: string; errorDetail: string | null };

export type GeneratePlanPreview = {
  ok: true;
  preview: true;
  summary: string;
  tasks: PlanTask[];
  doneTasksToKeep: DevTaskRow[];
};

export type GeneratePlanCommitted = {
  ok: true;
  preview: false;
  plan: DevPlanRow;
  tasks: DevTaskRow[];
};

export type GeneratePlanResult = GeneratePlanPreview | GeneratePlanCommitted | PlanFailure;

/**
 * Gera o plano de execução ("Gerar plano"/"Gerar de novo"). Se já existe um
 * plano anterior com tarefas marcadas como "feitas", devolve um PREVIEW (sem
 * gravar nada) para a tela mostrar a diferença antes de substituir — ver
 * `commitPlan`, chamado depois com `confirm: true`. Sem tarefas feitas para
 * proteger, grava direto.
 */
export async function generateMeetingPlan(
  supabase: Supabase,
  meetingId: string
): Promise<GeneratePlanResult> {
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, status, meeting_type, client_name, participants, context, project_id")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    return { ok: false, status: 404, error: "Reunião não encontrada.", errorDetail: null };
  }
  if (meeting.status === "recording") {
    return {
      ok: false,
      status: 409,
      error: "Encerre a gravação antes de gerar o plano.",
      errorDetail: null,
    };
  }

  const [
    { data: chunks },
    { data: checkpoints },
    { data: companyContext },
    { data: minutesRow },
    { data: reviewRow },
    doneTasks,
  ] = await Promise.all([
    supabase
      .from("meeting_chunks")
      .select("idx, part_no, transcript")
      .eq("meeting_id", meetingId)
      .order("idx", { ascending: true }),
    supabase.from("meeting_checkpoints").select("part_no, summary").eq("meeting_id", meetingId),
    supabase.from("company_context").select("context").maybeSingle(),
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
    fetchLatestDoneTasks(supabase, meetingId),
  ]);

  const allChunks = chunks ?? [];
  if (allChunks.length === 0) {
    return { ok: false, status: 409, error: "Essa reunião ainda não tem transcrição.", errorDetail: null };
  }

  const fullTranscript = allChunks
    .map((chunk) => chunk.transcript.trim())
    .filter(Boolean)
    .join(" ");
  if (isTranscriptTooSparse(fullTranscript)) {
    return {
      ok: false,
      status: 422,
      error: "A transcrição está vazia ou não tem conteúdo suficiente para gerar um plano confiável.",
      errorDetail: null,
    };
  }

  const built = buildContext({
    checkpoints: (checkpoints ?? []).map((checkpoint) => ({
      partNo: checkpoint.part_no,
      summary: checkpoint.summary,
    })),
    chunks: allChunks.map((chunk) => ({ idx: chunk.idx, partNo: chunk.part_no, transcript: chunk.transcript })),
    currentPartNo: allChunks[allChunks.length - 1].part_no,
  });
  const transcript = built.checkpointsBlock
    ? `<resumos_das_partes_anteriores>\n${built.checkpointsBlock}\n</resumos_das_partes_anteriores>\n\n${built.transcriptBlock}`
    : built.transcriptBlock;

  const participantsParsed = participantsSchema.safeParse(meeting.participants);
  const meetingContext = buildMeetingContextBlock({
    meetingType: meeting.meeting_type,
    clientName: meeting.client_name,
    participants: participantsParsed.success ? participantsParsed.data : [],
    context: meeting.context,
  });

  const ataParsed =
    minutesRow?.status === "ready" ? minutesDocumentSchema.safeParse(minutesRow.content) : null;
  const ataFormal = ataParsed?.success ? ataParsed.data.ata_formal : null;

  const reviewParsed =
    reviewRow?.status === "ready" ? reviewContentSchema.safeParse(reviewRow.content) : null;
  const reviewSummary = reviewParsed?.success
    ? `Diagnóstico: ${reviewParsed.data.diagnostico}\nAvaliação: ${reviewParsed.data.avaliacao}`
    : null;

  const doneTasksBlock =
    doneTasks.length > 0
      ? doneTasks.map((task) => `- ${task.title}: ${task.description}`).join("\n")
      : null;

  const projectContext = meeting.project_id
    ? await buildProjectContextBlock(supabase, meeting.project_id, transcript)
    : null;

  try {
    const content = await generatePlanContent({
      companyContext: companyContext?.context ?? "",
      meetingContext: meetingContext || undefined,
      ataFormal,
      reviewSummary,
      doneTasksBlock,
      projectContext,
      hasProject: Boolean(meeting.project_id),
      transcript,
    });

    const parsed = planContentSchema.safeParse(content);
    if (!parsed.success) {
      return { ok: false, status: 502, error: "O Claude devolveu um plano num formato inválido.", errorDetail: null };
    }

    if (doneTasks.length === 0) {
      const committed = await commitPlan(
        supabase,
        meetingId,
        { summary: parsed.data.summary, tasks: parsed.data.tasks },
        [],
        meeting.project_id
      );
      return committed;
    }

    return { ok: true, preview: true, summary: parsed.data.summary, tasks: parsed.data.tasks, doneTasksToKeep: doneTasks };
  } catch (error) {
    return {
      ok: false,
      status: statusForAnthropicError(error),
      error: redactSecrets(describeAnthropicError(error)),
      errorDetail: describeAnthropicErrorDetail(error),
    };
  }
}

/**
 * Grava um novo plano: tarefas já feitas (de um plano anterior desta reunião,
 * preservadas tal como estão) primeiro, seguidas das tarefas novas geradas
 * agora — `depends_on` das novas é remapeado para continuar apontando certo
 * depois do deslocamento de posição.
 */
export async function commitPlan(
  supabase: Supabase,
  meetingId: string,
  candidate: { summary: string; tasks: PlanTask[] },
  doneTasksToKeep: DevTaskRow[] = [],
  projectId: string | null = null
): Promise<GeneratePlanCommitted | PlanFailure> {
  const { data: plan, error: planError } = await supabase
    .from("dev_plans")
    .insert({
      meeting_id: meetingId,
      summary: candidate.summary,
      model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    })
    .select("*")
    .single();

  if (planError || !plan) {
    return { ok: false, status: 500, error: "Não foi possível salvar o plano.", errorDetail: null };
  }

  const rows = buildTaskRows(meetingId, plan.id, doneTasksToKeep, candidate.tasks, projectId);

  const { data: insertedTasks, error: tasksError } = await supabase
    .from("dev_tasks")
    .insert(rows)
    .select("*")
    .order("position", { ascending: true });

  if (tasksError || !insertedTasks) {
    return { ok: false, status: 500, error: "O plano foi salvo, mas as tarefas não.", errorDetail: null };
  }

  return { ok: true, preview: false, plan, tasks: insertedTasks };
}

export async function fetchLatestDoneTasks(supabase: Supabase, meetingId: string): Promise<DevTaskRow[]> {
  const { data: latestPlan } = await supabase
    .from("dev_plans")
    .select("id")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestPlan) return [];

  const { data: tasks } = await supabase
    .from("dev_tasks")
    .select("*")
    .eq("plan_id", latestPlan.id)
    .eq("status", "done")
    .order("position", { ascending: true });

  return tasks ?? [];
}

/** Para a tela mostrar o plano vigente (a versão mais recente) e suas tarefas. */
export async function fetchCurrentPlan(
  supabase: Supabase,
  meetingId: string
): Promise<{ plan: DevPlanRow; tasks: DevTaskRow[] } | null> {
  const { data: plan } = await supabase
    .from("dev_plans")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;

  const { data: tasks } = await supabase
    .from("dev_tasks")
    .select("*")
    .eq("plan_id", plan.id)
    .order("position", { ascending: true });

  return { plan, tasks: tasks ?? [] };
}
