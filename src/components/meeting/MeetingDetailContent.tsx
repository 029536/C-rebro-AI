import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetingActions } from "@/components/MeetingActions";
import { MeetingSetupSection } from "@/components/MeetingSetupSection";
import { MeetingTabs, type MinutesState, type ReviewState } from "@/components/meeting/MeetingTabs";
import type { PlanState } from "@/components/meeting/PlanView";
import { StatusBadge } from "@/components/StatusBadge";
import { redactSecrets } from "@/lib/ai/env";
import { fetchChatHistory } from "@/lib/chat/service";
import { formatDateTime, formatDuration } from "@/lib/format";
import { deriveMeetingChips } from "@/lib/meetings";
import { minutesDocumentSchema } from "@/lib/minutes/schema";
import { participantsSchema } from "@/lib/participants";
import { fetchCurrentPlan } from "@/lib/plans/service";
import { reviewContentSchema } from "@/lib/reviews/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Conteúdo da ficha de uma reunião (cabeçalho + abas). Usado tanto pela rota
 * cheia (`/reunioes/[id]`) quanto pelo painel interceptado no desktop
 * (`@modal/(.)reunioes/[id]`), para não duplicar as consultas ao Supabase.
 */
export async function MeetingDetailContent({ meetingId }: { meetingId: string }) {
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      "id, title, status, started_at, duration_seconds, meeting_type, client_name, participants, context, project_id"
    )
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    notFound();
  }

  const { data: project } = meeting.project_id
    ? await supabase.from("projects").select("id, name").eq("id", meeting.project_id).maybeSingle()
    : { data: null };

  const { data: chunks } = await supabase
    .from("meeting_chunks")
    .select("idx, part_no, transcript, created_at")
    .eq("meeting_id", meetingId)
    .order("idx", { ascending: true });

  const { data: links } = await supabase
    .from("meeting_links")
    .select("previous_meeting_id")
    .eq("meeting_id", meetingId);
  const previousMeetingIds = (links ?? []).map((link) => link.previous_meeting_id);
  const { data: previousMeetings } =
    previousMeetingIds.length > 0
      ? await supabase
          .from("meetings")
          .select("id, title, started_at")
          .in("id", previousMeetingIds)
          .order("started_at", { ascending: false })
      : { data: [] as { id: string; title: string; started_at: string }[] };

  const { data: minutesRow } = await supabase
    .from("meeting_minutes")
    .select("status, error, error_detail, content")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: reviewRow } = await supabase
    .from("meeting_reviews")
    .select("status, error, error_detail, content")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: opinionRows } = await supabase
    .from("meeting_opinions")
    .select("id, offset_seconds, text, kind, prompt")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  const [currentPlan, chatHistory] = await Promise.all([
    fetchCurrentPlan(supabase, meetingId),
    fetchChatHistory(supabase, meetingId),
  ]);
  const plan: PlanState = currentPlan ? { summary: currentPlan.plan.summary, tasks: currentPlan.tasks } : null;
  const chatHasContent =
    (minutesRow?.status === "ready" && minutesRow.content !== null) ||
    (reviewRow?.status === "ready" && reviewRow.content !== null) ||
    (chunks ?? []).length > 0 ||
    chatHistory.length > 0;

  const minutes: MinutesState | null = minutesRow
    ? {
        status: minutesRow.status,
        // Nunca mostra o campo bruto do banco: já é gravado sanitizado (ver
        // lib/minutes/service.ts), mas essa é a última linha de defesa antes
        // da tela — nenhum erro antigo ou futuro bug chega ao navegador cru.
        error: minutesRow.error ? redactSecrets(minutesRow.error) : null,
        errorDetail: minutesRow.error_detail ? redactSecrets(minutesRow.error_detail) : null,
        document: minutesRow.status === "ready" ? parseMinutesDocument(minutesRow.content) : null,
      }
    : null;

  const review: ReviewState | null = reviewRow
    ? {
        status: reviewRow.status,
        error: reviewRow.error ? redactSecrets(reviewRow.error) : null,
        errorDetail: reviewRow.error_detail ? redactSecrets(reviewRow.error_detail) : null,
        content: reviewRow.status === "ready" ? parseReviewContent(reviewRow.content) : null,
      }
    : null;

  const isRecording = meeting.status === "recording";
  const participants = participantsSchema.safeParse(meeting.participants);
  const chips = deriveMeetingChips({
    meetingStatus: meeting.status,
    hasReadyMinutes: minutesRow?.status === "ready",
    hasReadyReview: reviewRow?.status === "ready",
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold text-text">{meeting.title}</h1>
        <p className="text-sm text-text-secondary">
          {formatDateTime(meeting.started_at)}
          {" · "}
          {isRecording ? "Em andamento" : formatDuration(meeting.duration_seconds)}
        </p>
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <StatusBadge key={chip} status={chip} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        {isRecording ? (
          <Link
            href={`/nova?meetingId=${meetingId}`}
            className="flex min-h-11 items-center font-semibold text-record"
          >
            Continuar gravação
          </Link>
        ) : (
          <span />
        )}
        <MeetingActions
          meetingId={meetingId}
          showFinishWithoutRecording={isRecording}
          afterDelete="/"
        />
      </div>

      <MeetingSetupSection
        meetingId={meetingId}
        value={{
          meeting_type: meeting.meeting_type,
          title: meeting.title,
          client_name: meeting.client_name ?? "",
          participants: participants.success ? participants.data : [],
          context: meeting.context ?? "",
          project_id: meeting.project_id,
        }}
      />

      {project && (
        <Link
          href={`/projetos/${project.id}`}
          className="flex min-h-11 items-center justify-between rounded-xl border border-border bg-surface px-4 text-sm text-text"
        >
          <span>Projeto</span>
          <span className="font-semibold text-accent">{project.name}</span>
        </Link>
      )}

      <MeetingTabs
        meetingId={meetingId}
        meetingStatus={meeting.status}
        minutes={minutes}
        review={review}
        plan={plan}
        chatMessages={chatHistory}
        chatHasContent={chatHasContent}
        meetingSetup={{
          title: meeting.title,
          meeting_type: meeting.meeting_type,
          client_name: meeting.client_name ?? "",
          participants: participants.success ? participants.data : [],
          context: meeting.context ?? "",
          project_id: meeting.project_id,
        }}
        opinions={opinionRows ?? []}
        chunks={chunks ?? []}
        previousMeetings={previousMeetings ?? []}
      />
    </div>
  );
}

function parseMinutesDocument(content: unknown) {
  const parsed = minutesDocumentSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

function parseReviewContent(content: unknown) {
  const parsed = reviewContentSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}
