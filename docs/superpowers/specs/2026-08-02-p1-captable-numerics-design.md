# P1 — Cap-table numeric promotions (C1+C9, C8+C11)

**Date:** 2026-08-02. **Status:** DRAFT — pending adversarial audit.
**Parent:** `2026-08-02-openworld-promotion-program.md` (slice P1).
**Authority:** Ben's PROMOTE rulings on C1+C9 and C8+C11
(`docs/acks/OPEN-WORLD-ADJUDICATION-2026-08-02.md`).

## Deliverable

The share-count and reserved-pool assertions currently banked as
open-world candidates become governed, resolvable, PUBLISHABLE claims.
Exact conversion targets (pinned; the acceptance tests assert these
closure_ids by name): every fixture candidate in commonality clusters
C1, C9, C8, C11 across the three committed live runs.

## 1. Registry (`contract-bundle.js` → V14)

Strictly additive spread of V13. New concepts: none — C1/C8 live under
the existing `REP-T-CAP`. New claim definitions:

```
CAPITALIZATION_SHARE_COUNT_CLAIM_DEFINITION_V1
  claim_definition_key: 'CAPITALIZATION_SHARE_COUNT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true

RESERVED_SHARE_POOL_CLAIM_DEFINITION_V1
  claim_definition_key: 'RESERVED_SHARE_POOL'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'
  canonical_value_required_when_present: true
```

Class and pool identity travel as GOVERNED ATTRIBUTES on the claim,
never in the key (one definition, class-dimensioned — the measurement-
date precedent):

- `share_class_ref`: the verbatim class phrase from the quote
  ("Company Class A Common Stock", "Class C Common Shares",
  "preferred stock, par value $0.01 per share"). No normalization
  table this slice — cross-deal class canonicalization is a Ben
  adjudication over observed values later, not an implementer guess
  now.
- `count_kind`: enum `AUTHORIZED | ISSUED_OUTSTANDING | RESERVED |
  TREASURY | OUTSTANDING_AWARDS` — the five count kinds observed in
  the three fixtures. Anything else the model proposes is open-world
  still (the enum is a gate, not a suggestion).
- `RESERVED_SHARE_POOL` additionally: `plan_ref` (verbatim plan
  phrase, e.g. "the Company ESPP") — required; a reserved-pool claim
  with no identifiable plan routes to review, typed
  `RESERVED_POOL_PLAN_UNIDENTIFIED`, never resolves with an empty ref.

Zero-case pin (C8 includes Modiv's "no … Shares reserved for
issuance"): a QUOTED zero is `canonical_value: '0'` with the same
shape. M3 rule 1 is not implicated — the producer is not asserting a
derived negative; it is quoting a positive sentence that states zero.
The spec says this explicitly so no auditor re-litigates it: quoted
"no shares reserved" = PRESENT claim, value 0; silence about reserves
= nothing, forever the scope-closure machinery's job.

## 2. Numeric parser: `share-count-parse.js`

New pure module, `measurement-date-parse.js`'s contract shape: typed
`{outcome:'RESOLVED', canonical_value, matched_text}` or
`{outcome:'ABSTAIN', reason}` — never a throw on prose, never
arithmetic.

- RESOLVES: a literal digit-group number in the byte-verified quote —
  `250,000,000` / `10,323,670` / `1,600,514.5` (comma-grouped,
  optional single decimal point). Grouping must be STRICT 3-digit
  (`^\d{1,3}(,\d{3})*(\.\d+)?$` after extraction): `1,23,456` ABSTAINS
  (`MALFORMED_GROUPING`), it does not "repair".
- The quote must contain EXACTLY ONE candidate number after excluding
  numbers inside the matched class/plan phrases and section
  references; two or more → ABSTAIN `MULTIPLE_NUMERIC_LITERALS`
  (routes to review; a compound sentence like "250,000,000 Company
  Shares, of which 28,142,327 were outstanding" is TWO claims and the
  producer prompt is responsible for splitting them — the parser never
  picks).
- Spelled-out numbers ("ten million") → ABSTAIN
  `NON_LITERAL_NUMERAL`. Zero-case: the words "no"/"none" resolve to
  `'0'` ONLY when the producer emitted `count_kind: RESERVED` and the
  quote matches a pinned zero-pattern list ("no X reserved",
  "none of which were outstanding" class) — pinned in the module,
  versioned, same governance as every other lexicon.
- Canonical form pin: strip grouping commas, preserve any decimal
  as-written, no trailing-zero trimming (`'28142327'`,
  `'1600514.5'`) — must round-trip `canonicalValueAllowed`'s
  `NON_NEGATIVE_DECIMAL_STRING` regex.

## 3. Producer prompt + provider (PROMPT_VERSION bump)

- `capitalisation-producer-prompt.js`: the response shape gains a
  `share_count_assertions` array (section_reference, count_kind,
  share_class phrase, plan phrase when RESERVED, verbatim quote,
  limb_path). The PRESERVE-THE-NOVEL instruction is UNCHANGED;
  the prompt's new text explicitly says "when unsure of count_kind,
  keep it in open_world_candidates" — promotion narrows novelty, never
  forces fit.
- `anthropic-provider.js`: new generic key
  `NATIVE_CAPITALISATION_SHARE_COUNT_CANDIDATE`, proposal_kind
  `SHARE_COUNT` (≠ OPEN_WORLD), shaped from that array. Quote
  byte-verification identical to existing proposals.
- Golden evals: the three recorded responses are reshaped ONLY by
  re-running extraction live once per deal (subscription CLI) after
  the prompt change — recorded-response fixtures are never hand-edited
  to pretend the old runs emitted the new shape. Until those runs
  happen, acceptance tests drive the resolver/registry layers with
  synthetic compiled candidates pinned to the REAL quotes from the
  existing fixtures (quotes byte-verified against the committed
  canonical text), clearly labeled as the pre-rerun harness.

## 4. Resolver wiring (`candidate-resolution.js`)

- `GENERIC_CLAIM_KEY_RESOLUTION_TABLE` + entries (unconditional path,
  no kind/attachment dimension):
  `(NATIVE_CAPITALISATION_SHARE_COUNT_CANDIDATE) →
  CAPITALIZATION_SHARE_COUNT / REP-T-CAP` with count_kind=RESERVED
  splitting to `RESERVED_SHARE_POOL`. `MAPPING_TABLE_VERSION` 3 → 4.
- Canonical value derived via `share-count-parse.js` in a dedicated
  handler (the TEMPORAL/measurement-date pattern): ABSTAIN outcomes
  route to review with the parser's typed reason in `triage.reasons`;
  RESOLVED values still pass `canonicalValueAllowed` (belt and
  braces — a parser bug must not bypass the gate).
- Materiality: new `MATERIALITY_TABLE` tier
  `{rank: 50, label: 'CAPITAL_STRUCTURE', concept_key_prefixes: []}` —
  applied by exact claim-definition match for these two definitions
  (REP-T-CAP prefix already routes to REPRESENTATIONS at 55; the tier
  assignment must therefore key on definition, not concept prefix —
  implement as a definition-key override map consulted before prefix
  match). Flagged for Ben in the PR body, same convention as the
  REPRESENTATIONS tier's own flag.
- Lexical net lexicon: NO change — REP-T-CAP is already the covered
  family; the promoted claims inherit its coverage.

## 5. Acceptance tests

1. Parser: table-driven over every C1/C8/C9/C11 fixture quote
   (hand-enumerated expected values — reviewer re-verifies against
   fixture text); strict-grouping rejects; MULTIPLE_NUMERIC_LITERALS;
   NON_LITERAL_NUMERAL; zero-pattern list hits and near-misses
   ("no obligation to reserve" must NOT resolve).
2. Registry: V14 compiles; V13 arrays untouched byte-for-byte;
   both definitions validate under the existing fixture-shape
   validator with zero validator changes.
3. Resolution: synthetic compiled candidates carrying the real fixture
   quotes resolve end-to-end — correct definition split by count_kind,
   canonical values exact, materiality rank 50, review routing for
   every ABSTAIN class, additivity (no share-count input → all
   existing pins byte-identical, incl. the no-input
   resolution_receipt_id).
4. Write-path: resolved share-count claim with an ITEM attachment
   travels adapter → validation → publishableWriteSet using the
   component-rows machinery (the F28 acceptance-3 pattern), proving
   the publish claim in the program spec is real.
5. Full suite + build + forbidden-patterns (`field_path`-class
   fingerprints: the new tests must not carry raw payload shapes).

## Out of scope

Cross-deal share-class canonicalization (Ben adjudication over
observed `share_class_ref` values, later); the live re-extraction runs
(each documented as its own dated handoff when run); C2/C7/C10/C12/C15
(P3); any qualifier-kind work (P2); FAMILY_MAPPING_TABLE extension for
the new v1 subtypes (separate Fable+Ben table edit with the wiring
slice).
