-- Ata estruturada (documento fiel do que foi dito), separada do parecer (opinião do
-- Claude). Várias versões por reunião — regenerar cria uma nova linha, vale a mais
-- recente —, igual já fazemos em `analyses`.
create table public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  content jsonb,
  -- Ajuste manual do texto formal, sem precisar regenerar com IA; nulo = usar content.ata_formal.
  edited_ata_formal text,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'error')),
  error text,
  model text,
  created_at timestamptz not null default now()
);
create index meeting_minutes_meeting_idx on public.meeting_minutes (meeting_id, created_at desc);

alter table public.meeting_minutes enable row level security;

create policy meeting_minutes_owner_all on public.meeting_minutes
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));

-- Distingue "dei isso como contexto geral" (context, Fase 2.8) de "é a mesma conversa,
-- outra sessão" (session, "Continuar em nova sessão") — só os links "session" agrupam
-- reuniões num cartão "N sessões" na lista.
alter table public.meeting_links
  add column link_type text not null default 'context' check (link_type in ('context', 'session'));

-- Cabeçalho institucional da ata (texto, sem logo): até 5 linhas, validado no app.
alter table public.company_context
  add column letterhead text not null default '';
