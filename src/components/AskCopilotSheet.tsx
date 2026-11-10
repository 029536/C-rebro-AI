"use client";

import { HelpCircle, MessageSquare, Sparkles, X } from "lucide-react";
import { useState } from "react";

export type AskCopilotChoice =
  | { kind: "opiniao" }
  | { kind: "pergunta" }
  | { kind: "resposta"; question: string };

/** Folha "Pedir ao Claude": Opinar / Fazer perguntas / Responder (CLAUDE.md, copiloto). */
export function AskCopilotSheet({
  onClose,
  onSubmit,
  busy,
}: {
  onClose: () => void;
  onSubmit: (choice: AskCopilotChoice) => void;
  busy: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-4 pb-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-text">Pedir ao Claude</span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center text-text-secondary disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        {!asking ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onSubmit({ kind: "opiniao" })}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-4 text-left text-text disabled:opacity-60"
            >
              <Sparkles size={20} className="shrink-0 text-accent" />
              <span>
                <span className="block font-semibold">Opinar</span>
                <span className="block text-sm text-text-secondary">
                  Comentário e avaliação do que foi dito
                </span>
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSubmit({ kind: "pergunta" })}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-4 text-left text-text disabled:opacity-60"
            >
              <HelpCircle size={20} className="shrink-0 text-accent" />
              <span>
                <span className="block font-semibold">Fazer perguntas</span>
                <span className="block text-sm text-text-secondary">
                  2 a 3 perguntas pertinentes ao assunto atual
                </span>
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAsking(true)}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-4 text-left text-text disabled:opacity-60"
            >
              <MessageSquare size={20} className="shrink-0 text-accent" />
              <span>
                <span className="block font-semibold">Responder</span>
                <span className="block text-sm text-text-secondary">
                  Pergunte algo e o Claude responde com base na reunião
                </span>
              </span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (question.trim()) onSubmit({ kind: "resposta", question: question.trim() });
            }}
            className="flex flex-col gap-3"
          >
            <textarea
              autoFocus
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="O que você quer perguntar?"
              rows={3}
              maxLength={500}
              disabled={busy}
              className="rounded-xl border border-border bg-background p-3 text-text outline-none focus:border-accent disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="flex h-12 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Claude pensando..." : "Perguntar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
