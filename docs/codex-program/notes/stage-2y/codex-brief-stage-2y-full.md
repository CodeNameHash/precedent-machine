# Codex brief — Stage 2Y, full scope

**Hand this to a fresh Codex session verbatim.** Codex gets no conversation
history, so this is written to be self-contained. It contains no secrets and
must not be edited to include any.

Written 2026-08-10, against branch `claude/codex-handoff-plan-status-77wn7n`
at `d6af3439`.

---

## The brief

```
You are picking up the Precedent Machine programme. You have no history of the
prior conversation, so everything you need is in the repo. Read before acting.

REPO / BRANCH
  Work on branch `claude/codex-handoff-plan-status-77wn7n`. Fetch it fresh —
  it moves. Confirm your checkout HEAD before reading PLAN.md; a stale local
  copy will give you an older plan and you will build to the wrong spec.

READ THESE FIRST, IN THIS ORDER
  1. `CLAUDE.md` at the repo root — authority boundary, the failure modes this
     project repeats, the verification traps, model routing. The traps are not
     generic advice; each one cost real time here.
  2. `docs/core/OPERATING-RULES.md` — what you may and may not do.
  3. `docs/core/PLAN.md` — go to Stage 2Y, between Step 2X-K and Stage 3. Read
     the preamble, then "Stage 2Y — the execution order. DECIDED 2026-08-09".
     That section is the spine: phases with hard gates and kill criteria. The
     lettered steps 2Y-0 through 2Y-N are the work; the phase section is the
     order.
  4. `docs/core/DECISIONS.md` — entries 14, 16, and especially 17, which holds
     Ben's seven Stage 2Y rulings and three addenda. Do not re-litigate
     anything settled there.
  5. `docs/codex-program/notes/HANDOFF-2026-08-09.md` — where every artefact
     lives, and what is inert versus activated.
  6. `docs/core/COMPLETED.md`, `CODEBASE-GUIDE.md`, `GRAVEYARD.md` as needed.

THE STANDARD
  Ben, 2026-08-09: "At thousands of agreements this doesn't work. The system
  needs to be fucking good. Humans will back fill edits but the system needs to
  do really well." Unattended correctness is the measure, not recovery volume.
  A step that recovers claims but publishes some wrongly is worse than the hold
  it replaced.

ALREADY DECIDED — implement, do not reopen
  - Regenerate the anchor packet before any further human sitting.
  - Resolving into the review queue is NOT publishing. Loosenings land live
    into the queue; only publication waits on calibration.
  - Root-cause the three regressions before activating anything.
  - Open-world promotion at three deals. Recall floors conditional on deal
    features. The 1% false-publication figure is a TRACKED metric reported with
    sample size and confidence bound — not a publication gate, and no family is
    hidden for want of volume.
  - The unit of judgement is the RENDERED ROW, not the internal code (2Y-N).

FULL SCOPE. Take Stage 2Y to completion, stopping only where a human is
genuinely required. Do not stop at a phase boundary to ask.

CHECKPOINT DISCIPLINE — non-negotiable, this run is large.
  Commit and push after EVERY track below, before starting the next. Partial
  work must survive an interrupted run. Write evidence artefacts incrementally,
  never at the end. If a gate fails, stop AT THAT TRACK, push what is green,
  and report — do not carry a failure forward.

PHASE 0 — instruments. Three tracks, no dependencies between them.
  0.1 Regenerate the anchor packet: byte-bound context window per card
      (governing sentence + chapeau); the class's question stated ON the card;
      SPAN redesigned as a structured choice (too narrow / too wide / wrong
      location / correct) or dropped; seeds raised to >=12 per hard class; and
      a `rendered_row` per card from 2Y-N. DO NOT TOUCH MATERIALITY_CODE — it
      scored 4/4 detection and 0/16 false alarms and is the only clean baseline
      the programme has. `lib/canonical-v2/human-anchor-review.js` validates
      with `exactKeys`, so new fields FAIL validation: bump the schema version
      and update the validator in the same change. Do NOT build a review UI;
      Claude rebuilds the sitting console from your packet JSON.
  0.2 Root-cause three regressions: CATEGORY_UNCORROBORATED 4/8 -> 1/8 (three
      SETTLE and one CHARTER to open-world); three Proxy claims absent from
      producer output entirely; 35 claims into open-world across Financing and
      Proxy. Re-run the batch afterwards — 46 model calls, so it is cheap.
  0.3 Split the gate in code: RESOLVE (into the review queue, live, no
      calibration) vs PUBLISH (unattended, gated). Prove it with a test showing
      a loosened check resolves a claim while REQUIRE_PUBLISHED stays false.
  2Y-N Headless row preview reusing the REAL render path
      (`config.selectRows` + `decorateConfigForV2`,
      `components/review-v2/sectionList.js:482`), not a second one. A preview
      that diverges from the page is worse than no preview.

PHASE 1 — activate what is built, into the QUEUE ONLY. Depends on 0.2 + 0.3.
  2Y-F's 57 concept-covered roots, 2Y-I's 104 safe dispatches, 2Y-G's 59
  duplicate suppressions, 2Y-B's 91 knowledge-standard deferrals plus the dead
  general-covenant ternary. Measured-safe total 220, or 311 with 2Y-B.
  The 55 genuine coverage gaps 2Y-F found STAY HELD as findings — they are the
  safety net's true positives and must not be loosened away.
  Gate: no family's open-world count rises; no previously-resolved claim
  regresses; four-state table per family before and after.

PHASE 3A — 2Y-A host reattachment. Does NOT wait for Phase 2. Runs as soon as
  Phase 0 and the gate split are in place.
  The census finds structural host context for 575 of 756 fragment exclusions
  but performs no binding (`candidate_host_binding_performed: false`).
  ACCEPTANCE TEST: ITEM-009 resolves — its quote lacks the terminating party
  while "by Parent" sits in the governing chapeau of the same §8.1. This is a
  LIVE regression: it is why the blind floor's TERMINATING_PARTY stratum fell
  from 7/8 to 6/8.
  Also re-derive the 762 open-world fragments by ACTUAL chapeau detachment
  rather than the surface heuristic that produced the figure, and report the
  corrected number whichever way it moves.

PHASE 2 — Closing Conditions end to end. Build EVERYTHING except the flip.
  The immutable release-receipt adapter; the shadow-measurement harness that
  generates rows via 2Y-N without serving them; per-claim disposition
  reproducibility from stored evidence.
  STOP AT THE FLIP. Serving requires calibration authority, which requires
  Ben's re-sit on the regenerated packet. That is the ONE human dependency in
  this run. Land everything else live-ready and report exactly what the flip
  needs.
  The 1% is TRACKED and reported with sample size and confidence bound
  ("<=3.2% at 95%, n=94"), never a bare "no errors found".

PHASE 4 — rollout, everything not blocked on a human.
  2Y-J promotions at three deals: the 21 recurring concepts and the 15 held
  cards, each adjudicated against its quotes and reversible.
  Recall floors CONDITIONAL on deal features, never flat — a family returning
  zero can be correct (guaranty on an unfinanced deal).
  The 18 missing KDT records (SkyWater 13, TopBuild 5) via one contained live
  KEY_DEFINED_TERMS recording; integration then replays at zero model cost.
  2Y-C migration acceptance: eleven runs still show semantic-digest differences
  across Interim Operating and Termination Fee. Metadata drift is LIKELY but
  NOT PROVED. Prove it or fix it. Do not waive the gate.
  2Y-M's ladder, and the blind floor re-scored PER STRATUM against the twelve
  strata of eight — never a bare total.

DELIVERABLES — each track produces something openable, not just a report.
  0.1  The machine packet as JSON, schema version bumped, validator updated.
  2Y-N A browsable artefact showing 30-50 real claims across families as
       excerpt -> governing chapeau -> the row it renders (section, row label,
       every cell). Include at least one known-bad case: an absence-copy row
       and a mis-banded `bandAligned` row, both with CORRECT codes. This
       artefact is how the step is checked; the tests are how it is trusted.
  0.2  Before/after per family in FOUR states — attempted, resolved,
       open-world, review. Never resolved-count alone.
  0.3  The passing test, named.
  All artefacts under `evidence/` and committed. Local-only paths are not
  deliverables — an earlier handoff linked files that existed on one laptop.

NOT IN SCOPE, and why
  2Y-H topic classification. Its topic list is taxonomy design: a wrong list
  bakes into hundreds of claims and taxonomy errors corrupt precedent search,
  which is the product. Claude is writing the list in parallel. Build the
  registry substrate and the classifier hook if useful, but do not invent the
  topic codes.
  Stage 3 and beyond. Not until Stage 2Y's gates are green.

TRAPS — each has produced a confident false result in this repo
  - Never pipe `npm test` into `head` or `tail`; a pipeline returns the last
    command's exit code and will report success on a failing suite. Redirect to
    a file, echo $?, then grep the file. Use CI=true.
  - Byte offsets are UTF-8; `indexOf` and `slice` are UTF-16. Convert at the
    boundary with `lib/canonical-v2/canonical-bytes.js`. Do not port
    `lib/parser-v2/subclauses.js` to bytes.
  - Read the code, not the comment. A header claiming a module only does X is a
    claim to test. A 2026-08-09 re-audit found three DONE rows that were false.
  - A run receipt is not the model's output — read `raw_response_text`.
  - `review_queue` is the attempted set, not a reject pile. The rate is
    `resolved / review_queue`.
  - A family returning zero can be correct.
  - Report every family in FOUR states, before and after. Never a single rate.
    Resolved-counts alone hid two regressions on the last run.
  - Search before concluding something does not exist:
    `grep -rn "name" lib/ scripts/ pages/ tests/`. Check `lib/` before
    `scripts/` — per-family work lives in the library.

GATES BEFORE ANY PUSH
  `CI=true npm test`, `npm run build`, `bash scripts/lint/forbidden-patterns.sh`.
  Capture exit codes to files and read them back. Never waive a failing gate;
  if one cannot pass honestly, say so and stop.

STOP CONDITIONS — stop and report rather than pushing through
  - Any gate fails and cannot be made to pass honestly.
  - A measured cohort comes in far under its estimate. 2Y-I was planned at 463
    and measures 104; a second instance means the register's recoverability
    column is not evidence and every ranking built on it must be redone.
  - Open-world rises in any family after a change. That is content the system
    saw and could not place, and it scales worst of all.
  - You reach the publication flip. That one is Ben's.

WHEN DONE
  Report per track: what landed, what the gate says, and — for anything you
  chose not to do — say so explicitly. Silent scope-narrowing is the failure
  mode this programme watches for hardest.

DO NOT
  - Include any credential, token, or secret in any output.
  - Activate anything for serving without the calibration authority.
  - Waive a gate because the difference "looks like" metadata.
```

---

## What this leaves after the run

Extraction essentially done: instruments trustworthy, three regressions closed,
roughly a thousand claims recovered, one family live-ready, the blind floor
re-tested per stratum.

**Not covered:** Stages 3 through 9 in `PLAN.md` — import hardening, serving a
second family, claim-identity convergence, the security gates, market
statistics and search, and the production cutover. Stage 2Y is what stands
between the programme and a system that extracts well; those stages are what
turn it into a product people use.

**The one human dependency:** Ben's re-sit on the regenerated anchor packet,
which gates the publication flip and nothing else.
