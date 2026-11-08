"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Recorder } from "@/components/Recorder";
import { MeetingSetupForm, type MeetingSetupValue } from "@/components/MeetingSetupForm";

type Session = { meetingId: string; initialPartNo: number; initialIdx: number };

export default function NovaReuniaoPage() {
  return (
    <Suspense fallback={<p className="p-4 text-text-secondary">Preparando...</p>}>
      <NovaReuniaoContent />
    </Suspense>
  );
}

function NovaReuniaoContent() {
  const searchParams = useSearchParams();
  const resumeMeetingId = searchParams.get("meetingId");

  const [session, setSession] = useState<Session | null>(null);
  const [resuming, setResuming] = useState(Boolean(resumeMeetingId));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!resumeMeetingId) return;
    let cancelled = false;

    fetch(`/api/meetings/${resumeMeetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("falha ao retomar reunião");
        return response.json() as Promise<{ part_no: number; next_idx: number }>;
      })
      .then((data) => {
        if (!cancelled) {
          setSession({ meetingId: resumeMeetingId, initialPartNo: data.part_no, initialIdx: data.next_idx });
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setResuming(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resumeMeetingId]);

  async function createMeeting(value: MeetingSetupValue) {
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value.title.trim() || undefined,
          meeting_type: value.meeting_type,
          client_name: value.client_name.trim() || undefined,
          participants: value.participants,
          context: value.context.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error("falha ao criar reunião");
      const data: { id: string } = await response.json();
      setSession({ meetingId: data.id, initialPartNo: 1, initialIdx: 0 });
    } catch {
      setError(true);
    }
  }

  if (error) {
    return (
      <p role="alert" className="p-4 text-record">
        Não foi possível começar a reunião. Volte e tente de novo.
      </p>
    );
  }

  if (resuming) {
    return <p className="p-4 text-text-secondary">Preparando...</p>;
  }

  if (!session) {
    return (
      <MeetingSetupForm onSubmit={createMeeting} submitLabel="Iniciar gravação" showAiAssist />
    );
  }

  return (
    <Recorder
      meetingId={session.meetingId}
      initialPartNo={session.initialPartNo}
      initialIdx={session.initialIdx}
    />
  );
}
