-- WAVIVI — Stays: needs_review flag for extension-ingested rows
--
-- The Partner Collection browser extension scrapes Google Maps and POSTs
-- candidate stays into /api/admin/stays/ingest. We want those rows safe
-- in the DB but invisible on the public site until an admin approves
-- them. This adds the gate; the ingest endpoint sets needs_review=true,
-- the pending-review admin page lets staff approve (sets needs_review
-- =false) or reject (delete).
--
-- Existing rows are left untouched (default false → already approved).

alter table public.stays
  add column if not exists needs_review boolean not null default false;

-- Partial index for the pending queue (typically a small set).
create index if not exists stays_needs_review_idx
  on public.stays (needs_review, created_at desc)
  where needs_review = true;

-- Public read policy: hide rows that are still awaiting review.
-- Admins still see everything (is_admin() branch).
drop policy if exists "Stays are public" on public.stays;
create policy "Stays are public"
  on public.stays for select
  using ((active = true and needs_review = false) or is_admin());
