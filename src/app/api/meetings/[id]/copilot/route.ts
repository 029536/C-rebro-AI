import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMeetingOpinion } from "@/lib/opinions/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  offset_seconds: z.coerce.number().int().min(0),
  kind: z.enum(["opiniao", "pergunta", "resposta"]).default("opiniao"),
  question: z.string().trim().max(500).optional(),
});

/** "Pedir opinião agora" (opinar/perguntas/responder) e o disparo automático do interruptor. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await generateMeetingOpinion(supabase, meetingId, {
    offsetSeconds: parsed.data.offset_seconds,
    kind: parsed.data.kind,
    question: parsed.data.question,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, error_detail: result.errorDetail },
      { status: result.status }
    );
  }
  if (result.skipped) {
    return NextResponse.json({ skipped: true });
  }
  return NextResponse.json(result.opinion);
}
