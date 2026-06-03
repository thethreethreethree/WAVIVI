# Postmortem: Susen claimed "no cafes" while five existed in the DB

**Date:** 2026-06-03
**Commit range:** `97b4754` → `2ad1c29`
**Time to fix:** 5 patches / 5 commits / **~3.5 hours of the user's day**
**Authors / agents involved:** Claude Opus 4.7

## Symptom

User asked Susen "i need a cafe in el nido" repeatedly across the
afternoon. Each time the model replied with some variation of
*"honestly John, still nothing cafe-wise in the current list — just
restaurants and stays for now. Want me to flag that as a gap?"*

The user verified directly that the database had **5 cafes** in El
Nido restaurants with `cuisine='Cafe'`:

| name | cuisine | rank_score |
|---|---|---|
| AP KALA beach bar & modern cafe | Cafe | 4.46 |
| 86'd Gourmet Cafe and Bar | Cafe | 4.38 |
| El Nido Boutique Artcafe | Cafe | 4.20 |
| Elara Cafe & Convenience Store | Cafe | 4.14 |
| Dayō Cafe El Nido | Cafe | 3.91 |

So the data existed. Susen just couldn't see it. The misleading "tell"
was that *every other category Susen named was correct* — she'd
recommend an Italian pizzeria or a Filipino spot accurately. The
failure was category-specific, which made it feel like a search /
classification bug rather than a retrieval-shape bug.

## Wrong hypotheses (and why each was wrong)

- **Attempt 1 — `97b4754`** — Hypothesis: *"the model has no DB
  access; ship a basic RAG that injects top-20 per table."* Fix:
  added `loadSusenInventory()` and the CURRENT INVENTORY block.
  Symptom didn't move. *Evidence weighed wrong:* assumed top-20 by
  rank would always include the kind of place a user asks about.
  Niche cuisines in a popular region don't rank top-20.

- **Attempt 2 — `c395394`** — Hypothesis: *"the cookie isn't set, or
  the cookie region doesn't match the city the user asked about."*
  Fix: added `detectRegionFromInput()` plus the `[susen] respond {...}`
  diagnostic log. Symptom didn't move. *But:* the log proved both
  hypotheses wrong on the next request — cookie + detected + effective
  region were all correctly `el_nido_palawan_philippines` and the
  inventory loaded `restaurants: 30`. This patch was useful as a
  probe even though the hypothesis was wrong.

- **Attempt 3 — `de3b3b6`** — Hypothesis: *"top-N alone misses niche
  cuisines; add per-category cohorts."* Fix: introduced `TOP_PER_CATEGORY=2`
  on top of `TOP_OVERALL`. Symptom didn't move. *Evidence weighed
  wrong:* the merge iterated `[...overall, ...perCategory]` and capped
  at 30, so niche perCategory rows got truncated by the cap before
  reaching merged. Falsified at PR time with synthetic data that
  *didn't reproduce the real category mix*.

- **Attempt 4 — `0272f8a`** — Hypothesis: *"the cap fires before
  niche categories; reorder the merge so perCategory comes first and
  raise the cap from 30 to 40."* Fix: swapped the iteration order
  and bumped `MAX_PER_TABLE`. Symptom didn't move. *Evidence weighed
  wrong:* `TOP_PER_CATEGORY=2` means perCategory has 2×N entries
  where N is the count of distinct categories. For El Nido's 18+
  cuisines, that's 36+ entries; the cap still truncates the tail
  (where Cafe lives). The fix changed *which* niche category got
  cut, not whether one did.

The §2 "Watch for succeeding patch-loops" rule was being violated
in plain sight: attempts 1, 3, and 4 were all variations on "limit
per category" wearing different clothes. Each one shipped, each one
*looked locally correct*, and the missed root cause kept hiding
behind the surface plausibility of the patch.

- **Attempt 5 — `2ad1c29`** — Hypothesis: *"the algorithm needs
  GUARANTEED per category, not LIMIT per category."* Fix:
  `Map`-keyed first-write-wins guarantees exactly one slot for every
  distinct category present in the pool, then fills remaining slots
  with top-overall by rank. **Worked.** Cafe (AP KALA at rank 4.46)
  finally made the cohort because its slot couldn't be displaced.
  Falsification reproduced the actual El Nido category mix from the
  06:25 production log this time, not a synthetic mix.

## How we eventually found the real cause

A two-part probe sequence, not a single moment of insight:

1. **The `[susen] respond {...}` log line added in attempt 2** stayed
   permanent and was the running source of truth after every later
   attempt. It showed inventory was reaching the route handler, ruled
   out the RLS / cookie hypotheses, and made it impossible to hand-
   wave that "the data isn't loading."

2. **The DevTools Network probe at the end** confirmed POST
   `/api/susen/respond` → 200 OK was happening on every chat send
   and the response body was genuinely new text each time (the
   word-for-word repetition was an illusion of partial paraphrasing).
   That eliminated the "service worker is replaying a cached
   response" and "chat UI is showing stale data" hypotheses in one
   shot, and forced the diagnosis back onto the retrieval pipeline,
   where attempt 5 finally landed.

The Constitution §2's "no error loops" rule should have fired after
attempt 3 didn't move the symptom. It didn't, and we paid two more
hours for that.

## Root cause

The cohort builder *limited* per-category representation
(`TOP_PER_CATEGORY=2`) but did not *guarantee* it. When the pool had
more distinct categories than the cap allowed unique rows for, the
cap fired in pool-iteration order — which means the lowest-ranked
first-appearance categories got cut. For El Nido this systematically
truncated Cafe (rank 4.46), even though that's a perfectly
respectable rank — the pool just had 17+ other categories that
appeared first in the rank-DESC walk.

Compounding it but secondary: the system-prompt section heading
`RESTAURANTS (top X, includes Cafe / Bar / cuisines)` was being read
literally by the model, and conversation history containing prior
"no cafes" replies was anchoring the model into repeating the lie
even when the inventory eventually did contain a cafe. Both were
addressed in the same patch.

## Fix

Single commit `2ad1c29` ([src/lib/susen/inventory.ts](../../src/lib/susen/inventory.ts)):

1. **Algorithm**: replaced the perCategory-with-cap-2 step with a
   `Map`-keyed `guaranteed` set — first-write-wins, walked in
   rank-DESC pool order. Every distinct category in the pool gets
   exactly one slot, then fill with top-rank overall.

2. **Prompt**: renamed section headings (PLACES TO STAY / PLACES TO
   EAT / THINGS TO DO), added an explicit "HOW TO READ THIS
   INVENTORY" block telling the model to filter by the `category`
   field on each item rather than the section heading, and added an
   anti-anchoring rule: *"If you said earlier that a kind of place
   does NOT exist, but it appears in this CURRENT INVENTORY now, the
   inventory is the source of truth — correct yourself naturally."*

Falsification this time reproduced the actual El Nido pool shape
from the 06:25 production log (7 "other" up top, 14 named cuisines,
Cafe at rank 4.46 with 4 more in the tail). Result: Cafe in the
cohort, every other niche cuisine too.

## Permanent guardrails kept

- **`console.error("[susen] respond", {...})` in
  [src/app/api/susen/respond/route.ts](../../src/app/api/susen/respond/route.ts)**.
  Logs cookie region, detected region, effective region, inventory
  counts per table, and a per-category cuisine breakdown. Was the
  single most useful piece of code for this incident — kept it
  permanent. Cost: one log line per Susen call. Value: future "Susen
  is hallucinating about X" reports can be diagnosed in one log read.
- **`detectRegionFromInput()`** stayed in production. Even though it
  wasn't the bug, it's a real UX win — travelers ask about places
  they haven't selected yet.

## Lessons & rule changes

- **The Q10 trap is real.** §2 "succeeding patch-loop" / §4 Q10 fires
  exactly here: a series of small, locally-correct patches to the
  same component is a louder signal than any failure. "TOP_PER_CATEGORY=2,
  reorder merge, raise cap to 40" are not three independent fixes —
  they're one diagnosis applied three times. After the second variation
  to the same function, the next move must be "what single cause
  produces all of these?" not "tighten the same dial again."
- **Falsify against real production-log shape, not synthetic data.**
  My attempt-3 falsification used a hand-picked synthetic pool that
  obscured the cap-truncation pattern. The attempt-5 falsification
  reproduced the actual El Nido cuisine mix from the log and would
  have caught attempt-3's bug in advance. Rule for future RAG-style
  fixes: take the real distribution from the most recent failure log
  and run the algorithm against THAT, not a representative-looking
  fake.
- **"LIMIT per X" ≠ "GUARANTEE per X".** When the requirement is "every
  X must have representation," a limit alone is insufficient if the
  total budget can be exhausted by other X's first. Keep this in mind
  for any future cohort / sampling / quota work.

Memory updated: [feedback-probe-before-patching](../../../C:/Users/johns/.claude/projects/c--Users-johns-OneDrive-Documents-GitHub-WAVIVI/memory/feedback-probe-before-patching.md)
already covered "probe before second patch"; the new lesson here is
narrower — "watch for *succeeding* patches to the same component."

## References

- Commits: `97b4754`, `c395394`, `de3b3b6`, `0272f8a`, `2ad1c29`
- Files touched (in fix):
  - [src/lib/susen/inventory.ts](../../src/lib/susen/inventory.ts)
  - [src/app/api/susen/respond/route.ts](../../src/app/api/susen/respond/route.ts)
- External: DeepSeek Chat Completions API (no upstream config change
  was required — this was purely a retrieval-shape bug on our side).
- Related: [[2026-05-30-google-oauth-loop]] — same shape (three
  small patches against one wrong identification before a 5-minute
  probe revealed the truth).
