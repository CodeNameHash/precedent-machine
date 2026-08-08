# Open-world evidence emission: write and serving boundaries

DECISIONS.md decision 2 ("Whether open-world evidence is written at all" --
RULED 2026-08-07: "emit them, with a flag"), PLAN.md Step 2B's addition of the
same date. This note records what was built, the numbers, and what was found
along the way.

## What "the marker" is

A literal string field, `evidence_governance`, set to the constant
`UNGOVERNED_OPEN_WORLD_EVIDENCE` (exported as
`OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER`), present **on every open-world row's
own payload** -- `open_world_candidates`, `open_world_candidate_occurrences`,
`open_world_evidence_references`, `open_world_candidate_dispositions`. It is
never present on a `claims` or `relationships` row: their identity is
content-hashed over a closed field list
(`CLAIM_REVISION_PAYLOAD_FIELDS`/`RELATIONSHIP_REVISION_PAYLOAD_FIELDS` in
`native-write-set-adapter.js`, and `CLAIM_REVISION_KEYS` in
`claims-relationships.js`, enforced by `requireExactKeys`) that does not
include it, so a real write can never produce a claim carrying the field --
only a hand-tampered one can, and that is exactly the case the tests below
prove gets caught.

## Where it is minted (write boundary)

`lib/canonical-v2/native-producer/native-write-set-adapter.js`,
`buildOpenWorldWriteRows` (new function). Called from `buildNativeWriteSet`
once per `resolution.open_world` entry, alongside the existing per-claim
loop. Each entry becomes:

- one `open_world_candidates` row (`schema_version:
  'NATIVE_OPEN_WORLD_CANDIDATE/V1'`)
- one `open_world_candidate_occurrences` row
- one-or-more `open_world_evidence_references` rows, one per evidence edge,
  shifted from section-local to document-absolute coordinates and excerpted
  through the **same** `shiftEdge`/`excerptFor` machinery the main claim loop
  already uses -- an open-world entry's `.evidence` is the identical
  section-local shape as a compiled claim row's, by construction
  (`candidate-resolution.js`'s `pushOpenWorld` passes the candidate's own
  `claim` object through untouched)
- one `open_world_candidate_dispositions` row (`disposition_code:
  'UNGOVERNED_UNREVIEWED'`)

All four rows for one entry share the resolver's own `closure_id` (already
minted at compile time by `candidate-proposal-compiler.js`), reused as the
join key rather than re-derived.

`open_world_primitives` stays genuinely empty from this path -- it is a
QXO-specific decomposition (`shared-serving-row.js`'s "legal primitives", TIME
etc.) that a general native-producer open-world entry does not have and
decision 2 does not ask for.

A single entry whose evidence fails to shift (byte mismatch, out-of-bounds,
etc.) becomes a residual (`OPEN_WORLD_EVIDENCE_COORDINATE_SHIFT_FAILED`) and
is excluded -- it does not abort the run or touch any other entry, mirroring
the "fail closed, typed, never a silent drop" discipline this module already
applies to governed claims.

## Two open-world grammars, not one relaxed into the other

`validate-write-set.js` already had a complete, rigorous open-world closure
validator (`openWorldGraphResiduals`) built for the QXO F16-F26 certification
chain: `NOVEL_CONCEPT_CANDIDATE/V1`, `market_authority`, a mandatory
`SharedServingRow` terminal row (`REVIEWED_SOURCE_SPECIFIC` or
`INCOMPLETE_CANONICAL_RESULT`), semantic-impact closures tied to a canonical
market result. That machinery is real, tested by ~70 files, and per
DECISIONS.md decision 13 is **not extended to any other family**.

Matching that grammar for 244 general open-world entries across 25 families
would mean building canonical-result linkage and market-authority semantics
those families have no canonical result to link to -- decision 2 asks only
that a fact be written and flagged as ungoverned, not certified against a
market observation.

So this is a **second, deliberately lighter grammar**
(`NATIVE_OPEN_WORLD_CANDIDATE/V1`), dispatched inside the same
`openWorldGraphResiduals` loop by the candidate row's own `schema_version` --
not by `write_set_origin`, so a closure's shape is self-describing even
inspected apart from the write set it arrived in. The QXO branch's code is
untouched, still the same function, same tests, same behaviour. The new
branch (`nativeOpenWorldClosureResiduals`) requires: exactly one candidate,
one occurrence, one disposition, at least one evidence reference, the
`open_world_primitives`/`semantic_impact_closures`/`reviewed_source_specific_rows`/
`incomplete_canonical_result_rows` collections empty for that closure, every
row's `evidence_governance` present and correct, and every id
content-address-verified.

## Where it is read (serving boundary)

New file `lib/canonical-v2/open-world-evidence-serving.js`:

- `assertOpenWorldRowGovernance(row, label)` / `assertGovernedRowHasNoOpenWorldMarker(row, label)`
  -- read only `row.evidence_governance`, nothing about which table or
  collection the row came from.
- `buildOpenWorldEvidenceCard({ candidate, occurrence, evidenceReferences })`
  -- builds a card from the **DB row shapes**, not from
  `resolution.open_world` JSON, with `governance` and `is_governed_claim:
  false` on the card, a `display_label` that says "ungoverned" in the label
  text.
- `buildGovernedClaimSummaryCard(claimRow)` -- the governed counterpart;
  throws if the row carries the marker.

Existing per-family product-projection modules
(`termination-product-projection.js`, `representations-product-projection.js`,
`material-contracts-product-projection.js`,
`general-covenants-product-projection.js`, `employee-dno-product-projection.js`,
`remedies-misc-product-projection.js`, `key-terms-mae-product-projection.js`,
`consideration-ioc-evidence-product-projection.js`,
`proxy-meeting-product-projection.js`, `financing-guaranty-product-projection.js`,
`tax-dividends-appraisal-product-projection.js`, `antitrust-product-projection.js`)
already consume `resolution.open_world` (the in-memory JSON) and already tag
cards `EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE'`, distinct from
governed claims, several with an `UNGOVERNED_CLAIM` fail-fast guard on the
governed path. Those were already honouring the marker at the JSON layer.
What was missing -- and what this task closes -- is the **database row**
layer: nothing previously read a DB-shaped open-world row at all, because
nothing wrote one. `open-world-evidence-serving.js` is that missing link,
proven against the actual row shapes the adapter now writes.

## Per-family counts (write boundary, real committed evidence)

Verified against every one of the 28 importable, committed run directories
under `evidence/canonical-v2/` (`*-20260806/07-replay` and `-live`), not a
sample: `run-receipt.json` and `resolution.json` loaded as-is, the run's own
already-committed `admitted_source_context`
(`adapter-result.json.admitted_source_contexts[0]`, content-addressed, so
reusing it is not fabricating a lineage) fed straight into
`buildNativeWriteSet`. Verification script (not committed, scratchpad-only):
loads each directory, calls the real adapter, compares
`resolution.open_world.length` against `write_set.open_world_candidates.length`.

| Family (deal) | `resolution.open_world` entries | rows written | match |
|---|---|---|---|
| GENERAL_COVENANTS (modiv) | 1 | 1 | yes |
| TAX_MATTERS (modiv) | 6 | 6 | yes |
| REPRESENTATIONS (modiv) | 18 | 18 | yes |
| KEY_DEFINED_TERMS (modiv) | 15 | 15 | yes |
| DIVIDENDS (modiv) | 3 | 3 | yes |
| EMPLOYEE_MATTERS (modiv) | 3 | 3 | yes |
| FINANCING_COVENANTS (modiv) | 2 | 2 | yes |

That is 7 of the 25 registered families (the acceptance criterion asked for
3). Extended to **all 28 importable run directories** (every family with a
committed, importable run, including the ones that publish governed claims
too): **244 open-world entries in, 244 rows written, zero errors, zero
coordinate-shift residuals, every row carrying the marker.** 244 is exactly
PLAN.md's stated regenerated-baseline open-world total, which is itself a
useful cross-check that nothing was double-counted or dropped.

## Tests

**Write boundary** --
`tests/canonical-v2-open-world-write-boundary.test.js` (4 tests, real
`runNativeExtraction` + hand-assembled governed and open-world proposals from
the same provider call, real `buildNativeWriteSet`, real
`validateResolvedCanonicalWriteSet`):

1. an open-world entry produces four marked rows with zero residuals,
   alongside a clean governed claim that carries no such field at all;
2. both the governed claim and the open-world entry publish in the SAME
   accepted write, distinguishable only by the marker;
3. a claim row hand-tampered to carry the open-world marker is quarantined
   (`CANONICAL_IDENTITY_MISMATCH`), not published -- the write itself is not
   aborted, only the tampered object;
4. an open-world entry with unshiftable evidence is isolated to its own
   residual, the unrelated governed claim in the same run is unaffected.

**Serving boundary** --
`tests/canonical-v2-open-world-serving-boundary.test.js` (3 tests, against the
DB row shapes the adapter actually writes, not `resolution.open_world`):

1. the marker alone, with no table/collection context, tells a reader what a
   row is;
2. a card built from open-world DB rows announces itself as ungoverned on the
   card (`governance`, `is_governed_claim: false`, a `display_label`
   containing "ungoverned"), structurally distinct (different
   `schema_version`, no `governance` field) from a governed claim's card;
3. each card constructor refuses the other kind of row, including a
   hand-tampered claim row -- independent, defence-in-depth check at the
   serving side, not reliant solely on the write-boundary catch.

## Commands run and their exit codes

```
CI=true node --test tests/canonical-v2-open-world-write-boundary.test.js       # EXIT=0, 4/4 pass
CI=true node --test tests/canonical-v2-open-world-serving-boundary.test.js     # EXIT=0, 3/3 pass
CI=true node --test tests/canonical-v2-native-write-set-adapter.test.js        # EXIT=0, 18/18 pass
CI=true node --test tests/canonical-v2-deal-scope-writer.test.js \
  tests/canonical-v2-candidate-resolution.test.js \
  tests/canonical-v2-component-rows.test.js \
  tests/canonical-v2-provenance-tags.test.js \
  tests/canonical-v2-incomplete-candidate-release.test.js \
  tests/canonical-v2-incomplete-canonical-writer.test.js \
  tests/canonical-v2-reviewed-source-specific.test.js \
  tests/canonical-v2-canonical-writer.test.js \
  tests/canonical-v2-qxo-capitalisation-f28-writer-link.test.js \
  tests/canonical-v2-qxo-material-contracts-slice.test.js \
  tests/canonical-v2-staging-qxo-material-contracts-runner.test.js           # 123/124 pass -- see below
CI=true node --test tests/canonical-v2-termination-fee-resolution.test.js \
  tests/canonical-v2-termination-real-fixture-replay.test.js \
  tests/canonical-v2-termination-wave-b.test.js \
  tests/canonical-v2-no-shop-resolution.test.js \
  tests/canonical-v2-no-shop-wave-b.test.js \
  tests/canonical-v2-modiv-replay.test.js \
  tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js \
  tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js \
  tests/canonical-v2-modiv-no-other-reps-answer-provenance-replay.test.js \
  tests/canonical-v2-f28-second-live-fixture-replay.test.js \
  tests/canonical-v2-m3-live-checkpoint-replay.test.js \
  tests/canonical-v2-m3-iteration-2-rerun-planner.test.js \
  tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js \
  tests/canonical-v2-m3-topbuild-ioc-sibling-citation-replay.test.js \
  tests/canonical-v2-p1-captable-numerics-resolution.test.js \
  tests/canonical-v2-consideration-wave-a.test.js \
  tests/canonical-v2-consideration-ioc-real-replay.test.js \
  tests/canonical-v2-sole-remedy-resolution.test.js                          # EXIT=0, 205/205 pass
CI=true node --test tests/canonical-v2-m3-certification-control.test.js \
  tests/canonical-v2-m3-certification-control-v2.test.js \
  tests/programme-gates/m3-family-parity-register.spec.js \
  tests/canonical-v2-review-preview-end-to-end.test.js \
  tests/canonical-v2-general-covenants-dark-bridge.test.js \
  tests/canonical-v2-representations-dark-bridge.test.js \
  tests/canonical-v2-no-other-reps-fraud-dark-bridge.test.js \
  tests/canonical-v2-legacy-card-bridge.test.js \
  tests/canonical-v2-general-covenants-family-parity.test.js \
  tests/canonical-v2-material-contracts-family-parity.test.js \
  tests/canonical-v2-proxy-meeting-product-parity.test.js \
  tests/termination-fee-card-selection.test.js \
  tests/process-intelligence-storylines-baseline.test.js                     # EXIT=0, 184/184 pass
CI=true node --test tests/canonical-v2-deal-extraction-write-set.test.js \
  tests/canonical-v2-structural-provision-instance.test.js \
  tests/canonical-v2-semantic-safety-preflight.test.js \
  tests/canonical-v2-recorded-provider-response-replay.test.js \
  tests/canonical-v2-native-provider.test.js \
  tests/canonical-v2-native-family-adapter-contract.test.js \
  tests/canonical-v2-native-provider-family-dispatch.test.js                 # EXIT=0, 57/57 pass
bash scripts/lint/forbidden-patterns.sh                                       # EXIT=0, INVARIANT-4: PASS
```

**The one pre-existing failure**:
`tests/canonical-v2-deal-scope-sql-writer.test.js`, "the governed schema
digest pins the authoritative deal-scope writer" -- pins a SHA-256 of the
whole `supabase/canonical-v2-foundation.sql` file. That file has 206 lines of
**uncommitted, in-flight local changes from another concurrent session**
(`git status`: `M supabase/canonical-v2-foundation.sql`, last commit
`a8da3989` "feat: the SQL writer learns that a provision can have no party" --
not this task's work, and this task's ground rules explicitly forbid editing
that file or `public.canonical_v2_write`). Confirmed unrelated: this task
never touches that file, and the failure is a stale digest pin against
someone else's in-progress SQL edit, not a defect this change introduced.

## What was found, not fixed here

- The QXO F16-F26 open-world grammar and the general one now coexist in the
  same validator function, discriminated by `schema_version` on the
  candidate row. If a THIRD grammar is ever needed, extend the same
  dispatch rather than adding a third parallel closure walk.
- `EMPTY_COLLECTION_KEYS` in `native-write-set-adapter.js` initially dropped
  `open_world_primitives` by mistake when the other four open-world keys
  were removed from it -- caught by `assertResolvedWriteSetShape`'s exact-key
  check on the very first write-boundary test run (`DEAL_SCOPE_RUN writeSet
  fields do not match the reference-only contract`), not by inspection.
  Fixed by keeping `open_world_primitives` in the empty set with a comment
  explaining why (it is QXO-specific decomposition this grammar does not
  produce).
- `buildProvisionInstance` (source-structure.js) does not mint its own
  `closure_id` -- the real resolver adds one when building
  `resolution.provisions`. Test fixtures that hand-build a provision (rather
  than going through `resolveCandidates`) must add one themselves, or
  `assertStructuralRowShape` rejects the row. Not a defect; recorded because
  it cost a debugging pass.
