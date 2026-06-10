-- Migration 0065 — Drop "Free breakfast" from every stay row.
--
-- User report (2026-06-09): a lot of accommodation descriptions
-- promise free breakfast when the property actually charges for it
-- (a Google-Maps amenity-scrape side effect). The vocabulary
-- already dropped the "Free breakfast" canonical label in the same
-- pass that ships this migration (src/lib/stays/csv-import.ts),
-- which stops the next ingest from re-introducing the claim. This
-- migration cleans the existing data so today's listings don't
-- keep showing it.
--
-- Two sweeps:
--
--   1) stays.amenities — remove every "Free breakfast" entry from
--      the array (case-insensitive). Other amenities on the row are
--      preserved; "Paid breakfast" is left alone.
--
--   2) stays.description — strip "free breakfast" phrases out of
--      the free-text description, then collapse the punctuation /
--      whitespace fallout. Belt-and-suspenders pattern chain rather
--      than a single mega-regex so the transform is auditable.
--
-- Idempotent — running twice is a no-op (the WHERE clauses gate on
-- the presence of the string).

-- 1) Amenities array sweep ------------------------------------------
-- Rebuild each affected row's amenities by unnesting + filtering,
-- preserving original order via WITH ORDINALITY. The `ARRAY()`
-- subquery rebuilds the column as a clean text[] without the
-- "Free breakfast" entry. EXISTS in the WHERE clause keeps the
-- update bounded to rows that actually need it.
update public.stays s
   set amenities = (
     select coalesce(
       array_agg(a order by ord),
       array[]::text[]
     )
     from unnest(s.amenities) with ordinality as t(a, ord)
     where lower(a) <> 'free breakfast'
   )
 where exists (
   select 1
     from unnest(s.amenities) as a
    where lower(a) = 'free breakfast'
 );

-- 2) Description text sweep -----------------------------------------
-- Strip out "free breakfast" phrases. We run the patterns from most-
-- specific to most-general so a sentence like
--   "Amenities include free wi-fi, free breakfast, air-conditioned…"
-- collapses to
--   "Amenities include free wi-fi, air-conditioned…"
-- without leaving stray double commas or a leading "and".
update public.stays
   set description = regexp_replace(
     regexp_replace(
       regexp_replace(
         regexp_replace(
           regexp_replace(
             regexp_replace(description,
               -- ", free breakfast," → ","
               ',\s*free\s+breakfast\s*,', ',', 'gi'),
             -- ", free breakfast" at end of clause
             ',\s*free\s+breakfast\b', '', 'gi'),
           -- "free breakfast, " at start of clause
           '\bfree\s+breakfast\s*,', '', 'gi'),
         -- " and free breakfast" inside a list
         '\s+and\s+free\s+breakfast\b', '', 'gi'),
       -- "free breakfast and " at start of list
       '\bfree\s+breakfast\s+and\s+', '', 'gi'),
     -- standalone "free breakfast" survivors
     '\bfree\s+breakfast\b', '', 'gi')
 where description ~* '\mfree\s+breakfast\M';

-- Cleanup pass: collapse the punctuation/whitespace fallout the
-- pattern chain above leaves behind. Idempotent — safe to re-run.
update public.stays
   set description = trim(both ' ,' from
     regexp_replace(
       regexp_replace(
         regexp_replace(
           regexp_replace(description,
             -- collapse repeated spaces
             '\s+', ' ', 'g'),
           -- ", ," → ","
           ',\s*,', ',', 'g'),
         -- " ." → "."
         '\s+\.', '.', 'g'),
       -- ", ." → "."
       ',\s*\.', '.', 'g')
   )
 where description ~ '(\s{2,}|,\s*,|\s+\.|,\s*\.)';
