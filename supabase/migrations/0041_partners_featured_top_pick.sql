-- WAVIVI — restaurants / experiences / events: admin-controlled
-- `featured` + `top_pick` flags. Mirrors migration 0040 (stays) so the
-- admin and user surfaces behave consistently across every partner
-- category.
--
-- See 0040_stays_featured_top_pick.sql for the design notes. Same
-- two columns, same defaults (FALSE), same partial-index strategy.

-- Restaurants ────────────────────────────────────────────────────────
alter table public.restaurants
  add column if not exists featured boolean not null default false,
  add column if not exists top_pick boolean not null default false;

create index if not exists restaurants_featured_idx
  on public.restaurants (featured) where featured = true;
create index if not exists restaurants_top_pick_idx
  on public.restaurants (top_pick) where top_pick = true;

-- Experiences ───────────────────────────────────────────────────────
alter table public.experiences
  add column if not exists featured boolean not null default false,
  add column if not exists top_pick boolean not null default false;

create index if not exists experiences_featured_idx
  on public.experiences (featured) where featured = true;
create index if not exists experiences_top_pick_idx
  on public.experiences (top_pick) where top_pick = true;

-- Events ────────────────────────────────────────────────────────────
alter table public.events
  add column if not exists featured boolean not null default false,
  add column if not exists top_pick boolean not null default false;

create index if not exists events_featured_idx
  on public.events (featured) where featured = true;
create index if not exists events_top_pick_idx
  on public.events (top_pick) where top_pick = true;
