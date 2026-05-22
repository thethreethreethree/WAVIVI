-- WAVIVI — day-of-trip bucket for experiences (and events, added with the
-- events table). NOT applied to stays — a hostel/hotel isn't a time-of-day
-- thing; the Category column in stays CSVs is ignored on import.
--
-- The experiences/events CSVs carry a `Category` column of MORNING /
-- MIDDAY / NIGHTTIME. Stored as free text (lowercased), nullable so rows
-- and CSVs without it still import. Drives the time-of-day filter strip on
-- /todo (and /events); when absent the list falls back to its keyword
-- heuristic.

alter table public.experiences
  add column if not exists day_bucket text;
