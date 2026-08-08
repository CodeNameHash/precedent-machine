# Merge review: scripts/, components/, pages/, tests/, lib/parser-v2/

Reviewer slice per handoff (read-only). Branch
`claude/codex-handoff-plan-status-77wn7n` vs `origin/main`.

## BLOCKS MERGE

### 1. Two new tests in `tests/canonical-v2-termination-limb-grant-context.test.js` fail as committed

- File: `tests/canonical-v2-termination-limb-grant-context.test.js`
- Tests (lines ~415-467):
  - `unit: findTerminationLimbChapeau bounds a terminal leaf at newline/section-end when neither colon nor semicolon is present`
  - `unit: findTerminationSectionEitherGrantContext returns the section-chapeau mutual grant when limbs carry grounds only`
- Both build an ad hoc `admittedSourceContext = { canonical_text: { text: sectionText } }`
  instead of using the file's own `buildReplaySourceContext()` helper (used by every
  other test in the file). That object is missing `canonical_text_id`, so
  `buildSemanticSpan` (`lib/canonical-v2/source-structure.js:154`) throws
  `TypeError: canonical_text_id must be a full SHA-256 hex digest` via
  `assertDigest` before either assertion is reached.
- Reproduced twice, deterministically, both in isolation and inside the full
  glob run:
  ```
  CI=true node --test tests/canonical-v2-termination-limb-grant-context.test.js
  # pass 12
  # fail 2
  not ok 12 - unit: findTerminationLimbChapeau bounds a terminal leaf...
  not ok 13 - unit: findTerminationSectionEitherGrantContext returns...
  ```
- `package.json`'s `test` script is `node --test "tests/**/*.test.js" ...`, so
  this file is in the default `npm test` glob — `CI=true npm test` fails on
  this branch as committed.
- This is not a weakened assertion, it's a broken new test (fixture-construction
  bug) — but it means the branch does not currently pass its own test suite.
  **Blocks merge until fixed** (either fix the two fixtures to build a real
  admitted source context, e.g. via `buildReplaySourceContext()` or an
  equivalent digest-bearing stub, or the underlying functions are proven not
  to require a real digest, which the current code contradicts).

## Follow-ups (do not block)

### 2. Stale evidence vs. narrowed allowed-value set (self-disclosed, owned by lib/canonical-v2/ reviewer)

- Commit `fee01be1` ("integrate(2X-D): revert the MAE materiality split
  (UNREVIEWED) -- with one stale premise") explicitly documents that
  `evidence/canonical-v2/redhat-representations-20260808-2xl-replay/resolution.json`
  (committed earlier the same day) carries `MAT_MAE_AGGREGATE` 26 times as
  `canonical_value`, which the narrowed allowed-value set in
  `lib/canonical-v2/contract-bundle.js` (line ~3823) no longer permits after
  the revert in this same commit. The commit message states this is a
  sequencing issue (the 2X-L replay evidence predates the revert and needs
  regenerating) rather than a code conflict, and says "the fix belongs to
  whoever reviews the diff."
- This lives entirely in `evidence/` and `lib/canonical-v2/` — outside my
  slice (scripts/components/pages/tests/lib/parser-v2) — but no test in my
  slice currently catches the disagreement (checked:
  `tests/canonical-v2-qualifier-kind-lexicon.test.js` only asserts
  `MAT_MAE_AGGREGATE` is unemittable going forward, not that existing
  committed evidence is consistent). Flagging for the `lib/canonical-v2/`
  reviewer / Ben: the redhat 2X-L replay evidence should be regenerated
  before or shortly after merge.

### 3. Behavior changes in candidate-resolution.js / qualifier-kind-lexicon.js tests, all well-grounded

Several test files were rewritten with expanded, not reduced, coverage
alongside genuine behavior changes on the `lib/canonical-v2/` side (out of my
slice). Checked each against `docs/core/DECISIONS.md` and in-file history
comments; all traced back to a real, dated decision:

- `tests/canonical-v2-qualifier-kind-lexicon.test.js`,
  `tests/canonical-v2-p2-qualifier-kinds.test.js`,
  `tests/canonical-v2-lexical-net-wiring.test.js`,
  `tests/canonical-v2-v1v2-comparator-wiring.test.js`: `QUALIFIER_KIND_LEXICON_VERSION`
  2 -> 4 and fixture IDs re-keyed to match. Confirmed against
  `docs/core/DECISIONS.md` entry 14 ("MAE materiality: revert the split",
  decided 2026-08-08) — real decision, correctly reflected.
- `tests/canonical-v2-candidate-resolution.test.js`: ITEM-attached ACCURACY
  qualifiers with a resolved `governs_path` now mint as limb-level facts
  instead of routing to `review_queue`. Test was rewritten with MORE
  assertions (resolved claim shape, subject != provision_instance, tree
  membership) plus a new sub-test preserving the original "never rep-level"
  prohibition via the pathless-ITEM path. Not a weakening.
- `tests/canonical-v2-mae-clause-label-parse.test.js`: new tier-4
  (`verifyMaeClauseLabelContainment`) added; original hostile test's intent
  (unverified sibling never rescues another candidate) preserved, moved to a
  wrong-label scenario, plus new fail-closed coverage for the new tier.
- `tests/canonical-v2-termination-limb-grant-context.test.js`: resolved-count
  assertions raised (8 -> 12, 5 -> 4 siblings, etc.) documented as a further
  vocabulary-table widening (Step 3A) layered on top of an earlier fix;
  numbers match a live replay, not an arbitrary loosening.
- None of these are within my owned files (`lib/canonical-v2/`), so final
  sign-off on the underlying behavior is the other reviewer's call — but the
  **tests themselves** are not weakened; if anything they gained assertions.

### 4. `scripts/lint/forbidden-patterns.sh` exemption widened for `recording.json`

- Added `recording` to `LIVE_RUN_SOURCE_TEXT_FILE`, exempting
  `evidence/canonical-v2/*/recording.json` from `PROSE_CLASS_FINGERPRINTS`
  only (not `CODE`-class patterns). Verified in the script (line ~384, 407)
  that the exemption is scoped to `PROSE_CLASS_FINGERPRINTS` specifically,
  matching the fourth/fifth "same class" precedent already in the file. Ran
  `bash scripts/lint/forbidden-patterns.sh` — exit 0, `INVARIANT-4: PASS`.
  Not a weakening; a legitimate extension of an existing, narrow allowlist.

## V1-consumer test results (subclauses.js MAX_DEPTH 3->5, xyz rule)

All four named suites pass clean after the `lib/parser-v2/subclauses.js`
changes:

```
tests/bring-down-recovery.test.js      pass 4  fail 0
tests/span-claims.test.js              pass 14 fail 0
tests/canonical-conditions.test.js     pass 18 fail 0
tests/feature-compare.test.js          pass 20 fail 0
```

`tests/subclauses.test.js`: grew 8 -> 18 tests, all pass (`pass 18 fail 0`).
The original Redfin §2.10 test (unmodified in the diff — no removed lines
above line 143) still asserts (h)'s inline (i)/(ii)/(iii) stays UNSPLIT
inside the leaf; confirmed unchanged in the file and passing.

**Guard proof, done live**: neutered `isColonIntroduced` to always return
`false`, reran the suite — 4 tests failed as predicted (the Metsera
colon-introduced test, both MAX_DEPTH 4/5 tests, and the known-hole
same-style-signature test), confirming the colon rule is load-bearing, not a
no-op. Restored the file (`git diff` confirms byte-identical to committed
`1dc38008`); reran — 18/18 pass again.

**xyz corroboration**: confirmed by reading `findStructuralMarkers` that
`firstHit` (CHILD-OPEN "first value of its style") can only be a bare `x`
with `value === 0` for the `xyz` style (alpha "x" = 23, roman "x" = 9), so
the corroboration branch is reached only for literal `(x)` tokens, matching
the header comment. `xyzCorroborated` requires a following `(y)` within a
2000-char / same-paragraph window; a lone `(x)` test
(`'uncorroborated lone "(x)" does NOT open a list'`) and a corroborated-but-
not-eligible back-reference test both pass, confirming a lone `(x)` cannot
open a list and corroboration alone doesn't bypass the CHILD-OPEN
eligibility gate.

**Byte/string confusion**: `subclauses.js` consistently uses JS string
methods (`text.slice`, `.length`, regex `.exec`/`.index`) throughout — no
`Buffer`/byte-offset code found in the file. Its four V1 callers
(span-claims.js, span-residual.js, consideration-equity.js,
bring-down-tiers.js) all pass and their own tests pass, so no evidence of a
caller mixing byte and string offsets against this module.

## Absence-copy sweep (`CONDITION_ABSENT_COPY`)

11 files in `components/review/table-configs/` (12 call sites — 3 in
conditions-m.config.js, 2 each in nosol-section.config.js and
termination-rights.config.js) switched from bespoke "No X found." strings to
the imported `CONDITION_ABSENT_COPY` constant. Grepped all of
`components/review/table-configs/*.config.js` for any remaining `"No .*
found"` string — none left. `CONDITION_ABSENT_COPY` itself
(`lib/canonical-conditions.js:118`, pre-existing on `origin/main`, not part
of this diff) is imported everywhere, not re-declared or copy-pasted as a
literal string, so the mechanism was genuinely ported, not just the text.
`termination-rights.config.js`'s per-cell `keyTermsNode` absence copy was
also converted (a new site, not in the original 11-file list, but same
class, correctly done). No fabricated provenance signal — the copy is
explicitly hedged ("may not be present, or not yet extracted"), which is
weaker/more honest than the old "No X found." wording it replaced.

## Other things checked

- `pages/api/review/[id]/cards.js`: added `await` on
  `attachCanonicalTerminationFeeServing`. Verified against
  `lib/canonical-v2/termination-fee-serving-source.js` — the function
  legitimately returns a Promise only for the new Modiv DB-backed path and a
  plain object otherwise; `await` on a non-thenable resolves to itself, so
  this is correct for both old and new callers.
- `scripts/canonical-v2-live-extraction-run.mjs`: two workstreams (Step 2X-D
  MAE revert; call-timeout/M3-conditions work) both touch this file across
  the branch's commit history (linear, not merged), final state has no
  conflict markers, no duplicate top-level declarations, `node --check`
  clean. The only change from the 2X-D commit is a comment update
  documenting the MAT_MAE_AGGREGATE removal — no code-level incompatibility.
  Its dependent suites
  (`tests/canonical-v2-live-extraction-run-call-timeout-wired.test.js`,
  `tests/canonical-v2-live-extraction-run-m3-conditions-wired.test.js`,
  `tests/canonical-v2-general-extraction-runner.test.js`) all pass.
- `scripts/generate-registry.js`: adds a narrow, well-commented
  `TAGGED_LIST_OVERRIDES` escape hatch for two supplemental features whose
  inventory row predates `list-tagged` declared types
  (`secFilingsExcludedSections`, `interveningEventExceptions`); corresponding
  `tests/schema/registry-shape.test.js` / `tests/schema/coverage.test.js`
  pass, and `coverage.test.js`'s new Supabase-unavailable skip announces
  itself via `t.skip(reason)` rather than silently short-circuiting.
- `tests/fixtures/canonical-v2/f28-third-live-run/resolution.json` and
  `tests/fixtures/review-parity/cases/material-contracts/landos-abbvie.projection.json`:
  diffs are pure ID re-keying from the lexicon version bump (2 -> 4),
  documented inline; no content/value changes.

## Note on the full-suite run

Attempted a full `CI=true node --test "tests/**/*.test.js"` run twice; both
times it picked up transient failures in `tests/auth-route-enforcement.test.js`
(6 failures: 500s, 404s, a JSON-parse-on-HTML error) caused by a concurrent
`next dev -p 3112` / `next build` process another agent was running in this
same environment at the time (visible in `ps aux`). That file is **not
touched by this branch's diff** (`git diff origin/main..HEAD -- tests/auth-route-enforcement.test.js`
is empty) and passes clean in isolation: `CI=true node --test
tests/auth-route-enforcement.test.js` → `pass 101 fail 0`. Not a branch
regression — environment interference from concurrent agent activity.
Every file actually touched by this diff was verified via targeted,
isolated `node --test` runs (see above), which is a reliable signal
independent of that interference.

## Verdict

**One BLOCKS MERGE finding**: two new tests in
`tests/canonical-v2-termination-limb-grant-context.test.js` fail
deterministically as committed (missing `canonical_text_id` in an ad hoc
test fixture triggers a real `TypeError` in `buildSemanticSpan`), which means
`CI=true npm test` fails on this branch today. Everything else reviewed in
this slice (`lib/parser-v2/subclauses.js` and its four V1 consumers, the
11-file absence-copy sweep, `forbidden-patterns.sh`, `generate-registry.js`,
the `cards.js` await fix, and every test file with non-additive diffs) is
either unchanged in substance, strengthened, or a documented, decision-backed
behavior change — no evidence of a test weakened to make a change pass.
