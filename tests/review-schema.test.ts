import { describe, expect, it } from "vitest";
import { reviewContentSchema } from "@/lib/reviews/schema";

const validContent = {
  diagnostico: "O problema real é de processo, não de ferramenta.",
  avaliacao: "A ideia é boa, mas o escopo inicial está grande demais.",
  como_desenvolveria: ["Mapear o fluxo atual", "Validar com o cliente"],
  perguntas_criticas: ["Quem decide o escopo final?"],
};

describe("reviewContentSchema", () => {
  it("aceita um parecer completo e válido", () => {
    expect(reviewContentSchema.safeParse(validContent).success).toBe(true);
  });

  it("aceita listas vazias (melhor que inventar)", () => {
    expect(
      reviewContentSchema.safeParse({ ...validContent, como_desenvolveria: [], perguntas_criticas: [] })
        .success
    ).toBe(true);
  });

  it("exige diagnóstico e avaliação não vazios", () => {
    expect(reviewContentSchema.safeParse({ ...validContent, diagnostico: "" }).success).toBe(false);
    expect(reviewContentSchema.safeParse({ ...validContent, avaliacao: "" }).success).toBe(false);
  });

  it("rejeita quando como_desenvolveria ou perguntas_criticas não são listas de texto", () => {
    expect(
      reviewContentSchema.safeParse({ ...validContent, como_desenvolveria: "não é lista" }).success
    ).toBe(false);
  });
});
