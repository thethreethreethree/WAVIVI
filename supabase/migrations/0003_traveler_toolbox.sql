-- WAVIVI / Travejor — Traveler Toolbox Infrastructure Data Engine
-- Regions, utilities, traveler reports, and the scan pipeline.

-- ---------------------------------------------------------------------------
-- Admin check — reads `app_metadata.is_admin` from the caller's JWT.
-- Used by RLS policies across the toolbox tables.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- regions
-- Admin-managed scan areas. Fully dynamic — no hardcoded cities.
-- ---------------------------------------------------------------------------
create table if not exists public.regions (
  id                  text primary key,
  country             text not null,
  province            text,
  city                text not null,
  display_name        text not null,
  latitude            double precision not null,
  longitude           double precision not null,
  radius_km           numeric not null default 25 check (radius_km between 1 and 200),
  timezone            text,
  active              boolean not null default true,
  scan_enabled        boolean not null default true,
  last_scan_at        timestamptz,
  next_scheduled_scan timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists regions_set_updated_at on public.regions;
create trigger regions_set_updated_at
  before update on public.regions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- traveler_utilities
-- One row per discovered utility pin. Deduplicated on the source ref.
-- ---------------------------------------------------------------------------
create table if not exists public.traveler_utilities (
  id                 uuid primary key default gen_random_uuid(),
  region_id          text references public.regions (id) on delete cascade,
  category           text not null check (category in (
                       'atm','market','bank','sim_card','public_wifi',
                       'currency_exchange','bathroom','transportation',
                       'medical_clinic','police','embassy','laundry')),
  name               text not null,
  latitude           double precision not null,
  longitude          double precision not null,
  google_maps_url    text not null,
  address            text,
  -- Community feedback — Wavivi travelers vote 👍/👎 (see utility_votes).
  thumbs_up          integer not null default 0,
  thumbs_down        integer not null default 0,
  open_24_hours      boolean not null default false,
  phone              text,
  website            text,
  reliability_score  numeric not null default 0 check (reliability_score between 0 and 10),
  -- Backpack rating 🎒 — the traveler-facing 0–5 score. Engine seeds it on
  -- first insert; admins may override it (rescans never overwrite it).
  backpack_rating    numeric not null default 0 check (backpack_rating between 0 and 5),
  admin_edited       boolean not null default false,
  crowd_level        text check (crowd_level in ('low','medium','high')),
  description        text,
  traveler_notes     text[] not null default '{}',
  -- Dedup key: the upstream source ('osm') + its stable id.
  source             text not null default 'osm',
  source_ref         text not null,
  metadata_json      jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (source, source_ref)
);

create index if not exists traveler_utilities_region_idx
  on public.traveler_utilities (region_id);
create index if not exists traveler_utilities_category_idx
  on public.traveler_utilities (category);
create index if not exists traveler_utilities_geo_idx
  on public.traveler_utilities (latitude, longitude);

drop trigger if exists traveler_utilities_set_updated_at on public.traveler_utilities;
create trigger traveler_utilities_set_updated_at
  before update on public.traveler_utilities
  for each row execute function public.set_updated_at();

-- Seed the backpack rating from the reliability score on first insert only.
-- Rescans (upsert → update) never touch it, so admin edits are preserved.
create or replace function public.seed_backpack_rating()
returns trigger
language plpgsql
as $$
begin
  if new.backpack_rating is null or new.backpack_rating = 0 then
    new.backpack_rating := round((new.reliability_score / 2) * 2) / 2;
  end if;
  return new;
end;
$$;

drop trigger if exists traveler_utilities_seed_backpack on public.traveler_utilities;
create trigger traveler_utilities_seed_backpack
  before insert on public.traveler_utilities
  for each row execute function public.seed_backpack_rating();

-- ---------------------------------------------------------------------------
-- traveler_reports
-- Community-submitted issues on a utility (offline ATM, bad wifi, etc.).
-- ---------------------------------------------------------------------------
create table if not exists public.traveler_reports (
  id           uuid primary key default gen_random_uuid(),
  utility_id   uuid not null references public.traveler_utilities (id) on delete cascade,
  reporter_id  uuid references auth.users (id) on delete set null,
  report_type  text not null check (report_type in (
                 'offline','bad_service','temp_closure','moved',
                 'incorrect_info','other')),
  note         text check (char_length(note) <= 500),
  status       text not null default 'open'
                 check (status in ('open','reviewed','resolved','dismissed')),
  created_at   timestamptz not null default now()
);

create index if not exists traveler_reports_utility_idx
  on public.traveler_reports (utility_id);
create index if not exists traveler_reports_status_idx
  on public.traveler_reports (status);

-- ---------------------------------------------------------------------------
-- utility_votes
-- One 👍/👎 per traveler per utility. A trigger keeps the cached
-- thumbs_up / thumbs_down counts on traveler_utilities fresh.
-- ---------------------------------------------------------------------------
create table if not exists public.utility_votes (
  id          uuid primary key default gen_random_uuid(),
  utility_id  uuid not null references public.traveler_utilities (id) on delete cascade,
  voter_id    uuid not null references auth.users (id) on delete cascade,
  vote        smallint not null check (vote in (-1, 1)),
  created_at  timestamptz not null default now(),
  unique (utility_id, voter_id)
);

create index if not exists utility_votes_utility_idx
  on public.utility_votes (utility_id);

create or replace function public.refresh_utility_votes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := coalesce(new.utility_id, old.utility_id);
begin
  update public.traveler_utilities u set
    thumbs_up = (
      select count(*) from public.utility_votes v
      where v.utility_id = uid and v.vote = 1
    ),
    thumbs_down = (
      select count(*) from public.utility_votes v
      where v.utility_id = uid and v.vote = -1
    )
  where u.id = uid;
  return null;
end;
$$;

drop trigger if exists utility_votes_refresh on public.utility_votes;
create trigger utility_votes_refresh
  after insert or update or delete on public.utility_votes
  for each row execute function public.refresh_utility_votes();

-- ---------------------------------------------------------------------------
-- scan_jobs
-- One row per region x category scan run.
-- ---------------------------------------------------------------------------
create table if not exists public.scan_jobs (
  id           uuid primary key default gen_random_uuid(),
  region_id    text not null references public.regions (id) on delete cascade,
  category     text check (category in (
                 'atm','market','bank','sim_card','public_wifi',
                 'currency_exchange','bathroom','transportation',
                 'medical_clinic','police','embassy','laundry')),
  status       text not null default 'pending'
                 check (status in ('pending','running','completed','failed')),
  started_at   timestamptz,
  completed_at timestamptz,
  total_found  integer not null default 0,
  total_saved  integer not null default 0,
  errors       text,
  created_at   timestamptz not null default now()
);

create index if not exists scan_jobs_region_idx on public.scan_jobs (region_id);
create index if not exists scan_jobs_status_idx on public.scan_jobs (status);

-- ---------------------------------------------------------------------------
-- scan_logs
-- Verbose per-job log lines for debugging and the admin scan view.
-- ---------------------------------------------------------------------------
create table if not exists public.scan_logs (
  id          uuid primary key default gen_random_uuid(),
  scan_job_id uuid not null references public.scan_jobs (id) on delete cascade,
  level       text not null default 'info' check (level in ('info','warn','error')),
  message     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists scan_logs_job_idx on public.scan_logs (scan_job_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- Utilities + regions are public to read; writes are admin-only.
-- The scan engine runs with the service-role key and bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.regions            enable row level security;
alter table public.traveler_utilities enable row level security;
alter table public.traveler_reports   enable row level security;
alter table public.utility_votes      enable row level security;
alter table public.scan_jobs          enable row level security;
alter table public.scan_logs          enable row level security;

-- regions: anyone sees active regions; admins see + manage all.
drop policy if exists "Regions are viewable" on public.regions;
create policy "Regions are viewable"
  on public.regions for select
  using (active or public.is_admin());

drop policy if exists "Admins manage regions" on public.regions;
create policy "Admins manage regions"
  on public.regions for all
  using (public.is_admin())
  with check (public.is_admin());

-- traveler_utilities: public read; admin write.
drop policy if exists "Utilities are viewable by everyone" on public.traveler_utilities;
create policy "Utilities are viewable by everyone"
  on public.traveler_utilities for select
  using (true);

drop policy if exists "Admins manage utilities" on public.traveler_utilities;
create policy "Admins manage utilities"
  on public.traveler_utilities for all
  using (public.is_admin())
  with check (public.is_admin());

-- traveler_reports: users file + see their own; admins see + manage all.
drop policy if exists "Users see their own reports" on public.traveler_reports;
create policy "Users see their own reports"
  on public.traveler_reports for select
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "Users file reports" on public.traveler_reports;
create policy "Users file reports"
  on public.traveler_reports for insert
  with check (reporter_id = auth.uid());

drop policy if exists "Admins manage reports" on public.traveler_reports;
create policy "Admins manage reports"
  on public.traveler_reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- utility_votes: travelers manage their own 👍/👎.
drop policy if exists "Voters see their own votes" on public.utility_votes;
create policy "Voters see their own votes"
  on public.utility_votes for select
  using (voter_id = auth.uid() or public.is_admin());

drop policy if exists "Voters cast votes" on public.utility_votes;
create policy "Voters cast votes"
  on public.utility_votes for insert
  with check (voter_id = auth.uid());

drop policy if exists "Voters change their vote" on public.utility_votes;
create policy "Voters change their vote"
  on public.utility_votes for update
  using (voter_id = auth.uid())
  with check (voter_id = auth.uid());

drop policy if exists "Voters remove their vote" on public.utility_votes;
create policy "Voters remove their vote"
  on public.utility_votes for delete
  using (voter_id = auth.uid());

-- scan_jobs + scan_logs: admin-only visibility.
drop policy if exists "Admins view scan jobs" on public.scan_jobs;
create policy "Admins view scan jobs"
  on public.scan_jobs for select
  using (public.is_admin());

drop policy if exists "Admins view scan logs" on public.scan_logs;
create policy "Admins view scan logs"
  on public.scan_logs for select
  using (public.is_admin());
