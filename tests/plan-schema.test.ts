import { describe, expect, it } from "vitest";
import { planContentSchema } from "@/lib/plans/schema";

const validTask = {
  title: "Mapear o fluxo atual",
  description: "Entender como funciona hoje antes de mudar.",
  acceptance: "Documento curto revisado pela equipe.",
  priority: "alta" as const,
  depends_on: [],
  prompt_md: "# Prompt\n\nFaça isso.",
};

describe("planContentSchema", () => {
  it("aceita um plano completo e válido", () => {
    expect(planContentSchema.safeParse({ summary: "Resumo do plano.", tasks: [validTask] }).success).toBe(
      true
    );
  });

  it("exige pelo menos uma tarefa", () => {
    expect(planContentSchema.safeParse({ summary: "Resumo.", tasks: [] }).success).toBe(false);
  });

  it("rejeita prioridade fora de alta/media/baixa", () => {
    const invalid = { ...validTask, priority: "urgente" };
    expect(planContentSchema.safeParse({ summary: "Resumo.", tasks: [invalid] }).success).toBe(false);
  });

  it("aceita depends_on apontando para outras posições da lista", () => {
    const second = { ...validTask, depends_on: [1] };
    expect(planContentSchema.safeParse({ summary: "Resumo.", tasks: [validTask, second] }).success).toBe(
      true
    );
  });

  it("rejeita tarefa sem prompt_md", () => {
    const invalid = { ...validTask, prompt_md: "" };
    expect(planContentSchema.safeParse({ summary: "Resumo.", tasks: [invalid] }).success).toBe(false);
  });
});
