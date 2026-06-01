-- Migration 0047 — clean up the Cebu region's display label.
--
-- The original scrape seeded `regions.display_name = '6, Cebu'`
-- (the leading "6" is the Region VI ordinal from the source data).
-- It surfaces in the public picker as "6, Cebu", which reads as a
-- typo to travellers — the country header above it already says
-- "Philippines", so the redundant "6," is just noise.
--
-- Conservative, idempotent rename. Only touches the row whose
-- display_name still matches the bad value, so re-running this
-- after an admin manually fixed it is a no-op. The `city` and
-- `province` columns are left as-is — they're used elsewhere
-- (region header sub-line, slug fallbacks) and the existing
-- values for them are sane.
update public.regions
   set display_name = 'Cebu'
 where display_name = '6, Cebu';
