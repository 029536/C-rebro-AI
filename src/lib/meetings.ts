import { PART_MINUTES } from "@/lib/config";

/** Título padrão quando a reunião é criada sem título (fluxo normal do botão "Nova reunião"). */
export function defaultMeetingTitle(now: Date = new Date()): string {
  const date = now.toLocaleDateString("pt-BR");
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Reunião ${date} ${time}`;
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
