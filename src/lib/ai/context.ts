import { FULL_TRANSCRIPT_MAX_CHARS } from "@/lib/config";

export type ContextCheckpoint = { partNo: number; summary: string };
export type ContextChunk = { idx: number; partNo: number; transcript: string };

export type BuiltContext = {
  /** Resumos das partes fechadas, prontos para a tag <resumos_das_partes> (null se não usado). */
  checkpointsBlock: string | null;
  /** Transcrição a enviar: da parte atual, ou a reunião inteira quando ela couber. */
  transcriptBlock: string;
  /** true quando a transcrição inteira coube em FULL_TRANSCRIPT_MAX_CHARS. */
  usedFullTranscript: boolean;
};

function joinTranscripts(chunks: ContextChunk[]): string {
  return chunks
    .map((chunk) => chunk.transcript.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Monta o contexto do Claude na ordem do CLAUDE.md: checkpoints das partes
 * anteriores + transcrição da parte atual; se a transcrição inteira da
 * reunião couber em `fullTranscriptMaxChars`, usa ela por inteiro em vez dos
 * checkpoints (vale para parecer e plano).
 */
export function buildContext(params: {
  checkpoints: ContextCheckpoint[];
  chunks: ContextChunk[];
  currentPartNo: number;
  fullTranscriptMaxChars?: number;
}): BuiltContext {
  const fullTranscriptMaxChars = params.fullTranscriptMaxChars ?? FULL_TRANSCRIPT_MAX_CHARS;
  const fullTranscript = joinTranscripts(params.chunks);

  if (fullTranscript.length <= fullTranscriptMaxChars) {
    return { checkpointsBlock: null, transcriptBlock: fullTranscript, usedFullTranscript: true };
  }

  const checkpointsBlock = params.checkpoints.length
    ? [...params.checkpoints]
        .sort((a, b) => a.partNo - b.partNo)
        .map((checkpoint) => `Parte ${checkpoint.partNo}:\n${checkpoint.summary}`)
        .join("\n\n")
    : null;

  const currentPartTranscript = joinTranscripts(
    params.chunks.filter((chunk) => chunk.partNo === params.currentPartNo)
  );

  return { checkpointsBlock, transcriptBlock: currentPartTranscript, usedFullTranscript: false };
}
