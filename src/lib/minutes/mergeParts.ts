// Une o conteúdo de várias partes da ata (map-reduce) num só documento: listas
// concatenadas com duplicados removidos, texto corrido em ordem. Função pura.

import type { MinutesPartContent } from "./schema";

function normalizeForDedup(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Remove duplicados (ignorando maiúsculas/espaços) mantendo a primeira ocorrência. */
export function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = normalizeForDedup(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item.trim());
    }
  }
  return result;
}

export type MergedMinutesParts = {
  assuntos_discutidos: string[];
  decisoes: string[];
  responsabilidades: { parte: string; itens: string[] }[];
  acoes_futuras: { acao: string; responsavel?: string | null; prazo?: string | null }[];
  body: string;
};

/**
 * Une as partes geradas em paralelo: listas concatenadas na ordem das partes,
 * com duplicados removidos (decisão/assunto repetido entre partes, por
 * exemplo); `responsabilidades` agrupa por `parte` (mesmo nome, itens
 * somados e sem duplicar); `acoes_futuras` deduplicada pelo texto da ação
 * (mantém a primeira ocorrência, com responsável/prazo se tiver); `body` é o
 * texto corrido de cada parte, concatenado na ordem.
 */
export function mergeMinutesParts(parts: MinutesPartContent[]): MergedMinutesParts {
  const assuntos_discutidos = dedupeStrings(parts.flatMap((part) => part.assuntos_discutidos));
  const decisoes = dedupeStrings(parts.flatMap((part) => part.decisoes));

  const responsabilidadesOrder: string[] = [];
  const responsabilidadesMap = new Map<string, { parte: string; itens: string[] }>();
  for (const part of parts) {
    for (const responsabilidade of part.responsabilidades) {
      const key = normalizeForDedup(responsabilidade.parte);
      const existing = responsabilidadesMap.get(key);
      if (existing) {
        existing.itens = dedupeStrings([...existing.itens, ...responsabilidade.itens]);
      } else {
        responsabilidadesOrder.push(key);
        responsabilidadesMap.set(key, {
          parte: responsabilidade.parte,
          itens: dedupeStrings(responsabilidade.itens),
        });
      }
    }
  }

  const acoesSeen = new Set<string>();
  const acoes_futuras: MergedMinutesParts["acoes_futuras"] = [];
  for (const part of parts) {
    for (const acao of part.acoes_futuras) {
      const key = normalizeForDedup(acao.acao);
      if (!acoesSeen.has(key)) {
        acoesSeen.add(key);
        acoes_futuras.push(acao);
      }
    }
  }

  const body = parts
    .map((part) => part.ata_formal_trecho.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    assuntos_discutidos,
    decisoes,
    responsabilidades: responsabilidadesOrder.map((key) => responsabilidadesMap.get(key)!),
    acoes_futuras,
    body,
  };
}
