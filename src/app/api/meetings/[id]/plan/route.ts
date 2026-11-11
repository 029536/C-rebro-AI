import { NextResponse } from "next/server";
import { z } from "zod";
import { planTaskSchema } from "@/lib/plans/schema";
import { commitPlan, fetchLatestDoneTasks, generateMeetingPlan } from "@/lib/plans/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

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
    const doneTasks = await fetchLatestDoneTasks(supabase, meetingId);
    const result = await commitPlan(
      supabase,
      meetingId,
      { summary: confirmParsed.data.summary, tasks: confirmParsed.data.tasks },
      doneTasks
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error, error_detail: result.errorDetail }, { status: result.status });
    }
    return NextResponse.json(result);
  }

  const result = await generateMeetingPlan(supabase, meetingId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, error_detail: result.errorDetail }, { status: result.status });
  }
  return NextResponse.json(result);
}
