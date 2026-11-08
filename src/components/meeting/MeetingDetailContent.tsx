import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetingActions } from "@/components/MeetingActions";
import { MeetingSetupSection } from "@/components/MeetingSetupSection";
import { MeetingTabs } from "@/components/meeting/MeetingTabs";
import { formatDateTime, formatDuration } from "@/lib/format";
import { MOCK_MINUTES_EXAMPLE } from "@/lib/minutes/mockExample";
import { participantsSchema } from "@/lib/participants";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  recording: "Gravando ou interrompida",
  ready: "Gravada",
  analyzed: "Com parecer",
};

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

  const isRecording = meeting.status === "recording";
  const participants = participantsSchema.safeParse(meeting.participants);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold text-text">{meeting.title}</h1>
        <p className="text-sm text-text-secondary">
          {formatDateTime(meeting.started_at)} · {STATUS_LABEL[meeting.status] ?? meeting.status}
          {" · "}
          {isRecording ? "Em andamento" : formatDuration(meeting.duration_seconds)}
        </p>
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
        minutesExample={MOCK_MINUTES_EXAMPLE}
        chunks={chunks ?? []}
        previousMeetings={previousMeetings ?? []}
      />
    </div>
  );
}
