-- WAVIVI — robust profile creation on signup
--
-- The original handle_new_user trigger would fail the entire signup
-- (surfaced as Supabase's opaque "Database error saving new user")
-- whenever the requested username was already taken. This replacement:
--   * Falls back to user_<short-uuid> if the requested username is taken,
--     so the auth user is always created.
--   * Sanitises the username to the allowed alphabet just in case.
--   * Truncates display_name to fit the column constraint.
--   * Swallows duplicate-key races on the profile insert.
-- The user can fix their username afterwards via /profile/edit.

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
  -- Strip anything outside [a-z0-9_].
  requested_username := regexp_replace(requested_username, '[^a-z0-9_]', '', 'g');
  -- Pad if too short, trim if too long.
  if char_length(requested_username) < 3 then
    requested_username := 'user_' || substr(new.id::text, 1, 8);
  end if;
  requested_username := substr(requested_username, 1, 24);

  -- Probe for the first free username; up to ~50 candidates.
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
      -- Extremely rare race: leave profile creation for /profile/edit.
      null;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
