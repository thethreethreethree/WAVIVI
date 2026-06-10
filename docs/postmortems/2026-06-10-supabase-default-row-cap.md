# Postmortem: /admin/data-quality showed 0 suspects across all sections — Supabase db-max-rows silently capped the audit loaders at 1,000 rows

**Date:** 2026-06-10
**Commit range:** `f829dae` (first cross-table audit ship) → `<pagination-fix>` (forthcoming)
**Time to fix:** 4 attempts / 4 commits / **~1 hour of the user's day** (extrapolated from the conversation gap between the first "still exist" and the probe-driven fix)
**Authors / agents involved:** Claude

## Symptom

User: *"the admin quality page does not reflect these incorrect data"* — sent alongside screenshots of `/admin/data-quality` showing every section ("Stays (0)", "Restaurants (0)", "Experiences (0)", "Utilities (0)", and "Utilities in the wrong table — Suspects total 0") despite the user having just demonstrated three rows that should obviously be flagged:

- "Big Bad Thai Restaurant" tagged as `bank` on `/tools/map`
- "Barco El Nido Hotel" tagged as `pharmacy`
- "Rodriguez Lodge" tagged as `bank`
- "Focus rooms" tagged as `pharmacy`

The "tell" was that all four sections showed 0, not just the new cross-table one. Within-table classification audit shipped months earlier had also been quietly returning low / wrong counts; nobody had noticed because the user had been focused on Photo Quality instead.

## Wrong hypotheses (and why each was wrong)

- **Attempt 1 — `d777b98`** — Hypothesis: the cross-table detector's `lodge / inn / suites` rule was MEDIUM confidence and sorted them below the HIGH pile, making the bulk action feel like nothing happened. Fix: promoted to HIGH + added a hostel-adjacent rule. Why it didn't work: the rows weren't sorted-down, they weren't appearing AT ALL. Detector coverage was a guess; I had zero evidence the rows were reaching the detector.

- **Attempt 2 — `faa3003`** — Hypothesis: detector was missing `rooms`; UX would also benefit from a one-click "Remove all HIGH" button. Fix: added `\b(rooms|...)\b` rule + a separate purge panel. Why it didn't work: same underlying gap. The detector additions and the new button are both genuinely useful (will pay off once the data flows), but they don't address the symptom.

- **Attempt 3 — `6828e85`** — Hypothesis: PostgREST's default 1,000-row response cap was silently truncating the audit loader. Fix: added `.range(0, 49999)` to bump the cap to 50k. Why it didn't work: **Supabase's `db-max-rows` is enforced SERVER-SIDE per request.** The client `.range()` sets a Range header asking for more, but the server caps the response at its `db-max-rows` (default 1,000) regardless. So my client-side bump was a no-op against the server-side enforcement — but the symptom (0 suspects) was identical, so I confused "the fix didn't move it" for "I haven't pushed hard enough on the same lever."

## How we eventually found the real cause

Per §2 of the problem-solving constitution ("three patches against the same symptom means stop and re-diagnose"), I stopped patching and built [`/admin/data-quality/debug`](src/app/(web)/admin/data-quality/debug/page.tsx) — a probe page that surfaces four things the production loaders deliberately hide:

1. Raw row counts on `traveler_utilities` (total, admin_edited=true, admin_edited=false)
2. The same SELECT the audit runs, with the **error surfaced** instead of dropped on the floor
3. Direct ILIKE lookup for the four user-reported names — does the row exist? what's its admin_edited? does the detector flag it?
4. A sample of returned rows with detector output next to each name, plus a full-population hit count across all returned rows

The probe's output (user-shared, `8409996` deploy):

- Total: 27,331 rows. admin_edited=false: 25,632.
- **Production audit SELECT returned `1,000` rows.** No error.
- Of those 1,000: 0 trip cross-table detector, 201 trip within-utility.
- Direct ILIKE lookups all succeeded: 3 of 4 named rows existed with admin_edited=false, and the detector flagged them perfectly when handed the data directly.

The probe's section 4 showed the smoking gun: the first 1,000 rows alphabetically are numeric / `(LGF)` / `0520` / `12pcs` etc. — no `Hotel` / `Restaurant` / `Lodge` names in that range. They were past the cut-point.

So: detector worked. Audit page worked. The data just wasn't reaching either of them, because the server was responding with the first 1,000 rows and nothing more, ignoring my `.range(0, 49999)` request entirely.

## Root cause

**Supabase enforces `db-max-rows` per-request server-side.** When a PostgREST query asks for a row range larger than `db-max-rows`, the server caps the response at `db-max-rows` and returns it without an error — the Content-Range header reflects the actual returned range, but if the client doesn't inspect Content-Range, the truncation is silent.

The `.range(start, end)` client method only sets the `Range: <start>-<end>` header on the request. It does not change the server's `db-max-rows` setting. So a one-shot `.range(0, 49999)` returns at most `db-max-rows` rows (typically 1,000). The client THINKS it asked for 50k. The server gave it 1k. Both call it a success.

The user's `traveler_utilities` has 27,331 rows, so a single .select() truncates to the first 1,000 alphabetically — entirely below the cross-table detector's vocabulary ("Hotel" sorts way after numeric-prefix venue names like "168 Bautista Store").

## Fix

Replace the single-shot `.select(...).range(0, 49999)` with a **client-side pagination loop** that walks the table in 1,000-row windows until a short page comes back (or a safety brake at 100k):

```ts
const PAGE_SIZE = 1000;
const all = [];
for (let offset = 0; ; offset += PAGE_SIZE) {
  const res = await supabase.from(...).select(...).range(offset, offset + PAGE_SIZE - 1);
  if (res.error) throw res.error;
  const page = res.data ?? [];
  all.push(...page);
  if (page.length < PAGE_SIZE) break;
  if (offset > 100_000) break;  // safety brake
}
```

Applied to both audit loaders:
- [src/lib/data-quality/cross-table-audit.ts](src/lib/data-quality/cross-table-audit.ts) — single table
- [src/lib/data-quality/classification-audit.ts](src/lib/data-quality/classification-audit.ts) — four tables in Promise.all, each paginated independently via a small `paginate<T>()` helper

A 25k-row table costs ~25 sequential round trips (~3-5 seconds on a healthy region). Audit doesn't run on a hot path; admin opens the page on demand; cost is fine.

**Alternative considered:** raise the `db-max-rows` server setting in Supabase Dashboard → Settings → API. Rejected because it (a) requires a manual config step on every Supabase project the codebase touches, (b) doesn't solve the underlying "single-shot .select silently truncates" trap for any other loader that might fall into it later. The code-side paginator is portable, self-documenting, and doesn't depend on infrastructure config drift.

## Permanent guardrails kept

- **`/admin/data-quality/debug` page stays.** Cheap probe surface; the four diagnostics it shows would help diagnose any future "audit shows 0 but the data is obviously there" report in one screenshot instead of three failed patches. Lives under the admin gate so non-admins can't access it.
- **Comment in both loaders** explaining the trap explicitly so the next agent reading the code sees "PostgREST's db-max-rows silently caps single-shot queries — paginate" without having to relive the postmortem.

## Lessons & rule changes

- **`.range(start, end)` on Supabase is not a "give me up to N rows" instruction.** It's a Range header. The server enforces `db-max-rows` regardless. Any loader that needs to walk a table larger than the project's `db-max-rows` MUST paginate. Inline comment added.
- **§2 "succeeding-patch loop" rule fires here exactly as written.** Three patches against the same 0-suspect symptom — each one a sincere attempt that *would* have helped if the underlying data flow worked, but didn't move the symptom because the data wasn't reaching them. The rule's spirit: when small, locally-correct fixes keep arriving on the same component without moving the symptom, the next move is "what single cause produces all of these?" not "tighten the same dial again."
- **Probe shape that worked:** the debug page surfaced (a) row counts, (b) the actual query error or silence, (c) direct lookup of known-bad inputs, (d) detector output on a real sample. (a) discriminates between "data doesn't exist" and "filter is hiding it"; (b) discriminates between "query failed silently" and "query succeeded but capped"; (c) discriminates between "detector is broken" and "detector never saw the row"; (d) is the proof. Any future "audit returns 0 from a non-empty table" report should reach for the same shape.

## References

- Commits chasing the wrong hypothesis: `d777b98`, `faa3003`, `6828e85`
- Probe page: `8409996`
- Fix commit: `<pending>`
- Files touched (in fix):
  - [src/lib/data-quality/cross-table-audit.ts](src/lib/data-quality/cross-table-audit.ts)
  - [src/lib/data-quality/classification-audit.ts](src/lib/data-quality/classification-audit.ts)
- External docs: [Supabase PostgREST max-rows config](https://supabase.com/docs/guides/api/configuration#api-settings)
- Related postmortems:
  - [[2026-06-03-susen-cafe-cohort]] — same constitution rule (§2 succeeding patch loop) fired against a different symptom; same lesson reinforced.
  - [[2026-06-05-feed-video-blob-phantom]] — different symptom, same probe-vs-patch dynamic. Phantom UI artifacts vs. silent server-side truncation both share the "data isn't where you think it is" failure shape.
