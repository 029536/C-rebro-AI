import Link from "next/link";
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
            className="flex h-13 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white"
          >
            Nova reunião
          </Link>
        )}
      </div>

      {inProgress && (
        <Link
          href={`/nova?meetingId=${inProgress.id}`}
          className="flex items-center justify-between rounded-xl border border-record bg-surface p-4"
        >
          <div>
            <p className="font-semibold text-text">{inProgress.title}</p>
            <p className="text-sm text-text-secondary">Gravação interrompida</p>
          </div>
          <span className="font-semibold text-record">Continuar gravação</span>
        </Link>
      )}

      {finished.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {finished.map((meeting) => (
            <li
              key={meeting.id}
              className="rounded-xl border border-border bg-surface p-4 text-text"
            >
              {meeting.title}
            </li>
          ))}
        </ul>
      ) : (
        !inProgress && <p className="text-text-secondary">Nenhuma reunião ainda.</p>
      )}
    </div>
  );
}
