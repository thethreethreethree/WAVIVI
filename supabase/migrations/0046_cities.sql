-- WAVIVI — cities as a first-class entity under regions.
--
-- Until now a Region was effectively one city (regions.city is a single
-- text field). Province-wide CSV uploads — a typical Surigao / Cebu /
-- Bohol scrape covers many cities — landed every place under the same
-- region_id with no per-city grouping. The batch city import flow now
-- reads the CSV's `City` column, upserts a row per unique value into
-- this table, and stamps the resulting city_id onto each imported place.
--
-- city_id is nullable on the place tables so:
--   * pre-existing rows stay valid (separate backfill tool handles them)
--   * the legacy per-region uploaders continue to work unmodified —
--     they just leave city_id null until the batch importer enriches it.
--
-- Slugs are unique per region, not globally, so two regions can both
-- have a "Carmen" city without collision.

create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  region_id   text not null references public.regions (id) on delete cascade,
  slug        text not null,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (region_id, slug)
);

create index if not exists cities_region_idx on public.cities (region_id);

alter table public.stays
  add column if not exists city_id uuid references public.cities (id) on delete set null;

alter table public.restaurants
  add column if not exists city_id uuid references public.cities (id) on delete set null;

alter table public.experiences
  add column if not exists city_id uuid references public.cities (id) on delete set null;

create index if not exists stays_city_idx       on public.stays       (city_id);
create index if not exists restaurants_city_idx on public.restaurants (city_id);
create index if not exists experiences_city_idx on public.experiences (city_id);

-- RLS: cities are publicly readable (so map/listing pages can group by
-- city without an extra hop), and admin-only writable — matches the
-- regions / stays policy shape.
alter table public.cities enable row level security;

drop policy if exists "Cities are public" on public.cities;
create policy "Cities are public"
  on public.cities for select using (true);

drop policy if exists "Admins manage cities" on public.cities;
create policy "Admins manage cities"
  on public.cities for all
  using (is_admin())
  with check (is_admin());
