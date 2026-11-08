import type { Participant } from "@/lib/participants";
import { getOpenAIClient } from "./openai";

const PROMPT_TAIL_CHARS = 400;
const MOCK_TRANSCRIPT = "Transcrição simulada (MOCK_AI=1).";

/**
 * Junta o vocabulário da empresa com os nomes e cargos dos participantes, o
 * cliente e o contexto desta reunião — para o Whisper reconhecer nomes
 * próprios que não apareceriam no vocabulário genérico da empresa.
 */
export function buildMeetingVocabulary(params: {
  companyVocabulary: string;
  clientName?: string | null;
  participants: Participant[];
  context?: string | null;
}): string {
  const participantNames = params.participants.map((participant) =>
    participant.role ? `${participant.name} (${participant.role})` : participant.name
  );

  return [params.companyVocabulary, params.clientName, ...participantNames, params.context]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Monta o `prompt` do Whisper: vocabulário (empresa + reunião) seguido do
 * final do trecho anterior, para manter a consistência de termos entre
 * trechos.
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
