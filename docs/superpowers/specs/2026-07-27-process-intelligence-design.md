# Canonical Process Intelligence design

## Status

Design approved in principle by Ben on 27 July 2026. This document consolidates
the approved product, extraction, query, interface and integration decisions for
adversarial review. It does not authorise production activation, corpus writes or
changes to an active release.

The evidence bases reviewed were:

- Precedent Machine `origin/main` at `0092e10`;
- the active canonical programme in `docs/CODEX-PROGRAM.md` and
  `docs/codex-program/canonical-contracts.md`;
- Deal Storylines review branch
  `origin/claude/reengineer-ground-up-fvp47j` at `77688ad`; and
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

Results diversify by deal, bidder track and drafting pattern. Repeated language
from one deal cannot crowd out the market sample.

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

Process work may proceed in parallel with the canonical programme by using:

- a pinned canonical contract fingerprint;
- immutable contract fixtures;
- an isolated module and namespace;
- staging-only candidate graphs;
- disabled feature flags;
- no active-release pointer authority;
- no production write capability; and
- no compatibility fallback to Storylines serving tables.

The module can propose and validate against fixtures before the relevant PM
contracts are physically available. Integration happens by replacing the
fixture adapter with the generated canonical adapter, not by migrating a
temporary process database into production.

All domain and field additions are append-only successor contracts. They must
not remint, reinterpret or invalidate the contract, release, row or query
identities used by the active Agreement domain. Existing PM results and queries
must remain byte-identical unless an independently approved migration expressly
changes them.

## Shared deal facts and entity authority

### Canonical fact projection

The process extractor receives a read-only, versioned deal-fact projection from
PM. At minimum it covers:

- canonical deal ID and source-document IDs;
- target and buyer entity IDs and display names;
- other bidder and counterparty entity IDs;
- announcement and signing dates;
- sector, jurisdiction, transaction structure and buyer type;
- consideration form and components;
- headline price per share;
- stated transaction value;
- normalised equity value and calculation basis;
- target and buyer law firms;
- named lawyers;
- target and buyer financial advisers; and
- the exact source and evidence state for each fact.

An extractor may propose a missing fact with evidence. Only the canonical writer
may admit it. The process domain cannot persist `pm_target`, `pm_acquirer` or
similar cached copies as an alternative truth.

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

Advisers attach to named entities and, where necessary, to a dated bidder track.
They do not attach merely to "acquirer side".

The canonical resolver may use notices, proxy disclosure and announcement press
releases as evidence. It retains the source and role basis. In a multi-bidder
process, counsel for Pfizer cannot be inherited by Novo or by an anonymous
Party A.

## Process semantic model

### Core objects

The process domain requires governed logical objects for:

- `ProcessEvent`: one legally or commercially meaningful narrated occurrence;
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

### Event identity and granularity

An event is the smallest occurrence at which the user asks a distinct process
question. Paragraph boundaries do not define event boundaries.

One multi-paragraph board meeting remains one event when the source presents one
continuous meeting. Two events on the same date remain separate when a new
occasion, actor, proposal, response or decision begins.

Continuation and retelling are first-class relationships. They are not repaired
by deleting or silently merging rows. A later proxy summary may link to an
earlier event without becoming a duplicate market observation.

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

## Extraction and certification

### Pipeline

1. PM admits immutable source bytes and creates the canonical text occurrence
   and source map.
2. A structural discovery path identifies the relevant filing sections and
   candidate narrative spans.
3. An independently authored semantic-family path searches the full governed
   scope for the complete question set.
4. Model inference, if used, produces non-authoritative proposal transcripts.
5. A reviewed inference payload retains selected, rejected and unresolved
   observations with evidence.
6. A deterministic normaliser produces the candidate semantic graph.
7. Validators test span integrity, source mapping, entity resolution,
   chronology, participant roles, event granularity, economics and
   relationships.
8. Independent inventories reconcile all discovered, rejected and residual
   observations.
9. The canonical writer creates candidate objects and revisions.
10. Predicate-specific certification and release admission determine what may
    serve.

Discovery paths may share immutable source bytes and primitive schemas. They
must not share the same candidate enumeration logic or silently agree through a
common model response.

### Exact evidence invariant

Every published process assertion must resolve through:

`result -> typed field -> semantic object -> exact passage -> canonical source
map -> immutable document bytes`

The passage text must reproduce from the stored half-open source interval.
Whitespace or punctuation rewriting is a failure. Context expansion may render
surrounding source text, but cannot change the evidence interval.

### Predicate-scoped certification

Certification applies to exact questions and predicates, not to "the extractor"
as a headline.

For exclusivity, separately certify at least:

- exclusivity requested;
- requester and recipient;
- exclusivity declined;
- form of decline;
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

### Gold and pilot sets

Metsera is the anchor gold deal because it stresses:

- competing Pfizer and Novo tracks;
- repeated requests and responses;
- topping and matching dynamics;
- deadlines and chronology;
- cash, dividend and CVR economics;
- repeated narration and related passages; and
- adviser and party identity.

Metsera is not the certification universe. A sealed, stratified pilot must add
different structures, source types, process shapes, periods and drafting styles.
The first release target is at least 25 deals.

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

### Per-deal Process view

The PM deal workspace gains a Process view backed by the same released rows.
It provides:

- a chronological event list;
- bidder-track selection where the source supports named tracks;
- compact typed event labels and economics;
- filters generated from the same field registry;
- the same persistent source reader; and
- links from each event to related requests, responses, agreements and
  retellings.

The per-deal view cannot create its own timeline facts, bidder attribution or
summaries. A chart or process visual is a projection of released typed rows and
must retain the governing derivation.

### Context and related passages

Opening a result shows the actual filing text. `Show more above` and `Show more
below` are repeat-clickable and expand by one governed paragraph unit on each
click. The evidence span remains highlighted and visible.

The reader also exposes related process discussions from the same proxy.
Each related item has a deterministic typed relationship label and a verbatim
preview. Any short classification or summary is secondary. The user can always
open the actual drafting.

### Result actions

Initial actions are:

- open source reading;
- copy passage with citation;
- copy share link;
- show related passages in this proxy; and
- export selected results.

Actions use the same release and exact-detail identity as the parent row.

### Corrections

An authorised user may propose a correction from a result or source view. The
proposal binds the released row, exact source detail and requested field change.
It enters PM's canonical correction workflow and cannot mutate the active row.
A corrected result requires a new revision, affected-predicate recertification
and a successor release before it serves.

## Failure and trust behaviour

The system fails closed and locally:

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

- warm query response under 500 ms;
- cold query response under 1.5 seconds;
- local Browse and filter interaction under 200 ms;
- source-context expansion under 300 ms when cached or range-addressable;
- stable cursor pagination independent of corpus size; and
- one bounded set-based database operation per ordinary query.

Extraction target:

- under ten minutes of machine time from admitted source to candidate graph for
  an ordinary process deal;
- incremental reprocessing by source digest, contract fingerprint and extractor
  version; and
- human attention only for governed exceptions.

Performance failure does not relax evidence or certification requirements.

## Metsera vertical-slice acceptance

The Metsera exclusivity slice is complete only when it proves all of the
following:

1. Every adjudicated exclusivity request, response, grant, change and ending is
   found.
2. Pfizer and Novo events remain on the correct bidder tracks.
3. Requester, recipient, grantor and beneficiary are not inferred from generic
   side labels.
4. Exact dates, intervals and uncertainty reproduce from the source.
5. Repeated narration links to the same occurrence or is explicitly treated as
   a distinct occurrence.
6. Related exclusivity discussions elsewhere in the proxy are discoverable as
   verbatim passages.
7. Repeated context expansion never loses or rewrites the selected evidence.
8. Ask and Browse return the same rows for the same exclusivity predicate.
9. Party, adviser, economics and document filters work under the pinned
   release.
10. PM supplies deal identity, equity value, counsel and adviser facts with
    source lineage.
11. Cash, dividend and CVR components cannot contaminate one another.
12. The query and context performance contracts pass.
13. Every enabled field and predicate has a certification identity.
14. A deliberately malformed sibling row or detail leaves the remaining
    results usable.

Passing Metsera permits the stratified pilot. It does not permit production
activation by itself.

## Deal Storylines migration

1. Freeze the reviewed Storylines branch and database state as prototype
   evidence.
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
8. Retire Storylines serving and credentials only after the PM release passes
   equivalence, certification and rollback gates.

There is no ongoing dual-write or service-role connection from Storylines to
PM.

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
- active PM agreement surfaces remain unchanged;
- feature flags remain closed until the explicit activation decision; and
- independent architecture and legal-semantic reviews pass.

## Decisions deliberately deferred

- narrative LLM synthesis;
- the second process family after exclusivity;
- the first CVR question set;
- corpus-wide analytics beyond certified process predicates; and
- production activation date.
