-- ---------------------------------------------------------------------------
-- stay_votes — one Backpacker Pick approval per traveler per stay.
-- A trigger keeps stays.thumbs_up in sync with the row count.
-- ---------------------------------------------------------------------------
create table if not exists public.stay_votes (
  id          uuid primary key default gen_random_uuid(),
  stay_id     uuid not null references public.stays (id) on delete cascade,
  voter_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (stay_id, voter_id)
);

create index if not exists stay_votes_stay_idx
  on public.stay_votes (stay_id);

create or replace function public.refresh_stay_votes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  sid uuid := coalesce(new.stay_id, old.stay_id);
begin
  update public.stays s set
    thumbs_up = (
      select count(*) from public.stay_votes v where v.stay_id = sid
    )
  where s.id = sid;
  return null;
end;
$$;

drop trigger if exists stay_votes_refresh on public.stay_votes;
create trigger stay_votes_refresh
  after insert or update or delete on public.stay_votes
  for each row execute function public.refresh_stay_votes();

alter table public.stay_votes enable row level security;

drop policy if exists "Picks are public" on public.stay_votes;
create policy "Picks are public"
  on public.stay_votes for select using (true);

drop policy if exists "Voters cast picks" on public.stay_votes;
create policy "Voters cast picks"
  on public.stay_votes for insert
  with check (voter_id = auth.uid());

drop policy if exists "Voters drop their picks" on public.stay_votes;
create policy "Voters drop their picks"
  on public.stay_votes for delete using (voter_id = auth.uid());
