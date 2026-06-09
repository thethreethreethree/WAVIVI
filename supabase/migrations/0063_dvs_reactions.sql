-- Migration 0063 — Daily Vibe Share reactions (likes).
--
-- Adds the persistent reactions table promised by migration 0061.
-- One row = one like by one user on one share. Phase 1 left the
-- `like_count` column on daily_vibe_shares as a denormalised int
-- pinned at 0; the trigger below keeps it honest going forward.
--
-- Composite primary key on (share_id, user_id) — a user can only
-- like a given share once; un-like deletes the row. No separate
-- `id` column because there's nothing to reference a single
-- reaction by.

create table if not exists public.dvs_reactions (
  share_id   uuid not null references public.daily_vibe_shares(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (share_id, user_id)
);

-- Lookup: "who liked this share" + "what has this user liked"?
-- The PK already indexes (share_id, user_id). Add a reverse index
-- on user_id so the viewer-liked-set lookup on /feed can intersect
-- the visible shares cheaply.
create index if not exists dvs_reactions_user_idx
  on public.dvs_reactions (user_id, share_id);

-- Trigger function: keeps daily_vibe_shares.like_count honest. The
-- function name is unique to the DVS namespace so we don't collide
-- with any future per-table counter triggers.
create or replace function public.dvs_reactions_bump_counter()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.daily_vibe_shares
       set like_count = like_count + 1
     where id = new.share_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.daily_vibe_shares
       set like_count = greatest(0, like_count - 1)
     where id = old.share_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists dvs_reactions_insert_bump on public.dvs_reactions;
create trigger dvs_reactions_insert_bump
  after insert on public.dvs_reactions
  for each row execute function public.dvs_reactions_bump_counter();

drop trigger if exists dvs_reactions_delete_decrement on public.dvs_reactions;
create trigger dvs_reactions_delete_decrement
  after delete on public.dvs_reactions
  for each row execute function public.dvs_reactions_bump_counter();

-- RLS --------------------------------------------------------------
-- Public read so the feed can render heart counts without auth.
-- Authenticated users insert their own row (PK constraint handles
-- the one-per-user idempotence at the DB level). Delete is
-- self-scoped so a user can only un-like their own reaction; no
-- update path — there's nothing to change.
alter table public.dvs_reactions enable row level security;

drop policy if exists "DVS reactions are public read" on public.dvs_reactions;
create policy "DVS reactions are public read"
  on public.dvs_reactions for select using (true);

drop policy if exists "DVS users like as themselves" on public.dvs_reactions;
create policy "DVS users like as themselves"
  on public.dvs_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "DVS users unlike their own" on public.dvs_reactions;
create policy "DVS users unlike their own"
  on public.dvs_reactions for delete
  using (auth.uid() = user_id);

drop policy if exists "DVS admins manage reactions" on public.dvs_reactions;
create policy "DVS admins manage reactions"
  on public.dvs_reactions for all
  using (public.is_admin())
  with check (public.is_admin());
