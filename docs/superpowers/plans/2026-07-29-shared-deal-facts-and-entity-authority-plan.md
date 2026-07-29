# Shared Deal Facts and Entity Authority implementation plan

## Objective

Build one PM authority for entity identity, transaction roles, deal facts,
economics and professional assignments. Agreement, Process and future CVR
domains will read the same released projection.

This plan does not create a Process-owned fact store. It does not admit legacy
text fields as canonical facts.

## Approved basis

- Approved design:
  `docs/superpowers/specs/2026-07-27-shared-deal-facts-and-entity-authority-design.md`
- Approved design SHA-256:
  `7dd9552c2634e4f64f0fc662f40002879fd6fca595a2394d8e3eb27baf35dbbe`
- Process consumer design SHA-256:
  `1acbcafd211c1f90492164db655d1bda02faa0470ca29f3bd5f75bc8cf4cca15`
- Product acceptance design SHA-256:
  `e13bf1594119e9bef23811dfeae5f462232e59c602a15f838a4b18340d29a7b6`
- Verified code base:
  `c920ce6e3b037cf2352d77f7d3534d5bc363819a`

The protected V2 status permits planning and canonical work. It does not yet
permit a vertical slice, broad extraction, import or production activation.

## Fixed implementation decisions

1. Use the existing canonical bundle input compiler.
2. Put authored successor inputs under
   `contracts/canonical-v2/successor/`.
3. Use one root `manifest.json` for the complete successor input tree.
   Generate it from all Agreement, shared-authority and Process members.
   Do not create a nested domain manifest.
4. Keep frozen fixture contracts V1 through V12 byte-identical.
5. Add shared objects through the successor bundle. Do not add another
   contract compiler.
6. Use one canonical writer and one candidate release.
7. Use one read-only `CanonicalDealFactProjection` for all consumers.
8. Use stable entity identity. A display name cannot define identity.
9. Keep transaction legs and repeatable professional assignments as
   components. Do not use parallel arrays.
10. Keep source statements separate from selected facts and derivations.
11. Generate product field definitions from the released shared projection.
12. Treat every legacy fact as candidate evidence until it passes review.
13. Keep all production feature controls disabled until the later release
    gates pass.

## Work order and stop conditions

Contract work packages S0 through S4 can proceed under
`canonical_work_start`.

S5 can build generic writer and projection machinery with synthetic fixtures.
It cannot read or write deal data.

The first reviewed public-deal fixture cannot run until
`vertical_slice_execution` is `PASS`.

Broad source review, extraction, reprocessing and candidate release work cannot
run until `candidate_scope_and_extraction` is `PASS`.

Import and activation remain separate later gates.

## Execution units

Each package is a programme group. It is not one large pull request.

Before code starts:

1. create a dedicated `wp/<name>` branch;
2. add one exact `.github/phase-allowlists/wp-<name>.json`;
3. name the required work class in the allowlist;
4. list exact files that the unit can change;
5. revalidate the protected programme status; and
6. stop if the required work class is not `PASS`.

Each unit changes one contract family or one implementation seam and its
focused tests. A unit does not combine authored contracts, deal evidence,
writer changes and user-interface changes.

## S0: freeze the factual baseline

### Files

- Add `scripts/canonical-v2-shared-authority-baseline.mjs`.
- Add `tests/canonical-v2-shared-authority-baseline.test.js`.
- Generate
  `evidence/shared-authority/baseline/legacy-input-inventory.json`.
- Generate
  `evidence/shared-authority/baseline/current-field-inventory.json`.

### Tasks

1. Enumerate every legacy deal, name, adviser, lawyer, value, structure and
   consideration field.
2. Record its physical source, present consumer and known normaliser.
3. Classify each field as candidate evidence, compatibility display or
   prohibited authority.
4. Record the 15 current Deals-table fields.
5. Enumerate the eligible Agreement field set from the current registry.
6. Prove that the three product-baseline source files are byte-identical to the
   approved field review.
7. Fail if a field has no disposition.

### Tests

- An extra source field fails the closed inventory.
- A missing source field fails the closed inventory.
- Two aliases cannot create two active meanings.
- `SEC_FILING_MEETING` receives an express field disposition.
- A legacy adviser string cannot be classified as identity authority.

### Gate

Every current field and legacy input has one exact disposition.

## S1: author the successor shared contract inputs

### Files

- Extend the one root
  `contracts/canonical-v2/successor/manifest.json`.
- Add `scripts/generate-canonical-v2-successor-manifest.mjs`.
- Add `tests/canonical-v2-successor-manifest.test.js`.
- Add
  `contracts/canonical-v2/successor/governance/required-kinds.json`.
- Add authored members under:
  - `contracts/canonical-v2/successor/shared/entities/`;
  - `contracts/canonical-v2/successor/shared/deal-facts/`;
  - `contracts/canonical-v2/successor/shared/transactions/`;
  - `contracts/canonical-v2/successor/shared/professionals/`;
  - `contracts/canonical-v2/successor/shared/temporal/`;
  - `contracts/canonical-v2/successor/shared/projections/`; and
  - `contracts/canonical-v2/successor/shared/field-definitions/`.
- Extend `lib/canonical-v2/canonical-contract-input-compiler.js` only for new
  governed object kinds.
- Add focused validators in
  `lib/canonical-v2/shared-authority-contract-input-validator.js`.
- Add `tests/canonical-v2-shared-authority-contract-input.test.js`.

### Required logical types

- `EntitySubject`;
- `EntityNameOccurrence`;
- `EntityIdentityBridge`;
- `DealParticipantRelationship`;
- `SourceDealFactOccurrence`;
- `DealFactResolutionOccurrence`;
- `SourceTransactionLegOccurrence`;
- `TransactionLegResolutionOccurrence`;
- `TransactionStructureResolutionOccurrence`;
- `TransactionControlOutcomeOccurrence`;
- `SharePurchaseInterestComponent`;
- `ProfessionalAssignmentRelationship`;
- `LawyerFirmAffiliationRelationship`;
- `TemporalExpression`;
- `CanonicalDealFactProjection`; and
- shared product field definitions.

Each type must have:

- an expected occurrence or relationship slot;
- stable occurrence identity;
- immutable revision identity;
- state rules;
- evidence rules;
- a physical carrier;
- a canonical writer action;
- release and import treatment;
- trace treatment;
- exact-detail treatment; and
- a consumer projection rule.

### Tests

- A display name cannot create an `EntitySubject`.
- A value cannot change an occurrence ID.
- An unregistered type, state, role, structure or component fails.
- A new semantic slot has no current-release writer path.
- The manifest rejects a missing, extra, duplicate or reordered member.
- A second or nested manifest fails.
- Two clean compiles produce byte-identical output and fingerprint.
- Every V1 through V12 fixture fingerprint remains unchanged.

### Gate

The complete authored input universe compiles twice to one successor input
identity. It has no deal data.

## S2: implement identity, role and structure kernels

### Files

- Add `lib/canonical-v2/entity-subject.js`.
- Add `lib/canonical-v2/entity-name-occurrence.js`.
- Add `lib/canonical-v2/entity-identity-bridge.js`.
- Add `lib/canonical-v2/deal-participant-relationship.js`.
- Add `lib/canonical-v2/transaction-leg.js`.
- Add `lib/canonical-v2/transaction-structure-resolution.js`.
- Add `lib/canonical-v2/transaction-control-outcome.js`.
- Add `lib/canonical-v2/share-purchase-interest-component.js`.
- Add matching tests named
  `tests/canonical-v2-<module-name>.test.js`.

### Tasks

1. Build pure constructors and validators from the frozen contract.
2. Use reviewed external identifiers or approved immutable seeds for entity
   identity.
3. Keep name occurrences and source-local labels separate from entity
   identity.
4. Make bridge conflicts block unification.
5. Model legal document roles, transaction roles, control roles and source
   transaction legs separately.
6. Represent mergers of equals through combination parties and control
   outcome. Do not invent a buyer.
7. Represent reverse mergers without inferring control from the survivor or
   share issuer.
8. Represent each Reverse Morris Trust step as a separate transaction leg.
9. Keep tender offers and second-step mergers separate.
10. Bind every share purchase to one buyer, acquired entity, seller, interest,
    amount, ownership path, consideration, time and evidence component.

### Mandatory synthetic tests

- Direct merger.
- Forward triangular merger.
- Reverse triangular merger.
- Merger of equals.
- Reverse merger.
- Reverse Morris Trust.
- Tender offer and second-step merger.
- New-holdco stock combination.
- Stock-for-stock combination.
- Spin-merge.
- Share purchase.
- Asset acquisition.
- De-SPAC.
- Sponsor consortium.
- Joint-venture combination.

Each structure needs one positive fixture and one false-role or false-control
fixture.

### Gate

Every required structure validates without source data. Every prohibited
inference fails.

## S3: implement facts, economics and professional assignments

### Files

- Add `lib/canonical-v2/source-deal-fact.js`.
- Add `lib/canonical-v2/deal-fact-resolution.js`.
- Add `lib/canonical-v2/deal-economics-derivation.js`.
- Add `lib/canonical-v2/professional-assignment.js`.
- Add `lib/canonical-v2/lawyer-firm-affiliation.js`.
- Add matching focused tests.

### Tasks

1. Preserve each source statement and stated value basis.
2. Select a canonical fact only through one complete resolution input set.
3. Keep enterprise value, equity value, transaction value, offer price,
   dividend and CVR value separate.
4. Permit normalised equity value only with complete source-backed inputs and
   operations.
5. Preserve a checked conflict state.
6. Bind each professional assignment to represented entity, bidder track,
   transaction leg, role, professional entity, time, state and evidence.
7. Keep firm and lawyer entities distinct.
8. Require separate evidence for lawyer-firm affiliation.
9. Implement `UNDISCLOSED`, `NOT_EXAMINED`, `NO_ADVISER`, `CONFLICTING` and
   `PRESENT` states.

### Tests

- Enterprise value cannot become equity value.
- A target dividend cannot become buyer consideration.
- A CVR maximum cannot become guaranteed value.
- Missing share count blocks a normalised equity-value derivation.
- Buyer and target counsel cannot swap.
- A side-level firm cannot fill a bidder-track assignment.
- A lawyer cannot inherit a firm from name similarity.
- A professional cannot move between Reverse Morris Trust legs.

### Gate

Every fact, calculation and professional assignment has typed evidence and
state. No legacy string supplies canonical truth.

## S4: compile the consumer projection and field catalogue input

### Files

- Add `lib/canonical-v2/canonical-deal-fact-projection.js`.
- Add `lib/canonical-v2/shared-field-definition.js`.
- Add `lib/canonical-v2/shared-authority-consumed-contract-manifest.js`.
- Extend `lib/canonical-v2/shared-serving-row.js`.
- Extend `lib/canonical-v2/shared-row-adapter.js`.
- Add:
  - `tests/canonical-v2-canonical-deal-fact-projection.test.js`;
  - `tests/canonical-v2-shared-field-definition.test.js`; and
  - `tests/canonical-v2-shared-authority-consumed-contract.test.js`.

### Tasks

1. Generate one release-pinned `CanonicalDealFactProjection`.
2. Include only admitted fields.
3. Give each field one closed typed lineage member.
4. Carry the exact-detail action, state, conflict and derivation identity.
5. Generate shared field definitions for display, filter, sort, group and
   export.
6. Make professional filtering one same-component operation.
7. Implement `EXISTS`, `NONE` and non-vacuous `ALL`.
8. Return `UNKNOWN` for an incomplete repeatable collection.
9. Make an unavailable field fail at Ask, Browse, manual filter and saved
   search compilation.

### Tests

- Agreement, Process and future CVR consumers receive the same selected fact
  revision.
- Filters, cards, table rows, exports and source actions use the same
  projection value.
- A generic revision ID cannot pass as typed lineage.
- Parallel arrays cannot satisfy a component filter.
- Legacy adviser and lawyer text filters cannot satisfy canonical filters.
- Live and pinned queries produce the same logical rows for the same release.

### Gate

The projection is read-only, release-pinned and suitable for Process WP2. It
does not supply a write credential.

## S5: register canonical writer, carrier and release handling

### Files

- Extend `lib/canonical-v2/canonical-writer.js`.
- Extend `lib/canonical-v2/canonical-write-envelope.js`.
- Extend `lib/canonical-v2/validate-write-set.js`.
- Extend `lib/canonical-v2/candidate-release.js`.
- Extend `lib/canonical-v2/candidate-release-import.js`.
- Extend:
  - `supabase/canonical-v2-foundation.sql`; and
  - `supabase/canonical-v2-serving.sql`.
- Add focused writer, schema and release tests.

### Tasks

1. Register the frozen shared object types and actions.
2. Enforce authoritative-writer-only data modification.
3. Keep candidate objects outside active serving.
4. Add complete release inventory and trace requirements.
5. Add materialised, indexed, release-pinned projection tables.
6. Keep one admission check and one bounded serving query.
7. Prohibit per-row graph reads and broad Node filtering.

### Gate

Synthetic fixtures pass the writer and release contracts. No public-deal data
has run.

## S6: prepare the reviewed structure and Metsera evidence packages

This independent evidence package can start under the current
`canonical_work_start: PASS`. It does not run an extractor, write a candidate
graph or create a release.

### Files

- Generate `evidence/shared-authority/transaction-structure-gold-manifest.json`.
- Generate `evidence/shared-authority/metsera-source-manifest.json`.
- Generate sealed review outputs outside extractor-accessible inputs.
- Add public-deal test fixtures only after the independent review seals them.

### Tasks

1. Freeze the eligible public-deal universe and cutoff.
2. Freeze tuning and untouched holdout sets.
3. Include every mandatory structure or obtain Ben's exact reduced-scope
   decision before freeze.
4. Independently establish Metsera identity, bidder-track, economics and
   adviser gold.
5. Keep case-level holdout answers unavailable to extractor tasks.
6. Keep the evidence reader separate from every extractor and candidate
   implementation role.

### Gate

The reviewed evidence is complete, independent and bound to the exact source
universe.

## S7: successor bundle review, freeze and bounded slice

### Tasks

1. Merge shared authority and Process contract inputs into one successor root.
2. Include acquisition, revocation, query, field, product and gate changes.
3. Run delta review with prior-disposition regression.
4. Run the exact-root cold review.
5. Obtain Ben approval for that exact root.
6. Issue the full-bundle `ContractFreezeAttestation`.
7. Wait for `vertical_slice_execution: PASS`.
8. Run the bounded Agreement slice.
9. Run the bounded shared-authority plus Process slice.
10. Record fresh same-pair slice evidence.

### Gate

No broad extraction starts until the protected status shows
`candidate_scope_and_extraction: PASS`.

## S8: migration, corpus certification and release

### Tasks

1. Reconcile every legacy candidate input to a canonical object or rejection.
2. Run the pre-registered structure and Metsera evaluations.
3. Run the untouched holdout once for the candidate.
4. Build one whole successor candidate release.
5. Prove source, logical, physical, query, display and export parity.
6. Import only after `production_import: PASS`.
7. Activate only after the cutover gates and Ben's one-use authorisation pass.

### Gate

Production uses the shared authority only after whole-release activation.

## Owner decisions required before S7 freeze

1. Full or reduced first-release structure set.
2. Approved immutable seeds for entities that have no governed external ID.
3. Approved non-SEC source authorities and their completeness limits.
4. Full or reduced first-release shared field set.
5. Independent evidence reader and holdout custodian identities.

Each decision must name the exact effect on fields, tests, estimates and later
claims.

## Estimate

| Package | Team hours | Ben hours |
| --- | ---: | ---: |
| S0 baseline | 24-40 | 0-1 |
| S1 contracts | 100-170 | 2-4 |
| S2 identity and structures | 100-180 | 3-6 |
| S3 facts and professionals | 100-180 | 3-6 |
| S4 projection and fields | 70-120 | 1-2 |
| S5 writer and release machinery | 100-180 | 0-1 |
| S6 evidence packages | 100-180 | 8-14 |
| S7 review, freeze and slices | 80-140 | 2-4 |
| S8 migration and release | 160-280 | 6-10 |

These are planning ranges. They are not dates.

## Required verification commands

Run focused tests after each task. At each package gate run:

```bash
npm test
npm run verify:codex-program
```

Before a successor freeze, also run two clean contract compilations and compare
their canonical bytes and fingerprint.

## Completion rule

This work is complete only when Agreement, Process and future-domain consumers
can use one released shared projection without a parallel entity, fact,
professional or field authority.
