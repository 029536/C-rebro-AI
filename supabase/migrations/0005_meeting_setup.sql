-- Dados preenchidos antes de gravar (tipo, cliente, participantes, contexto) e
-- arquivamento. "participants" é jsonb em vez de tabela própria: é uma lista
-- pequena e só lida/escrita inteira, não precisa de índice nem de join.
alter table public.meetings
  add column meeting_type text not null default 'client' check (meeting_type in ('client', 'internal')),
  add column client_name text,
  add column participants jsonb not null default '[]'::jsonb,
  add column context text,
  add column archived_at timestamptz;
