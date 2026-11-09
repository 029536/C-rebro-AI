import { describe, expect, it } from "vitest";
import { MINUTES_INPUT_SCHEMA, PREPARE_MEETING_INPUT_SCHEMA } from "@/lib/ai/prompts";
import { toStrictInputSchema } from "@/lib/ai/strictSchema";

/**
 * Esquemas de toda ferramenta "strict: true" do projeto. Ao adicionar uma
 * nova (parecer, plano etc.), inclua aqui — é o que garante que nenhuma
 * fique sem additionalProperties: false, do jeito que causou um 400 em
 * produção.
 */
const TOOL_SCHEMAS: { name: string; schema: Record<string, unknown> }[] = [
  { name: "salvar_ata", schema: MINUTES_INPUT_SCHEMA },
  { name: "preencher_formulario", schema: PREPARE_MEETING_INPUT_SCHEMA },
];

/** Caminhos de todo nó `{ type: "object", properties: {...} }` sem `additionalProperties: false`. */
function findObjectsMissingAdditionalProperties(node: unknown, path = "input_schema"): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => findObjectsMissingAdditionalProperties(item, `${path}[${index}]`));
  }
  if (node === null || typeof node !== "object") {
    return [];
  }

  const obj = node as Record<string, unknown>;
  const problems: string[] = [];

  if (obj.type === "object" && typeof obj.properties === "object" && obj.properties !== null) {
    if (obj.additionalProperties !== false) {
      problems.push(path);
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    problems.push(...findObjectsMissingAdditionalProperties(value, `${path}.${key}`));
  }

  return problems;
}

describe("esquemas de ferramentas estritas da Anthropic", () => {
  it("o esquema cru da ata tem objeto sem additionalProperties — prova que o teste abaixo não passaria à toa", () => {
    // Regressão: é exatamente isso que causou "tools.0.custom: ... additionalProperties
    // must be explicitly set to false" em produção.
    expect(findObjectsMissingAdditionalProperties(MINUTES_INPUT_SCHEMA).length).toBeGreaterThan(0);
  });

  for (const { name, schema } of TOOL_SCHEMAS) {
    it(`${name}: depois de toStrictInputSchema, todo objeto (até aninhado em arrays/propriedades) tem additionalProperties: false`, () => {
      const normalized = toStrictInputSchema(schema);
      expect(findObjectsMissingAdditionalProperties(normalized)).toEqual([]);
    });
  }

  it("toStrictInputSchema não remove nem adiciona chaves de properties (só normaliza additionalProperties)", () => {
    const normalized = toStrictInputSchema(MINUTES_INPUT_SCHEMA) as unknown as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(normalized.properties).sort()).toEqual(
      Object.keys(MINUTES_INPUT_SCHEMA.properties).sort()
    );
  });
});
