import { z } from "zod";

export type Participant = {
  name: string;
  role?: string;
};

export const participantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

/** Até 20 participantes por reunião (ver PROMPT_INICIAL.md). */
export const participantsSchema = z.array(participantSchema).max(20);

/** "Fulana (Diretora)" ou só "Fulana" quando não há cargo/função. */
export function formatParticipant(participant: Participant): string {
  return participant.role ? `${participant.name} (${participant.role})` : participant.name;
}
