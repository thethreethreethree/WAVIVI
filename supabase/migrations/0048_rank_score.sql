-- Migration 0048 — quality-weighted ranking score for the place tables.
--
-- Product rule (from the founder): on /stay, /eat, /tools/things-to-do,
-- and the home "For you" rail, a 5★ place with 2 reviews is NOT ranked
-- higher than a 4.3★ place with 400 reviews. Until now those queries
-- ordered by `backpack_rating` (or raw `rating`) descending, which
-- promoted under-reviewed outliers to the top of every list.
--
-- This migration adds a generated `rank_score` column to each place
-- table. The score is a Bayesian average between the row's own rating
-- and a neutral prior — same shape as the IMDB Top 250 formula.
--
--   rank_score = (R * v + C * m) / (v + m)
--
-- where:
--   R = rating          (Google's 0..5 average)
--   v = review_count    (Google's review tally)
--   C = prior_rating    (4.0 — a neutral "this place is okay" score)
--   m = prior_weight    (50 — the number of reviews after which the
--                        row's own rating starts to dominate the prior)
--
-- The prior weight is the key knob. Tuning rationale:
--   - 5★ / 2 reviews    → (5*2  + 4*50) / 52  ≈ 4.04
--   - 4.3★ / 400 reviews → (4.3*400 + 4*50) / 450 ≈ 4.27   ← ranks higher
--   - 5★ / 1000 reviews  → (5*1000 + 4*50) / 1050 ≈ 4.95   ← still on top
--   - rating=null / 0 reviews → 4.0 (the prior — neutral default)
--
-- 200.0 = 4.0 * 50 — pre-multiplied so the generated expression stays
-- immutable and can back an index. If the priors ever change, update
-- this migration in a follow-up so the constant stays single-sourced.
--
-- COALESCE(rating, 0) means a NULL Google rating is treated as zero
-- (it pulls the score toward 0 only once review_count > 0; rows with
-- 0 reviews still score the prior 4.0 regardless).

alter table public.stays
  add column if not exists rank_score numeric
  generated always as (
    (coalesce(rating, 0)::numeric * review_count + 200.0)
      / (review_count + 50)
  ) stored;

alter table public.restaurants
  add column if not exists rank_score numeric
  generated always as (
    (coalesce(rating, 0)::numeric * review_count + 200.0)
      / (review_count + 50)
  ) stored;

alter table public.experiences
  add column if not exists rank_score numeric
  generated always as (
    (coalesce(rating, 0)::numeric * review_count + 200.0)
      / (review_count + 50)
  ) stored;

-- Same column on the other two rated content tables. Events and
-- toolbox utilities both carry rating + review_count and surface in
-- ranked lists too — adding the column system-wide makes the policy
-- "best content first" consistent across every list the app shows.
alter table public.events
  add column if not exists rank_score numeric
  generated always as (
    (coalesce(rating, 0)::numeric * review_count + 200.0)
      / (review_count + 50)
  ) stored;

alter table public.traveler_utilities
  add column if not exists rank_score numeric
  generated always as (
    (coalesce(rating, 0)::numeric * review_count + 200.0)
      / (review_count + 50)
  ) stored;

-- Covering indexes for the hot list paths.  The (region_id, active)
-- prefix matches every page-level filter we have; DESC NULLS LAST so
-- the planner can do a backward index scan and return rows already
-- in display order without a sort step.
create index if not exists stays_region_rank_idx
  on public.stays (region_id, active, rank_score desc nulls last);

create index if not exists restaurants_region_rank_idx
  on public.restaurants (region_id, active, rank_score desc nulls last);

create index if not exists experiences_region_rank_idx
  on public.experiences (region_id, active, rank_score desc nulls last);

create index if not exists events_region_rank_idx
  on public.events (region_id, active, rank_score desc nulls last);

-- traveler_utilities has no `active` column (no soft-delete on the
-- toolbox table — the scraper deletes / replaces rows wholesale on
-- re-scan). Index just (region_id, rank_score DESC NULLS LAST) so the
-- /api/utilities sort can still do a backward index scan.
create index if not exists traveler_utilities_region_rank_idx
  on public.traveler_utilities (region_id, rank_score desc nulls last);
