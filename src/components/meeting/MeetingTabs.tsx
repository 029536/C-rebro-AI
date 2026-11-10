"use client";

import {
  ClipboardCheck,
  FileText,
  HelpCircle,
  History,
  ListChecks,
  MessageSquare,
  Scale,
  ScrollText,
  Stethoscope,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GenerateMinutesButton } from "@/components/meeting/GenerateMinutesButton";
import { GenerateReviewButton } from "@/components/meeting/GenerateReviewButton";
import { MinutesView } from "@/components/meeting/MinutesView";
import { OpinionCard, type OpinionKind } from "@/components/OpinionCard";
import { formatDateTime, formatOffset, formatTime } from "@/lib/format";
import type { MinutesDocument } from "@/lib/minutes/schema";
import type { ReviewContent } from "@/lib/reviews/schema";

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
type OpinionRow = { id: string; offset_seconds: number; text: string; kind: OpinionKind; prompt: string | null };

export type MinutesState = {
  status: "pending" | "generating" | "ready" | "error";
  error: string | null;
  errorDetail: string | null;
  document: MinutesDocument | null;
};

export type ReviewState = {
  status: "pending" | "generating" | "ready" | "error";
  error: string | null;
  errorDetail: string | null;
  content: ReviewContent | null;
};

export function MeetingTabs({
  meetingId,
  meetingStatus,
  minutes,
  review,
  opinions,
  chunks,
  previousMeetings,
}: {
  meetingId: string;
  meetingStatus: string;
  minutes: MinutesState | null;
  review: ReviewState | null;
  opinions: OpinionRow[];
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

        {active === "parecer" && (
          <ParecerTab meetingId={meetingId} meetingStatus={meetingStatus} review={review} />
        )}
        {active === "plano" && (
          <ComingSoon text="O plano de execução com prompts prontos chega numa próxima etapa." />
        )}
        {active === "chat" && (
          <ComingSoon text="A conversa sobre a reunião chega numa próxima etapa." />
        )}

        {active === "transcricao" && <TranscriptTab chunks={chunks} opinions={opinions} />}
        {active === "sessoes" && <SessionsTab previousMeetings={previousMeetings} />}
      </div>
    </div>
  );
}

function ComingSoon({ text }: { text: string }) {
  return <p className="text-text-secondary">{text}</p>;
}

function ParecerTab({
  meetingId,
  meetingStatus,
  review,
}: {
  meetingId: string;
  meetingStatus: string;
  review: ReviewState | null;
}) {
  if (meetingStatus === "recording") {
    return (
      <p className="text-text-secondary">
        O parecer fica disponível depois que a gravação for encerrada.
      </p>
    );
  }

  if (!review || review.status === "error") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-text-secondary">{review?.error ?? "Esta reunião ainda não tem parecer."}</p>
        {review?.errorDetail && <p className="text-xs text-text-secondary">{review.errorDetail}</p>}
        <GenerateReviewButton
          meetingId={meetingId}
          label={review ? "Gerar de novo" : "Gerar parecer"}
        />
      </div>
    );
  }

  if (review.status === "pending" || review.status === "generating") {
    return <p className="text-text-secondary">Gerando parecer...</p>;
  }

  if (!review.content) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-text-secondary">O parecer gerado não pôde ser lido.</p>
        <GenerateReviewButton meetingId={meetingId} label="Gerar de novo" />
      </div>
    );
  }

  const content = review.content;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <GenerateReviewButton meetingId={meetingId} label="Gerar de novo" />
      </div>
      <ReviewSectionCard title="Meu diagnóstico" icon={Stethoscope} body={content.diagnostico} />
      <ReviewSectionCard title="Minha avaliação das ideias" icon={Scale} body={content.avaliacao} />
      <ReviewSectionCard title="Como eu desenvolveria" icon={Wrench} list={content.como_desenvolveria} />
      <ReviewSectionCard title="Perguntas críticas" icon={HelpCircle} list={content.perguntas_criticas} />
    </div>
  );
}

function ReviewSectionCard({
  title,
  icon: Icon,
  body,
  list,
}: {
  title: string;
  icon: typeof Stethoscope;
  body?: string;
  list?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = body
    ? body.length > 90
      ? `${body.slice(0, 90)}…`
      : body
    : `${list?.length ?? 0} item(ns)`;

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm"
    >
      <div className="flex items-start gap-3">
        <Icon size={20} className="mt-0.5 shrink-0 text-accent" />
        <div className="flex-1">
          <p className="font-semibold text-text">{title}</p>
          {!expanded && <p className="text-sm text-text-secondary">{summary}</p>}
        </div>
      </div>
      {expanded &&
        (body ? (
          <p className="whitespace-pre-wrap text-sm text-text">{body}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-9 text-sm text-text">
            {list?.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ))}
    </button>
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

function TranscriptTab({ chunks, opinions }: { chunks: Chunk[]; opinions: OpinionRow[] }) {
  const hasMultipleParts = chunks.length > 0 && chunks[chunks.length - 1].part_no > 1;

  return (
    <div className="flex flex-col gap-4">
      {opinions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Claude opinando
          </h3>
          {[...opinions].reverse().map((opinion, index) => (
            <OpinionCard
              key={opinion.id}
              text={opinion.text}
              timeLabel={formatOffset(opinion.offset_seconds)}
              kind={opinion.kind}
              prompt={opinion.prompt}
              highlighted={index === 0}
            />
          ))}
        </div>
      )}

      {chunks.length === 0 ? (
        <p className="text-text-secondary">Ainda não há transcrição.</p>
      ) : (
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
      )}
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
