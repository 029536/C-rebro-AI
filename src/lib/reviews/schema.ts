import { z } from "zod";

/**
 * Documento estruturado do parecer (CLAUDE.md, aba "Parecer da IA"): a
 * opinião do terceiro sócio sobre a reunião inteira. Diferente da ata
 * (fiel, sem opinião) — aqui o Claude julga e propõe.
 */
export const reviewContentSchema = z.object({
  diagnostico: z.string().trim().min(1).max(4_000),
  avaliacao: z.string().trim().min(1).max(4_000),
  como_desenvolveria: z.array(z.string().trim().min(1).max(500)).max(20),
  perguntas_criticas: z.array(z.string().trim().min(1).max(500)).max(20),
});

export type ReviewContent = z.infer<typeof reviewContentSchema>;
