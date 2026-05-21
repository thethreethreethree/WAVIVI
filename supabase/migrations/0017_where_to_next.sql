-- ---------------------------------------------------------------------------
-- Where to Next — schema for travel plans, plan-driven matching, and the
-- chat-group fields needed to route matches into existing chats.
--
-- Adds:
--   - travel_plans              one row per verified traveler's plan
--   - chat_invite_log           audit trail for auto-invites (so a user can
--                               see *why* they were added to a chat)
--   - chat_groups columns       destination + date window + theme_tags +
--                               is_auto_generated, so matching can route
--                               candidates into the existing chat tables
--
-- Lists that are queried for matching (destination_countries, activities,
-- vibe_tags) live as denormalised text[] columns on travel_plans so we can
-- use Postgres array overlap (&&) instead of joining a child table.
-- Per-destination granularity (country, city, arriveOn, departOn) is kept
-- in a jsonb `destinations` column for display purposes.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- travel_plans
-- ---------------------------------------------------------------------------
create table if not exists public.travel_plans (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,

  -- Date window of the trip overall (computed from destinations on submit).
  start_date             date not null,
  end_date               date not null,
  duration_days          integer generated always as (
    greatest(1, (end_date - start_date) + 1)
  ) stored,

  -- Destinations the user listed, as jsonb objects:
  --   { country: text, city: text|null, arriveOn: date, departOn: date }
  destinations           jsonb not null default '[]'::jsonb,

  -- Denormalised list of country names from `destinations` for the matcher.
  -- Updated in application code on insert/update so we can index it for
  -- array overlap (`destination_countries && ARRAY['Philippines']`).
  destination_countries  text[] not null default '{}',

  -- Questionnaire answers (free of legacy enum coupling — store as text[]
  -- so we can extend the option list without a migration).
  purpose                text[] not null default '{}',
  activities             text[] not null default '{}',
  vibe_tags              text[] not null default '{}',
  must_see               text[] not null default '{}',
  budget                 text not null check (
    budget in ('shoestring', 'mid', 'premium', 'luxury')
  ),
  traveling_with         text not null check (
    traveling_with in ('solo', 'partner', 'friends', 'family')
  ),

  open_to_meet_others    boolean not null default true,

  -- Saved items — jsonb so the shape can evolve (e.g. price snapshot, notes)
  -- without bouncing through a schema migration. Each list item carries the
  -- external reference (stays.id, places.id, etc.) plus a denormalised name
  -- so the plan still renders after the source row is deleted.
  saved_hotels           jsonb not null default '[]'::jsonb,
  saved_restaurants      jsonb not null default '[]'::jsonb,
  saved_chats            text[] not null default '{}',

  status                 text not null default 'draft' check (
    status in ('draft', 'upcoming', 'active', 'past')
  ),

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  check (end_date >= start_date)
);

-- Matching path: country overlap + date overlap. GIN on the array column
-- powers `&&` queries; btree on the window powers daterange overlap.
create index if not exists travel_plans_countries_gin
  on public.travel_plans using gin (destination_countries);

create index if not exists travel_plans_window_idx
  on public.travel_plans (start_date, end_date);

-- "My plans" listing — most-recent first.
create index if not exists travel_plans_user_idx
  on public.travel_plans (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- chat_groups — extend for Where-to-Next routing.
-- Existing rows (the seed chats from migration 0008) keep their null/default
-- destination fields and won't show up in matches.
-- ---------------------------------------------------------------------------
alter table public.chat_groups
  add column if not exists destination_country text,
  add column if not exists destination_city    text,
  add column if not exists window_start        date,
  add column if not exists window_end          date,
  add column if not exists theme_tags          text[] not null default '{}',
  add column if not exists is_auto_generated   boolean not null default false;

create index if not exists chat_groups_destination_idx
  on public.chat_groups (destination_country, window_start, window_end);

create index if not exists chat_groups_theme_gin
  on public.chat_groups using gin (theme_tags);

-- ---------------------------------------------------------------------------
-- chat_invite_log — one row per auto-invite. Visible to the invitee so they
-- can see "you were added to {chat} because your plan matched {reason}".
-- ---------------------------------------------------------------------------
create table if not exists public.chat_invite_log (
  id              uuid primary key default gen_random_uuid(),
  group_id        text not null references public.chat_groups (id) on delete cascade,
  invitee_id      uuid not null references auth.users (id) on delete cascade,
  source_plan_id  uuid references public.travel_plans (id) on delete set null,
  match_score     real,
  reason          text,
  created_at      timestamptz not null default now()
);

create index if not exists chat_invite_log_invitee_idx
  on public.chat_invite_log (invitee_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.travel_plans    enable row level security;
alter table public.chat_invite_log enable row level security;

-- A plan is private to its owner for write; *read* is also private for now.
-- The matcher runs server-side with the service role, so cross-user reads
-- happen through the admin client, not RLS.
drop policy if exists "Owners read their plans" on public.travel_plans;
create policy "Owners read their plans"
  on public.travel_plans for select using (user_id = auth.uid());

drop policy if exists "Owners write their plans" on public.travel_plans;
create policy "Owners write their plans"
  on public.travel_plans for insert with check (user_id = auth.uid());

drop policy if exists "Owners update their plans" on public.travel_plans;
create policy "Owners update their plans"
  on public.travel_plans for update using (user_id = auth.uid());

drop policy if exists "Owners delete their plans" on public.travel_plans;
create policy "Owners delete their plans"
  on public.travel_plans for delete using (user_id = auth.uid());

-- An invitee can read their own log so the chat-detail screen can surface
-- "added by Where-to-Next match". Service role writes the rows.
drop policy if exists "Invitee reads own log" on public.chat_invite_log;
create policy "Invitee reads own log"
  on public.chat_invite_log for select using (invitee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at touch
-- ---------------------------------------------------------------------------
create or replace function public.touch_travel_plan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists travel_plans_touch on public.travel_plans;
create trigger travel_plans_touch
  before update on public.travel_plans
  for each row execute function public.touch_travel_plan_updated_at();
