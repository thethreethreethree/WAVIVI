-- WAVIVI — Phase 12: account-deletion grace period
-- Privacy Policy promises deletion within 30 days. Users get a 30-day
-- soft-window between requesting deletion and the actual purge so:
--   1. Accidental delete-clicks can be reversed by signing back in
--      (the deletion-pending banner offers a Cancel button).
--   2. Support has a window to verify if a deletion request was
--      submitted under duress.
--   3. Backups + downstream caches drain naturally before the auth
--      user is purged via service role.

alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;

-- Optional human reason — admins can review for trends ("everyone is
-- citing reason X → fix X"). Not required, not surfaced publicly.
alter table public.profiles
  add column if not exists deletion_reason text
  check (deletion_reason is null or char_length(deletion_reason) <= 500);

-- Index used by the purge job: "find profiles where the 30-day grace
-- has elapsed." Sparse — only deletion-pending rows appear here.
create index if not exists profiles_deletion_due_idx
  on public.profiles (deletion_requested_at)
  where deletion_requested_at is not null;
