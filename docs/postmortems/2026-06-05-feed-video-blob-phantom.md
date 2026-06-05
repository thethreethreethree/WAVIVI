# Postmortem: feed videos "won't play" — root cause is upstream, not Wondavu

**Date:** 2026-06-05
**Commit range:** `bc2c7a2` → `4504d02`
**Time to fix:** 4 attempts / 4 commits / **~2 hours of the user's day**
**Authors / agents involved:** Claude Opus 4.7, John

## Symptom

User on `/feed` saw what looked like a video play-button overlay on
several El Nido feed cards (recently imported via CSV). Tapping the
play triangle did nothing — "stays on the poster, nothing happens at
all." No console error, no network request fired.

The misleading "tell" was that the triangle LOOKED interactive: dark
backdrop, white triangle, sized like a real button. It even matched
the visual language of the in-app play button I'd just shipped, which
made the next attempt feel like a player bug.

## Wrong hypotheses (and why each was wrong)

- **Attempt 1 — `bc2c7a2`** — Hypothesis: the IG video thumbnail's
  baked-in play triangle is dead pixels; clicking the photo should at
  least open the original IG post. Fix: wrap the photo in an `<a>` to
  `ig_post_url`. Why it didn't move the symptom long-term: the user
  came back with "we want videos to play IN-APP, not redirect" — so
  this fix solved the wrong problem.
- **Attempt 2 — `779febb`** — Hypothesis: the redirect was a band-aid;
  the real fix is to render a real `<video>` element when `video_url`
  is set. Fix: built `FeedMedia` component, mirrored video bytes to
  Supabase Storage on import (`mirrorFeedVideo`), added `video_url` to
  the CSV parser + admin form. Built correctly. Why the symptom
  persisted: this fix is *load-bearing* only when `video_url` is
  populated, and the user's CSV had `blob:` URLs everywhere — which
  this code couldn't rescue.
- **Attempt 3 — `0e0a10f`** — Hypothesis: the CSV import was
  rejecting whole rows on the `blob:` URLs; users were losing photo +
  caption + handle along with the unfetchable video. Fix: silently
  coerce `blob:` and `data:` to null so the row imports as
  still-only. Locally correct. Why the symptom *appeared to* persist:
  this fix turned 5 hard-failures into 5 silent-failures. The rows
  now imported, but with `video_url = NULL`. The "play button" the
  user kept tapping was the IG thumbnail's baked-in triangle, not
  anything my code was rendering. The user couldn't distinguish "no
  video URL" from "broken video URL" because both produce the same
  visual.
- **Attempt 4 — `4504d02`** — NOT a wrong hypothesis. This was the
  probe (`?debug=1` JSON dump of `videoUrl` / `igPostUrl` for every
  post) that revealed the truth in one read. Per the Constitution
  this should have been attempt 2, not attempt 4.

## How we eventually found the real cause

The `?debug=1` probe rendered each post's `videoUrl` as JSON above the
feed list. The dump showed `"videoUrl": null` on all 8 posts. Once
the data was visible, three downstream conclusions resolved instantly:

- The play triangle the user kept tapping had to be part of the
  bitmap, not my component.
- My `FeedMedia` component only renders the `<button>` when
  `videoUrl` is non-null — it had been returning the plain `<Image>`
  the entire time.
- No further code change in `feed/mirror.ts`, `feed-list.tsx`, or the
  CSV parser could populate the column. The only upstream source of
  real video URLs is the scraper itself.

The probe was the discriminating instrument the three prior patches
all lacked. It took 40 lines of code and ~10 minutes to ship.

## Root cause

The user's external scraper (a browser extension running inside
`instagram.com`) captures video data via `URL.createObjectURL(blob)`
and writes the resulting `blob:` handle into the CSV's `video_url`
column. Those handles are valid only inside the tab that created them
and are gone the moment the tab closes. They are not URLs in any
useful sense.

Wondavu's import pipeline saw the `blob:` strings, correctly
identified them as unmirror­able, and (post-`0e0a10f`) stored `NULL`
in `video_url`. The feed UI faithfully renders no play button for
posts with `videoUrl: null`. The phantom play triangle visible to the
user is part of the mirrored image, because the IG CDN bakes a play
icon into the thumbnail for video posts before the bytes ever reach
us.

**Three subsystems cooperate to produce the symptom:**

1. **Scraper** captures only the blob, discards the real CDN URL it
   had to fetch from.
2. **Wondavu CSV parser** silently coerces unfetchable URLs to null
   (the right move given the alternative is dropping the photo too).
3. **IG thumbnail bitmap** ships with a play triangle painted on,
   which looks identical to a real play button to the operator.

Removing any one of those three would have made the bug visible
sooner. All three combined produce a perfectly silent failure.

## Fix

There is no Wondavu-side fix that produces playable videos for these
rows. The three forward paths are:

1. **Scraper change** — capture the real
   `https://scontent.cdninstagram.com/.../*.mp4` URL before turning
   bytes into a blob, write THAT into the CSV. Brief was handed to
   the user as `WONDAVU_FEED_CSV_CONTRACT.md` to give to the
   scraper's author / next Claude Code session.
2. **Hand-paste** — operator opens each post in
   `/admin/feed/<region>`, captures the real video URL via DevTools →
   Network → filter `mp4`, pastes into the Video URL field, saves.
   ~3 min/post.
3. **Ship still-only for launch** — accept the IG-baked play triangle
   as decorative noise. Videos land in a later phase.

The Wondavu side gets a single permanent improvement listed below.

## Permanent guardrails kept

- **`blob:` / `data:` URL coercion in `csv.ts` (commit `0e0a10f`)** —
  stays. Without it, the scraper's malformed output would block the
  photo + caption + handle from importing too, which is strictly
  worse than landing the row as still-only.
- **The `FeedMedia` component (commit `779febb`)** — stays. It's the
  right player for the day the scraper produces real video URLs.
  Today it just returns the still-image branch.
- **`mirrorFeedVideo` (commit `779febb`)** — stays. Same reason.

What gets removed: the `?debug=1` probe on `/feed`. Per Constitution
§Cleanup, probes are scaffolding. The probe served its purpose
and goes away in this commit. Add it back temporarily if the
scraper-output debate recurs.

## Lessons & rule changes

- **Three Wondavu patches couldn't have moved a symptom whose cause
  lives in the scraper.** The §1 "succeeding patch-loop" rule fires
  *exactly* when small locally-correct fixes keep arriving on the
  same component. The signal is "I'm fixing this same thing again,"
  even when each fix WORKS. The next move is "what single cause
  produces all of these?" — which, in this incident, was outside the
  codebase entirely.
- **The phantom-button anti-pattern.** When a visible-but-misleading
  UI artifact exists (here: a play triangle baked into a bitmap), the
  user's natural language ("the play button doesn't work") attaches
  itself to that artifact. The agent then reasons forward from
  "broken button" instead of upward to "is this even a button?" The
  cheapest disambiguator is the §Debugging probe pattern: dump the
  state the user thinks they're looking at, in JSON, and check
  whether the assumed object even exists.
- **The probe should have shipped at attempt 2, not attempt 4.** The
  earlier user signal — "play button not working" combined with the
  prior commit that introduced the player — was already enough to
  hit the probe-before-second-patch rule. I didn't run it. The next
  agent who reads this should treat "user says the new feature
  doesn't work, on the surface where I just shipped a fix" as the
  exact probe-mandatory trigger.

## References

- Commits: `bc2c7a2`, `779febb`, `0e0a10f`, `4504d02`, this commit
- Files touched (across the loop): `src/components/ui/feed-list.tsx`,
  `src/components/admin/feed/csv.ts`, `src/lib/feed/mirror.ts`,
  `src/lib/feed/server.ts`, `src/app/(app)/feed/page.tsx`
- External brief: `WONDAVU_FEED_CSV_CONTRACT.md` (handed to user for
  the scraper-side fix)
- Related postmortems:
  [[2026-06-03-susen-cafe-cohort]],
  [[2026-05-30-google-oauth-loop]]
