-- Rascunho de geração do plano (CLAUDE.md): workspace temporário onde cada
-- tarefa é salva assim que o prompt_md fica pronto, para "Tentar de novo"
-- refazer só as que falharam, sem regerar o esqueleto inteiro de novo.
-- Separado de dev_plans/dev_tasks, que continuam sendo o plano JÁ COMMITADO
-- (com a lógica de preservar tarefas feitas ao regenerar).
create table public.dev_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  status text not null default 'generating' check (status in ('generating', 'ready', 'error')),
  summary text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dev_plan_drafts_meeting_idx on public.dev_plan_drafts (meeting_id, created_at desc);
create trigger dev_plan_drafts_set_updated_at before update on public.dev_plan_drafts
  for each row execute function public.set_updated_at();

create table public.dev_plan_task_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.dev_plan_drafts(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  position integer not null,
  title text not null,
  description text not null default '',
  acceptance text not null default '',
  priority text not null default 'media' check (priority in ('alta', 'media', 'baixa')),
  depends_on integer[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'error')),
  prompt_md text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, position)
);
create index dev_plan_task_drafts_draft_idx on public.dev_plan_task_drafts (draft_id, position);
create trigger dev_plan_task_drafts_set_updated_at before update on public.dev_plan_task_drafts
  for each row execute function public.set_updated_at();

alter table public.dev_plan_drafts enable row level security;
alter table public.dev_plan_task_drafts enable row level security;

create policy dev_plan_drafts_owner_all on public.dev_plan_drafts
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));

create policy dev_plan_task_drafts_owner_all on public.dev_plan_task_drafts
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));
