"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MeetingActions({
  meetingId,
  showFinishWithoutRecording = false,
  showArchiveToggle = false,
  isArchived = false,
  afterDelete,
}: {
  meetingId: string;
  showFinishWithoutRecording?: boolean;
  showArchiveToggle?: boolean;
  isArchived?: boolean;
  /** Para onde ir depois de excluir. Sem isso, só atualiza a página atual. */
  afterDelete?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(action: string) {
    setBusy(true);
    await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Excluir esta reunião e tudo nela? Essa ação não pode ser desfeita.")) {
      return;
    }
    setBusy(true);
    await fetch(`/api/meetings/${meetingId}`, { method: "DELETE" });
    if (afterDelete) {
      router.push(afterDelete);
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {showFinishWithoutRecording && (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch("finish")}
          className="flex min-h-11 items-center font-semibold text-text-secondary disabled:opacity-60"
        >
          Encerrar sem gravar mais
        </button>
      )}
      {showArchiveToggle && (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch(isArchived ? "unarchive" : "archive")}
          className="flex min-h-11 items-center font-semibold text-text-secondary disabled:opacity-60"
        >
          {isArchived ? "Desarquivar" : "Arquivar"}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={remove}
        className="flex min-h-11 items-center font-semibold text-record disabled:opacity-60"
      >
        Excluir
      </button>
    </div>
  );
}
