# Shared Deal Facts and Entity Authority Adversarial Review

**Date:** 27 July 2026
**Review type:** Advisory self-review under `specification_review`
**Disposition:** REJECT pending specification corrections

## Authority limit

This is not a formal G0 cold review.

The reviewer helped author the reviewed specification. This review therefore
cannot satisfy reviewer-independence rules or `G0_EXACT_DIGEST_REVIEW_SET`.

It can find and remove defects before the formal review set is created.

No implementation plan, code, data work, public-deal reading or extraction was
performed.

## Frozen inputs

Review commit:

`f69e95735fb5dfb96fd48b2b0c49c64623b74706`

PM main:

`2989162a8a95ed0c1b010a7a7a35862798137b37`

Reviewed files and SHA-256 digests:

| Input | SHA-256 |
|---|---|
| Shared authority design | `631f80342629ca036586b60304d49ade3b130c8efe7a4b820de50cbbfe662e50` |
| Process design | `e6a77b94c5f194f28416d1fa08036120984e0bc99d2665050a4c51a612c09261` |
| Process plan | `cf21d4bcbd77eab3fbe794f73338748327402a62a5e75315d3041214f1c8ebb7` |
| `CODEX-PROGRAM.md` | `cbe56010ebd66b41e6535a41de2e180e3585b878a6d5d8272c1525c8ead56e22` |
| Canonical contracts | `d1767ca52a218b5027ac3427c7c74ccc185e78e2d2c755d49f812497d6216f0b` |
| Programme gates | `5d7e80968b2c43190aaeec7f4de64cc711ce30a14c97d9be5c387b37ce58b701` |

## Review standard

Each finding is one of:

- `UNSOUNDNESS`: the current text permits an incorrect or unverifiable result;
  or
- `SCOPE_EXPANSION`: the proposed correction adds capability beyond the
  approved objective.

All findings below are `UNSOUNDNESS`. None asks for a new product feature.

## Findings

### O1. Candidate proposals can bypass the frozen expected-slot universe

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 927-945; canonical contracts lines 3525-3554.

The design lets a domain propose an occurrence or relationship slot. It then
lets the canonical writer create expected occurrences.

Canonical V2 requires each post-barrier occurrence to match one frozen
`ExpectedOccurrenceSlot`. A candidate value cannot create a new expected slot
inside the same frozen pair.

The current text does not separate:

1. a candidate answer for an existing frozen slot; and
2. a candidate for a new semantic type, relationship or slot.

The second case requires open-world review, a successor contract amendment,
fresh exact-root review and a new freeze. Writer admission alone is not enough.

**Required correction**

Split `SharedAuthorityCandidateProposal` into:

- `EXISTING_EXPECTED_SLOT_VALUE_CANDIDATE`; and
- `NEW_SEMANTIC_OR_SLOT_CANDIDATE`.

The second type must have no current-release write path.

### O2. Two resolution families have no complete occurrence and revision contract

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 360-470 and 907-910.

The design defines detailed source and deal-level leg records. It then refers
to `TransactionStructureResolution` and
`TransactionControlOutcomeResolution` without defining:

- occurrence identity;
- revision identity;
- canonical state;
- expected-slot owner;
- selected input revisions;
- evidence;
- conflict behaviour;
- supersession;
- writer action;
- serving lineage; or
- exact-detail action.

These objects decide structure and control. They cannot remain informal
containers.

**Required correction**

Define occurrence and revision contracts for both families. Bind them to frozen
expected slots and complete ordered input revision sets.

### O3. Share-purchase fields can cross sellers, classes and consideration

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 520-532.

The share-purchase resolution preserves sellers, share classes, amounts and
consideration. It does not bind those fields into one repeatable component.

For a deal with two sellers and two share classes, flat lists can create a false
cross-product. The system could attach the wrong class, percentage or price to
one seller.

**Required correction**

Add one repeatable `SharePurchaseInterestComponent`.

Each component must bind:

- buyer;
- acquired entity;
- selling shareholder;
- security or share class;
- amount or percentage;
- direct or indirect ownership path;
- consideration;
- effective time; and
- exact evidence.

Its occurrence identity must be fixed before value extraction. Query
multiplicity and grouping must use the complete component, not independent
arrays.

### O4. Missing buyer evidence can become `NOT_APPLICABLE`

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 544 and 1059-1060.

The design says `buyer_type` is `NOT_APPLICABLE` when no reviewed buyer role
exists.

No reviewed buyer role can mean:

- the structure genuinely has no buyer role;
- the required sources were not examined;
- identity resolution failed; or
- the role evidence conflicts.

Only the first case supports `NOT_APPLICABLE`.

**Required correction**

Permit `NOT_APPLICABLE` only when a source-backed structure resolution proves
that the buyer role does not apply.

Use `NOT_EXAMINED`, `FAILED` or a blocking conflict for the other cases.

### O5. Source completeness is written as accession completeness

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 828-829; Process design lines 533-549.

The design requires exact accession membership reconciliation.

Press releases, adviser announcements and some other required sources do not
have SEC accession numbers. The current wording can exclude these sources from
the completeness proof.

The Process design already requires separate non-SEC authority manifests.

**Required correction**

Require exact admitted source-occurrence membership.

Use accession membership where an accession exists. Use a governed immutable
import identity and non-SEC authority manifest otherwise. Count equality never
passes.

### O6. One generic lineage field cannot represent every projection field

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 1012-1024.

`CanonicalDealFactProjection` gives each field one
`selected_resolution_revision_id`.

Some projected fields come from:

- entity revisions;
- entity-name revisions;
- identity-bridge revisions;
- deal-fact resolution revisions;
- participant relationship revisions;
- professional assignment revisions;
- transaction-leg resolution revisions;
- structure or control resolution revisions; or
- derivations.

A generic resolution ID cannot prove the correct logical type or trace path.

**Required correction**

Use a closed typed lineage union.

Each field kind must name its permitted terminal logical type, stable ID,
revision ID, canonical payload digest and exact-detail action.

### O7. The current adviser and lawyer filters still lose side and track

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 1097-1102; `market-cohort-query.js` lines 17-22
and 88-92; `query-result.js` lines 701-702.

The current query contract filters flat text arrays through
`adviser_either` and `lawyer_either`.

The design says these arrays become display-only. It does not define the
replacement query dimensions.

A flat array cannot distinguish:

- target from buyer;
- Pfizer from Novo;
- one transaction leg from another;
- a firm from a lawyer; or
- disclosed from unexamined.

**Required correction**

Define role-aware, entity-ID query dimensions for:

- represented entity;
- bidder track;
- transaction leg;
- professional role;
- professional entity; and
- assignment state.

The dimensions must use one governed repeatable-component quantifier contract.
The old text arrays must be unable to satisfy a canonical filter.

### O8. A changed rule requires more than a candidate release

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 1142-1143; Process design lines 242-244.

The design says a changed name map, value rule, bridge rule or assignment rule
requires a new candidate release.

If a rule is part of the frozen contract, a changed byte requires:

- a successor contract bundle;
- delta review with disposition regression;
- exact-root cold review at the required milestone;
- a new freeze; and
- fresh same-pair slices.

A candidate release cannot change frozen semantics.

**Required correction**

Separate data-revision changes from contract-rule changes. Apply the full
successor-bundle path to every contract-rule change.

### O9. Entity supersession has no release-pinned query rule

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 181-190 and 1070-1102.

The design permits a successor release to select a surviving entity after two
seeded subjects are proved equivalent.

It does not define what happens to:

- an exact citation to the old release;
- a saved query using the old entity ID;
- live query compilation against the successor release;
- group counts across the supersession; or
- filters that contain both IDs.

A silent redirect would break citation integrity. No redirect would make
successor-release search incomplete.

**Required correction**

Keep exact-release citations on the old entity ID.

Define an explicit rerun action for the active release. Bind release-scoped
equivalence expansion, duplicate removal and group semantics to the new query
identity. Never redirect silently.

### O10. Professional assignments do not cover complex structures

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 546-571.

Professional assignments can bind to a deal, represented entity, bidder track
and time. They cannot bind to a transaction leg.

In an RMT, spin, contribution and merger work can have different counsel. A
deal-level assignment can attach a firm to the wrong step.

The design also says the contract must state the relationship between a lawyer
and a firm. It does not define that relationship.

**Required correction**

Add an optional transaction-leg resolution occurrence to each professional
assignment.

Define a source-backed, time-scoped `LawyerFirmAffiliationRelationship`.
Name similarity or firm-level assignment cannot create lawyer affiliation.

### O11. The mandatory structure gold set can be selected after results are known

**Class:** `UNSOUNDNESS`
**Severity:** Blocker

Evidence: shared design lines 1325-1353.

The design requires reviewed public-deal gold for the structure suite. It does
not freeze:

- the source universe;
- deal-selection rules;
- minimum examples per structure;
- negative examples;
- tuning and holdout separation;
- source cutoff; or
- treatment of a structure with no eligible deal.

This permits cherry-picking easy deals after extraction results are known.

**Required correction**

Pre-register the structure sampling frame before extraction.

Require at least one public-deal gold example for each admitted mandatory
structure, one negative structural challenge and an untouched holdout across
the highest-risk structures. Any reduced first-release set needs an explicit
Ben scope decision before freeze.

### O12. The Process root does not pin or fully consume this specification

**Class:** `UNSOUNDNESS`
**Severity:** Blocker for Process WP3A

Evidence: Process plan lines 191-254 and 800-808.

The Process plan still describes the shared authority as an external
prerequisite. It does not pin this specification or its digest.

Its WP2 requirements also predate:

- combination parties;
- mergers of equals;
- reverse mergers;
- RMT legs;
- selling shareholders;
- share-purchase components;
- control outcomes; and
- role-aware professional filters.

The Process root can therefore pass its own checklist while consuming a
different or incomplete shared projection.

**Required correction**

The next Process specification delta must:

- pin the approved shared-authority specification identity;
- inherit its release and scope decision;
- add the new fields and typed states to WP2;
- regress every prior Process disposition affected by the new mechanism; and
- make WP3A fail if the pinned projection is absent or incompatible.

### O13. The shared projection has no independent speed contract

**Class:** `UNSOUNDNESS`
**Severity:** Blocker for product acceptance

Evidence: Process design lines 819-823 and 997-1003; canonical contracts lines
8831-8915.

The approved objective requires rapid Browse and filtering.

The shared specification defines many repeatable relationships and filter
fields. It does not require:

- bounded materialised serving rows;
- set-based query execution;
- complete indexes;
- query-plan limits;
- cache identity;
- load certification; or
- response-time targets.

An implementation could satisfy semantic tests and still perform one
relationship query per result row.

**Required correction**

Apply the existing Canonical V2 query rules and Process performance budgets to
every shared-authority dimension.

Require materialised, indexed, release-pinned dimensions and zero runtime
canonical-graph traversal. Include the shared joins in load certification.

## Result

The core architecture remains sound:

- one shared PM authority is correct;
- source statements and deal-level resolutions are correctly separated;
- names do not act as identity;
- role layers and transaction legs solve merger-of-equals and RMT problems;
- source-exact evidence remains mandatory;
- Agreement, Process and CVR share one projection; and
- legacy fields remain candidate evidence only.

The current specification is not ready for a formal PASS root.

The thirteen corrections above are narrow contract completions. They do not
change the approved product direction.

## Recommended next specification action

1. Accept all thirteen findings.
2. Amend only the shared-authority specification and affected Process
   integration sections.
3. Run a delta review against this frozen input.
4. Recompute the exact specification digests.
5. Submit the amended root to the formal independent review process when the
   gate controller can produce eligible evidence.
