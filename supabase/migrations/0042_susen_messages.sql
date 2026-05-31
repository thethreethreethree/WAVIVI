-- WAVIVI — susen_messages: persistent chat history with Susen.
--
-- Retention policy (enforced at READ time, not by deleting rows):
--   * Admins (auth.users.app_metadata.is_admin = true) see ALL of their rows.
--   * Everyone else sees only the rows from the last 24 hours.
--
-- Read-time filtering keeps the table append-only — a row simply becomes
-- invisible to a non-admin user once 24h pass. An optional cleanup job can
-- DELETE non-admin rows older than 24h later for storage hygiene; the user
-- experience does not depend on it.

create table if not exists public.susen_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'susen')),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists susen_messages_user_id_created_at_idx
  on public.susen_messages (user_id, created_at desc);

alter table public.susen_messages enable row level security;

drop policy if exists "susen_messages: own select" on public.susen_messages;
create policy "susen_messages: own select"
  on public.susen_messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "susen_messages: own insert" on public.susen_messages;
create policy "susen_messages: own insert"
  on public.susen_messages
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "susen_messages: own delete" on public.susen_messages;
create policy "susen_messages: own delete"
  on public.susen_messages
  for delete
  using (auth.uid() = user_id);
