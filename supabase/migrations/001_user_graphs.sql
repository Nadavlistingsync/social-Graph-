-- Social Graph: per-user workspace blob (matches browser export format)
-- Apply in Supabase SQL Editor, or: SUPABASE_SECRET_KEY=… node web/scripts/apply-schema.mjs
--
-- Required for /api/graph sync (PostgREST → this table).
-- Do not use Storage for graphs; the API reads/writes user_graphs only.

create table if not exists public.user_graphs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  warmth jsonb not null default '{}'::jsonb,
  awkward_edges jsonb not null default '[]'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_graphs_updated_at_idx on public.user_graphs (updated_at desc);

alter table public.user_graphs enable row level security;

drop policy if exists "user_graphs_select_own" on public.user_graphs;
create policy "user_graphs_select_own"
  on public.user_graphs for select
  using (auth.uid() = user_id);

drop policy if exists "user_graphs_insert_own" on public.user_graphs;
create policy "user_graphs_insert_own"
  on public.user_graphs for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_graphs_update_own" on public.user_graphs;
create policy "user_graphs_update_own"
  on public.user_graphs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_graphs_delete_own" on public.user_graphs;
create policy "user_graphs_delete_own"
  on public.user_graphs for delete
  using (auth.uid() = user_id);

-- Keep updated_at fresh on write
create or replace function public.set_user_graphs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_graphs_set_updated_at on public.user_graphs;
create trigger user_graphs_set_updated_at
  before update on public.user_graphs
  for each row execute function public.set_user_graphs_updated_at();
