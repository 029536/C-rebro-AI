"use client";

import { useEffect, useState } from "react";
import { Recorder } from "@/components/Recorder";

export default function NovaReuniaoPage() {
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((response) => {
        if (!response.ok) throw new Error("falha ao criar reunião");
        return response.json() as Promise<{ id: string }>;
      })
      .then((data) => {
        if (!cancelled) setMeetingId(data.id);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="p-4 text-record">
        Não foi possível começar a reunião. Volte e tente de novo.
      </p>
    );
  }

  if (!meetingId) {
    return <p className="p-4 text-text-secondary">Preparando...</p>;
  }

  return <Recorder meetingId={meetingId} />;
}
