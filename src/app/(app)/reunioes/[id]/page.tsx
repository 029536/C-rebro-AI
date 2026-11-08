import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetingActions } from "@/components/MeetingActions";
import { MeetingSetupSection } from "@/components/MeetingSetupSection";
import { formatDateTime, formatDuration, formatTime } from "@/lib/format";
import { participantsSchema } from "@/lib/participants";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  recording: "Gravando ou interrompida",
  ready: "Gravada",
  analyzed: "Com parecer",
};

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      "id, title, status, started_at, duration_seconds, meeting_type, client_name, participants, context"
    )
    .eq("id", id)
    .maybeSingle();

  if (!meeting) {
    notFound();
  }

  const { data: chunks } = await supabase
    .from("meeting_chunks")
    .select("idx, part_no, transcript, created_at")
    .eq("meeting_id", id)
    .order("idx", { ascending: true });

  const { data: links } = await supabase
    .from("meeting_links")
    .select("previous_meeting_id")
    .eq("meeting_id", id);
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
            href={`/nova?meetingId=${id}`}
            className="flex min-h-11 items-center font-semibold text-record"
          >
            Continuar gravação
          </Link>
        ) : (
          <span />
        )}
        <MeetingActions meetingId={id} showFinishWithoutRecording={isRecording} afterDelete="/" />
      </div>

      <MeetingSetupSection
        meetingId={id}
        value={{
          meeting_type: meeting.meeting_type,
          title: meeting.title,
          client_name: meeting.client_name ?? "",
          participants: participants.success ? participants.data : [],
          context: meeting.context ?? "",
        }}
      />

      {previousMeetings && previousMeetings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <span className="text-sm font-semibold text-text-secondary">Parte de</span>
          {previousMeetings.map((previous) => (
            <Link
              key={previous.id}
              href={`/reunioes/${previous.id}`}
              className="flex min-h-11 items-center justify-between text-text"
            >
              <span>{previous.title}</span>
              <span className="text-xs text-text-secondary">{formatDateTime(previous.started_at)}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2">
        {chunks && chunks.length > 0 ? (
          chunks.map((chunk, index) => {
            const hasMultipleParts = chunks[chunks.length - 1].part_no > 1;
            const previous = chunks[index - 1];
            const showMarker = hasMultipleParts && (!previous || previous.part_no !== chunk.part_no);
            return (
              <div key={chunk.idx}>
                {showMarker && (
                  <p className="pb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
                    Parte {chunk.part_no}, {formatTime(chunk.created_at)}
                  </p>
                )}
                <p className="text-text">{chunk.transcript}</p>
              </div>
            );
          })
        ) : (
          <p className="text-text-secondary">Ainda não há transcrição.</p>
        )}
      </div>

      {/* Parecer, plano de execução e chat chegam nas próximas fases. */}
    </div>
  );
}
