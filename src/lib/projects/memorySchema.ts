import { z } from "zod";

export const memoryItemTipoSchema = z.enum(["decisao", "pendencia", "estado", "risco"]);
export type MemoryItemTipo = z.infer<typeof memoryItemTipoSchema>;

/**
 * Saída estruturada da atualização incremental da memória do projeto
 * (CLAUDE.md, FASE 1): itens novos, itens alterados (por id) e itens
 * resolvidos (por id) — nunca o texto corrido inteiro. `observacoes` é como a
 * IA registra discordância de um item TRAVADO, sem alterá-lo.
 */
export const memoryChangeSchema = z.object({
  novos: z
    .array(
      z.object({
        tipo: memoryItemTipoSchema,
        texto: z.string().trim().min(1).max(500),
      })
    )
    .max(20),
  alterados: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        texto: z.string().trim().min(1).max(500),
      })
    )
    .max(20),
  resolvidos: z.array(z.string().trim().min(1)).max(20),
  observacoes: z
    .array(
      z.object({
        item_id: z.string().trim().min(1),
        observacao: z.string().trim().min(1).max(500),
      })
    )
    .max(10),
});

export type MemoryChange = z.infer<typeof memoryChangeSchema>;
