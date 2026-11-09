import { NextResponse } from "next/server";
import { generateMeetingMinutes } from "@/lib/minutes/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/** Gera (ou regenera, com "Tentar de novo") a ata de uma reunião já encerrada. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const supabase = await createClient();

  const result = await generateMeetingMinutes(supabase, meetingId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.minutes);
}
