# QXO capitalisation and bring-down F27

## Purpose

Build the first complete representation and bring-down vertical slice from
immutable source through canonical claims, relationships, result composition
and bounded market serving.

The slice covers QXO/TopBuild:

- Company representation section 3.1(b), Capital Structure;
- closing condition section 5.2(a)(ii)(B);
- closing condition section 5.2(a)(ii)(C);
- the dated-representation proviso in section 5.2(a)(ii); and
- the definition of De Minimis Inaccuracies.

F27 remains inactive. It does not change the active corpus release, enable a
production feature, write production data or add a production database call.

## Controlling source and accepted legal treatment

### Representation

Section 3.1(b) contains five ordered limbs:

1. authorised and outstanding Company shares, valid issuance and reserved
   shares;
2. options, restricted stock, RSUs, PSUs, the award schedule and subsidiary
   equity;
3. absence of other equity and equity rights;
4. future plan issuance, material outside investments and voting debt; and
5. absence of voting trusts and similar agreements.

The source repeatedly measures the numerical capitalisation facts as of the
close of business on 17 April 2026. The agreement was signed on 18 April 2026.
The canonical observation therefore retains:

- raw measurement date: `2026-04-17`;
- signing date: `2026-04-18`;
- signing-relative offset: `-1`;
- offset unit and basis: `CALENDAR_DAY`;
- semantic class: `NEAR_SIGNING_MEASUREMENT_SNAPSHOT`; and
- derivation version and exact evidence.

This is a measurement date, not a retrospective lookback. A date can join a
cross-deal measurement-date cohort only after the signing anchor and offset are
resolved. The raw date remains visible even if that derivation fails.

There is no general knowledge qualifier, no general materiality qualifier and
no retrospective lookback on the representation. The word “material” in limb
(iv) limits the outside-investment proposition within that limb. It must not
be promoted into a representation-wide materiality qualifier.

### Closing condition

Section 5.2(a)(ii)(B) applies to limbs (i) and (iii). Those limbs must be true
and correct at signing and closing, subject to De Minimis Inaccuracies.

Section 5.2(a)(ii)(C) applies to limbs (ii), (iv) and (v). Those limbs must be
true and correct in all material respects at signing and closing after
disregarding qualifications based on materiality or Company Material Adverse
Effect.

The proviso controls both groups: a representation expressly made as of a
particular date or period is tested only at that date or period.

The two groups are legally distinct comparison classes under one
capitalisation bring-down result. User-facing contracts and copy call them the
“clause (B) group” and “clause (C) group”. Existing internal “Tier B” and
“Tier C” names are migration-only and must not appear in the shared row
contract, UI or new identifiers.

### Definition and denominator

De Minimis Inaccuracies means inaccuracies that are de minimis relative to the
total fully diluted equity capitalisation of the Company or Parent, as
applicable.

For these Company representation limbs, the applicable denominator is the
Company’s fully diluted equity capitalisation. The canonical effect retains:

- the exact defined-term text;
- the Company denominator selection;
- the source phrase “or Parent, as the case may be”;
- the definition-use relationship; and
- the evidence and derivation lineage supporting the selection.

The system must not generalise this selection to a Parent representation.

### Party

Parent, Titanium Merger Sub and Forward Merger Sub are one canonical
`BUYER_GROUP` for this result. Their exact source tokens, order and capacities
remain in evidence and provenance. They do not create three market rows or
three cohort observations.

## Parser treatment of the page number

The extracted section 3.1(b) text contains a standalone `16` between the
definition lead-in for Company Equity Rights and the defined term. It is an
EDGAR page marker, not legal text and not a numerical claim.

The existing parser text layer is the correct boundary:

1. Preserve the immutable source and canonical-source bytes containing `16`.
2. Let `PARSER_V2_TEXT_LAYERS/V1` recognise the isolated page-number line as
   parser layout noise.
3. Exclude the line from parser clean text before structural and semantic
   proposals are made.
4. Use the parser's existing monotone clean-to-source projection to map every
   accepted proposal and excerpt back to the unchanged canonical source.

The marker must never appear in a normal rendered legal excerpt, claim value,
definition, result or UI. An explicit original-source view may still show it
because the immutable source must prove exactly where it appeared. No new legal
concept, claim, taxonomy code, serving field or persistent layout artefact is
created for it.

F27 adds a regression fixture proving that this QXO page marker is excluded
while the surrounding Company Equity Rights definition remains continuous.
Existing parser behaviour and frozen source identities otherwise remain
unchanged.

## Successor canonical contract

F27 creates V13 as the smallest successor to V12. V1 through V12 remain
byte-identical.

V13 adds or revises only the contracts needed to express this slice:

1. A capitalisation representation semantic schema that requires five ordered
   `REPRESENTATION_LIMB/V1` components and permits exact sub-limb evidence.
2. A governed measurement-date claim with raw date, signing anchor, signed
   offset, unit, day basis, semantic class, precision, derivation version and
   evidence.
3. Governed qualifier claims capable of recording complete-scope `ABSENT`
   states for general knowledge, general materiality and retrospective
   lookback.
4. A typed `BRINGS_DOWN` effect that binds:
   - exact target limb IDs;
   - signing and closing test points;
   - the expressly-dated representation proviso;
   - accuracy standard;
   - exception, if any;
   - materiality scrape, if any; and
   - exact evidence and scope closure.
5. A definition-use effect that links De Minimis Inaccuracies to the clause
   (B) accuracy effect and records the applicable Company denominator.
6. A `TARGET_CAPITALISATION_BRING_DOWN/V2` result with two required comparison
   groups and separately typed contextual claims.
7. One `REPRESENTATION_ACCURACY_STANDARD/V2` market metric with two frozen
   comparison classes:
   - `CAPITALISATION_CLAUSE_B_LIMBS_I_III`; and
   - `CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V`.

The two classes must never be aggregated into one distribution. They also must
not become unrelated metric keys, because they are two parts of one legal
result.

The contract compiler validates exact version shapes. No caller may supply an
ungoverned claim key, comparison class, accuracy code, relationship effect or
party role.

## Canonical object graph

### Source objects

F27 admits one immutable document and its existing canonical source text.
Parser-clean proposals retain their clean-to-source projection. Deterministic
section proposals identify sections 3.1(b) and 5.2 without gaining semantic
authority.

### Provision and component objects

The graph contains:

- one target Capital Structure representation instance;
- five ordered representation-limb components;
- one buyer-group representation bring-down condition instance; and
- two ordered condition-group components corresponding to clauses (B) and
  (C).

Every identity is anchored to document hash, canonical offsets, concept, party
and governed ordinal. The five representation limbs remain independently
addressable even though they compose one result.

### Claims

The reviewed graph contains:

- measurement-date claims for the expressly dated facts;
- clause (B) accuracy standard, present;
- clause (C) accuracy standard, present;
- De Minimis Inaccuracies exception, present only for clause (B);
- general knowledge qualifier, absent across the complete representation
  scope;
- general materiality qualifier, absent across the complete representation
  scope; and
- retrospective lookback, absent across the complete representation scope.

Absence is publishable only with a complete governed scope closure. Failure to
certify an absence suppresses that contextual claim, not either accuracy group
or the whole result.

### Relationships

Two typed `BRINGS_DOWN` relationships connect the closing condition to the
correct ordered limb IDs. A typed `USES_DEFINITION` relationship connects the
clause (B) exception to De Minimis Inaccuracies. Containment relationships
preserve the nested and plural definition structure without creating duplicate
concepts.

The result is therefore composed from multiple non-contiguous source spans.
No text concatenation becomes legal authority. The relationships and ordered
evidence references are the authority.

## Result and shared row contract

The canonical result has one representation row with two primary comparable
subrows:

1. clauses (i) and (iii): true and correct, subject to De Minimis
   Inaccuracies; and
2. clauses (ii), (iv) and (v): true and correct in all material respects after
   the express materiality scrape.

Contextual subrows show:

- measurement date: 17 April 2026;
- signing-relative timing: one calendar day before signing;
- general knowledge qualifier: absent;
- general materiality qualifier: absent; and
- retrospective lookback: absent.

The row also exposes exact-detail actions for the representation limbs,
accuracy clauses, proviso, definition and denominator derivation. Review,
Corpus Context, Compare and Query consume the same row bytes. Surface-specific
logic may change layout but may not recalculate legal meaning.

The UI must identify the provision present in the subject deal before showing
the cohort. Presence frequency is secondary text. The primary market output is
the distribution of the two accuracy classes and the contextual measurement
date. The denominator and source party are explicit.

## Market serving and query efficiency

F27 creates an inactive candidate release and compact serving observations
keyed by release, deal, concept, metric, comparison class and party.

One page request may ask for both accuracy classes and the measurement-date
context. It compiles to one indexed, set-based RPC. The route must not load
broad provision cards or claims into Node and must not loop by limb, claim or
deal.

The release-aware cache key binds:

- corpus release;
- V13 contract fingerprint;
- exact metric admissions;
- concept and buyer-group party;
- subject-deal exclusion;
- cohort refinements; and
- derivation versions.

A cache hit performs no database call. A miss performs at most one bounded
database call with no immediate retry. QXO is excluded from its own cohort
without removing its source-backed subject result.

F27 does not reopen `/api/market-stats` or enable Canonical Query. Serving proof
uses the inactive projection and a bounded executor only.

## Failure isolation

Validation and rendering fail locally:

- A malformed parser projection blocks the affected proposal.
- An unresolved measurement anchor leaves the raw date reviewable but
  non-comparable.
- A malformed clause (B) group suppresses only that group and its dependent
  definition effect.
- A malformed clause (C) group suppresses only that group.
- An uncertified absence suppresses only that absence claim.
- A malformed sibling row does not stop valid provisions or subrows rendering.
- Unknown attributes, invalid codes and unresolved legal propositions remain
  residuals and block their own publication or comparability.

No failure is rendered as generic `No market data`. The shared row distinguishes
present, absent, not applicable, not examined, failed, unresolved and
non-comparable states with a source-backed reason.

## Mechanical verification

F27 must prove:

1. The raw document hash and page-marker bytes remain unchanged.
2. The standalone `16` is absent from parser clean text and canonical semantic
   evidence.
3. The surrounding Company Equity Rights definition remains continuous.
4. Every accepted excerpt maps exactly back to ordered canonical-source
   intervals.
5. The agreement and measurement dates resolve to `-1 CALENDAR_DAY`.
6. The date is a near-signing measurement snapshot, never a lookback.
7. Parent and both merger subsidiaries yield one `BUYER_GROUP` observation
   while retaining all raw party tokens.
8. Limbs (i) and (iii) bind only to clause (B).
9. Limbs (ii), (iv) and (v) bind only to clause (C).
10. De Minimis Inaccuracies and the Company fully diluted equity denominator
    bind only to clause (B).
11. The clause (C) materiality scrape remains distinct from the absence of a
    general materiality qualifier in section 3.1(b).
12. Knowledge, general materiality and retrospective lookback are absent only
    with complete-scope evidence.
13. The dated-representation proviso controls both accuracy groups.
14. V1 through V12 inputs and fingerprints remain byte-identical.
15. Cross-class, cross-party, cross-definition, cross-release and
    cross-contract substitutions fail.
16. A malformed subrow leaves valid sibling subrows and provisions renderable.
17. Review, Corpus Context, Compare and Query receive identical legal values,
    evidence identities, party and state.
18. One market request performs one corpus-independent RPC and a cache hit
    performs none.
19. Subject-deal exclusion is exact and result-bound.
20. No production route, flag, pointer, corpus write, retry or activation
    authority is introduced.

## Delivery sequence

1. Freeze the V13 contract.
2. Admit the existing QXO source and verify the parser clean-to-source
   projection.
3. Bind both structural section proposals and the De Minimis definition.
4. Build the reviewed provision, component, claim and relationship graph.
5. Certify complete-scope qualifier absences and measurement-date derivation.
6. Compose `TARGET_CAPITALISATION_BRING_DOWN/V2`.
7. Create the two class-scoped metric admissions and inactive serving
   observations.
8. Prove one-request serving, cache identity and subject-deal exclusion.
9. Prove four-surface row parity and local failure isolation.
10. Run focused tests, the complete suite, production build, phase allowlist
    and programme verification.
11. Obtain extra-high adversarial architecture and legal-semantic reviews.
12. Merge only after mechanical and review gates pass. Keep production flags
    and pointers closed.

## Rejected approaches

### Extend the existing clause (B)-only fixture in place

Rejected because its frozen identity predates the clause (C), qualifier-scope,
measurement-date and page-layout decisions. Editing it would create silent
semantic drift.

### Flatten both accuracy groups into one value

Rejected because the two groups apply to different representation limbs and
use different accuracy standards. A combined percentage would be legally
misleading.

### Treat each accuracy group as an unrelated metric

Rejected because both groups form one capitalisation bring-down result. This
would fragment Review and make cross-view composition harder.

### Repair the source or add a layout taxonomy

Rejected because genuine operative numbers are pervasive in merger agreements.
The immutable source remains unchanged, and the existing parser text layer
handles the isolated page line without creating a legal or serving object.

### Compute context in each UI surface

Rejected because it recreates the current parity failures. Legal semantics are
composed once and served through one shared row contract.

## Out of scope

- Production activation.
- Active-release pointer changes.
- Production corpus writes, replay, backfill or load testing.
- Re-extraction of other deals.
- A general page-layout repair for every source format.
- Other representation families.
- Market aggregation beyond the two frozen accuracy classes and governed
  measurement-date context.
