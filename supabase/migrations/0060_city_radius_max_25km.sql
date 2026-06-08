-- WAVIVI — cap cities.radius_km at 25 km.
--
-- The toolbox map now does city-priority scoping: when the user pins
-- a city, the API returns only utilities within that city's circle.
-- A 200 km cap (the previous upper bound from 0057) is too wide for
-- that use — "near me in El Nido" needs a tight ~25 km radius, not a
-- province-sized one. Capping in SQL keeps the constraint honest no
-- matter which admin surface (cities admin, batch importer, manual
-- update) writes the value.
--
-- Existing rows with radius_km > 25 are clamped to 25 BEFORE the
-- check is swapped so the new constraint validates without rejecting
-- the load.

update public.cities
   set radius_km = 25
 where radius_km is not null
   and radius_km > 25;

alter table public.cities
  drop constraint if exists cities_radius_km_check;

alter table public.cities
  add constraint cities_radius_km_check
  check (radius_km is null or radius_km between 1 and 25);
