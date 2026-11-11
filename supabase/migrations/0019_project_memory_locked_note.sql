-- Nota fixa da memória do projeto (CLAUDE.md, FASE 3): texto editado à mão pelo
-- usuário, que a IA NUNCA sobrescreve ao regenerar — só incorpora como verdade
-- já assentada. Separado de `summary` (mantido pela IA, incremental).
alter table public.project_memory
  add column locked_note text not null default '';
