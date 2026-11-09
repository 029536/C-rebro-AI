import { AUTO_OPINION_MIN_NEW_CHARS, PART_MINUTES } from "@/lib/config";
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
  projectId?: string | null;
};

/**
 * Reordena as reuniões anteriores sugeridas em "Partir de reuniões anteriores":
 * primeiro as do mesmo projeto, depois as do mesmo cliente, depois as demais —
 * mantendo a ordem relativa dentro de cada grupo (já vêm da mais recente para a
 * mais antiga).
 */
export function sortMeetingSuggestions(
  meetings: MeetingSuggestion[],
  filters: { clientName?: string | null; projectId?: string | null }
): MeetingSuggestion[] {
  const normalizedClient = filters.clientName?.trim().toLowerCase();
  const projectId = filters.projectId;

  if (!normalizedClient && !projectId) return meetings;

  const sameProject: MeetingSuggestion[] = [];
  const sameClient: MeetingSuggestion[] = [];
  const others: MeetingSuggestion[] = [];

  for (const meeting of meetings) {
    if (projectId && meeting.projectId === projectId) {
      sameProject.push(meeting);
    } else if (normalizedClient && meeting.clientName?.trim().toLowerCase() === normalizedClient) {
      sameClient.push(meeting);
    } else {
      others.push(meeting);
    }
  }
  return [...sameProject, ...sameClient, ...others];
}

export type SessionEdge = { meetingId: string; previousMeetingId: string };

/**
 * Agrupa reuniões ligadas por `link_type = 'session'` (continuação da mesma
 * conversa) em componentes conexos. Cada grupo é uma lista de ids na mesma
 * sessão; o chamador decide qual representa o cartão (normalmente a mais
 * recente) e usa `group.length` para o rótulo "N sessões".
 */
export function groupMeetingsBySession(
  meetingIds: string[],
  sessionEdges: SessionEdge[]
): string[][] {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    parent.set(x, root);
    return root;
  }

  function union(a: string, b: string) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  const knownIds = new Set(meetingIds);
  for (const id of meetingIds) find(id);
  for (const edge of sessionEdges) {
    if (knownIds.has(edge.meetingId) && knownIds.has(edge.previousMeetingId)) {
      union(edge.meetingId, edge.previousMeetingId);
    }
  }

  const groups = new Map<string, string[]>();
  for (const id of meetingIds) {
    const root = find(id);
    const list = groups.get(root) ?? [];
    list.push(id);
    groups.set(root, list);
  }
  return [...groups.values()];
}

export type MeetingChip = "ata" | "parecer" | "andamento";

/**
 * Quais selos mostrar no cartão da reunião na lista (Tela "Reuniões").
 * "Em andamento" é exclusivo; "Ata gerada" e "Parecer disponível" podem
 * aparecer juntos, numa reunião já encerrada que tem os dois.
 */
export function deriveMeetingChips(params: {
  meetingStatus: string;
  hasReadyMinutes: boolean;
  hasReadyReview: boolean;
}): MeetingChip[] {
  if (params.meetingStatus === "recording") {
    return ["andamento"];
  }
  const chips: MeetingChip[] = [];
  if (params.hasReadyMinutes) chips.push("ata");
  if (params.hasReadyReview) chips.push("parecer");
  return chips;
}

/**
 * Decide se o interruptor "Opinar automaticamente" deve pedir uma opinião
 * nova agora: só quando ligado, sem uma chamada já em andamento, e com fala
 * nova suficiente desde a última opinião (~2 minutos, ver
 * AUTO_OPINION_MIN_NEW_CHARS) — nunca chamadas repetidas à toa nem duas ao
 * mesmo tempo.
 */
export function shouldAutoGenerateOpinion(params: {
  autoOpineEnabled: boolean;
  isGenerating: boolean;
  newTranscriptChars: number;
  minNewChars?: number;
}): boolean {
  if (!params.autoOpineEnabled || params.isGenerating) return false;
  return params.newTranscriptChars >= (params.minNewChars ?? AUTO_OPINION_MIN_NEW_CHARS);
}
