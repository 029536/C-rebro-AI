// Formatação de data/hora sempre em America/Sao_Paulo, nunca no fuso do
// servidor (a Vercel roda em UTC) nem implicitamente no fuso do navegador.

const TIME_ZONE = "America/Sao_Paulo";

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toDate(value));
}

/** AAAA-MM-DD (ISO), para campos estruturados como a ata — não para exibir na tela. */
export function formatISODate(value: Date | string): string {
  // en-CA formata datas como AAAA-MM-DD; é só um truque de locale, não troca o fuso.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(toDate(value));
}

export function formatTime(value: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(value));
}

export function formatDateTime(value: Date | string): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || totalSeconds < 0) return "—";
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h${remainingMinutes}min`;
}

/** Cronômetro da gravação (mm:ss, ou h:mm:ss passado de 1 hora) — não é hora do relógio. */
export function formatOffset(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${minutes}:${seconds}`;
}
