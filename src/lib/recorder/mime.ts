export type RecorderMime = {
  mimeType: string;
  extension: string;
};

// Ordem de preferência: webm/opus (Chrome/Android) antes de mp4/AAC (Safari/iPhone,
// que não suporta webm).
const CANDIDATES: RecorderMime[] = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "mp4" },
  { mimeType: "audio/mp4", extension: "mp4" },
];

/**
 * Escolhe o melhor MIME de gravação suportado pelo navegador. Recebe
 * `isTypeSupported` por injeção para ser testável fora do navegador.
 */
export function pickRecorderMime(
  isTypeSupported: (mimeType: string) => boolean
): RecorderMime | null {
  return CANDIDATES.find((candidate) => isTypeSupported(candidate.mimeType)) ?? null;
}

export function browserIsTypeSupported(mimeType: string): boolean {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType);
}
