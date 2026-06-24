-- Per-user preferred language. v1 supports en + es; the CHECK keeps
-- the column from drifting (UI-side validation can be loose; the DB
-- holds the line). Default 'en' so existing rows keep their current
-- behaviour the moment this lands.
--
-- Stored alongside the cookie (wv-language) so signed-in users get
-- the preference back on a fresh device while anonymous visitors and
-- pre-login navigation can still pick a language. Server resolution
-- order: cookie wins, falls back to this column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'es'));

COMMENT ON COLUMN public.profiles.language IS
  'BCP-47 short code for the user''s preferred interface + Susen reply language. v1: en | es. Cookie wv-language takes precedence at request time.';
