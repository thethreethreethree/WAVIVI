-- Wondavu — Featured Travelers per group.
--
-- Admins curate which members of a group chat show up in the "Featured
-- Travelers" strip on the Group Vibes page. A simple flag on
-- chat_group_members keeps the data co-located with membership: when a
-- traveler leaves a group the FK cascade tears their featured flag down
-- with them automatically.

alter table public.chat_group_members
  add column if not exists featured boolean not null default false;

-- Partial index — fast lookup of just the featured rows. The where-clause
-- keeps the index tiny (most members aren't featured).
create index if not exists chat_group_members_featured_idx
  on public.chat_group_members (group_id) where featured = true;
