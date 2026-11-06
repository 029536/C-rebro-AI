create extension if not exists pgcrypto;

-- Mantém updated_at em dia
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'recording' check (status in ('recording', 'ready', 'analyzed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_owner_started_idx on public.meetings (owner_id, started_at desc);
create trigger meetings_set_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

create table public.meeting_chunks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  idx integer not null,
  part_no integer not null default 1,
  transcript text not null default '',
  status text not null default 'done' check (status in ('pending', 'done', 'error')),
  error text,
  audio_seconds integer,
  created_at timestamptz not null default now(),
  unique (meeting_id, idx)
);
create index meeting_chunks_part_idx on public.meeting_chunks (meeting_id, part_no, idx);

create table public.copilot_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  kind text not null check (kind in ('auto', 'manual')),
  after_chunk_idx integer,
  content text not null,
  created_at timestamptz not null default now()
);
create index copilot_notes_meeting_idx on public.copilot_notes (meeting_id, created_at);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  content_md text not null,
  focus text,
  model text not null,
  created_at timestamptz not null default now()
);
create index analyses_meeting_idx on public.analyses (meeting_id, created_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_meeting_idx on public.chat_messages (meeting_id, created_at);

create table public.company_context (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  context text not null default '',
  vocabulary text not null default '',
  updated_at timestamptz not null default now()
);
create trigger company_context_set_updated_at before update on public.company_context
  for each row execute function public.set_updated_at();

-- Verifica se a reunião pertence ao usuário logado (usada pelas políticas das tabelas filhas)
create or replace function public.owns_meeting(mid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meetings where id = mid and owner_id = auth.uid()
  );
$$;

-- Row Level Security
alter table public.meetings enable row level security;
alter table public.meeting_chunks enable row level security;
alter table public.copilot_notes enable row level security;
alter table public.analyses enable row level security;
alter table public.chat_messages enable row level security;
alter table public.company_context enable row level security;

create policy meetings_owner_all on public.meetings
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy meeting_chunks_owner_all on public.meeting_chunks
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));

create policy copilot_notes_owner_all on public.copilot_notes
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));

create policy analyses_owner_all on public.analyses
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));

create policy chat_messages_owner_all on public.chat_messages
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));

create policy company_context_owner_all on public.company_context
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
