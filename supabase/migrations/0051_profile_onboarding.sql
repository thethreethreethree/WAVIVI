-- WAVIVI — Phase 12: post-signup walkthrough
-- Track whether a profile has completed the 3-step welcome flow so the
-- email-confirm + OAuth-callback routes can redirect first-timers into
-- /welcome/[step] and let returning users skip it.
--
-- Grandfather every existing row by backfilling onboarded_at = now()
-- so anyone who signed up BEFORE this feature shipped never sees the
-- walkthrough. Only accounts created from this migration forward have
-- onboarded_at = null at sign-up time.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- One-shot backfill — existing accounts skip the flow.
update public.profiles
   set onboarded_at = coalesce(onboarded_at, now());

-- Helpful index for the "is this user a first-timer?" check the auth
-- routes run on every sign-in. Sparse, since the column is null only
-- for accounts mid-flow (small set at any one time).
create index if not exists profiles_onboarded_at_null_idx
  on public.profiles (id)
  where onboarded_at is null;
