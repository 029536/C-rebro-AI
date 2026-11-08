-- De quais reuniões anteriores esta reunião "parte" (memória entre reuniões).
create table public.meeting_links (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  previous_meeting_id uuid not null references public.meetings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, previous_meeting_id),
  check (meeting_id <> previous_meeting_id)
);

alter table public.meeting_links enable row level security;

-- As duas pontas precisam pertencer ao usuário logado, tanto para ler quanto para criar.
create policy meeting_links_owner_all on public.meeting_links
  for all to authenticated
  using (public.owns_meeting(meeting_id) and public.owns_meeting(previous_meeting_id))
  with check (public.owns_meeting(meeting_id) and public.owns_meeting(previous_meeting_id));
