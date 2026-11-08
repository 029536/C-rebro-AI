import Link from "next/link";
import { MeetingActions } from "@/components/MeetingActions";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const STATUS_BADGE: Record<string, string> = {
  ready: "Gravada",
  analyzed: "Com parecer",
};

function previewFromMarkdown(markdown: string): string {
  const plain = markdown.replace(/^#+\s.*$/gm, "").replace(/\s+/g, " ").trim();
  return plain.length > 140 ? `${plain.slice(0, 140)}…` : plain;
}

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
  const { data: analyses } =
    recentIds.length > 0
      ? await supabase
          .from("analyses")
          .select("meeting_id, content_md, created_at")
          .in("meeting_id", recentIds)
          .order("created_at", { ascending: false })
      : { data: [] as { meeting_id: string; content_md: string; created_at: string }[] };

  const latestPreview = new Map<string, string>();
  for (const analysis of analyses ?? []) {
    if (!latestPreview.has(analysis.meeting_id)) {
      latestPreview.set(analysis.meeting_id, previewFromMarkdown(analysis.content_md));
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-background p-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-text">Reuniões</h1>
          <Link
            href="/nova"
            className="flex h-[52px] items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white"
          >
            Nova reunião
          </Link>
        </div>
        <div className="flex gap-4 text-sm font-medium">
          <Link
            href="/"
            className={showArchived ? "text-text-secondary" : "border-b-2 border-accent text-accent"}
          >
            Recentes
          </Link>
          <Link
            href="/?arquivadas=1"
            className={showArchived ? "border-b-2 border-accent text-accent" : "text-text-secondary"}
          >
            Arquivadas
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {inProgress.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Em andamento
            </h2>
            {inProgress.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-col gap-3 rounded-xl border border-record bg-surface p-4"
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

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            {showArchived ? "Arquivadas" : "Recentes"}
          </h2>

          {recent.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {recent.map((meeting) => (
                <li key={meeting.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
                  <Link href={`/reunioes/${meeting.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-text">{meeting.title}</p>
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                        {STATUS_BADGE[meeting.status] ?? meeting.status}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">{formatDateTime(meeting.started_at)}</p>
                    {latestPreview.has(meeting.id) && (
                      <p className="mt-1 text-sm text-text-secondary">{latestPreview.get(meeting.id)}</p>
                    )}
                  </Link>
                  <MeetingActions
                    meetingId={meeting.id}
                    showArchiveToggle
                    isArchived={showArchived}
                    afterDelete="/"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary">
              {showArchived ? "Nenhuma reunião arquivada." : "Nenhuma reunião ainda."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
