import { describe, expect, it } from "vitest";
import { formatParticipant, participantsSchema } from "@/lib/participants";

describe("participantsSchema", () => {
  it("aceita nome e cargo válidos", () => {
    const result = participantsSchema.safeParse([{ name: "Ana Julia", role: "Sócia" }]);
    expect(result.success).toBe(true);
  });

  it("aceita participante sem cargo", () => {
    const result = participantsSchema.safeParse([{ name: "Ana Julia" }]);
    expect(result.success).toBe(true);
    expect(result.success && result.data[0].role).toBeUndefined();
  });

  it("rejeita nome vazio", () => {
    const result = participantsSchema.safeParse([{ name: "" }]);
    expect(result.success).toBe(false);
  });

  it("rejeita nome com mais de 80 caracteres", () => {
    const result = participantsSchema.safeParse([{ name: "a".repeat(81) }]);
    expect(result.success).toBe(false);
  });

  it("rejeita mais de 20 participantes", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `Pessoa ${i}` }));
    const result = participantsSchema.safeParse(many);
    expect(result.success).toBe(false);
  });

  it("aceita lista vazia", () => {
    expect(participantsSchema.safeParse([]).success).toBe(true);
  });
});

describe("formatParticipant", () => {
  it("inclui o cargo entre parênteses quando houver", () => {
    expect(formatParticipant({ name: "Ana Julia", role: "Sócia" })).toBe("Ana Julia (Sócia)");
  });

  it("mostra só o nome quando não há cargo", () => {
    expect(formatParticipant({ name: "Ana Julia" })).toBe("Ana Julia");
  });
});
