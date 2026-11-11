-- Logo opcional no cabeçalho da ata (CLAUDE.md, FASE 2 do Configurações). Sem
-- Supabase Storage na v1 (restrição 1): a imagem, pequena, fica como data URI
-- direto na linha de company_context — não é um arquivo em disco nem num bucket.
alter table public.company_context
  add column letterhead_logo text;
