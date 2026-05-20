-- WAVIVI — utility photo URL
--
-- Lets admins attach a primary cover photo to each toolbox utility. CSV
-- import accepts a `Photo` / `Image` / `Photo URL` column and writes it
-- here; the admin editor lets staff tweak it; the traveler-facing pin
-- card renders it above the description when present.

alter table public.traveler_utilities
  add column if not exists photo_url text;
