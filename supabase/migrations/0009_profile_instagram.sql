-- WAVIVI — link an Instagram identity to a profile
--
-- Stores only the public handle, an admin-set verified flag, and an
-- optional list of post permalinks the user has chosen to showcase.
-- We never store passwords, tokens, or media — IG OAuth (Basic Display)
-- can be layered on top later by populating these same columns.

alter table public.profiles
  add column if not exists instagram_username text
    check (
      instagram_username is null or (
        char_length(instagram_username) between 1 and 30
        and instagram_username ~ '^[a-zA-Z0-9._]+$'
      )
    ),
  add column if not exists instagram_verified boolean not null default false,
  add column if not exists instagram_post_urls text[] not null default '{}'::text[];

-- Make the handle searchable / unique-friendly without breaking existing rows.
create unique index if not exists profiles_instagram_username_unique
  on public.profiles (lower(instagram_username))
  where instagram_username is not null;
