-- WAVIVI — countries a traveler has visited
--
-- Profile carries a list of country names (free-form for now, ISO codes
-- later). Drives the "Countries Traveled" section on /profile and /u/[username].

alter table public.profiles
  add column if not exists countries text[] not null default '{}'::text[];
