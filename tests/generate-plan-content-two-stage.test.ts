import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

class MockAnthropic {
  messages = { create };
}

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: MockAnthropic };
});

const { generatePlanContent } = await import("@/lib/ai/plan");

const BASE_PARAMS = {
  companyContext: "",
  hasProject: false,
  transcript: "algo foi dito sobre o projeto",
};

const TASK_LIST = {
  summary: "Resumo do plano.",
  tasks: [
    { title: "Tarefa 1", description: "desc 1", acceptance: "aceite 1", priority: "alta", depends_on: [] },
    { title: "Tarefa 2", description: "desc 2", acceptance: "aceite 2", priority: "media", depends_on: [1] },
  ],
};

function taskListResponse() {
  return { content: [{ type: "tool_use", id: "toolu_1", name: "salvar_plano", input: TASK_LIST }] };
}

function taskPromptResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

afterEach(() => {
  vi.unstubAllEnvs();
  create.mockReset();
});

describe("generatePlanContent (duas etapas)", () => {
  it("gera a lista de tarefas numa chamada e o prompt_md de cada tarefa em chamadas separadas", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(taskListResponse());
    create.mockResolvedValueOnce(taskPromptResponse("Prompt da tarefa 1."));
    create.mockResolvedValueOnce(taskPromptResponse("Prompt da tarefa 2."));

    const content = await generatePlanContent(BASE_PARAMS);

    // 1 chamada pra lista + 1 por tarefa = 3 no total.
    expect(create).toHaveBeenCalledTimes(3);
    expect(content.tasks).toHaveLength(2);
    expect(content.tasks[0].prompt_md).toBe("Prompt da tarefa 1.");
    expect(content.tasks[1].prompt_md).toBe("Prompt da tarefa 2.");
  });

  it("a chamada da lista usa ferramenta (tool_use); a do prompt de cada tarefa é texto livre", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(taskListResponse());
    create.mockResolvedValueOnce(taskPromptResponse("Prompt 1."));
    create.mockResolvedValueOnce(taskPromptResponse("Prompt 2."));

    await generatePlanContent(BASE_PARAMS);

    const [listCall, promptCall1, promptCall2] = create.mock.calls.map((call) => call[0]);
    expect(listCall.tools).toBeDefined();
    expect(promptCall1.tools).toBeUndefined();
    expect(promptCall2.tools).toBeUndefined();
  });

  it("se o prompt de UMA tarefa falhar, usa um prompt de reserva em vez de derrubar o plano inteiro", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-chave-de-teste-valida");
    vi.stubEnv("MOCK_AI", "0");
    create.mockResolvedValueOnce(taskListResponse());
    create.mockRejectedValueOnce(new Error("falha simulada só nesta tarefa"));
    create.mockResolvedValueOnce(taskPromptResponse("Prompt da tarefa 2, gerado normalmente."));

    const content = await generatePlanContent(BASE_PARAMS);

    expect(content.tasks).toHaveLength(2);
    expect(content.tasks[0].prompt_md).toContain("Não foi possível gerar automaticamente");
    expect(content.tasks[0].prompt_md).toContain("desc 1");
    expect(content.tasks[1].prompt_md).toBe("Prompt da tarefa 2, gerado normalmente.");
  });
});
