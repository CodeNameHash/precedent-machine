# P1 — Cap-table numeric promotions (C1+C9, C8+C11)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit returned AMEND (4
critical, 6 material); all amendments folded in below.
**Parent:** `2026-08-02-openworld-promotion-program.md` (slice P1).
**Authority:** Ben's PROMOTE rulings on C1+C9 and C8+C11
(`docs/acks/OPEN-WORLD-ADJUDICATION-2026-08-02.md`).

## Deliverable

The share-count and reserved-pool assertions currently banked as
open-world candidates become governed, resolvable, PUBLISHABLE claims.

**Conversion semantics, corrected (audit C-1 — the original framing
was unsatisfiable).** The fixture cluster members are UNMAPPED
limb-assertion rows (`UNMAPPED_GENERIC_CLAIM_KEY` /
`NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE`), not OPEN_WORLD
proposal_kind rows; their closure_ids can NEVER convert (new typed
proposals mint new content-addressed ids), and the flagship quotes
are compound ("250,000,000 … of which 28,142,327 …") and must ABSTAIN
under the parser's own one-number rule. The deliverable is therefore a
**COVERAGE MAP**, pinned in the acceptance tests: for each pinned
source closure_id in C1/C9/C8/C11, hand-enumerate the expected SPLIT
sub-quotes — each byte-verified as a contiguous substring of BOTH the
committed canonical text AND the parent fixture quote — and assert (a)
each sub-quote resolves with the exact value/kind/class, (b) the
parent compound quote ABSTAINs `MULTIPLE_NUMERIC_LITERALS`, (c) the
original limb-assertion rows REMAIN open_world (they are structure,
not share-count claims). "Conversion achieved" may only be claimed
after the dated post-merge live rerun handoffs — no report before then
may state it (audit M-5).

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

Zero-case pin, keyed BY count_kind (audit C-3 — the RESERVED-only
rule contradicted the fixtures' real zeros): the zero-pattern list is
a frozen, versioned table keyed by count_kind —
`ISSUED_OUTSTANDING` ↔ "none of which were outstanding" / "no X were
issued and outstanding"; `TREASURY` ↔ "held … as treasury";
`RESERVED` ↔ "no X reserved for issuance". A quoted zero resolves to
`canonical_value: '0'` ONLY when the matched pattern's kind equals the
producer's `count_kind`; mismatch → typed ABSTAIN
`ZERO_PATTERN_KIND_MISMATCH` → review (this closes the corruption path
where the model learns RESERVED unlocks zeros and mislabels an
outstanding zero). M3 rule 1 is not implicated — a quoted "none
outstanding" is a PRESENT claim quoting a positive sentence; silence
remains the scope-closure machinery's job, forever.

**count_kind is enforced, not suggested (audit C-4):** the enum lives
as a frozen resolver/parser constant (the registry's fixture-shape
validator rejects extra definition fields, so it cannot live there). A
frozen count_kind↔quote corroboration table binds label to text: the
byte-verified quote must match the kind's corroboration pattern
(RESERVED `/reserv/i`; TREASURY `/treasury/i`; ISSUED_OUTSTANDING
`/outstanding|issued/i`; AUTHORIZED `/authorized|consists of/i`;
OUTSTANDING_AWARDS `/issuable|option|RSU|PSU|award/i`); mismatch →
review, typed `COUNT_KIND_UNCORROBORATED` — a wrong-but-in-enum label
must never publish a number under the wrong kind. Out-of-enum
count_kind routes to open world by an EXPLICIT `pushOpenWorld` with a
typed reason in the handler (the main loop's open-world routing keys
on proposal_kind and will not catch it).

**Attribute identity pin (audit minor):** share_class_ref, count_kind
and plan_ref participate in claim identity/closure so two same-section
counts for different classes never collide or dedupe.

**Attribute verbatim-ness enforced (audit M-3):** the handler requires
`share_class_ref` (and `plan_ref` when RESERVED) to be a verbatim
substring of the byte-verified quote; failure → review, typed
`SHARE_CLASS_REF_NOT_IN_QUOTE` / `RESERVED_POOL_PLAN_UNIDENTIFIED`.
Nothing downstream chokes on free text (verified: write-set attributes
are schema-free except answer_provenance; the lexical net keys on
concept_key) — cross-deal canonicalization stays deferred to Ben.

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
- The quote must contain EXACTLY ONE candidate number after the
  PINNED EXCLUSIONS (audit C-2/M-4 — the original class/plan+section
  list left every real fixture quote in permanent ABSTAIN):
  1. numbers inside the verbatim `share_class_ref`/`plan_ref` spans
     (which M-3 guarantees are real substrings — covers "$0.01 par
     value" inside a class phrase);
  2. section references, with an LTR-mark-tolerant grammar (the F28
     bytes contain U+200E between "Section" and the number — the
     grammar must match the LITERAL committed fixture bytes, and the
     tests run on those bytes, never retyped ASCII);
  3. calendar dates (reuse `CALENDAR_DATE_PATTERN` from
     measurement-date-parse.js);
  4. currency-prefixed literals (`[$€£]` optionally followed by
     whitespace);
  5. clock times ("5:00 p.m." class).
  The extraction tokenizer is itself pinned: candidate tokens are
  maximal digit-comma-dot runs bounded by non-[0-9,.] characters,
  classified against the exclusions in the order above. Two or more
  survivors → ABSTAIN `MULTIPLE_NUMERIC_LITERALS` (routes to review;
  compound sentences are TWO claims and the producer prompt is
  responsible for splitting — the parser never picks). Zero
  survivors and no zero-pattern match → ABSTAIN `NO_NUMERIC_LITERAL`.
- Spelled-out numbers ("ten million") → ABSTAIN `NON_LITERAL_NUMERAL`.
  Zero-case: per the count_kind-keyed zero table in section 1
  (`ZERO_PATTERN_KIND_MISMATCH` on mismatch); the table lives in the
  module, versioned as `SHARE_COUNT_PARSE_VERSION`, threaded into the
  resolution receipt (audit M-6).
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

- ONE resolution-table entry (audit M-2 — `RESOLUTION_UNCONDITIONAL`
  is a Map keyed on generic_claim_key alone; two entries would silently
  last-win):
  `(NATIVE_CAPITALISATION_SHARE_COUNT_CANDIDATE) → REP-T-CAP`, with
  the DEFINITION split (`CAPITALIZATION_SHARE_COUNT` vs
  `RESERVED_SHARE_POOL`) made inside the dedicated handler on
  `attributes.count_kind`. A table-validation test asserts no
  duplicate generic keys. `MAPPING_TABLE_VERSION` 3 → 4.
- Dedicated handler (the TEMPORAL/measurement-date pattern):
  corroboration check (C-4) → attribute verbatim checks (M-3) →
  `share-count-parse.js` → definition split → gates. ABSTAIN outcomes
  route to review with the parser's typed reason; RESOLVED values
  still pass `canonicalValueAllowed` (a parser bug must not bypass the
  gate). Out-of-enum count_kind → explicit `pushOpenWorld`, typed
  reason.
- Materiality: new tier `CAPITAL_STRUCTURE`, rank **52** (audit minor:
  50 collides with NO_SHOP_EXCEPTIONS' existing rank). Implemented as
  a definition-key override map consulted before prefix match;
  `materialityFor`'s signature extends to
  `{conceptKey, canonicalValue, claimDefinitionKey}` — the two
  resolved-path call sites have the definition key in scope; the five
  mapping-null call sites stay concept-based (pinned so an implementer
  doesn't refactor them). Flagged for Ben in the PR body.
- Resolution receipt: `share_count_parse_version` and the zero-table
  version thread into `receiptBody` (audit M-6), alongside the bumped
  `mapping_table_version` and V14 `contract_vocabulary_digest`.
- Additivity pin, restated honestly (audit M-1 — "byte-identical
  receipt id" is impossible once the versions bump): with no
  share-count input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under V14),
  the new parser-version fields, and the recomputed
  `resolution_receipt_id`; the re-pin is documented in the PR with a
  field-level diff. Skipping the version bump to keep old pins green
  is the named anti-pattern this clause exists to prevent.
- Lexical net lexicon: NO change — REP-T-CAP is already the covered
  family; the promoted claims inherit its coverage.

## 5. Acceptance tests

1. Parser: table-driven over the COVERAGE MAP's hand-enumerated split
   sub-quotes AND the parent compound quotes (parents ABSTAIN
   `MULTIPLE_NUMERIC_LITERALS`), run on the LITERAL committed fixture
   bytes (LTR marks included); every exclusion class exercised (date,
   currency, time, section ref, class-phrase numbers); strict-grouping
   rejects; `NO_NUMERIC_LITERAL`; `NON_LITERAL_NUMERAL`; the
   count_kind-keyed zero table: every fixture zero (F28 preferred
   "none of which were outstanding" = ISSUED_OUTSTANDING, Skechers
   treasury zero = TREASURY, Modiv reserved zero = RESERVED) resolves
   under its correct kind, `ZERO_PATTERN_KIND_MISMATCH` on cross-kind,
   and near-misses ("no obligation to reserve") do NOT resolve.
2. Registry: V14 compiles; V13 arrays untouched byte-for-byte; both
   definitions validate with zero validator changes.
3. Resolution: synthetic compiled candidates carrying the coverage
   map's sub-quotes (each asserted to be a substring of BOTH the
   committed canonical text and its parent fixture quote — the honesty
   pin from audit M-5) resolve end-to-end: correct definition split by
   count_kind, exact canonical values, corroboration failures typed
   `COUNT_KIND_UNCORROBORATED`, attribute-verbatim failures typed,
   materiality rank 52, review routing for every ABSTAIN class, and
   the restated additivity pin (field-level diff documented).
4. Write-path: resolved share-count claim with an ITEM attachment
   travels adapter → validation → publishableWriteSet via the
   component-rows machinery.
5. Identity: two same-section counts differing only in
   share_class_ref/count_kind mint distinct, stable claim identities.
6. Full suite + build + forbidden-patterns; phase allowlist for the
   slice's files.

## Out of scope

Cross-deal share-class canonicalization (Ben adjudication over
observed `share_class_ref` values, later); the live re-extraction runs
(each documented as its own dated handoff when run; until they land,
NO report may claim C1/C8/C9/C11 conversion — audit M-5); C2/C7/C10/C12/C15
(P3); any qualifier-kind work (P2); FAMILY_MAPPING_TABLE extension for
the new v1 subtypes (separate Fable+Ben table edit with the wiring
slice).
