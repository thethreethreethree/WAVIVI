-- Wondavu — Traveler Notes (peer references)
--
-- A traveler can leave a short public note on another traveler's profile.
-- Builds traveler-to-traveler trust over time, like the references system on
-- Couchsurfing. Notes are public-readable (anyone viewing the profile sees
-- them); only the author can delete their own note.

create table if not exists public.traveler_notes (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references auth.users (id) on delete cascade,
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 500),
  created_at    timestamptz not null default now(),
  -- A traveler can't leave a note on their own profile.
  constraint traveler_notes_no_self check (author_id <> recipient_id)
);

-- Most reads are "notes received by X newest first" — index that.
create index if not exists traveler_notes_recipient_time_idx
  on public.traveler_notes (recipient_id, created_at desc);

alter table public.traveler_notes enable row level security;

drop policy if exists "Notes are public" on public.traveler_notes;
create policy "Notes are public"
  on public.traveler_notes for select using (true);

drop policy if exists "Authors leave notes" on public.traveler_notes;
create policy "Authors leave notes"
  on public.traveler_notes for insert
  with check (auth.uid() = author_id and author_id <> recipient_id);

drop policy if exists "Authors delete their notes" on public.traveler_notes;
create policy "Authors delete their notes"
  on public.traveler_notes for delete using (auth.uid() = author_id);
