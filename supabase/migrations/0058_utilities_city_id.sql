-- WAVIVI — add city_id FK to traveler_utilities so utilities can be
-- bucketed by city the same way stays / restaurants / experiences are.
--
-- Why this is finally happening: today's session established that the
-- OSM scan engine populates utilities by region centre + radius, which
-- means utility rows have no natural city assignment. CSV-imported
-- rows however carry a `City` column from the scraper, and the same
-- city-resolver pattern that stays / eats / experiences use should be
-- mirrored here so an admin can re-bucket utilities by city for
-- display purposes.
--
-- Nullable so:
--   * existing OSM-discovered rows stay valid (no backfill required)
--   * the per-region uploaders continue to work — they just leave
--     city_id null until the CSV path enriches it.

alter table public.traveler_utilities
  add column if not exists city_id uuid references public.cities (id) on delete set null;

create index if not exists traveler_utilities_city_idx
  on public.traveler_utilities (city_id);
