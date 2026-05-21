-- ---------------------------------------------------------------------------
-- Trip Planner — day-by-day itinerary attached to a travel_plan.
--
-- Stored as a jsonb array on travel_plans rather than a child table because
-- the editor always replaces the whole list (simpler optimistic UI, no
-- ordering table), the data is small (a handful of items per day), and
-- nothing else queries individual itinerary items.
-- ---------------------------------------------------------------------------
alter table public.travel_plans
  add column if not exists itinerary jsonb not null default '[]'::jsonb;
