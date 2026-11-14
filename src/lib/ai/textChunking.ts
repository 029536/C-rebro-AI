// Divide transcrições longas em partes para gerar a ata e o plano em
// map-reduce (CLAUDE.md): cada parte vira uma chamada separada à Anthropic,
// evitando que a saída de uma chamada única estoure o limite de tokens numa
// reunião longa. Função pura, sem rede — fácil de testar.

import { MINUTES_CHUNK_TARGET_CHARS } from "@/lib/config";

const SEARCH_WINDOW_CHARS = 2_000;

/**
 * Corta `transcript` em pedaços de ~`targetChars`, preferindo cortar logo
 * depois do fim de uma frase (`.`, `!`, `?` seguido de espaço) perto do
 * tamanho alvo — nunca no meio de uma frase, quando dá para evitar.
 */
export function splitTranscriptIntoChunks(
  transcript: string,
  targetChars: number = MINUTES_CHUNK_TARGET_CHARS
): string[] {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= targetChars) return [trimmed];

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    const idealEnd = start + targetChars;
    if (idealEnd >= trimmed.length) {
      chunks.push(trimmed.slice(start).trim());
      break;
    }

    const windowStart = Math.max(start, idealEnd - SEARCH_WINDOW_CHARS);
    const windowEnd = Math.min(trimmed.length, idealEnd + SEARCH_WINDOW_CHARS);
    const window = trimmed.slice(windowStart, windowEnd);
    const sentenceEndPattern = /[.!?]\s/g;

    let end = idealEnd; // sem quebra boa por perto, corta "seco" no tamanho alvo mesmo.
    let bestBeforeIdeal = -1;
    let match: RegExpExecArray | null;
    while ((match = sentenceEndPattern.exec(window))) {
      const absolutePosition = windowStart + match.index + match[0].length;
      if (absolutePosition <= start) continue;
      if (absolutePosition >= idealEnd) {
        end = absolutePosition; // primeiro fim de frase no alvo ou depois: usa e para de procurar.
        break;
      }
      bestBeforeIdeal = absolutePosition; // candidato mais perto do alvo, por baixo.
    }
    if (end === idealEnd && bestBeforeIdeal > start) {
      end = bestBeforeIdeal;
    }

    chunks.push(trimmed.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(Boolean);
}
