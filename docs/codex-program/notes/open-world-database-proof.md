# Open-world evidence: proving it reaches the database, not just the write-set validator — 2026-08-07

Working notes, written incrementally. Scope per the task brief: regenerate
the 28 committed `-20260807-replay`/`-20260807-live` run directories by
replay (zero model cost) so `adapter-result.json` carries native open-world
rows, confirm `npm run gate:baseline` still passes, then durably write at
least two families' open-world rows through `canonical_v2_write` on `pm-pg`
and read them back through `readDealFromLocalCanonicalV2Staging`, proving
the `UNGOVERNED_OPEN_WORLD_EVIDENCE` marker survives.

## 0. Confirming the gap before touching anything

`lib/canonical-v2/evidence-to-write-set-bridge.js`'s `readRunEvidence` reads
`adapter-result.json` from disk and uses `adapter.write_set` as-is — it does
not call `buildNativeWriteSet` fresh. Direct check on
`evidence/canonical-v2/modiv-antitrust-20260807-replay/adapter-result.json`:
`write_set.open_world_candidates` has the key (the shape is stable) but
`length === 0`.

Git confirms the timing: that file was last written by commit `0993715a`
(2026-08-07T07:10:12Z, part of `5bd831d4` "three live runs, a regenerated
baseline, and the payment-timing split" — a prior same-day baseline
regeneration). The open-world emission fix landed in `native-write-set-adapter.js`
in commit `899e9bc5` (2026-08-07T17:01:19Z), **after** that regeneration. So
even the most recently regenerated committed runs predate the fix. Current
`HEAD` (`12d383c9`) has `899e9bc5` as an ancestor, and the working tree is
clean — the fix is live in the code, just not reflected in any committed
`adapter-result.json`.

Summing `resolution.json`'s `open_world.length` across all 28 importable
`-20260807-replay`/`-live` directories gives exactly **244**, matching
`PLAN.md`'s stated total and `docs/codex-program/notes/open-world-emission.md`'s
figure — confirming these are the right 28 directories and nothing is being
double-counted.

## 1. Replay plan

Docker (`dockerd`, PID present) and `pm-pg` (`postgres:16-alpine`) were
already up — no restart needed.

Built a mapping from each of the 28 `-20260807-replay`/`-live` directories to
its fixture source (the `-20260806`/`-20260805` directory carrying the
`native-producer-recorded-response-*.json` files), reading `deal`,
`section_family` → `--family`, `section_references` → `--section-refs`,
`follow_citations` → `--follow-citations`/`--no-follow-citations`,
`agreement_date` → `--agreement-date` (omitted when the manifest recorded
`null`) straight from each directory's own existing `run-manifest.json`, so
nothing is guessed. `TERMINATION_FEE`'s source is
`modiv-termination-fee-scope-correction-20260805` (confirmed by matching
`open_world` count, 16, against the committed replay's own count — the
`-promptv3-20260805` sibling has 13, wrong deal-run family history). The
three `-20260807-live` directories replay from themselves (they wrote their
own fixtures live originally).

Every `-out-dir` write target is the **same, existing** directory (in place),
per this repo's own prior convention (`live-runs-and-baseline.md` §2):
`baseline-manifest.mjs` sums `published` across every importable directory
under `evidence/canonical-v2/`, so a second dated directory for the same
family would double-count.

---

## Completed by the main agent, 2026-08-07, after the container restart

The agent that began this work parked waiting on a monitor while its replay
batch was still running, and the harness reported it finished. Checked by
artefact rather than by notification: **the batch had in fact completed all 28
runs.** Picked up from there.

### Replay and baseline

All 28 committed runs regenerated, zero model calls. `npm run gate:baseline`
exits 0: *"matches what the evidence directories produce."*

**244 open-world candidate rows now sit in 20 runs' adapter results, up from
zero.** Before this, every committed `adapter-result.json` predated the
emission fix and `evidence-to-write-set-bridge.js` reads that file from disk
rather than regenerating it, so every import path starting from a committed
run carried the old, open-world-free write-set.

Totals moved in exactly the two ways the day's work predicts, which is the
check that this was a real regeneration and not a reshuffle:

| | Before | After |
|---|---|---|
| Claims | 203 | **213** (the ten `KEY_DEFINED_TERMS` claims that had been dying at the write boundary) |
| Excerpts | 181 | **430** (open-world evidence carrying its own excerpts) |

### Open-world evidence reaches a real database

Fresh `postgres:16-alpine`, scaffolding and the 8,686-line schema applied
clean. Two families written durably through `canonical_v2_write`, both
`COMMITTED`:

| Run | Claims | Open-world |
|---|---|---|
| `modiv-capitalisation-20260807-replay` | 9 | 61 |
| `modiv-interim-operating-20260807-replay` | 10 | 46 |

In the database afterwards: `open_world_candidates` **107**,
`open_world_candidate_occurrences` **107**, `open_world_evidence_references`
**107**, and **all 107 candidates carry
`evidence_governance = 'UNGOVERNED_OPEN_WORLD_EVIDENCE'`**. Read back through
the real `readDealFromLocalCanonicalV2Staging`: **107 open-world bundles, 321
marker occurrences across their payloads, and zero governed claims carrying
the marker.**

**This is the first time open-world evidence has existed in a database.** Ben's
decision 2 is proven end to end rather than to a validator in memory.

### What the same run exposed — see `PLAN.md` Step 2B3

19 claims written, **9 read back**, silently. The `ORPHAN_CLAIM_REVISION`
guard cannot fire, because the query above it pre-filters claims to those
whose `subject_occurrence_id` is already in the provision list, so the rows
that would trigger it are never fetched.

Not fixed here, deliberately: claims and provisions share no `closure_id` at
all (19 distinct on claims, 10 on provisions, zero overlap), so it is not
established that every claim is meant to have a governing provision in the
same deal scope. The alternative reading points at the writer rather than the
reader, and changing the query first would be inventing a data model to make a
number agree.
