"use client";

import {
  ClipboardCheck,
  FileText,
  HelpCircle,
  History,
  ListChecks,
  ListOrdered,
  MessageSquare,
  Scale,
  ScrollText,
  Stethoscope,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { GenerateMinutesButton } from "@/components/meeting/GenerateMinutesButton";
import { MinutesView } from "@/components/meeting/MinutesView";
import { formatDateTime, formatTime } from "@/lib/format";
import type { MinutesDocument } from "@/lib/minutes/schema";
import Link from "next/link";

type TabKey = "parecer" | "ata" | "plano" | "chat" | "transcricao" | "sessoes";

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: "parecer", label: "Parecer da IA", icon: ClipboardCheck },
  { key: "ata", label: "Ata completa", icon: FileText },
  { key: "plano", label: "Plano", icon: ListChecks },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "transcricao", label: "Transcrição", icon: ScrollText },
  { key: "sessoes", label: "Sessões", icon: History },
];

type Chunk = { idx: number; part_no: number; transcript: string; created_at: string };
type PreviousMeeting = { id: string; title: string; started_at: string };
export type MinutesState = {
  status: "pending" | "generating" | "ready" | "error";
  error: string | null;
  errorDetail: string | null;
  document: MinutesDocument | null;
};

export function MeetingTabs({
  meetingId,
  meetingStatus,
  minutes,
  chunks,
  previousMeetings,
}: {
  meetingId: string;
  meetingStatus: string;
  minutes: MinutesState | null;
  chunks: Chunk[];
  previousMeetings: PreviousMeeting[];
}) {
  const [active, setActive] = useState<TabKey>("parecer");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-border px-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold tracking-wide uppercase ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {active === "ata" && (
          <AtaTab meetingId={meetingId} meetingStatus={meetingStatus} minutes={minutes} />
        )}

        {active === "parecer" && <ParecerTab />}
        {active === "plano" && (
          <ComingSoon text="O plano de execução com prompts prontos chega numa próxima etapa." />
        )}
        {active === "chat" && (
          <ComingSoon text="A conversa sobre a reunião chega numa próxima etapa." />
        )}

        {active === "transcricao" && <TranscriptTab chunks={chunks} />}
        {active === "sessoes" && <SessionsTab previousMeetings={previousMeetings} />}
      </div>
    </div>
  );
}

function ComingSoon({ text }: { text: string }) {
  return <p className="text-text-secondary">{text}</p>;
}

const PARECER_SECTIONS = [
  { title: "Meu diagnóstico", icon: Stethoscope },
  { title: "Minha avaliação das ideias", icon: Scale },
  { title: "Como eu desenvolveria", icon: Wrench },
  { title: "Perguntas críticas", icon: HelpCircle },
  { title: "Prioridade recomendada", icon: ListOrdered },
] as const;

function ParecerTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-secondary">
        O parecer do Claude (a opinião do terceiro sócio) chega numa próxima etapa.
      </p>
      {PARECER_SECTIONS.map(({ title, icon: Icon }) => (
        <div
          key={title}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 opacity-60"
        >
          <Icon size={20} className="shrink-0 text-text-secondary" />
          <div>
            <p className="font-semibold text-text">{title}</p>
            <p className="text-sm text-text-secondary">Ainda não disponível</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AtaTab({
  meetingId,
  meetingStatus,
  minutes,
}: {
  meetingId: string;
  meetingStatus: string;
  minutes: MinutesState | null;
}) {
  if (meetingStatus === "recording") {
    return (
      <p className="text-text-secondary">
        A ata é gerada automaticamente assim que a gravação for encerrada.
      </p>
    );
  }

  if (!minutes || minutes.status === "error") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-text-secondary">
          {minutes?.error ?? "Esta reunião ainda não tem ata."}
        </p>
        {minutes?.errorDetail && (
          <p className="text-xs text-text-secondary">{minutes.errorDetail}</p>
        )}
        <GenerateMinutesButton
          meetingId={meetingId}
          label={minutes ? "Tentar de novo" : "Gerar ata"}
        />
      </div>
    );
  }

  if (minutes.status === "pending" || minutes.status === "generating") {
    return <p className="text-text-secondary">Gerando ata...</p>;
  }

  if (!minutes.document) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-text-secondary">A ata gerada não pôde ser lida.</p>
        <GenerateMinutesButton meetingId={meetingId} label="Tentar de novo" />
      </div>
    );
  }

  return <MinutesView document={minutes.document} />;
}

function TranscriptTab({ chunks }: { chunks: Chunk[] }) {
  if (chunks.length === 0) {
    return <p className="text-text-secondary">Ainda não há transcrição.</p>;
  }

  const hasMultipleParts = chunks[chunks.length - 1].part_no > 1;

  return (
    <div className="flex flex-col gap-2">
      {chunks.map((chunk, index) => {
        const previous = chunks[index - 1];
        const showMarker = hasMultipleParts && (!previous || previous.part_no !== chunk.part_no);
        return (
          <div key={chunk.idx}>
            {showMarker && (
              <p className="pb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
                Parte {chunk.part_no}, {formatTime(chunk.created_at)}
              </p>
            )}
            <p className="text-text">{chunk.transcript}</p>
          </div>
        );
      })}
    </div>
  );
}

function SessionsTab({ previousMeetings }: { previousMeetings: PreviousMeeting[] }) {
  if (previousMeetings.length === 0) {
    return <p className="text-text-secondary">Esta reunião não continua nenhuma outra.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-secondary">Parte de</span>
      {previousMeetings.map((previous) => (
        <Link
          key={previous.id}
          href={`/reunioes/${previous.id}`}
          className="flex min-h-11 items-center justify-between rounded-xl border border-border bg-surface px-4 text-text"
        >
          <span>{previous.title}</span>
          <span className="text-xs text-text-secondary">{formatDateTime(previous.started_at)}</span>
        </Link>
      ))}
    </div>
  );
}
