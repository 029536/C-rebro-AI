import { CHUNK_SECONDS } from "@/lib/config";
import { browserIsTypeSupported, pickRecorderMime } from "./mime";

export type RecorderError =
  | { type: "unsupported" }
  | { type: "mic-denied" }
  | { type: "recorder-error"; message: string };

export type RecorderChunk = {
  blob: Blob;
  mimeType: string;
  extension: string;
  audioSeconds: number;
};

export type MeetingRecorderOptions = {
  onChunk: (chunk: RecorderChunk) => void;
  onError: (error: RecorderError) => void;
  onTick?: (elapsedSeconds: number) => void;
  chunkSeconds?: number;
};

/**
 * Grava o microfone em trechos de `CHUNK_SECONDS`, parando e reiniciando o
 * MediaRecorder a cada trecho (garante um arquivo de áudio válido por envio).
 * Só funciona no navegador; não é coberto por teste automatizado (ver
 * checklist manual no CLAUDE.md).
 */
export class MeetingRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mime: { mimeType: string; extension: string } | null = null;
  private recording = false;
  private segmentStartedAt = 0;
  private elapsedSeconds = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private segmentTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: MeetingRecorderOptions) {}

  get isRecording(): boolean {
    return this.recording;
  }

  /** Para a onda sonora (AudioWave) ler o volume real do microfone — não usado na transcrição em si. */
  get mediaStream(): MediaStream | null {
    return this.stream;
  }

  async start(): Promise<void> {
    const mime = pickRecorderMime(browserIsTypeSupported);
    if (!mime) {
      this.options.onError({ type: "unsupported" });
      return;
    }
    this.mime = mime;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.options.onError({ type: "mic-denied" });
      return;
    }

    this.recording = true;
    this.elapsedSeconds = 0;
    this.tickTimer = setInterval(() => {
      this.elapsedSeconds += 1;
      this.options.onTick?.(this.elapsedSeconds);
    }, 1000);

    this.startSegment();
  }

  stop(): void {
    this.recording = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.segmentTimer) clearTimeout(this.segmentTimer);
    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach((track) => track.stop());
  }

  private startSegment(): void {
    if (!this.stream || !this.mime) return;

    const mime = this.mime;
    const recorder = new MediaRecorder(this.stream, { mimeType: mime.mimeType });
    const parts: Blob[] = [];
    this.segmentStartedAt = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) parts.push(event.data);
    };

    recorder.onerror = (event) => {
      const message = "error" in event ? String((event as unknown as { error?: unknown }).error) : "erro desconhecido";
      this.options.onError({ type: "recorder-error", message });
    };

    recorder.onstop = () => {
      const audioSeconds = Math.max(1, Math.round((Date.now() - this.segmentStartedAt) / 1000));
      const blob = new Blob(parts, { type: mime.mimeType });
      if (blob.size > 0) {
        this.options.onChunk({ blob, mimeType: mime.mimeType, extension: mime.extension, audioSeconds });
      }
      if (this.recording) {
        this.startSegment();
      }
    };

    this.mediaRecorder = recorder;
    recorder.start();

    const seconds = this.options.chunkSeconds ?? CHUNK_SECONDS;
    this.segmentTimer = setTimeout(() => {
      if (this.mediaRecorder === recorder && this.recording) {
        recorder.stop();
      }
    }, seconds * 1000);
  }
}
