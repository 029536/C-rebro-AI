import { ArrowLeft, Layers, Mic } from "lucide-react";
import Link from "next/link";
import { MeetingActions } from "@/components/MeetingActions";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { deriveMeetingChips, groupMeetingsBySession } from "@/lib/meetings";
import { createClient } from "@/lib/supabase/server";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivadas?: string }>;
}) {
  const { arquivadas } = await searchParams;
  const showArchived = arquivadas === "1";

  const supabase = await createClient();
  const meetingsQuery = supabase
    .from("meetings")
    .select("id, title, started_at, duration_seconds, status")
    .order("started_at", { ascending: false });

  const { data: meetings } = showArchived
    ? await meetingsQuery.not("archived_at", "is", null)
    : await meetingsQuery.is("archived_at", null);

  const inProgress = showArchived ? [] : (meetings ?? []).filter((meeting) => meeting.status === "recording");
  const recent = (meetings ?? []).filter((meeting) => meeting.status !== "recording");

  const recentIds = recent.map((meeting) => meeting.id);
  const [{ data: reviewRows }, { data: minutesRows }, { data: sessionLinks }] = await Promise.all([
    recentIds.length > 0
      ? supabase
          .from("meeting_reviews")
          .select("meeting_id, status")
          .in("meeting_id", recentIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { meeting_id: string; status: string }[] }),
    recentIds.length > 0
      ? supabase
          .from("meeting_minutes")
          .select("meeting_id, status")
          .in("meeting_id", recentIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { meeting_id: string; status: string }[] }),
    recentIds.length > 0
      ? supabase
          .from("meeting_links")
          .select("meeting_id, previous_meeting_id")
          .eq("link_type", "session")
          .in("meeting_id", recentIds)
      : Promise.resolve({ data: [] as { meeting_id: string; previous_meeting_id: string }[] }),
  ]);

  const latestReviewStatus = new Map<string, string>();
  for (const row of reviewRows ?? []) {
    if (!latestReviewStatus.has(row.meeting_id)) {
      latestReviewStatus.set(row.meeting_id, row.status);
    }
  }
  const latestMinutesStatus = new Map<string, string>();
  for (const row of minutesRows ?? []) {
    if (!latestMinutesStatus.has(row.meeting_id)) {
      latestMinutesStatus.set(row.meeting_id, row.status);
    }
  }

  type MeetingRow = (typeof recent)[number];

  const byId = new Map(recent.map((meeting) => [meeting.id, meeting]));
  const groups = groupMeetingsBySession(
    recentIds,
    (sessionLinks ?? []).map((link) => ({
      meetingId: link.meeting_id,
      previousMeetingId: link.previous_meeting_id,
    }))
  );

  const cards = groups
    .map((groupIds) => {
      const groupMeetings = groupIds
        .map((id) => byId.get(id))
        .filter((meeting): meeting is MeetingRow => meeting !== undefined)
        .sort((a, b) => b.started_at.localeCompare(a.started_at));
      return { head: groupMeetings[0], sessionCount: groupMeetings.length };
    })
    .filter((card): card is { head: MeetingRow; sessionCount: number } => card.head !== undefined)
    .sort((a, b) => b.head.started_at.localeCompare(a.head.started_at));

  if (showArchived) {
    return (
      <div className="flex flex-1 flex-col gap-5 p-4">
        <Link href="/" className="flex h-11 items-center gap-2 text-sm font-medium text-text-secondary">
          <ArrowLeft size={18} />
          Reuniões
        </Link>
        <h1 className="text-2xl font-bold text-text">Reuniões arquivadas</h1>
        <MeetingList
          cards={cards}
          showArchived
          latestReviewStatus={latestReviewStatus}
          latestMinutesStatus={latestMinutesStatus}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Reuniões</h1>
        <p className="text-sm text-text-secondary">{cards.length} reuniões gravadas</p>
      </div>

      <Link
        href="/nova"
        className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-sm"
      >
        <span className="text-base font-semibold text-text">Nova reunião</span>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
          <Mic size={28} className="text-accent" />
        </span>
        <span className="text-sm text-text-secondary">Toque para iniciar sua reunião</span>
        <span className="flex h-14 w-full items-center justify-center rounded-xl bg-accent text-base font-semibold text-white">
          Gravar
        </span>
      </Link>

      {inProgress.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Em andamento
          </h2>
          {inProgress.map((meeting) => (
            <div
              key={meeting.id}
              className="flex flex-col gap-3 rounded-2xl border border-record bg-surface p-4 shadow-sm"
            >
              <Link href={`/reunioes/${meeting.id}`}>
                <p className="font-semibold text-text">{meeting.title}</p>
                <p className="text-sm text-text-secondary">Gravação interrompida</p>
              </Link>
              <div className="flex items-center justify-between">
                <Link
                  href={`/nova?meetingId=${meeting.id}`}
                  className="flex min-h-11 items-center font-semibold text-record"
                >
                  Retomar
                </Link>
                <MeetingActions meetingId={meeting.id} afterDelete="/" />
              </div>
            </div>
          ))}
        </div>
      )}

      <MeetingList
        cards={cards}
        showArchived={false}
        latestReviewStatus={latestReviewStatus}
        latestMinutesStatus={latestMinutesStatus}
      />
    </div>
  );
}

function MeetingList({
  cards,
  showArchived,
  latestReviewStatus,
  latestMinutesStatus,
}: {
  cards: { head: { id: string; title: string; started_at: string; status: string }; sessionCount: number }[];
  showArchived: boolean;
  latestReviewStatus: Map<string, string>;
  latestMinutesStatus: Map<string, string>;
}) {
  if (cards.length === 0) {
    return (
      <p className="text-text-secondary">
        {showArchived ? "Nenhuma reunião arquivada." : "Nenhuma reunião ainda."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {cards.map(({ head: meeting, sessionCount }) => {
        const chips = deriveMeetingChips({
          meetingStatus: meeting.status,
          hasReadyMinutes: latestMinutesStatus.get(meeting.id) === "ready",
          hasReadyReview: latestReviewStatus.get(meeting.id) === "ready",
        });
        return (
          <li key={meeting.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <Link href={`/reunioes/${meeting.id}`}>
              <p className="font-semibold text-text">{meeting.title}</p>
              <p className="text-sm text-text-secondary">{formatDateTime(meeting.started_at)}</p>
              {chips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <StatusBadge key={chip} status={chip} />
                  ))}
                </div>
              )}
              {sessionCount > 1 && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-accent">
                  <Layers size={14} />
                  {sessionCount} sessões
                </p>
              )}
            </Link>
            <MeetingActions
              meetingId={meeting.id}
              showArchiveToggle
              isArchived={showArchived}
              afterDelete="/"
            />
          </li>
        );
      })}
    </ul>
  );
}
