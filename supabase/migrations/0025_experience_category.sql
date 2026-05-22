-- WAVIVI — broad Category for experiences, alongside the existing
-- specific `activity_type`.
--
-- Experiences now classify on two levels:
--   category       — broad theme used for the filter chips
--                    (Adventure, Water & Beach, Wellness, …)
--   activity_type  — the specific label shown per listing
--                    (Diving Center, Kayaking, Yoga Studio, …)
--
-- The CSV importer auto-derives `category` from the activity type / name /
-- description. Stored as free text (defaults to 'other') so existing rows and
-- CSVs without it still import; admins can override per row in the editor.

alter table public.experiences
  add column if not exists category text not null default 'other';

create index if not exists experiences_category_idx
  on public.experiences (category) where active = true;
