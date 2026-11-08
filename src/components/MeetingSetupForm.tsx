"use client";

import { useState } from "react";
import type { Participant } from "@/lib/participants";

export type MeetingSetupValue = {
  meeting_type: "client" | "internal";
  title: string;
  client_name: string;
  participants: Participant[];
  context: string;
};

const EMPTY_VALUE: MeetingSetupValue = {
  meeting_type: "client",
  title: "",
  client_name: "",
  participants: [],
  context: "",
};

type PreparedMeeting = {
  meeting_type: "client" | "internal" | null;
  title: string | null;
  client_name: string | null;
  participants: Participant[];
  context: string | null;
};

export function MeetingSetupForm({
  initialValue,
  onSubmit,
  submitLabel,
  showAiAssist = false,
}: {
  initialValue?: Partial<MeetingSetupValue>;
  onSubmit: (value: MeetingSetupValue) => Promise<void>;
  submitLabel: string;
  showAiAssist?: boolean;
}) {
  const [value, setValue] = useState<MeetingSetupValue>({ ...EMPTY_VALUE, ...initialValue });
  const [submitting, setSubmitting] = useState(false);

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function updateField<K extends keyof MeetingSetupValue>(key: K, fieldValue: MeetingSetupValue[K]) {
    setValue((prev) => ({ ...prev, [key]: fieldValue }));
  }

  function addParticipant() {
    updateField("participants", [...value.participants, { name: "", role: "" }]);
  }

  function updateParticipant(index: number, field: "name" | "role", fieldValue: string) {
    updateField(
      "participants",
      value.participants.map((participant, i) =>
        i === index ? { ...participant, [field]: fieldValue } : participant
      )
    );
  }

  function removeParticipant(index: number) {
    updateField(
      "participants",
      value.participants.filter((_, i) => i !== index)
    );
  }

  async function handleAiAssist() {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/meetings/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText }),
      });
      const data: PreparedMeeting | { error: string } = await response.json();
      if (!response.ok || "error" in data) {
        setAiError("error" in data ? data.error : "Não foi possível preparar a reunião.");
        return;
      }
      setValue((prev) => ({
        meeting_type: data.meeting_type ?? prev.meeting_type,
        title: data.title ?? prev.title,
        client_name: data.client_name ?? prev.client_name,
        participants: data.participants.length > 0 ? data.participants : prev.participants,
        context: data.context ?? prev.context,
      }));
    } catch {
      setAiError("Não foi possível preparar a reunião. Preencha manualmente.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        ...value,
        participants: value.participants
          .map((participant) => ({ name: participant.name.trim(), role: participant.role?.trim() }))
          .filter((participant) => participant.name.length > 0),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      {showAiAssist && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent-soft bg-accent-soft p-4">
          <label htmlFor="ai-text" className="text-sm font-medium text-text">
            Peça para o Claude preparar
          </label>
          <textarea
            id="ai-text"
            value={aiText}
            onChange={(event) => setAiText(event.target.value)}
            rows={2}
            placeholder='Ex.: "reunião com a Dra. Marina, do escritório de advocacia, sobre automação de contratos; participam eu e a Ana Julia"'
            className="rounded-lg border border-border bg-surface p-3 text-sm text-text outline-none focus:border-accent"
          />
          {aiError && (
            <p role="alert" className="text-sm text-record">
              {aiError}
            </p>
          )}
          <button
            type="button"
            onClick={handleAiAssist}
            disabled={aiLoading || !aiText.trim()}
            className="flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white disabled:opacity-60"
          >
            {aiLoading ? "Preparando..." : "Preencher com IA"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Tipo</span>
        <div className="flex gap-2">
          {(["client", "internal"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateField("meeting_type", type)}
              className={`flex h-11 flex-1 items-center justify-center rounded-lg border px-3 text-sm font-medium ${
                value.meeting_type === type
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-text-secondary"
              }`}
            >
              {type === "client" ? "Cliente ou parceiro" : "Interna (sócios e equipe)"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-text">
          Título (opcional)
        </label>
        <input
          id="title"
          value={value.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="Se vazio, uso a data e a hora"
          className="h-12 rounded-lg border border-border bg-surface px-3 text-base text-text outline-none focus:border-accent"
        />
      </div>

      {value.meeting_type === "client" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="client_name" className="text-sm font-medium text-text">
            Cliente ou empresa
          </label>
          <input
            id="client_name"
            value={value.client_name}
            onChange={(event) => updateField("client_name", event.target.value)}
            className="h-12 rounded-lg border border-border bg-surface px-3 text-base text-text outline-none focus:border-accent"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text">Participantes (opcional)</span>
        {value.participants.map((participant, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={participant.name}
              onChange={(event) => updateParticipant(index, "name", event.target.value)}
              placeholder="Nome"
              className="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
            />
            <input
              value={participant.role ?? ""}
              onChange={(event) => updateParticipant(index, "role", event.target.value)}
              placeholder="Cargo ou função"
              className="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => removeParticipant(index)}
              aria-label="Remover participante"
              className="flex h-11 w-11 items-center justify-center text-record"
            >
              ✕
            </button>
          </div>
        ))}
        {value.participants.length < 20 && (
          <button
            type="button"
            onClick={addParticipant}
            className="flex h-11 items-center justify-center self-start rounded-lg border border-border px-4 text-sm font-semibold text-accent"
          >
            + Adicionar participante
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="context" className="text-sm font-medium text-text">
          Contexto da reunião (opcional)
        </label>
        <textarea
          id="context"
          value={value.context}
          onChange={(event) => updateField("context", event.target.value)}
          rows={3}
          placeholder="Assunto e objetivo da conversa"
          className="rounded-lg border border-border bg-surface p-3 text-base text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Projeto de código (opcional)</span>
        <select
          disabled
          className="h-12 rounded-lg border border-border bg-surface px-3 text-base text-text-secondary"
        >
          <option>Nenhum projeto disponível ainda (chega na Fase 7)</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-[56px] items-center justify-center rounded-xl bg-accent text-base font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Preparando..." : submitLabel}
      </button>
    </form>
  );
}
