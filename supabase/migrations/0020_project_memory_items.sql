-- Memória do projeto estruturada (CLAUDE.md, FASE 1 desta rodada): substitui o
-- texto corrido por itens individuais, editáveis e travável um a um.
create table public.project_memory_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tipo text not null check (tipo in ('decisao', 'pendencia', 'estado', 'risco')),
  texto text not null,
  travado boolean not null default false,
  resolvido boolean not null default false,
  origem_meeting_id uuid references public.meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_memory_items_project_idx on public.project_memory_items (project_id, resolvido, tipo);
create trigger project_memory_items_set_updated_at before update on public.project_memory_items
  for each row execute function public.set_updated_at();

alter table public.project_memory_items enable row level security;
create policy project_memory_items_owner_all on public.project_memory_items
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

-- Migração de dados: caminho mais seguro (ver CLAUDE.md) -- só migra o que é
-- mecânico e sem interpretação. `locked_note` já era verdade travada pelo
-- usuário, então vira UM item travado por projeto. `summary` (texto corrido,
-- livre) NÃO é dividido automaticamente em itens -- exigiria interpretar prosa
-- em categorias, o que pode errar; ele continua legível na tela como "nota
-- geral" (legado, a IA não escreve mais nele a partir de agora).
insert into public.project_memory_items (project_id, tipo, texto, travado, resolvido)
select project_id, 'estado', locked_note, true, false
from public.project_memory
where coalesce(trim(locked_note), '') <> '';
