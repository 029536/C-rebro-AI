import { PART_MINUTES } from "@/lib/config";
import { formatDateTime } from "@/lib/format";

/** Título padrão quando a reunião é criada sem título (fluxo normal do botão "Nova reunião"). */
export function defaultMeetingTitle(now: Date = new Date()): string {
  return `Reunião ${formatDateTime(now)}`;
}

/**
 * Decide em qual parte um trecho novo entra: continua na parte atual, ou abre
 * a próxima quando a soma de `audio_seconds` da parte atual passar de
 * `PART_MINUTES`. `forceNewPartAtLeast` força pelo menos essa parte (usado
 * logo após "Continuar gravação", mesmo que a parte atual ainda seja curta).
 * Quando a parte muda, `closedPartNo` traz a parte que acabou de fechar — o
 * chamador usa isso para disparar o checkpoint.
 */
export function computeNextPartNo(params: {
  currentPartNo: number;
  currentPartSeconds: number;
  newChunkSeconds: number;
  forceNewPartAtLeast?: number;
  partMinutes?: number;
}): { partNo: number; closedPartNo: number | null } {
  const limitSeconds = (params.partMinutes ?? PART_MINUTES) * 60;
  const timeTriggered = params.currentPartSeconds + params.newChunkSeconds > limitSeconds;
  const autoPartNo = timeTriggered ? params.currentPartNo + 1 : params.currentPartNo;
  const partNo = Math.max(autoPartNo, params.forceNewPartAtLeast ?? autoPartNo);
  const closedPartNo = partNo > params.currentPartNo ? params.currentPartNo : null;
  return { partNo, closedPartNo };
}

export type MeetingSuggestion = {
  id: string;
  title: string;
  startedAt: string;
  clientName: string | null;
};

/**
 * Reordena as reuniões anteriores sugeridas em "Partir de reuniões anteriores":
 * as do mesmo cliente primeiro (mantendo a ordem relativa — já vêm da mais
 * recente para a mais antiga), depois as demais.
 */
export function sortMeetingSuggestions(
  meetings: MeetingSuggestion[],
  currentClientName: string | null | undefined
): MeetingSuggestion[] {
  const normalized = currentClientName?.trim().toLowerCase();
  if (!normalized) return meetings;

  const matches: MeetingSuggestion[] = [];
  const others: MeetingSuggestion[] = [];
  for (const meeting of meetings) {
    const isMatch = meeting.clientName?.trim().toLowerCase() === normalized;
    (isMatch ? matches : others).push(meeting);
  }
  return [...matches, ...others];
}
