"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateMinutesButton({
  meetingId,
  label,
}: {
  meetingId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/meetings/${meetingId}/minutes`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível gerar a ata.");
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Gerando ata..." : label}
      </button>
      {error && <p className="text-sm text-record">{error}</p>}
    </div>
  );
}
