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
| 4 | Open-world candidate handling | TBD | | |
| 5 | Evidence residuals / drop reasons | TBD | | |
| 6 | Party / scope derivation | TBD | | |
| 7 | Topology | SKIPPED (owned by another agent) | | |
| 8 | Family registry | TBD | | |
| 9 | Byte-offset handling | TBD | | |
| 10 | Publish / hold-back criteria | TBD | | |

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
