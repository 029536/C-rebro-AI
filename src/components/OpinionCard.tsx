"use client";

import { useState } from "react";

const COLLAPSE_THRESHOLD = 220;

/** Cartão de opinião do copiloto ("Claude opinando"): expansível, sem corte permanente. */
export function OpinionCard({
  text,
  timeLabel,
  highlighted,
}: {
  text: string;
  timeLabel: string;
  highlighted: boolean;
}) {
  const [expanded, setExpanded] = useState(highlighted);
  const isLong = text.length > COLLAPSE_THRESHOLD;
  const shown = expanded || !isLong ? text : `${text.slice(0, COLLAPSE_THRESHOLD)}…`;

  return (
    <div
      className={
        highlighted
          ? "rounded-2xl border-[1.5px] border-accent bg-accent-soft p-4"
          : "rounded-2xl border border-border bg-surface p-4 shadow-sm"
      }
    >
      <span className="text-xs font-semibold text-text-secondary">{timeLabel}</span>
      <p className="mt-1 whitespace-pre-wrap text-sm text-text">{shown}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1.5 text-xs font-semibold text-accent"
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </div>
  );
}
