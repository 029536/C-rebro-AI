-- Configurações simples por usuário (CLAUDE.md, FASE 4, aba Perfil): padrão do
-- interruptor "Opinar automaticamente" e intervalo dos trechos de gravação.
-- Tabela própria (não company_context, que é sobre o conteúdo da ata/empresa).
create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  default_auto_opine boolean not null default false,
  chunk_seconds integer not null default 27 check (chunk_seconds between 15 and 60),
  updated_at timestamptz not null default now()
);
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
create policy user_settings_owner_all on public.user_settings
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
