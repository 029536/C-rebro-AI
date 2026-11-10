import { describe, expect, it } from "vitest";
import { buildContext, selectRecentTranscript } from "@/lib/ai/context";

describe("buildContext", () => {
  it("usa a transcrição inteira quando ela cabe no orçamento de caracteres", () => {
    const result = buildContext({
      checkpoints: [{ partNo: 1, summary: "Resumo da parte 1." }],
      chunks: [
        { idx: 0, partNo: 1, transcript: "Olá, " },
        { idx: 1, partNo: 2, transcript: "tudo bem?" },
      ],
      currentPartNo: 2,
      fullTranscriptMaxChars: 100,
    });

    expect(result.usedFullTranscript).toBe(true);
    expect(result.checkpointsBlock).toBeNull();
    expect(result.transcriptBlock).toBe("Olá, tudo bem?");
  });

  it("usa checkpoints das partes fechadas + transcrição só da parte atual quando não cabe", () => {
    const result = buildContext({
      checkpoints: [
        { partNo: 2, summary: "Resumo da parte 2." },
        { partNo: 1, summary: "Resumo da parte 1." },
      ],
      chunks: [
        { idx: 0, partNo: 1, transcript: "assunto da parte 1" },
        { idx: 1, partNo: 2, transcript: "assunto da parte 2" },
        { idx: 2, partNo: 3, transcript: "assunto da parte 3" },
      ],
      currentPartNo: 3,
      fullTranscriptMaxChars: 10,
    });

    expect(result.usedFullTranscript).toBe(false);
    expect(result.checkpointsBlock).toBe("Parte 1:\nResumo da parte 1.\n\nParte 2:\nResumo da parte 2.");
    expect(result.transcriptBlock).toBe("assunto da parte 3");
  });

  it("não quebra sem checkpoints nem trechos", () => {
    const result = buildContext({ checkpoints: [], chunks: [], currentPartNo: 1, fullTranscriptMaxChars: 10 });
    expect(result.usedFullTranscript).toBe(true);
    expect(result.transcriptBlock).toBe("");
  });
});

describe("selectRecentTranscript", () => {
  it("devolve tudo quando a reunião inteira já cabe na janela", () => {
    const chunks = [
      { transcript: "um", audioSeconds: 30 },
      { transcript: "dois", audioSeconds: 30 },
    ];
    expect(selectRecentTranscript(chunks, 300)).toBe("um dois");
  });

  it("pega só os últimos N segundos, de trás para a frente, não a reunião inteira", () => {
    const chunks = [
      { transcript: "muito antigo, fica de fora", audioSeconds: 200 },
      { transcript: "recente um", audioSeconds: 100 },
      { transcript: "recente dois", audioSeconds: 100 },
    ];
    // Janela de 150s: pega de trás pra frente até estourar — "recente dois" (100s)
    // não basta sozinho, então inclui também "recente um" (soma 200s >= 150).
    expect(selectRecentTranscript(chunks, 150)).toBe("recente um recente dois");
  });

  it("devolve string vazia sem trechos", () => {
    expect(selectRecentTranscript([], 300)).toBe("");
  });

  it("ignora trechos com transcrição vazia dentro da janela", () => {
    const chunks = [
      { transcript: "  ", audioSeconds: 10 },
      { transcript: "texto de verdade", audioSeconds: 10 },
    ];
    expect(selectRecentTranscript(chunks, 60)).toBe("texto de verdade");
  });
});
