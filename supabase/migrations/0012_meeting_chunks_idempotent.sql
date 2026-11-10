-- Corrige a causa real do 409 repetido durante a gravação: o servidor
-- confiava no `idx` mandado pelo cliente tanto para ordenar quanto para
-- identificar reenvio — numa corrida (duas abas, "Continuar gravação"
-- em duplicidade, retentativa sobrepondo um envio ainda em andamento), dois
-- pedidos podiam calcular o mesmo idx e colidir na restrição única.
--
-- Agora `client_chunk_id` é só a chave de idempotência (o número local que o
-- navegador já gerava); o servidor sempre decide o `idx` de armazenamento,
-- com nova tentativa em caso de corrida (ver app/api/meetings/[id]/chunks/route.ts).
alter table public.meeting_chunks
  add column client_chunk_id text;

-- Backfill: nas linhas que já existem, o idx antigo era de fato único por
-- reunião (client-assigned, sem a corrida que motivou esta migração).
update public.meeting_chunks
set client_chunk_id = idx::text
where client_chunk_id is null;

alter table public.meeting_chunks
  alter column client_chunk_id set not null;

alter table public.meeting_chunks
  add constraint meeting_chunks_meeting_client_chunk_unique unique (meeting_id, client_chunk_id);
