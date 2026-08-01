# V1↔V2 comparator net (auto-pass condition 1 of 2)

**Date:** 2026-08-01. **Status:** amended after Fable adversarial audit (2026-08-01); ONE OPEN
DECISION for Ben — the condition-1 satisfaction rule (see "The open
protocol question" below). Everything else is settled.
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
`V2_NOT_ATTEMPTED` (v1 has a family/section OUTSIDE the run's declared
extraction scope — informational only, never a gate input; the run's
attempted section list is therefore a comparator input; audit C2),
`V2_MISSING` (v1 has a family/section INSIDE the attempted scope that v2
did not extract — the real recall signal, reported on the receipt like
COVERAGE_SUSPECT), `SECTION_MISMATCH` (both found the family, different
places — the dangerous one; always review), `V1_CARD_UNMAPPED` (null or
unmapped `provision_subtype` — typed, counted, never silently excluded;
audit M5).

**Sibling-effect rule (audit C2):** `V2_MISSING` and `V2_NOT_ATTEMPTED`
attach to the RECEIPT, never to other claims' triage — a recall gap in
section X is a run-level finding, not evidence against a claim in
section Y. Only a provision's OWN Tier-1/Tier-2 outcome enters its
claims' gate flow. `V2_MISSING_SIBLING` from the draft is DELETED.

**Section-string pinning (audit M1):** the v2 comparison string is the
candidate-level `citation_validation.normalized_citation` when
`validation_source: CORROBORATED_BY_DOCUMENT_TEXT`, else the
`derived_citation`; per-provision aggregation takes the majority string
across the provision's candidates and routes ties to `SECTION_MISMATCH`
review. The v1 side parses `section_ref` as the text before the first
`" | "` delimiter, trimmed, with an optional leading "Section " stripped,
case-preserved; a ref that does not parse is `V1_CARD_UNMAPPED`.

**Quote fallback is ADVISORY-ONLY this slice (audit M2):** v1 quotes
passed through the lossy v1 chain and their match rate against v2's
faithful canonical text is unmeasured; the fallback therefore records a
`quote_probe` result on the receipt for measurement but never rescues or
overrides the section-string comparison. Promotion to a load-bearing
OR-branch requires a measured match rate on real pairs and a
comparison-only normaliser extension, both Ben-reviewed. The v2
canonical text is accordingly an explicit comparator input.

### Tier 2 — VALUE agreement (only where both sides carry values)

Keyed by an explicit frozen table mapping v1 value fields to v2 claim
definitions (initially the TERMF/NOSOL families where v2 reviewed slices
exist; grows only by table edit, Fable-tier + Ben). Numeric values
compare exactly after canonicalisation (same normalisation the v2 claim
already stores); no tolerance bands without Ben's explicit ruling per
field. Outcomes: `V1V2_VALUE_AGREEMENT`, `VALUE_MISMATCH` (always
review, both sides' values in the receipt), `V1_VALUE_ABSENT`.

### What the net certifies — the honest contract (audit-amended)

Agreement certifies CONSISTENCY between two machine extractions, not
correctness: the pipelines are independent on the text-processing axis
(lossy v1 text vs faithful canonical text — they cannot share conversion
artifacts) but not on the model-family axis, so a shared misreading of
the same drafted quirk passes both (audit M3). The ledger's own rule
stands: agreement never makes v1 canonical authority.

Auto-pass condition 1 is satisfied for a claim ONLY when Tier 1 presence
agreement holds for its provision AND Tier 2 APPLIES AND AGREES for its
claim definition.

**THE OPEN PROTOCOL QUESTION (Ben — audit finding C1, the one decision
this spec does not make):** for claims whose value v1 cannot see (all
rep-family claims today), the original draft satisfied condition 1 on
Tier-1 presence plus a typed `VALUE_TIER_INAPPLICABLE`. The audit showed
that quietly rewrites the M3 protocol: "agree on the material legal
value" becomes "agree a universal provision exists" — a gate that cannot
fail for exactly the claims v2 publishes, since REP-T-CAP is a universal
provision. Options:
  (A) AUDIT POSITION, and this spec's default: condition 1 stays
      unevaluated for value-invisible claims — a typed
      `V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM` remains in
      `unevaluated_conditions` and keeps blocking auto-pass, per the
      protocol's own "material proposition with no v1 counterpart → Ben
      review" clause. Consequence: rep-family claims keep queuing until
      value-level verification exists for them; revisit when the
      lexical net (condition 2) lands and queue data shows the cost.
  (B) PROTOCOL AMENDMENT, requires Ben's explicit ratification: presence
      agreement suffices for value-invisible claims, on the grounds that
      the value is already mechanically derived from byte-verified
      quotes and the comparator's realistic job is catching misplaced or
      hallucinated provisions.
The default is (A) unless Ben rules (B).

### Wiring

`candidate-resolution.js` accepts an optional `v1v2_comparison` input
(the comparator's receipt). When present: remove
`V1_V2_COMPARATOR_ABSENT` from `unevaluatedConditions` for claims whose
provision has a Tier-1 result (value-invisible claims instead carry
`V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM` under default option A; open-
world entries and provisionless queue items keep the ABSENT condition),
and push the provision's OWN typed reasons (`V1V2_SECTION_MISMATCH`,
`V1V2_VALUE_MISMATCH`) into the same gate-failure flow as every other
structural check — never receipt-level recall outcomes. Absent
the input, behavior is exactly today's — strictly additive. Auto-pass
still requires the lexical-disagreement net (condition 2, separate
slice) before it can ever open.

### Receipts and versions

`V1V2_COMPARISON_RECEIPT/V1`: content-addressed; pins the snapshot id,
the family-mapping and value-mapping table versions (both tables live as
frozen exported constants in the comparator module — the stated
Fable+Ben governance has a location; audit minor), the run's attempted
section scope, per-provision outcomes, and the deal-identity bridge
(production deal UUID ↔ `governed_deal_key`, recorded in the snapshot at
export time; audit minor). The resolution receipt pins the comparison
receipt id when supplied.

**Staleness rule (audit M4):** a comparison receipt is valid for gating
ONLY while the deal's maximum v1 `extraction_version` equals the value
pinned in its snapshot. A v1 reprocess invalidates the receipt: stored
outcomes that gated anything route back through comparison (the same
re-examination pattern as `SOURCE_SUPERSEDED`), never left standing
silently.

## Acceptance

- Real-data fixture test: TopBuild's v1 REP-T-CAP card vs the F28
  third-run v2 output → Tier 1 presence agreement on 3.1(b) (via the
  corroborated normalized_citation, NOT the tree reference), the
  measurement-date claim carrying `V1_V2_COMPARATOR_INAPPLICABLE_TO_
  CLAIM` in unevaluated conditions (default option A), and the deal's
  ~42 other v1 rep cards all `V2_NOT_ATTEMPTED`, zero `V2_MISSING`.
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
