# Three live extraction runs, then baseline regeneration — 2026-08-07

Working notes, written incrementally as each step completes.

## 0. Preflight

`claude` CLI present: `/opt/node22/bin/claude`, v2.1.224. Trivial call
(`claude -p "reply with exactly: OK" --output-format json`) returned
`"result":"OK"`, `is_error:false` — the CLI genuinely works via subscription
auth. `scripts/canonical-v2-live-extraction-run.mjs` deletes
`ANTHROPIC_API_KEY` from its child env at line 855 to force that path.

Confirmed the recording mechanism needs no `--record` flag: every live call
in `makeMeasuredCliClient` (script lines ~928-967) writes
`native-producer-recorded-response-<section>.json` into `--out-dir`
unconditionally, which is exactly what every prior committed run directory
contains and what `--replay-from-run <dir>` consumes. That is the mechanism
that makes a run replayable, matching how every other committed run in
`evidence/canonical-v2/` was produced. `--record` is a second, separate
mechanism (a consolidated recording file) and is not needed for this.

## 1. Three live runs

Each targeted only the section with no recorded response. For
`KEY_DEFINED_TERMS` and `CONSIDERATION`, the family's *other* pinned
sections (8.5; 2.1/2.2/2.3) already carry a
`native-producer-recorded-response-*.json` from 2026-08-06 and were not
re-run. `--dry-run` was run for every invocation first and confirmed section
resolution and a projected 1-call cost before any live call was made; all
three dry runs matched expectations (correct heading, correct byte range, 1
projected call) and are not reproduced in full here.

### 1a. `KEY_DEFINED_TERMS` on Modiv §8.12

```
CI=true node scripts/canonical-v2-live-extraction-run.mjs \
  --deal modiv --family KEY_DEFINED_TERMS --section-refs 8.12 \
  --out-dir evidence/canonical-v2/modiv-key-defined-terms-8.12-20260807-live
```

**Result, EXIT=0, model_call_count=1** (278,124ms):

- `compiled_candidates`: 19 ok / 0 rejected
- `resolution`: **resolved=10, auto_pass=0, review_queue=17, open_world=2,
  residuals=0**
- `write_set`: claims=0, components=0, adapter residuals=10 —
  **`publishable claims: 0`**. The 10 resolved candidates land as adapter
  residuals rather than publishable write-set claims in this run. Not
  investigated further — out of this task's scope — but recorded rather
  than glossed over, since it means this run's own resolved count does not
  translate 1:1 into the baseline's "publishes claims" count in Part 2 below.
- `m3_auto_pass_conditions`: `v1v2_comparison=NOT_EVALUATED` (no
  `--v1-snapshot` supplied), `lexical_disagreement=EVALUATED` (1 section),
  `both_nets_clean=0`

Recorded to `.../native-producer-recorded-response-8.12.json` (written
unconditionally by every live call — this is what makes the run replayable
via `--replay-from-run`).

The corrected pin does produce something: 10 resolved claims where the
8.5-only baseline had 0 (all fifteen 8.5 findings were construction-rule
`DEFINITION_ENVELOPE` open-world entries).

### 1b. `CONSIDERATION` on Modiv §2.6

```
CI=true node scripts/canonical-v2-live-extraction-run.mjs \
  --deal modiv --family CONSIDERATION --section-refs 2.6 \
  --out-dir evidence/canonical-v2/modiv-consideration-2.6-20260807-live
```

**Result, EXIT=0, model_call_count=1** (14,611ms):

- `compiled_candidates`: 1 ok / 0 rejected
- `resolution`: **resolved=1, auto_pass=0, review_queue=1, open_world=0,
  residuals=0**
- `write_set`: claims=1, components=0, adapter residuals=0 —
  **`publishable claims: 1`**
- `m3_auto_pass_conditions`: `v1v2_comparison=NOT_EVALUATED`,
  `lexical_disagreement=EVALUATED` (1 section), `both_nets_clean=0`

This is the appraisal-negative fact from §2.6 ("No dissenters' or appraisal
rights shall be available...") landing as a governed
`APPRAISAL_RIGHTS_STATUS` claim under Consideration, as `PLAN.md` Step 2A
predicted it would once pointed at the right section.

### 1c. `CLOSING_CONDITIONS` §6.2

`CLOSING_CONDITIONS` on §6.2 has no recorded *model* response at all — the
committed `modiv-closing-conditions-20260806/native-producer-recorded-response-6.2.json`
`raw_response_text` is literally the CLI's own status line, `"Written to
`evidence/canonical-v2/modiv-closing-conditions-20260806/native-producer-recorded-response-6.2.json`,
matching the sibling `6.1` file's..."` — confirmed by reading the file
directly before running anything, matching the task's own diagnosis exactly.
6.3 and 6.4 have no recorded response of any kind (the 2026-08-06 run
appears to have stopped after the bad 6.2 capture). Only 6.2 was run here;
6.3/6.4 remain uncovered, same as before this task.

```
CI=true node scripts/canonical-v2-live-extraction-run.mjs \
  --deal modiv --family CLOSING_CONDITIONS --section-refs 6.2 \
  --out-dir evidence/canonical-v2/modiv-closing-conditions-6.2-20260807-live
```

**Result, EXIT=0, model_call_count=1** (136,442ms):

- `compiled_candidates`: 10 ok / 0 rejected
- `resolution`: **resolved=3, auto_pass=0, review_queue=8, open_world=2,
  residuals=0**
- `write_set`: claims=3, components=0, adapter residuals=0 —
  **`publishable claims: 3`**
- `m3_auto_pass_conditions`: `v1v2_comparison=NOT_EVALUATED`,
  `lexical_disagreement=EVALUATED` (1 section), `both_nets_clean=0`

### 1d. Summary of the three runs

| Family / section | resolved | review_queue | open_world | publishable claims |
|---|---|---|---|---|
| `KEY_DEFINED_TERMS` §8.12 | 10 | 17 | 2 | 0 (adapter residuals, see 1a) |
| `CONSIDERATION` §2.6 | 1 | 1 | 0 | 1 |
| `CLOSING_CONDITIONS` §6.2 | 3 | 8 | 2 | 3 |

None is a zero — all three corrected pins/sections produced real output, none
retried, none padded.

## 2. Regenerating the baseline

**Method.** Steps 3A/3A1/3B/3C/3D/3F/3F1/3G changed `candidate-resolution.js`
and related resolver code after the committed `-20260807-replay` directories
were produced, so those directories' `resolution.json` / `adapter-result.json`
still reflect pre-fix behaviour even though their filenames say
"-replay". Regenerating means re-running each of the 25 committed
`-20260807-replay` (and the one `-6.1-only-` variant) directories **in
place** — same `--out-dir` as the existing directory, same family, same
`--section-refs`, same `--follow-citations`/`--no-follow-citations`,
`--agreement-date` — via `--replay-from-run <original fixture-source
directory>`, so the run consumes the exact same recorded model responses as
before but scores them with the current (fixed) resolver. Zero model calls
throughout (`0 model call(s)` / `REPLAY: N/N recorded call(s) used` on every
line below).

The fixture source for each directory is its original `-20260806` (or, for
`TERMINATION_FEE`, the `-20260805` scope-correction run whose `open_world`
count of 16 matches what `modiv-termination-fee-20260807-replay` was
produced from) — never the `-20260807-replay` directory itself, which
carries no `native-producer-recorded-response-*.json` of its own (confirmed:
`ls evidence/canonical-v2/modiv-appraisal-20260807-replay/ | grep native`
returns nothing on every `-replay` directory checked). Writing the refreshed
output back into the **same** `-20260807-replay` directory (rather than a
new dated directory) is deliberate: `baseline-manifest.mjs` sums `published`
across *every* importable run directory under `evidence/canonical-v2/`, not
one per family, so leaving both an old and a regenerated directory for the
same family side by side would double-count. The pre-2026-08-07 originals
stay non-importable regardless (the DEFLATE source-map identity defect,
`DECISIONS.md`), so they contribute zero and are not a double-count risk;
two `-20260807-replay`-shaped directories for the same family would have
been.

**Ran, `evidence/canonical-v2/*replay-baseline.sh` (scratchpad):** all 25
directories (24 Modiv + `topbuild-mae-definition-20260807-replay`), each
`--replay-from-run <original fixture source> --out-dir <same -20260807-replay
directory>`, matching family/section-refs/`--agreement-date`/citation-flag
exactly as recorded in that directory's own (pre-existing) `run-manifest.json`.
**All 25 exited 0, all reported `0 model call(s)` and `REPLAY: N/N recorded
call(s) used`.** No live model spend in this part.

```
CI=true npm run generate:baseline   # writes evidence/canonical-v2/baseline-manifest.json
CI=true npm run gate:baseline       # --check mode
```

`generate:baseline` output:
`[baseline] wrote evidence/canonical-v2/baseline-manifest.json: 28/52
importable, 25 families, 203 claims`

`gate:baseline` output: **`[baseline] OK: evidence/canonical-v2/baseline-manifest.json
matches what the evidence directories produce`, EXIT=0.**

### 2a. No regression check, per directory

Before overwriting, every `-20260807-replay` directory's prior
`resolution.json` was still readable from git HEAD (working-tree files were
edited but nothing was committed). Compared `resolved`/`review_queue`/`open_world`
count, before vs after, for all 25:

```
node -e "... execSync('git show HEAD:'+p) vs current file ..."
```

**No family's `resolved` count fell.** Six improved (`GENERAL_COVENANTS`
0→10, `MATERIAL_CONTRACTS` 15→24, `SPECIFIC_PERFORMANCE_REMEDIES` 0→1,
`TAX_MATTERS` 0→5, `TERMINATION` 8→12; `REPRESENTATIONS` stayed at 0
resolved but moved 10 candidates out of `open_world` into `review_queue`,
28→18 open-world, 0→10 review-queue — partial progress, not yet a claim).
The other nineteen were unchanged claim-for-claim. This matches Steps
3A/3A1/3B/3C/3D/3F/3F1/3G's own descriptions of what each fixed and nothing
else moved silently.

Summed across the same 25 directories (**excluding** the three new live
runs, to isolate the resolver-fix effect): `open_world` **275 → 240**, a
reduction of **35** — matching the task's own prediction ("~35") exactly.
`resolved` **173 → 202**.

## 3. Before / after, full table

**Before**, re-derived from the *previous* committed
`evidence/canonical-v2/baseline-manifest.json` (`git show
HEAD:evidence/canonical-v2/baseline-manifest.json`), not retyped from the
task brief — it matches the brief exactly, which is itself a check that
nothing was mis-transcribed:

```
run_count 49, importable 25, families_with_an_importable_run 25
totals: claims 170, provisions 67, excerpts 159
open_world (importable runs) 275
families publishing >0 claims: 15 of 25
```

**After**, from the regenerated `evidence/canonical-v2/baseline-manifest.json`
(`npm run generate:baseline` then `npm run gate:baseline`, both above):

| Measure | Before | After | Change |
|---|---|---|---|
| Extraction run directories (`run_count`) | 49 | **52** | +3 (the three new live-run directories) |
| Importable runs | 25 | **28** | +3 (all three new live runs import cleanly) |
| Registered families with an importable run | 25 of 25 | **25 of 25** | unchanged |
| **Families whose run publishes claims** | **15 of 25** | **18 of 25** | **+3**: `GENERAL_COVENANTS`, `SPECIFIC_PERFORMANCE_REMEDIES`, `TAX_MATTERS` newly publish; `REPRESENTATIONS`, `APPRAISAL_DISSENTERS_RIGHTS`, `DIVIDENDS`, `EMPLOYEE_MATTERS`, `FINANCING_COVENANTS`, `GUARANTY_FINANCING_PARTY`, `KEY_DEFINED_TERMS` still publish zero |
| Claims / provisions / excerpts | 170 / 67 / 159 | **203 / 86 / 181** | +33 / +19 / +22 |
| Open-world entries (importable runs) | 275 | **244** | −31 overall (−35 from the Stage 3 resolver fixes on the 25 pre-existing directories, +4 net from the three new live runs' own open-world findings: 2 + 0 + 2) |

`npm run gate:baseline` passes: `[baseline] OK: evidence/canonical-v2/baseline-manifest.json
matches what the evidence directories produce`.

## 4. Findings — read this before trusting the headline numbers

**Nothing moved the wrong way in the resolved/claims/open-world totals.**
Every family's `resolved` count either held or rose; the ten still-zero
families stay reasoned zeros (`APPRAISAL_DISSENTERS_RIGHTS`,
`GUARANTY_FINANCING_PARTY` are correct zeros per `PLAN.md`'s own triage;
`DIVIDENDS`, `EMPLOYEE_MATTERS`, `FINANCING_COVENANTS`, `KEY_DEFINED_TERMS`,
`REPRESENTATIONS` are known vocabulary/pin gaps, some only partially
addressed by Stage 3 as the `REPRESENTATIONS` open-world→review-queue shift
above shows).

**One number is a genuine finding, and it is not a regression but a gap
worth naming: `KEY_DEFINED_TERMS` §8.12 resolved 10 candidates and published
0 claims.** Both the runner's own `buildNativeWriteSet` output and the
baseline manifest's independent `importRunEvidence` re-derivation agree: 10
resolved, 0 published claims, 5 provisions with no claim attached
(`evidence/canonical-v2/modiv-key-defined-terms-8.12-20260807-live/`,
confirmed via `node -e "...baseline-manifest.json...KEY_DEFINED_TERMS..."`).
So `KEY_DEFINED_TERMS` is still one of the seven families reporting zero
published claims in the "after" table, even though the corrected pin now
demonstrably finds real defined-term candidates and resolves ten of them —
the corrected pin fixed the *pin* defect PLAN.md Step 2A diagnosed, but a
second, narrower defect (resolved candidates not reaching a publishable
claim) sits behind it, not investigated further here because it is outside
this task's scope. Reported precisely rather than folded into "still zero,
as expected."

**`CONSIDERATION` and `CLOSING_CONDITIONS` both moved cleanly**: 1→2 claims
and (implicitly) 6→9 claims respectively once their corrected-section live
runs are added to the family's existing partial-coverage run, with the
appraisal-negative claim (`APPRAISAL_RIGHTS_STATUS`) landing exactly where
`PLAN.md` Step 2A predicted it would.

**`CLOSING_CONDITIONS` §6.3 and §6.4 remain uncovered** — this task only ran
§6.2 per its scope; the family pin's other two sections still have no
recorded model response of any kind. Not a regression, just an honest gap
still open after this task.

**`REPRESENTATIONS` did not start publishing claims.** Its `resolved` count
held at 0 even after the Stage 3 replay; the only change was 10 candidates
moving from `open_world` (unclassified) to `review_queue` (classified,
queued) rather than resolving outright. Its 15-of-25 → 18-of-25 improvement
is not attributable to this family.

