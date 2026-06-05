-- WAVIVI — Phase 12: in-app notifications (Layer 1)
--
-- One row per user-facing notification. Multiple kinds shipped via a
-- flexible `type` label + `payload` jsonb pair so adding new notification
-- types in future (event invites, traveler notes, Susen picks) doesn't
-- need a schema change — just a new type string + matching payload
-- shape the UI knows how to render.
--
-- Insert path: ONLY the service-role server-side helper
-- (lib/notifications/create.ts). No authenticated-user insert policy =
-- no way for a malicious client to spoof a notification into another
-- user's feed. Service-role bypasses RLS entirely.
--
-- Read / update paths: users see and mark-read their own rows via
-- the standard auth.uid() = user_id RLS policy.

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Stable label distinguishing notification kinds. Conventions:
  --   chat_message         - new message in a group you joined
  --   chat_mention         - direct mention of you
  --   event_invite         - someone invited you to an event
  --   traveler_note        - someone left a note on your profile
  --   nearby_alert         - active traveler arrived in your region
  --   susen_recommendation - weekly Susen picks for your current region
  type            text not null check (char_length(type) <= 64),
  -- Optional — who triggered this. Null when system-generated (e.g.
  -- Susen weekly picks). Set null on the actor's account deletion so
  -- their notifications stay readable but unattributable.
  actor_id        uuid references auth.users (id) on delete set null,
  -- Flexible per-type payload. Examples:
  --   chat_message: { group_id, group_name, snippet, message_id, actor_name }
  --   event_invite: { event_id, event_name, region_id, actor_name }
  -- The UI renders by switching on `type` and reading fields it knows
  -- belong to that type. Adding a field is forward-compatible — older
  -- clients just ignore unknown keys.
  payload         jsonb not null default '{}'::jsonb,
  -- When the user marked this notification as read. Null = unread.
  -- Drives the bell-badge count and the unread-row tint on /notifications.
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Hot paths the UI / bell will query, both per-user newest-first:
--   - Bell unread count: count(*) where user_id=? and read_at is null
--   - /notifications page: select * where user_id=? order by created_at desc

-- Sparse partial index covers the unread-count query. Only unread rows
-- live here so reads scale with unread count, not total count — which
-- matters once a traveler has thousands of historical notifications.
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- Full index for the /notifications page render (most recent first).
create index if not exists notifications_user_recent_idx
  on public.notifications (user_id, created_at desc);

-- Realtime: the NotificationBell client component subscribes to INSERTs
-- filtered by user_id. Supabase Realtime requires the table to be in
-- the supabase_realtime publication, which it isn't by default for new
-- tables.
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "Users read their notifications" on public.notifications;
create policy "Users read their notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Used for mark-as-read: UPDATE sets read_at = now() on the user's
-- own rows. The with check clause keeps a user from re-assigning a
-- row to a different user_id during an update.
drop policy if exists "Users update their notifications" on public.notifications;
create policy "Users update their notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE on own rows so the /notifications page can offer a clear-all
-- or per-row dismiss without server-action plumbing.
drop policy if exists "Users delete their notifications" on public.notifications;
create policy "Users delete their notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- No insert policy — only the service-role helper creates rows.
