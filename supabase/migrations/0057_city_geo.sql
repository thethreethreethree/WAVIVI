-- WAVIVI — promote the geographic radius filter from regions to cities.
--
-- Until now every public listing on /stay, /eat, /todo, /events did a final
-- pass through `withinRegionRadius`: keep a row only if its lat/lng sits
-- inside the region's centre + radius_km. That worked when regions were
-- one-city scan circles, but breaks the moment a region spans a real
-- province / island. Palawan is ~400 km north-south; the radius_km
-- constraint caps at 200, so a single region centred on Puerto Princesa
-- can't reach both Balabac (south) and El Nido (north). Result: imported
-- rows land correctly in the DB but get filtered out at display time, and
-- the symptom is "I imported a CSV and nothing shows on /stay".
--
-- Fix: each city gets its own centre + radius. The display-time filter
-- uses the city's radius when the row's city_id has one set, and falls
-- back to the region's radius for rows whose city_id is null or whose
-- city has no geo set yet. All three columns are nullable so existing
-- cities and existing import paths keep working unchanged until an
-- admin sets the geo.

alter table public.cities
  add column if not exists latitude   numeric,
  add column if not exists longitude  numeric,
  add column if not exists radius_km  numeric check (radius_km is null or radius_km between 1 and 200);

-- No new index — the radius filter is computed in app code (haversine),
-- not in SQL. Per-region city counts are already tiny (<50 per region in
-- the largest scans), so the per-render filter pass is negligible.
