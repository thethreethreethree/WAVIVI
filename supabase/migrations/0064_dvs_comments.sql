-- Migration 0064 — Daily Vibe Share comments.
--
-- One row = one comment on one share. Soft-delete via `active=false`
-- so a removed comment leaves the comment_count math consistent for
-- the moderation audit (admin can flip `active` back to recover).
-- Body capped at 500 chars to keep the thread scannable.

create table if not exists public.dvs_comments (
  id         uuid primary key default gen_random_uuid(),
  share_id   uuid not null references public.daily_vibe_shares(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(body) between 1 and 500),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hot path: load a single share's thread, oldest first (chat reads
-- top-down). `active` first in the index so soft-deleted rows don't
-- bloat the seek.
create index if not exists dvs_comments_thread_idx
  on public.dvs_comments (share_id, active, created_at asc);

-- Author timeline (used by admin moderation / abuse review).
create index if not exists dvs_comments_author_idx
  on public.dvs_comments (author_id, active, created_at desc);

-- updated_at trigger uses the shared function from migration 0003.
drop trigger if exists dvs_comments_set_updated_at on public.dvs_comments;
create trigger dvs_comments_set_updated_at
  before update on public.dvs_comments
  for each row execute function public.set_updated_at();

-- Counter maintenance — same shape as dvs_reactions. INSERT bumps,
-- soft-delete (active flip true→false) decrements, hard-DELETE
-- decrements. Hard deletes are rare (admin-only); soft is the
-- normal user "delete my comment" path.
create or replace function public.dvs_comments_bump_counter()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.active then
      update public.daily_vibe_shares
         set comment_count = comment_count + 1
       where id = new.share_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    -- Track active transitions: false→true bumps, true→false drops.
    if old.active is distinct from new.active then
      if new.active then
        update public.daily_vibe_shares
           set comment_count = comment_count + 1
         where id = new.share_id;
      else
        update public.daily_vibe_shares
           set comment_count = greatest(0, comment_count - 1)
         where id = new.share_id;
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.active then
      update public.daily_vibe_shares
         set comment_count = greatest(0, comment_count - 1)
       where id = old.share_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists dvs_comments_insert_bump on public.dvs_comments;
create trigger dvs_comments_insert_bump
  after insert on public.dvs_comments
  for each row execute function public.dvs_comments_bump_counter();

drop trigger if exists dvs_comments_update_flip on public.dvs_comments;
create trigger dvs_comments_update_flip
  after update on public.dvs_comments
  for each row execute function public.dvs_comments_bump_counter();

drop trigger if exists dvs_comments_delete_decrement on public.dvs_comments;
create trigger dvs_comments_delete_decrement
  after delete on public.dvs_comments
  for each row execute function public.dvs_comments_bump_counter();

-- RLS --------------------------------------------------------------
-- Public read on active comments. Authors insert as themselves;
-- authors update / soft-delete their own; admins manage all. No
-- public hard deletes.
alter table public.dvs_comments enable row level security;

drop policy if exists "DVS comments are public read" on public.dvs_comments;
create policy "DVS comments are public read"
  on public.dvs_comments for select
  using (active = true);

drop policy if exists "DVS users comment as themselves" on public.dvs_comments;
create policy "DVS users comment as themselves"
  on public.dvs_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "DVS authors edit their own" on public.dvs_comments;
create policy "DVS authors edit their own"
  on public.dvs_comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "DVS admins manage comments" on public.dvs_comments;
create policy "DVS admins manage comments"
  on public.dvs_comments for all
  using (public.is_admin())
  with check (public.is_admin());
