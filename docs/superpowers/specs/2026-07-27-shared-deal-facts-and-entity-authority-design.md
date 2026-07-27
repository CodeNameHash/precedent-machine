# Shared Deal Facts and Entity Authority Design

**Date:** 27 July 2026
**Status:** Proposed design for Ben review
**Scope:** Non-executable specification only

## Purpose

Precedent Machine needs one trusted source for common deal facts and people or
organisations.

This authority serves:

- the existing Agreement domain;
- the planned Process domain;
- a future CVR domain; and
- later extractors that need the same facts.

It covers facts such as deal value, consideration, parties, law firms, lawyers
and financial advisers.

The authority does not replace source text. Each fact must keep an exact path to
its source evidence.

## Current restriction

The formal programme gate does not yet permit data work or executable work.
This document does not:

- read Metsera filings;
- create Metsera gold data;
- run extraction;
- change a database;
- add a writer;
- add a query route;
- change a user interface; or
- write canonical records.

Those actions must wait for a valid programme-status artefact with
`canonical_work_start: PASS`.

## Problem

The current repository has useful deal data. It does not yet have one canonical
authority for shared deal facts and entities.

Current inputs include:

- `deals` table fields;
- `metadata.deal_facts`;
- `metadata.advisors_v2`;
- backfill output;
- read-time firm-name maps;
- read-time lawyer-name cleaning;
- serving-row text arrays named `adviser_firms` and `lawyers`; and
- deal-value basis classification.

These inputs are candidate evidence. They are not canonical truth.

The main faults are:

1. A display name can act as identity.
2. A name change can change a result without a new canonical release.
3. A side-level adviser can attach to the wrong bidder.
4. An enterprise value can be mistaken for an equity value.
5. A later source can silently replace an earlier source.
6. An empty field can mean several different things.
7. Agreement, Process and CVR could create separate copies of the same fact.
8. A filter can use a label that has no certified identity or evidence.

## Decision

Build one shared canonical authority inside Precedent Machine.

Each consumer gets a read-only projection. A projection is a controlled view of
canonical records.

Agreement, Process and CVR do not own separate entity or deal-fact stores. They
can propose candidates. Only the canonical writer can admit a candidate.

The shared authority uses the existing Canonical V2 rules for:

- stable occurrences;
- immutable revisions;
- typed relationships;
- exact evidence;
- controlled writers;
- whole-release publication;
- release-pinned queries;
- exact-detail actions; and
- traceability.

## Considered approaches

### Approach 1: Improve the current text fields

This approach would add more aliases and clean more names at read time.

It is rejected.

It gives better display text. It does not give stable identity, source evidence,
conflict handling, revision history or release control.

### Approach 2: Build a Process-only entity and fact store

This approach would let Process move quickly.

It is rejected.

It would create a second truth. Agreement and CVR would then need copies or
bridges. The copies could disagree.

### Approach 3: Build one shared canonical authority

This approach is selected.

It requires more contract work before the first full Process release. It gives
one reusable and testable foundation for all domains.

## Design rules

1. A name is not an identity.
2. A value is not useful without its basis.
3. A fact is not canonical without exact evidence.
4. A missing value is not automatically absent.
5. A source conflict is data. It is not an overwrite instruction.
6. A participant role is specific to a deal and, when needed, a bidder track.
7. A domain can propose a fact. It cannot admit its own proposal.
8. A field cannot appear as a canonical filter until its release contract
   admits it.
9. A current release never changes in place.
10. Legacy data cannot become canonical only because it already exists.

## Shared model

### EntitySubject

`EntitySubject` means one person or organisation.

Its stable ID must derive from one of:

- a governed external identifier, such as an SEC CIK;
- another registered identifier type, such as an LEI; or
- a Ben-approved immutable import seed.

An immutable import seed is a fixed identifier assigned during a reviewed
import. It cannot change when a display name changes.

The ID must never derive from:

- display name;
- cleaned name;
- ticker alone;
- deal date;
- deal economics;
- source order; or
- database row ID.

The stable subject class is one of:

- `NATURAL_PERSON`;
- `ORGANISATION`; or
- `GOVERNMENT_BODY`.

An `EntityClassificationRevision` can contain several governed classifications.
Initial classifications include:

- `PUBLIC_COMPANY`;
- `PRIVATE_COMPANY`;
- `INVESTMENT_FIRM`;
- `LAW_FIRM`;
- `FINANCIAL_SERVICES_FIRM`; and
- `OTHER_ORGANISATION`.

A classification needs its own evidence and effective-time scope. It does not
prove a role in a deal. For example, `FINANCIAL_SERVICES_FIRM` does not prove
that the firm advised a party in a specific deal.

An entity can have immutable revisions. A revision can change a display label
or status. It cannot change the subject that the ID identifies.

An entity can have several governed external identifiers. The contract selects
one identifier or immutable import seed for stable identity. Other identifiers
are source-backed assertions.

If a later identifier proves that two seeded subjects are one entity, the
system does not rekey old records. A reviewed supersession or equivalence
relationship selects the surviving subject for a successor release. A conflict
blocks that selection.

### EntityNameOccurrence

`EntityNameOccurrence` means one exact name in one source location.

It records:

- the exact text;
- the source occurrence;
- the exact source interval;
- the name role, such as legal name, short name or source-local label;
- the language;
- the extraction version; and
- its evidence state.

It can refer to an `EntitySubject`. It is not itself an `EntitySubject`.

Names such as `Party A`, `Bidder 2` and `Party 3` remain valid source-local
names. They remain unresolved until evidence supports a bridge.

### EntityIdentityBridge

`EntityIdentityBridge` is a reviewed link between a source-local identity and
an `EntitySubject`.

It uses the fixed Canonical V2 relationship states:

- `PRESENT`;
- `ABSENT`;
- `NOT_APPLICABLE`;
- `NOT_EXAMINED`; or
- `FAILED`.

It also has one identity disposition:

- `NAMED`;
- `GOVERNED_BRIDGE_CONFIRMED`;
- `SOURCE_LOCAL_ONLY`;
- `CONFLICTING`; or
- `NO_BRIDGE_WITNESS`.

`NAMED` means that the source directly names the entity.

`GOVERNED_BRIDGE_CONFIRMED` means that separate evidence proves the link.

`SOURCE_LOCAL_ONLY` means that the source label is valid but the named subject
is not proven.

`CONFLICTING` means that the available evidence points to incompatible
subjects.

`NO_BRIDGE_WITNESS` means that a complete governed search found no permitted
bridge witness. It does not prove that the source-local subject has no real
name.

`FAILED` remains the canonical relationship state for a failed bridge process.
It does not mean that no bridge exists.

The permitted combinations are:

- `PRESENT` with `NAMED` or `GOVERNED_BRIDGE_CONFIRMED`;
- `ABSENT` with `NO_BRIDGE_WITNESS`, after complete frozen examination;
- `NOT_EXAMINED` with `SOURCE_LOCAL_ONLY`;
- `NOT_APPLICABLE` with `SOURCE_LOCAL_ONLY`; and
- `FAILED` with no asserted bridge.

`CONFLICTING` is a candidate-review disposition. It blocks selection of a
terminal bridge revision.

Permitted bridge evidence must be registered before extraction. Examples can
include:

- an exact source statement that equates two names;
- an exact SEC identifier;
- a governed legal-name and identifier match;
- a reviewed transaction-party record with an exact source path; or
- an approved cross-document identity statement.

A normalised name match alone is never sufficient.

The bridge records:

- the source-local subject occurrence;
- the selected `EntitySubject`, if any;
- the bridge rule and version;
- exact evidence;
- conflict checks;
- state;
- revision and supersession; and
- review evidence.

### DealParticipantRelationship

`DealParticipantRelationship` links an entity or source-local subject to a
deal.

The relationship records:

- deal ID;
- entity ID or source-local subject occurrence;
- role layer and role code;
- transaction-leg resolution occurrence ID, when the deal has several legal
  steps;
- bidder-track ID, when needed;
- start and end scope, when stated;
- exact evidence;
- state;
- relationship definition and version; and
- revision.

One entity can have several roles. Each role has its own relationship and
evidence.

The model has three separate parts.

#### Legal document role

This layer records the role used by the source document.

Initial legal roles include:

- `COMPANY`;
- `PARENT`;
- `MERGER_SUB`;
- `ACQUIROR`;
- `ISSUER`;
- `SELLER`;
- `SURVIVING_ENTITY`;
- `CONSTITUENT_ENTITY`;
- `NEW_HOLDCO`;
- `DISTRIBUTING_PARENT`;
- `SPINCO`;
- `REMAINCO`; and
- `OTHER_LEGAL_PARTY`.

A legal role does not prove the economic role. The surviving entity is not
automatically the buyer. The share issuer is not automatically the controlling
party.

#### Transaction role

This layer records the reviewed commercial role.

Initial transaction roles include:

- `TARGET`;
- `BUYER`;
- `BIDDER`;
- `COMBINATION_PARTY`;
- `SPONSOR`;
- `CONSORTIUM_MEMBER`;
- `DIVESTING_PARENT`;
- `CONTRIBUTING_PARTY`;
- `ACQUIRED_BUSINESS`;
- `MERGER_COUNTERPARTY`; and
- `OTHER_COUNTERPARTY`.

A role is not inherited from a general side label.

For example, an adviser for Pfizer does not become an adviser for Novo because
both are possible buyers.

`TARGET` and `BUYER` are optional. A merger of equals can use two or more
`COMBINATION_PARTY` relationships when the evidence does not support a simple
target and buyer classification.

#### Control outcome

Control is a deal fact. It is not inferred from a participant label.

`TransactionControlOutcome` records:

- control state;
- controlling entity IDs, when supported;
- effective time;
- voting ownership evidence;
- board-composition evidence;
- management evidence;
- source characterisation;
- exact derivation rule; and
- exact source evidence.

It uses one canonical state:

- `PRESENT`;
- `ABSENT`;
- `NOT_EXAMINED`;
- `NOT_APPLICABLE`; or
- `FAILED`.

When the state is `PRESENT`, the control outcome is one of:

- `CONTROLLED_BY_ONE_PARTICIPANT`;
- `SHARED_CONTROL`;
- `NEW_HOLDCO_SHARED_CONTROL`;
- `NO_CLEAR_CONTROL`.

`ABSENT` means that complete frozen source examination found no qualifying
control statement or derivation. It does not mean that nobody controls the
combined company.

Company name, headquarters, chief executive, surviving entity, share issuer
and relative ownership are evidence inputs. No one input decides control by
itself.

#### Source transaction legs

`SourceTransactionLegOccurrence` records one source statement about one legal
step inside a transaction.

Its stable ID derives from:

- governed deal ID;
- leg definition and version;
- admitted source occurrence;
- expected source-leg-slot key; and
- governed repeatable ordinal.

It does not derive from a later structure classification, party label or
extracted value.

Initial leg types include:

- `DIRECT_MERGER`;
- `FORWARD_TRIANGULAR_MERGER`;
- `REVERSE_TRIANGULAR_MERGER`;
- `TENDER_OFFER`;
- `SECOND_STEP_MERGER`;
- `DISTRIBUTION_OR_SPIN_OFF`;
- `CONTRIBUTION`;
- `SHARE_EXCHANGE`;
- `ASSET_TRANSFER`;
- `NEW_HOLDCO_FORMATION`; and
- `OTHER_GOVERNED_STEP`.

Each `SourceTransactionLegRevision` records:

- canonical state;
- exact source endpoints;
- observed participant roles;
- observed predecessor and successor source-leg occurrence IDs;
- closing condition, when stated;
- effective-time expression;
- source order;
- exact evidence; and
- revision and resolver version.

#### Deal-level transaction legs

`TransactionLegResolutionOccurrence` records one reviewed legal step at the
deal level.

Its stable ID derives from:

- governed deal ID;
- leg definition and version;
- expected deal-leg-slot key; and
- governed repeatable ordinal.

It does not derive from a source label, participant name, later classification
or extracted value.

Each `TransactionLegResolutionRevision` selects:

- the complete ordered supporting source-leg revisions;
- resolved participant-role relationships;
- resolved source and target entities;
- predecessor and successor deal-leg occurrence IDs;
- effective-time expression;
- closing conditions;
- exact evidence;
- conflict disposition; and
- resolver version.

Each participant relationship can point to one
`TransactionLegResolutionOccurrence` or to the whole transaction.

`TransactionStructureResolution` selects the complete ordered set of deal-level
leg resolution revisions and participant-role revisions. A missing required
leg, unreconciled duplicate deal-level leg or unresolved endpoint blocks a
complete resolution. Several sources can support the same resolved leg.

This is required for a Reverse Morris Trust. The distribution, contribution
or internal reorganisation, and merger remain separate when the sources state
them. The divesting parent, separated business, merger counterparty, merger
subsidiary and surviving entity keep their own roles.

#### Transaction structure and characterisation

The system keeps legal structure separate from source or market
characterisation.

Initial legal structure codes include:

- `DIRECT_MERGER`;
- `FORWARD_TRIANGULAR_MERGER`;
- `REVERSE_TRIANGULAR_MERGER`;
- `REVERSE_MERGER`;
- `REVERSE_MORRIS_TRUST`;
- `TENDER_OFFER_WITH_SECOND_STEP_MERGER`;
- `NEW_HOLDCO_COMBINATION`;
- `ASSET_ACQUISITION`;
- `SHARE_EXCHANGE`;
- `SPIN_MERGE`;
- `DE_SPAC`;
- `JOINT_VENTURE_COMBINATION`; and
- `OTHER_REVIEWED_STRUCTURE`.

Initial characterisation codes include:

- `ACQUISITION`;
- `MERGER_OF_EQUALS_STATED`;
- `COMBINATION`;
- `STRATEGIC_MERGER`;
- `DIVESTITURE`.

Missing and conflicting characterisations use the existing deal-fact
resolution states and dispositions. They are not characterisation values.

`MERGER_OF_EQUALS_STATED` requires exact source language. It does not follow
only from relative ownership, board allocation or an unadmitted market label.

`REVERSE_MERGER` means that legal form and economic acquisition direction do
not align. It is different from `REVERSE_TRIANGULAR_MERGER`, which describes
the legal merger path.

A reviewed PM classification can differ from source characterisation. The
projection must show which value is source-stated and which value is a governed
classification.

When target and buyer roles are supported, the product can show the simple
Target and Buyer labels. Otherwise it shows Combination Parties. It does not
fill a false Target or Buyer value for display convenience.

`buyer_type` is `NOT_APPLICABLE` when no reviewed buyer role exists.

### ProfessionalAssignmentRelationship

`ProfessionalAssignmentRelationship` gives the detailed professional role.

It links:

- a professional entity;
- a represented entity or source-local subject;
- a deal;
- an optional bidder track;
- a professional role;
- an optional time scope; and
- exact evidence.

Initial professional roles include:

- `LEGAL_COUNSEL`;
- `FINANCIAL_ADVISER`;
- `SPECIAL_COMMITTEE_COUNSEL`;
- `BOARD_COUNSEL`;
- `FINANCING_COUNSEL`;
- `REGULATORY_COUNSEL`; and
- `NAMED_LAWYER`.

The contract must state whether one assignment can have several firms or
lawyers. It must also state the permitted relationship between a lawyer and a
firm.

It uses the fixed Canonical V2 relationship states:

- `PRESENT`;
- `ABSENT`;
- `NOT_EXAMINED`;
- `NOT_APPLICABLE`;
- `FAILED`.

It also has one professional-assignment reason:

- `DISCLOSED`;
- `UNDISCLOSED`;
- `NO_ADVISER_STATED`;
- `CONFLICTING_ASSIGNMENTS`;
- `OUTSIDE_REQUIRED_SOURCE_SCOPE`; or
- `EXTRACTION_FAILED`.

`UNDISCLOSED` requires `ABSENT`, a complete frozen source scope and proof that
no qualifying disclosure exists.

`NO_ADVISER_STATED` requires a `PRESENT` source-backed fact that states that
there was no adviser. Silence does not prove it.

The permitted combinations are:

- `PRESENT` with `DISCLOSED`;
- `ABSENT` with `UNDISCLOSED`, after complete frozen examination;
- `NOT_APPLICABLE` with `NO_ADVISER_STATED` and its positive fact evidence;
- `NOT_EXAMINED` with `OUTSIDE_REQUIRED_SOURCE_SCOPE`; and
- `FAILED` with `EXTRACTION_FAILED`.

`CONFLICTING_ASSIGNMENTS` is a candidate-review reason. It blocks terminal
selection.

### SourceDealFactOccurrence and SourceDealFactRevision

`SourceDealFactOccurrence` means one expected source statement about one
governed deal fact.

Its identity derives from:

- governed deal ID;
- fact definition and version;
- admitted source occurrence;
- governed source role;
- effective-time slot;
- expected source slot; and
- governed repeatable ordinal, when the fact can repeat.

The occurrence means “this source's expected statement about this fact”. A
revision contains the answer, state and evidence.

Initial fact families are:

- deal announcement date;
- agreement signing date;
- closing date, when used;
- sector;
- jurisdiction;
- transaction legal structure;
- transaction source characterisation;
- transaction control outcome;
- post-closing voting ownership, when stated;
- post-closing board composition, when stated;
- buyer type;
- consideration form;
- consideration component;
- headline price per share;
- stated transaction value;
- stated value basis;
- outstanding share or security count, when relevant;
- debt or cash adjustment, when relevant; and
- another registered derivation input.

The source revision uses the fixed Canonical V2 claim states:

- `PRESENT`;
- `ABSENT`;
- `NOT_EXAMINED`;
- `NOT_APPLICABLE`;
- `FAILED`.

It uses the Canonical V2 occurrence and revision pattern. It does not falsely
reuse the current legal `ClaimOccurrence`, whose owner contract is different.
The successor bundle must register this new logical type and its owner.

Each `PRESENT` revision records:

- raw source text;
- canonical value;
- unit;
- basis;
- exact evidence;
- source role;
- source date;
- normalisation version;
- derivation version, if used; and
- review state.

`ABSENT` requires a complete frozen source scope and a zero-witness proof. The
authority does not use an empty string to represent a state.

### DealFactResolutionOccurrence and DealFactResolutionRevision

`DealFactResolutionOccurrence` means the reviewed deal-level answer for one
fact, basis and effective-time scope.

Its revision selects the complete ordered set of applicable
`SourceDealFactRevision` records.

It uses one canonical state:

- `PRESENT`;
- `ABSENT`;
- `NOT_EXAMINED`;
- `NOT_APPLICABLE`; or
- `FAILED`.

Its resolution disposition is one of:

- `SELECTED_EXACT_STATEMENT`;
- `SELECTED_REGISTERED_DERIVATION`;
- `CONSISTENT_MULTI_SOURCE`;
- `RESOLVED_SOURCE_CONFLICT`;
- `UNDISCLOSED`;
- `NOT_EXAMINED`;
- `NOT_APPLICABLE`;
- `UNRESOLVED_CONFLICT`; or
- `FAILED`.

The permitted terminal combinations are:

- `PRESENT` with `SELECTED_EXACT_STATEMENT`,
  `SELECTED_REGISTERED_DERIVATION`, `CONSISTENT_MULTI_SOURCE` or
  `RESOLVED_SOURCE_CONFLICT`;
- `ABSENT` with `UNDISCLOSED`;
- `NOT_EXAMINED` with `NOT_EXAMINED`;
- `NOT_APPLICABLE` with `NOT_APPLICABLE`; and
- `FAILED` with `FAILED`.

`RESOLVED_SOURCE_CONFLICT` records:

- all conflicting source revisions;
- the governed selection rule;
- the selected revision;
- the reason for the selection;
- review evidence; and
- exact conflict detail.

`UNRESOLVED_CONFLICT` is a candidate-review disposition. It blocks terminal
selection and publication of that fact as a canonical filter, group, sort or
denominator. Candidate review keeps all source revisions.

A release can select one answer only after the resolution contract passes.
Selection never deletes or replaces another source statement.

## Deal economics

### Separate value types

The system keeps these value types separate:

- `EQUITY_VALUE`;
- `ENTERPRISE_VALUE`;
- `HEADLINE_TRANSACTION_VALUE`;
- `OFFER_PRICE_PER_SHARE`;
- `STOCK_EXCHANGE_RATIO`;
- `TARGET_PAID_DIVIDEND`;
- `CVR_MAXIMUM_PAYMENT`;
- `CVR_EXPECTED_PAYMENT`, only if a governed method later permits it; and
- `OTHER_STATED_VALUE`.

A user-facing label can group these values. The canonical records cannot merge
them.

### Source statements

An announcement press release is a preferred source for a stated headline
value when it actually states that value. Preferred means “check this source
for this fact”. It does not mean “silently override every other source”.

The system preserves every material source statement as its own source-backed
revision.

If a press release states enterprise value and a proxy later states equity
value, both statements remain available. They are not conflicting merely
because they use different bases.

If two sources state different values on the same basis and for the same
effective time, the system records a conflict.

### Normalised equity value

The system can publish a normalised equity value only when a registered
derivation is complete.

The derivation records:

- each input fact resolution;
- input value and unit;
- effective date;
- share or security class;
- inclusion rule;
- exclusion rule;
- arithmetic operation;
- rounding rule;
- result; and
- exact source evidence for each input.

The system must not:

- rename enterprise value as equity value;
- add a target-paid dividend to buyer consideration without an approved rule;
- add a CVR ceiling as if it were certain cash;
- combine incompatible dates;
- use an unexplained share count; or
- fill a missing input from a different deal.

If the derivation is incomplete, the underlying canonical state is
`NOT_EXAMINED` or `FAILED`, as applicable. A deal-level resolution can use the
`UNDISCLOSED` disposition when its complete source proof permits it. The system
does not guess.

## Source-scope contract

Each fact and relationship definition declares its required source roles before
extraction.

Possible source roles include:

- announcement press release;
- merger agreement;
- proxy statement;
- Schedule 14D-9;
- Schedule TO;
- amendment;
- closing release;
- notices provision; and
- another registered source role.

This list is not one fixed source order for every fact. Each field definition
states:

- eligible source roles;
- required source roles;
- effective-time rule;
- expected source slots;
- conflict rule;
- complete-examination rule; and
- source-specific evidence rule.

Expected source slots are created from the admitted source universe before
value extraction. Candidate values cannot define the source universe.

An independent source-universe check must reconcile exact accession membership,
not only source counts.

`ABSENT` and the display reason `UNDISCLOSED` require complete examination of
the frozen required source set. A missing or failed source gives
`NOT_EXAMINED` or `FAILED`.

## Shared temporal expression

Dates and time scopes use one shared `TemporalExpression` contract.

This contract serves:

- deal facts;
- participant roles;
- adviser assignments;
- Process events; and
- future CVR milestones.

It must preserve the complete source expression before it adds a structured
value.

The first frozen registry can be empty. An exploratory pilot can then record
raw expressions, but it cannot certify or release structured temporal nodes.
All pilot-observed nodes enter one reviewed successor amendment before
certified extraction. A pilot cannot silently add a node after freeze.

## Evidence

Every displayed canonical field must reach its own evidence.

The evidence path includes:

- canonical field;
- selected revision or relationship revision;
- evidence edge;
- exact excerpt;
- exact source occurrence;
- source admission record; and
- release ID.

One excerpt can support several fields only through separate evidence edges.

A calculation also links to every input fact resolution and its evidence.

The source reader can show:

- the exact supporting text;
- more text above;
- more text below;
- repeated expansion through “show more”;
- less text through “show less”; and
- the full source document, subject to the existing controlled detail action.

This design does not create a new source reader. It supplies the evidence paths
that the shared reader needs.

## Identity and revision rules

The successor canonical bundle must define each ID before data work begins.

At minimum, it must define IDs for:

- entity subject;
- entity revision;
- entity-classification revision;
- external-identifier assertion;
- entity-name occurrence;
- source-local subject occurrence;
- identity-bridge occurrence;
- identity-bridge revision;
- source deal-fact occurrence;
- source deal-fact revision;
- deal-fact resolution occurrence;
- deal-fact resolution revision;
- participant relationship occurrence;
- participant relationship revision;
- source transaction-leg occurrence;
- source transaction-leg revision;
- transaction-leg resolution occurrence;
- transaction-leg resolution revision;
- transaction-structure resolution;
- transaction-control-outcome resolution;
- professional assignment occurrence;
- professional assignment revision;
- value derivation;
- candidate proposal;
- serving projection record; and
- exact-detail reference.

Occurrence IDs describe stable expected objects. Revision IDs describe answers.

Changing an answer, state, source, bridge, role, temporal scope or derivation
creates a new revision. It does not silently change the old revision.

Allocated database IDs and display text remain outside canonical identity.

## Candidate proposals and writer authority

Agreement, Process and CVR can submit a `SharedAuthorityCandidateProposal`.

A proposal contains:

- proposed logical type;
- proposed occurrence or relationship slot;
- proposed value or endpoint;
- exact evidence;
- proposer domain;
- extractor and version;
- source scope;
- uncertainty state; and
- conflict observations.

A proposal is not canonical data.

Only registered canonical writer actions can:

- create expected occurrences;
- select revisions;
- admit identity bridges;
- admit relationships;
- admit derivations;
- write candidate-release records; or
- publish a release.

The bundle must register:

- every logical type;
- every expected slot;
- every physical carrier;
- every writer action;
- every permitted endpoint;
- every release treatment;
- every import treatment;
- every trace path;
- every serving projection; and
- every exact-detail action.

An unknown type, carrier or writer action blocks publication.

## Rigour and certification

This authority inherits the full Canonical V2 certification model. It does not
use a lighter path because the fields look factual.

Before extraction:

1. Independent and ordinary contract paths define the semantic questions,
   source scopes, expected slots, value types, relationship endpoints and
   failure rules.
2. The paths cannot read each other's answers.
3. Reconciliation proves exact key and payload equality.
4. The bundle registers every logical type, carrier, writer, query field and
   exact-detail action.
5. The source universe and expected occurrences freeze.

After extraction:

1. Extractors produce candidate revisions and relationships.
2. Independent checks recompute occurrence IDs, revision IDs, evidence
   intervals, derivations and result projections.
3. Reconciliation compares exact accession membership and exact object
   membership. Count equality is not sufficient.
4. Negative tests challenge wrong identity, wrong side, wrong bidder track,
   wrong basis, wrong date and missing evidence.
5. The candidate release must pass whole-bundle validation, import parity,
   serving parity and trace checks.

An unresolved difference blocks publication. A manual display correction cannot
replace the failed canonical proof.

## Read-only consumer projection

Consumers use `CanonicalDealFactProjection`.

The projection is pinned to:

- canonical contract fingerprint;
- serving namespace;
- corpus release;
- governed deal ID; and
- projection version.

It contains only fields that the release admits.

For each field, it provides:

- field key and version;
- canonical value;
- display label;
- typed state;
- entity ID or relationship ID, when applicable;
- selected resolution revision ID;
- exact-detail action;
- conflict indicator;
- derivation reference, when applicable; and
- release identity.

The projection must not provide a service-role credential or direct write path.

### Required first projection fields

The target first full projection contains:

- governed deal ID;
- target entity;
- buyer entity;
- combination-party entities;
- other named bidder entities;
- source-local bidder labels;
- announcement date;
- signing date;
- sector;
- jurisdiction;
- transaction legal structure;
- transaction source characterisation;
- transaction legs;
- transaction control outcome;
- buyer type;
- consideration form;
- consideration components;
- headline price per share;
- each stated transaction value and basis;
- normalised equity value and derivation state;
- target and buyer law firms;
- named lawyers;
- target and buyer financial advisers; and
- exact evidence state for every field.

Target, buyer and buyer-type fields can have a typed `NOT_APPLICABLE` state.
Combination-party fields remain available for those structures.

An initial reduced release can omit fields that are not certified. It must not
serve legacy values under canonical field names.

## Query and filter contract

The PM-wide canonical field registry controls display, filter, sort and group
behaviour.

The registry contains every user-facing PM field. It does not expose every
physical database column. This workstream adds shared entity and deal-fact
definitions to that registry. Agreement, Process and future CVR workstreams add
their own domain definitions to the same registry.

The “More filters” control receives the complete release-admitted union. It is
not a separate Process-only list.

Each field definition states:

- field key and version;
- label;
- value type;
- permitted domains;
- display capability;
- filter capability;
- sort capability;
- group capability;
- permitted operators;
- missing-state behaviour;
- release requirements;
- source-detail action; and
- projection path.

Identity filters use canonical IDs internally. They show reviewed display
labels to the user.

The current `adviser_firms` and `lawyers` text arrays can remain as
compatibility display fields. After migration, they must be generated from
certified entity and assignment relationships. They cannot remain the source of
identity or filter truth.

If a field is not certified in the selected release:

- the user interface does not offer it as an active filter;
- a saved query returns a typed unavailable result;
- natural-language search cannot compile to it; and
- the server rejects a direct request for it.

Ask, Browse, manual filters and saved searches use the same field definition.

## Release and serving rules

The shared authority publishes only through a whole successor release.

The release includes:

- the exact canonical bundle;
- selected entity revisions;
- selected entity-classification revisions;
- selected external-identifier assertions;
- selected name and bridge revisions;
- selected source deal-fact revisions;
- selected deal-fact resolution revisions;
- selected source transaction-leg revisions;
- selected transaction-leg resolution revisions;
- selected transaction-structure and control-outcome resolutions;
- selected participant and professional relationships;
- selected derivations;
- generated serving projections;
- generated field definitions;
- exact-detail references;
- complete object inventory;
- import evidence;
- trace evidence; and
- parity evidence.

There is no in-place update to an active release.

Live queries and pinned-release queries must return the same logical result
when they point to the same release.

A changed name map, value rule, bridge rule or assignment rule requires a new
candidate release.

## Legacy migration

Legacy records are inputs to review. They are not automatically admitted.

The migration must inventory:

- every `deals` fact field;
- every `metadata.deal_facts` field;
- every `metadata.advisors_v2` field;
- every legacy adviser record;
- every firm alias;
- every lawyer cleaning rule;
- every backfill output;
- every deal-value provenance record; and
- every serving-row text dimension.

Each legacy item gets one disposition:

- `CANDIDATE_WITH_SOURCE`;
- `CANDIDATE_SOURCE_MISSING`;
- `DISPLAY_ONLY`;
- `DUPLICATE`;
- `CONFLICTING`;
- `OUT_OF_SCOPE`; or
- `INVALID`.

There is no direct table copy into canonical carriers.

There is no dual write between a legacy store and the canonical writer.

The migration produces a discrepancy report before any candidate release.

## Domain use

### Agreement

Agreement uses the projection for:

- deal dimensions;
- denominator facts;
- counsel and adviser fields;
- entity filters; and
- exact source detail.

Agreement does not change its legal extraction model.

### Process

Process uses the projection for:

- target, buyer, bidder and combination-party identity;
- transaction legs, structure and control outcome;
- bidder-track participants;
- deal economics;
- counsel and advisers;
- shared filters; and
- exact source detail.

Process keeps source-local labels when no entity bridge is proven.

### CVR

A future CVR extractor uses the same projection for:

- deal and party identity;
- consideration components;
- stated and normalised values;
- advisers;
- document identity; and
- shared filters.

CVR-specific milestones, payments, conditions and disputes remain in the CVR
domain. They do not become general deal facts.

## Failure behaviour

The system fails closed.

Examples:

- unresolved entity: keep the source-local identity;
- conflicting bridge: do not merge;
- unknown value basis: do not normalise;
- incomplete derivation: do not publish normalised equity value;
- unsupported target or buyer classification: show combination parties;
- surviving entity or share issuer without economic-role proof: keep only the
  legal role;
- source-backed conclusion of no clear control: use `NO_CLEAR_CONTROL`;
- unresolved control outcome: use `NOT_EXAMINED` or block a required field;
- missing transaction leg: block the complete structure resolution;
- missing adviser disclosure: use the correct typed state;
- wrong bidder track: block admission;
- source evidence outside the admitted source: block admission;
- stale release join: reject the request;
- unavailable field: do not show an active filter;
- legacy-only value: label it as legacy candidate evidence; and
- writer or carrier outside the registry: block publication.

## Acceptance conditions

The shared authority is not ready until all applicable conditions pass.

### Identity

1. A display-name change does not change entity identity.
2. Two entities with similar names do not merge without bridge evidence.
3. One entity with several source names can unify through reviewed evidence.
4. `Party 3` remains source-local when no bridge is proven.
5. Conflicting bridges block unification.
6. Every displayed entity can open its exact identity evidence.

### Deal facts and economics

7. A press-release value keeps its exact words and stated basis.
8. Enterprise value cannot become equity value by relabelling.
9. A target-paid dividend cannot become buyer consideration.
10. Cash, stock, dividend and CVR components remain separate.
11. A normalised equity value exposes every input and operation.
12. A missing share count prevents the derivation.
13. Conflicting source facts remain visible and versioned.

### Transaction roles and structures

14. A direct merger keeps the legal company, parent and merger-sub roles.
15. A forward triangular merger identifies the correct surviving entity.
16. A reverse triangular merger identifies the correct surviving entity.
17. A merger of equals can use `COMBINATION_PARTY` without a false buyer.
18. A source-stated merger of equals keeps the exact source language.
19. A reverse merger does not infer the buyer from the surviving entity or
    share issuer.
20. A Reverse Morris Trust keeps its stated distribution, reorganisation,
    contribution and merger legs separate.
21. A Reverse Morris Trust keeps the divesting parent, SpinCo, merger
    counterparty, merger subsidiary and surviving entity distinct.
22. A tender offer and second-step merger remain separate transaction legs.
23. A new-holdco combination does not treat the new holding company as the
    historical buyer without evidence.
24. An asset acquisition does not invent merger roles.
25. A de-SPAC does not infer economic control only from the surviving listed
    entity.
26. Every role, leg, structure and control outcome can open its exact evidence.

### Advisers and lawyers

27. Buyer and target counsel cannot swap.
28. A law-firm organisation and a natural-person lawyer remain distinct
    subjects.
29. A side-level adviser cannot fill an undisclosed bidder-track adviser.
30. A named multi-bidder example proves correct per-track attribution.
31. A missing losing-bidder adviser remains `UNDISCLOSED` or
    `NOT_EXAMINED`.
32. Every adviser assignment can open its exact source evidence.

### Query and release

33. Identity filters use canonical IDs, not display text.
34. Live and pinned participant filters return the same logical rows.
35. An unavailable field cannot be selected through Ask, Browse, a manual
    filter or a saved query.
36. Current display arrays derive from certified relationships.
37. Every result is bound to one contract, namespace and release.
38. A changed fact, bridge or assignment produces a new candidate release.

### Cross-domain

39. Agreement and Process read the same selected fact resolution revision.
40. A future CVR domain can use the same entity and fact projection.
41. No domain contains a second canonical entity or deal-fact store.
42. A domain proposal cannot bypass the canonical writer.
43. Every shared field has one field-registry definition.

### Transaction-structure test set

After the formal gate opens, the mandatory structure set includes:

- direct merger;
- forward triangular merger;
- reverse triangular merger;
- merger of equals;
- reverse merger;
- Reverse Morris Trust;
- tender offer with a second-step merger;
- new-holdco stock combination;
- stock-for-stock combination;
- spin-merge;
- asset acquisition;
- de-SPAC;
- sponsor consortium; and
- joint-venture combination.

Each structure needs:

- one positive role and leg fixture;
- one negative fixture that challenges a false target, buyer or control
  inference;
- exact source evidence;
- live and pinned projection equality; and
- filter tests for every admitted structure field.

The suite must include reviewed public-deal gold. Synthetic contract fixtures
can test extra shapes. They cannot replace the reviewed public-deal gold.

### Metsera gated anchor

After the formal gate opens, Metsera is the first anchor fixture for this
authority.

The fixture must test:

- Pfizer, Novo and each source-local bidder track remain distinct;
- an adviser or lawyer does not move between bidder tracks;
- cash, dividend and CVR economics remain separate;
- each stated transaction value keeps its stated basis;
- any normalised equity value has a complete derivation;
- each named entity has its own bridge evidence;
- each displayed adviser assignment has its own source evidence; and
- live and pinned participant filters agree.

This document does not state the answers for those tests. The independent
Metsera gold review must establish them from admitted source documents after
the gate opens.

## Work boundaries

This workstream owns:

- shared entity identity;
- source-backed name occurrences;
- identity bridges;
- shared deal facts;
- shared economics derivations;
- participant relationships;
- transaction legs, structures and control outcomes;
- professional assignments;
- candidate proposals;
- read-only projections;
- shared field definitions; and
- release and trace treatment for these objects.

It does not own:

- Agreement legal semantics;
- Process event semantics;
- CVR milestone semantics;
- a new user-interface design;
- natural-language interpretation;
- source-document acquisition;
- general search ranking; or
- source-reader rendering.

Those systems consume this authority through governed interfaces.

## Sequence after approval and gate recovery

After Ben approves this design, create a separate implementation plan with:

- exact file and contract changes;
- work-package estimates;
- required PM owner decisions;
- contract-freeze order;
- independent review points;
- fixtures and negative tests;
- migration inventory;
- release proof;
- Process integration order; and
- a stop condition before WP3A freeze.

No implementation starts until both conditions are true:

1. Ben approves the detailed plan.
2. The formal programme-status artefact permits canonical work.
