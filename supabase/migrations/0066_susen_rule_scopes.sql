-- Susen rule scopes — let admins author tuning rules at four levels:
-- general (everywhere), country, region, and city. Earlier rules were
-- implicitly "general" because every row got injected for every reply
-- regardless of where the traveler was asking about; this lets El Nido
-- nightlife guidance fire on El Nido questions without spamming a
-- Cebu cafe query with the same paragraph.
--
-- One row in susen_dev_notes carries:
--   scope_type  enum-via-check ('general'|'country'|'region'|'city')
--   country     plain text country name ('Philippines', 'Vietnam', …)
--   region_id   already exists; the scope identifier for 'region' rules
--   city_id     FK to cities(id) for 'city' rules
--   triggers    optional keyword list — if set, the rule only fires
--               when the user's message contains one of them. Blank
--               means "always fire in scope".
--
-- All four new columns are nullable. Existing rows default to
-- scope_type='general' so the engine keeps injecting them everywhere
-- the moment this ships, identical to today's behaviour. Old rules
-- with region_id set were broadcast-everywhere too — when this lands,
-- the admin can promote those to scope_type='region' to tighten them.

ALTER TABLE public.susen_dev_notes
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'general'
    CHECK (scope_type IN ('general', 'country', 'region', 'city')),
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triggers text[];

-- Partial index — the engine reads only active instructions and the
-- predicate eliminates the 99% of dev-log rows that aren't live rules.
-- Composite (scope_type, country, region_id, city_id) lets the four-way
-- "all rules matching {country, regionId, cityId} OR general" query
-- planner use one index instead of separate scans per scope branch.
CREATE INDEX IF NOT EXISTS susen_dev_notes_live_scope_idx
  ON public.susen_dev_notes (scope_type, country, region_id, city_id)
  WHERE is_instruction AND active;

COMMENT ON COLUMN public.susen_dev_notes.scope_type IS
  'general (everywhere) | country | region | city. Drives which user queries inject this rule.';
COMMENT ON COLUMN public.susen_dev_notes.country IS
  'Country name for scope_type=country rules (matches regions.country case-insensitive).';
COMMENT ON COLUMN public.susen_dev_notes.city_id IS
  'cities.id for scope_type=city rules. region_id is also set so the rule still fires when only region is detected.';
COMMENT ON COLUMN public.susen_dev_notes.triggers IS
  'Optional lowercased keyword list. Rule fires only when the user message contains any trigger as a substring. NULL/empty means always fire in scope.';
