-- WAVIVI — Phase 12: web push subscriptions (Layer 2)
--
-- One row per (user, device/browser). Travelers can opt in on multiple
-- devices (phone + laptop); each browser hands us its own PushSubscription
-- object after Notification.requestPermission() is granted. We store the
-- endpoint + the encryption keys the server needs to sign each push.
--
-- Insert / update / delete happens through the /api/push/subscribe route
-- under the user's auth context, scoped to their own rows. The fanout job
-- (web-push fetch to the FCM/APNs relay) uses service-role to read across
-- all subscriptions for a given recipient — RLS would block that under
-- the recipient's auth context anyway.

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Browser-issued endpoint URL — unique per (browser, machine, profile).
  -- Different browsers vend totally different URL shapes (FCM, Mozilla,
  -- Edge) but every endpoint is unique within its provider so we can
  -- collapse to a single global uniqueness constraint.
  endpoint        text not null,
  -- p256dh + auth are the encryption keys from the PushSubscription.toJSON()
  -- object the browser hands us. Both required to sign payloads the
  -- browser will decrypt; if either is missing the push will be rejected.
  p256dh          text not null,
  auth_key        text not null,
  -- Free-form label so users can identify devices on a future
  -- /profile/notifications/devices surface ("iPhone Safari", "Brave on
  -- MacBook"). Derived from user-agent at subscribe time.
  user_agent      text,
  created_at      timestamptz not null default now(),
  -- Stamped when web-push successfully delivered a notification through
  -- this subscription. Used by the cleanup job to GC dormant subscriptions
  -- (when a browser returns 410 Gone we delete the row immediately;
  -- subscriptions that haven't seen action in 6 months get pruned on a
  -- different cadence).
  last_used_at    timestamptz
);

-- One endpoint per row, full stop. If a browser issues the same endpoint
-- twice (e.g. on a re-subscribe), the second one upserts onto the same
-- row instead of duplicating. The user_id can be rewritten on upsert if
-- a different account claims the same browser, which is intended.
create unique index if not exists push_subscriptions_endpoint_unique
  on public.push_subscriptions (endpoint);

-- Hot path: fan a notification out to one user's subscriptions.
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users read their push subs" on public.push_subscriptions;
create policy "Users read their push subs"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert their push subs" on public.push_subscriptions;
create policy "Users insert their push subs"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update their push subs" on public.push_subscriptions;
create policy "Users update their push subs"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their push subs" on public.push_subscriptions;
create policy "Users delete their push subs"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- The fanout job uses service-role and bypasses RLS — no policy
-- required for it.
