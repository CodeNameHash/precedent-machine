# canonical-v2 Capability Inventory

Read-only sweep. Cataloguing what `lib/canonical-v2/` ALREADY does, per
CLAUDE.md's warning against re-declaring existing capabilities as missing.
Note: another agent is actively editing files under `lib/canonical-v2/`
while this was written; any file that looked mid-edit is flagged inline and
not treated as a finding.

## Summary table

| # | Capability | State | File:export | Evidence |
|---|---|---|---|---|
| 1 | Sub-clause / limb segmentation | RUNNING (but mints trees almost never) | `native-producer/limb-components.js` (`limb-component tree` builder), consumed via `native-producer/candidate-resolution.js:10636` | 202 `resolution.json` files scanned across all of `evidence/canonical-v2/`; exactly 1 has a non-empty `limb_component_trees` array — `modiv-capitalisation-20260807-replay` (1 tree). All 9 MAE runs and all 18 (not 4) REPRESENTATIONS-named runs are empty (10 of the 18 have no `resolution.json` at all). |
| 2 | Qualifier attachment | RUNNING | `native-producer/qualifier-attachment.js` (`resolveQualifierAttachment`), called from `native-producer/anthropic-provider.js:811` inside `shapeRepresentationInstance`, which is registered for the REPRESENTATIONS family (line 3249) | `evidence/canonical-v2/redhat-representations-20260808-r1/adapter-result.json`: 33 qualifier `attachment` objects (5 CHAPEAU, 24 ITEM, 4 TRAILING) |
| 3 | Chapeau / inheritance | SPLIT: qualifier-chapeau scope RUNNING; EXCEPTED_BY exception-inheritance BUILT BUT UNWIRED (single-deal offline slice, never in evidence) | `native-producer/qualifier-attachment.js` (chapeau scope); `contract-bundle.js` `NO_SHOP_EXCEPTION_EFFECT_SCHEMA_V1`/`EXCEPTED_BY`, consumed only by `qxo-no-shop-actions-parser-bridge.js` (`DEAL_KEY = 'deal:qxo-topbuild'`, `AUTHORITY_SCOPE = 'OFFLINE_REVIEW_ONLY_...'`) | none — `grep -rl "EXCEPTED_BY" evidence/canonical-v2/` returns nothing |
| 4 | Open-world candidate handling | Capture: RUNNING. Promotion to mapped concept: NOT BUILT | `native-producer/anthropic-provider.js` (`shapeOpenWorldCandidate`); `native-producer/native-write-set-adapter.js` (fixed `UNGOVERNED_UNREVIEWED` disposition); `open-world-evidence-serving.js` (serving guard) | 160/204 `resolution.json` files have non-empty `open_world`; max 194 entries in one run (skechers-key-defined-terms) |
| 5 | Evidence residuals / drop reasons | RUNNING | `native-producer/anthropic-provider.js` (`dropCounter.record`, 31+ reason codes); `native-producer/candidate-resolution.js` (35 resolver-level ambiguity/unresolved codes) | `adapter-result.json` residuals populated live across corpus (e.g. 22 `OPEN_WORLD_CANDIDATE`, 15 `QUALIFIER_GOVERNS_PATH_OCCURRENCE_AMBIGUOUS`) |
| 6 | Party / scope derivation | RUNNING | `native-producer/candidate-resolution.js` (`resolvePartyCapacity` line 1485, `resolveParty` line 1529) | redhat-representations-20260808-r1: 26 resolved `"capacity": "TARGET"` provisions; `JOINT_MULTI_PARTY_CAPACITY` sentinel never observed in any evidence file |
| 7 | Topology | SKIPPED (owned by another agent) | | |
| 8 | Family registry | RUNNING, all 25 | `native-producer/producer-prompt-registry.js` (`REGISTRY` Map, line 117) | every one of 25 registered families has ≥1 matching evidence directory (5–18 each) |
| 9 | Byte-offset handling | RUNNING | `canonical-bytes.js`: `utf8ByteLength`, `utf8Slice` | required in 53 files across `lib/canonical-v2/` |
| 10 | Publish / hold-back criteria | RUNNING | `native-producer/candidate-resolution.js` AUTO-PASS test (header lines 40-99) + `pushReviewUnresolved` (line 5529) | 3,133 total `review_queue` items across 204 evidence runs; top live reasons `LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE` (699), `IOC_ATTACHMENT_TARGET_QUOTE_MISSING` (171), `QUALIFIER_KIND_UNCLASSIFIED` (144) |

---

## 1. Sub-clause / limb segmentation

**Found. WIRED and RUNNING**, but produces output almost never.

- `lib/canonical-v2/native-producer/limb-components.js` (558 lines) builds
  `limb_component_trees` — a tree of `PATH`/`ASSERTION` nodes per
  `provision_instance_id`, with `limb_path`, `parent_limb_component_id`,
  `ordinal_under_parent`. It also resolves where a qualifier attaches onto
  an already-minted tree (a second, confusingly-named `resolveQualifierAttachment`
  — see file header's own "NAME COLLISION TRAP" warning against confusing it
  with `qualifier-attachment.js`'s function of the same name).
- It is required by `native-producer/candidate-resolution.js`, which puts
  the result at `resolution.limb_component_trees` (line 10636), and by
  `native-producer/semantic-safety-preflight.js` and
  `native-producer/native-write-set-adapter.js`.
- Verification of the brief's claim: scanned **every** `resolution.json`
  under `evidence/canonical-v2/` (202 files total, all deals, all
  families). Exactly **one** has a non-empty `limb_component_trees`:
  `evidence/canonical-v2/modiv-capitalisation-20260807-replay/resolution.json`,
  with a single tree (5 top-level `PATH` nodes `(a)`–`(e)` for one
  provision instance). This matches the "minted exactly once on a parked
  capitalisation case" belief exactly.
- Correction to the brief's framing: there are not "4 REPRESENTATIONS
  runs" — there are **18** evidence directories matching
  `*representations*` (excluding `no-other-reps-fraud`), across concho,
  metsera, modiv, redhat, skechers, skywater and topbuild. Of those, 10
  have a `resolution.json` (all empty) and 8 have no `resolution.json` at
  all (different evidence shape — worth checking if anyone relies on the
  "4" count for anything). The 9-MAE-run count is correct as stated.
- Conclusion: the machinery is real, wired into the live resolution path,
  and exercised by tests (`tests/canonical-v2-limb-components.test.js`,
  `tests/canonical-v2-limb-enumeration-scan.test.js`), but on every real
  deal run captured in evidence except one capitalisation case, it mints
  zero trees. Whether that's because MAE/REPRESENTATIONS provisions
  structurally don't trigger tree-minting (a callsite gate) or because the
  gate is mis-set is **uncertain** — would be settled by reading the
  call site in `candidate-resolution.js` around line 10559 for the
  condition under which `limbComponentTrees` is populated, which was not
  done here for time.

## 2. Qualifier attachment

**Found. WIRED and RUNNING** — and the brief's belief is correct.

- `lib/canonical-v2/native-producer/qualifier-attachment.js` (205 lines):
  a pure, deterministic function `resolveQualifierAttachment` that turns a
  model-reported `position` (CHAPEAU / ITEM / TRAILING) plus the
  qualifier's own verbatim quote into a `scope_reading`
  (ALL_ITEMS / THIS_ITEM_ONLY / AMBIGUOUS). It deliberately never lets the
  model self-report scope — only position and quote text, scope is
  computed by a fixed lexical rule (SERIES markers vs SINGLE-CLAUSE
  markers) so a last-antecedent ambiguity can't be silently guessed away.
- Its header comment says it exists for `capitalisation-producer-prompt.js`'s
  "QUALIFIER POSITION" instruction — true, but not the whole story: it is
  actually invoked from **`native-producer/anthropic-provider.js:811`**
  inside `shapeRepresentationInstance`, and that function is registered
  for the **REPRESENTATIONS** family specifically (`anthropic-provider.js:3249`,
  `REPRESENTATIONS: shapeRepresentationQualifierProposals` at :3367).
  `representations-producer-prompt.js` itself carries the matching
  `ATTACHMENT` instruction (its own `QUALIFIER_POSITION` codebook,
  line ~22) telling the model to report CHAPEAU/ITEM/TRAILING and nothing
  more — so the brief's belief is verified: representations does carry
  qualifier attachment, and it is live.
- Live evidence: `evidence/canonical-v2/redhat-representations-20260808-r1/adapter-result.json`
  contains 33 `"attachment"` objects (5 CHAPEAU, 24 ITEM, 4 TRAILING via
  `grep -o '"position": *"[A-Z]*"' | sort | uniq -c`). Confirms it ran live
  on Red Hat, exactly as believed.

## 3. Chapeau / inheritance

Two distinct mechanisms answer this question, in two different states.

**(a) Qualifier scope ("chapeau governs the whole series")** — this is
just capability 2's ALL_ITEMS resolution: when a qualifier sits before an
enumerated list (`position: CHAPEAU`), `qualifier-attachment.js` resolves
`scope_reading: ALL_ITEMS`, i.e. it inherits/governs every limb under it.
`limb-components.js` (line ~492) separately attaches such a qualifier to
the tree's PATH node when there are multiple assertion children, so it
covers every child. **RUNNING** — see capability 2's Red Hat evidence.

**(b) "An exception carries the rule it excepts from"** — a distinct,
heavier mechanism: an `EXCEPTED_BY` relationship type
(`relationship_key: 'EXCEPTED_BY'`) registered in the general relationship
schema in `lib/canonical-v2/contract-bundle.js`
(`EXPECTED_RELATIONSHIP_KEYS`, line 3905), with two concrete effect
schemas for the no-shop family: `NO_SHOP_EXCEPTION_EFFECT_SCHEMA_V1` and
`NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1` (both around line 860-940),
each carrying `affected_action_code`, prerequisite codes, temporal bounds
and a `precedence_code` — i.e. the exception's typed effect literally
names the rule/action it modifies. `canonical-contract-excepted-by-validator.js`
(376 lines) validates the shape.
- **BUILT BUT NOT WIRED into the live/general pipeline.** No
  `native-producer/*producer-prompt.js` file emits `EXCEPTED_BY` or
  anything that would feed it (`grep -rln "EXCEPTED_BY" lib/canonical-v2/native-producer/`
  is empty), and `candidate-resolution.js` (the general resolver) never
  touches it either.
- The only consumer is `qxo-no-shop-actions-parser-bridge.js`, whose own
  constants declare `DEAL_KEY = 'deal:qxo-topbuild'` and
  `AUTHORITY_SCOPE = 'OFFLINE_REVIEW_ONLY_NO_CANONICAL_MARKET_OR_SERVING_AUTHORITY'`
  — this is a single-deal (QXO/TopBuild), explicitly offline-review-only
  migration slice, not the general native-producer path other families
  run through.
- `grep -rl "EXCEPTED_BY" evidence/canonical-v2/` returns **no files** —
  it has never produced output captured in the evidence corpus, on any
  deal.
- Conclusion: real schema, real validator, a specific deal-shaped consumer
  — but not part of the general/live extraction pipeline and never
  observed running.

## 4. Open-world candidate handling

**Capture: RUNNING, heavily.** **Promotion to a mapped concept: NOT BUILT.**

- Capture: `native-producer/anthropic-provider.js`'s `shapeOpenWorldCandidate`
  (~line 904) turns a model-emitted `{observed_quote, why_unmapped,
  nearest_concept, structured_mechanic, candidate_kind, observed_category}`
  object into a `proposal_kind: 'OPEN_WORLD'` claim, dropped-with-a-record
  (`OPEN_WORLD_CANDIDATE_NOT_AN_OBJECT`, `OPEN_WORLD_QUOTE_UNVERIFIED`) if
  malformed or unverifiable rather than silently lost — the file's own
  comment documents a real regression here (2026-08-08: a bare-string
  candidate path silently destroyed 3 antitrust and 5 specific-performance
  candidates before this was fixed).
- The write boundary is `native-producer/native-write-set-adapter.js`: it
  mints `open_world_candidates` / `_occurrences` / `_evidence_references` /
  `_dispositions` rows. Every disposition minted gets the single fixed code
  `OPEN_WORLD_DISPOSITION_CODE = 'UNGOVERNED_UNREVIEWED'` (line 203) — there
  is no second disposition value defined anywhere in this file.
- The serving boundary is `open-world-evidence-serving.js`: it enforces
  (fail-loud, not silent) that a row carrying the
  `OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER` is only ever rendered through
  `buildOpenWorldEvidenceCard`, never through `buildGovernedClaimSummaryCard`
  — per DECISIONS.md decision 2, so open-world content is never laundered
  into looking like a governed claim on the page.
- Live evidence: of 204 `resolution.json` files with an `open_world` key,
  **160 are non-empty**. The largest is
  `evidence/canonical-v2/skechers-key-defined-terms-20260808-rung4/resolution.json`
  with 194 open-world entries in one run. This is not an edge case; it is
  one of the most-exercised paths in the pipeline.
- **Promotion**: searched for any mechanism that moves a captured
  open-world candidate to a governed/mapped concept after the fact —
  `governed_concept_key` / `governed_claim_definition_key` appear in
  exactly one file in the whole tree,
  `bd837f1d-financing-source-open-world-pin.js`, a single hand-authored
  fixture pinning one exact quote with `disposition:
  'OPEN_WORLD_EXACT_EVIDENCE'`, `governed_concept_key: null`, and
  `reason: 'FINANCING_SOURCE_PROTECTION_NOT_YET_GOVERNED'` — i.e. it
  explicitly documents that this candidate is *not* promoted, not an
  example of promotion happening.
  `content-reviewed-definition-reclassification-contract.js` looked like a
  candidate on first read (has `old_owner`/`proposed_new_owner`) but on
  inspection it reclassifies which *family owns a defined term*, not
  open-world→governed promotion.
  Conclusion: **NOT BUILT.** The open-world disposition is fixed at write
  time and there is no code path anywhere in `lib/canonical-v2/` that
  changes it afterward. Uncertain whether promotion is planned but not yet
  built, or intentionally out of scope — would be settled by checking
  DECISIONS.md for decision 2's follow-on text or any related decision
  about open-world lifecycle beyond the write/serve boundary.

## 5. Evidence residuals

**Found. WIRED and RUNNING.** Nothing is silently dropped at the shaping
layer — every candidate that fails verification is recorded via
`dropCounter.record(reasonCode, rawText)` in
`native-producer/anthropic-provider.js`, which becomes a
`PROVIDER_EVIDENCE_RESIDUAL` entry (`residual_type`, `section_reference`,
`reason`, `quote_preview`, `evidence`) surfaced in each run's
`adapter-result.json`. The file's own comment on `shapeOpenWorldCandidate`
(capability 4) documents a real historical case of this discipline being
violated and then fixed: a bare-string open-world candidate returned `null`
without recording a residual, silently destroying 3 antitrust and 5
specific-performance candidates in the Step 2F2 baselines before the
2026-08-08 fix.

**Reason codes actually observed live**, from every `adapter-result.json`
residuals array in `evidence/canonical-v2/` (204 files scanned):
`OPEN_WORLD_CANDIDATE` (22 — captured, not a failure, but recorded as a
residual type), `None`/blank (15), `QUALIFIER_GOVERNS_PATH_OCCURRENCE_AMBIGUOUS`
(15), `OPEN_WORLD_QUOTE_UNVERIFIED` (9), `ATTRIBUTE_NOT_IN_ASSERTION_QUOTE`
(8), `NO_SHOP_WAVE_B_QUOTE_UNVERIFIED` (6), `IOC_RESTRICTION_QUOTE_UNVERIFIED`
(5), `NO_SHOP_PREREQUISITE_QUOTE_UNVERIFIED` (2),
`DEFINITION_ENVELOPE_TERM_UNVERIFIED` (2), `FEE_TRIGGER_QUOTE_UNVERIFIED`,
`DEFINED_TERM_LIMB_QUOTE_UNVERIFIED`, `DEFINITION_ENVELOPE_QUOTE_UNVERIFIED`,
`SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED`, `QUOTE_UNVERIFIED` (1
each). Note `resolution.json`'s top-level `residuals` array is almost
always empty (2 non-empty entries across all 204 files) — the residual
mechanism lives mainly at the shaping layer (`adapter-result.json`), not
the resolved-output layer.

**Full reason vocabulary defined in code** (not all exercised in the
current evidence corpus — this is the codebase's total surface, per the
brief's "enumerate every drop reason string" ask):

- `native-producer/anthropic-provider.js` (per-candidate shaping drops,
  31 fixed literals + 2 dynamic template ones): `BRING_DOWN_TIER_QUOTE_UNVERIFIED`,
  `CLOSING_CONDITION_QUOTE_UNVERIFIED`, `CONSIDERATION_QUOTE_UNVERIFIED`,
  `DEFINED_TERM_HEAD_QUOTE_UNVERIFIED`, `DEFINED_TERM_LIMB_QUOTE_UNVERIFIED`,
  `DEFINITION_ENVELOPE_QUOTE_UNVERIFIED`, `DEFINITION_ENVELOPE_TERM_UNVERIFIED`,
  `FEE_AMOUNT_LIMB_QUOTE_UNVERIFIED`, `FEE_AMOUNT_QUOTE_UNVERIFIED`,
  `FEE_TAIL_PERIOD_QUOTE_UNVERIFIED`, `FEE_TRIGGER_QUOTE_UNVERIFIED`,
  `FINANCING_QUOTE_UNVERIFIED`, `GENERAL_COVENANT_QUOTE_UNVERIFIED`,
  `GUARANTY_QUOTE_UNVERIFIED`, `IOC_RESTRICTION_QUOTE_UNVERIFIED`,
  `LIMB_ASSERTION_QUOTE_UNVERIFIED`, `MAE_CARVEOUT_QUOTE_UNVERIFIED`,
  `MAE_DISPROPORTIONALITY_QUOTE_UNVERIFIED`, `MAE_PRONG_QUOTE_UNVERIFIED`,
  `MATERIAL_CONTRACT_QUOTE_UNVERIFIED`, `NO_SHOP_ACTION_QUOTE_UNVERIFIED`,
  `NO_SHOP_PERIOD_QUOTE_UNVERIFIED`, `NO_SHOP_PREREQUISITE_QUOTE_UNVERIFIED`,
  `NO_SHOP_WAVE_B_QUOTE_UNVERIFIED`, `OPEN_WORLD_CANDIDATE_NOT_AN_OBJECT`,
  `OPEN_WORLD_QUOTE_UNVERIFIED`, `PROXY_MEETING_QUOTE_UNVERIFIED`,
  `QUALIFIER_ATTACHMENT_MALFORMED`, `QUALIFIER_GOVERNS_PATH_OCCURRENCE_AMBIGUOUS`,
  `QUALIFIER_QUOTE_UNVERIFIED`, `REGULATORY_EFFORTS_QUOTE_UNVERIFIED`,
  `REPRESENTATION_QUALIFIER_QUOTE_UNVERIFIED`,
  `SHARE_COUNT_GOVERNED_LIMB_OCCURRENCE_AMBIGUOUS`, `SHARE_COUNT_QUOTE_UNVERIFIED`,
  `SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED`,
  `TERMINATION_RIGHT_QUOTE_UNVERIFIED`, plus two dynamic
  `` `${type}_QUOTE_UNVERIFIED` `` / `` `${proposalKind}_QUOTE_UNVERIFIED` ``
  templates that expand per-family (assertion-level generic drop).
- `native-producer/candidate-resolution.js` (resolver-level ambiguity /
  unresolved-reference residuals — a different, larger vocabulary):
  `AMBIGUOUS_APPROVAL_KIND`, `AMBIGUOUS_CONDITION_KIND`,
  `AMBIGUOUS_EFFORTS_STANDARD`, `AMBIGUOUS_FEE_SIDE`,
  `AMBIGUOUS_PROXY_MEETING_KIND`, `AMBIGUOUS_REP_SIDE`,
  `AMBIGUOUS_TRIGGER_CORROBORATION`, `BURDEN_TERM_REF_MISSING`,
  `CARVEOUT_POSITION_UNMAPPED`, `CITATION_RELATIONSHIP_MINT_FAILED`,
  `DEFINED_DATE_CONFLICT`, `DUPLICATE_FACT_SIGHTING_MERGED`,
  `FAILED_OR_UNCERTAIN_EXTRACTION`, `FEE_AMOUNT_GROUNDS_CONDITION_AMBIGUOUS`,
  `FEE_AMOUNT_GROUNDS_REFERENCE_UNRESOLVED`,
  `GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED`,
  `IOC_PARENT_CHAPEAU_PARTY_UNRESOLVED`,
  `IOC_RESTRICTION_COMPONENT_ORDINAL_UNRESOLVED`,
  `IOC_RESTRICTION_COMPONENT_SPAN_AMBIGUOUS`, `LIMB_LOCAL_CARVEBACK_SCOPE_INVALID`,
  `MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED`, `MONTH_COUNT_UNRESOLVED`,
  `NOTIFICATION_TIMING_MISSING`, `PARTY_UNRESOLVED`, `PERCENT_UNRESOLVED`,
  `REPRESENTATION_QUALIFIER_ATTACHMENT_UNRESOLVED`,
  `REPRESENTATION_SIDE_PARTY_UNRESOLVED`, `REPRESENTATION_SIDE_UNRESOLVED`,
  `RULING_LEXICON_CONFLICT`, `SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT`,
  `TEMPORAL_MEASUREMENT_DATE_UNRESOLVED`, `UNMAPPED_GENERIC_CLAIM_KEY`,
  `UNRESOLVED_RESIDUAL`, `VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION`,
  `VOCABULARY_MISSING_MAPPED_CONCEPT`, `VOCABULARY_OR_SECTION_MISSING`,
  `YEAR_COUNT_UNRESOLVED`.
- Every other `native-producer/*.js` file also defines its own small set
  of `*_INVALID`/`*_MISSING`/`*_FAILED` codes (grep counts per file range
  1–16), but the great majority of these — especially in the `m3-*.js`
  files (`m3-source-scope-certification.js`: 16,
  `m3-12-call-pilot-quality-gate.js`: 16, `unified-runner-execute.js`: 16,
  `m3-final-pilot-synthesis.js`: 15, etc.) — are QA/audit/pilot-certification
  validation codes for the review process itself, not per-candidate
  evidence drop reasons. Distinguishing "did this text get dropped" codes
  from "did this audit check fail" codes across every one of those ~55
  files exhaustively was not completed in the time available; **uncertain**,
  and the file-by-file counts above are the starting point for anyone who
  needs the complete list.

## 6. Party / scope derivation

**Found. WIRED and RUNNING.**

`native-producer/candidate-resolution.js` has a two-function party
derivation core:
- `resolvePartyCapacity(rawValue)` (line 1485): maps a raw party string
  (e.g. "the Company", "Parent", "Parent OpCo") to a canonical capacity
  (`TARGET`/`BUYER`) via ordered lexicons (`PARTY_CAPACITY_LEXICON`,
  `PARTY_CAPACITY_SEGMENT_LEXICON`). It splits multi-party lists into
  segments (`segmentPartyListString`) to detect genuinely joint
  obligations, returning a `JOINT_MULTI_PARTY_CAPACITY` sentinel when a
  list spans more than one side, and `null` (fail closed, no guess) when
  nothing matches.
- `resolveParty({attributes, mapping})` (line 1529): wraps a resolved
  capacity into a frozen `{role, value, capacity}` party object —
  deliberately exactly three keys, per `source-structure.js`'s
  `assertParty`, which the file's comment says was proven the hard way
  (a broken test after an earlier version tried to add a fourth key).
- Party resolution is what gates several families' claims into
  `review_queue` when it fails: `PARTY_UNRESOLVED` (raw party string
  present but capacity not resolvable — the module header calls this out
  explicitly as step 1's own rule: "a proposal whose party cannot be
  mechanically determined is never guessed"), and family-specific variants
  such as `REPRESENTATION_SIDE_UNRESOLVED` / `REPRESENTATION_SIDE_PARTY_UNRESOLVED`
  (representations family, lines 9178/9190) and `OBLIGOR_REF_UNCORROBORATED`
  / `OBLIGOR_SCOPE_UNCORROBORATED` (obligation-bearing families).
- Live evidence: `evidence/canonical-v2/redhat-representations-20260808-r1/resolution.json`
  has 26 resolved provisions with `"capacity": "TARGET"`; no
  `JOINT_MULTI_PARTY_CAPACITY` sentinel appears anywhere in the evidence
  corpus (`grep -rl` across all 204 `resolution.json` files returns
  nothing), so the joint-party path exists in code but was not observed
  firing on real deal text in the runs captured so far — **uncertain**
  whether that's because no captured deal actually has a joint-obligation
  sentence in a family that reaches this code, or because the joint path
  has a latent gap; would be settled by a synthetic fixture with a genuine
  "Company and Parent shall..." joint sentence run through resolution.

## 7. Topology

Skipped per instructions — owned by a separate agent.

## 8. The family registry

**Found. WIRED and RUNNING for all 25.**

`lib/canonical-v2/native-producer/producer-prompt-registry.js` (173 lines)
is the single dispatch seam: a frozen `Map` (`REGISTRY`, line 117) from
`section_family` string to producer-prompt builder function, exposed only
through `getProducerPromptModule` (fails closed — returns `null`, never
falls back to another family) and `listRegisteredSectionFamilies`. The
file's own header explicitly warns against trusting its prose count
("this header has not always kept up with the count; check REGISTRY
itself, not this sentence") — read as an instruction, and the registry
itself was read, not the header.

**Exactly 25 entries, exact names:**
`CAPITALISATION`, `TERMINATION_FEE`, `NO_SHOP`, `MAE_DEFINITION`,
`TERMINATION`, `ANTITRUST_REGULATORY`, `MERGER_STRUCTURE_CLOSING`,
`FINANCING_COVENANTS`, `GUARANTY_FINANCING_PARTY`, `EMPLOYEE_MATTERS`,
`DNO_INDEMNIFICATION`, `TAX_MATTERS`, `DIVIDENDS`,
`APPRAISAL_DISSENTERS_RIGHTS`, `SPECIFIC_PERFORMANCE_REMEDIES`,
`MISC_BOILERPLATE`, `KEY_DEFINED_TERMS`, `REPRESENTATIONS`,
`CONSIDERATION`, `CLOSING_CONDITIONS`, `PROXY_MEETING`,
`INTERIM_OPERATING`, `MATERIAL_CONTRACTS`, `NO_OTHER_REPS_FRAUD`,
`GENERAL_COVENANTS`.

**Every one of the 25 has at least one matching evidence directory under
`evidence/canonical-v2/`** (checked by substring match against all 222
evidence directory names, one query per family — lowest count was
`CAPITALISATION` with 5 matching dirs, most families have 6-18). This
confirms the registry is not just built and wired but has actually run,
for every registered family, on real deal text — not merely "25
registered" but 25 with evidence receipts on disk.

## 9. Byte-offset handling

**Found. WIRED and RUNNING.**

`lib/canonical-v2/canonical-bytes.js` exports `utf8ByteLength(value)` and
`utf8Slice(value, start, end)`. `utf8Slice` takes half-open **byte**
offsets (not UTF-16 string indices), slices a `Buffer.from(value, 'utf8')`
by byte, decodes it back to a string, and — critically — verifies the
decoded string re-encodes to exactly the same bytes, throwing
`RangeError: UTF-8 slice offsets must fall on code-point boundaries`
if the caller's offsets split a multi-byte character. This is the
precise conversion helper CLAUDE.md's "Byte offsets, not string indices"
warning refers to.

Required in 53 files across `lib/` (e.g. `exact-detail.js`,
`serving-exact-detail.js`, `composition-exact-detail.js`,
`definition-graph.js`, `source-structure.js`, and the native-producer
quote-verification path via `locateQuoteBytes`/`locateAllQuoteBytes` in
`native-producer/anthropic-provider.js`, which use `Buffer`-based byte
spans consistent with this helper's contract) plus `canonical-bytes.js`
itself and additional `native-producer/candidate-resolution.js` usage —
this is one of the most widely depended-on modules in the whole
`canonical-v2` tree.

## 10. Publish / hold-back criteria

**Found. WIRED and RUNNING, and directly answers the "reasons" ask.**

`native-producer/candidate-resolution.js`'s own header (lines 40-99) states
the AUTO-PASS test exhaustively: a candidate is published directly (not
held back) only if it has **all** of:
1. a registered concept AND claim definition,
2. a registered `canonical_value`,
3. a resolved party (capability 6),
4. no known-defect match (`matchesKnownDefect` against
   `known-defect-registry.js`),
5. exactly one evidence span with role `OPERATIVE_TEXT` (the mechanical
   proxy for "not multi-span/composed" and "not a nested or
   cross-referenced definition"),
6. no residual already retained by `claims-relationships.js`'s own
   attribute/taxonomy check.

**Everything else lands in `review_queue`** (held back from publish),
ranked by `MATERIALITY_TABLE`, each item carrying `has_resolution: false`,
`auto_pass: false`, and a `reasons[]` array of typed codes
(`pushReviewUnresolved`, line 5529).

**Reason families, enumerated from the header plus live evidence
(`review_queue[].reasons` across all 204 `resolution.json` files, 3,133
total review-queue items):**
- **Party unresolved**: `PARTY_UNRESOLVED` (38 live occurrences),
  `REPRESENTATION_SIDE_UNRESOLVED`/`REPRESENTATION_SIDE_PARTY_UNRESOLVED`.
- **Citation not validated**: `CITATION_NOT_VALIDATED` — neither
  constructed from the sectionizer's tree nor corroborated by the
  document's own cross-reference text.
- **Structural-span gates**: `MULTI_SPAN_COMPOSED` (89),
  `NESTED_OR_CROSS_REFERENCED_EVIDENCE` (89).
- **Family-specific corroboration failures** (candidate's canonical value
  checked against its own quote text) — by far the largest category live:
  `LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE` (699 — largest single reason in the
  corpus), `IOC_ATTACHMENT_TARGET_QUOTE_MISSING` (171),
  `QUALIFIER_KIND_UNCLASSIFIED` (144), `CATEGORY_UNCORROBORATED` (105),
  `TERMINATING_PARTY_REF_NOT_IN_QUOTE` (60),
  `IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED` (59),
  `CLAUSE_LABEL_NOT_IN_QUOTE` (58), `FEE_SIDE_UNCORROBORATED` (44),
  `PROXY_MEETING_KIND_UNCORROBORATED` (44), `IOC_NUMERIC_OPERAND_NOT_EXACT` (37),
  `DNO_KIND_UNCORROBORATED` (37), `NO_SHOP_PREREQUISITE_UNCORROBORATED` (35),
  `CONDITION_KIND_UNCORROBORATED` (35), `ASSERTION_KIND_UNCORROBORATED` (35),
  `TRIGGER_UNCORROBORATED` (32), `MAE_CARVEOUT_UNCORROBORATED` (26),
  `NO_SHOP_PERIOD_ROLE_UNCORROBORATED` (23), `DEFINED_TERM_REF_NOT_IN_HEAD` (23),
  `TRIGGER_KIND_UNCORROBORATED` (21), `PER_SHARE_CONTEXT_UNCORROBORATED` (21),
  `QUALIFIER_KIND_DISAGREEMENT` (20), `NO_SHOP_ACTION_UNCORROBORATED` (18),
  `CONSULTATION_RIGHT_UNCORROBORATED` (18),
  `NOTIFICATION_OBLIGATION_UNCORROBORATED` (18),
  `RECOMMENDATION_CHANGE_ACTION_UNCORROBORATED` (17),
  `OBLIGOR_REF_UNCORROBORATED` (17), `OBLIGOR_REF_NOT_IN_QUOTE` (14),
  `OBLIGOR_SCOPE_UNCORROBORATED` (13), `MEETING_REF_ABSENT` (12),
  `ITEM_OR_STANDARD_UNCORROBORATED` (11), `EMPLOYEE_KIND_UNCORROBORATED` (9),
  `FILING_REGIME_NOT_SINGLE_NAMED_REGIME` (8), `REP_SIDE_UNCORROBORATED` (8),
  `INFORMATION_SHARING_OBLIGATION_UNCORROBORATED` (8),
  `CONTROL_PARTY_REF_ABSENT` (8), `STANDSTILL_ACTION_UNCORROBORATED` (7),
  `NO_SUBSTITUTION_GRAMMAR` (7), plus a longer tail below these counts.
- **Negation-boundary guard**: a claim whose quote's own byte-verified
  position in the filed document sits just past a negation ("would not",
  "in no event", a closed "no <noun>" list) that the quote itself doesn't
  include — wired into `BRING_DOWN_TIER_CLAIM_KEY` resolution specifically
  (the one path with no lexicon/pattern check tying raw to canonical
  value), and the header notes it was investigated for and *deliberately
  not* wired into the representation-qualifier ACCURACY path because real
  Modiv text false-positived there.
- **Known-defect match**: routed differently from a fresh review-queue
  item (see `known-defect-registry.js`) — not counted in the reasons
  tally above; not fully traced in the time available.

**On the brief's "96 held-back items under review" claim**: could not
locate or reproduce a figure of exactly 96 anywhere in
`evidence/canonical-v2/` or `lib/canonical-v2/`. The live aggregate across
every evidence run is 3,133 review-queue items total (204 runs); 96 would
have to be a filtered subset (one deal, one family, or a live DB query
outside this evidence corpus) that this read-only code/evidence sweep
cannot independently confirm. **Uncertain** — would be settled by knowing
which deal/family/date the 96 figure comes from and checking that specific
evidence directory or the live `review_queue` DB table directly.
