-- Susen feedback pipeline + rule conflict resolution.
--
-- Two coupled changes shipped together because the feedback workflow
-- ("traveller submits → admin reviews → promote to rule") needs a
-- target shape on the rule side that can express "this rule supersedes
-- the older one on the same topic". So:
--
-- 1. susen_dev_notes gains two columns:
--    - priority int default 0 — higher wins on conflict.
--    - topic text nullable    — groups rules so the engine can keep
--                               only the strongest per topic per scope.
--    Engine semantics: within one scope, rules with a non-null topic
--    are deduped; the rule with the highest priority survives (ties
--    broken by created_at desc — newer wins). Rules with NULL topic
--    fire side-by-side as before — that's the right behaviour for
--    orthogonal guidance ("always suggest a meetup", "use plain
--    English") where no conflict exists.
--
-- 2. New susen_feedback table — capture what travellers tell us
--    in-trip ("Pangolin's housemusic peaks 11pm-1am, not earlier"),
--    keep it pending until an admin reviews. Promoting a feedback row
--    creates a corresponding susen_dev_notes rule and stamps
--    promoted_to_note_id so we can trace the lineage backwards.

ALTER TABLE public.susen_dev_notes
  ADD COLUMN IF NOT EXISTS priority int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topic text;

COMMENT ON COLUMN public.susen_dev_notes.priority IS
  'Higher wins on conflict. Same-topic same-scope rules are deduped at injection time; the highest priority survives (ties broken by created_at desc).';
COMMENT ON COLUMN public.susen_dev_notes.topic IS
  'Optional topic tag (e.g. "nightlife", "transport"). Rules with the same topic in the same scope conflict; the engine keeps only the strongest. NULL means "no conflict" — fires side-by-side with everything else.';

-- Refresh the partial index so the planner can use priority/topic in
-- the same predicate it already uses for scope filtering.
DROP INDEX IF EXISTS public.susen_dev_notes_live_scope_idx;
CREATE INDEX IF NOT EXISTS susen_dev_notes_live_scope_idx
  ON public.susen_dev_notes (scope_type, country, region_id, city_id, topic, priority DESC)
  WHERE is_instruction AND active;

-- ── susen_feedback ────────────────────────────────────────────────────
-- Status flow: pending → (promoted | rejected). Promoted rows carry
-- promoted_to_note_id so the admin UI can link "this rule came from
-- traveller X's feedback".
CREATE TABLE IF NOT EXISTS public.susen_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Submitter (nullable so we can capture anonymously later if desired,
  -- though v1 gates the API behind auth).
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Scope context — same shape as susen_dev_notes so promotion is a
  -- straight copy. Country is the regions.country string; region_id
  -- and city_id are the scope FKs.
  country text,
  region_id text REFERENCES public.regions(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  -- Optional topic the feedback is about ("nightlife", "transport").
  -- Helps the admin pick a topic on the promoted rule.
  topic text,
  -- The actual content the traveller wrote.
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'promoted', 'rejected')),
  -- Audit trail for the review.
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- When promoted, points to the susen_dev_notes row this became.
  promoted_to_note_id uuid REFERENCES public.susen_dev_notes(id) ON DELETE SET NULL,
  CONSTRAINT susen_feedback_body_nonblank CHECK (length(trim(body)) > 0)
);

COMMENT ON TABLE public.susen_feedback IS
  'In-trip traveller feedback queued for admin review. Promoting a row creates a susen_dev_notes rule and links via promoted_to_note_id.';

-- Pending-queue read path — admins poll the pending list, sorted newest
-- first. Partial index keeps it tight as the promoted/rejected archive
-- grows.
CREATE INDEX IF NOT EXISTS susen_feedback_pending_idx
  ON public.susen_feedback (created_at DESC)
  WHERE status = 'pending';

-- "Who submitted what" lookup for the per-author view.
CREATE INDEX IF NOT EXISTS susen_feedback_by_author_idx
  ON public.susen_feedback (author_id, created_at DESC);

-- RLS — travellers can insert their own feedback and read it back, but
-- only admins (or service-role) can read everyone's queue or update
-- status. Updates from the app go through the service-role admin
-- client in /api/admin/susen/feedback, so a "deny all" policy is
-- enough for non-admin authenticated users on update/select-all paths.
ALTER TABLE public.susen_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY susen_feedback_insert_own
  ON public.susen_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY susen_feedback_select_own
  ON public.susen_feedback
  FOR SELECT
  TO authenticated
  USING (author_id = auth.uid());
