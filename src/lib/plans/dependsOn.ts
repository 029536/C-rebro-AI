// Valida e limpa `depends_on` de uma lista de tarefas (posições 1-based):
// nunca aponta para uma posição que não existe, nunca aponta pra si mesma, e
// nunca forma um ciclo — em vez de reprovar o plano todo, remove só as
// ligações problemáticas. Função pura, testável sem rede.

/** Limpa `depends_on` de cada tarefa: tira posições fora do intervalo e autorreferências. */
function clampToValidPositions(dependsOn: number[][]): number[][] {
  const total = dependsOn.length;
  return dependsOn.map((deps, index) =>
    [...new Set(deps)].filter((position) => position >= 1 && position <= total && position !== index + 1)
  );
}

/** Acha um ciclo (lista de posições, na ordem) a partir do grafo de dependências, ou null se não houver. */
function findCycle(dependsOn: number[][]): number[] | null {
  const total = dependsOn.length;
  const state = new Array<0 | 1 | 2>(total + 1).fill(0); // 0=não visitado, 1=visitando, 2=concluído
  const stack: number[] = [];

  function visit(position: number): number[] | null {
    state[position] = 1;
    stack.push(position);
    for (const dependency of dependsOn[position - 1]) {
      if (state[dependency] === 1) {
        const cycleStart = stack.indexOf(dependency);
        return stack.slice(cycleStart);
      }
      if (state[dependency] === 0) {
        const found = visit(dependency);
        if (found) return found;
      }
    }
    stack.pop();
    state[position] = 2;
    return null;
  }

  for (let position = 1; position <= total; position++) {
    if (state[position] === 0) {
      const found = visit(position);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Devolve `depends_on` limpo para cada tarefa, na mesma ordem: sem posições
 * inexistentes, sem autorreferência e sem ciclos (quebra o ciclo removendo a
 * ligação que o fecha, da última tarefa do ciclo de volta pra primeira).
 */
export function cleanDependsOn(dependsOn: number[][]): number[][] {
  const cleaned = clampToValidPositions(dependsOn);

  let cycle = findCycle(cleaned);
  let guard = 0;
  const maxIterations = cleaned.length * cleaned.length + 1;
  while (cycle && guard < maxIterations) {
    const last = cycle[cycle.length - 1];
    const first = cycle[0];
    cleaned[last - 1] = cleaned[last - 1].filter((position) => position !== first);
    cycle = findCycle(cleaned);
    guard++;
  }

  return cleaned;
}
