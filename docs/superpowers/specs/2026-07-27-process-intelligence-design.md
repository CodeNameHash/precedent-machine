# Canonical Process Intelligence design

## Status

Design approved in principle by Ben on 27 July 2026. This document consolidates
the approved product, extraction, query, interface and integration decisions for
adversarial review. It does not authorise production activation, corpus writes or
changes to an active release.

The evidence bases reviewed were:

- Precedent Machine `origin/main` at `3a39885`;
- the active canonical programme in `docs/CODEX-PROGRAM.md` and
  `docs/codex-program/canonical-contracts.md`;
- Deal Storylines review branch
  `origin/claude/reengineer-ground-up-fvp47j` at `77688ad`;
- Fable's external adversarial review at `383ffee`; and
- the Metsera corpus material and existing Storylines extraction fixtures.

## Executive decision

Build Process Intelligence as a governed Precedent Machine domain, not as a
second product or database.

The first certified process family is exclusivity. Metsera is the anchor deal.
Natural-language and guided Browse entry points compile to one governed Query
IR and return exact precedent passages. There is no narrative LLM answer in the
initial release.

Precedent Machine remains authoritative for:

- deal and document identity;
- immutable source content;
- target, buyer and other party entities;
- announcement and signing dates;
- sector, jurisdiction and structure;
- consideration, stated deal value and normalised equity value;
- counsel, individual lawyers and financial advisers;
- canonical contracts, releases and serving admission; and
- source details, evidence and provenance.

Process extraction adds source-backed process events, participants, bidder
tracks, phases, positions and relationships by reference to those canonical
objects. It cannot create a parallel copy of a PM fact.

## Why Deal Storylines is not the production foundation

Deal Storylines contains valuable product and extraction work, but its current
12-deal corpus is a prototype and adjudication source rather than a certified
canonical corpus.

The revised review brief records material strengths:

- exact passage storage and character offsets;
- typed event, participant, economics and track models;
- immutable revisions and release watermarks;
- deterministic query compilation;
- span-aware context retrieval;
- guarded board-continuation merging; and
- guarded anaphoric date inheritance.

The same brief records defects that prevent canonical promotion:

1. Extraction recall remains uncertified for important response and
   exclusivity types.
2. Multi-paragraph over-segmentation is repaired only for a narrow board-event
   class.
3. Stored span integrity defects exist and have not been audited corpus-wide.
4. Participant and response attributes are sparse.
5. Adviser attribution is per side rather than per named bidder.
6. Aggregate deal value is absent.
7. Legacy and V5 surfaces read different data models.
8. Bid charts may assign an umbrella proposal to the wrong bidder.
9. Natural-language recall is hand-tuned and known gaps were found by
   inspection.
10. Party-side predicates compile but return false zeroes under a pinned release
    because participant rows lack a release-compatible deal join.

The 27 July update applied three strong and five weak anaphoric date
inheritances and added intruder-span and dateline guards to continuation
merging. Those are useful candidate rules. They do not establish discovery
recall, general continuation correctness or release-safe participant queries.

No Deal Storylines row is admitted merely because it exists in the V5 ledger.
Each useful row, rule or label must pass the canonical source, semantic,
lineage, certification and release gates.

## Product outcome

The product answers a practitioner's question with market drafting, not a
machine-written conclusion.

The default response is 8 to 12 diversified exact passages. Each result shows:

- the verbatim passage;
- the matched drafting highlighted;
- deal, date and source;
- the governed process classification;
- the relevant actors and roles where certified;
- exact citation and source actions;
- coverage and certification scope; and
- an action to open the source reader.

Results diversify deterministically by deal and bidder track. Repeated language
from one deal cannot crowd out the market sample. When fewer than eight
qualifying passages exist, the product shows every available qualifying passage
with its coverage statement. It never pads the sample with repeated passages to
reach a target.

The initial release does not:

- generate narrative synthesis;
- paraphrase a filing;
- answer from an uncertified predicate;
- infer absence from a zero-result query;
- publish process analytics that lack a governed derivation; or
- expose candidate or review artefacts as market data.

A future narrative layer may consume the same released rows, but it is a
separate product decision and cannot become evidence.

## One product, one canonical platform

### Domain extension boundary

Process Intelligence is a compile-time extension of the canonical contract
bundle. It is not a runtime plugin with independent authority.

Each domain contributes governed definitions for:

- concepts and result identities;
- semantic questions and predicates;
- source roles and evidence requirements;
- typed dimensions and permitted operators;
- Browse hierarchy;
- exact-detail actions;
- certification and serving admission; and
- display labels keyed to canonical definitions.

Agreement, Process and future CVR domains share:

- immutable source intake;
- semantic extraction envelopes;
- reviewed inference payloads;
- deterministic graph normalisation;
- governed residual handling;
- the one canonical writer;
- candidate and active release machinery;
- `SharedServingRow`;
- Serving Exact Detail;
- Query IR, pagination and caching;
- the filter-field registry; and
- the PM browser design system.

Process results use a generated `CANONICAL_RESULT` shape. Process must not add a
generic row variant, free-form attributes or a separate query response.

### Development while Canonical V2 is active

Before the generated canonical programme gates open, Process work is limited to
specification review and other work expressly authorised by the current
programme status. After the applicable work class opens, isolation uses:

- a pinned canonical contract fingerprint;
- immutable contract fixtures;
- an isolated module and namespace;
- staging-only candidate graphs;
- disabled feature flags;
- no active-release pointer authority;
- no production write capability; and
- no compatibility fallback to Storylines serving tables.

Contract fixtures may be authored as non-executable specification artefacts.
Executable fixture adapters or product surfaces begin only when their generated
work class is open. Integration replaces any authorised fixture adapter with
the generated canonical adapter. It never migrates a temporary process
database into production.

All domain and field additions are append-only successor contracts. They must
not reinterpret or invalidate frozen Agreement definitions, historical release
objects or saved query definitions. A whole successor release necessarily
creates new release-bound serving identities. Agreement semantic and content
parity therefore excludes only fields the canonical contract declares
release-bound. Any other change requires an independently approved migration.

Process maintains a consumed-contract freeze manifest naming the exact PM
contracts it relies on, including the writer, `SharedServingRow`, release,
Serving Exact Detail, Query IR and field registry. Any merge changing one of
those contracts triggers fixture regeneration and a divergence gate. Heavy
extractor implementation does not begin until this consumed subset is frozen.
That manifest detects drift only. It grants no implementation, data or release
authority.

The generated `programme-gates.yaml` status is the sole sequencing authority.
With an absent, stale or failing status artefact, only specification review and
emergency containment may proceed. Process work classes inherit the canonical
dependencies:

- implementation planning requires `implementation_planning`;
- canonical implementation or data work requires `canonical_work_start`;
- source reading, source inventories, gold sealing and Storylines evidence
  export are data work for the current programme and therefore also wait for
  `canonical_work_start`; any earlier inert-evidence work class requires a
  separately approved Canonical V2 change rather than a Process exception;
- before review or freeze, the specification root must already contain the
  complete Agreement-plus-Process bundle, `PROCESS_VERTICAL_SLICE_PASS` gate
  entry, acceptance definition, evidence schema, adversarial test, verifier
  changes, successor `candidate_scope_and_extraction` dependencies,
  acquisition contracts, semantic-integrity revocation action, Process
  containment policy and stale-link rerun action;
- that complete root must then compile and receive exact-root review, Ben
  approval and its own full-bundle `ContractFreezeAttestation`;
- the exact frozen pair must receive fresh Agreement and Process
  vertical-slice attestations under `vertical_slice_execution`; prior
  Agreement-only evidence cannot carry forward to the successor fingerprint;
- broad source discovery, extraction, reprocessing and candidate work require
  `candidate_scope_and_extraction`, whose successor dependency set cannot open
  before both a fresh same-pair `P1_VERTICAL_SLICE_PASS` and
  `PROCESS_VERTICAL_SLICE_PASS`; and
- import, activation and rollback require the complete Phase 9 gates.

No local Process approval, branch state, fixture adapter or subset freeze may
infer a passing gate.

### Review convergence

Planning-draft review does not itself freeze a canonical bundle or require a
vertical-slice rerun. Before the first freeze, each amendment receives a delta
review plus regression of all prior dispositions. A full exact-root cold review
is required at the WP3A pre-freeze milestone and again before activation.

Every finding is classified as either:

- `UNSOUNDNESS`, which identifies a contradiction, unverifiable guarantee,
  authority gap or unsafe implementation path and must be resolved; or
- `SCOPE_EXPANSION`, which adds capability or assurance beyond the approved
  objective and requires a costed Ben decision rather than automatic
  acceptance.

Each milestone targets convergence within two review rounds. A third unresolved
round is escalated to Ben with the exact remaining findings, classifications,
cost and recommendation. Once a bundle is frozen, any changed contract byte
still requires a new exact-root review, freeze and fresh same-pair Agreement and
Process slices. The convergence rule cannot waive that requirement.

## Shared deal facts and entity authority

### Required upstream canonical authority

The current repository does not yet contain a canonical entity master or the
source-backed deal-fact and adviser contracts required by this design. Legacy
`deals` columns, `metadata.deal_facts`, `metadata.advisors_v2`, read-time name
maps and backfill output are candidate evidence only. They cannot be relabelled
as a canonical projection.

This is a reusable PM platform requirement, not a Process-owned entity-mastering
programme. It receives its own bounded plan, owner, estimate, acceptance set and
release path. Agreement, Process and future CVR domains consume the same
authority. Process owns only its projection, participant traversal and typed
missing behaviour.

The approved upstream specification is:

- path:
  `docs/superpowers/specs/2026-07-27-shared-deal-facts-and-entity-authority-design.md`;
- SHA-256:
  `7dd9552c2634e4f64f0fc662f40002879fd6fca595a2394d8e3eb27baf35dbbe`.

`SharedAuthorityConsumedContractManifest` pins that specification identity, the
later generated projection schema and digest, required field set, frozen pair,
serving namespace, corpus release and compatibility rules.

The specification digest records the approved requirement. It grants no writer,
release or serving authority. Process cannot consume the projection until the
generated contract and release also pass.

Before Process can consume these facts, that upstream PM workstream must define,
generate and admit through the existing canonical primitives:

- an `EntitySubject` logical type whose stable identity derives from a governed
  external identifier or Ben-approved immutable import seed, never display
  name;
- entity-name occurrences and source-local labels;
- reviewed alias and identity-bridge relationships, including conflict and
  supersession;
- deal-level date, structure, consideration and value claims;
- legal and commercial participant roles, transaction legs, structure and
  control resolutions;
- share-purchase interest components;
- adviser and lawyer assignment relationships with entity, role, bidder track,
  transaction leg and temporal scope;
- lawyer-firm affiliation relationships;
- field-level evidence, states and derivations; and
- release-compatible result and query projections.

The successor bundle registers entity expected-occurrence variants, identities,
revisions, supersession, physical carriers, writer actions, relationship
endpoints, release and import treatment, traceability and serving projections.
An `EntityNameOccurrence` is source evidence about an `EntitySubject`; it is
not itself the entity. Conflicting aliases block unification. A source-local
party remains source-local when no governed entity subject can be established.

The canonical writer and whole release own those objects. Process may propose a
value for an existing frozen expected slot. A new semantic or slot proposal has
no current-release writer path. It requires open-world review, a successor
bundle, review, freeze and fresh same-pair slices. Process cannot create another
entity, fact or adviser store.

If the upstream authorities are not ready, the initial Process release must
omit the affected named-entity, adviser and cross-deal filters rather than
project legacy strings.

Source-exact Process passage work may proceed with source-local participant
labels and typed missing states while the upstream workstream runs in parallel.
The intended release with PM-wide entity, counsel, adviser and equity-value
filters cannot claim those features or expose their controls until the
corresponding upstream fields are certified and release-compatible.

### Canonical fact projection

The process extractor receives a read-only, versioned deal-fact projection from
PM. At minimum it covers:

- canonical deal ID and source-document IDs;
- target and buyer entity IDs and display names;
- combination-party and selling-shareholder entity IDs and display names;
- other bidder and counterparty entity IDs;
- announcement and signing dates;
- sector and jurisdiction;
- legal structure, source characterisation, transaction legs and control
  outcome;
- typed target, buyer and buyer-type applicability;
- consideration form and components;
- share-purchase interest components, including seller, class, amount or
  percentage and consideration;
- headline price per share;
- stated transaction value;
- normalised equity value and calculation basis;
- target, buyer, combination-party and selling-shareholder law firms;
- named lawyers;
- target, buyer, combination-party and selling-shareholder financial advisers;
- the exact source and evidence state for each fact.

Every field carries the shared specification's closed typed lineage union. A
generic revision ID is invalid.

An extractor may propose a missing value for an existing frozen expected slot
with evidence. Only the canonical writer may admit it. A new semantic or slot
candidate follows the successor-bundle path. The process domain cannot persist
`pm_target`, `pm_acquirer` or similar cached copies as an alternative truth.

### Economics

Announcement press releases are a preferred source for a stated headline
transaction or equity value when the release actually states it. The system
retains:

- the raw stated value and language;
- whether the value is enterprise, equity, headline transaction or another
  stated basis;
- the normalised equity value, if derivable;
- the complete derivation and exclusions;
- the exact source passage; and
- any conflict with the merger agreement, proxy or later filing.

A conflict is a typed state. A later source does not silently overwrite an
earlier statement. Target-paid dividends, CVR ceilings and tiered prices cannot
be added to an offer price unless a governed calculation expressly permits it.

### Advisers

Advisers attach to named entities and, where necessary, to a dated bidder track
and transaction leg. They do not attach merely to "acquirer side".

The canonical resolver may use notices, proxy disclosure and announcement press
releases as evidence. It retains the source and role basis. In a multi-bidder
process, counsel for Pfizer cannot be inherited by Novo or by an anonymous
Party A.

Per-track adviser disclosure is expected to be sparse, particularly for losing
or anonymous bidders. `UNDISCLOSED` is an honest state, distinct from
`NOT_EXAMINED` and `NO_ADVISER`. Certification requires both a positive
named-bidder attribution fixture and negative fixtures proving that missing
disclosure is not filled from another bidder or from a generic side.

Professional filters use the complete shared assignment component. They bind
represented entity, bidder track, transaction leg, professional role,
professional entity and state. Legacy adviser or lawyer text arrays are
display-only and cannot satisfy a canonical filter.

The existing Process implementation plan predates this consumed specification.
It is not current for WP2 or WP3A. Its first permitted
`implementation_planning` amendment must pin the same manifest, add the new
fields and tests, regress affected prior dispositions and make WP3A fail on an
absent or incompatible shared projection.

## Process semantic model

### Core objects

The process domain authors governed logical definitions for:

- `ProcessNarrationOccurrence`: one source-local narrated occurrence, anchored
  to exact source intervals and identified before candidate value extraction;
- `ProcessEvent`: one legally or commercially meaningful real-world occurrence
  composed from one or more narration occurrences;
- `ProcessParticipant`: a canonical entity in a typed event role;
- `BidderTrack`: the source-backed sequence for one named or source-local
  counterparty;
- `ProcessPhase`: a governed stage within a deal or bidder track;
- `ProcessPosition`: a party's source-backed position on a term;
- `ConsiderationPackage`: a proposal and its separately typed components;
- `ProcessAgreement`: confidentiality, standstill, exclusivity or other
  process agreement and its versions;
- `ProcessRelationship`: continuation, response, amendment, supersession,
  retelling or cross-reference between occurrences; and
- `ProcessPassage`: the exact citable source passage and source map.

These labels do not author ad hoc storage. Each logical type is compiled into
the closed canonical object system and receives an expressly registered generic
or dedicated physical carrier:

- `ProcessNarrationOccurrence` becomes a new governed logical occurrence type
  in the successor bundle. Its identity derives from frozen pair, deal
  admission, narration-definition version, occurrence-independent canonical
  source interval set and governed ordinal, never extracted value;
- the successor bundle adds `PROCESS_NARRATION` to
  `ExpectedOccurrenceSlot`, permits it as a claim owner and relationship
  endpoint, and registers its revision, carrier, writer disposition,
  release/import/trace treatment and serving access;
- its source-backed attributes map to governed `ClaimOccurrence`,
  `ClaimRevision`, evidence and excerpt definitions owned by that narration;
- participant, response, continuation, retelling, identity bridge, amendment
  and supersession map to typed relationship occurrences and revisions;
- a composed event maps to a frozen `ResultDefinition`, expected result and
  component occurrence slots, `DerivedResultRevision` and complete
  `ResultInputLineage`;
- each phrasebook passage maps to a dedicated canonical
  `ProcessPhrasebookPassageResult` with `output_grain=RESULT` and
  `parent_kind=RESULT_ROW`, with the selected narration and predicate witness
  in its lineage, a bounded inline exact preview and existing result-parent
  exact-detail actions; and
- an Exclusivity history row selects the composed canonical result grain.

The phrasebook `ResultDefinition` creates one occurrence per admitted
predicate-witness narration. Its occurrence-independent member key is the
precomputed narration occurrence and exact evidence-role slot; its ordinal
comes from the frozen source-interval comparator. A claim query or application
join cannot mint the card or its exact-detail parent.

A successor bundle must define every required occurrence identity, carrier,
writer action, result definition, query dimension and output grain, exact-detail
parent and generated registry entry before implementation. `CANONICAL_RESULT`
is an output variant, not an authority shortcut.

### Narration, event identity and granularity

A narration occurrence is source-local. An event is the smallest real-world
occurrence at which the user asks a distinct process question. Paragraph
boundaries do not define either boundary.

One multi-paragraph board meeting remains one event when the source presents one
continuous meeting. Two events on the same date remain separate when a new
occasion, actor, proposal, response or decision begins.

Continuation and retelling are first-class relationships. They are not repaired
by deleting or silently merging rows. A later proxy summary may link to an
earlier event without becoming a duplicate market observation. It remains a
separate narration and phrasebook passage even when linked to the same event.

Scope-stage discovery freezes the complete occurrence-independent narration and
event member universe, comparator and deterministic ordinals before candidate
values are extracted. Candidate values, selected revisions, insertion order,
worker order and model output cannot create identities or ordinals. An
unresolved member universe blocks the context.

### Source-local and named party identity

A source-local label such as `Party 1` remains a valid participant identity. It
may unify with a named canonical entity only through a governed identity-bridge
contract.

The contract defines:

- permitted bridge witnesses, including explicit later identification and
  separately certified retelling equivalence;
- required source, date, economics and relationship evidence;
- conflict and uniqueness checks;
- the states `NAMED`, `GOVERNED_BRIDGE_CONFIRMED`, `SOURCE_LOCAL_ONLY` and
  `CONFLICTING`; and
- which states may filter, group or display under a release.

Matching date and economics alone may propose a bridge but cannot silently
establish one. When a bridge is not proved, the track serves honestly as
`Party 1 (not publicly identified)` where the underlying process predicate is
otherwise certified.

### Required process dimensions

Where applicable and supported, a process event carries:

- event type and governed family;
- exact date, interval or unresolved temporal state;
- date kind, method, precision and evidence;
- actor, counterparty, present party and recipient;
- named party, side, capacity and participant cardinality;
- bidder track and deal phase;
- channel;
- outcome or valence;
- publicity;
- cause or trigger;
- agreement type and document stage;
- linked position or consideration package;
- relationship to preceding, responding or retold events; and
- complete evidence and derivation lineage.

No required dimension is fabricated to satisfy a schema. Unknown,
not-applicable, not-examined, conflicting and failed states remain distinct.

### Exclusivity clock expressions

Release one uses a lossless governed `TemporalExpression`, not a speculative
Process-specific clock language. Every occurrence retains the exact stated
formulation, source span and one coarse state:

- `EXPLICIT_DATE`;
- `STATED_DURATION`;
- `RELATIVE_OR_CONDITIONAL`; or
- `UNRESOLVED`.

Structured nodes are admitted only for expression forms observed in the frozen
pilot corpus. They may cover a source-supported anchor, exact time and timezone,
calendar or business-day basis, counting boundary, conditional branch and
separately stated or computed value. A computed value requires its complete
derivation and never replaces the source formulation. Unsupported structure
remains lossless and unresolved.

The node registry is an extensible PM-wide temporal contract so later Process
families and CVR milestone mechanics reuse it. A new node or interpretation
requires a successor contract and fixtures; it is not added at runtime.

### Release-one predicate floor

The first release freezes a non-optional exclusivity predicate set and its
dependency closure before extraction. At minimum it covers express request,
express refusal, counterproposal, conditional acceptance, grant, extension or
amendment, expiry or ending, requester, recipient, grantor, beneficiary, bidder
track, timing and actual drafting.

An exclusivity-subject dimension distinguishes at least:

- negotiation or transaction exclusivity;
- exclusive diligence or data access; and
- another separately governed subject.

`EXPRESS_REFUSAL`, `COUNTERPROPOSAL` and `CONDITIONAL_ACCEPTANCE` are distinct
response states. A generic Browse label may compile only to an expressly
governed union that preserves the constituent state and subject in every
result.

Silence or lack of a recorded grant is not an exclusivity decline. Release one
does not publish “declined by omission”. A future absence predicate would need a
complete governed source universe and would be labelled
`NO_RECORDED_GRANT_WITHIN_GOVERNED_INTERVAL`, not refusal. Removing or weakening
a mandatory predicate requires a successor bundle and fresh certification. A
mandatory predicate failure within the claimed release scope blocks that
release rather than silently removing the predicate. Holdout failure separately
limits the permitted breadth of the corpus claim as described below.

## Source-universe completeness

Canonical source admission proves the documents it has received. Process also
needs a governed acquisition universe that proves which filings should have
been received.

Before semantic discovery, a successor canonical
`ExternalSourceAcquisitionManifest` is built:

1. one production acquisition path enumerates and fetches relevant filings,
   amendments, supplements, exhibits, incorporated references and approved
   non-SEC sources from frozen external snapshots under a frozen cutoff;
2. for SEC material, a separately implemented completeness oracle derives the
   expected accession inventory from daily or full indexes without consuming
   the production path's submissions-history output; the production path uses
   complete issuer submissions history, including paginated older-file
   indexes, plus recursive package and cross-reference traversal;
3. a reconciler requires exact SEC accession membership between the production
   inventory and independent oracle, then validates package members,
   cross-document references, expected fetch receipts and terminal
   dispositions;
4. approved non-SEC sources use an authority-specific expected-source manifest
   and disclose any limit for which no independent completeness oracle exists;
   those sources cannot support an absence claim beyond the proved universe;
5. every expected source resolves to a verified intake receipt or an expressly
   reviewed non-receipt disposition, while an unresolved fetch blocks;
6. the manifest, external snapshot identities and reconciliation bind
   `IntakeCutoffAttestation`, receipt expectations, `IntakeUniverseManifest`,
   deal admission, `CorpusScopeManifest`, candidate release, coverage metadata
   and end-to-end traceability;
7. the reconciled acquisition manifest feeds PM intake and the existing
   independent deal-document admission machinery; and
8. gold readers receive a separately frozen source manifest, not a list derived
   from extractor output.

An 8-K-only catalogue, manually curated accession list or admitted-document list
cannot establish Process completeness. Any predicate based on absence requires
both acquisition and admission completeness.

## Extraction and certification

### Pipeline

1. The independently reconciled acquisition universe resolves through PM intake
   and complete deal-document admission.
2. PM admits immutable source bytes and creates the canonical text occurrence
   and source map.
3. A structural scope pass identifies likely narrative sections and proves
   which source regions were included. It is not counted as an independent
   event enumerator.
4. A semantic enumerator searches the full governed source scope for the
   complete question set.
5. A mechanistically separate family-appropriate enumerator searches the same
   full scope without using the semantic enumerator's model response or
   candidate list. Exclusivity uses a deterministic lexical and pattern path.
   Future families must certify their own genuinely independent second
   mechanism.
6. The paths freeze occurrence-independent narration and event slots.
7. Model inference, if used, produces non-authoritative proposal transcripts.
8. A reviewed inference payload retains selected, rejected and unresolved
   observations with evidence.
9. A deterministic normaliser produces the candidate semantic graph.
10. Validators test span integrity, source mapping, entity resolution,
   chronology, participant roles, event granularity, economics and
   relationships.
11. Independent inventories reconcile the two event enumerations and all
   discovered, rejected and residual observations.
12. The canonical writer creates candidate objects and revisions.
13. Predicate-specific certification and release admission determine what may
    serve.

The two event enumerators may share immutable source bytes and primitive
schemas. They must not share candidate enumeration logic, a model transcript or
a candidate list. Their disagreement rate is retained as certification and
drift evidence.

### Exact evidence invariant

Every published process assertion must resolve through:

`displayed field or component -> selected claim or relationship revision ->
field-specific evidence or derivation -> exact passage or multi-span excerpt ->
canonical source map -> immutable document bytes`

The passage text must reproduce from the stored half-open source interval.
Whitespace or punctuation rewriting is a failure. Context expansion may render
surrounding source text, but cannot change the evidence interval.

A displayed identity bridge, adviser assignment, calculation or relationship
must cite its own witness. The primary quote cannot be made to appear to support
a fact established elsewhere.

### Predicate-scoped certification

Certification applies to exact questions and predicates, not to "the extractor"
as a headline.

For exclusivity, separately certify at least:

- exclusivity requested and its subject;
- requester and recipient;
- express refusal;
- counterproposal;
- conditional acceptance;
- generic response unions and their preserved constituent state;
- exclusivity granted;
- grantor and beneficiary;
- start, end and duration;
- extension, amendment, waiver and expiry;
- stated rationale or condition;
- related bidder track;
- response relationship; and
- actual drafting passage.

A passing predicate cannot admit a failing sibling. A filter or Browse entry is
generated only when the exact predicate is admitted by the pinned release.
Every mandatory first-release predicate must pass.

### Gold and pilot sets

Metsera is the anchor gold deal because it stresses:

- competing Pfizer and Novo tracks;
- repeated requests and responses;
- topping and matching dynamics;
- deadlines and chronology;
- cash, dividend and CVR economics;
- repeated narration and related passages; and
- adviser and party identity.

Metsera is the development and anchor set, not generalisation evidence. A
pre-registered development and tuning set adds different structures, source
types, process shapes, periods and drafting styles. A separately sealed
holdout is selected from a frozen sampling frame with fixed strata, quotas,
source cutoff and exclusions. The total first-release certification corpus is
at least 25 deals.

Rules and contracts may be revised against Metsera and the tuning set. The
generalisation holdout is one-shot for one frozen candidate. Its contents and
case-level failures remain withheld from the extractor team until the release
decision. A failure permanently fails that candidate's generalisation claim and
cannot be converted into tuning evidence or replaced within that evaluation
generation.

A later candidate needs a separately pre-registered evaluation generation,
sampling frame, cutoff, quotas, minimum size and repeated-testing policy fixed
by the independent holdout custodian before prior holdout details are released.
Before the first holdout opens, the custodian pre-registers the finite ordered
generation schedule or expressly records that no later generalisation attempt
is authorised. Otherwise the product may claim only the exact enumerated
certified corpus and no broader generality.

After the failed candidate's release decision, a failed holdout deal may enter a
later exact-corpus certification exercise, but it cannot repair, rerun or
retroactively pass that candidate's one-shot generalisation evaluation.

For every certified predicate:

- every gold-set positive is found;
- no published positive lacks supporting evidence;
- actor, counterparty and bidder-track attribution is correct;
- exact spans and source maps pass for every published row;
- query and Browse entry points return semantically identical rows; and
- known negatives and adversarial counterexamples do not match.

Coverage claims are generated from the certification manifest. They are not
hand-written UI copy.

### Human review

Human review is exception-only after a predicate and extractor version are
certified. Review is required for:

- path disagreement;
- unresolved or conflicting entity identity;
- unsupported or ambiguous date inheritance;
- event-boundary disagreement;
- conflicting economics;
- unknown legal or process semantics;
- source-map failure; or
- an observation outside the governed taxonomy.

Review cannot invent evidence or approve a fact outside the canonical writer.

## Query and Browse

### One query door

Ask, Browse, saved searches and manual filters compile to the same versioned
Query IR. The compiler binds:

- release and contract identity;
- domain and certified predicate;
- result and evidence requirements;
- cohort and filters;
- sort and diversity rules;
- requested columns;
- pagination;
- exact-detail actions; and
- coverage and exclusions.

The client cannot submit raw SQL, physical column names or an unadmitted
predicate.

### Natural-language mode

Natural-language mode is deterministic and bounded for the initial release.
It maps practitioner language to admitted predicates and dimensions.

If a request is ambiguous or unsupported, the compiler returns a typed refusal
with the nearest valid concepts. It never substitutes a close predicate and
never uses a narrative LLM to conceal a refusal.

Every admitted mapping has a frozen practitioner-utterance suite containing
positive phrasings, drafting synonyms, abbreviations and ordinary misspellings,
plus legally adjacent negative and ambiguous phrasings. Independent
enumeration, mapping reconciliation and query goldens bind the compiler version
and predicate admission. A handwritten lexicon with inspected examples is not
certification.

The global front door compiles each initial request to exactly one domain plan.
Browse `All` is catalogue navigation, not a union query. A Boolean request that
combines Agreement, Process or future CVR predicates returns typed unsupported
until a successor bundle defines one composite result, output grain, set-based
projection and certified QueryPlan. The client cannot join separate domain
answers.

### Browse mode

Browse is a dynamic governed hierarchy:

`Domain -> Topic -> Pattern`

Examples:

- Process -> Exclusivity -> requested, declined, granted, extended, ended;
- Process -> Confidentiality and diligence -> NDA entry, diligence access,
  management presentation, clean team, restriction;
- Process -> Board decisions -> evaluation, rejection, authorisation,
  recommendation change;
- Agreement -> No-shop -> prohibited actions, exceptions, notice, matching
  rights; and
- CVR -> Milestone -> regulatory, commercial, timing, payment and dispute
  mechanics.

The selected topic controls the next-level list. The hierarchy stops at three
levels. Remaining distinctions are filters.

Browse labels and predicates come from the same registry. A display-only chip
or category that does not compile to a real predicate is prohibited.

### Filter-field registry

"More filters" is generated from one canonical field registry. It covers every
user-facing PM field, not every physical database column.

Each field definition binds:

- canonical field key and version;
- user label and group;
- data type;
- supported operators;
- domains and result kinds;
- output grain and same-deal, same-event, same-track or same-component scope;
- scalar or repeatable multiplicity, canonical equality and ordering;
- completeness state, maximum cardinality and overflow behaviour;
- explicit `EXISTS`, `NONE`, non-vacuous `ALL`, `CANONICAL_SET` or governed
  reducer semantics for each capability;
- filter, sort, group and display capabilities;
- source and derivation requirements;
- release and admission requirements; and
- unavailable-state reason.

The initial registry must include all current deals-index dimensions plus
canonical fields in these groups:

- deal and dates;
- parties and bidder tracks;
- structure and consideration;
- economics and value basis;
- counsel, lawyers and financial advisers;
- process event, phase, channel and outcome;
- agreement terms;
- CVR terms when that domain is added; and
- source, evidence, certification and provenance.

Raw IDs, hashes, run IDs and storage paths remain internal. A physically present
field that does not work under a release watermark is unavailable, not a filter
that returns a false zero. The Deal Storylines participant-hop defect is a
mandatory regression test for this rule.

### Execution

Execution is set-based, bounded and release-pinned. It must not fetch the entire
corpus into a serverless process before filtering.

The cache identity includes release, contract, query definition, predicate
admission, filters, columns, sort, diversity and cursor. A cache result from one
release or predicate cannot satisfy another.

That description is shorthand only. Execution reuses the complete generated
`CanonicalServingCacheIdentity`, including manifest, corpus, namespace and
header, serving metadata, import attestation, frozen pair, release-state tuple
and generation, serving epoch, authorisation scope, policy and revocation
generations, response schema and canonical action input. Each action performs
the mandatory admission-token RPC and at most one route-specific bounded serving
RPC.

Counts, coverage and deterministic deal-and-track diversification are produced
by a governed serving projection. Its generator version, inputs, diversity
keys, output digest and projection rows are bound by the release identity. The
query does not recreate ranking authority in application memory.

Phrasebook results are dedicated `ProcessPhrasebookPassageResult` objects with
`output_grain=RESULT` and `parent_kind=RESULT_ROW`. Narration, claim and
result-component identities appear only in lineage. Each row carries one
bounded verbatim `matched_passage_preview`, its exact interval and digest,
evidence role, source-local narration identity and exact-detail reference. The
default order is a compiled total comparator: direct predicate witness before
contextual or retold evidence, source-local primary narration before later
retellings, then governed source order. Diversification applies after that
comparator by deal and track. The UI does not perform one exact-detail request
per visible passage.

## Interface

### Governing structure

The interface has two equal entry modes:

- `Ask`, for natural-language questions; and
- `Browse`, for structured navigation.

The production UI uses PM's actual design language. The approved wireframes
establish interaction and information hierarchy only.

Browse uses quiet editorial navigation rather than a field of pills:

- text-level Ask and Browse navigation;
- a compact domain selector;
- a left topic index;
- a dynamic right pattern index; and
- an expandable, searchable all-field filter builder.

### Result layout

The default desktop layout is answer-first:

- query and coverage state at the top;
- 8 to 12 diversified passages in the primary column;
- selected-result metadata and actions;
- a persistent source reader beside the results; and
- optional table mode for dense research.

Mobile uses a full-screen source reader rather than compressing a split pane.

### Per-deal Exclusivity history

The first release may add an `Exclusivity history` view backed by the same
released exclusivity rows.
It provides:

- a chronological list of exclusivity events;
- bidder-track selection where the source supports named tracks;
- compact typed event labels and economics;
- filters generated from the same field registry;
- the same persistent source reader; and
- links from each event to related requests, responses, agreements and
  retellings.

The view is never labelled as a complete deal chronology. A general `Process`
timeline is deferred until a separately approved set of process families makes
that representation honest. The exclusivity view cannot create its own facts,
bidder attribution or summaries. A chart or process visual is a projection of
released typed rows and must retain the governing derivation.

### Context and related passages

Opening a result shows the actual filing text. `Show more above` and `Show more
below` are repeat-clickable and expand by one governed paragraph unit on each
click. The evidence span remains highlighted and visible.

Paragraph boundaries are a versioned canonical-text projection with source-map
lineage. A normaliser or segmentation change creates a new projection identity.
Expansion cannot depend on browser whitespace or an unversioned string split.

The current byte-cursor source action cannot implement this interaction. A
successor parent-bound paragraph-context action must fix the evidence parent,
segmentation projection, selected paragraph ordinal, maximum context, bounded
bidirectional cursor, object-level authorisation and response schema. The server
derives every ordinal. The caller cannot submit an arbitrary byte offset.

The reader also exposes related process discussions from the same proxy.
Each related item has a deterministic typed relationship label and a verbatim
preview. They use a bounded governed child collection and exact-detail
references, not application-side graph traversal. Any short classification or
summary is secondary. The user can always open the actual drafting.

### Result actions

Initial actions are:

- open source reading;
- copy passage with citation;
- copy share link;
- rerun a stale saved query against the active release, only after an explicit
  user action and changed-results warning;
- show related passages in this proxy; and
- export selected results.

Actions use the same release and exact-detail identity as the parent row.
Share links are explicitly bound to the exact active
`CandidateReleaseManifest`. If it is no longer active, the link returns
`RELEASE_NOT_ACTIVE`. Durable historical links are deferred until historical
serving is separately certified. That state may offer a separate
`RERUN_ON_ACTIVE_RELEASE` action which recompiles the saved governed query
against the current release and visibly warns that results may differ. It never
redirects or substitutes results for the original citation.

### Corrections

An authorised user may propose a correction from a result or source view. The
proposal binds the released row, exact source detail and requested field change.
It enters PM's canonical correction workflow and cannot mutate the active row.
A corrected result requires a new revision, affected-predicate recertification
and a successor release before it serves.

A material unsupported fact, source-map defect or cross-track error triggers
immediate containment. Before review and freeze, the successor root adds
`SEMANTIC_OR_SOURCE_INTEGRITY` to the closed
`ActiveReleaseRevocationActionRegistry`, with typed evidence identifying the
served row, source, defect class, severity, discovery authority and exact
active-before and exposure-off tuples.

A validated material trigger automatically raises the Process-wide serving
fence within the maximum acknowledgement time frozen in the
`OperationalPolicySet`. It does not alter canonical release state or count as
revocation. Process exposure cannot resume while the defect remains unresolved.
If the defect invalidates the certified active tuple, the registered action
deliberately revokes or rolls back the whole release tuple within the
policy-bound canonical-disposition deadline and rehearsed incident procedure.
The domain design does not invent a shorter deadline that pressures an
Agreement-affecting transaction. There is no partial Process canonical release
transition. Preparing a successor is not containment.

## Failure and trust behaviour

Request, row and detail failures fail closed and locally. A defect that
invalidates the certified active release invokes the release-wide containment
path above:

- unsupported question: typed refusal;
- uncertified predicate: unavailable with scope reason;
- incomplete corpus coverage: explicit coverage statement;
- missing field: known missing state, not empty text;
- unresolved entity: candidate review state, not guessed party;
- failed source detail: affected detail action only;
- malformed result row: affected row only;
- database or capacity failure: no legacy fallback;
- cross-release identity mismatch: reject before rendering; and
- absent result: never described as market absence without an admitted
  absence-proof contract.

The interface uses practitioner language. Internal machine keys, raw revision
objects and pipeline terminology remain available only in authorised audit
surfaces.

## Performance contracts

Serving targets:

- p95 warm query response under 500 ms and p99 under the separately frozen
  ceiling;
- p95 cold query response under 1.5 seconds;
- p95 local Browse and filter interaction under 200 ms;
- p95 source-context expansion under 300 ms when cached or range-addressable;
- stable cursor pagination independent of corpus size; and
- one mandatory admission RPC plus at most one bounded set-based serving RPC.

Extraction target:

- under ten minutes of machine time from admitted source to candidate graph for
  an ordinary process deal;
- incremental reprocessing by source digest, contract fingerprint and extractor
  version; and
- human attention only for governed exceptions.

Performance failure does not relax evidence or certification requirements.
The benchmark manifest fixes corpus and source-package sizes, ordinary and
maximum package definitions, concurrency, cold-cache definition, runtime,
hardware, database state, repetitions, error budget and percentile method.

## Metsera Process-slice acceptance

This slice follows the canonical `P1_VERTICAL_SLICE_PASS`; it is not a
substitute for that gate. The Metsera exclusivity slice is complete only when it
proves all of the following:

1. Every adjudicated exclusivity request, response, grant, change and ending is
   found.
2. Pfizer and Novo events remain on the correct bidder tracks.
3. Requester, recipient, grantor and beneficiary are not inferred from generic
   side labels.
4. Every named-to-source-local bidder unification has a permitted bridge witness
   and state. Unproved tracks remain source-local.
5. Exact dates, intervals and uncertainty reproduce from the source.
6. Repeated narration links to the same occurrence or is explicitly treated as
   a distinct occurrence.
7. Related exclusivity discussions elsewhere in the proxy are discoverable as
   verbatim passages.
8. Repeated context expansion never loses or rewrites the selected evidence.
9. Ask and Browse return the same rows for the same exclusivity predicate.
10. Party, adviser, economics and document filters work under the pinned
   release.
11. PM supplies deal identity, equity value, counsel and adviser facts with
    source lineage.
12. Cash, dividend and CVR components cannot contaminate one another.
13. The query and context performance contracts pass.
14. Every enabled field and predicate has a certification identity.
15. A deliberately malformed sibling row or detail leaves the remaining
    results usable.

Items 10 and 11 apply to the exact WP3A release-scope decision. A deliberately
reduced release does not fail because it omits a field that the approved scope
expressly removed. The omitted field and control remain unavailable. A full
release cannot claim success while any promised shared field is absent.

Passing Metsera permits the stratified pilot. It does not permit production
activation by itself.

## Deal Storylines migration

1. Pin the reviewed Storylines code commit and create a content-addressed
   database snapshot as prototype evidence. The snapshot includes the release
   watermark, relevant tables, `pipeline_runs`, `l2_revisions`, repair receipts,
   schema identity and checksums.
2. Export source references, candidate passages, typed proposals, corrections
   and known failure cases into bounded fixtures.
3. Map each Storylines vocabulary item to a governed PM concept, reviewed
   source-specific candidate or rejection.
4. Re-run discovery from canonical source bytes. Do not import V5 rows as
   canonical truth.
5. Reuse repair rules only after adversarial fixtures prove their safe domain.
6. Compare Storylines and canonical outputs to find omissions and false
   positives.
7. Preserve useful product fixtures for UI and query tests.
8. Retire the Storylines Phrasebook only after the PM precedent-search release
   passes equivalence, certification and rollback gates.
9. Keep the Storylines full Merger Brief clearly labelled as read-only
   prototype output until enough process families support an honest PM
   replacement, or Ben explicitly approves removing it without replacement.
10. Retire the remaining Storylines serving and credentials only after that
    surface-specific decision.

There is no dual-write or service-role connection from Storylines to PM. Any
temporary legacy surface is read-only, separately labelled and excluded from
canonical query, coverage and market claims.

## Future extractor families

The architecture must admit further domains without another platform:

- broader process families;
- CVR drafting and milestone mechanics;
- proxy projections and changes;
- voting and shareholder support;
- financing and commitment process; and
- other practitioner-selected corpora.

A new family adds governed definitions, questions, extraction adapters,
certification and Browse hierarchy. It does not add a new source store, writer,
query engine, field registry or UI shell.

## Security and release controls

- Extraction and review roles have no production serving authority.
- Serving roles read generated projections and bounded exact-detail actions
  only.
- Offline transcripts, reviewed payloads and candidate graphs remain denied to
  serving roles.
- Every write passes through the canonical writer.
- Every served predicate and field is listed by the release manifest.
- Feature flags and the active-release pointer remain separate controls.
- Candidate releases are staging-only until explicit activation.
- Rollback restores the prior release and invalidates incompatible caches.
- Process actions are generated into PM's action-authorisation matrix with
  default-deny service identities, object-level predicates, CSRF and origin
  rules.
- Filing and archive intake is sandboxed and tested for path traversal,
  decompression bombs, hostile markup and prompt injection.
- Data-bearing previews use isolated project identities and protected access.
- Export, share and correction actions have separate generated authorisation
  and rate contracts.

## Post-activation assurance

Certification distinguishes the sealed pilot from later admitted corpus
growth. Coverage copy states both.

For every release containing newly admitted process deals:

- audit every discovery-path disagreement and governed exception;
- fully source-review at least three randomly selected new deals, or all new
  deals when fewer than three exist;
- source-walk at least 20 newly served passages, or all when fewer exist;
- stratify the sample by predicate and bidder-track complexity; and
- retain the audit and population identities with the release.

Any unsupported served fact, critical omission, source-map failure or
cross-track attribution error immediately invokes the containment rule above,
blocks the affected predicate from a successor release and opens
recertification. A material increase over the pilot's discovery-disagreement or
exception rate also opens review under a frozen threshold defined before
activation.

## Definition of done

Process Intelligence is ready for an activation decision only when:

- the Metsera and stratified gold suites pass;
- exclusivity predicates are separately certified;
- all enabled filters work under the pinned release;
- shared PM deal facts and entities are used without parallel copies;
- Ask and Browse are semantically identical;
- exact source reading and repeated context expansion pass;
- the shared serving-row and exact-detail contracts pass on every surface;
- performance, accessibility and responsive-browser acceptance pass;
- Storylines data is treated only as source-backed evidence;
- one complete successor `CandidateReleaseManifest` contains Agreement and
  Process;
- Agreement content and semantics pass parity, excluding documented
  release-bound identity fields;
- feature flags remain closed until the explicit activation decision; and
- independent architecture and legal-semantic reviews pass.

## External adversarial review disposition

Fable's ten findings at `383ffee` are accepted:

1. release-compatible participant traversal becomes a named shared-graph
   deliverable;
2. release one exposes `Exclusivity history`, not a misleading full timeline,
   and does not silently retire the broader prototype timeline;
3. consumed PM contracts receive a freeze manifest and divergence gate;
4. source-local party unification receives an evidence contract;
5. discovery uses two actual, mechanistically separate enumerators;
6. ungoverned drafting-pattern ranking is removed from release one;
7. owner review hours are budgeted and enumeration labour is delegated;
8. Storylines evidence includes a checksummed ledger snapshot;
9. post-activation audit and drift-triggered recertification are required; and
10. adviser sparsity and non-vacuous positive tests are explicit.

Fable's round-two review at `76aa3ea` and reconciliation at `367aaf9` are
accepted with the recorded narrowing:

- production acquisition uses one fetch path plus an independent SEC
  completeness oracle, while semantic discovery retains two enumerators;
- temporal structure is lossless, pilot-shaped and PM-wide rather than a
  speculative release-one Process AST;
- request and row failure remain local, but an active-tuple integrity defect
  retains whole-release containment under a rehearsed policy rather than an
  arbitrary 60-minute domain deadline;
- review rounds receive a convergence contract before the first freeze;
- current programme gates continue to govern gold work, with the ambiguity
  surfaced for a future Canonical V2 decision rather than overridden here;
- holdout failure removes the generalisation claim, not an independently
  certified exact-corpus release;
- entity mastering moves to a separately planned reusable PM workstream;
- stale exact-release links may offer an explicit current-release rerun but
  never silently substitute results; and
- independence is defined operationally rather than inferred from two prompts
  to the same model family.

The three earlier planning-review amendments did not create canonical freezes or
vertical-slice reruns. After WP3A, any changed frozen contract byte does.

## Sol extra-high adversarial review disposition

The first cold Sol review examined the byte-identical design and plan at:

- design SHA-256
  `c09e848cbb523cd98cb25809ba4a665232bd855f7e2d5cda83a136b794ad97c5`;
- plan SHA-256
  `928ca53c6a2fd59937817e9f7412528259cb3329ce5645cf0fb2256f9ccdfde5`;
  and
- review root
  `5fe32d3a125241dd2002622069e35fa5e6358ba17f3d56a8543b05b91301dcb3`.

It returned `REJECT`. All seventeen findings are accepted: canonical programme
sequencing, missing shared-fact authority, source-universe completeness,
closed-contract mapping, whole-release atomicity, mandatory predicate floor,
clock semantics, query multiplicity, field-level evidence, paragraph context,
canonical RPC and cache contracts, active-release containment, security,
release-bound share links, pilot leakage, executable ownership and
family-specific enumerator independence.

The amendment also accepts four defects found in the parallel primary review:
governed inline passage delivery, natural-language utterance certification,
untouched holdout protection and deterministic within-sample relevance order.
This section records disposition only. The rejected review does not approve
this successor root, which requires a fresh cold review.

The second cold review examined successor root
`c44f2083020506962384f306e4a55d230499bbd0bced971b2a2d6830ec761d80`
and also returned `REJECT`. All eight findings are accepted: successor-bundle
vertical-slice authority, a closed narration carrier, an actual canonical
entity subject, result-parent phrasebook rows, acquisition-manifest release
lineage, legally distinct response and exclusivity-subject semantics, one-shot
holdout integrity and a registered semantic/source-integrity revocation cause.
That review does not approve the next successor root.

The third cold review examined successor root
`99bbb2836dd6a50ded93d86c5cccc4b095d971b7d995099e13b3fffe72a0868c`
and returned `REJECT`. Its four findings are accepted: pre-freeze gate
authorship and fresh same-pair slice attestations, pre-freeze acquisition
contracts, pre-freeze semantic-integrity revocation authority and consistent
phrasebook `RESULT` output with `RESULT_ROW` parentage. That review does not
approve the next successor root.

The fourth cold Sol review examined successor root
`53bbb31d4338014f2bf61fda07e2c8512118991ffc1b4e31335a693cab7f53a4`
and returned `PASS` with no unresolved blocking or high finding. The subsequent
Fable round-two amendments in this document create a new planning root, so that
PASS does not approve the amended bytes.

## Decisions deliberately deferred

- narrative LLM synthesis;
- the second process family after exclusivity;
- the first CVR question set;
- corpus-wide analytics beyond certified process predicates; and
- production activation date.
