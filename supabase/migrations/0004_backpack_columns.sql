-- WAVIVI / Travejor — Toolbox fix-up
-- Adds the backpack-rating columns to traveler_utilities. These were added
-- to 0003 after the table already existed, and `create table if not exists`
-- does not alter an existing table — so they must be added explicitly.

alter table public.traveler_utilities
  add column if not exists backpack_rating numeric not null default 0
    check (backpack_rating between 0 and 5);

alter table public.traveler_utilities
  add column if not exists admin_edited boolean not null default false;

-- Re-assert the seed trigger now that the column is guaranteed to exist.
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
