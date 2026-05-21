-- ---------------------------------------------------------------------------
-- Saved lists for Where-to-Next plan-detail tiles.
--
-- Adds two new jsonb arrays on travel_plans:
--   - saved_activities   for the "What I will do" tile
--   - saved_events       for the "Saved events" tile
--
-- Existing saved_hotels / saved_restaurants stay as-is; this just unifies
-- the four manageable lists. Each item carries an optional `favorite`
-- boolean and an optional `notes` string — both stored inside the jsonb
-- object so no schema migration is needed when those fields are added.
-- ---------------------------------------------------------------------------
alter table public.travel_plans
  add column if not exists saved_activities jsonb not null default '[]'::jsonb,
  add column if not exists saved_events     jsonb not null default '[]'::jsonb;
