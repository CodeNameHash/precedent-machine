# V1↔V2 comparator net (auto-pass condition 1 of 2)

**Date:** 2026-08-01. **Status:** DRAFT for adversarial review, then Ben.
**Why now:** `candidate-resolution.js` hard-blocks auto-pass on
`V1_V2_COMPARATOR_ABSENT`. This net is one of the two conditions in Ben's
M3 protocol the code cannot yet evaluate. Its absence makes every clean
claim queue for human review — the binding constraint on corpus-scale
economics (see `BREADTH-RUNS-2026-08-01.md`).

## Grounding facts (verified against production, read-only, 2026-08-01)

- v1 `provision_cards` holds REPRESENTATION cards for all three live-run
  deals (43–48 per deal), including `REP-T-CAP` cards whose `section_ref`
  and `primary_quote` match the exact sections v2 extracted (e.g.
  TopBuild "3.1(b) | Capitalization; Subsidiaries", subtype `REP-T-CAP`).
- v1 rep cards carry NO per-claim values (no dates, no codes) — they are
  whole-provision records. v1 DOES carry values for fee/period families
  (TERMF/NOSOL), which v2's reviewed slices also cover.
- Therefore a single "values must agree" comparator is unbuildable today
  for the rep families v2 now publishes. The net must be tiered, and each
  tier must state honestly what it can and cannot certify.

## Design

A pure module, `lib/canonical-v2/native-producer/v1v2-comparator.js`, plus
a read-only extraction script that materialises the v1 side into a pinned
input artifact (the comparator itself never touches the network or DB).

### Inputs

- `v1_snapshot`: `V1_PROVISION_SNAPSHOT/V1` — a content-addressed JSON
  artifact produced by `scripts/export-v1-provision-snapshot.mjs` (new,
  read-only SQL against production): per deal, the provision cards'
  `{provision_type, provision_subtype, section_ref, primary_quote,
  region_hash, extraction_version}`. Pinned per deal like source bytes;
  the snapshot id travels in every comparison receipt.
- `v2_side`: the resolution output + provision/limb trees for the same
  deal (the artifacts the live runs already write).

### Tier 1 — PRESENCE/IDENTITY agreement (available for every family now)

For each v2 provision instance: does v1 have a card with (a) the same
concept family (`provision_subtype` ↔ `concept_key`, via an explicit
frozen mapping table — no fuzzy matching), and (b) a section identity
match: v1 `section_ref`'s leading reference (e.g. "3.1(b)") equals the
v2 citation the pipeline validated, OR the v1 card's `primary_quote`
matches inside the v2 provision span under zero-width-tolerant
comparison. Outcomes per provision, all typed:
`V1V2_PRESENCE_AGREEMENT`, `V1_MISSING` (v2 found what v1 lacks),
`V2_MISSING` (v1 has a family/section v2's run did not extract — a
RECALL signal, reported on the receipt like COVERAGE_SUSPECT),
`SECTION_MISMATCH` (both found the family, different places — the
dangerous one; always review).

### Tier 2 — VALUE agreement (only where both sides carry values)

Keyed by an explicit frozen table mapping v1 value fields to v2 claim
definitions (initially the TERMF/NOSOL families where v2 reviewed slices
exist; grows only by table edit, Fable-tier + Ben). Numeric values
compare exactly after canonicalisation (same normalisation the v2 claim
already stores); no tolerance bands without Ben's explicit ruling per
field. Outcomes: `V1V2_VALUE_AGREEMENT`, `VALUE_MISMATCH` (always
review, both sides' values in the receipt), `V1_VALUE_ABSENT`.

### What the net certifies — the honest contract

Auto-pass condition 1 is satisfied for a claim ONLY when: Tier 1 presence
agreement holds for its provision AND (Tier 2 applies and agrees, OR
Tier 2 is inapplicable to its claim definition — recorded as
`VALUE_TIER_INAPPLICABLE`, never as agreement). A check that cannot run
must never look like a check that passed: `VALUE_TIER_INAPPLICABLE`
travels in the triage data exactly like the existing
`unevaluated_conditions` pattern.

### Wiring

`candidate-resolution.js` accepts an optional `v1v2_comparison` input
(the comparator's receipt). When present: remove
`V1_V2_COMPARATOR_ABSENT` from `unevaluatedConditions` for claims whose
provision has a Tier-1 result, and push typed reasons
(`V1V2_SECTION_MISMATCH`, `V1V2_VALUE_MISMATCH`, `V2_MISSING_SIBLING`)
into the same gate-failure flow as every other structural check. Absent
the input, behavior is exactly today's — strictly additive. Auto-pass
still requires the lexical-disagreement net (condition 2, separate
slice) before it can ever open.

### Receipts and versions

`V1V2_COMPARISON_RECEIPT/V1`: content-addressed; pins the snapshot id,
the family-mapping table version, the value-mapping table version, and
per-provision outcomes. The resolution receipt pins the comparison
receipt id when supplied.

## Acceptance

- Real-data fixture test: TopBuild's v1 REP-T-CAP card vs the F28
  third-run v2 output → Tier 1 presence agreement on 3.1(b), typed
  `VALUE_TIER_INAPPLICABLE` for the measurement-date claim.
- Synthetic: `SECTION_MISMATCH` and `V2_MISSING` route as specified;
  value mismatch on a TERMF fixture blocks and reports both values.
- Determinism: identical inputs, byte-identical receipt; permuted card
  order invariant.
- Strictly additive: absent input, all existing suites byte-identical.
- The snapshot export script runs read-only SQL and refuses to run
  without an explicit `--deal` allowlist argument.

## Out of scope

The lexical-disagreement net (condition 2); any tolerance-band value
comparison; v1 backfill or mutation of any kind; opening auto-pass (both
nets plus Ben's sign-off gate that).
