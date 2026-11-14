import { describe, expect, it } from "vitest";
import { cleanDependsOn } from "@/lib/plans/dependsOn";

describe("cleanDependsOn", () => {
  it("mantém depends_on válidos intactos", () => {
    expect(cleanDependsOn([[], [1], [1, 2]])).toEqual([[], [1], [1, 2]]);
  });

  it("remove posições fora do intervalo (menor que 1 ou maior que o total)", () => {
    expect(cleanDependsOn([[], [0, 5, 1]])).toEqual([[], [1]]);
  });

  it("remove autorreferência (uma tarefa não pode depender de si mesma)", () => {
    expect(cleanDependsOn([[1], [1, 2]])).toEqual([[], [1]]);
  });

  it("remove duplicados na mesma lista", () => {
    expect(cleanDependsOn([[], [1, 1, 1]])).toEqual([[], [1]]);
  });

  it("quebra um ciclo direto (1 depende de 2, 2 depende de 1)", () => {
    const result = cleanDependsOn([[2], [1]]);
    // alguma das duas ligações precisa sumir pra não ter mais ciclo.
    expect(result[0].includes(2) && result[1].includes(1)).toBe(false);
  });

  it("quebra um ciclo indireto (1 -> 2 -> 3 -> 1)", () => {
    const result = cleanDependsOn([[3], [1], [2]]);
    const hasCycle =
      result[0].includes(3) && result[2].includes(2) && result[1].includes(1);
    expect(hasCycle).toBe(false);
  });

  it("não mexe num grafo sem ciclo, mesmo com várias dependências cruzadas", () => {
    // 2 depende de 1; 3 depende de 1 e 2; 4 depende de 3.
    const input = [[], [1], [1, 2], [3]];
    expect(cleanDependsOn(input)).toEqual(input);
  });

  it("lida com uma lista vazia de tarefas", () => {
    expect(cleanDependsOn([])).toEqual([]);
  });
});
