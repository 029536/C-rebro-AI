import { PROJECT_CONTEXT_MAX_CHARS } from "@/lib/config";
import { buildMemoryItemsBlock, fetchMemoryItems } from "@/lib/projects/memoryItems";
import { selectRelevantItems } from "@/lib/projects/selectFiles";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Monta o bloco "<projeto>" (mapa do repositório, memória viva, andamento das
 * tarefas de todas as reuniões do projeto e os arquivos/documentos
 * relevantes para `recentText`) para o copiloto, parecer, plano e chat.
 * `null` quando a reunião não tem projeto ou o projeto está vazio.
 */
export async function buildProjectContextBlock(
  supabase: Supabase,
  projectId: string,
  recentText: string
): Promise<string | null> {
  const [{ data: project }, { data: legacyMemory }, { data: files }, { data: documents }, { data: tasks }, memoryItems] =
    await Promise.all([
      supabase.from("projects").select("repo_map").eq("id", projectId).maybeSingle(),
      supabase.from("project_memory").select("summary").eq("project_id", projectId).maybeSingle(),
      supabase.from("project_files").select("path, summary, content").eq("project_id", projectId),
      supabase.from("project_documents").select("filename, summary, content").eq("project_id", projectId),
      supabase
        .from("dev_tasks")
        .select("title, status, progress_note")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(80),
      fetchMemoryItems(supabase, projectId),
    ]);

  if (!project) return null;

  const items = [
    ...(files ?? [])
      .filter((file) => file.summary)
      .map((file) => ({ path: file.path, summary: file.summary as string })),
    ...(documents ?? [])
      .filter((document) => document.summary)
      .map((document) => ({ path: document.filename, summary: document.summary as string })),
  ];

  const selectedPaths = items.length > 0 ? await selectRelevantItems({ recentText, items }) : [];
  const contentByPath = new Map<string, string>();
  for (const file of files ?? []) {
    if (selectedPaths.includes(file.path)) contentByPath.set(file.path, file.content);
  }
  for (const document of documents ?? []) {
    if (selectedPaths.includes(document.filename)) contentByPath.set(document.filename, document.content);
  }

  let filesBlock = "";
  let usedChars = 0;
  for (const path of selectedPaths) {
    const content = contentByPath.get(path);
    if (!content) continue;
    const section = `### ${path}\n${content}\n\n`;
    if (usedChars + section.length > PROJECT_CONTEXT_MAX_CHARS) break;
    filesBlock += section;
    usedChars += section.length;
  }

  const tasksBlock =
    (tasks ?? []).length > 0
      ? (tasks ?? [])
          .map((task) => `- [${task.status}] ${task.title}${task.progress_note ? ` (${task.progress_note})` : ""}`)
          .join("\n")
      : null;

  const itemsBlock = buildMemoryItemsBlock(memoryItems);

  const parts: string[] = [];
  if (project.repo_map) parts.push(`Mapa do repositório:\n${project.repo_map}`);
  if (itemsBlock) {
    parts.push(
      `Memória do projeto — itens travados são verdade assentada pelo usuário, nunca os contradiga:\n${itemsBlock}`
    );
  } else if (legacyMemory?.summary) {
    // Projeto ainda sem itens estruturados (de antes desta função existir): cai para o
    // resumo corrido antigo, só como ponto de partida — não é mais atualizado por aqui.
    parts.push(`Memória do projeto (nota geral, anterior à memória estruturada):\n${legacyMemory.summary}`);
  }
  if (tasksBlock) parts.push(`Andamento das tarefas do projeto (todas as reuniões):\n${tasksBlock}`);
  if (filesBlock) parts.push(`Arquivos e documentos relevantes para o assunto atual:\n${filesBlock}`);

  return parts.length > 0 ? parts.join("\n\n") : null;
}
