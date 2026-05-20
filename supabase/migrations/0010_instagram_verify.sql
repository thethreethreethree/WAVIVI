-- WAVIVI — Instagram bio-token verification
--
-- Adds short-lived state for the bio-paste verification flow:
--   1. App generates `verify_token` (e.g. "wavivi-3kf2") and remembers
--      which handle the user said they own (`verify_handle`).
--   2. User pastes the token into their public IG bio.
--   3. App fetches the public IG profile page and checks the token is
--      present; on success it sets `instagram_username` and
--      `instagram_verified = true`, then clears the verify_* columns.
--
-- Nothing about a password or token is ever sent to us by Instagram.

alter table public.profiles
  add column if not exists instagram_verify_token text,
  add column if not exists instagram_verify_handle text,
  add column if not exists instagram_verify_expires_at timestamptz;
