-- Busca (CLAUDE.md, FASE 4): full-text do Postgres sobre reuniões, atas, pareceres
-- e tarefas. `security invoker` + `owner_id = auth.uid()` em cada ramo: roda com o
-- RLS do usuário que chama, e reforça o filtro por dono mesmo assim (defesa em
-- profundidade — não depende só das políticas das tabelas de origem).
create or replace function public.search_meetings_content(search_query text)
returns table (
  kind text,
  meeting_id uuid,
  title text,
  snippet text,
  rank real
)
language sql stable security invoker
set search_path = public
as $$
  with q as (select websearch_to_tsquery('portuguese', search_query) as tsq)
  select
    'reuniao' as kind,
    m.id as meeting_id,
    m.title,
    left(m.title || coalesce(' · ' || m.client_name, ''), 240) as snippet,
    ts_rank(to_tsvector('portuguese', m.title || ' ' || coalesce(m.client_name, '')), q.tsq) as rank
  from public.meetings m, q
  where m.owner_id = auth.uid()
    and to_tsvector('portuguese', m.title || ' ' || coalesce(m.client_name, '')) @@ q.tsq

  union all

  select
    'ata',
    mm.meeting_id,
    me.title,
    left(coalesce(mm.content->>'ata_formal', ''), 240),
    ts_rank(to_tsvector('portuguese', coalesce(mm.content->>'ata_formal', '')), q.tsq)
  from public.meeting_minutes mm
  join public.meetings me on me.id = mm.meeting_id, q
  where me.owner_id = auth.uid()
    and mm.status = 'ready'
    and to_tsvector('portuguese', coalesce(mm.content->>'ata_formal', '')) @@ q.tsq

  union all

  select
    'parecer',
    mr.meeting_id,
    me.title,
    left(coalesce(mr.content->>'diagnostico', '') || ' ' || coalesce(mr.content->>'avaliacao', ''), 240),
    ts_rank(
      to_tsvector('portuguese', coalesce(mr.content->>'diagnostico', '') || ' ' || coalesce(mr.content->>'avaliacao', '')),
      q.tsq
    )
  from public.meeting_reviews mr
  join public.meetings me on me.id = mr.meeting_id, q
  where me.owner_id = auth.uid()
    and mr.status = 'ready'
    and to_tsvector(
      'portuguese',
      coalesce(mr.content->>'diagnostico', '') || ' ' || coalesce(mr.content->>'avaliacao', '')
    ) @@ q.tsq

  union all

  select
    'tarefa',
    dt.meeting_id,
    me.title,
    left(dt.title || ' — ' || dt.description, 240),
    ts_rank(to_tsvector('portuguese', dt.title || ' ' || dt.description), q.tsq)
  from public.dev_tasks dt
  join public.meetings me on me.id = dt.meeting_id, q
  where me.owner_id = auth.uid()
    and to_tsvector('portuguese', dt.title || ' ' || dt.description) @@ q.tsq

  order by rank desc
  limit 30;
$$;
