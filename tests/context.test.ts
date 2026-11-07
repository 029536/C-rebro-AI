import { describe, expect, it } from "vitest";
import { buildContext } from "@/lib/ai/context";

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
