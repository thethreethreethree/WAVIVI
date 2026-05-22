-- WAVIVI — Restaurants (Where to Eat, in-app)
--
-- /eat previously handed off to YumYumPo. We're bringing it in-app for now
-- (YumYumPo integration returns later). Same shape as experiences with a
-- `cuisine` label instead of activity_type. No day_bucket — eating isn't a
-- morning/midday/nighttime thing here.

create table if not exists public.restaurants (
  id                    uuid primary key default gen_random_uuid(),
  region_id             text references public.regions (id) on delete set null,
  cuisine               text not null default 'other',
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

  price_range           text,
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

create index if not exists restaurants_region_idx
  on public.restaurants (region_id) where active = true;
create index if not exists restaurants_claimed_by_idx
  on public.restaurants (claimed_by) where claimed_by is not null;
create unique index if not exists restaurants_google_place_id_key
  on public.restaurants (google_place_id) where google_place_id is not null;

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

alter table public.restaurants enable row level security;

drop policy if exists "Restaurants are public" on public.restaurants;
create policy "Restaurants are public"
  on public.restaurants for select using (active = true or is_admin());

drop policy if exists "Admins manage restaurants" on public.restaurants;
create policy "Admins manage restaurants"
  on public.restaurants for all using (is_admin()) with check (is_admin());

drop policy if exists "Partners update their restaurant" on public.restaurants;
create policy "Partners update their restaurant"
  on public.restaurants for update
  using (auth.uid() = claimed_by)
  with check (auth.uid() = claimed_by);
