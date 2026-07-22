-- NON-DESTRUCTIVE migration for a small public research probe.
-- Existing portfolio rows and generated layouts are preserved.
-- Anyone using the public anon key can insert or update a participant portfolio.

begin;

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

commit;
