-- Wondavu — admin control flags on chat_groups.
--
-- Adds the columns the admin Groups dashboard needs to actually manage
-- groups: `featured` (promote on /meet), `archived` (soft-hide from
-- discovery), and an updated_at trigger so we know when an admin last
-- touched a row.

alter table public.chat_groups
  add column if not exists featured boolean not null default false,
  add column if not exists archived boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists chat_groups_featured_idx
  on public.chat_groups (featured) where featured = true;
create index if not exists chat_groups_active_idx
  on public.chat_groups (archived) where archived = false;

drop trigger if exists chat_groups_set_updated_at on public.chat_groups;
create trigger chat_groups_set_updated_at
  before update on public.chat_groups
  for each row execute function public.set_updated_at();
