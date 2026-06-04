-- Migration 0050 — Travelers Feed posts.
--
-- Powers the /feed surface (which already exists, rendering mock content
-- from src/lib/travejor/feed.ts). Each row is one IG-style post tagged
-- to a region (and optionally to a city). Sources for v1:
--
--   admin_curated  — admin pastes an IG post URL + caption + handle
--                    and uploads or links the image; we mirror to
--                    Supabase Storage so the photo doesn't expire when
--                    the IG CDN token rotates. Compliant with IG ToS.
--   instagram_oauth — Phase 2 once Login-with-Instagram lands; the
--                     traveler's own posts auto-flow in here.
--   user_paste     — Phase 3 anonymous paste-a-URL flow for travelers
--                    who don't want to OAuth their IG.
--
-- The `source` check enforces the three values up front so a stray
-- ingest path can't write garbage.

create table if not exists public.feed_posts (
  id              uuid primary key default gen_random_uuid(),
  region_id       text references public.regions (id) on delete cascade,
  city_id         uuid references public.cities (id) on delete set null,
  -- Display ----------------------------------------------------------
  handle          text not null,
  verified        boolean not null default false,
  caption         text not null default '',
  location_label  text,
  -- Source / provenance ---------------------------------------------
  source          text not null default 'admin_curated' check (
                    source in ('admin_curated', 'instagram_oauth', 'user_paste')
                  ),
  ig_post_url     text,
  -- Stored image (mirrored to stays-photos bucket so IG CDN rotation
  -- can't break the feed). Required — a post without a photo isn't a
  -- feed card.
  image_url       text not null,
  -- Engagement counters. Free-form `likes_label` (e.g. "2.4K") so the
  -- admin can tune the displayed number without us having to maintain
  -- a live counter against IG, which we can't legally do anyway.
  -- Comments / shares stay integers because their on-screen format is
  -- always raw.
  likes_label     text not null default '0',
  comments        integer not null default 0,
  shares          integer not null default 0,
  -- Lifecycle --------------------------------------------------------
  active          boolean not null default true,
  -- Admin-editable pin order. NULL means "natural" (newest first).
  -- Non-null values sort ascending before the newest-first fallback,
  -- so display_order = 1 always shows up top.
  display_order   integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Hot path: region feed ordered (display_order asc nulls last, then
-- newest first). The two-column ordering means a backward index scan
-- gets us rows already in display order.
create index if not exists feed_posts_region_idx
  on public.feed_posts (region_id, active, display_order, created_at desc);

-- Global feed (no region picked) — same ordering, no region filter.
create index if not exists feed_posts_global_idx
  on public.feed_posts (active, display_order, created_at desc);

-- updated_at maintenance — the trigger function is defined in the
-- toolbox foundation migration (0003).
drop trigger if exists feed_posts_set_updated_at on public.feed_posts;
create trigger feed_posts_set_updated_at
  before update on public.feed_posts
  for each row execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------
-- Public can SELECT active rows (the whole point is discovery).
-- Only admins write / update / delete.
alter table public.feed_posts enable row level security;

-- `create policy` has no IF NOT EXISTS form in Postgres, so the
-- idempotent pattern is drop-if-exists + create. Lets the migration
-- be safely re-run after a partial apply (the original ship hit
-- "policy ... already exists" when the SQL editor re-ran).
drop policy if exists "Feed posts are public read" on public.feed_posts;
create policy "Feed posts are public read"
  on public.feed_posts for select
  using (active = true);

drop policy if exists "Admins manage feed posts" on public.feed_posts;
create policy "Admins manage feed posts"
  on public.feed_posts for all
  using (public.is_admin())
  with check (public.is_admin());
