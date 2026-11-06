import { getOpenAIClient } from "./openai";

const PROMPT_TAIL_CHARS = 400;
const MOCK_TRANSCRIPT = "Transcrição simulada (MOCK_AI=1).";

/**
 * Monta o `prompt` do Whisper: vocabulário da empresa seguido do final do
 * trecho anterior, para manter a consistência de termos entre trechos.
 */
export function buildWhisperPrompt(vocabulary: string, previousTranscript: string): string {
  const tail = previousTranscript.slice(-PROMPT_TAIL_CHARS).trim();
  return [vocabulary.trim(), tail].filter(Boolean).join("\n");
}

export async function transcribeAudio(file: File, prompt: string): Promise<string> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_TRANSCRIPT;
  }

  const transcription = await getOpenAIClient().audio.transcriptions.create({
    file,
    model: process.env.TRANSCRIBE_MODEL || "whisper-1",
    prompt,
    language: "pt",
  });

  return transcription.text;
}
