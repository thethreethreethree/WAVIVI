-- Wondavu — Pet System (Tamagotchi-style travel companion)
--
-- Locked decisions (see Wondavu Pet/docs/pet-system-design.md §0):
--   * 1 pet per user (PK = user_id)
--   * No permadeath; below-floor stats for 48h flip status to 'dormant'
--   * Currency: Wondacoins (WC), earned-only
--   * MVP species: 'wanderling'; MVP stages: 'egg', 'hatchling'
--   * Reward triggers: visit_new_place, join_group, mutual_note, write_note, daily_login
--
-- Decay tick is lazy (computed on read in the app layer) so no cron is needed
-- for MVP. `last_tick_at` is the high-water mark the app uses to compute how
-- many hours of decay to apply on the next pet read.

-- ---------------------------------------------------------------------------
-- pet
-- One row per user. Created automatically on signup via handle_new_user.
-- ---------------------------------------------------------------------------
create table if not exists public.pet (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  species        text not null default 'wanderling'
                   check (species in ('wanderling')), -- expand in Phase 2
  name           text not null default 'Egg'
                   check (char_length(name) between 1 and 24),
  stage          text not null default 'egg'
                   check (stage in ('egg', 'hatchling', 'pup', 'explorer', 'wayfarer', 'elder')),
  branch         text
                   check (branch is null
                          or branch in ('explorer', 'social', 'foodie', 'homebody', 'adventurer')),
  xp             integer not null default 0 check (xp >= 0),
  hunger         smallint not null default 80 check (hunger between 0 and 100),
  happiness      smallint not null default 80 check (happiness between 0 and 100),
  energy         smallint not null default 80 check (energy between 0 and 100),
  cleanliness   smallint not null default 80 check (cleanliness between 0 and 100),
  wanderlust     smallint not null default 50 check (wanderlust between 0 and 100),
  bond           smallint not null default 0 check (bond between 0 and 100),
  status         text not null default 'healthy'
                   check (status in ('healthy', 'sick', 'dormant')),
  wc_balance     integer not null default 0 check (wc_balance >= 0),
  last_tick_at   timestamptz not null default now(),
  hatched_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- updated_at-style trigger isn't needed; last_tick_at carries that signal.

-- ---------------------------------------------------------------------------
-- pet_item
-- Catalog of shop items. Read-public, write-admin. Empty at MVP; shop ships
-- in Phase 2 but the table lands now so the schema is stable.
-- ---------------------------------------------------------------------------
create table if not exists public.pet_item (
  slug           text primary key,
  category       text not null
                   check (category in ('food', 'toy', 'hat', 'body', 'background', 'boost', 'special')),
  name           text not null,
  description    text,
  price_wc       integer not null check (price_wc >= 0),
  effect         jsonb not null default '{}'::jsonb,
  region         text,
  sprite         text not null,
  unlock_stage   text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pet_inventory
-- What each user owns. (user_id, item_slug) composite key.
-- ---------------------------------------------------------------------------
create table if not exists public.pet_inventory (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  item_slug      text not null references public.pet_item (slug) on delete restrict,
  qty            integer not null default 0 check (qty >= 0),
  equipped       boolean not null default false,
  acquired_at    timestamptz not null default now(),
  primary key (user_id, item_slug)
);

-- ---------------------------------------------------------------------------
-- pet_token_ledger
-- Append-only Wondacoin movements. Idempotent via the composite unique key:
-- the same (user, reason, source_kind, source_id) tuple can only fire once,
-- which keeps reward hooks safe to retry.
-- ---------------------------------------------------------------------------
create table if not exists public.pet_token_ledger (
  id             bigserial primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  delta          integer not null,
  balance_after  integer not null check (balance_after >= 0),
  reason         text not null,
  source_kind    text,
  source_id      text,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  unique (user_id, reason, source_kind, source_id)
);

create index if not exists pet_token_ledger_user_time_idx
  on public.pet_token_ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- pet_reward_rule
-- Tunable rule book — change rewards without a code deploy.
-- ---------------------------------------------------------------------------
create table if not exists public.pet_reward_rule (
  action_kind    text primary key,
  xp             integer not null default 0,
  tokens         integer not null default 0,
  stat_bumps     jsonb not null default '{}'::jsonb,
  cap_per_day    integer,
  one_time       boolean not null default false,
  active         boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pet_event
-- Audit log of pet interactions for analytics + animations.
-- ---------------------------------------------------------------------------
create table if not exists public.pet_event (
  id             bigserial primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  kind           text not null,
  meta           jsonb not null default '{}'::jsonb,
  at             timestamptz not null default now()
);

create index if not exists pet_event_user_time_idx
  on public.pet_event (user_id, at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.pet enable row level security;
alter table public.pet_item enable row level security;
alter table public.pet_inventory enable row level security;
alter table public.pet_token_ledger enable row level security;
alter table public.pet_reward_rule enable row level security;
alter table public.pet_event enable row level security;

-- pet: owner can read & update their own row; pets are public-readable
-- (decision #8: pet visible on /u/[username]). Inserts only by trigger.
drop policy if exists "Pets are public" on public.pet;
create policy "Pets are public"
  on public.pet for select using (true);

drop policy if exists "Owner updates pet" on public.pet;
create policy "Owner updates pet"
  on public.pet for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pet_item: public read; writes are admin-only (no policy = denied).
drop policy if exists "Items are public" on public.pet_item;
create policy "Items are public"
  on public.pet_item for select using (true);

-- pet_inventory / pet_token_ledger / pet_event: owner-only reads. Inserts
-- and updates flow through server actions that run with the user's session,
-- so a `with check (auth.uid() = user_id)` is the right guard.
drop policy if exists "Owner reads inventory" on public.pet_inventory;
create policy "Owner reads inventory"
  on public.pet_inventory for select using (auth.uid() = user_id);

drop policy if exists "Owner writes inventory" on public.pet_inventory;
create policy "Owner writes inventory"
  on public.pet_inventory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owner reads ledger" on public.pet_token_ledger;
create policy "Owner reads ledger"
  on public.pet_token_ledger for select using (auth.uid() = user_id);

drop policy if exists "Owner writes ledger" on public.pet_token_ledger;
create policy "Owner writes ledger"
  on public.pet_token_ledger for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owner reads events" on public.pet_event;
create policy "Owner reads events"
  on public.pet_event for select using (auth.uid() = user_id);

drop policy if exists "Owner writes events" on public.pet_event;
create policy "Owner writes events"
  on public.pet_event for insert
  with check (auth.uid() = user_id);

-- pet_reward_rule: public read so the app can display per-action rewards.
drop policy if exists "Rules are public" on public.pet_reward_rule;
create policy "Rules are public"
  on public.pet_reward_rule for select using (true);

-- ---------------------------------------------------------------------------
-- handle_new_user — extend the existing trigger to also create a pet row.
-- Replaces the function from 0007. The pet insert is wrapped in begin/end
-- so a duplicate or other rare failure doesn't break signup.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_username text;
  final_username     text;
  candidate          text;
  suffix             int := 0;
  display            text;
begin
  requested_username := lower(coalesce(
    new.raw_user_meta_data ->> 'username',
    'user_' || substr(new.id::text, 1, 8)
  ));
  requested_username := regexp_replace(requested_username, '[^a-z0-9_]', '', 'g');
  if char_length(requested_username) < 3 then
    requested_username := 'user_' || substr(new.id::text, 1, 8);
  end if;
  requested_username := substr(requested_username, 1, 24);

  candidate := requested_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := substr(requested_username, 1, 22) || lpad(suffix::text, 2, '0');
    if suffix > 50 then
      candidate := 'user_' || substr(new.id::text, 1, 8);
      exit;
    end if;
  end loop;
  final_username := candidate;

  display := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Traveler');
  display := substr(display, 1, 48);

  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, final_username, display);
  exception
    when unique_violation then
      null;
  end;

  -- Hatch the egg. Default name "Egg" — user renames on first hatch.
  begin
    insert into public.pet (user_id, name)
    values (new.id, 'Egg');
  exception
    when others then
      -- Never let a pet-creation failure block signup.
      null;
  end;

  return new;
end;
$$;

-- The trigger itself is unchanged (drop+recreate kept for safety).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Back-fill pets for existing profiles so /pet doesn't 404 for current users.
insert into public.pet (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed reward rules. cap_per_day = null means "no cap". one_time = true
-- means "fires only once per (user, source_id)" which is the default
-- semantic enforced by pet_token_ledger's unique constraint on
-- (user_id, reason, source_kind, source_id) — we use cap_per_day for the
-- daily_login soft limit and one_time for source-bound rewards.
-- ---------------------------------------------------------------------------
insert into public.pet_reward_rule (action_kind, xp, tokens, stat_bumps, cap_per_day, one_time)
values
  ('visit_new_place', 15, 10, '{"wanderlust":15,"happiness":5}'::jsonb, null, true),
  ('join_group',      10, 15, '{"happiness":10}'::jsonb,                null, true),
  ('mutual_note',     20, 20, '{"happiness":15,"bond":5}'::jsonb,       null, true),
  ('write_note',      10, 10, '{"bond":5}'::jsonb,                      null, true),
  ('daily_login',      2,  5, '{"bond":1}'::jsonb,                      1,    false)
on conflict (action_kind) do update set
  xp = excluded.xp,
  tokens = excluded.tokens,
  stat_bumps = excluded.stat_bumps,
  cap_per_day = excluded.cap_per_day,
  one_time = excluded.one_time,
  active = true,
  updated_at = now();
