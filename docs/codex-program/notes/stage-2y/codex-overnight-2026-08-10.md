# Codex — overnight run, 2026-08-10

**Supersedes every earlier Stage 2Y brief.** Written after a day that produced
a working plan and no change to the product. The reprioritisation is the point:
**do the work that moves the number first, and fix the measuring instruments
when they are actually needed.**

The earlier briefs front-loaded Phase 0's anchor packet. That was wrong for one
concrete reason: **the four-state count needs no calibration.** Counting
attempted / resolved / open-world / review per family is arithmetic over stored
runs. It needs no anchor, no adjudicators, no human sitting. So the recovery
work can run and be measured tonight, and the anchor work waits until the
publication flip actually needs it — which is days away.

---

## The brief

```
Branch: `claude/codex-handoff-plan-status-77wn7n`, or `main` if it has been
merged — fetch and check. Read `CLAUDE.md`, `docs/core/OPERATING-RULES.md`,
`docs/core/DECISIONS.md` entry 17, and Stage 2Y in `docs/core/PLAN.md`.

THIS RUN HAS ONE JOB: move the number, and prove it moved.

Nothing in this run needs a human. Do not wait for anything. Do not stop at a
phase boundary to ask. Work the list top to bottom, commit and push after every
item, and write evidence as you go so an interrupted run leaves usable work.

1. SPLIT THE GATE  (small, unblocks everything below)
   Two dispositions where there is now one: RESOLVE — a claim enters the review
   queue, live, no calibration — and PUBLISH — unattended, gated. Prove it with
   a test showing a loosened check resolves a claim while REQUIRE_PUBLISHED
   stays false. Nothing in this run publishes.

2. ACTIVATE THE MEASURED-SAFE COHORTS, into the queue only
   2Y-F's 57 concept-covered roots. 2Y-I's 104 safe dispatches. 2Y-G's 59
   duplicate suppressions. 2Y-B's 91 knowledge-standard deferrals plus the dead
   general-covenant ternary at candidate-resolution.js. Expected 220, or 311
   with 2Y-B.
   The 55 genuine coverage gaps 2Y-F identified STAY HELD. They are the safety
   net's true positives; loosening them away is the failure this whole stage
   exists to avoid.

3. BUILD 2Y-A HOST REATTACHMENT — the largest single lever, entirely unbuilt
   The context census finds structural host context for 575 of 756 fragment
   exclusions and performs no binding
   (`candidate_host_binding_performed: false`). Bind them.
   ACCEPTANCE TEST: ITEM-009 resolves. Its quote lacks the terminating party
   while "by Parent" sits in the governing chapeau of the same §8.1. This is a
   LIVE regression — it is why the blind floor's TERMINATING_PARTY stratum fell
   7/8 to 6/8.
   Then re-derive the 762 open-world fragments by ACTUAL chapeau detachment
   rather than the surface heuristic that produced that figure, and report the
   corrected number whichever way it moves.

4. ROOT-CAUSE THE THREE REGRESSIONS, and re-run the batch (46 model calls)
   CATEGORY_UNCORROBORATED 4/8 -> 1/8 — three SETTLE and one CHARTER fell to
   open-world. Three Proxy claims absent from producer output entirely: Concho
   §6.6 board recommendation, Concho §6.6 record date, Red Hat §5.01(c)
   supplemental-disclosure adjournment. 35 claims into open-world across
   Financing and Proxy.

5. MEASURE, and make it openable
   A single committed HTML artefact under `evidence/` showing, per family,
   FOUR states before and after: attempted, resolved, open-world, review.
   Never a single rate. Never resolved-count alone — that is exactly what hid
   two regressions last time.
   Plus the corpus totals, and the blind sample re-scored PER STRATUM against
   the twelve strata of eight in `evidence/blind-review/2026-08-08/README.md`.

NOT THIS RUN
  The anchor packet regeneration. It produces no product change and blocks
  nothing until the publication flip. It comes next, not tonight.
  2Y-H topic classification — Claude is writing the topic list.
  Anything that serves or publishes.

STOP CONDITIONS — stop, push what is green, and report
  - A gate fails and cannot be made to pass honestly.
  - Open-world RISES in any family. That is content the system saw and could
    not place, and it scales worst of all.
  - A previously-resolved claim regresses.
  - A cohort comes in far under its estimate. 2Y-I was planned at 463 and
    measures 104; a second instance means the register's recoverability column
    is not evidence.

GATES BEFORE EVERY PUSH
  `CI=true npm test`, `npm run build`, `bash scripts/lint/forbidden-patterns.sh`.
  Capture exit codes to files and read them back — never pipe test output into
  head or tail, a pipeline returns the last command's exit code and will report
  success on a failing suite.
  Note: `npm run build` fails spuriously if a test run is executing
  concurrently. Run them sequentially, and `rm -rf .next` before re-checking a
  build failure.

TRAPS
  - Byte offsets are UTF-8; indexOf and slice are UTF-16. Convert at the
    boundary with `lib/canonical-v2/canonical-bytes.js`.
  - Read the code, not the comment. A header claiming a module only does X is a
    claim to test.
  - A run receipt is not the model's output — read `raw_response_text`.
  - `review_queue` is the attempted set, not a reject pile.
  - A family returning zero can be correct.
  - Search before concluding something does not exist:
    `grep -rn "name" lib/ scripts/ pages/ tests/`. Check `lib/` before
    `scripts/`.

REPORT
  What moved, in four states per family. What did not, and why. Anything you
  chose not to do, said explicitly — silent scope-narrowing is the failure mode
  this programme watches for hardest.
```

---

## What Ben should see in the morning

One openable artefact showing the four-state table per family, before and
after, with the corpus totals and the per-stratum blind re-score. If items 1–3
land, the recovered population should be in the high hundreds against the
4,241 unresolved occurrences — an order of magnitude more than the 36 the last
run produced.

If it is not, the stop conditions above will say which of them fired, and that
is itself the finding.
