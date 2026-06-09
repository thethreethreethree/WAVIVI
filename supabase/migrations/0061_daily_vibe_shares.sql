-- Migration 0061 — Daily Vibe Share (DVS).
--
-- Replaces the Instagram-pulled "Travel Feed" on /profile and seeds the
-- new community-powered feed concept described in
-- Wondavu_Daily_Vibe_Share_DVS_UPDATED.docx.
--
-- One row = one traveler's 5-question share for the day. Limited to a
-- single share per author per UTC date (enforced by the partial unique
-- index below — a soft prompt on the client guards the UX, this is the
-- hard guarantee).
--
-- Schema mirrors the 5-question form:
--   Q1  Vibe rating + caption           (vibe_rating, caption)
--   Q2  Where were you + photo          (region_id, city_id,
--                                        location_label, latitude,
--                                        longitude, photo_url)
--   Q3  Tip for fellow travelers        (tip)
--   Q4  Real costs                       (cost_meal, cost_hotel,
--                                        cost_activity, cost_currency)
--   Q5  Q&A advice                       (qa_question, qa_answer)
--
-- Engagement counters (like / comment / share) live denormalised on the
-- row so the feed can render without a join. Real reactions /
-- comments tables land in Phase 3 and will update these via triggers.

create table if not exists public.daily_vibe_shares (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles(id) on delete cascade,

  -- Q1: Vibe ---------------------------------------------------------
  vibe_rating     smallint not null check (vibe_rating between 1 and 5),
  caption         text not null check (length(caption) between 1 and 200),

  -- Q2: Where + photo ------------------------------------------------
  region_id       text references public.regions(id) on delete set null,
  city_id         uuid references public.cities(id) on delete set null,
  -- Free-form spot name within the city (e.g. "Kayangan Lake"). NULL
  -- when the traveler shares from a city-level pin without specifying.
  location_label  text check (location_label is null or length(location_label) <= 120),
  latitude        numeric,
  longitude       numeric,
  photo_url       text,

  -- Q3: Tip ----------------------------------------------------------
  -- Capped at 300 chars (~3 sentences) to keep the feed scannable.
  -- Optional — a share with strong vibe + photo but no concrete tip
  -- still has value.
  tip             text check (tip is null or length(tip) <= 300),

  -- Q4: Real costs ---------------------------------------------------
  -- Stored as integers in the local currency the traveler picked.
  -- Negative is rejected; zero is allowed (free activity).
  cost_meal       integer check (cost_meal is null or cost_meal >= 0),
  cost_hotel      integer check (cost_hotel is null or cost_hotel >= 0),
  cost_activity   integer check (cost_activity is null or cost_activity >= 0),
  -- ISO 4217 code (USD / PHP / EUR / etc.). Three letters, validated
  -- on the client; the check here is a sanity guard so a malformed
  -- value can't poison the per-location averages job downstream.
  cost_currency   text check (cost_currency is null or cost_currency ~ '^[A-Z]{3}$'),

  -- Q5: Q&A ----------------------------------------------------------
  qa_question     text check (qa_question is null or length(qa_question) <= 160),
  qa_answer       text check (qa_answer is null or length(qa_answer) <= 280),

  -- Engagement -------------------------------------------------------
  -- Denormalised counters — kept honest by triggers in Phase 3 when
  -- the real reactions / comments tables land. For Phase 1 they stay
  -- at 0 and the UI renders them as plain text (no Like button yet).
  like_count      integer not null default 0,
  comment_count   integer not null default 0,
  share_count     integer not null default 0,

  -- Lifecycle --------------------------------------------------------
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One share per author per UTC day. PARTIAL on active=true so a user
-- who deletes (soft-archives) today's share can post a replacement
-- the same day without bumping into the constraint.
--
-- Why the cast goes through `AT TIME ZONE 'UTC'` first:
-- `timestamptz::date` depends on the session's timezone setting, so
-- Postgres marks it STABLE — and index expressions must be IMMUTABLE.
-- `(created_at AT TIME ZONE 'UTC')` returns a plain `timestamp` (no
-- timezone), and `timestamp::date` IS immutable. Same calendar-day
-- semantics; no functional change.
create unique index if not exists daily_vibe_shares_one_per_day
  on public.daily_vibe_shares (
    author_id,
    ((created_at at time zone 'UTC')::date)
  )
  where active = true;

-- Feed scans — global newest-first.
create index if not exists daily_vibe_shares_recent_idx
  on public.daily_vibe_shares (active, created_at desc);

-- Region / city feed scans.
create index if not exists daily_vibe_shares_region_idx
  on public.daily_vibe_shares (region_id, active, created_at desc);
create index if not exists daily_vibe_shares_city_idx
  on public.daily_vibe_shares (city_id, active, created_at desc);

-- Author timeline (used on /profile and /u/[username]).
create index if not exists daily_vibe_shares_author_idx
  on public.daily_vibe_shares (author_id, active, created_at desc);

-- updated_at trigger uses the shared function from migration 0003.
drop trigger if exists daily_vibe_shares_set_updated_at
  on public.daily_vibe_shares;
create trigger daily_vibe_shares_set_updated_at
  before update on public.daily_vibe_shares
  for each row execute function public.set_updated_at();

-- RLS --------------------------------------------------------------
-- Public can read active shares (the whole point of the feed is
-- community visibility). Authors can create their own; only the
-- author OR an admin can update / soft-delete. No public writes.
alter table public.daily_vibe_shares enable row level security;

drop policy if exists "DVS shares are public read" on public.daily_vibe_shares;
create policy "DVS shares are public read"
  on public.daily_vibe_shares for select
  using (active = true);

drop policy if exists "DVS authors insert their own" on public.daily_vibe_shares;
create policy "DVS authors insert their own"
  on public.daily_vibe_shares for insert
  with check (auth.uid() = author_id);

drop policy if exists "DVS authors update their own" on public.daily_vibe_shares;
create policy "DVS authors update their own"
  on public.daily_vibe_shares for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "DVS admins manage all" on public.daily_vibe_shares;
create policy "DVS admins manage all"
  on public.daily_vibe_shares for all
  using (public.is_admin())
  with check (public.is_admin());
