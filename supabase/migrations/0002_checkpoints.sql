-- Resumo imutável de cada parte de uma reunião longa.
-- Sem política de UPDATE: um checkpoint, uma vez criado, nunca é reescrito.
create table public.meeting_checkpoints (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  part_no integer not null,
  from_chunk_idx integer not null,
  to_chunk_idx integer not null,
  summary text not null,
  created_at timestamptz not null default now(),
  unique (meeting_id, part_no)
);

alter table public.meeting_checkpoints enable row level security;

create policy meeting_checkpoints_select on public.meeting_checkpoints
  for select to authenticated
  using (public.owns_meeting(meeting_id));

create policy meeting_checkpoints_insert on public.meeting_checkpoints
  for insert to authenticated
  with check (public.owns_meeting(meeting_id));

create policy meeting_checkpoints_delete on public.meeting_checkpoints
  for delete to authenticated
  using (public.owns_meeting(meeting_id));
