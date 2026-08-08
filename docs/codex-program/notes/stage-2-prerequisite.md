# Stage 2 blocking prerequisite — wiring Ben's two M3 auto-pass conditions

Executes `docs/core/PLAN.md` lines 378-410 ("Prerequisite. Wire Ben's two M3
auto-pass conditions before rung 1"). Working notes, written incrementally.

## 1. Ruling on the two modules

**Real paths (the plan text is wrong, the codebase guide should be checked
too):**

- `lib/canonical-v2/native-producer/v1v2-comparator.js` — NOT
  `lib/canonical-v2/v1v2-comparator.js` as PLAN.md states.
- `lib/canonical-v2/native-producer/lexical-disagreement-net.js` — NOT
  `lib/canonical-v2/lexical-disagreement-net.js`.

Confirmed by `find`; no file exists at the paths PLAN.md names. Both live
under `native-producer/`, alongside `candidate-resolution.js`,
`anthropic-provider.js`, `cure-period-parse.js` — the exact directory this
task was told NOT to edit (only read), which is consistent: these two are
owned/reviewed alongside the native-producer family, not floating loose
under `lib/canonical-v2/`.

**What `v1v2-comparator.js` actually does** (read in full, 725 lines):

- Pure, deterministic, no model/network/DB calls. Two inputs:
  `v1_snapshot` (a `V1_PROVISION_SNAPSHOT/V1`, built offline by
  `scripts/export-v1-provision-snapshot.mjs` from `provision_cards`) and
  `v2_side` (the `resolveCandidates()` output for the same deal).
- Tier 1 (PRESENCE/IDENTITY): for every v1 card, maps
  `(provision_type, provision_subtype)` to a v2 `concept_key` via a frozen
  `FAMILY_MAPPING_TABLE` (identity mapping only, no fuzzy matching), then
  compares the v1 card's parsed `section_ref` against the v2 provision's
  majority citation string. Outcomes:
  `V1V2_PRESENCE_AGREEMENT / V1_MISSING / V2_NOT_ATTEMPTED / V2_MISSING /
  SECTION_MISMATCH / V1_CARD_UNMAPPED`.
- Tier 2 (VALUE agreement): only runs where a `VALUE_MAPPING_TABLE` entry
  exists for the concept — today this table has exactly ONE entry
  (`TERMF-TARGET`), exercised only by synthetic fixture tests. No real
  REPRESENTATION card carries a per-claim value at all, so for every real
  claim resolved to date, Tier 2 finds nothing to compare and condition 1
  stays `V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM` (Ben's ruled option A) —
  evaluated, not passed, still blocking auto-pass. This is a real,
  documented, counted case, not a bug.
- Public entry point: `buildV1V2ComparisonReceipt({ v1_snapshot, v2_side,
  attempted_section_scope, v2_canonical_text? })`. Strictly requires a
  snapshot with `snapshot_identity_evidence` verified via
  `requireIssuedIdentityConsumerEvidence` — a diagnostic-only variant
  (`buildV1V2ComparisonDiagnostic`, `authority: 'NONE'`) exists for
  unverified local use but `resolveCandidates()` itself REJECTS anything
  whose `schema_version` is not the authoritative
  `V1V2_COMPARISON_RECEIPT/V1` (candidate-resolution.js line ~3512) — so
  the diagnostic variant cannot be used to satisfy condition 1 at the
  wiring call site; only the real receipt, with real identity evidence,
  qualifies.

**What `lexical-disagreement-net.js` actually does** (read in full, 1390
lines):

- Pure, deterministic, no model/network/DB calls. Two inputs per SECTION:
  `governed_section` (`{section_ref, text, text_sha256}`, hash re-verified,
  fail-closed on mismatch) and `candidates` (this run's own compiled
  candidates for that section, with section-local UTF-8 byte evidence
  spans).
- A frozen, versioned `LEXICAL_FAMILY_LEXICON/V1` (currently version 16,
  covering REP-T-CAP, REP-T-CONTRACTS, the no-other-reps/fraud families,
  general covenants, TERMF-TARGET/REVERSE/TAIL, all five NOSOL- families,
  DEF-MAE, all TERMR- families, COV-PROXY, and the three Consideration
  families) of phrase/acronym/bounded-regex patterns per concept family.
  For every candidate's own family, every lexicon pattern for that family
  must be found somewhere in the section text or the candidate's own
  disagreement set is non-empty — "lexical disagreement vetoes negatives,
  never creates positives" (never promotes a hit into a claim, only flags
  an unmatched tell for review).
- Public entry point: `buildLexicalDisagreementReceipt({governed_section,
  candidates, lexicon?})`, one receipt per section, keyed by `section_ref`
  in the map `resolveCandidates()` expects for `lexical_disagreement`.
  Genuinely additive/optional and needs NO external evidence file — it is
  built entirely from data the run already produced (the run receipt's own
  `resolved_sections` + the plain resolution's own resolved candidates).

**What `resolveCandidates()` expects at the call site** (read
`candidate-resolution.js`'s own JSDoc and the two `applyXWiring` functions,
lines ~3476-3803, 3809-3862):

- `v1v2_comparison` (optional): a single `V1V2_COMPARISON_RECEIPT/V1`
  object for the WHOLE run — schema-checked strictly.
- `lexical_disagreement` (optional): a MAP of `LEXICAL_DISAGREEMENT_RECEIPT/V1`
  keyed by `section_ref`, one entry per section.
- Both are STRICTLY ADDITIVE per the function's own header comment: absent,
  behaviour is byte-identical to before either parameter existed. Verified
  this claim is true, not just asserted (see §4 below).

Both modules do exactly what the prerequisite assumed. Nothing here
contradicts PLAN.md's description of their behaviour — only their file
path was wrong.

## 2. What was wired, and where

`scripts/canonical-v2-live-extraction-run.mjs`, Step 4 (previously a single
`resolveCandidates()` call supplying neither condition):

1. A first, "plain" `resolveCandidates()` pass (no conditions) — needed as
   the input both conditions are built FROM (the lexical net needs the
   plain run's own resolved candidates per section; the comparator needs
   `attempted_section_scope` derived the same way `nets-eligibility-
   report.mjs`'s own `runTwoPassFlow` already does it).
2. Condition 2 (lexical-disagreement) is now ALWAYS built: one receipt per
   `resolved_sections` entry, via `computeSectionCandidatesForLexicalDigest`
   (candidate-resolution.js's own exported digest function) +
   `buildLexicalDisagreementReceipt`. No extra input, no model cost.
   Written to the run's own `lexical-disagreement.json`.
3. Condition 1 (v1<->v2 comparator) is built ONLY when a new
   `--v1-snapshot <path>` CLI flag supplies a committed
   `V1_PROVISION_SNAPSHOT/V1` JSON file. Absent, `v1v2_comparison` stays
   `null` and the run's `run-manifest.json` records
   `m3_auto_pass_conditions.v1v2_comparison = {supplied: false, reason:
   "NO_V1_SNAPSHOT_SUPPLIED: ..."}` — explicit, typed, never a silent
   omission. When supplied, the receipt is written to the run's own
   `v1v2-comparison.json` and its id/counts are recorded in
   `run-manifest.json`.
4. The SECOND, evidence-producing `resolveCandidates()` call — the one
   whose result becomes `resolution.json` and feeds `buildNativeWriteSet`
   — now supplies both `v1v2_comparison` and `lexical_disagreement`.
5. `run-manifest.json` gained an `m3_auto_pass_conditions` block recording,
   for both conditions, whether they were evaluated on this rung and their
   summary counts, plus `claims_both_nets_clean`. This is the field a rung
   can be audited against without re-deriving anything from
   `resolution.json`.

## 3. Why condition 1 could not be exercised end-to-end this task

Every committed `V1_PROVISION_SNAPSHOT/V1` fixture in this repo
(`tests/fixtures/canonical-v2/v1v2-comparator/{modiv,topbuild,skechers}-v1-
provision-snapshot.json`) lacks `snapshot_identity_evidence`. `v1v2-
comparator.js`'s `validateV1Snapshot` — the path `buildV1V2ComparisonReceipt`
uses, the ONLY schema `resolveCandidates()` accepts for `v1v2_comparison` —
requires it unconditionally. There is no legitimate way to synthesise that
evidence without a real `governed-identity-proposal-packet.js` issuance
chain (signed approval + issued allocation receipt + reviewed bridge),
which needs DB access this task does not have and — more to the point —
should not fabricate: identity evidence is a deliberate Ben-added
production-readiness control (commit `0d17ad00`), not a formality to route
around.

So condition 1 is wired and correctly typed, but not exercised against real
data this task — every live/replay run in this repo currently records
`v1v2_comparison: {supplied: false}` honestly, and will keep doing so until
a real, identity-verified `V1_PROVISION_SNAPSHOT/V1` exists for some deal
(export-v1-provision-snapshot.mjs plus a real identity issuance, both
outside this task's scope and ownership boundary). This is the SAME root
cause that broke `scripts/nets-eligibility-report.mjs` (§5) — not a
coincidence, the same gap surfacing in two places.

**This is disclosed, not absorbed, per the acceptance criteria's own
instruction.** The wiring itself is complete and tested; the identity-
evidence backfill needed to exercise condition 1 against a real deal is a
separate, larger piece of work.

## 4. Test: both condition names pinned at the runner's resolve call

`tests/canonical-v2-live-extraction-run-m3-conditions-wired.test.js` (new,
owned by this task). Deliberately a source-text assertion — the
prerequisite's own audit method was "both grep to zero occurrences in that
file"; this test is the same check, pinned so it cannot regress unnoticed.
Four sub-tests:

1. the script imports both `lexical-disagreement-net` and `v1v2-comparator`.
2. the evidence-producing `resolveCandidates()` call (the one feeding
   `resolution.json`, not the earlier "plain" pass the wiring is built
   from) contains both `v1v2_comparison:` and `lexical_disagreement:`.
3. regression pin: the call must never again supply NEITHER condition.
4. `run-manifest.json` records `m3_auto_pass_conditions`.

```
CI=true node --test tests/canonical-v2-live-extraction-run-m3-conditions-wired.test.js
EXIT=0
# tests 4, pass 4, fail 0
```

Also re-ran the existing `tests/canonical-v2-general-extraction-runner.test.js`
(32 dry-run-only tests, never reaches Step 4) to confirm no regression:

```
CI=true node --test tests/canonical-v2-general-extraction-runner.test.js
EXIT=0
# tests 32, pass 32, fail 0
```

## 5. Replay verification (zero model cost) — condition outcomes in evidence

Two committed `-20260807-replay` runs were replayed through the UPDATED
runner via `--replay-from-run` (consumes the ALREADY-COMMITTED
`native-producer-recorded-response-*.json` fixtures from the ORIGINAL run
directory — zero live model calls, `model_call_count: 0` in both runs
below).

### 5a. `modiv-representations` (resolved=0 case)

```
CI=true node scripts/canonical-v2-live-extraction-run.mjs \
  --deal modiv --family REPRESENTATIONS --section-refs 3.1,3.3,3.4 \
  --agreement-date 2026-05-03 \
  --replay-from-run evidence/canonical-v2/modiv-representations-20260806 \
  --out-dir <scratch>/m3-replay-verify
```

Output: `m3_auto_pass_conditions: v1v2_comparison=NOT_EVALUATED
lexical_disagreement=EVALUATED (3 section(s)) both_nets_clean=0`.
`resolution.json` counts (`resolved=0, open_world=28, review_queue=0`) are
BYTE-IDENTICAL to the committed `modiv-representations-20260807-replay/
resolution.json` — no outcome change, because there are zero resolved
claims for either wiring function to touch.

### 5b. `modiv-no-shop` (resolved=42 case — real per-claim change)

```
CI=true node scripts/canonical-v2-live-extraction-run.mjs \
  --deal modiv --family NO_SHOP --section-refs 5.6 \
  --agreement-date 2026-05-03 \
  --replay-from-run evidence/canonical-v2/modiv-no-shop-20260806 \
  --out-dir <scratch>/m3-replay-verify-noshop
```

Routing counts unchanged (`resolved=42, review_queue=52, open_world=9`,
`auto_pass=0` — matches the committed `modiv-no-shop-20260807-replay/
resolution.json` exactly; `auto_pass` stays 0 for every claim regardless,
permanently blocked by `SOURCE_SCOPE_CERTIFICATION_ABSENT`, unrelated to
this wiring).

**But per-claim triage detail changed for all 42 resolved claims — this is
condition 2 actually evaluating, not a no-op:**

| | before (unwired) | after (wired) |
|---|---|---|
| `LEXICAL_DISAGREEMENT_NET_ABSENT` (unevaluated) | 42 | 0 |
| `LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE` (blocking reason) | 0 | 25 |
| `LEXICAL_LEXICON_UNCOVERED_FAMILY` (unevaluated) | 0 | 16 |
| clean condition-2 evaluation (neither of the above) | 0 | 1 |

25 of the 52 `review_queue.json` items now carry a real
`lexical_disagreement_excerpts` array (byte-offset excerpts of the unmatched
lexicon pattern in the section text) that did not exist before. Example:
a `NOSOL-PROHIBIT` claim now shows an unmatched `Company Acquisition
Proposal` / `Acquisition Proposal` phrase in its own section, a real,
readable review signal that was invisible before this wiring (previously
just `LEXICAL_DISAGREEMENT_NET_ABSENT`, uninformative).

`v1v2_comparison` stayed `NOT_EVALUATED` for both replays (§3) —
`V1_V2_COMPARATOR_ABSENT` unevaluated-condition count is unchanged at 42
before and after, correctly, since no `--v1-snapshot` was supplied.

**Reported per the acceptance criteria's instruction not to absorb a
result change:** wiring condition 2 changes the per-claim `reasons` /
`unevaluated_conditions` content (and hence `review_queue.json`'s per-item
fields) on every run with resolved claims. It does NOT change `auto_pass`
outcomes (still permanently 0, unrelated gate) or resolved/review_queue/
open_world counts (wiring only rewrites triage on already-resolved
entries, never moves an entry between arrays). Both committed `-20260807-
replay` evidence directories are NOT overwritten by this task — the two
verification runs above were written to a scratch directory, not
`evidence/canonical-v2/`, so no other agent's committed evidence changed.

## 6. `scripts/nets-eligibility-report.mjs` — broken since `0d17ad00`, fixed

**What `0d17ad00` actually did to this file** (`git show 0d17ad00 --
scripts/nets-eligibility-report.mjs`): added an unconditional `throw` as
the first statement of `loadSkechersReplayRun()`, and added a guard at the
top of `runTwoPassFlow()`: `if (!snapshot?.snapshot_identity_evidence)
throw`.

**The file's own header comment is stale/wrong** (exactly the trap
CLAUDE.md warns about — "read the code, not the comment"): it claims the
identity fence "is correctly scoped to Skechers in principle" and that
TopBuild/Modiv have "complete data and nothing to do with the Skechers
identity gap." Verified false by running the script before any fix:

```
CI=true node scripts/nets-eligibility-report.mjs
Error: NETS eligibility report is blocked: V1 snapshot lacks verified issued identity binding.
    at runTwoPassFlow (.../scripts/nets-eligibility-report.mjs:148:11)
```

It fails on the FIRST deal (TopBuild), never reaching Skechers. Checked all
three committed snapshot fixtures directly: none of
`{modiv,topbuild,skechers}-v1-provision-snapshot.json` carries
`snapshot_identity_evidence`. The guard `0d17ad00` added blocks ALL THREE
deals identically, not just Skechers — the header's diagnosis undercounts
its own blast radius.

**The fix** (matching the header's OWN prescribed remedy — "main() is
changed to isolate a per-deal failure instead of aborting the whole run"):
`main()`'s `deals` loop now wraps each deal's `load()` +
`runTwoPassFlow()` in its own try/catch, collecting a `blocked` list
alongside `summaries` instead of letting one deal's exception kill the
entire run. The stale header claim about Skechers-only scoping was
corrected to state plainly that all three committed snapshots currently
lack identity evidence.

**This does NOT manufacture identity evidence** — that would defeat the
control Ben deliberately added. The script now runs and reports,
per-deal, exactly why each deal is blocked, instead of crashing with zero
output. Given the same underlying gap as condition 1 above (§3), every
deal is currently reported blocked — this is the honest, current state,
not a regression introduced by this fix.

Command and result after the fix:

```
CI=true node scripts/nets-eligibility-report.mjs
EXIT=0
NETS ELIGIBILITY REPORT -- both_nets_clean is ZERO by construction this
slice under Ben's option A ...

=== TopBuild === BLOCKED
  NETS eligibility report is blocked: V1 snapshot lacks verified issued identity binding.

=== Skechers === BLOCKED
  NETS eligibility report is blocked: no verified snapshot identity binding exists for Skechers. A raw governed deal key cannot substitute for issued allocation and reviewed bridge evidence.

=== Modiv === BLOCKED
  NETS eligibility report is blocked: V1 snapshot lacks verified issued identity binding.
```

The script now runs to completion (exit 0) and produces real output for
every deal instead of crashing with none. Every deal reports BLOCKED with
its own typed reason — this is the honest current state (§3), not a
regression from the fix. `--json` mode produces the same per-deal
`{summaries: [], blocked: [...]}` shape. `tests/nets-eligibility-report-
identity-fence.test.js` (asserts `runTwoPassFlow` itself still throws on a
snapshot without identity evidence) and
`tests/canonical-v2-identity-consumer-closure-audit.test.js` (asserts
`scripts/nets-eligibility-report.mjs` is a discovered identity-boundary
consumer referencing `buildV1V2ComparisonReceipt`) both still pass —
neither test's own guard was touched, only `main()`'s per-deal isolation.

## 7. Full targeted test run (this task's own files + the two ruled-on modules' existing tests)

```
CI=true node --test \
  tests/canonical-v2-live-extraction-run-m3-conditions-wired.test.js \
  tests/canonical-v2-general-extraction-runner.test.js \
  tests/canonical-v2-identity-consumer-closure-audit.test.js \
  tests/nets-eligibility-report-identity-fence.test.js \
  tests/canonical-v2-v1v2-comparator.test.js \
  tests/canonical-v2-v1v2-comparator-wiring.test.js \
  tests/canonical-v2-lexical-disagreement-net.test.js \
  tests/canonical-v2-lexical-net-wiring.test.js \
  tests/canonical-v2-comparator-wiring-replay.test.js
EXIT=0
# tests 106, pass 106, fail 0
```

`bash scripts/lint/forbidden-patterns.sh` also passes (`INVARIANT-4: PASS`).

## 8. Files touched

- `scripts/canonical-v2-live-extraction-run.mjs` — wiring (owned by this task).
- `scripts/nets-eligibility-report.mjs` — per-deal isolation fix + stale
  header correction (owned by this task).
- `tests/canonical-v2-live-extraction-run-m3-conditions-wired.test.js` — new
  test (owned by this task).
- `docs/codex-program/notes/stage-2-prerequisite.md` — this note.

Nothing under `lib/canonical-v2/native-producer/` was edited — only read,
per the ownership boundary (`candidate-resolution.js`, `anthropic-
provider.js`, `cure-period-parse.js`, `v1v2-comparator.js`, `lexical-
disagreement-net.js` all belong to other agents this task).
