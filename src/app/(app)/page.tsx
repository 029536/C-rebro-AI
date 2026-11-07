import Link from "next/link";
import { MeetingActions } from "@/components/MeetingActions";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function MeetingsPage() {
  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, title, started_at, duration_seconds, status")
    .order("started_at", { ascending: false });

  const inProgress = meetings?.find((meeting) => meeting.status === "recording");
  const finished = meetings?.filter((meeting) => meeting.status !== "recording") ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">Reuniões</h1>
        {!inProgress && (
          <Link
            href="/nova"
            className="flex h-[52px] items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white"
          >
            Nova reunião
          </Link>
        )}
      </div>

      {inProgress && (
        <div className="flex flex-col gap-3 rounded-xl border border-record bg-surface p-4">
          <Link href={`/reunioes/${inProgress.id}`} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-text">{inProgress.title}</p>
              <p className="text-sm text-text-secondary">Gravação interrompida</p>
            </div>
          </Link>
          <div className="flex items-center justify-between">
            <Link
              href={`/nova?meetingId=${inProgress.id}`}
              className="flex min-h-11 items-center font-semibold text-record"
            >
              Continuar gravação
            </Link>
            <MeetingActions meetingId={inProgress.id} showFinishWithoutRecording afterDelete="/" />
          </div>
        </div>
      )}

      {finished.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {finished.map((meeting) => (
            <li
              key={meeting.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <Link href={`/reunioes/${meeting.id}`} className="flex-1">
                <p className="text-text">{meeting.title}</p>
                <p className="text-sm text-text-secondary">
                  {formatDateTime(meeting.started_at)}
                </p>
              </Link>
              <MeetingActions meetingId={meeting.id} showFinishWithoutRecording={false} afterDelete="/" />
            </li>
          ))}
        </ul>
      ) : (
        !inProgress && <p className="text-text-secondary">Nenhuma reunião ainda.</p>
      )}
    </div>
  );
}
