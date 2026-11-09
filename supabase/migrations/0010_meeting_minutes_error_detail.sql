-- Detalhe técnico (seguro) de uma falha ao gerar a ata: HTTP, tipo do erro e
-- id da solicitação devolvidos pela própria Anthropic — nunca cabeçalho nem
-- chave, que nunca chegam a esta coluna (ver lib/ai/anthropic.ts,
-- describeAnthropicErrorDetail). Mostrado em texto pequeno e cinza abaixo da
-- mensagem amigável em `error`, só para facilitar diagnóstico.
alter table public.meeting_minutes
  add column error_detail text;
