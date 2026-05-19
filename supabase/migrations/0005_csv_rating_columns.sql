-- WAVIVI / Travejor — Toolbox CSV import
-- Adds Google-sourced rating + review-count columns. These are populated by
-- the admin CSV importer; community 👍/👎 (thumbs) stay separate.

alter table public.traveler_utilities
  add column if not exists rating numeric
    check (rating is null or (rating >= 0 and rating <= 5));

alter table public.traveler_utilities
  add column if not exists review_count integer not null default 0;
