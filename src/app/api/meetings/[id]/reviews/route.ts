import { NextResponse } from "next/server";
import { generateMeetingReview } from "@/lib/reviews/service";
import { updateProjectMemoryAfterMeeting } from "@/lib/projects/memory";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/** Gera (ou regenera, com "Gerar de novo") o parecer de uma reunião já encerrada. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const supabase = await createClient();

  const result = await generateMeetingReview(supabase, meetingId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, error_detail: result.errorDetail },
      { status: result.status }
    );
  }
  await updateProjectMemoryAfterMeeting(supabase, meetingId);
  return NextResponse.json(result.review);
}
