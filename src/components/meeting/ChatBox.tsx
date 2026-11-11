"use client";

import { Check, Clipboard, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Participant } from "@/lib/participants";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type MeetingSetup = {
  title: string;
  meeting_type: "client" | "internal";
  client_name: string;
  participants: Participant[];
  context: string;
  project_id: string | null;
};

/** Chat da reunião: contínuo entre sessões, resposta do Claude em streaming. */
export function ChatBox({
  meetingId,
  initialMessages,
  hasContent,
  meetingSetup,
}: {
  meetingId: string;
  initialMessages: ChatMessage[];
  hasContent: boolean;
  meetingSetup: MeetingSetup;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const nextIdRef = useRef(0);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError(null);

    const userId = `local-${nextIdRef.current++}`;
    const assistantId = `local-${nextIdRef.current++}`;
    setMessages((previous) => [
      ...previous,
      { id: userId, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStreaming(true);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível conversar agora. Tente de novo.");
        setMessages((previous) => previous.filter((message) => message.id !== assistantId));
        setStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const delta = decoder.decode(value, { stream: true });
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId ? { ...message, content: message.content + delta } : message
          )
        );
      }
    } catch {
      setError("A conexão caiu no meio da resposta. Tente de novo.");
    } finally {
      setStreaming(false);
    }
  }

  async function continueInNewSession() {
    setStartingSession(true);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meetingSetup.title,
          meeting_type: meetingSetup.meeting_type,
          client_name: meetingSetup.client_name || undefined,
          participants: meetingSetup.participants,
          context: meetingSetup.context || undefined,
          project_id: meetingSetup.project_id ?? undefined,
          previous_meeting_ids: [meetingId],
          link_type: "session",
        }),
      });
      if (!response.ok) throw new Error("falha ao criar sessão");
      const data: { id: string; title: string } = await response.json();
      router.push(`/nova?meetingId=${data.id}&freshTitle=${encodeURIComponent(data.title)}`);
    } catch {
      setError("Não foi possível continuar em nova sessão. Tente de novo.");
      setStartingSession(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <button
        type="button"
        onClick={continueInNewSession}
        disabled={startingSession}
        className="flex h-10 items-center justify-center rounded-xl border border-border text-sm font-semibold text-accent disabled:opacity-60"
      >
        {startingSession ? "Preparando nova sessão..." : "Continuar em nova sessão"}
      </button>

      <div className="flex flex-1 flex-col gap-3">
        {messages.length === 0 ? (
          hasContent ? (
            <p className="text-text-secondary">
              Pergunte algo sobre esta reunião, ou peça a opinião do Claude sobre o que foi discutido.
            </p>
          ) : (
            <p className="text-text-secondary">
              Ainda não há conteúdo desta reunião (transcrição, ata ou parecer) para conversar.
            </p>
          )
        ) : (
          messages.map((message) => <ChatBubble key={message.id} message={message} />)
        )}
      </div>

      {error && <p className="text-sm text-record">{error}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={!hasContent || streaming}
          placeholder="Conversar com Claude sobre a reunião..."
          rows={1}
          className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface p-3 text-sm text-text outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!hasContent || streaming || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-60"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="self-end rounded-2xl bg-accent-soft px-4 py-3 text-sm text-text">
        {message.content}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="whitespace-pre-wrap text-sm text-text">{message.content || "..."}</p>
      {message.content && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(message.content).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="flex items-center gap-1.5 self-start text-xs font-semibold text-accent"
        >
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      )}
    </div>
  );
}
