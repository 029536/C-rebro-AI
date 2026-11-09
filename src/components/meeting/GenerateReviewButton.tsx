"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateReviewButton({
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
    const response = await fetch(`/api/meetings/${meetingId}/reviews`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível gerar o parecer.");
      // Mesmo numa falha, o servidor já salvou o detalhe técnico em
      // meeting_reviews; atualiza a aba para mostrá-lo.
      router.refresh();
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
        {busy ? "Gerando parecer..." : label}
      </button>
      {error && <p className="text-sm text-record">{error}</p>}
    </div>
  );
}
