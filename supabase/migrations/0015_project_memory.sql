-- Memória do projeto (CLAUDE.md, FASE 3): resumo vivo, atualizado após cada reunião
-- encerrada do projeto — decisões firmes, estado real, pendências. Uma linha por
-- projeto, sempre sobrescrita (não é histórico de versões, como a ata/parecer).
create table public.project_memory (
  project_id uuid primary key references public.projects(id) on delete cascade,
  summary text not null default '',
  updated_at timestamptz not null default now()
);
create trigger project_memory_set_updated_at before update on public.project_memory
  for each row execute function public.set_updated_at();

alter table public.project_memory enable row level security;
create policy project_memory_owner_all on public.project_memory
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

-- Tarefas do plano, por projeto (além de por reunião) — para a tela do projeto listar
-- o andamento de todas as reuniões, e o plano de uma nova reunião considerar o que já
-- existe no projeto para não duplicar.
alter table public.dev_tasks add column project_id uuid references public.projects(id) on delete set null;
create index dev_tasks_project_idx on public.dev_tasks (project_id);
