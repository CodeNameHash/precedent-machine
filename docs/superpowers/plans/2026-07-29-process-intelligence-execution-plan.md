# Process Intelligence execution plan

## Source of record

This plan and its companion design are source records. Commit each amendment to
the Deal Storylines repository under `docs/superpowers/plans/` or
`docs/superpowers/specs/`. After each committed amendment, update the SHA-256
reference in Precedent Machine's `docs/codex-program/EXECUTION-LEDGER.md` to
name that committed copy.

## Objective

Convert the approved Process Intelligence product and legal design into
bounded implementation tasks.

The first product gives a lawyer:

- checked natural-language search;
- guided Domain, Topic and Pattern navigation;
- all valid PM fields through a searchable filter editor;
- verbatim precedent passages;
- repeat-click source context;
- related drafting from the same proxy; and
- PM shared facts with exact source actions.

It does not give a narrative language-model answer.

## Exact basis

- PM `origin/main`:
  `c920ce6e3b037cf2352d77f7d3534d5bc363819a`
- Process design SHA-256:
  `1bbdd0cf86ffb927d1024878d6a062009f1f87ed7d320e45febbf63fb7213f18`
- Shared authority design SHA-256:
  `7dd9552c2634e4f64f0fc662f40002879fd6fca595a2394d8e3eb27baf35dbbe`
- Product acceptance design SHA-256:
  `e13bf1594119e9bef23811dfeae5f462232e59c602a15f838a4b18340d29a7b6`
- Parent programme plan before this amendment SHA-256:
  `cf21d4bcbd77eab3fbe794f73338748327402a62a5e75315d3041214f1c8ebb7`
- Shared authority plan:
  `docs/superpowers/plans/2026-07-29-shared-deal-facts-and-entity-authority-plan.md`

The current PM product-baseline files still have the exact approved digests.

## Gate state

The protected V2 publication passed the repository's schema, signature,
registry, executable, tree and commit-binding checks.

The verified work states are:

- `implementation_planning: PASS`;
- `canonical_work_start: PASS`;
- `vertical_slice_execution: OPEN`;
- `candidate_scope_and_extraction: OPEN`; and
- all production work classes `OPEN`.

`OPEN` means not yet permitted.

This plan permits generic code and contract work after plan review. It does not
permit a public-deal vertical slice, broad extraction, import or production
activation.

## Fixed implementation rules

1. Use the canonical successor input compiler.
2. Keep frozen fixture contracts V1 through V12 byte-identical.
3. Use one shared fact projection.
4. Use one PM-wide product field catalogue.
5. Use one PM-wide Query IR.
6. Make Ask and Browse compile to the same Query IR.
7. Use checked phrase mappings. Do not use a narrative language model.
8. Serve exact passages as the default answer.
9. Precompute related-passage relationships. Do not invent them in the
   browser.
10. Bind context actions to a parent result. Do not accept caller offsets.
11. Keep all candidate and production controls disabled until their gates
    pass.
12. Treat Storylines as prototype evidence only.

## Execution units

Each package below is a programme group. It is not one large pull request.

Before a code unit starts:

1. create a dedicated `wp/<name>` branch;
2. add one exact `.github/phase-allowlists/wp-<name>.json`;
3. name the required work class in the allowlist;
4. list the exact files that the unit can change;
5. revalidate the protected programme status; and
6. stop if the required work class is not `PASS`.

Each unit changes one contract family or one implementation seam and its
focused tests. Do not combine authored contracts, deal evidence, extraction,
user-interface code and release changes in one unit.

## Review and handoff protocol

Each handoff runs focused tests, the affected-chain suite and one cheap Stage 2
review. Stage 2 checks conformance with the stated files, contracts and tests.
It is not an independent adversarial review. Stage 3 escalation occurs only
for a finding about legal semantics or identity.

There are at most three independent adversarial review events for this
programme:

1. WP3A pre-freeze;
2. vertical-slice completion, only if WP3A did not already cover that work;
   and
3. pre-activation.

Each review examines the diff since the last reviewed state and regresses prior
finding dispositions. It does not re-review the complete root byte-for-byte.
No handoff, integration or other event can become a review milestone.

## P-1: add a permanent read-only gate check

### Files

- Add `scripts/verify-programme-status-publication.mjs`.
- Add `tests/programme-gates/programme-status-consumer.spec.js`.

### Tasks

1. Fetch `origin/main` and
   `refs/heads/programme-status-publication-head`.
2. Require the exact two-file tree.
3. Validate both schemas with the repository schema registry.
4. Validate both signatures with the real trusted public keys.
5. Validate the status-to-head blob, digest, artefact and generation bindings.
6. Validate the governing registry, validator configuration and validator
   executable bindings.
   Compute these bindings from the exact `origin/main` tree. Do not compute
   them from an implementation branch.
7. Require `status.code_commit` to equal `origin/main`.
8. Recompute the work-class projection from the signed gate states.
9. Print the permitted work classes without changing a file or ref.
10. Fail closed on an absent, stale, malformed or invalid publication.

### Gate

Every later execution unit uses this command before it starts.

### Merge rule

An implementation branch does not change the protected status by itself.

After a branch merges, `origin/main` has a new commit. The existing signed
status then becomes stale because its `code_commit` names the old commit.
Stop gated work until the protected publisher validates the new main commit
and publishes a valid successor status.

## P0: freeze product and prototype baselines

### Files

- Add `scripts/process-intelligence-baseline.mjs`.
- Add `tests/process-intelligence-baseline.test.js`.
- Generate
  `evidence/process-intelligence/baseline/product-field-source-inventory.json`.
- Generate
  `evidence/process-intelligence/baseline/storylines-evidence-inventory.json`.

### Tasks

1. Enumerate all 15 current Deals-table fields.
2. Enumerate the eligible Agreement field universe.
3. Resolve aliases.
4. Record one inclusion or exclusion disposition for each field.
5. Give `SEC_FILING_MEETING` an express disposition.
6. Pin the Storylines code and ledger evidence named in the parent plan.
7. Record each useful Storylines vocabulary item, correction and failure case.
8. Fail if an input has no disposition.

### Gate

The closed baseline is content-addressed. It grants no canonical authority.

## P1: author Process successor inputs

### Files

- Add authored inputs under
  `contracts/canonical-v2/successor/process/`.
- Extend the one root
  `contracts/canonical-v2/successor/manifest.json`.
- Add `scripts/generate-canonical-v2-successor-manifest.mjs`.
- Add `tests/canonical-v2-successor-manifest.test.js`.
- Add `lib/canonical-v2/process-contract-input-validator.js`.
- Extend `lib/canonical-v2/canonical-contract-input-compiler.js` only for new
  governed kinds.
- Add `tests/canonical-v2-process-contract-input.test.js`.

### Required members

- Process domain registry entry.
- `ProcessNarrationOccurrence`.
- `PROCESS_NARRATION` expected occurrence slot.
- Process event, participant, bidder-track, phase, position, agreement,
  relationship and passage definitions.
- Exclusivity predicate and result definitions.
- `TemporalExpression`.
- `ProcessPhrasebookPassageResult`.
- Bounded inline passage preview.
- Parent-bound paragraph context action.
- Related-passage child collection.
- Source acquisition and completeness contracts.
- Process integrity revocation cause and containment policy.
- `PROCESS_VERTICAL_SLICE_PASS`.
- Process field definitions and Process navigation definitions for the one
  PM-wide catalogues.
- Ask and Browse Query IR contracts.
- Saved-search, citation, export and active-release rerun contracts.
- `PROCESS_VERTICAL_SLICE_PASS` gate and evidence bindings in:
  - `docs/codex-program/programme-gates.yaml`;
  - `lib/programme-gates/registry.js`;
  - `lib/programme-gates/schema-registry.js`;
  - `lib/programme-gates/predicates.js`;
  - `lib/programme-gates/test-executable-registry.js`; and
  - the matching programme-gate tests.

### Tests

- Two clean compiles produce equal canonical bytes and fingerprint.
- Missing, extra, duplicate or reordered members fail.
- A second or nested manifest fails.
- An unknown domain, topic, pattern, predicate, field, operator, event or
  source role fails.
- A Process definition grants no writer or serving authority by itself.
- V1 through V12 fixture fingerprints remain unchanged.

### Gate

The complete Process input set compiles without deal data.

## P2: bind the shared authority

### Files

- Add
  `lib/canonical-v2/shared-authority-consumed-contract-manifest.js`.
- Add `lib/canonical-v2/process-deal-fact-projection.js`.
- Add
  `tests/canonical-v2-process-shared-authority-integration.test.js`.

### Tasks

1. Pin the approved shared design digest.
2. Pin the generated `CanonicalDealFactProjection` schema and digest.
3. Pin required shared fields, frozen pair, namespace, release and
   compatibility rule.
4. Read the shared projection only.
5. Carry typed missing, conflict and exact-detail states.
6. Carry combination parties, selling shareholders, structures, transaction
   legs, control outcomes and share-purchase components.
7. Carry role-aware professional assignments.
8. Make WP3A fail if a promised shared projection is absent or incompatible.
9. Permit a reduced release only after the exact scope decision removes the
   field and control before freeze.

### Tests

- Equity value, value basis, counsel, lawyers and advisers agree across
  filters, cards, table view, export and source actions.
- A press-release equity value opens the exact press release.
- Pfizer and Novo professional assignments cannot cross bidder tracks.
- A merger of equals cannot invent a buyer.
- Reverse merger, Reverse Morris Trust and share-purchase components cannot
  cross-join.
- A legacy string cannot satisfy a canonical shared filter.

### Gate

Every promised shared field has one compatible released projection or is
expressly removed before freeze.

## P3: implement generic Process objects and exclusivity semantics

### Files

- Add `lib/canonical-v2/process-narration-occurrence.js`.
- Add `lib/canonical-v2/process-event.js`.
- Add `lib/canonical-v2/process-bidder-track.js`.
- Add `lib/canonical-v2/process-relationship.js`.
- Add `lib/canonical-v2/process-temporal-expression.js`.
- Add `lib/canonical-v2/process-exclusivity-contract.js`.
- Add focused tests named `tests/canonical-v2-<module-name>.test.js`.

### Tasks

1. Build pure constructors and validators from the successor contract.
2. Fix narration identity before value extraction.
3. Keep source narration, real-world event and later retelling separate.
4. Bind every participant to a typed event role and bidder track.
5. Keep source-local participants useful without false entity unification.
6. Preserve exact temporal words and spans.
7. Use structured time nodes only for admitted observed forms.
8. Implement distinct states for request, express refusal, counterproposal,
   conditional acceptance, grant, extension, amendment, waiver and ending.
9. Keep exclusivity subject explicit.
10. Keep unsupported semantics as governed residuals.

### Tests

- A request cannot become a grant.
- Silence cannot become an express refusal.
- A shortened or conditional response cannot become an outright refusal.
- Exclusive data access cannot become negotiation exclusivity.
- Same-day proximity cannot supply a date.
- A retelling cannot create a second event without a separate occurrence.
- Matching date and economics cannot unify a bidder.
- An extracted value cannot define event identity or ordinal.

### Gate

Every mandatory exclusivity question compiles to one complete semantic
contract.

## P4: implement one field catalogue, navigation catalogue and Query IR

### Files

- Add `lib/canonical-v2/product-field-catalogue.js`.
- Add `lib/canonical-v2/process-navigation-catalogue.js`.
- Add `lib/canonical-v2/process-query-ir.js`.
- Add `lib/canonical-v2/process-ask-compiler.js`.
- Add `lib/canonical-v2/process-browse-compiler.js`.
- Add `lib/canonical-v2/process-filter-compiler.js`.
- Extend `lib/canonical-v2/query-result.js`.
- Extend `lib/canonical-v2/query-api-handler.js`.
- Add focused tests for each module.

### Tasks

1. Generate `ProductFieldCatalogueManifest` from one exact source registry.
   This is PM-wide output. It is not a Process-owned authority.
2. Include all 15 current Deals-table fields.
3. Enumerate every eligible Agreement field and record all exclusions.
4. Generate stable field groups and supported control types.
5. Generate Domain, Topic and Pattern from the navigation catalogue.
6. Compile Ask and Browse to byte-equivalent Query IR.
7. Use checked phrases, synonyms, abbreviations and ordinary misspellings.
8. Require a legal choice for ambiguity.
9. Refuse unsupported or legally adjacent questions.
10. Bind fields to domain, result type, scope, multiplicity, completeness,
    operator and release admission.
11. Implement same-component, same-event and same-track filtering.
12. Implement non-vacuous three-valued repeatable-set semantics.
13. Keep selected values visible while a filter is edited.
14. Offer only admitted values that occur after other filters apply.
15. Compile saved searches, links and explicit reruns through the same Query IR.

### Gate

Product acceptance tests 1 through 25 and 54 through 64 pass against one
catalogue digest and one approved PM data version.

## P5: implement passage serving, context and related drafting

### Files

- Add `lib/canonical-v2/process-phrasebook-result.js`.
- Add `lib/canonical-v2/process-passage-order.js`.
- Add `lib/canonical-v2/process-paragraph-context.js`.
- Add `lib/canonical-v2/process-related-passages.js`.
- Extend `lib/canonical-v2/shared-serving-row.js`.
- Extend `lib/canonical-v2/shared-row-adapter.js`.
- Extend `lib/canonical-v2/exact-detail.js`.
- Extend `lib/canonical-v2/serving-client.js`.
- Add focused serving and detail tests.

### Tasks

1. Serve one exact passage per result.
2. Return bounded inline exact text with the row.
3. Keep exact citation and source identity.
4. Order direct evidence before contextual or retold evidence.
5. Diversify 8 to 12 first-page results by deal and bidder track.
6. Add parent-bound, repeat-click paragraph expansion above and below.
7. Stop at the frozen context limit.
8. Add precomputed related-passage children with checked relationship labels,
   verbatim previews and source actions.
9. Isolate a malformed row or failed detail.
10. Keep coverage, exclusions and certification in the response.

### Tests

- A caller cannot select a byte or paragraph offset.
- Repeated expansion preserves the selected evidence and paragraph order.
- An invalid context cursor affects only that request.
- A related classification cannot replace actual drafting.
- A phrasebook `CLAIM` row cannot act as a result parent.
- A result set cannot pad with repeated passages.
- A failed detail cannot remove valid sibling rows.

### Gate

Product acceptance tests 26 through 48, 69, 70, 74, 75 and 76 pass.

## P6: implement the PM interface against immutable fixtures

### Files

- Add `components/process/ProcessResearchSurface.jsx`.
- Add `components/process/ProcessAsk.jsx`.
- Add `components/process/ProcessBrowse.jsx`.
- Add `components/process/ProcessFilterEditor.jsx`.
- Add `components/process/ProcessFilterSentence.jsx`.
- Add `components/process/ProcessPassageList.jsx`.
- Add `components/process/ProcessPassageCard.jsx`.
- Add `components/process/ProcessResultsTable.jsx`.
- Add `components/process/ProcessSourceReader.jsx`.
- Add `components/process/ProcessRelatedPassages.jsx`.
- Add `components/process/ProcessCoverageState.jsx`.
- Integrate through `pages/index.js`,
  `components/query/QueryLaunchBox.jsx` and the canonical query result page.
- Add component, browser, accessibility and visual tests.

### Tasks

1. Make Ask and Browse equal entry modes.
2. Make the selected Browse item control the next list.
3. Stop the hierarchy after Pattern.
4. Show only a small relevant filter set first.
5. Put the complete valid field set in searchable `More filters`.
6. Show active filters as one editable sentence.
7. Do not use a large field of pills.
8. Show answer-first verbatim passages.
9. Offer table view without a second query.
10. Keep a persistent desktop source reader.
11. Use a full-screen mobile source reader.
12. Make context controls repeat-clickable.
13. Keep actual related drafting available.
14. Add copy citation, share, export, save, rerun and authorised correction
    actions.
15. Use PM design language. Do not copy the Fable layout.
16. Keep CVR hidden until its contracts and release admission exist.

The live entry point is `pages/index.js`, which currently renders
`components/query/QueryLaunchBox.jsx`. `pages/query/index.js` currently
redirects to the live entry point. Do not build the new surface only in the
redirected page.

### Gate

Product acceptance tests 49 through 53, 65 through 73 and all applicable
earlier interaction tests pass in desktop and mobile browsers.

## P7: author acquisition, discovery and extraction machinery

Generic machinery can be implemented under `canonical_work_start`. It cannot
run public-deal extraction while `candidate_scope_and_extraction` has state
`OPEN`.

### Files

- Add `lib/canonical-v2/process-source-acquisition.js`.
- Add `lib/canonical-v2/process-sec-completeness-oracle.js`.
- Add `lib/canonical-v2/process-scope-enumerator.js`.
- Add `lib/canonical-v2/process-semantic-enumerator.js`.
- Add `lib/canonical-v2/process-lexical-enumerator.js`.
- Add `lib/canonical-v2/process-candidate-graph.js`.
- Add `lib/canonical-v2/process-candidate-validator.js`.
- Add focused synthetic and hostile-source tests.

### Tasks

1. Keep production acquisition independent from the SEC oracle.
2. Reconcile exact accession membership.
3. Require explicit non-SEC expected-source manifests.
4. Keep scope enumeration separate from event enumeration.
5. Keep semantic and lexical event enumerators independent.
6. Freeze expected occurrence slots before value extraction.
7. Retain candidates, rejections, residuals and disagreement.
8. Bound model attempts, bytes, runtime and memory.
9. Sandbox hostile filing and archive input.

### Gate

Synthetic tests pass. No public-deal extraction has run while
`candidate_scope_and_extraction` is `OPEN`.

## PE1: run the independent Metsera evidence lane

This evidence lane starts now and is independent of PM programme-status
health. It runs in parallel with generic contract and fixture code. Its outputs
are inert, content-addressed artefacts. It does not use extractor output and
does not write a candidate graph.

### Files

- Generate
  `evidence/process-intelligence/metsera/source-universe-manifest.json`.
- Generate sealed source-only review packages outside extractor inputs.
- Add reviewed test fixtures only after the independent reader seals and
  releases them.

### Tasks

1. Freeze the exact admitted Metsera source universe and cutoff.
2. Use two independent source-only enumerations.
3. Seal exact exclusivity passages before extractor comparison.
4. Label parties, bidder tracks, roles, dates, states and relationships.
5. Record known negatives and tempting false matches.
6. Seal related discussions and paragraph context units.
7. Keep the evidence readers separate from extractor and candidate roles.
8. Keep case-level answers unavailable to extractor tasks until the planned
   comparison point.
9. Export the content-addressed Storylines ledger snapshot.
10. Pre-register the certification sampling frames.

Gold construction is the critical path. Start it now. Keep dual enumeration,
the sealed-before-extractor ordering, the owner-hours budget and delegation
rules. Extraction or certification may consume only a sealed gold artefact.

O5 disposition superseded: the PM gate apparatus was retired on 30 July 2026.
Gold construction is inert evidence work. The consumption gate remains.

### Gate

The Metsera gold package is independent, source-exact and sealed. It grants no
writer, extraction or release authority. An unsealed package cannot enter an
extractor or certification input.

## P8: freeze, review and run bounded same-pair slices

### Tasks

1. Complete P0 through P7 contract bytes and tests.
2. Complete the shared authority scope decision.
3. Compile one Agreement-plus-shared-authority-plus-Process root.
4. Run delta review with regression of every prior disposition.
5. Run the WP3A pre-freeze independent adversarial review. It covers the diff
   and prior dispositions. Do not add another review event unless the
   vertical-slice completion review is not already covered.
6. Obtain Ben approval for that exact root.
7. Issue the full-bundle `ContractFreezeAttestation`.
8. Wait for `vertical_slice_execution: PASS`.
9. Rerun the bounded Agreement slice.
10. Run the bounded Process-bearing slice.
11. Record fresh same-pair `P1_VERTICAL_SLICE_PASS` and
    `PROCESS_VERTICAL_SLICE_PASS`.

### Gate

Broad Process work remains blocked until protected status shows
`candidate_scope_and_extraction: PASS`.

## P9: run Metsera and stratified certification

This package starts only after `candidate_scope_and_extraction: PASS`.

### Tasks

1. Verify the sealed PE1 Metsera source and gold identities.
2. Run the candidate extractor once against the sealed Metsera package.
3. Test every product requirement promised by the WP3A scope.
4. Keep Pfizer and Novo tracks separate.
5. Verify related passages, repeated context, source actions and shared facts.
6. Run the pre-registered 25-deal tuning and untouched holdout programme.
7. Classify each mismatch.
8. Do not repair or rerun a failed generalisation holdout.
9. Choose a passed general claim or an expressly limited exact-corpus claim.

### Gate

Every released mandatory predicate and product action passes certification.

## P10: performance, Tier A containment and inactive release

### Tasks

1. Prove the fixed latency and capacity limits.
2. Prove one admission check and at most one bounded serving query.
3. Prove no broad Node or browser filtering.
4. Prove stable cursors and cache isolation.
5. Keep staging and production credentials separate. Do not place service
   credentials in a client or an evidence artefact.
6. Keep the Process route-off flag. Do not run extraction or writes against
   production outside the governed importer.
7. Build one inactive whole successor candidate release.
8. Prove logical, physical, query, render, export and trace parity.
9. Keep Storylines read-only until PM replacement acceptance passes.

### Gate

No import occurs until `production_import: PASS`.

## P11: import and activation

### Tasks

1. Import only into an inactive production namespace.
2. Complete every Phase 9 proof.
3. Run the pre-activation independent adversarial review. It covers the diff
   and prior dispositions.
4. Obtain the exact one-use cutover authorisation.
5. Activate the whole Agreement and Process tuple.
6. Run post-cutover smoke checks.
7. Roll back the whole tuple on an identity, source, evidence or semantic
   mismatch.

### Gate

Activation completes only when the protected status and active release record
the exact certified tuple.

## P12: post-cutover attacker-model security hardening

This phase starts after cutover. It is not a pre-activation gate for this
internal single-user product. Pre-cutover risk is accidental corruption or
leakage. P10 Tier A controls address that risk.

P12 retains, without weakening, these deferred requirements:

1. whole-tuple revocation service-level agreements and serving-fence machinery
   beyond the route-off flag;
2. authorisation-matrix attestations;
3. route and action inventory proofs;
4. default-deny probe suites;
5. egress certification; and
6. signed attestations of access controls.

Data-integrity controls remain pre-activation requirements. They include
fail-closed serving, release parity, drift detection, sampling audits and
recertification triggers.

## Product acceptance trace

| Acceptance tests | Implemented by |
| --- | --- |
| 1-8 catalogue | P0 and P4 |
| 9-14 Ask and Browse | P4 |
| 15-25 filters and shared facts | P2 and P4 |
| 26-31 results | P5 |
| 32-38 source reader | P5 and P6 |
| 39-48 citations, export and failure | P4 through P6 |
| 49-53 speed and accessibility | P6 and P10 |
| 54-59 saved searches and corrections | P4 and P6 |
| 60-64 language and growth | P4 |
| 65-68 visual and future domain | P6 |
| 69-76 interaction details | P2, P4, P5 and P6 |

Every test runs against one exact approved PM data version and one exact
product field catalogue digest.

## First implementation batch after plan review

The first code sequence has three separate units:

1. P-1, the permanent read-only gate check;
2. P0, the current field baseline; and
3. the contract-only part of P1.

The Storylines evidence inventory is a separate P0 unit from the PM field
inventory. The P1 unit creates the closed Process successor members, updates
the one root manifest, adds the new input validators, proves deterministic
compilation and proves that fixture contracts V1 through V12 did not change.

Stop after these units for delta review. PE1 can continue in its isolated
evidence lane. Do not run an extractor or write candidate data.

## Estimate

| Package | Team hours | Ben hours |
| --- | ---: | ---: |
| P0 baseline | 20-35 | 0 |
| P1 contracts | 100-170 | 2-4 |
| P2 shared integration | 50-90 | 1-2 |
| P3 Process semantics | 70-120 | 6-10 |
| P4 catalogue and query | 100-170 | 1-2 |
| P5 passage serving | 80-130 | 0-1 |
| P6 interface | 100-160 | 2-4 |
| P7 generic acquisition and extraction | 160-260 | 0 |
| P8 review, freeze and slices | 80-140 | 2-4 |
| P9 certification | 220-380 | 15-22 |
| P10 release hardening | 120-200 | 2-4 |
| P11 import and activation | 50-90 | 2-4 |

These are planning ranges. They are not dates.

## Verification

Run focused tests after each task. At each package gate run:

```bash
npm test
npm run verify:codex-program
```

Before freeze, compile the complete successor input twice and compare exact
canonical bytes and fingerprint.

## Completion rule

Process Intelligence is complete only when the active whole PM release serves
checked verbatim precedents through one shared field, query, source, entity and
release system.
