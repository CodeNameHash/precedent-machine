# Stage 2 spec — short version

The long version is `stage2-fanout-spec.md`. This is the same plan in two
pages. **Nothing is implemented yet** — `docs/core/` is untouched.

## The problem

You asked for Stage 2 to be restructured as a fan-out ladder: prove one
family, then a few, then all, then repeat across more documents,
re-checking everything earlier at each step. That is the right shape.

Stage 2 can't be rebuilt on the documents as they stand, because they
contain claims that are false:

- **PLAN.md line 145** says the section-family classifier is "not wired in"
  and its output always blocked. Both wrong. It is wired in, and only the
  AI-assisted half is flagged; the deterministic half is free and unflagged.
  This false line is *why* the old Step 2A proposed mapping 25 families by
  hand.
- **PLAN.md line 8** says it supersedes EXECUTION-LEDGER.md. That ledger is
  live and runs a separate ~200-hour programme.
- **`npm test` misses 29 test files.** The glob is non-recursive. CI runs
  the same command. Every "this is proven" in the plan is checked by an
  instrument with a hole in it.

Plus two things that block onboarding the documents the ladder needs: a
freshly ingested agreement renders an **empty review page** until someone
hand-runs a backfill script, and the "add a deal" admin UI is broken for
two of its three modes.

## The work, in six parts

| | Part | What it does |
|---|---|---|
| **B-zero** | Fix the test glob | Make the gate trustworthy before using it. Expect failures — 29 files unrun for a while. |
| **B** | Correct the false claims | PLAN.md lines 142 and 145, then sweep the rest as the other five docs were swept. |
| **A** | Consolidate the documents | Fold ROADMAP.md into PLAN.md, park Process Intelligence, repoint DECISIONS.md's 24 cross-references. |
| **C** | Land the remaining findings | ~110. Each applied, rejected with a reason, or deferred with an owner — each re-checked against HEAD first. |
| **F** | Rule on unused capabilities | A built search backend, comparator, reconciliation system, and six more. Keep, delete, or revive. |
| **E** | Unblock onboarding | Section-ref generation, the empty review page, the broken admin UI, the contained routes. |
| **D** | Run the ladder | The thing you actually asked for. |

**Order matters.** B-zero first because everything else is verified with
it. D last because it's the only part that spends real money on model
calls, and every part before it is a reason a round would have to re-run.

## The ladder (Part D)

**Families, on Modiv:** 1 → 4 → 12 → 25. Each round re-runs the earlier
families, not just the new ones. Gate after *every* round: nothing
incomplete, no family's result count went down. A failed gate stops the
line — fix the cause before the next round adds families, or repeat the
defect a dozen more times.

**Then the same ladder on TopBuild.** Then documents: the base pair, a
third, five to ten more, then the rest — to **10–15 total**, each new
document run alone first, then the whole accumulated set together.

**Section lists** come from the 24 committed run directories that already
record them (20 in one file shape, 4 in another), cross-checked against a
generator script. TopBuild and the new agreements have no such receipts, so
the generator is genuinely needed — it just isn't the only source, as an
earlier draft claimed.

## Your four decisions, as written in

1. **Process Intelligence is parked** — a folder to rebuild from later, not
   archived as dead, not given PLAN.md steps.
2. **Your two auto-pass conditions get wired before the ladder runs.** The
   runner currently supplies neither.
3. **Nothing old is binding unless it does better.** Applied to the
   contained routes, the pinning convention, the admin UI, the backfill step.
4. **10–15 documents in the ladder**, then corpus certification for the rest.

## What could still go wrong

1. **The ladder's gate measures a noisy signal.** Every re-run is a live
   model call — no replay, no temperature pin. Two identical runs can
   differ, and the gate mandates hard stops on that. Either we build a
   replay path or write a tolerance policy; neither is costed. **Likeliest
   cause of the ladder stalling.**
2. **The cheap re-run policy needs a code change first.** Re-running only
   what changed is right, but the receipts record no commit hash and no
   real model ID — so "did the code change?" can't be answered from them,
   and swapping the model would trigger no re-runs at all. One line in the
   runner, plus a decision about what counts as a change.
3. **Fixing the test glob may be a big job.** If most of the 29 fail, the
   smallest-looking part becomes the largest.

## How reliable is this document

Low, and that is the honest answer. The spec made **four** false claims of
its own across two days:

- said the classifier didn't exist as a usable route — it did;
- said a module header was broken — it had already been fixed;
- said `lib/search.js` had one caller — it has three, and I'd labelled that
  one "verified directly";
- said amendment/restatement detection needed building as the **highest
  priority** item — `lib/agreement-revision-classifier.js` already does it,
  wired into the exhibit selector, stopping on ambiguity rather than
  guessing.

Every one was caught by an adversarial audit reading the code rather than
the prose. Every one is the same mechanism the project keeps hitting: a
claim read in a report and repeated instead of checked.

They're corrected and left visible in the long version. Treat both
documents as claims to check, not a record of what's true.

## Status

**Stage 2 is implemented.** `docs/core/PLAN.md` Stage 2 is rewritten, and
PLAN.md, COMPLETED.md and CODEBASE-GUIDE.md are corrected to agree with it.

What changed between this summary and what landed: the ladder became
**vertical**. Four code traces established that a run's output is terminal —
nothing functional reads the evidence directories — and that no serving source
reads from the database at all. So proving extraction across 15 documents would
have proved nothing consumable, and proving the write path once would have
repeated the sample-of-one error one layer down. Every rung now runs
`extract -> validate -> write -> serve -> confirm it renders`, and a new Step 2B
builds the bridge in both directions. Steps 4B and 5A are rescoped from
construction to hardening.

`docs/core/CODEBASE-GUIDE.md` section 12 is the new record of how the system
actually works, with the commands to re-derive it.

**Still outstanding, and none of it is started:**

- **The test glob.** 29 test files still do not run. Every Stage 2 gate is
  checked by that instrument.
- **Parts A, C, E, F** — consolidation, the ~110 findings, onboarding, the
  capability rulings.
- **The two prerequisites Stage 2 names for itself:** the replay-or-tolerance
  decision for a nondeterministic gate, and the runner change that records a
  commit hash and resolved model ID so change-triggered re-runs are possible.

Next: Fable's adversarial pass on the implemented documents.
