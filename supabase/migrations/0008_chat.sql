-- WAVIVI — group chat (the heart of the app)
--
-- Tables: chat_groups, chat_group_members, chat_messages.
-- RLS:    groups + member rows are public-readable; only members can read
--         messages; users can post as themselves once they've joined.
-- Realtime: chat_messages is added to the supabase_realtime publication so
--           the chat thread can subscribe to new rows.
-- Seed:   the existing mock travel groups are inserted with their stable
--         string ids so current routes (`/meet/foodies-bangkok/chat` …)
--         keep working with real data.

-- ---------------------------------------------------------------------------
-- chat_groups
-- ---------------------------------------------------------------------------
create table if not exists public.chat_groups (
  id           text primary key check (char_length(id) between 3 and 64),
  name         text not null check (char_length(name) between 1 and 80),
  description  text,
  category     text,
  cover_image  text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- chat_group_members
-- ---------------------------------------------------------------------------
create table if not exists public.chat_group_members (
  group_id   text not null references public.chat_groups (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists chat_group_members_user_idx
  on public.chat_group_members (user_id);

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  group_id     text not null references public.chat_groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- Denormalised display name at send time so the realtime payload is
  -- self-contained — no client-side join needed to render the author.
  author_name  text not null,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now()
);

create index if not exists chat_messages_group_time_idx
  on public.chat_messages (group_id, created_at);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.chat_groups        enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_messages      enable row level security;

-- Groups are public so the discovery list works for anonymous browsers.
drop policy if exists "Groups are public" on public.chat_groups;
create policy "Groups are public"
  on public.chat_groups for select using (true);

-- Member rows are public-readable so member counts / avatars render.
drop policy if exists "Members are public" on public.chat_group_members;
create policy "Members are public"
  on public.chat_group_members for select using (true);

-- A user can join (insert their own membership) and leave (delete it).
drop policy if exists "Users can join groups" on public.chat_group_members;
create policy "Users can join groups"
  on public.chat_group_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can leave groups" on public.chat_group_members;
create policy "Users can leave groups"
  on public.chat_group_members for delete
  using (auth.uid() = user_id);

-- Messages are readable only by group members.
drop policy if exists "Messages readable by group members" on public.chat_messages;
create policy "Messages readable by group members"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_group_members m
      where m.group_id = chat_messages.group_id and m.user_id = auth.uid()
    )
  );

-- Authors can post as themselves, but only into groups they belong to.
drop policy if exists "Members can post" on public.chat_messages;
create policy "Members can post"
  on public.chat_messages for insert
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.chat_group_members m
      where m.group_id = chat_messages.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Authors can delete own messages" on public.chat_messages;
create policy "Authors can delete own messages"
  on public.chat_messages for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime — broadcast new messages to subscribed clients.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Seed: existing mock groups so current /meet routes keep working.
-- ---------------------------------------------------------------------------
insert into public.chat_groups (id, name, category) values
  ('foodies-bangkok',     'Foodies in Bangkok',       'Food'),
  ('nightlife-medellin',  'Nightlife in Medellín',    'Nightlife'),
  ('culture-tokyo',       'Culture Explorers Tokyo',  'Culture'),
  ('nature-bali',         'Nature Hikers Bali',       'Nature'),
  ('beach-santorini',     'Beach Lovers Santorini',   'Beach')
on conflict (id) do nothing;
