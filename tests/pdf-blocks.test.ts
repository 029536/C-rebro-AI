import { describe, expect, it } from "vitest";
import {
  buildAtaPdfBlocks,
  buildPlanPdfBlocks,
  buildReviewPdfBlocks,
  buildTranscriptPdfBlocks,
  selectPdfDocuments,
} from "@/lib/pdf/blocks";
import type { MinutesDocument } from "@/lib/minutes/schema";
import type { ReviewContent } from "@/lib/reviews/schema";

const ATA: MinutesDocument = {
  titulo: "Alinhamento do sistema jurídico",
  data: "2026-11-14",
  horario: "10:00",
  tipo: "client",
  cliente_ou_empresa: "Cliente X",
  participantes: [{ name: "Isaias", role: "Sócio" }, { name: "Fulana", role: undefined }],
  assuntos_discutidos: ["Assunto 1"],
  decisoes: ["Decisão 1"],
  responsabilidades: [],
  acoes_futuras: [],
  observacoes: null,
  resumo_executivo: "Resumo.",
  proximos_encontros: [],
  ata_formal: "ATA DE REUNIÃO\n\nTexto corrido da ata.",
};

const REVIEW: ReviewContent = {
  diagnostico: "Diagnóstico de teste.",
  avaliacao: "Avaliação de teste.",
  como_desenvolveria: ["Passo 1", "Passo 2"],
  perguntas_criticas: ["Pergunta 1?"],
};

describe("buildAtaPdfBlocks", () => {
  it("usa o título da ata e inclui data, cliente e participantes no meta", () => {
    const result = buildAtaPdfBlocks(ATA);
    expect(result.kind).toBe("ata");
    expect(result.title).toBe("Alinhamento do sistema jurídico");
    expect(result.metaLines.join(" ")).toContain("2026-11-14");
    expect(result.metaLines.join(" ")).toContain("Cliente X");
    expect(result.blocks).toEqual([{ type: "paragraph", text: ATA.ata_formal }]);
  });

  it("reunião interna não mostra cliente, mostra 'reunião interna'", () => {
    const result = buildAtaPdfBlocks({ ...ATA, tipo: "internal", cliente_ou_empresa: null });
    expect(result.metaLines.join(" ")).toContain("reunião interna");
    expect(result.metaLines.join(" ")).not.toContain("Cliente X");
  });
});

describe("buildReviewPdfBlocks", () => {
  it("monta diagnóstico, avaliação e as duas listas, só quando não vazias", () => {
    const result = buildReviewPdfBlocks(REVIEW, "Reunião de teste");
    expect(result.kind).toBe("parecer");
    expect(result.title).toContain("Reunião de teste");
    expect(result.blocks).toContainEqual({ type: "paragraph", text: "Diagnóstico de teste." });
    expect(result.blocks).toContainEqual({ type: "bullets", items: ["Passo 1", "Passo 2"] });
  });

  it("omite as seções de lista quando vêm vazias", () => {
    const result = buildReviewPdfBlocks({ ...REVIEW, como_desenvolveria: [], perguntas_criticas: [] }, "T");
    expect(result.blocks.some((block) => block.type === "bullets")).toBe(false);
  });
});

describe("buildPlanPdfBlocks", () => {
  const tasks = [
    { position: 1, title: "Tarefa 1", description: "desc 1", acceptance: "aceite 1", priority: "alta" as const, depends_on: [], prompt_md: "prompt 1" },
    { position: 2, title: "Tarefa 2", description: "desc 2", acceptance: "aceite 2", priority: "media" as const, depends_on: [1], prompt_md: "prompt 2" },
  ];

  it("resolve depends_on para o título da tarefa, não a posição crua", () => {
    const result = buildPlanPdfBlocks({ summary: "Resumo do plano.", tasks }, "Reunião de teste");
    const task2Meta = result.blocks.find((block) => block.type === "paragraph" && block.text.includes("Depende de"));
    expect(task2Meta).toBeDefined();
    expect((task2Meta as { text: string }).text).toContain("Tarefa 1");
  });

  it("inclui o prompt_md de cada tarefa como bloco monospace", () => {
    const result = buildPlanPdfBlocks({ summary: "Resumo.", tasks }, "T");
    const monospaceBlocks = result.blocks.filter((block) => block.type === "monospace");
    expect(monospaceBlocks).toHaveLength(2);
    expect((monospaceBlocks[0] as { text: string }).text).toBe("prompt 1");
  });
});

describe("buildTranscriptPdfBlocks", () => {
  it("marca o início de cada parte só quando o part_no muda", () => {
    const result = buildTranscriptPdfBlocks(
      [
        { part_no: 1, transcript: "Fala 1." },
        { part_no: 1, transcript: "Fala 2." },
        { part_no: 2, transcript: "Fala 3." },
      ],
      "T"
    );
    const headings = result.blocks.filter((block) => block.type === "heading");
    expect(headings).toHaveLength(2);
    expect((headings[0] as { text: string }).text).toContain("Parte 1");
    expect((headings[1] as { text: string }).text).toContain("Parte 2");
  });
});

describe("selectPdfDocuments", () => {
  const params = {
    selection: { ata: true, parecer: true, plano: true, transcricao: true },
    ata: ATA,
    review: REVIEW,
    plan: { summary: "R", tasks: [{ position: 1, title: "T", description: "d", acceptance: "a", priority: "alta" as const, depends_on: [], prompt_md: "p" }] },
    chunks: [{ part_no: 1, transcript: "Fala." }],
    meetingTitle: "Reunião de teste",
  };

  it("inclui os quatro, na ordem ata, parecer, plano, transcrição", () => {
    const docs = selectPdfDocuments(params);
    expect(docs.map((doc) => doc.kind)).toEqual(["ata", "parecer", "plano", "transcricao"]);
  });

  it("pula o que foi desmarcado, mesmo existindo", () => {
    const docs = selectPdfDocuments({ ...params, selection: { ata: true, parecer: false, plano: false, transcricao: false } });
    expect(docs.map((doc) => doc.kind)).toEqual(["ata"]);
  });

  it("pula o que não existe ainda, mesmo marcado", () => {
    const docs = selectPdfDocuments({ ...params, ata: null, review: null, plan: null, chunks: null });
    expect(docs).toEqual([]);
  });

  it("desmarcando só a transcrição, os outros três continuam entrando", () => {
    const docs = selectPdfDocuments({ ...params, selection: { ...params.selection, transcricao: false } });
    expect(docs.map((doc) => doc.kind)).toEqual(["ata", "parecer", "plano"]);
  });
});
