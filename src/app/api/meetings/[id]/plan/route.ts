import { NextResponse } from "next/server";
import { z } from "zod";
import { planTaskSchema } from "@/lib/plans/schema";
import { commitPlan, fetchLatestDoneTasks, generateMeetingPlan } from "@/lib/plans/service";
import { updateProjectMemoryAfterMeeting } from "@/lib/projects/memory";
import { createClient } from "@/lib/supabase/server";

// Etapa 1 (lista) + etapa 2 (N prompts em paralelo, com limite de
// concorrência) pode passar de 120s numa reunião com plano denso — mesmo
// teto usado pela ata map-reduce.
export const maxDuration = 280;

const confirmSchema = z.object({
  confirm: z.literal(true),
  summary: z.string().trim().min(1).max(2_000),
  tasks: z.array(planTaskSchema).min(1).max(20),
});

/**
 * Gera (ou regenera) o plano de execução. Sem corpo (ou `confirm` ausente):
 * gera e, se não houver tarefas feitas a proteger, já salva; havendo, devolve
 * um preview (nada salvo ainda — ver GeneratePlanPreview). Com
 * `{ confirm: true, summary, tasks }`: grava exatamente esse plano,
 * preservando as tarefas já feitas (reenviado pela tela depois que o usuário
 * confirma a troca no preview).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const supabase = await createClient();

  const rawBody = await request.json().catch(() => null);
  const confirmParsed = rawBody ? confirmSchema.safeParse(rawBody) : null;

  if (confirmParsed?.success) {
    const [doneTasks, { data: meeting }] = await Promise.all([
      fetchLatestDoneTasks(supabase, meetingId),
      supabase.from("meetings").select("project_id").eq("id", meetingId).maybeSingle(),
    ]);
    const result = await commitPlan(
      supabase,
      meetingId,
      { summary: confirmParsed.data.summary, tasks: confirmParsed.data.tasks },
      doneTasks,
      meeting?.project_id ?? null
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error, error_detail: result.errorDetail }, { status: result.status });
    }
    await updateProjectMemoryAfterMeeting(supabase, meetingId);
    return NextResponse.json(result);
  }

  const result = await generateMeetingPlan(supabase, meetingId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, error_detail: result.errorDetail }, { status: result.status });
  }
  if (!result.preview) {
    await updateProjectMemoryAfterMeeting(supabase, meetingId);
  }
  return NextResponse.json(result);
}
