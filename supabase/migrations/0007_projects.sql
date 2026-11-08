create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  repo_map text not null default '',
  file_count integer not null default 0,
  total_bytes bigint not null default 0,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id, created_at desc);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create or replace function public.owns_project(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects where id = pid and owner_id = auth.uid()
  );
$$;

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  language text,
  size_bytes integer not null default 0,
  content_hash text not null,
  content text not null,
  summary text,
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);
create trigger project_files_set_updated_at before update on public.project_files
  for each row execute function public.set_updated_at();

-- Documentos de apoio (.md, .txt, .pdf, .docx, .csv): mesma lógica dos arquivos de
-- código, mas em tabela própria porque o tratamento (extração, resumo) é diferente.
create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  filename text not null,
  size_bytes integer not null default 0,
  content_hash text not null,
  content text not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, filename)
);
create trigger project_documents_set_updated_at before update on public.project_documents
  for each row execute function public.set_updated_at();

alter table public.meetings
  add column project_id uuid references public.projects(id) on delete set null;
create index meetings_project_idx on public.meetings (project_id);

alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.project_documents enable row level security;

create policy projects_owner_all on public.projects
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy project_files_owner_all on public.project_files
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy project_documents_owner_all on public.project_documents
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));
