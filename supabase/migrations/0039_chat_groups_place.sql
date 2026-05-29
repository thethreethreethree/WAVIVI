-- WAVIVI — chat_groups: optional "specific location" pin.
--
-- Up to now a group's place in the world was a free-text city +
-- country pair (later set from a region via the admin editor). Some
-- groups also want a single concrete pin — "MEET UP! hangs out at
-- Sunset Bar" — so /meet/[id] can drop a map marker, link to a
-- partner page, etc.
--
-- The pin is optional. Columns:
--   place_name         Human-readable label ("Sunset Bar")
--   place_address      Street address ("Calle Real, El Nido, Palawan")
--   place_lat,lng      Coordinates for map rendering
--   place_partner_id   When the pin is one of our own partners, the
--                       FK to that row. Type lives in place_partner_type.
--   place_partner_type One of: stay | restaurant | experience | event
--                       NULL when the pin came from an external source
--                       (Google Maps) instead of our partner DB.

alter table public.chat_groups
  add column if not exists place_name text,
  add column if not exists place_address text,
  add column if not exists place_lat double precision,
  add column if not exists place_lng double precision,
  add column if not exists place_partner_id text,
  add column if not exists place_partner_type text;

-- Type guard — keep the partner_type to a known set so the detail page
-- can route the deep-link safely.
alter table public.chat_groups
  drop constraint if exists chat_groups_place_partner_type_check;
alter table public.chat_groups
  add constraint chat_groups_place_partner_type_check
  check (
    place_partner_type is null
    or place_partner_type in ('stay', 'restaurant', 'experience', 'event')
  );

-- Coordinate plausibility — cheap insurance against bad rows.
alter table public.chat_groups
  drop constraint if exists chat_groups_place_lat_check;
alter table public.chat_groups
  add constraint chat_groups_place_lat_check
  check (place_lat is null or (place_lat between -90 and 90));

alter table public.chat_groups
  drop constraint if exists chat_groups_place_lng_check;
alter table public.chat_groups
  add constraint chat_groups_place_lng_check
  check (place_lng is null or (place_lng between -180 and 180));

-- Optional partner deep-link index — admin search filters by partner
-- when reconciling a partner rename, so a single-column index pays for
-- itself in those rare lookups without bloating the row write path.
create index if not exists chat_groups_place_partner_idx
  on public.chat_groups (place_partner_type, place_partner_id)
  where place_partner_id is not null;
