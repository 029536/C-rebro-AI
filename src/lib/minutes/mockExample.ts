import type { MinutesDocument } from "@/lib/minutes/schema";

/**
 * Documento de exemplo exibido na aba Ata enquanto a geração real (Anthropic,
 * etapa 4 da Fase 3.7) não está ligada. Nunca é salvo em `meeting_minutes`;
 * só ilustra o formato final na interface.
 */
export const MOCK_MINUTES_EXAMPLE: MinutesDocument = {
  titulo: "Reunião de alinhamento — automação de contratos",
  data: "2026-11-08",
  horario: "14:30",
  tipo: "client",
  cliente_ou_empresa: "Dra. Marina Souza — escritório de advocacia",
  participantes: [
    { name: "Isaias", role: "Sócio, Saber Crescer" },
    { name: "Marina Souza", role: "Cliente" },
  ],
  assuntos_discutidos: [
    "Processo atual de elaboração de contratos de prestação de serviços",
    "Pontos de retrabalho na revisão manual de cláusulas",
  ],
  decisoes: [
    "Começar a automação pelo contrato de prestação de serviços, por ser o mais recorrente",
  ],
  responsabilidades: [
    { parte: "Saber Crescer", itens: ["Mapear o fluxo atual de geração de contratos"] },
    { parte: "Cliente", itens: ["Enviar os três últimos contratos fechados como referência"] },
  ],
  acoes_futuras: [
    { acao: "Enviar proposta de escopo", responsavel: "Isaias", prazo: "2026-11-15" },
  ],
  observacoes: null,
  resumo_executivo:
    "Reunião definiu o escopo inicial da automação de contratos, começando pelo contrato de prestação de serviços.",
  proximos_encontros: [{ data: "2026-11-20", objetivo: "Revisar a proposta de escopo" }],
  ata_formal: `ATA DE REUNIÃO

Título: Reunião de alinhamento — automação de contratos
Data: 08/11/2026, 14:30
Cliente: Dra. Marina Souza — escritório de advocacia
Participantes: Isaias (Sócio, Saber Crescer), Marina Souza (Cliente)

Assuntos discutidos:
- Processo atual de elaboração de contratos de prestação de serviços
- Pontos de retrabalho na revisão manual de cláusulas

Decisões:
- Começar a automação pelo contrato de prestação de serviços, por ser o mais recorrente

Responsabilidades:
- Saber Crescer: mapear o fluxo atual de geração de contratos
- Cliente: enviar os três últimos contratos fechados como referência

Ações futuras:
- Enviar proposta de escopo (Isaias, até 15/11/2026)

Próximo encontro: 20/11/2026 — revisar a proposta de escopo`,
};
