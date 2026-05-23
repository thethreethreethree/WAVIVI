-- Wondavu — one Instagram handle, one Wondavu account.
--
-- Travelers must not be able to claim the same @username on two profiles.
-- We enforce it at the DB level so racey concurrent verifies can't both
-- succeed. Partial index because most travelers still have a NULL handle;
-- lower() because IG handles are case-insensitive and cleanUsername()
-- already lowercases on write.

create unique index if not exists profiles_instagram_username_unique
  on public.profiles (lower(instagram_username))
  where instagram_username is not null;
