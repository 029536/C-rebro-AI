// Regras de geração da ata que não dependem de chamar o Claude (CLAUDE.md, "Ata").

const MIN_CHARS = 20;
const MIN_WORDS = 8;
// Alfabetos não latinos que o Whisper às vezes "alucina" em cima de áudio mudo/ruído
// (cirílico, árabe, kana japonês, han, hangul coreano).
const FOREIGN_SCRIPT_PATTERN = /[Ѐ-ӿ؀-ۿ぀-ヿ一-鿿가-퟿]/g;
const FOREIGN_SCRIPT_RATIO_THRESHOLD = 0.2;

/**
 * Detecta transcrição mínima demais (áudio mudo) ou que parece lixo (poucas
 * palavras, ou texto em outro alfabeto) para gerar uma ata com confiança.
 * Quando verdadeiro, a geração deve falhar com mensagem honesta, não inventar.
 */
export function isTranscriptTooSparse(transcript: string): boolean {
  const trimmed = transcript.trim();
  if (trimmed.length < MIN_CHARS) return true;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS) return true;

  const foreignMatches = trimmed.match(FOREIGN_SCRIPT_PATTERN);
  const foreignRatio = (foreignMatches?.length ?? 0) / trimmed.length;
  if (foreignRatio > FOREIGN_SCRIPT_RATIO_THRESHOLD) return true;

  return false;
}
