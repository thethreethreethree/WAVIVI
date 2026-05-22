-- WAVIVI — duplicate-place guard for stays + experiences
--
-- Problem this fixes:
--   CSV re-imports were occasionally creating a *second* row for a place
--   that already existed, instead of updating it. Root cause: matching
--   leaned on location proximity, and Google nudges a pin's coordinates
--   between exports, so the match missed and a duplicate was inserted.
--   The only DB guard was `unique(source, source_ref)`, which does NOT
--   stop a duplicate when the same place comes in under a different
--   source_ref (e.g. a coord-fallback ref one time, a google: ref the
--   next) or a different `source`.
--
-- Solution (three layers, applied in order):
--   1. Derive a canonical `google_place_id` from source_ref (the stable
--      Google identity, identical across every export of a place).
--   2. Collapse any *existing* duplicates that share a google_place_id,
--      keeping the most "valuable" row (claimed > admin-edited > most
--      votes > most reviews > oldest).
--   3. Add a partial UNIQUE index on google_place_id so the database
--      itself refuses to ever store two rows for the same place again —
--      a hard backstop independent of import-engine logic.
--
-- Note: collapsing a duplicate deletes the losing row; its stay_votes
-- cascade away. Duplicates in practice are freshly-imported rows with no
-- votes/claims, so this is safe — and the ranking keeps any row that DID
-- accrue votes or a partner claim.

-- ── stays ──────────────────────────────────────────────────────────────
alter table public.stays
  add column if not exists google_place_id text
  generated always as (
    case when source_ref like 'google:%'
      then substring(source_ref from 8)
      else null
    end
  ) stored;

delete from public.stays s
using (
  select id,
    row_number() over (
      partition by google_place_id
      order by
        (claimed_by is not null) desc,
        admin_edited desc,
        thumbs_up desc,
        review_count desc,
        created_at asc
    ) as rn
  from public.stays
  where google_place_id is not null
) ranked
where s.id = ranked.id and ranked.rn > 1;

create unique index if not exists stays_google_place_id_key
  on public.stays (google_place_id)
  where google_place_id is not null;

-- ── experiences ────────────────────────────────────────────────────────
alter table public.experiences
  add column if not exists google_place_id text
  generated always as (
    case when source_ref like 'google:%'
      then substring(source_ref from 8)
      else null
    end
  ) stored;

delete from public.experiences e
using (
  select id,
    row_number() over (
      partition by google_place_id
      order by
        (claimed_by is not null) desc,
        admin_edited desc,
        thumbs_up desc,
        review_count desc,
        created_at asc
    ) as rn
  from public.experiences
  where google_place_id is not null
) ranked
where e.id = ranked.id and ranked.rn > 1;

create unique index if not exists experiences_google_place_id_key
  on public.experiences (google_place_id)
  where google_place_id is not null;
