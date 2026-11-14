import { NextResponse } from "next/server";
import { generateMeetingMinutes } from "@/lib/minutes/service";
import { createClient } from "@/lib/supabase/server";

// Reunião longa pode gerar a ata em várias partes (map-reduce) — folga maior
// que uma chamada única, ainda dentro do teto do plano Hobby (300s, Fluid Compute).
export const maxDuration = 280;

/** Gera (ou regenera, com "Tentar de novo") a ata de uma reunião já encerrada. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const supabase = await createClient();

  const result = await generateMeetingMinutes(supabase, meetingId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, error_detail: result.errorDetail },
      { status: result.status }
    );
  }
  return NextResponse.json(result.minutes);
}
