-- WAVIVI — Phase 2: Authentication & Profiles
-- Profiles table, row-level security, and an auto-create trigger.

-- ---------------------------------------------------------------------------
-- profiles
-- One row per auth user. `id` mirrors auth.users.id.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text unique not null
                    check (char_length(username) between 3 and 24
                           and username ~ '^[a-z0-9_]+$'),
  display_name    text not null check (char_length(display_name) between 1 and 48),
  bio             text check (char_length(bio) <= 280),
  avatar_url      text,
  home_country    text,
  traveler_status text not null default 'exploring'
                    check (traveler_status in ('exploring', 'local', 'transit', 'offline')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a new auth user signs up.
-- Reads username / display_name from the sign-up metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      'user_' || substr(new.id::text, 1, 8)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      'Traveler'
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
