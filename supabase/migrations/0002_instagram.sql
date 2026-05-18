-- WAVIVI / Travejor — Instagram Identity Layer
-- Travelers link an Instagram identity and showcase selected posts.
-- IMPORTANT: Travejor stores URLs only — never Instagram media.

-- ---------------------------------------------------------------------------
-- profiles — Instagram identity columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists instagram_username    text
    check (instagram_username is null
           or instagram_username ~ '^[a-zA-Z0-9._]+$'),
  add column if not exists instagram_url          text,
  add column if not exists instagram_verified     boolean not null default false,
  add column if not exists instagram_connected_at timestamptz;

-- ---------------------------------------------------------------------------
-- instagram_posts — traveler-selected showcase posts (URLs only)
-- ---------------------------------------------------------------------------
create table if not exists public.instagram_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  post_url      text not null
    check (post_url ~ 'instagram\.com/(p|reel)/'),
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists instagram_posts_user_idx
  on public.instagram_posts (user_id, display_order);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.instagram_posts enable row level security;

drop policy if exists "Showcase posts are public" on public.instagram_posts;
create policy "Showcase posts are public"
  on public.instagram_posts for select
  using (true);

drop policy if exists "Travelers manage their own posts" on public.instagram_posts;
create policy "Travelers manage their own posts"
  on public.instagram_posts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
