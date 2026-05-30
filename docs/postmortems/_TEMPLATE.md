# Postmortem: <one-line incident title>

**Date:** YYYY-MM-DD
**Commit range:** `<first-chase-commit>` → `<fix-commit>`
**Time to fix:** N attempts / X commits / **~Y hours of the user's day**

(Recording the user-time cost — not agent time — is mandatory. It's
the metric that justifies the whole probe-before-patch discipline.
If you don't know the exact hours, estimate from the timestamps of
the first chase commit and the fix commit.)
**Authors / agents involved:** <names>

## Symptom

What the user actually reported, verbatim if possible. Include the
visible-but-misleading parts (the "tell" that pointed at the wrong
subsystem) and any error messages, lack of error messages, or silent
states.

## Wrong hypotheses (and why each was wrong)

One bullet per attempt. Be specific about the mental model that
generated each fix and why the patch didn't move the symptom. The
point isn't shame — it's so the next agent recognises the same
pattern when they're about to repeat it.

- **Attempt 1 — `<commit hash>`** — Hypothesis: <one-line statement
  of what we thought was broken>. Fix: <what the patch did>. Why it
  didn't work: <the evidence we should have weighed but didn't>.
- **Attempt 2 — `<commit hash>`** — …
- **Attempt 3 — `<commit hash>`** — …

## How we eventually found the real cause

What probe revealed the truth? A debug page? A devtools screenshot?
A user question we should have asked sooner? Note what the probe
showed and how it discriminated between the hypotheses.

## Root cause

The actual mechanism, named as precisely as we can. If it crosses
subsystems (e.g. dashboard config → silent server fallback → client
UI loop), trace each hop.

## Fix

The change that solved it. Include code-level references
(commit hash, file path with line, dashboard setting name). If part
of the fix is *outside* the codebase (Supabase dashboard, Google
Cloud, env vars), say so explicitly and list the exact steps.

## Permanent guardrails kept

What stays in the codebase after cleanup? Usually small middleware
recoveries, more defensive null-checks, or logging that costs nothing.
Note why each one is permanent (not just probe scaffolding) and link
the commit.

## Lessons & rule changes

- Rule(s) added or updated in CLAUDE.md or memory files.
- Patterns the next agent should recognise to skip the same trap.
- Anti-patterns to avoid (especially the "famous community bug"
  pattern match that misled this incident).

## References

- Commits: list
- Files touched (in fix): list
- External docs / dashboards: list
- Related postmortems: list (use `[[slug]]`-style links)
