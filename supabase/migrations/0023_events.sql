-- WAVIVI — Events (socials, nights out, meetups, festivals)
--
-- Same shape as experiences (region-scoped, CSV-importable, partner-
-- claimable) with two event-specific extras:
--   * when_text  — human date/time label ("Fri, 22 May · 21:00")
--   * day_bucket — morning | midday | nighttime (the time-of-day filter)
--   * category   — event theme label (Nightlife, Meetup, Food, …)
--
-- Replaces the mock travejorEvents list once admins import a CSV.

create table if not exists public.events (
  id                    uuid primary key default gen_random_uuid(),
  region_id             text references public.regions (id) on delete set null,
  category              text not null default 'other',
  day_bucket            text,
  when_text             text,
  name                  text not null check (char_length(name) between 1 and 200),
  description           text,
  latitude              double precision not null,
  longitude             double precision not null,
  google_maps_url       text not null default '',
  address               text,

  rating                numeric check (rating is null or (rating >= 0 and rating <= 5)),
  review_count          integer not null default 0,

  thumbs_up             integer not null default 0,
  thumbs_down           integer not null default 0,
  backpack_rating       numeric not null default 0
                          check (backpack_rating >= 0 and backpack_rating <= 5),
  reliability_score     numeric not null default 0,
  admin_edited          boolean not null default false,

  phone                 text,
  website               text,
  email                 text,
  instagram             text,
  facebook              text,
  whatsapp              text,

  amenities             text[] not null default '{}'::text[],
  photo_url             text,
  photo_urls            text[] not null default '{}'::text[],

  source                text not null default 'manual',
  source_ref            text not null,
  google_place_id       text generated always as (
    case when source_ref like 'google:%'
      then substring(source_ref from 8) else null end
  ) stored,
  claimed_by            uuid references auth.users (id) on delete set null,
  metadata_json         jsonb not null default '{}'::jsonb,
  active                boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (source, source_ref)
);

create index if not exists events_region_idx
  on public.events (region_id) where active = true;
create index if not exists events_claimed_by_idx
  on public.events (claimed_by) where claimed_by is not null;
create unique index if not exists events_google_place_id_key
  on public.events (google_place_id) where google_place_id is not null;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

drop policy if exists "Events are public" on public.events;
create policy "Events are public"
  on public.events for select using (active = true or is_admin());

drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events"
  on public.events for all using (is_admin()) with check (is_admin());

drop policy if exists "Partners update their event" on public.events;
create policy "Partners update their event"
  on public.events for update
  using (auth.uid() = claimed_by)
  with check (auth.uid() = claimed_by);
