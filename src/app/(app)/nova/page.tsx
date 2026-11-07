"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Recorder } from "@/components/Recorder";

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
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (resumeMeetingId) {
          const response = await fetch(`/api/meetings/${resumeMeetingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "resume" }),
          });
          if (!response.ok) throw new Error("falha ao retomar reunião");
          const data: { part_no: number; next_idx: number } = await response.json();
          if (!cancelled) {
            setSession({
              meetingId: resumeMeetingId,
              initialPartNo: data.part_no,
              initialIdx: data.next_idx,
            });
          }
          return;
        }

        const response = await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!response.ok) throw new Error("falha ao criar reunião");
        const data: { id: string } = await response.json();
        if (!cancelled) {
          setSession({ meetingId: data.id, initialPartNo: 1, initialIdx: 0 });
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [resumeMeetingId]);

  if (error) {
    return (
      <p role="alert" className="p-4 text-record">
        Não foi possível começar a reunião. Volte e tente de novo.
      </p>
    );
  }

  if (!session) {
    return <p className="p-4 text-text-secondary">Preparando...</p>;
  }

  return (
    <Recorder
      meetingId={session.meetingId}
      initialPartNo={session.initialPartNo}
      initialIdx={session.initialIdx}
    />
  );
}
