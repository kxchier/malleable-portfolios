-- NON-DESTRUCTIVE migration from the legacy username schema.
-- Safe to run more than once in the Supabase SQL editor.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'portfolios'
      and column_name = 'username'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'portfolios'
      and column_name = 'participant_id'
  ) then
    alter table public.portfolios rename column username to participant_id;
  end if;
end
$$;

-- This also supports an unusual partial schema that has neither column.
alter table public.portfolios add column if not exists participant_id text;
update public.portfolios
set participant_id = 'legacy-' || left(id::text, 8)
where participant_id is null or btrim(participant_id) = '';
alter table public.portfolios alter column participant_id set not null;

drop index if exists public.portfolios_username_idx;
create unique index if not exists portfolios_participant_id_key
  on public.portfolios(participant_id);
create index if not exists portfolios_participant_id_idx
  on public.portfolios(participant_id);

commit;

-- Ask PostgREST to immediately discover the migrated column.
notify pgrst, 'reload schema';
