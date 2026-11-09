-- Copiloto: cada opinião do Claude durante a gravação ("Claude opinando"),
-- gerada por "Pedir opinião agora" ou pelo interruptor "Opinar automaticamente".
-- Texto livre (ver CLAUDE.md), nunca reescrita — continuam visíveis depois
-- da reunião encerrar.
create table public.meeting_opinions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Minutos:segundos de gravação em que a opinião foi pedida (o cliente manda o
  -- cronômetro da tela; não é a hora do relógio).
  offset_seconds integer not null default 0,
  text text not null
);
create index meeting_opinions_meeting_idx on public.meeting_opinions (meeting_id, created_at desc);

alter table public.meeting_opinions enable row level security;

create policy meeting_opinions_owner_all on public.meeting_opinions
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));

-- Parecer: a opinião do terceiro sócio sobre a reunião inteira (saída
-- estruturada), separada da ata (registro fiel) e das opiniões do copiloto
-- (comentários em tempo real). Mesmo padrão de status/erro de
-- meeting_minutes — "Gerar de novo" cria uma nova linha, vale a mais recente.
create table public.meeting_reviews (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  content jsonb,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'error')),
  error text,
  error_detail text,
  model text,
  created_at timestamptz not null default now()
);
create index meeting_reviews_meeting_idx on public.meeting_reviews (meeting_id, created_at desc);

alter table public.meeting_reviews enable row level security;

create policy meeting_reviews_owner_all on public.meeting_reviews
  for all to authenticated
  using (public.owns_meeting(meeting_id)) with check (public.owns_meeting(meeting_id));
