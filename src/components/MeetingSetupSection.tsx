"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatParticipant } from "@/lib/participants";
import { MeetingSetupForm, type MeetingSetupValue } from "./MeetingSetupForm";

export function MeetingSetupSection({
  meetingId,
  value,
}: {
  meetingId: string;
  value: MeetingSetupValue;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function save(newValue: MeetingSetupValue) {
    await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_setup",
        meeting_type: newValue.meeting_type,
        title: newValue.title.trim() || undefined,
        client_name: newValue.client_name.trim() || null,
        participants: newValue.participants,
        context: newValue.context.trim() || null,
      }),
    });
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface">
        <MeetingSetupForm initialValue={value} onSubmit={save} submitLabel="Salvar" />
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex min-h-11 items-center text-sm font-semibold text-text-secondary"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const hasDetails = value.client_name || value.participants.length > 0 || value.context;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-secondary">
          {value.meeting_type === "client" ? "Reunião com cliente ou parceiro" : "Reunião interna"}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-h-11 items-center text-sm font-semibold text-accent"
        >
          Editar
        </button>
      </div>
      {value.client_name && <p className="text-text">Cliente: {value.client_name}</p>}
      {value.participants.length > 0 && (
        <p className="text-text">Participantes: {value.participants.map(formatParticipant).join(", ")}</p>
      )}
      {value.context && <p className="text-text">{value.context}</p>}
      {!hasDetails && <p className="text-text-secondary">Sem detalhes adicionais.</p>}
    </div>
  );
}
