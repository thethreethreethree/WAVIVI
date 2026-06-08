-- WAVIVI — promote utility categories from a hardcoded CHECK constraint
-- to a first-class admin-editable table.
--
-- Until now the 12 supported utility categories were locked in two places:
--   1) A CHECK constraint on traveler_utilities.category, listing them
--      explicitly. Adding a new category meant a migration.
--   2) The TS source-of-truth array in src/lib/toolbox/categories.ts,
--      which carries the icon, OSM filters, and traveler blurb.
--
-- The static TS list stays — icons and OSM filter definitions are
-- complex enough that a JSON column in the DB isn't a meaningful
-- improvement over typed source. But the CHECK constraint blocked
-- admins from registering custom categories, and that's what this
-- migration removes.
--
-- New shape:
--   * utility_categories rows act as the canonical "category exists"
--     gate for both runtime and admin UI.
--   * traveler_utilities.category is FK'd to utility_categories.id
--     with ON DELETE RESTRICT — an admin can't remove a category that
--     still has utilities pointing at it. (Soft-delete by toggling
--     `active=false` instead, which the admin UI surfaces.)
--   * Categories the static TS list knows about are seeded so existing
--     rows survive. The seed list also includes the 9 new categories
--     in the 2026-06-08 expansion (Pharmacy, Massage/Spa, Gym, etc.)
--     so they're scannable + assignable as soon as this migration runs.

create table if not exists public.utility_categories (
  id          text primary key,                  -- slug, e.g. 'atm'
  label       text not null,                     -- display name 'ATM'
  blurb       text not null default '',          -- short traveler blurb
  -- Icon name from the typed IconName union in src/components/ui/icon.tsx.
  -- Stored as plain text since IconName isn't enforceable in SQL; the
  -- admin UI's icon picker is what keeps invalid names out.
  icon        text not null default 'moreTools',
  -- OSM tag filters used by the toolbox scan engine. Shape:
  --   [{"key":"amenity","value":"atm"}, ...]
  -- Empty array → category exists but the OSM scan won't populate it
  -- (admin-only / CSV-only categories like 'luggage_storage').
  osm_filters jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists utility_categories_active_idx
  on public.utility_categories (active, sort_order);

-- Drop the CHECK constraint so the FK below can take over. The
-- constraint name is the auto-generated default Postgres assigns when
-- the table was created in 0003. `if exists` keeps a re-run of this
-- migration on a partially-applied DB safe.
alter table public.traveler_utilities
  drop constraint if exists traveler_utilities_category_check;

-- Seed: legacy 12 (so existing rows keep validating) + the 9 new
-- categories listed in the 2026-06-08 expansion.
insert into public.utility_categories
  (id, label, blurb, icon, osm_filters, sort_order)
values
  -- Existing 12 — preserved so traveler_utilities rows already in the
  -- DB still satisfy the FK below.
  ('atm',                       'ATM',                       'Cash machines near you',                'atm',       '[{"key":"amenity","value":"atm"}]',                10),
  ('bank',                      'Bank',                      'Branches and services',                 'bank',      '[{"key":"amenity","value":"bank"}]',               20),
  ('currency_exchange',         'Currency Exchange',         'Exchange money at fair rates',          'currency',  '[{"key":"amenity","value":"bureau_de_change"}]',   30),
  ('medical_clinic',            'Medical Clinic',            'Clinics, hospitals, doctors',           'clinic',    '[{"key":"amenity","value":"clinic"},{"key":"amenity","value":"hospital"},{"key":"amenity","value":"doctors"}]', 40),
  ('pharmacy',                  'Pharmacy',                  'Pharmacies and drugstores',             'clinic',    '[{"key":"amenity","value":"pharmacy"}]',           50),
  ('massage_spa',               'Massage / Spa',             'Massage and spa services',              'moreTools', '[{"key":"shop","value":"massage"},{"key":"leisure","value":"spa"}]', 60),
  ('gym_fitness',               'Gym / Fitness',             'Gyms and fitness studios',              'moreTools', '[{"key":"leisure","value":"fitness_centre"},{"key":"leisure","value":"fitness_station"}]', 70),
  ('public_wifi',               'Public Wi-Fi',              'Free connection spots',                 'wifi',      '[{"key":"internet_access","value":"wlan"},{"key":"internet_access","value":"yes"}]', 80),
  ('sim_card',                  'SIM Card',                  'Mobile data and SIMs',                  'sim',       '[{"key":"shop","value":"mobile_phone"},{"key":"shop","value":"telecommunication"}]', 90),
  ('convenience_store',         'Convenience Store',         'Small shops, sundries, snacks',         'store',     '[{"key":"shop","value":"convenience"},{"key":"shop","value":"supermarket"}]', 100),
  ('laundry',                   'Laundry',                   'Laundromats and dry cleaners',          'laundry',   '[{"key":"shop","value":"laundry"},{"key":"shop","value":"dry_cleaning"}]', 110),
  ('bathroom',                  'Bathroom',                  'Public restrooms nearby',               'bathroom',  '[{"key":"amenity","value":"toilets"}]',            120),
  ('luggage_storage',           'Luggage Storage',           'Bag drop and storage lockers',          'moreTools', '[{"key":"amenity","value":"luggage_locker"},{"key":"shop","value":"luggage_locker"}]', 130),
  ('transportation',            'Transportation',            'Buses, ferries, and transit',           'transport', '[{"key":"amenity","value":"bus_station"},{"key":"railway","value":"station"},{"key":"amenity","value":"ferry_terminal"},{"key":"amenity","value":"taxi"}]', 140),
  ('motorbike_rental',          'Motorbike / Scooter Rental','Two-wheeler rentals',                   'transport', '[{"key":"amenity","value":"motorcycle_rental"},{"key":"shop","value":"motorcycle"}]', 150),
  ('police',                    'Police',                    'Stations and help points',              'police',    '[{"key":"amenity","value":"police"}]',             160),
  ('embassy',                   'Embassy',                   'Consulates and embassies',              'embassy',   '[{"key":"amenity","value":"embassy"},{"key":"office","value":"diplomatic"}]', 170),
  ('petrol_station',            'Petrol Station',            'Gas stations and fuel stops',           'transport', '[{"key":"amenity","value":"fuel"}]',               180),
  ('post_office',               'Post Office',               'Mail and shipping',                     'moreTools', '[{"key":"amenity","value":"post_office"},{"key":"amenity","value":"post_box"}]', 190),
  ('tourist_info',              'Tourist Information',       'Maps, advice, and bookings',            'compass',   '[{"key":"tourism","value":"information"}]',        200),
  ('coworking_space',           'Coworking Space',           'Desks and remote-work spots',           'moreTools', '[{"key":"amenity","value":"coworking_space"},{"key":"office","value":"coworking"}]', 210),
  -- Legacy 'market' kept INACTIVE so existing rows tagged with it stay
  -- valid against the new FK; admins won't see it as an option, and
  -- they can migrate those rows to convenience_store via the cities
  -- admin re-tag flow when they want to.
  ('market',                    'Market (legacy)',           'Markets and groceries',                 'store',     '[{"key":"shop","value":"supermarket"},{"key":"shop","value":"convenience"},{"key":"amenity","value":"marketplace"}]', 999)
on conflict (id) do nothing;

-- Now wire the FK. Done after the seed so the constraint check below
-- finds every existing category referenced by traveler_utilities rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'traveler_utilities_category_fkey'
      and conrelid = 'public.traveler_utilities'::regclass
  ) then
    alter table public.traveler_utilities
      add constraint traveler_utilities_category_fkey
      foreign key (category)
      references public.utility_categories (id)
      on delete restrict;
  end if;
end $$;

-- Updated-at trigger on the new table — mirrors the same trigger
-- function the rest of the toolbox tables use.
drop trigger if exists utility_categories_set_updated_at on public.utility_categories;
create trigger utility_categories_set_updated_at
  before update on public.utility_categories
  for each row execute function public.set_updated_at();

-- RLS: categories are publicly readable (so the user-facing map can
-- pull the active list without auth), and admin-only writable.
alter table public.utility_categories enable row level security;

drop policy if exists "Utility categories are public" on public.utility_categories;
create policy "Utility categories are public"
  on public.utility_categories for select using (true);

drop policy if exists "Admins manage utility categories" on public.utility_categories;
create policy "Admins manage utility categories"
  on public.utility_categories for all
  using (is_admin())
  with check (is_admin());
