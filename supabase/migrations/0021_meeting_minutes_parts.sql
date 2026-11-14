-- Ata em partes (map-reduce, CLAUDE.md): cada parte de uma reunião longa é
-- gerada e salva separadamente, para "Tentar de novo" refazer só as que
-- falharam em vez da reunião inteira de novo.
create table public.meeting_minutes_parts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  minutes_id uuid not null references public.meeting_minutes(id) on delete cascade,
  part_index integer not null,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'error')),
  content jsonb,
  quick_summary text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (minutes_id, part_index)
);
create index meeting_minutes_parts_minutes_idx on public.meeting_minutes_parts (minutes_id, part_index);
create trigger meeting_minutes_parts_set_updated_at before update on public.meeting_minutes_parts
  for each row execute function public.set_updated_at();

alter table public.meeting_minutes_parts enable row level security;
create policy meeting_minutes_parts_owner_all on public.meeting_minutes_parts
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));
