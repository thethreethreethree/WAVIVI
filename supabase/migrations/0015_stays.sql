-- WAVIVI — Stays (hostels, hotels, guesthouses, resorts)
--
-- Mirrors the traveler_utilities pattern but for lodging. Designed so the
-- same table covers every accommodation type the app will care about:
-- hostels first, hotels / B&Bs / resorts / camping later.
--
-- Future flexibility built in:
--   * `stay_type` is text with a check constraint listing known values —
--     adding new types is a one-line migration.
--   * `claimed_by` lets a hostel/hotel partner self-onboard later;
--     partner-dashboard RLS can grant UPDATE to `auth.uid() = claimed_by`.
--   * `metadata_json` for anything we don't model yet (price tiers,
--     check-in time, amenity flags) without another migration.

-- ---------------------------------------------------------------------------
-- stays
-- ---------------------------------------------------------------------------
create table if not exists public.stays (
  id                  uuid primary key default gen_random_uuid(),
  region_id           text references public.regions (id) on delete set null,
  -- Lodging type. Extend the check list as the catalogue grows.
  stay_type           text not null default 'hostel'
                        check (stay_type in (
                          'hostel', 'hotel', 'guesthouse', 'resort',
                          'apartment', 'bnb', 'camping', 'other'
                        )),
  name                text not null check (char_length(name) between 1 and 200),
  latitude            double precision not null,
  longitude           double precision not null,
  google_maps_url     text not null default '',
  address             text,

  -- Google-sourced metrics (refreshed by CSV import).
  rating              numeric check (rating is null or (rating >= 0 and rating <= 5)),
  review_count        integer not null default 0,

  -- Community signal — Travejor-native.
  thumbs_up           integer not null default 0,
  thumbs_down         integer not null default 0,
  backpack_rating     numeric not null default 0
                        check (backpack_rating >= 0 and backpack_rating <= 5),
  reliability_score   numeric not null default 0,
  admin_edited        boolean not null default false,

  -- Contact + identity.
  phone               text,
  website             text,
  email               text,
  instagram           text,
  facebook            text,
  whatsapp            text,

  -- Optional partner / pricing info.
  price_per_night_usd numeric check (price_per_night_usd is null or price_per_night_usd >= 0),
  check_in_time       text,
  check_out_time      text,
  amenities           text[] not null default '{}'::text[],

  -- Storytelling.
  description         text,
  photo_url           text,
  photo_urls          text[] not null default '{}'::text[],

  -- Bookkeeping + future partner ownership.
  source              text not null default 'manual',
  source_ref          text not null,
  claimed_by          uuid references auth.users (id) on delete set null,
  metadata_json       jsonb not null default '{}'::jsonb,
  active              boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (source, source_ref)
);

create index if not exists stays_region_type_idx
  on public.stays (region_id, stay_type) where active = true;
create index if not exists stays_claimed_by_idx
  on public.stays (claimed_by) where claimed_by is not null;

drop trigger if exists stays_set_updated_at on public.stays;
create trigger stays_set_updated_at
  before update on public.stays
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
--   * Everyone can browse stays.
--   * Admins can do anything.
--   * Partner-dashboard hook: a user whose id matches `claimed_by` can
--     UPDATE their listing. (No partner UI yet; the policy is in place
--     so the future feature doesn't need another migration.)
-- ---------------------------------------------------------------------------
alter table public.stays enable row level security;

drop policy if exists "Stays are public" on public.stays;
create policy "Stays are public"
  on public.stays for select using (active = true or is_admin());

drop policy if exists "Admins manage stays" on public.stays;
create policy "Admins manage stays"
  on public.stays for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Partners update their stay" on public.stays;
create policy "Partners update their stay"
  on public.stays for update
  using (auth.uid() = claimed_by)
  with check (auth.uid() = claimed_by);
