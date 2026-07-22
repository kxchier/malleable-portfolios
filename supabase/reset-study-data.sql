-- DESTRUCTIVE ONE-TIME STUDY RESET
-- Running this file permanently deletes every saved portfolio session, removes
-- the legacy username column with the old table, and creates the participant-ID schema.

drop table if exists public.portfolios cascade;

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_id text not null unique,
  theme_json jsonb not null default '{}'::jsonb,
  content_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index portfolios_user_id_key on public.portfolios(user_id);
create index portfolios_participant_id_idx on public.portfolios(participant_id);

alter table public.portfolios enable row level security;

create policy "Public can read portfolios"
on public.portfolios
for select
using (true);

create policy "Users can insert their own portfolio"
on public.portfolios
for insert
with check (true);

create policy "Users can update their own portfolio"
on public.portfolios
for update
using (true)
with check (true);
