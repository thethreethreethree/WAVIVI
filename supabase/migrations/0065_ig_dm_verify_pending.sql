-- Migration 0065 — Instagram DM verification pending tokens.
--
-- Replaces the brittle bio-scrape verification with a webhook-driven
-- DM flow. Server-side flow:
--
--   1. User clicks "Verify with Instagram DM" → server generates a
--      6-char token (same `wavivi-xxxxxx` shape used by the bio
--      flow so the help text stays familiar), inserts a row here.
--   2. UI shows "DM @<our_handle> with this code: wavivi-xxxxxx".
--   3. User opens IG, sends the DM. Meta posts a webhook event to
--      /api/instagram/webhook.
--   4. The webhook route validates Meta's signature, looks the
--      token up in this table, sets used_at, writes the sender's
--      `ig_username` onto the profile, marks instagram_verified.
--   5. The client polls verify-status (every ~3s) and unlocks when
--      used_at fills in.
--
-- We do NOT store the message body or anything else from the DM —
-- only the sender's IG username (so the profile can be linked) and
-- the token-match timestamp. Anything else from Meta's payload is
-- dropped at the webhook boundary.

create table if not exists public.ig_dm_verify_pending (
  -- The 6-char shareable token, formatted "wavivi-xxxxxx". Acts as
  -- the lookup key when the webhook arrives — Meta gives us the
  -- sender + message; we extract the token from the body and find
  -- the matching pending row.
  token              text primary key,
  user_id            uuid not null references public.profiles(id) on delete cascade,

  -- Filled by the webhook when the matching DM lands. NULL while
  -- the user is still composing / sending.
  used_at            timestamptz,
  -- IG sender info as supplied by the webhook. We store only the
  -- username + the Meta-side sender id (so a malicious webhook
  -- replay can't link a stranger's account to a user later — the
  -- webhook itself is signature-verified).
  used_by_ig_username text,
  used_by_ig_user_id  text,

  expires_at         timestamptz not null default (now() + interval '15 minutes'),
  created_at         timestamptz not null default now()
);

-- Per-user open-token lookup so the UI can poll for "did mine
-- complete?" without scanning the table.
create index if not exists ig_dm_verify_pending_user_idx
  on public.ig_dm_verify_pending (user_id, created_at desc);

-- Token TTL cleanup is handled by a cron in app code; this index
-- supports the periodic delete-where-expired sweep.
create index if not exists ig_dm_verify_pending_expires_idx
  on public.ig_dm_verify_pending (expires_at)
  where used_at is null;

-- RLS --------------------------------------------------------------
-- Owners can read their own pending row (drives the UI poll). The
-- webhook + verification action both run as service-role so they
-- bypass RLS by design — no public write path.
alter table public.ig_dm_verify_pending enable row level security;

drop policy if exists "IG DM pending: owners read their own" on public.ig_dm_verify_pending;
create policy "IG DM pending: owners read their own"
  on public.ig_dm_verify_pending for select
  using (auth.uid() = user_id);

drop policy if exists "IG DM pending: admins manage" on public.ig_dm_verify_pending;
create policy "IG DM pending: admins manage"
  on public.ig_dm_verify_pending for all
  using (public.is_admin())
  with check (public.is_admin());
