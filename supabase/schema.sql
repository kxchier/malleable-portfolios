-- Optional Supabase schema for anonymous participant portfolio sessions.
-- Run this in the Supabase SQL editor, then paste your project URL and anon key
-- into scripts/supabase-config.js.
-- Also enable anonymous sign-ins in Supabase Auth settings.

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_id text not null unique,
  theme_json jsonb not null default '{}'::jsonb,
  content_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- `create table if not exists` does not upgrade a table created by older
-- versions of this project. Preserve those rows by renaming the legacy column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'portfolios' and column_name = 'username'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'portfolios' and column_name = 'participant_id'
  ) then
    alter table public.portfolios rename column username to participant_id;
  end if;
end
$$;

alter table public.portfolios add column if not exists participant_id text;
update public.portfolios
set participant_id = 'legacy-' || left(id::text, 8)
where participant_id is null or btrim(participant_id) = '';
alter table public.portfolios alter column participant_id set not null;

create unique index if not exists portfolios_user_id_key on public.portfolios(user_id);

alter table public.portfolios enable row level security;

drop policy if exists "Public can read portfolios" on public.portfolios;
create policy "Public can read portfolios"
on public.portfolios
for select
using (true);

drop policy if exists "Users can insert their own portfolio" on public.portfolios;
create policy "Users can insert their own portfolio"
on public.portfolios
for insert
with check (true);

drop policy if exists "Users can update their own portfolio" on public.portfolios;
create policy "Users can update their own portfolio"
on public.portfolios
for update
using (true)
with check (true);

create index if not exists portfolios_participant_id_idx on public.portfolios(participant_id);
create unique index if not exists portfolios_participant_id_key on public.portfolios(participant_id);

notify pgrst, 'reload schema';
