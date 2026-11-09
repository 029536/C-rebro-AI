import { z } from "zod";
import { participantSchema } from "@/lib/participants";

/**
 * Documento estruturado da ata (CLAUDE.md, "Ata"). Separado do parecer: é o
 * registro fiel do que foi dito, não a opinião do Claude. `ata_formal` é o
 * texto corrido pronto para impressão (cabeçalho, corpo, fechamento).
 */
export const minutesDocumentSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  // ISO (AAAA-MM-DD): vem do servidor (ver regra "data real"), nunca inferido pelo modelo.
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve estar em AAAA-MM-DD"),
  horario: z.string().regex(/^\d{2}:\d{2}$/, "horário deve estar em HH:mm"),
  tipo: z.enum(["client", "internal"]),
  cliente_ou_empresa: z.string().trim().max(200).nullable(),
  participantes: z.array(participantSchema).max(20),
  assuntos_discutidos: z.array(z.string().trim().min(1).max(500)).max(50),
  decisoes: z.array(z.string().trim().min(1).max(500)).max(50),
  responsabilidades: z
    .array(
      z.object({
        parte: z.string().trim().min(1).max(100),
        itens: z.array(z.string().trim().min(1).max(300)).max(30),
      })
    )
    .max(20),
  acoes_futuras: z
    .array(
      z.object({
        acao: z.string().trim().min(1).max(300),
        responsavel: z.string().trim().max(100).nullable().optional(),
        prazo: z.string().trim().max(100).nullable().optional(),
      })
    )
    .max(50),
  observacoes: z.string().trim().max(4_000).nullable(),
  resumo_executivo: z.string().trim().min(1).max(2_000),
  proximos_encontros: z
    .array(
      z.object({
        data: z.string().trim().max(50).nullable().optional(),
        objetivo: z.string().trim().min(1).max(500),
      })
    )
    .max(10),
  ata_formal: z.string().trim().min(1),
});

export type MinutesDocument = z.infer<typeof minutesDocumentSchema>;

/**
 * Subconjunto que o Claude de fato preenche: tudo, menos os fatos que o
 * servidor já conhece com certeza (data, horário, tipo, cliente,
 * participantes — regras D1-D3) e que nunca dependem da transcrição.
 */
export const minutesContentSchema = minutesDocumentSchema.omit({
  data: true,
  horario: true,
  tipo: true,
  cliente_ou_empresa: true,
  participantes: true,
});

export type MinutesContent = z.infer<typeof minutesContentSchema>;
