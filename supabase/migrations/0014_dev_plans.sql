-- Plano de execução com prompts prontos (CLAUDE.md, "Plano de execução e prompts prontos").
-- 0012 e 0013 já existem (meeting_chunks_idempotent, meeting_opinions_kind) — esta é a 0014.

create table public.dev_plans (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  summary text not null default '',
  model text,
  created_at timestamptz not null default now()
);
create index dev_plans_meeting_idx on public.dev_plans (meeting_id, created_at desc);

create table public.dev_tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  plan_id uuid not null references public.dev_plans(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  description text not null default '',
  acceptance text not null default '',
  priority text not null default 'media' check (priority in ('alta', 'media', 'baixa')),
  depends_on integer[] not null default '{}',
  prompt_md text not null default '',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  progress_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dev_tasks_plan_idx on public.dev_tasks (plan_id, position);
create index dev_tasks_meeting_idx on public.dev_tasks (meeting_id);

create trigger dev_tasks_set_updated_at
  before update on public.dev_tasks
  for each row execute function public.set_updated_at();

alter table public.dev_plans enable row level security;
alter table public.dev_tasks enable row level security;

create policy dev_plans_owner_all on public.dev_plans
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));

create policy dev_tasks_owner_all on public.dev_tasks
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));
