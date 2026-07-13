-- Optional Supabase schema for public username portfolios.
-- Run this in the Supabase SQL editor, then paste your project URL and anon key
-- into scripts/supabase-config.js.
-- Also enable anonymous sign-ins in Supabase Auth settings.

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null unique,
  theme_json jsonb not null default '{}'::jsonb,
  content_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own portfolio" on public.portfolios;
create policy "Users can update their own portfolio"
on public.portfolios
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists portfolios_username_idx on public.portfolios(username);
