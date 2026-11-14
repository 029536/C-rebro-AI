import { z } from "zod";

/**
 * Tarefa do plano de execução (CLAUDE.md, "Plano de execução e prompts
 * prontos"). `depends_on` são POSIÇÕES (1-based) de outras tarefas dentro do
 * MESMO lote gerado pelo Claude — ver lib/plans/service.ts para como isso é
 * remapeado ao mesclar com tarefas já marcadas como feitas.
 */
export const planTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4_000),
  acceptance: z.string().trim().max(2_000),
  priority: z.enum(["alta", "media", "baixa"]),
  depends_on: z.array(z.number().int().min(1)).max(20),
  prompt_md: z.string().trim().min(1).max(8_000),
});

export type PlanTask = z.infer<typeof planTaskSchema>;

/**
 * Tarefa só com os campos da etapa 1 do plano (CLAUDE.md, "duas etapas") —
 * sem `prompt_md`, que vem de uma chamada separada por tarefa (etapa 2).
 */
export const planTaskStubSchema = planTaskSchema.omit({ prompt_md: true });
export type PlanTaskStub = z.infer<typeof planTaskStubSchema>;

export const planTaskListSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  tasks: z.array(planTaskStubSchema).min(1).max(20),
});
export type PlanTaskList = z.infer<typeof planTaskListSchema>;

export const planContentSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  tasks: z.array(planTaskSchema).min(1).max(20),
});

export type PlanContent = z.infer<typeof planContentSchema>;

export const taskStatusSchema = z.enum(["todo", "doing", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
