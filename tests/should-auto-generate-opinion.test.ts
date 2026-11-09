import { describe, expect, it } from "vitest";
import { shouldAutoGenerateOpinion } from "@/lib/meetings";

describe("shouldAutoGenerateOpinion", () => {
  it("não opina quando o interruptor está desligado, mesmo com bastante fala nova", () => {
    expect(
      shouldAutoGenerateOpinion({ autoOpineEnabled: false, isGenerating: false, newTranscriptChars: 10_000 })
    ).toBe(false);
  });

  it("não opina enquanto já há uma chamada em andamento (nunca duas ao mesmo tempo)", () => {
    expect(
      shouldAutoGenerateOpinion({ autoOpineEnabled: true, isGenerating: true, newTranscriptChars: 10_000 })
    ).toBe(false);
  });

  it("não opina sem fala nova suficiente (nada de chamada repetida à toa)", () => {
    expect(
      shouldAutoGenerateOpinion({ autoOpineEnabled: true, isGenerating: false, newTranscriptChars: 50 })
    ).toBe(false);
  });

  it("opina quando ligado, livre, e com fala nova suficiente", () => {
    expect(
      shouldAutoGenerateOpinion({ autoOpineEnabled: true, isGenerating: false, newTranscriptChars: 2_000 })
    ).toBe(true);
  });

  it("respeita um limite customizado de caracteres", () => {
    expect(
      shouldAutoGenerateOpinion({
        autoOpineEnabled: true,
        isGenerating: false,
        newTranscriptChars: 100,
        minNewChars: 50,
      })
    ).toBe(true);
  });
});
