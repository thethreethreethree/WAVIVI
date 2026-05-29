-- WAVIVI — stays: admin-controlled `featured` + `top_pick` flags.
--
-- Until now the user-facing "Top pick" badge on stay cards was a
-- derived rule (backpack_rating >= 4.7). That meant admins couldn't
-- promote a place they liked over a slightly higher-rated one, nor
-- demote a popular-but-problematic listing.
--
-- This migration adds two boolean flags so the admin /admin/stays
-- pages can manage promotion explicitly:
--
--   featured   Pinned to the top of the regional stay list. Bigger
--              hero card on /stay. Editorial "we recommend" pick.
--   top_pick   Earns the ⭐ Top pick badge on the card. Independent
--              of `featured` so admins can have many top-picks and
--              a smaller editorial set of featured ones.
--
-- Both default to FALSE so existing rows stay neutral; the user-side
-- list ORDER BY will keep using backpack_rating as the tiebreaker.

alter table public.stays
  add column if not exists featured boolean not null default false,
  add column if not exists top_pick boolean not null default false;

-- Partial indexes — most rows are FALSE on both flags, so a partial
-- index over the small TRUE subset stays tiny while still
-- accelerating the "show me featured stays" admin query.
create index if not exists stays_featured_idx
  on public.stays (featured)
  where featured = true;

create index if not exists stays_top_pick_idx
  on public.stays (top_pick)
  where top_pick = true;
