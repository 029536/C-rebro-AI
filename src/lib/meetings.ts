/** Título padrão quando a reunião é criada sem título (fluxo normal do botão "Nova reunião"). */
export function defaultMeetingTitle(now: Date = new Date()): string {
  const date = now.toLocaleDateString("pt-BR");
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Reunião ${date} ${time}`;
}
