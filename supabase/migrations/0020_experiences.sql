-- WAVIVI — Experiences (tours, dives, kayak rentals, viewpoints, …)
--
-- Mirrors the stays table closely, with two extra columns the
-- experiences CSV provides natively:
--   * activity_type — free-text label from the Google scrape
--                     ("Tour operator", "Diving center", "Beach", etc.)
--                     Kept as text (no enum) because the catalogue is open-
--                     ended; the admin importer doesn't have to know every
--                     possible value up-front.
--   * description    — short copy that fronts the detail card.
--
-- Industry is intentionally NOT imported (per spec) — it's noisy noise
-- from Google Maps. Everything else (rating, reviews, contacts, photo,
-- amenities, coords) follows the same shape as stays so the partner-
-- dashboard / vote pipeline can plug in later without a migration.

-- ---------------------------------------------------------------------------
-- experiences
-- ---------------------------------------------------------------------------
create table if not exists public.experiences (
  id                    uuid primary key default gen_random_uuid(),
  region_id             text references public.regions (id) on delete set null,
  activity_type         text not null default 'other',
  name                  text not null check (char_length(name) between 1 and 200),
  description           text,
  latitude              double precision not null,
  longitude             double precision not null,
  google_maps_url       text not null default '',
  address               text,

  -- Google-sourced metrics (refreshed by CSV import).
  rating                numeric check (rating is null or (rating >= 0 and rating <= 5)),
  review_count          integer not null default 0,

  -- Community signal — Travejor-native (votes ship later).
  thumbs_up             integer not null default 0,
  thumbs_down           integer not null default 0,
  backpack_rating       numeric not null default 0
                          check (backpack_rating >= 0 and backpack_rating <= 5),
  reliability_score     numeric not null default 0,
  admin_edited          boolean not null default false,

  -- Contact + identity.
  phone                 text,
  website               text,
  email                 text,
  instagram             text,
  facebook              text,
  whatsapp              text,

  -- Optional partner / pricing info.
  price_per_session_usd numeric check (
    price_per_session_usd is null or price_per_session_usd >= 0
  ),
  amenities             text[] not null default '{}'::text[],

  -- Storytelling.
  photo_url             text,
  photo_urls            text[] not null default '{}'::text[],

  -- Bookkeeping + future partner ownership.
  source                text not null default 'manual',
  source_ref            text not null,
  claimed_by            uuid references auth.users (id) on delete set null,
  metadata_json         jsonb not null default '{}'::jsonb,
  active                boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (source, source_ref)
);

create index if not exists experiences_region_type_idx
  on public.experiences (region_id, activity_type) where active = true;
create index if not exists experiences_claimed_by_idx
  on public.experiences (claimed_by) where claimed_by is not null;

drop trigger if exists experiences_set_updated_at on public.experiences;
create trigger experiences_set_updated_at
  before update on public.experiences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security — same policy shape as stays.
-- ---------------------------------------------------------------------------
alter table public.experiences enable row level security;

drop policy if exists "Experiences are public" on public.experiences;
create policy "Experiences are public"
  on public.experiences for select using (active = true or is_admin());

drop policy if exists "Admins manage experiences" on public.experiences;
create policy "Admins manage experiences"
  on public.experiences for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Partners update their experience" on public.experiences;
create policy "Partners update their experience"
  on public.experiences for update
  using (auth.uid() = claimed_by)
  with check (auth.uid() = claimed_by);
