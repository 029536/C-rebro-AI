import { describe, expect, it } from "vitest";
import { isTranscriptTooSparse } from "@/lib/minutes/rules";

describe("isTranscriptTooSparse", () => {
  it("marca transcrição vazia ou quase vazia (áudio mudo)", () => {
    expect(isTranscriptTooSparse("")).toBe(true);
    expect(isTranscriptTooSparse("   ")).toBe(true);
    expect(isTranscriptTooSparse("ok, tudo bem")).toBe(true);
  });

  it("marca transcrição curta demais mesmo com poucas palavras longas", () => {
    expect(isTranscriptTooSparse("obrigado obrigado obrigado")).toBe(true);
  });

  it("não marca uma transcrição real de reunião", () => {
    const transcript =
      "Bom dia a todos, vamos começar a reunião de hoje sobre o andamento do projeto. " +
      "Primeiro, queria revisar o que ficou pendente da última vez e definir os próximos passos.";
    expect(isTranscriptTooSparse(transcript)).toBe(false);
  });

  it("marca texto dominado por alfabeto não latino (alucinação do Whisper em áudio ruim)", () => {
    const garbage = "원 안녕 한국어 텍스트 입니다 이것은 테스트 안녕 한국어 텍스트";
    expect(isTranscriptTooSparse(garbage)).toBe(true);
  });

  it("não marca texto em português com acentos normais", () => {
    const transcript =
      "A ação será feita até sábado, após a validação do área técnica e da diretoria envolvida.";
    expect(isTranscriptTooSparse(transcript)).toBe(false);
  });
});
