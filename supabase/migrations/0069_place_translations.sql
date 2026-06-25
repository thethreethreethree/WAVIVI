-- Per-place, per-language translation cache for place names +
-- descriptions across the four content tables (stays, restaurants,
-- experiences, traveler_utilities).
--
-- One row per (source_table, place_id, language). The script
-- scripts/translate-places.mjs walks each source table, batches
-- DeepSeek calls, and writes here; the loader at request time
-- pulls rows by (table, ids, lang) and merges Spanish strings into
-- the in-memory record before it reaches the UI. English content
-- always lives on the source table — this is strictly an overlay.
--
-- Two scales matter here:
--   - traveler_utilities is ~27k rows. Translating all of them once
--     is ~$15-30 in DeepSeek. The script defaults to --min-rating 4
--     so cheap-to-skip rows don't burn budget on first run.
--   - The unique constraint on (source_table, place_id, language)
--     lets the script use ON CONFLICT (...) DO UPDATE so partial
--     runs resume cleanly.

CREATE TABLE IF NOT EXISTS public.place_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  source_table text NOT NULL
    CHECK (source_table IN ('stays', 'restaurants', 'experiences', 'traveler_utilities')),
  /** UUID PK of the row in the source table. Not an FK because each
   *  source table has its own ids domain and a polymorphic FK across
   *  four tables isn't expressible — the translator + loader enforce
   *  consistency at write/read time. */
  place_id uuid NOT NULL,
  language text NOT NULL CHECK (language IN ('en', 'es')),

  name text,
  description text,

  CONSTRAINT place_translations_unique
    UNIQUE (source_table, place_id, language)
);

COMMENT ON TABLE public.place_translations IS
  'Per-language translation overlay for stays/restaurants/experiences/traveler_utilities. English source rows always live on the source tables; this is strictly an additive cache for non-English locales.';

-- Reader hot path: load every translation for (table, idsBatch, lang).
-- The unique key already covers (source_table, place_id, language) but
-- a leading-language compound index keeps single-language scans tight
-- once the table grows past a few thousand rows.
CREATE INDEX IF NOT EXISTS place_translations_by_lang_idx
  ON public.place_translations (language, source_table, place_id);
