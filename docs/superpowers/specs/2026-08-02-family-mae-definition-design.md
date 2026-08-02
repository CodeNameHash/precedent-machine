# Family slice — MAE definition and carve-outs (DEF-MAE native promotion)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit
2026-08-02 returned VERDICT AMEND (1 critical, 4 material, 4 minor); all 9
findings folded in below, 0 rebutted. No fail-closed behavior was weakened
in the folding. Next step per the P1 protocol: build → review.
**Parent:** `2026-08-02-openworld-promotion-program.md` (family-slice
extension of the five-layer promotion structure).
**Conventions bound:** `2026-08-02-p1-captable-numerics-design.md` (slice
template), `2026-08-02-lexical-disagreement-net-design.md` (lexicon
authoring), `2026-08-02-family-no-shop-design.md` (sibling family slice —
shared mechanics referenced, never duplicated), EXECUTION-LEDGER M3 review
protocol + extraction semantics rules 1–3 (implemented, never amended,
here).

**Evidence base.** All concepts and patterns below are grounded in the
production corpus (Supabase project `tzulhdasmioeechxapdy`,
`provision_cards`): 68 `DEF-MAE` cards across 37 deals (v1 `provision_type`
`DEFINITION`, subtype `DEF-MAE`; the sibling `COND-B-MAE` closing-condition
cards, 28, are OUT of this slice). Corpus prevalence over the long-form
definition cards — snapshot 2026-08-02, exact filter
`provision_subtype = 'DEF-MAE' AND length(primary_quote) > 2000`, **n = 51**,
phrase patterns as noted (audit M-1: the draft's n = 40 table reproduced
under no query and is replaced by these rerun numbers): terrorism language
(`terroris`, case-insensitive) 49/51, disproportionality carveback
(`disproportionate`) 49/51, GAAP-change language (`GAAP`, case-sensitive)
46/51, "natural disaster" phrase 40/51, pandemic language
(`pandemic|epidemic|disease outbreak`) 39/51, acts-of-war language
(`acts? of war`) 30/51; "Material Adverse Change" as a drafted term:
**0/51** (matters for the lexicon — section 5). The qualitative ranking is
unchanged: terrorism and disproportionality ≈96%, MAC nonexistent. Every
quoted fragment in this spec
is verbatim from a production `primary_quote`; none is invented. At build
time the acceptance fixtures re-pin every quote against LITERAL committed
fixture bytes, never against DB text (section 6).

## Deliverable (honest conversion semantics)

The native producer currently extracts capitalisation (and, when the
sibling slice lands, no-shop). This slice gives the MAE definition family
its own producer path so that MAE-definition assertions arrive as TYPED
proposals instead of open-world candidates: **one new registered concept
(`DEF-MAE`) and three new claim definitions**, because — unlike no-shop —
NOTHING of this family exists in the compiled bundle today
(`EXPECTED_CONCEPT_KEYS_*`, `contract-bundle.js` ~2838, contains no
DEF- concept; the `MATERIALITY_TABLE`'s rank-30 `MAE` tier sits with EMPTY
`concept_key_prefixes`, waiting).

The carve-out enumeration is the substance of this family. A carve-out
claim is an ENUM-SET claim with limb structure: each enumerated exception
clause ("(i) … (xiv)" / "(A) … (J)" / "(a) … (k)" — all three labelling
styles are live in the fixture deals) is a limb carrying one or more
governed carve-out codes, and the disproportionality carveback is a
separate claim that claws back SPECIFIC enumerated clauses, quoted
verbatim.

**What "conversion" honestly means here (P1 audit C-1/M-5, applied
verbatim).** NO recorded native runs exist for this family. There are no
open-world fixture clusters to convert, no closure_ids that could "become"
typed rows. The deliverable is a **COVERAGE MAP built forward, not
backward**: hand-enumerated expected claims for the MAE definition
sections of the three native-fixture deals (F28, Skechers, Modiv — all
three carry full carve-out enumerations with disproportionality carvebacks
in production), each quote byte-verified against committed canonical text,
driven through synthetic compiled candidates in the pre-rerun harness.
**Audit C-1 honesty note on source state:** only Skechers has a committed
full agreement today
(`tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm`);
the committed F28/TopBuild files are section excerpts without the MAE
definition, and no committed file holds the Modiv agreement at all.
Section 6 therefore begins with an explicit source-commitment build step
(test 1a) BEFORE the coverage map can be enumerated — the literal-bytes
rule cannot be satisfied from the current repo state for two of the three
deals, and neither escape hatch (retyping; DB text) is permitted. "The native producer extracts MAE definitions" may only
be claimed after the dated post-merge live rerun handoffs — no report
before then may state it (P1 audit M-5, verbatim).

**The family-defining honesty pin (M3, stated first because everything
downstream obeys it):** the M3 review protocol NEVER auto-passes a nested
or cross-referenced definition, and MAE definitions are the corpus's most
heavily nested definitions — "Company Material Adverse Effect" defined in
an Annex by reference to "Material Adverse Effect", which itself
incorporates "Effect", "COVID-19 Measures", "Company Disclosure Letter"
sections, and party-neutral "any Party" machinery (all real: the Concho
Annex-A card defines the term "when used with respect to any Party" and the
in-section 3.1 card mints "Company Material Adverse Effect" by
parenthetical cross-reference; the Metsera clause (J) carve-out
incorporates "the matters set forth on Section 9.03(a) of the Company
Disclosure Letter" — an EXTERNAL document the pipeline does not hold).
This slice ships **no self-containment prover**, and detection of nesting
is legal judgment, not mechanics. Therefore, fail-closed: **every claim
this family resolves carries a permanent entry
`MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN` in `unevaluated_conditions`**
(the lexical-net slice's `SOURCE_SCOPE_CERTIFICATION_ABSENT` mechanism,
reused exactly). No DEF-MAE claim can present as
auto-pass-eligible-but-for-sampling this slice; `both_nets_clean` may
still compute for queue instrumentation, but the unevaluated-conditions
entry keeps the invariant "empty array = every protocol condition
mechanically evaluated" TRUE. Removing the entry requires a future,
Ben-ratified self-containment machinery — never an implementer judgment
that some particular definition "looks flat". The value of this slice is
typed, structured, corpus-comparable queue items ranked at MAE materiality
— not auto-passes.

## 1. Registry (`contract-bundle.js` → next fixture-contract version)

Strictly additive spread of the current head version (V14 as of this
writing; the version number is taken at build time — sibling family slices
are queued on the same file and the spread composes; never renumber or
edit a landed version).

**New concept:** `DEF-MAE`, version 1 — the v1 subtype key reused verbatim
so the FAMILY_MAPPING_TABLE extension (out of scope here, per P1) is a
rename-free row. One concept, not three: v1's `DEF-MAE-CARVEOUT` /
`DEF-MAE-DISPROP` / `DEF-MAE-CLINICAL` subtypes have ZERO production cards
(verified: the corpus groups only `DEF-MAE` and `COND-B-MAE`) — in
practice v1 puts the whole definition on one card and structures
carve-outs as features. The carve-out / prong / carveback distinctions
live at claim-definition level under the one concept.

**New claim definitions (all enum-valued — no numeric or date machinery in
this family, hence no value parser; section 2):**

```
MAE_CARVEOUT_CLAIM_DEFINITION_V1
  claim_definition_key: 'MAE_CARVEOUT'
  version: 1
  allowed_canonical_values: MAE_CARVEOUT_CODES_V2   // 26 codes, below
  canonical_value_required_when_present: true

MAE_DEFINITION_PRONG_CLAIM_DEFINITION_V1
  claim_definition_key: 'MAE_DEFINITION_PRONG'
  version: 1
  allowed_canonical_values: ['BUSINESS_EFFECTS', 'CONSUMMATION_PREVENTION']
  canonical_value_required_when_present: true

MAE_DISPROPORTIONALITY_CARVEBACK_CLAIM_DEFINITION_V1
  claim_definition_key: 'MAE_DISPROPORTIONALITY_CARVEBACK'
  version: 1
  allowed_canonical_values: [true]      // the GENERAL_MATERIALITY_QUALIFIER shape
  canonical_value_required_when_present: true
```

**`MAE_CARVEOUT_CODES_V2`** is the v1 `MAE_CARVEOUT_META` code list
(`lib/taxonomy.js` 487–596) adopted verbatim **minus `OTHER`** — 26 codes:
`ECONOMY_GENERAL`, `INDUSTRY_GENERAL`, `FINANCIAL_MARKETS`,
`ACTS_OF_WAR_TERRORISM`, `NATURAL_DISASTERS`, `PANDEMIC`,
`ANNOUNCEMENT_OR_PENDENCY`, `COMPLIANCE_WITH_AGREEMENT`,
`ACTIONS_REQUESTED_BY_PARENT`, `CHANGE_IN_LAW`, `CHANGE_IN_GAAP`,
`STOCK_PRICE_CHANGES`, `FAILURE_TO_MEET_PROJECTIONS`, `PRICING_MFN`,
`EXECUTIVE_ACTION`, `TARIFFS`, `GOVERNMENT_SHUTDOWNS`, `CLINICAL_RESULTS`,
`FDA_DISCUSSIONS`, `FDA_APPROVALS_COMPETITOR_ENTRY`, `SUPPLY_CHAIN`,
`PRICING_REIMBURSEMENT`, `MEDICAL_ORGS_STATEMENTS`, `PATENTS_EXCLUSIVITY`,
`PARENT_ACTIONS_OR_INACTION`, `EMPLOYEE_DEPARTURES`.

`OTHER` is deliberately dropped from the governed enum: in a registry
whose out-of-enum path is an explicit `pushOpenWorld` with a typed reason,
`OTHER` is a forcing valve — it lets a genuinely novel carve-out (the live
example: Modiv's clause "(k) any computer hacking, data breaches,
ransomware, cybercrime or cyberterrorism …" has NO code in the v1 list and
v1 could only tag it `OTHER`) publish as an unqueryable bucket instead of
feeding the commonality report toward a real code. Open world IS the typed
`OTHER`. The v1 taxonomy keeps its `OTHER` untouched — this cleanup is
scoped to the v2 registry, the PROMPT_VERSION-4 precedent.

The enum is a frozen bundle constant single-sourced into the prompt module
(export it; if the fixture-shape validator's key discipline forbids the
export, a frozen copy plus a byte-equality test against the compiled
bundle's `allowed_canonical_values` — the no-shop section 3 convention;
drift between prompt vocabulary and registry gate must be loud).

**Governed attributes** (schema-free on the claim's `attributes` object —
P1 verified write-set attributes are schema-free except
`answer_provenance`; NEVER in the key):

- ALL three definitions: `defined_term_ref` — the verbatim defined term
  this claim belongs to ("Company Material Adverse Effect", "Parent
  Material Adverse Effect", "Material Adverse Effect"). REQUIRED,
  verbatim-substring-of-quote enforced (typed
  `DEFINED_TERM_REF_NOT_IN_QUOTE` → review, the P1 M-3 discipline), and
  identity-bearing: Modiv defines Company AND Parent MAE in one
  definitions article, and Metsera defines Company MAE and a
  consummation-only Parent MAE in one Section 9.03 — two same-section
  claims differing only in `defined_term_ref` must never collide or
  dedupe.
- `MAE_CARVEOUT`: `clause_label` — the verbatim enumeration label of the
  carve-out limb ("(i)", "(A)", "(k)"), required, substring-of-quote
  enforced (typed `CLAUSE_LABEL_NOT_IN_QUOTE`); `limb_path` — the ordered
  label array from the definition root, the capitalisation prompt's
  PROMPT_VERSION-2 convention reused verbatim (nested labels are deeper
  path entries, never new instances). `clause_label` and the code
  participate in identity: one clause legitimately carries TWO codes
  (live: Skechers "(vii) earthquakes, hurricanes, tsunamis, tornadoes,
  floods, mudslides, wild fires or other natural disasters, weather
  conditions, epidemics, pandemics or disease outbreaks and other force
  majeure events …" is `NATURAL_DISASTERS` AND `PANDEMIC` — two claims,
  same limb, distinct identities).
- `MAE_DEFINITION_PRONG`: `prong_label` (verbatim, e.g. "(i)", "(a)",
  optional — one-prong definitions have no label), substring-of-quote
  when present.
- `MAE_DISPROPORTIONALITY_CARVEBACK`:
  - `applies_to_clause_labels` — REQUIRED array of verbatim clause labels
    the carveback claws back, each individually a substring of the
    byte-verified quote (live groundings: Skechers "with respect to
    clauses (i), (ii), (vi), (vii) and (xi)"; Metsera "in the case of
    clause (A), (B), (C), (D), (E) or (I)"; Modiv "in the case of the
    foregoing clauses (a), (b), (c), (d), (g) or (k)"). Any element
    failing the substring check → typed
    `CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE` → review. An empty array is
    NOT an error by itself — a carveback drafted without clause
    enumeration ("except to the extent any of the foregoing …") is a real
    form — but empty routes to review typed
    `CARVEBACK_SCOPE_UNENUMERATED`, never resolves silently as
    "applies to everything".
  - `comparison_baseline_phrase` — REQUIRED verbatim comparison class
    ("other companies of a similar size operating in the industries in
    which the Company Group conducts business" — Skechers; "other
    participants in the industries in which the Company and the Company
    Subsidiaries operate" — Metsera; "other similarly situated businesses
    in the industries in which the Company and the Subsidiaries conduct
    their business" — Modiv), substring-of-quote enforced. No
    cross-deal normalization of baselines this slice — a Ben adjudication
    over observed values later, the P1 `share_class_ref` precedent.
  - `incremental_impact_phrase` — OPTIONAL verbatim phrase, present only
    when the drafting counts only the incremental disproportion ("only
    the incremental disproportionate adverse impact may be taken into
    account" — Skechers; "the incremental disproportionate impact or
    impacts may be taken into account" — Metsera). Substring-of-quote
    when present. NEVER asserted absent — its absence from a claim means
    nothing (M3 rule 1; absence of the incremental limitation is a
    derived conclusion the scope-closure machinery may someday make, not
    the producer).

**The carveback→carve-out JOIN is deliberately NOT made this slice.** The
v1 rubric wants per-carveout `hasDisproportionateImpactCarveback` tagging.
Joining `applies_to_clause_labels` ("(vi)") to the carve-out claim
labelled "(vi)" is a deterministic post-pass over limb structure — but it
is correct ONLY when the enumeration parse is proven complete and
label-stable, which is exactly the self-containment machinery this slice
does not build. A wrong silent join mislabels which carve-outs survive
disproportionality — a plausible-but-wrong output of the first order. The
carveback claim carries the verbatim labels; the join is a named future
slice (Out of scope).

**Named seam to verify at build time** (no-shop section 1 convention): the
bundle validator's `assertExact(input.parser_proposal_boundary,
EXPECTED_PROPOSAL_BOUNDARY, …)` (`contract-bundle.js` ~3253). If
`EXPECTED_PROPOSAL_BOUNDARY` enumerates proposal kinds or generic keys,
adding this family's is a validator-constant change called out in the PR;
either way the fixture-shape validator is not loosened. Same for the
version-shape table (`KNOWN_VERSION_SHAPES`, ~3211): the new version adds
a shape row; prior rows byte-untouched.

Additivity re-pin, restated honestly (P1 audit M-1, verbatim discipline):
with no MAE input, resolution output must be byte-identical EXCEPT
`mapping_table_version`, `contract_vocabulary_digest` (under the new
bundle version), the new corroboration-table-version receipt fields, and
the recomputed `resolution_receipt_id` — documented as a field-level diff
in the PR. Skipping the version bump to keep old pins green remains the
named anti-pattern.

## 2. Value parser / validation — none needed; the gates are enum + corroboration

All three definitions are enum-valued. The value IS the enum member and
the bundle's `allowed_canonical_values` gate is the mechanical validator;
there is no number, date, or free-text canonical value anywhere in this
family, so this slice ships **no new parse module** and mints no typed
ABSTAIN reasons of the parser class. What enum claims need instead is
corroboration (section 4), because a wrong-but-in-enum code is the failure
mode enums cannot catch on their own — and in THIS family a mislabelled
carve-out silently corrupts the cross-deal carve-out market statistics
that are the product.

One explicit non-goal, pinned: **no quantified-MAE parsing.** If a
definition quantifies materiality (a dollar or percentage threshold inside
the MAE definition), no registered definition fits; it routes open world.
None observed in the production corpus examined; do not build for it.

## 3. Producer prompt + provider

**New prompt MODULE:
`lib/canonical-v2/native-producer/mae-definition-producer-prompt.js`.**
The capitalisation prompt (`capitalisation-producer-prompt.js`) is NOT
edited — its `PROMPT_VERSION` does not move, its golden evals do not
re-run. The new module mints its own `PROMPT_ID`
(`mae-definition-producer/v1`), its own `PROMPT_VERSION` (1), and imports
`MAE_CARVEOUT_CODES_V2` per section 1's single-sourcing rule.

Response shape — top-level arrays:

- `mae_definition_instances`: exactly ONE per defined term per governing
  section (the capitalisation one-instance-per-section rule, keyed by
  defined term because two MAE terms legitimately share a definitions
  section — Modiv, Metsera). Each instance: `section_reference`,
  `defined_term` (verbatim), `definition_subject` (the verbatim party
  phrase the definition attaches to — "the Company", "Parent", "any
  Party"), and three nested lists:
  - `prong_assertions`: `{ prong_code ∈ {BUSINESS_EFFECTS,
    CONSUMMATION_PREVENTION}, prong_label?, verbatim quote, limb_path }`.
    Groundings: Metsera "(i) has had, or would reasonably be expected to
    have, a material adverse effect on the business, assets, condition
    (financial or otherwise) or results of operations of the Company and
    the Company Subsidiaries, taken as a whole" = `BUSINESS_EFFECTS`;
    Metsera "(ii) would or would reasonably be expected to prevent the
    consummation of, or materially impair the ability of the Company to
    consummate, the Merger by the Outside Date" = `CONSUMMATION_PREVENTION`;
    Concho orders them (b)/(a) — order is never meaning. A one-prong
    definition emits one assertion. TWO_LIMB / ONE_LIMB is NEVER asserted
    by the model — and (audit M-3) not by any downstream count either:
    publishing ONE_LIMB from a tally of resolved prong claims would be a
    derived ABSENT ("this definition has no consummation prong"), which
    M3 rule 1 reserves for scope-closure machinery that has proven the
    complete governed scope was examined — machinery this spec pins as
    nonexistent (`MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN`). Prong count
    is a future scope-closure-gated derivation; until that machinery
    exists, downstream reports state observed prong claims only, never a
    limb-count conclusion. A producer that missed one prong must never
    silently become a "one-prong definition" market statistic.
  - `carveout_assertions`: `{ carveout_code, clause_label, verbatim
    quote, limb_path }` — one per (clause, code) pair; a clause matching
    two codes is TWO assertions with the same limb_path (the Skechers
    (vii) example, stated in the prompt as a worked example).
  - `disproportionality_assertions`: `{ applies_to_clause_labels[],
    comparison_baseline_phrase, incremental_impact_phrase?, verbatim
    quote }`.
- `open_world_candidates` (unchanged shape, PRESERVE-THE-NOVEL retained
  verbatim).

Family-specific prompt instructions (each a legal pin, not style):

- "When no listed carveout_code fits the clause, or you are unsure, keep
  it in open_world_candidates — promotion narrows novelty, never forces
  fit." The prompt expressly names the known-novel shapes as
  open-world-for-now: cybersecurity/ransomware carve-outs (Modiv (k)),
  disclosure-letter-incorporated carve-outs (Metsera (J) — the clause
  label is quotable but its CONTENT lives outside the agreement),
  analyst-recommendation/credit-rating clauses, and any quantified-MAE
  threshold.
- Cross-reference rule (the M3 nesting pin, producer side): "A sentence
  that USES or MINTS an MAE term by reference — 'would not reasonably be
  expected to have … a Material Adverse Effect on the Company (a
  "Company Material Adverse Effect")' (the live Concho 3.1 form) — is NOT
  a definition instance. Emit an open_world_candidate for it. Only the
  section that states what the term MEANS ('"X" means …') is a
  definition instance." This keeps the v1 kind='cross-reference' cards
  out of the typed path entirely; they queue via open world.
- The carveback double-duty rule (the capitalisation PROMPT_VERSION-3
  lesson, restated for this family): the disproportionality proviso's
  words usually sit inside the tail of the same sentence that closes the
  carve-out list. It STILL gets its own `disproportionality_assertion`
  object; text already quoted by a carve-out assertion does not excuse
  omitting the carveback object.
- M3 rule 1 restated: emit only evidence-backed positives; never assert a
  carve-out is NOT present, a carveback does NOT apply to a clause, or a
  definition LACKS a prong. ABSENT stays derived downstream, forever.

`anthropic-provider.js`: three new generic claim keys, one proposal_kind
`MAE_DEFINITION` (≠ `OPEN_WORLD`):

```
NATIVE_MAE_CARVEOUT_CANDIDATE
NATIVE_MAE_DEFINITION_PRONG_CANDIDATE
NATIVE_MAE_DISPROPORTIONALITY_CANDIDATE
```

Three keys, not one-plus-attribute-split, because `RESOLUTION_UNCONDITIONAL`
is a Map keyed on generic_claim_key alone (P1 audit M-2) and the three
shapes carry different attribute contracts. The new response arrays are
NOT added to `REQUIRED_RESPONSE_LISTS` (the share-count precedent,
`anthropic-provider.js` ~83–89): recorded pre-existing fixtures must
replay byte-identically; a missing array is an empty list, never a schema
failure. Quote byte-verification (`locateQuoteBytes`) identical to
existing proposals. Unknown `prong_code` or malformed nested shapes are
typed provider errors (fail-closed, the existing
`NativeProducerAnthropicError` shape); an out-of-enum `carveout_code` is
NOT a provider error — the provider passes it through and the RESOLVER
routes it open-world with a typed reason (section 4), so the model
learning a new carve-out shape surfaces in the commonality report instead
of dying as a retry.

Section scoping: MAE definition sections enter prompt scope via the
existing section-scope mechanism (definitions article / annex sections
carrying the defined term; the P4-REIT convention — scope widens for this
family's sections only; capitalisation and no-shop extractions see zero
change).

Golden evals: NO recorded responses exist for this prompt. Recording
happens on the slice's one documented fresh live run (subscription CLI,
post-merge, its own dated handoff). Until then the pre-rerun harness
drives resolver/registry layers with synthetic compiled candidates
(section 6) — recorded-response fixtures are never hand-fabricated to
simulate runs that did not happen.

## 4. Resolver wiring (`candidate-resolution.js`)

- THREE unconditional resolution-table entries (distinct generic keys; the
  table-validation test asserts no duplicates):

  ```
  NATIVE_MAE_CARVEOUT_CANDIDATE            → DEF-MAE / MAE_CARVEOUT
  NATIVE_MAE_DEFINITION_PRONG_CANDIDATE    → DEF-MAE / MAE_DEFINITION_PRONG
  NATIVE_MAE_DISPROPORTIONALITY_CANDIDATE  → DEF-MAE / MAE_DISPROPORTIONALITY_CARVEBACK
  ```

  `party_field`: `definition_subject`; `party_role`:
  `DEFINITION_SUBJECT`. The `PARTY_CAPACITY_LEXICON` resolves "the
  Company" → TARGET and "Parent" → BUYER unchanged; a party-neutral
  subject ("any Party", the Concho Annex-A form) matches nothing and
  routes to review `PARTY_UNRESOLVED` — correct, not a defect: a
  bilateral definition genuinely binds both parties and which statistics
  row it feeds is a Ben call, not a lexicon default.
  `MAPPING_TABLE_VERSION` bumps by one from whatever is head at build
  time (head is 4 today; **6** if this slice lands after no-shop's 4→5,
  **5** if this slice lands first — audit M-4 corrected the draft's
  worked "5", which was itself the silent-last-win hazard the rule
  warns about; the number is taken at build, never reserved in a spec).
- Dedicated handler per shape (the TEMPORAL/share-count pattern).
  **Ordering pin (audit M-2): enum-membership against
  `MAE_CARVEOUT_CODES_V2` is checked FIRST; only in-enum codes reach the
  corroboration table.** An out-of-enum code has no corroboration row —
  if corroboration ran first it would throw or mistype as
  `MAE_CARVEOUT_UNCORROBORATED`, and the load-bearing open-world route
  below would never fire. In-enum flow: corroboration → attribute
  verbatim checks → `canonicalValueAllowed` gate (a handler bug must not
  bypass the gate) → materiality → unevaluated-conditions stamp. EVERY resolved DEF-MAE claim gets
  `MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN` appended to
  `unevaluated_conditions` (the Deliverable's M3 pin — mechanism
  identical to `SOURCE_SCOPE_CERTIFICATION_ABSENT`).
- Out-of-enum `carveout_code` → explicit `pushOpenWorld` with typed
  reason `MAE_CARVEOUT_CODE_UNREGISTERED` (the main loop's open-world
  routing keys on proposal_kind and will not catch it — P1 audit C-4's
  second half). This is the cyber-carve-out path and it is load-bearing.
- **Corroboration tables — frozen resolver constants binding label to
  quote text** (the P1 C-4 doctrine: a wrong-but-in-enum label must never
  publish under the wrong code). All patterns word-bounded per the
  lexicon rules; acronyms case-sensitive (`MFN`, `GAAP`, `FDA` — the
  `/RSU/`-in-"puRSUant" trap class); v1's `/\bloe\b/i` synonym is NOT
  carried over (case-insensitive "loe" is a noise trap; the phrase forms
  suffice). The byte-verified quote must match its code's pattern;
  mismatch → review, typed `MAE_CARVEOUT_UNCORROBORATED`.

  *Carve-out codes* (grounding fragments verbatim from production cards —
  Skechers/Metsera/Modiv/Concho quotes pulled 2026-08-02):
  - `ECONOMY_GENERAL` — `/general economic conditions|econom(y|ic
    conditions)/i` ("changes in general economic conditions in the United
    States"; "general economic conditions (or changes in such
    conditions)").
  - `INDUSTRY_GENERAL` — `/industr/i` AND `/conditions|changes|
    developments|affecting/i` ("changes in conditions in the industries
    in which the Company Group generally conducts business"; "generally
    affecting the biopharmaceutical industry").
  - `FINANCIAL_MARKETS` — `/(financial|credit|capital|securities|
    currency) markets/i` ("conditions in the financial markets, credit
    markets or capital markets"; "securities markets, credit markets,
    currency markets or other financial markets").
  - `ACTS_OF_WAR_TERRORISM` — `/acts? of war|terroris|hostilit|military
    action|sabotage/i` ("outbreak of hostilities, acts of war, sabotage,
    terrorism (including cyberattacks or cyberterrorism) or military
    actions").
  - `NATURAL_DISASTERS` — `/natural disaster|earthquake|hurricane|
    tsunami|tornado|flood|mudslide|wild ?fire|acts? of god|force
    majeure/i` ("earthquakes, hurricanes, tsunamis, tornadoes, floods,
    mudslides, wild fires or other natural disasters … and other force
    majeure events").
  - `PANDEMIC` — `/pandemic|epidemic|disease outbreak|COVID|public
    health/i ` ("any epidemic, pandemic or disease outbreak (including
    COVID-19) or any COVID-19 Measures").
  - `ANNOUNCEMENT_OR_PENDENCY` — `/announcement|pendency/i` ("resulting
    from the announcement of this Agreement or the pendency of the
    Merger").
  - `COMPLIANCE_WITH_AGREEMENT` — `/compliance with|(expressly )?required
    by this Agreement/i` ("expressly required by this Agreement").
  - `ACTIONS_REQUESTED_BY_PARENT` — `/request of Parent|Parent'?s?
    (written )?request|written consent of Parent|Parent'?s? (written
    )?consent/i` ("at Parent's written request or with Parent's written
    consent").
  - `CHANGE_IN_LAW` — `/changes? in (applicable )?Law|regulatory,
    legislative or political/i` ("changes in regulatory, legislative or
    political conditions"; corpus: "changes in applicable Law" 11 cards,
    "changes in Law" 5).
  - `CHANGE_IN_GAAP` — `/GAAP/` (case-sensitive) OR `/accounting
    (principles|standards|requirements)/i` ("changes in GAAP" — 14
    cards).
  - `STOCK_PRICE_CHANGES` — `/(trading|market) price|trading volume/i`
    ("changes in the trading price or volume"; "market price" 24 cards).
  - `FAILURE_TO_MEET_PROJECTIONS` — `/fail(ure)? .{0,30}to meet/i AND
    /projections|forecasts|estimates|guidance|budgets|expectations/i`
    ("any failure, in and of itself, by the Company Group to meet (A) any
    public estimates or expectations … (B) any internal budgets, plans,
    projections or forecasts").
  - `PRICING_MFN` — `/MFN/` (case-sensitive) OR
    `/most[- ]favou?red[- ]nation/i`.
  - `EXECUTIVE_ACTION` — `/executive order/i` OR `/sanction/i`.
  - `TARIFFS` — `/tariff|trade restriction|trade polic|trade barrier|
    trade war|import dut/i` ("imposition of new or increased trade
    restrictions, tariffs, trade policies or disputes … 'trade war'").
  - `GOVERNMENT_SHUTDOWNS` — `/government shutdown|civil unrest|
    political instability/i`.
  - `CLINICAL_RESULTS` — `/clinical/i` AND
    `/(trial|stud(y|ies)|data|results?|hold|endpoint)/i` ("clinical trial
    results" class — life-sciences deals only in practice; the code gate
    does not care). Audit m-2: bare `/clinical/i` was a near-vacuous
    veto; the conjunct narrows it, and a failed veto only queues.
  - `FDA_DISCUSSIONS` — `/FDA/` (case-sensitive) AND
    `/discussion|correspondence|interaction|meeting|communicat/i`.
  - `FDA_APPROVALS_COMPETITOR_ENTRY` — (`/competit/i` AND
    `/(entry|entrant|product|approval|launch)/i`) OR (`/FDA/` AND
    `/approval/i`). Audit m-2: bare `/competit/i` matched "competitive
    conditions" in every `INDUSTRY_GENERAL` clause — a veto that crossed
    a real adjacent-code boundary; the conjunct restores it.
  - `SUPPLY_CHAIN` — `/supply chain|raw material/i`.
  - `PRICING_REIMBURSEMENT` — `/reimbursement|price control|payor/i`.
  - `MEDICAL_ORGS_STATEMENTS` — `/medical|scientific/i AND
    /(society|organization|statement)/i`.
  - `PATENTS_EXCLUSIVITY` — `/patent|loss of exclusivity/i`.
  - `PARENT_ACTIONS_OR_INACTION` — `/act(s|ion)? (or omission[s]? )?of
    Parent|taken by Parent|Parent'?s? (acts|inaction|omission)/i`.
    NOTE the near-collision with `ACTIONS_REQUESTED_BY_PARENT` (acts OF
    parent vs acts of the COMPANY at parent's request — economically
    different: who bears the risk of parent-caused damage vs
    parent-directed company action). The two patterns are disjoint on the
    request/consent stem: `ACTIONS_REQUESTED_BY_PARENT` requires
    `/request|consent/i`; `PARENT_ACTIONS_OR_INACTION` REJECTS quotes
    matching `/request|consent/i` (an explicit negative guard in this one
    entry, recorded in the table doc-comment). A both-stem quote proposed
    as `PARENT_ACTIONS_OR_INACTION` fails the guard and queues — review
    decides, never the resolver. Audit m-3 precision: the guard protects
    only that direction; the same both-stem quote proposed as
    `ACTIONS_REQUESTED_BY_PARENT` still resolves (its own pattern
    matches; corroboration is veto-only). That residual is the disclosed
    veto-not-classifier cost, backstopped by the v1↔v2 comparator and
    the rank-30 queue (Known costs).
  - `EMPLOYEE_DEPARTURES` — `/employee|officer|executive/i AND
    /departure|attrition|loss|resignation/i` ("departure of any employee
    or officer").

  *Prong codes:*
  - `BUSINESS_EFFECTS` — `/material adverse effect/i` AND `/business|
    financial condition|condition \(financial|results of operations?|
    assets/i` AND `/taken as a whole/i` (49 of 68 cards carry "taken as a
    whole"; a business-effects prong without it queues — that phrase is
    the prong's aggregation baseline and its absence is a genuine legal
    variant Ben should see).
  - `CONSUMMATION_PREVENTION` — `/prevent|delay|impair/i` AND
    `/consummat/i` ("would prevent, materially delay or materially impair
    the ability of such Party … to consummate the Transactions"; "prevent
    the consummation of, or materially impair Parent's ability to
    consummate, the Merger by the Outside Date").

  *Carveback:* `MAE_DISPROPORTIONALITY_CARVEBACK` —
  `/disproportionate(ly)?/i` ("disproportionately affected thereby as
  compared with"; "a disproportionate adverse effect on the Company
  relative to"; "disproportionately and adversely impact"). Mismatch →
  typed `MAE_CARVEBACK_UNCORROBORATED`.

  Corroboration is a VETO on the proposed label, not a classifier (the
  no-shop section 4 pin, verbatim): a quote satisfying two codes' patterns
  under its proposed code still resolves; a quote satisfying only some
  OTHER code's pattern fails its own and queues.

- Materiality: **no new tier; the empty rank-30 tier is wired.** The
  `MATERIALITY_TABLE` row `{ rank: 30, label: 'MAE', concept_key_prefixes:
  [] }` (`candidate-resolution.js` ~449) — placed there verbatim from the
  ledger's own ranking, waiting for a family — gains
  `concept_key_prefixes: ['DEF-MAE']`. This is the ledger's OWN ranking
  ("termination rights, fees, MAE, …"), so unlike P1's rank-52 invention
  it needs no new legal call, but the one-line diff is still flagged in
  the PR body. No definition-key override map entries — the prefix is the
  natural mechanism here and all three definitions live under the one
  concept.
- Resolution receipt: the carve-out corroboration-table version
  (`MAE_CORROBORATION_TABLE_VERSION`, frozen constant) threads into
  `receiptBody` alongside the bumped `mapping_table_version` and the new
  `contract_vocabulary_digest` (P1 audit M-6 pattern).

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` — same slice, mandatory)

Program invariant: the family lexicon grows in the SAME slice as the
family (`DEF-MAE` becomes a registered concept key in section 1, so the
table-validation test's registered-key assertion passes). Lexicon version
bump + content-hash re-pin; every entry carries a one-line rationale;
multi-form entries are separate pattern_ids. All groundings verbatim from
production quotes cited in section 4.

**DEF-MAE patterns:**

- `LITERAL_PHRASE` "Material Adverse Effect" — the family's defining
  term; grounded in all 68 cards. PRICED NOISE, stated up front: this
  phrase saturates MAE-qualified reps, bring-downs and closing conditions
  corpus-wide. Under the Ben-ratified same-family-within-section reading,
  an unmatched DEF-MAE hit in (say) a capitalisation rep section does NOT
  block REP-T-CAP claims — it blocks only DEF-MAE conclusions in that
  section and refuses ABSENT for DEF-MAE there. Cost: queue items and
  refused ABSENTs in MAE-USING sections, which is arguably the right
  epistemic state (the machine cannot yet distinguish use from
  definition); never a wrong claim. Veto-only design makes this
  affordable; queue data prices any future Ben-ratified scoping rule.
- `LITERAL_PHRASE` "material adverse effect" is the SAME pattern
  (LITERAL_PHRASE is case-insensitive by the net's contract) — no
  separate entry.
- `BOUNDED_REGEX` `/disproportionate(ly)?/i` (word-bounded both edges;
  static max well under 128) — the carveback tell; grounded in 49/51
  long-form cards; essentially unique to MAE definitions in M&A drafting.
  This is the family's highest-precision pattern.
- `LITERAL_PHRASE` "taken into account in determining" — the carve-out
  chapeau tell ("shall be taken into account in determining whether
  there has been a Company Material Adverse Effect" — Metsera); the
  exact phrase is verified present in all four grounding deals'
  cards (Concho/Skechers/Metsera/Modiv, corpus-checked 2026-08-02).
  Audit m-1: the draft grounded this pattern with a "when determining"
  fragment the exact-phrase pin would not match — grounding swapped,
  and the drafting variants are minted as their own pattern_ids
  (additions only narrow auto-pass):
- `LITERAL_PHRASE` "taken into account when determining" — variant
  chapeau form ("shall be taken into account when determining whether a
  'Material Adverse Effect' has occurred").
- `LITERAL_PHRASE` "taken into consideration when determining" — the
  Skechers drafting variant, previously an unrecorded miss.
- `LITERAL_PHRASE` "acts of war"; `LITERAL_PHRASE` "terrorism";
  `LITERAL_PHRASE` "hostilities" — war/terror carve-out tells (49/51
  cards carry terrorism language). Priced: may also fire in a rare
  force-majeure covenant section; veto-only cost.
- `BOUNDED_REGEX` `/pandemics?/i`; `BOUNDED_REGEX` `/epidemics?/i`;
  `LITERAL_PHRASE` "disease outbreak" — pandemic carve-out tells.
- `LITERAL_PHRASE` "natural disasters"; `LITERAL_PHRASE` "force majeure".
- `LITERAL_PHRASE` "general economic conditions"; `LITERAL_PHRASE`
  "credit markets"; `LITERAL_PHRASE` "capital markets"; `LITERAL_PHRASE`
  "securities markets" (four separate pattern_ids). Priced: "capital
  markets"/"credit markets" also fire in financing reps and efforts
  covenants — queue cost, recorded.
- `LITERAL_PHRASE` "failure to meet"; `LITERAL_PHRASE` "projections" —
  projections carve-out tells (17 and 46 cards respectively). Priced:
  "projections" fires in disclosure/forecast reps; veto-only.
- `LITERAL_PHRASE` "changes in GAAP" — grounded 14 cards. Naked `GAAP`
  acronym is EXCLUDED (below).

**Priced exclusions (recorded blind spots; deletion-asymmetry doc-comment
updated):**

- Naked "material", "adverse", "effect", "change", "in the aggregate",
  "taken as a whole" — each floods every article of every agreement; the
  noise would pressure deletions, and deletions widen auto-pass.
  "Individually or in the aggregate" (41 cards) is likewise excluded: it
  is standard qualifier boilerplate in reps corpus-wide, not an MAE tell.
- Naked `GAAP` (acronym) — fires in every financial-statements and
  SEC-reports rep; the phrase form "changes in GAAP" carries the family
  signal.
- "Material Adverse Change" / "MAC" — NOT included, and this is a
  grounding decision, not an oversight: 0 of 51 long-form production
  cards use the term. An MAC-drafted deal entering the corpus would
  surface via the "Material Adverse Effect"-absent + open-world path and
  the v1 comparator (v1's DEF-MAE aliases include MAC). Recorded blind
  spot; adding the pattern when the first MAC deal lands is a cheap,
  narrowing lexicon addition.
- "COVID-19" — excluded as a lexicon pattern (it appears in IOC
  covenants, "COVID-19 Measures" definitions, and pandemic-era reps far
  outside MAE definitions); the pandemic stems above carry the signal.
  It REMAINS in the corroboration pattern for the `PANDEMIC` code
  (section 4), where it only ever gates an already-proposed claim.
- Anti-noise regression paragraph (lexicon test 8 convention) extends
  with pinned prose containing "materially adversely affect" (rep
  boilerplate), "changes in circumstances", "warrants" chapeau text, and
  "the aggregate Merger Consideration" — asserted: none of the DEF-MAE
  phrase patterns fire ("materially adversely affect" must not match
  "Material Adverse Effect" — LITERAL_PHRASE is exact-phrase, not stem;
  the test pins it).

## 6. Acceptance tests (real-fixture-first; pre-rerun honesty pins)

No recorded native runs exist for this family. The P1 audit M-5 pins apply
verbatim: synthetic compiled candidates drive the resolver/registry
layers, pinned to REAL quotes byte-verified against committed canonical
text, clearly labeled as the pre-rerun harness; no report before the dated
post-merge live rerun handoffs may claim native MAE extraction.

1. **Fixture commitment** — two ordered sub-steps (audit C-1: the draft
   presumed committed sources that do not exist for two of the three
   deals).
   1a. **Source commitment first.** Skechers' full agreement is already
   committed
   (`tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm`,
   contains the MAE definition). For F28/TopBuild and Modiv, NO committed
   source contains the MAE definition (the F28 fixtures are section
   excerpts; the Modiv live-run tree has no source document). Build step:
   fetch the TopBuild and Modiv merger agreements from EDGAR, verify each
   fetched document against the live-run intake pins' document hashes,
   and COMMIT the full documents (or hash-pinned definition-section byte
   extracts, with the pinning hash recorded beside the extract) BEFORE
   any coverage-map enumeration. If a hash cannot be verified against the
   intake pins, the deal is re-scoped out of the fixture trio and
   replaced with a deal that has a committed, hash-verifiable source —
   never enumerated from retyped or DB text.
   1b. **Definition-section extraction.** Commit the MAE-definition
   governed-section canonical text for the three native-fixture deals,
   byte-extracted from the sources committed in 1a (never
   retyped; zero-width/LTR marks preserved — the P1 literal-bytes rule).
   The COVERAGE MAP is hand-enumerated from those LITERAL bytes: per
   defined term, the expected prong claims, the expected (clause_label,
   carveout_code) set, the expected carveback with its
   applies_to_clause_labels — each expected quote asserted to be a
   contiguous byte-substring of the committed text. Production-DB quotes
   in this spec are design grounding only — the tests never read the DB.
2. **Registry:** new version compiles; prior version's arrays untouched
   byte-for-byte; all three definitions validate with zero validator
   loosening; `MAE_CARVEOUT_CODES_V2` has exactly 26 members and no
   `OTHER`; prompt-vocabulary byte-equality test against the compiled
   bundle (section 1/3 single-sourcing).
3. **Resolution:** synthetic candidates resolve end-to-end onto
   `DEF-MAE` with the right definition; every corroboration veto
   exercised with a real-quote fixture, including at least: a
   `STOCK_PRICE_CHANGES` code proposed on the Skechers
   failure-to-meet-projections quote → `MAE_CARVEOUT_UNCORROBORATED`
   (the classic adjacent-clause mislabel — price/projections clauses
   abut in every fixture); an `ACTIONS_REQUESTED_BY_PARENT` /
   `PARENT_ACTIONS_OR_INACTION` disjointness case exercising the negative
   guard both ways; a `BUSINESS_EFFECTS` prong without "taken as a whole"
   queuing. The Skechers (vii) clause resolves as TWO claims
   (`NATURAL_DISASTERS`, `PANDEMIC`) with distinct identities on one
   limb_path. Out-of-enum: the Modiv "(k) … ransomware …" clause
   exercises the explicit `pushOpenWorld` with
   `MAE_CARVEOUT_CODE_UNREGISTERED`. Attribute-verbatim failures typed
   (`DEFINED_TERM_REF_NOT_IN_QUOTE`, `CLAUSE_LABEL_NOT_IN_QUOTE`,
   `CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE`); an unenumerated carveback
   fixture queues `CARVEBACK_SCOPE_UNENUMERATED`; a party-neutral
   "any Party" subject queues `PARTY_UNRESOLVED`. Materiality resolves
   rank 30 via the newly-wired prefix. **Every resolved DEF-MAE claim
   carries `MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN` in
   `unevaluated_conditions`** — asserted on every resolved-path fixture,
   including one where both nets are bound, fresh and clean
   (`both_nets_clean` may be true; the unevaluated entry is still
   present; nothing reads as auto-pass-eligible).
4. **Identity:** Company-MAE and Parent-MAE claims from one section mint
   distinct stable identities (`defined_term_ref` identity-bearing);
   same clause_label under two codes mints distinct identities; the same
   code under two clause_labels likewise.
5. **Write-path:** one resolved claim of each definition travels adapter
   → validation → publishableWriteSet.
6. **Lexicon:** table validation (registered keys — passes only because
   `DEF-MAE` registers in the same slice; bounded regexes ≤128 static
   max; ids + rationales; content hash re-pinned); the anti-noise
   paragraph including the "materially adversely affect" ≠ "Material
   Adverse Effect" pin; determinism permutation tests unchanged; a
   multi-section fixture where an MAE-USING rep section shows the priced
   unmatched-hit behaviour (DEF-MAE veto fires there; REP-T-CAP claims
   in the same section unaffected under the ratified same-family
   reading).
7. **Additivity re-pin:** with no MAE input, field-level diff limited to
   the enumerated fields (section 1); documented in the PR.
8. Full suite + build + forbidden-patterns; phase allowlist for the
   slice's files; quote verification at zero flags.
9. **Post-merge (its own dated handoff, not this slice's tests):** one
   documented fresh live run per fixture deal (subscription CLI); golden
   recordings minted from those runs only; only then may any report
   describe native MAE extraction.

## Out of scope

- `COND-B-MAE` (the No-MAE closing condition, 28 production cards) and
  the MAE bring-down interaction — a condition-family slice, not a
  definition slice.
- The carveback→carve-out per-clause JOIN
  (`hasDisproportionateImpactCarveback` per carve-out) — requires proven
  enumeration completeness; named future slice (section 1).
- Any self-containment prover / lifting of
  `MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN` — future, Ben-ratified
  machinery; until then every DEF-MAE claim queues by construction.
- Cross-deal normalization of `comparison_baseline_phrase` (similar-size
  vs similarly-situated vs industry-participants baselines — a real
  market-statistic dimension, adjudicated by Ben over observed values).
- Promotion of a cybersecurity carve-out code, a
  disclosure-letter-incorporated carve-out shape, analyst/credit-rating
  clauses, or quantified-MAE thresholds — open world feeds the
  commonality report; codes are minted by Ben's adjudication, never by
  an implementer extending the enum.
- `DEF-MAE-CLINICAL` as a distinct concept (zero production cards; the
  clinical codes live inside `MAE_CARVEOUT_CODES_V2`).
- Prevent-or-delay prong RUBRIC features (`maePreventDelayProng`,
  `maeLimbs`) back-fill into v1 — v1 is untouched by design.
- `FAMILY_MAPPING_TABLE` extension (separate Fable+Ben table edit with
  the wiring slice, per P1).

## Known costs, stated up front

- **Nothing in this family auto-passes this slice, by design.** Every
  DEF-MAE claim carries the self-containment unevaluated condition and
  queues at rank 30. The economics of the slice are queue QUALITY
  (typed, structured, corpus-comparable, materiality-ranked items with
  verbatim carveback scopes) — not queue reduction. Stating otherwise in
  any report is the M-5 violation.
- The "Material Adverse Effect" lexicon phrase fires in every MAE-USING
  section; the veto-only design converts that to refused-ABSENTs and
  queue items for DEF-MAE scope in those sections, never wrong claims.
  Queue data prices a future scoping rule; the remedy is Ben-ratified,
  never a module-side heuristic.
- Corroboration is a veto, not a classifier: a mislabelled carve-out
  whose quote happens to satisfy the proposed code's pattern (real risk:
  the war/disaster/pandemic clauses share disaster vocabulary; the
  guarded PARENT pair shares the Parent stem) can still resolve. The
  backstop is the v1↔v2 comparator (v1's `carveouts` feature lists give
  a per-deal disagreement surface) and Ben's ranked queue at rank 30 —
  the second-highest-materiality band in the table.
- **Named weak veto (audit m-2 residual):** `ECONOMY_GENERAL`'s
  `econom(y|ic conditions)` branch matches any "economy" mention, making
  it a categorically weaker veto than the rest of the table. Left as-is
  this slice (veto-only; a wrong-but-in-enum ECONOMY code on an
  economy-adjacent quote can resolve) — backstopped by the comparator
  and queue like every other veto miss; tightening is a cheap narrowing
  follow-up if the queue prices it.
- **Recurring prong-queue cost (audit m-4):** 6 of 68 production DEF-MAE
  cards (verified 2026-08-02) draft the business-effects prong as
  "materially adverse to …" with NO "material adverse effect on"
  phrasing; the `BUSINESS_EFFECTS` corroboration pattern fails on those
  prong quotes, so every prong claim in those deals queues. Fail-closed
  and consistent with the "taken as a whole" variant recorded in
  section 4 — but a real ~9%-of-cards standing queue cost, stated here
  so it is never misread as producer failure.
- MAC-drafted and quantified-MAE deals are recorded lexicon/enum blind
  spots (0 observed in corpus); open world and the v1 comparator cover
  the shapes; the additions are cheap and narrowing when the first
  example lands.
- Bilateral ("any Party") definitions queue `PARTY_UNRESOLVED`; Concho
  is the live example. Correct cost: subject attribution on a bilateral
  definition is a serving-dimension call Ben has not made.
