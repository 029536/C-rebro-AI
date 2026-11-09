// Toda ferramenta "strict: true" da Anthropic exige additionalProperties:
// false em TODO nó do tipo "object" do input_schema — não só na raiz, também
// dentro de properties aninhadas e de items de array (documentação da
// Anthropic, "Strict tool use" / "JSON Schema limitations"). Escrever isso à
// mão em cada esquema já causou um 400 em produção por esquecimento; em vez
// de corrigir um por um, toda ferramenta passa por aqui antes de ir para a
// API.

type JSONSchema = Record<string, unknown>;

function isPlainObject(value: unknown): value is JSONSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walk(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(walk);
  }
  if (!isPlainObject(node)) {
    return node;
  }

  const result: JSONSchema = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = walk(value);
  }

  if (result.type === "object" && isPlainObject(result.properties)) {
    result.additionalProperties = false;
  }

  return result;
}

/**
 * Normaliza um `input_schema` recursivamente para o modo estrito: garante
 * `additionalProperties: false` em todo objeto, até aninhado. Não mexe em
 * `required` (campos opcionais continuam fora da lista, representados por um
 * `type` que aceita `null` — ver lib/ai/minutes.ts e lib/ai/prompts.ts).
 *
 * O tipo de retorno é deliberadamente largo (`type: "object"` fixo, resto
 * `unknown`), compatível com `Tool.InputSchema` do SDK da Anthropic, em vez
 * de preservar o tipo literal exato de entrada — os esquemas em
 * lib/ai/prompts.ts não usam `as const` por causa disso (os arrays de
 * `required` precisam continuar `string[]` mutável, não `readonly [...]`).
 */
export function toStrictInputSchema(schema: JSONSchema): { type: "object"; [key: string]: unknown } {
  const normalized = walk(schema) as JSONSchema;
  return { ...normalized, type: "object" };
}
