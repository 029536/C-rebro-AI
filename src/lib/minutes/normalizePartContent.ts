// Normaliza o conteúdo BRUTO de uma parte da ata (map-reduce, CLAUDE.md)
// antes de validar com `minutesPartContentSchema`: remove itens vazios e,
// quando uma string passa do limite de caracteres do campo, corta no
// último ponto final (ou, sem um bom ponto de corte, no próprio limite) em
// vez de reprovar a parte inteira — o texto que sobra vira um novo item da
// mesma lista, nunca é descartado. `ata_formal_trecho` nunca é tocado aqui
// (não tem limite, CLAUDE.md). Função pura, testável sem rede.

const ASSUNTO_DECISAO_MAX = 500;
const ITEM_ACAO_MAX = 300;
const LABEL_MAX = 100;

/** Divide uma string longa demais em pedaços dentro do limite, cortando no último ponto final possível; nunca perde caracteres. */
function splitOversized(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const window = text.slice(0, maxLength);
  const lastSentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  const cut = lastSentenceEnd > 0 ? lastSentenceEnd + 2 : maxLength;
  const head = text.slice(0, cut).trim();
  const rest = text.slice(cut).trim();
  if (!head) return splitOversized(rest, maxLength);
  return rest ? [head, ...splitOversized(rest, maxLength)] : [head];
}

/** Trunca um rótulo curto (nome de parte, responsável, prazo) no limite, sem cortar no meio de uma palavra — nunca vira dois itens, não há onde colocar o segundo. */
function truncateLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const window = text.slice(0, maxLength);
  const lastSpace = window.lastIndexOf(" ");
  return (lastSpace > 0 ? window.slice(0, lastSpace) : window).trim();
}

function cleanStringList(items: unknown, maxLength: number): string[] {
  if (!Array.isArray(items)) return [];
  const result: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    result.push(...splitOversized(trimmed, maxLength));
  }
  return result;
}

/**
 * Normaliza o objeto bruto devolvido pelo Claude para o formato de uma
 * parte da ata, antes de `minutesPartContentSchema.safeParse`. Devolve algo
 * que ainda pode falhar a validação (não é garantia), só reduz bem a chance
 * de reprovar por causa de um item vazio ou um pouco longo demais.
 */
export function normalizeMinutesPartContent(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const input = raw as Record<string, unknown>;

  const responsabilidades = Array.isArray(input.responsabilidades)
    ? input.responsabilidades
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          parte: typeof item.parte === "string" ? truncateLabel(item.parte.trim(), LABEL_MAX) : item.parte,
          itens: cleanStringList(item.itens, ITEM_ACAO_MAX),
        }))
    : input.responsabilidades;

  const acoesFuturas = Array.isArray(input.acoes_futuras)
    ? input.acoes_futuras
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .flatMap((item) => {
          const acao = typeof item.acao === "string" ? item.acao.trim() : "";
          if (!acao) return [];
          const responsavel =
            typeof item.responsavel === "string"
              ? truncateLabel(item.responsavel.trim(), LABEL_MAX)
              : item.responsavel;
          const prazo = typeof item.prazo === "string" ? truncateLabel(item.prazo.trim(), LABEL_MAX) : item.prazo;
          return splitOversized(acao, ITEM_ACAO_MAX).map((chunk) => ({ acao: chunk, responsavel, prazo }));
        })
    : input.acoes_futuras;

  return {
    ...input,
    assuntos_discutidos: cleanStringList(input.assuntos_discutidos, ASSUNTO_DECISAO_MAX),
    decisoes: cleanStringList(input.decisoes, ASSUNTO_DECISAO_MAX),
    responsabilidades,
    acoes_futuras: acoesFuturas,
  };
}
