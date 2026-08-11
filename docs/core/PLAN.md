# Precedent Machine programme plan

As at 2026-08-11.

This is the only executable programme plan. It contains open work only.
`COMPLETED.md` contains closed work and evidence. `DECISIONS.md` contains
binding legal, technical and programme rulings. Dated notes and the old Stage
2Y orders are evidence, not instructions.

## 1. Outcome

The product is complete when a private user can supply an agreement and the
system can:

1. preserve the exact source;
2. represent the agreement as the hierarchy written by the drafter;
3. extract complete legal propositions with exact provenance;
4. validate and compare those propositions;
5. write approved data durably and safely;
6. serve that data through the application;
7. show useful compact and expanded rows;
8. support comparison, market statistics and search;
9. operate behind the required security controls; and
10. prove backup, cutover and rollback.

Stage M10 does not meet this complete outcome. M10 ends with the state
`PRIVATE_INTERNAL_EXTRACTOR_ACTIVE`. That state means the certified extractor
is selected for named private internal consumers. Product writes remain zero.
Publication authority remains `NONE`. External serving remains disabled.

The remaining database, serving, product, security and production stages follow
M10.

## 2. Terms

**Exact source** means the canonical UTF-8 text and its immutable source
binding. A byte position is a half-open range such as `[100, 120)`.

**Authored block** means a block written by the drafter. Examples are an
article, section, sentence, chapeau, list limb or heading.

**Source node** means the stable record for one authored block.

**Containment tree** means the parent-child hierarchy of source nodes. A
section contains its sentences or limbs. It does not contain extracted legal
facts as children.

**Span annotation** means an exact marked range that is not a containment-tree
child. Examples are an outline marker, a section-reference occurrence and a
defined-term occurrence.

**Byte ledger** means a separate partition that accounts for every source byte
exactly once. It records whitespace and page artefacts without pretending they
are authored legal blocks.

**Context** means legal words that govern a lower block. Examples are the
subject, modal verb, operative verb, time period, condition, exception and
proviso in a chapeau.

**Provenance** means the exact source node and byte span from which a value
came. An inherited value cites its parent source. It never claims that the
words occur in the child.

**Semantic claim** means a structured legal proposition derived from one or
more source nodes.

**Complete proposition** means a claim that contains every role required by
its claim definition. A role is one part of the meaning, such as actor,
restriction, object, trigger, threshold, timing or qualification.

**Fail closed** means the system withholds a claim or row when a required fact
is absent or uncertain. It records the reason instead of guessing.

**Party topology** means a graph of agreement-wide entity relationships. It
can record `PARENT_OF`, `WHOLLY_OWNED_SUBSIDIARY_OF`, `CONTROLS`,
`MERGES_INTO`, `SURVIVES_AS` and `CAUSES_TO_PERFORM`. A cause-to-perform
covenant does not itself prove ownership or control.

**Projection** means a compact or expanded row made from semantic claims. A
projection is a view. It does not define source structure or legal meaning.

**Family** means one governed provision class, such as Termination,
Representations or Employee Matters.

**Calibration pack** means a legal-review packet for one family. It contains
three to ten deliberately different full provisions, source hierarchy,
complete claims, inherited context, compact and expanded rows, proposed
omissions and one narrow legal question.

**Shadow** means additive output that no current extractor, database writer,
product reader or publication path uses.

**Selector** means the versioned setting that chooses an extractor. No M0 to
M9 stage changes the current selector.

## 3. Current state and authority

The architecture review, M0 and M1 are complete. Their evidence and commits
are in `COMPLETED.md`.

M2 is the current authorised stage. It is additive and shadow-only. M3 and
later stages need a new work order after the preceding receipt passes.

The following controls apply through M9:

- model calls: zero;
- Phase B route calls: zero;
- product-data writes: zero;
- selector changes: zero;
- pin changes: zero;
- baseline changes: zero;
- serving changes: zero;
- publication authority: `NONE`;
- external serving: disabled; and
- sealed M0 and M1 artefacts: unchanged.

Phase B is deferred and locked. M8 may prepare a deterministic input and
evaluation packet. It may not call a model. A later Phase B run requires a new
explicit instruction from Ben.

Do not repeat a passing check against the same commit and input digests. Run
the focused checks named by the active stage. The full product suite runs once
at M9 unless a focused failure shows that broader diagnosis is necessary.

## 4. Measured baseline

The frozen baseline covers 130 saved runs across 25 families and seven
agreements. The control is
`evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json`.

| Measure | Count | Meaning |
|---|---:|---|
| attempted | 2,201 | Claims for which resolution was attempted. |
| resolved | 1,526 | Claims with a resolved current semantic state. |
| open-world | 1,701 | Source observations that do not fit an approved claim definition. |
| review | 675 | Claims or observations that require review. |
| mechanical row matches | 1,241 | Resolved claims that match a current rendered row by the mechanical comparator. |
| cautious known-loss-adjusted rows | 1,097 | Mechanical matches after subtracting known material-loss cases. |
| grouped feature claims that fail closed | 109 | Claims whose current grouped row cannot be linked uniquely. |
| routed claim with no row | 1 | A claim with a route but no produced row. |
| claims with no approved output owner | 175 | Resolved claims whose family has no approved row owner. |

The four extraction states are separate measures. Do not add them. A review
record can refer to a resolved claim. Open-world is not the remainder of
attempted.

`1,097 / 1,526 = 71.9%`. This is not human acceptance. It is a cautious
mechanical content-preservation measure.

Reproduce the fixed counts with:

```bash
jq '.fixed_measurements' \
  evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json

jq '.summary' \
  evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json
```

The known-loss file identifies 244 affected claims. Of those, 144 mechanically
rendered claims are deducted from 1,241. Another 100 were already not rendered.
The same file records `human_acceptance_status: NOT_MEASURED`.

## 5. Target architecture

The system has three main public entry points:

```text
indexAgreement(exactSource, structuralPolicy) -> AgreementIndex
analyseAgreement(AgreementIndex, analysisTask) -> AgreementAnalysis
projectAgreement(AgreementAnalysis, viewPolicy) -> AgreementProjection
```

`AgreementIndex` contains exact source, the authored-block tree, span
annotations, source artefacts, aliases, diagnostics and byte coverage.

`AgreementAnalysis` contains context, reference and definition edges, party
topology, evidence and complete semantic claims. Its internal context compiler
is not a fourth public entry point.

`AgreementProjection` contains compact and expanded rows, row lineage,
grouping decisions, omissions and output-owner decisions.

The data flow is:

```text
exact source
  -> M2 AgreementIndex
  -> M3 context and relationship graphs
  -> M4 complete AgreementAnalysis
  -> M5 family adapters
  -> M6 AgreementProjection
  -> M7 corpus and legal verification
  -> M9 certificate
  -> M10 private internal extractor selector
  -> Stage 4 durable write
  -> Stage 5 serving and rows
  -> Stages 6-9 corpus, security, product and production cutover
```

The containment tree supports collapse and expansion directly. Cross-references
and party relationships are graph edges because they can connect distant
nodes. The target is therefore a tree plus graphs, not a graph instead of a
tree.

Analysis begins at the highest node that contains the complete operative
proposition. It then descends to the relevant children. It does not begin with
a detached evidence line.

## 6. Stage order

| Stage | State | Result |
|---|---|---|
| M0 | Complete | Frozen authority, cohort, baseline and diff contract. |
| M1 | Complete | `INCREMENTAL_RESTRUCTURE` decision with identity and provenance proof. |
| M2 | Authorised and active | Complete shadow `AgreementIndex` for seven agreements. |
| M3 | Not authorised | Provenanced context, references, definitions and party topology. |
| M4 | Not authorised | Complete semantic propositions and resolution-set diff. |
| M5 | Not authorised | All 25 family adapters consume the common analysis. |
| M6 | Not authorised | Complete output ownership, grouping and row lineage. |
| M7 | Not authorised | Corpus comparison and governed legal review. |
| M8 | Locked readiness only | Phase B packet, no call. Optional for M9. |
| M9 | Not authorised | Certified shadow candidate and rollback proof. |
| M10 | Separate authority required | `PRIVATE_INTERNAL_EXTRACTOR_ACTIVE`. |
| Stages 3-9 | Retained after M10 | Durable product, serving, security, features and go-live. |

M0-M9 restructure and certify extraction. M10 activates that extractor for
named private internal consumers only. M0-M10 roughly replace the extraction
part of old Stage 2 and Stage 2Y plus an internal cutover. They do not complete
the old extract, validate, write, serve and render ladder. They do not complete
Stages 3-9.

## 7. M2: build the shadow AgreementIndex

**Owner:** one Terra implementer. A second Terra owns fixtures. Sol performs
the final technical review.

**Dependency:** sealed M1 decision `INCREMENTAL_RESTRUCTURE`.

**Effect:** additive shadow files only.

### Interface

Implement:

```text
indexAgreement(exactSource, structuralPolicy) -> AgreementIndex
```

The module is `lib/canonical-v2/agreement-index.js`. It performs no file,
database, network, model, selector or product operation.

### Required representation

The containment tree contains only authored blocks:

- agreement;
- article;
- section;
- limb and sub-limb;
- heading;
- chapeau;
- paragraph;
- sentence; and
- authored qualification clause.

Do not place marker tokens, cross-reference occurrences, definition-use
occurrences, page numbers, byte-owner records or extracted legal facts in that
tree.

Keep four separate collections:

1. `nodes` for authored containment;
2. `annotations` for markers and reference occurrences;
3. `source_artefacts` for page and conversion material; and
4. `byte_coverage` for an exact, non-overlapping partition.

Every index preserves the canonical text and binds the immutable source
document, source digest, source length, structural-policy version and policy
digest.

Occurrence identity binds canonical-text identity, node kind and start byte.
Revision identity also binds end byte, parent, child order, roles and policy.
Generate aliases from every current sectionizer node. Report any collision.

### Work

1. Freeze `control/m2-authority.json` without changing M0 or M1.
2. Freeze `control/structural-policy.json` with schema
   `STAGE_2Y_STRUCTURAL_POLICY/V1`.
3. Reuse the deterministic sectionizer for articles, sections and marker
   candidates. Do not create a second durable section authority.
4. Add deterministic authored heading, chapeau, sentence, paragraph and
   qualification segmentation.
5. Keep ambiguity typed. Apply the confirmed Red Hat 3.01 ruling.
6. Create `scripts/stage-2y-agreement-index-shadow.mjs`. It accepts only
   `--control`, `--agreement-manifest`, `--policy` and `--output-root`.
7. Create `tests/canonical-v2-agreement-index.test.js`.
8. Build one sealed index per agreement under `shadow/m2/`.
9. Seal a receipt that binds all seven outputs, current baseline digests and
   zero-authority counters.
10. Obtain an independent Sol review.

### Focused commands

```bash
node scripts/stage-2y-agreement-index-shadow.mjs \
  --control evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json \
  --agreement-manifest evidence/canonical-v2/stage-2y-structure-migration/control/cohort-agreements.json \
  --policy evidence/canonical-v2/stage-2y-structure-migration/control/structural-policy.json \
  --output-root evidence/canonical-v2/stage-2y-structure-migration/shadow/m2

node --test tests/canonical-v2-agreement-index.test.js
```

Run each command once on the final bytes.

### Acceptance

- Seven expected indexes exist and bind the expected source digests.
- Each index retains exact canonical text.
- Byte coverage is 100% with zero gaps and zero overlaps.
- Every tree node is an authored block.
- Parent-child links are reciprocal, ordered and acyclic.
- Marker and heading records are distinct.
- Unnumbered sentence fixtures pass.
- Metsera 7.04 has two authored sentence children.
- Red Hat 3.02(b)(i) has three authored sentence children.
- Red Hat 3.01 has the confirmed `(h)(i)` and top-level `(i)` structure.
- Alias collisions are zero.
- Repeated runs are byte-identical.
- Current claim, row, pin, baseline and selector digests are unchanged.

Stop on a byte gap, nondeterminism, alias collision, unresolved many-to-many
identity or source boundary that changes legal scope. Sol decides technical
identity and boundary policy. Ben decides only a remaining legal scope choice.

Rollback means reverting only the M2 commit or leaving the module and sealed
outputs unused. The current extractor has no M2 selector.

## 8. M3: compile context and relationship graphs

**Owner:** one Terra implementer, one fixture auditor, Sol for shared rules.

**Dependency:** M2 receipt and Sol review pass.

**Effect:** shadow-only.

The internal interface is:

```text
compileContext(focusNodeIds, AgreementIndex, semanticPolicy)
  -> ContextCompilation
```

The interface remains private behind `analyseAgreement`.

### Work

1. Freeze `control/semantic-policy.json` and bind its digest.
2. Define direct, inherited, overridden, ambiguous and unresolved context
   states.
3. Extract subject, capacity, modal, verb, object, negation, connective, time,
   condition and scope from authored nodes.
4. Pass governing context from ancestors to descendants with exact provenance.
5. Isolate siblings. A sibling can govern another sibling only through an
   explicit source-proved scope edge.
6. Record proviso, exception and trailing-qualification scope edges.
7. Resolve every section-reference annotation to a target or typed unresolved
   target.
8. Resolve every definition-use annotation to a definition or typed unresolved
   target.
9. Build the party topology graph. Keep relationship type, entities, temporal
   scope, source nodes and exact spans.
10. Keep `CAUSES_TO_PERFORM` separate. Do not infer `CONTROLS` from it alone.
11. Seal one context compilation per M2 index and a complete diagnostics
    ledger.

### Required fixtures

- Concho 6.9(a): chapeau subject, verb, time and object reach each limb.
- TopBuild 6.2 and 6.3: termination grant and party pass to each limb.
- Red Hat 5.07: the substantially-similar proviso governs the complete second
  sentence.
- TopBuild 6.3(b): the cross-default proviso governs the full termination
  right.
- Concho 6.11: the proviso is an additional Company covenant attached to
  sentence two.
- Metsera 7.04: each sentence keeps its own actor and full condition-set
  references.
- Parent and Merger Sub: shorthand is unavailable unless separate topology
  proves the subsidiary relation.

### Acceptance

- Every inherited value names the exact source node and span.
- No inherited value claims false local evidence.
- Child override retains both provenances.
- No unlicensed sibling propagation occurs.
- Every reference and definition occurrence has an edge or typed unresolved
  result.
- Every party relationship has source provenance and temporal scope.
- Ambiguity blocks dependent facts only.
- Current claims and rows remain unchanged.

Stop when two legal scopes remain plausible, a rule changes more than one
family without Sol review, or topology would require an unsupported inference.

## 9. M4: create complete AgreementAnalysis

**Owner:** integrator and one Terra semantic implementer.

**Dependency:** M3 passes.

**Effect:** in-memory shadow repository and sealed JSON only.

Implement:

```text
analyseAgreement(index, analysisTask) -> AgreementAnalysis
```

### Work

1. Freeze `control/analysis-policy.json`. Bind M2, M3, the diff contract,
   contract bundle and current resolver configuration.
2. Create a versioned required-role schema for every claim definition.
3. Define `MISSING_REQUIRED_ROLE` as a fail-closed resolution result.
4. Allow a claim to cite one or more source nodes and ordered, discontiguous
   evidence spans. Do not replace these spans with one min-to-max envelope.
5. Link every semantic role to direct or inherited provenance.
6. Link claims to definition, reference, qualification and party-topology
   relationships.
7. Preserve current claim revision identities when meaning is unchanged.
   Otherwise create an explicit alias and equivalence record.
8. Create an in-memory shadow repository that round-trips every field.
9. Seal one `AGREEMENT_ANALYSIS/V1` per agreement.
10. Seal a field-level resolution-set diff before any later selector or pin
    decision.

### Metsera 7.04 golden

Produce two complete branch propositions. Each branch requires:

- actor;
- operative restriction;
- object of reliance;
- complete referenced condition set;
- causal threshold;
- breaching actor; and
- breached obligation.

Delete each role in turn. Every deletion must return
`MISSING_REQUIRED_ROLE` and no renderable claim. Fragment recognition does not
pass.

### Acceptance

- All 1,526 resolved current claims are accounted for by identity or approved
  alias.
- Every current evidence slice still selects the same bytes.
- Unexpected state, value, party, scope, attribute, evidence and relationship
  changes are zero.
- Official open-world does not increase in any family.
- Every resolved shadow claim satisfies its required-role schema.
- Current storage and readers remain unchanged.

Stop on any unapproved semantic difference. Sol decides technical identity.
Ben decides legal value, scope or role requirements.

## 10. M5: migrate all families in waves

**Owner:** one integrator. Terra agents receive disjoint family files.

**Dependency:** M4 passes.

**Effect:** shadow adapters only. Saved responses only.

For each family:

1. inventory each current source-reconstruction rule;
2. map it to an M2 node, M3 context fact or M4 role;
3. create and calibrate the family required-role schema;
4. run current and shadow adapters side by side;
5. compare every field in `control/diff-contract.json`;
6. record intended improvements with exact source and legal authority;
7. require zero unexpected resolved changes and zero open-world increase;
8. retire duplicate reparsing only in the shadow adapter after parity; and
9. prove isolated rollback.

Use these waves:

| Wave | Families |
|---|---|
| 1 | `EMPLOYEE_MATTERS`, `TERMINATION`, `GENERAL_COVENANTS` |
| 2 | `CLOSING_CONDITIONS`, `MAE_DEFINITION`, `KEY_DEFINED_TERMS`, `REPRESENTATIONS` |
| 3 | `INTERIM_OPERATING`, `NO_SHOP`, `DNO_INDEMNIFICATION`, `NO_OTHER_REPS_FRAUD`, `ANTITRUST_REGULATORY` |
| 4 | `APPRAISAL_DISSENTERS_RIGHTS`, `CAPITALISATION`, `CONSIDERATION`, `DIVIDENDS`, `FINANCING_COVENANTS`, `GUARANTY_FINANCING_PARTY`, `MATERIAL_CONTRACTS`, `MERGER_STRUCTURE_CLOSING`, `MISC_BOILERPLATE`, `PROXY_MEETING`, `SPECIFIC_PERFORMANCE_REMEDIES`, `TAX_MATTERS`, `TERMINATION_FEE` |

Wave 4 does not unpark the product treatment of capitalisation. It only makes
the registered extraction family structurally safe.

Every family packet contains current output, shadow output, adapter identity,
claim diff, row diff, reparse-retirement ledger, open-world counts, selector
state and rollback receipt.

Stop the affected family on a local defect. Stop all waves only when the shared
M2-M4 contract failed. Sol handles shared contracts and identity. Ben handles
legal meaning and family calibration.

## 11. M6: own and project every approved claim

**Owner:** integrator for the output contract. Terra prepares ledgers and
focused tests.

**Dependency:** all relevant M5 families pass.

**Effect:** shadow-only.

Implement:

```text
projectAgreement(analysis, viewPolicy) -> AgreementProjection
```

### Work

1. Freeze Ben's output decisions and each family's approved display policy.
2. Give every approved claim definition one output owner or an approved
   no-output disposition.
3. Reproduce the current 109 non-unique matches, one routed no-row result and
   175 no-owner results at member level before applying approved changes.
4. Give TopBuild 6.3 a Termination row.
5. Make each row field name its source claims, source nodes and evidence.
6. Keep an omission ledger. A known material fact must be displayed or have an
   approved omission.
7. Use useful legal words for cross-references. A bare `See provision` row
   fails.
8. Keep exact citations as links. Expansion shows target heading and relevant
   text.
9. Keep separate branch claims. Group only in projection.
10. Permit one Metsera 7.04 collapsed rule only after both branch propositions
    are complete and a family-specific equivalence signature proves the same
    legal standard, threshold, timing and qualifications.
11. Add a changed-standard negative fixture that requires separate rows.
12. Use `Parent` shorthand for a Parent and Merger Sub side only under the
    topology and no-hidden-effect rule in Decision 18.

### Acceptance

- No approved claim definition lacks an owner or approved no-output result.
- No silent no-row result exists.
- All 1,526 current resolved claim identities appear in the member ledger.
- Every grouped row retains every member identity.
- Every material fact is displayed or deliberately omitted.
- Compact rows use plain legal English.
- Current claims and rows remain unchanged.
- Publication remains inactive.

Ben decides grouping, material detail and compact omission rules. Sol decides
lineage mechanics.

## 12. M7: corpus verification and legal calibration

**Owner:** integrator for machine evidence. Ben or a delegated qualified lawyer
owns legal rulings.

**Dependency:** M6 passes for all families.

**Effect:** report-only.

### Machine work

1. Run the seven-agreement, 130-run cohort through current and shadow paths.
2. Produce source coverage, context provenance, claim closure, field-level
   resolution diffs, open-world by family, output ownership, row preservation
   and omission measurements.
3. Recheck all 69 former unresolved limb cases against authored nodes and
   complete claims.
4. Recheck all 244 known-loss claims individually.
5. Verify that each old ten-to-fifteen agreement generalisation obligation is
   either met by expanding the frozen cohort under a new control or remains an
   explicit M9 blocker. Seven must not silently count as ten.

### Legal calibration

Create one versioned calibration pack per family. Each pack contains three to
ten deliberately different full provisions and shows:

- complete source and hierarchy;
- separate legal propositions;
- inherited context and provenance;
- compact row;
- expanded row;
- proposed omissions; and
- one narrow legal question.

Store each approved answer as a versioned family legal ruling. Replay the
ruling across the cohort. Return only new patterns, conflicts, genuine
ambiguity, legal-result changes and unapproved omissions.

Before private internal activation:

- every family has an approved calibration policy or approved no-output
  policy;
- every changed or genuinely ambiguous result is reviewed;
- every known material information loss is fixed;
- every row affected by a discovered rule defect is checked; and
- a modest risk-weighted blind sample is completed.

The exact blind-sample size is an open Ben ruling. Freeze the sample policy,
corpus digest, strata, random seed and threshold before answers are opened.
Do not insert 50, 300 or another number without Ben's decision.

After internal launch, accumulate the broader uniform sample through ordinary
review. Report the overall one per cent target with sample size and confidence.
It is a metric and alarm. It is not a per-family or 300-row shipment gate.

### Acceptance

- Unexpected semantic differences are zero.
- Open-world does not increase in any family.
- Every known-loss and limb record has a member-level disposition.
- Every family has an approved calibration or no-output policy.
- Human acceptance is labelled as human acceptance.
- No error class is hidden by an overall average.

A failed legal class returns only that class to M5 or M6. Do not change sample
membership after review begins.

## 13. M8: prepare Phase B input, keep the route locked

**Owner:** Sol. Terra may prepare deterministic packets.

**Dependency:** M7 passes.

**Effect:** no model call and no runtime route.

Build a `PhaseBInputPacket` from the exact M2-M4 representations. It contains
source nodes, inherited context, reference and definition edges, required-role
schemas and deterministic evidence anchors. It must not accept detached raw
section text as a substitute.

Use recorded responses to test packet and comparator interfaces. Preserve
historical Phase B candidates and decisions. Produce a bounded experiment plan
with call cap, cost cap and stop conditions. Sol decides the technical
comparator. Ben alone can authorise a later live experiment.

M8 passes when the packet is complete and every existing Phase B lock still
refuses calls. M8 is optional for M9 unless Ben separately authorises a Phase B
experiment.

## 14. M9: certify the shadow extractor

**Owner:** Sol integrator, Terra evidence agents, Ben for legal sign-off.

**Dependency:** M7 passes. M8 is optional while Phase B stays locked.

**Effect:** certification only.

### Work

1. Freeze a release candidate with exact commit and all policy, adapter,
   projection and receipt digests.
2. Create an isolated candidate harness. It can choose current and shadow
   implementations in memory only.
3. Run focused seam checks once on the exact candidate.
4. Run the complete product test suite once.
5. If shadow persistence changed, run the database-backed writer gate once
   against an approved throwaway database. If no approved database exists,
   record `NOT_RUN` and stop certification.
6. Rehearse current, shadow, current in the isolated harness.
7. Seal rollback proof and the Stage 2Y certificate.
8. Record whether M8 was unused, prepared only or separately authorised.
9. Confirm selector authority, product writes, publication and external
   serving remain `NONE`.

### Acceptance

- Every M0-M7 gate passes on the exact candidate.
- Unexpected differences are empty.
- Every expected difference has technical and, where required, legal approval.
- Full rollback restores the old claim and row digests.
- The certificate states that M10 is ready for a separate authority decision.
- The certificate does not claim product readiness.

## 15. M10: activate the certified private internal extractor

**Owner:** programme integrator. Sol verifies. Ben signs the exact authority
packet.

**Dependency:** unchanged M9 certificate.

**Result:** `PRIVATE_INTERNAL_EXTRACTOR_ACTIVE`.

Before any change, freeze a smoke plan, cutover test, current and target
selector, named private internal consumers, exact versions, optional new
immutable pin manifest, rollback command and expected digests. Ben signs that
exact packet.

M10 may:

- select the M9-certified extractor for the named private internal consumers;
- install and select one new immutable pin manifest only if the signed
  authority names its bytes, path and digest; and
- run saved-response smoke cases and rollback proof.

M10 may not:

- call a model;
- write product data;
- enable publication;
- enable external serving;
- overwrite a baseline or existing pin manifest; or
- claim that the product is live or production-ready.

Acceptance requires exact M9 parity, zero family open-world increase, zero
product writes, publication `NONE`, external serving disabled and proven
restoration of the prior selector.

The planned certificate is
`STAGE_2Y_PRIVATE_INTERNAL_EXTRACTOR_ACTIVE_CERTIFICATE/V1`. Do not use
`MISSION_READY_CERTIFICATE`.

## 16. Product work after M10

M10 changes an extractor selector. It does not complete the product path.
These stages remain.

### Stage 3: finish unresolved semantic and taxonomy work

1. Apply the payment-trigger and structured-delay rulings within the complete
   Termination Fee proposition. Do not activate the old unreachable path
   separately.
2. Cluster remaining open-world items by proposed legal and comparison type.
3. Use family calibration rulings. Do not ask Ben to classify raw technical
   records one by one.
4. Keep capitalisation parked until Stage 9F.

Stage 3 passes when every remaining proposed concept has an approved claim
definition, an approved no-output disposition or a typed unresolved legal
question.

### Stage 4: durable validation and import

1. Harden the import driver for batching and partial failure.
2. Prove idempotency and restart against a real approved non-production
   database.
3. Refuse quarantined, unresolved and incomplete propositions. A resolved claim
   may still have a review task, so review-queue presence alone is not a
   refusal rule.
4. Make every row traceable to import receipt, complete claim, source nodes and
   evidence spans.
5. Prove backup and restore on a throwaway database.
6. Close the conditional-termination-fee deal-scope defect before a second deal
   writes.

Stage 4 passes when approved candidate bytes can be written, repeated,
recovered and traced without touching production.

### Stage 5: database reader, serving and rendered rows

1. Read complete claims and relationships. Never reconstruct lost context from
   raw text in the reader.
2. Render a second deal without a hand-written serving file.
3. Prove the value through an HTTP response and the real rendered page.
4. Repeat the recipe for a second family.
5. Roll every serving family using M6's owner and no-output registry.
6. Keep compact and expanded source lineage accessible.

Stage 5 passes when every approved serving family has a database-to-HTTP-to-row
proof and no family relies on hand-written deal data.

### Stage 6: identity, source integrity and corpus certification

1. Decide whether legacy V1 quotation spans need backfill before V1 retirement.
   M2-M4 already satisfy the V2 span requirement.
2. Use M4/M5 aliases for future claim identity. Identify the possible 128
   legacy database rows. Deletion needs Ben's approval.
3. Make amendment and restatement warnings reach a human and close bypasses.
4. Run all 25 families across the full 40-deal product corpus after Stage 4.
5. Require ingest QA, exact quote verification and the golden evaluation
   harness.

Stage 6 passes when the complete product corpus, not only the seven-agreement
migration cohort, is certified.

### Stage 7: security and operations

1. Ben confirms whether the live site requires login and whether the exposed
   service key was rotated.
2. Set the authentication environment variables and prove refusal from outside.
3. Re-enable the four contained routes only after their repaired paths pass
   hostile tests.
4. Preserve the completed disposition of the seven deferred security gates.
5. Prepare incident, monitoring and credential-rotation procedures.

Stage 7 gates external product activation. M10 does not satisfy it.

### Stage 8: product features

1. Enable market statistics in preview with corpus and selected-deal scopes.
2. Restore search in preview only after load and query guards pass.
3. Build the comparison view with selected terms, no three-deal limit,
   horizontal scrolling and source-completeness indicators.
4. Prove each feature reads certified V2 data.

Stage 8 passes in preview. It does not grant production authority.

### Stage 9: production cutover and rollback

1. Obtain authority and rehearse import against hosted staging.
2. Perform and record the production backup and restore drill.
3. Import V2 data into a production namespace that the live site does not read.
4. Verify counts, identities, source lineage and security before serving.
5. Enable V2 serving by approved family.
6. Run outside-in smoke tests.
7. Roll back in production once, verify restoration, and move forward again.
8. Return to capitalisation only after the main product cutover.

Stage 9 passes only when the real product writes, serves, renders and rolls back
under explicit production authority.

## 17. Crosswalk from the old plan

The status words in this table have fixed meanings:

- `COMPLETE`: closed evidence belongs in `COMPLETED.md`.
- `SUPERSEDED_BY_Mx`: the old execution path is retired by the named M stage.
- `MODIFIED`: part remains, with the revised dependency stated here.
- `RETAINED`: the old obligation remains after M10.

### Old Stage 2 and 2X

| Old step | Status | Exact treatment |
|---|---|---|
| 2A section lists | COMPLETE | Modiv 25-family pins and `tests/canonical-v2-modiv-family-pins.test.js` remain fixtures. |
| 2B bridge | MODIFIED | In-memory write proof is complete. Durable write and read remain in Stages 4 and 5 after M10. |
| 2C one family end to end | RETAINED | Run the database-to-row proof after M10, Stage 4 and Stage 5. |
| 2C1 conditional fee deal scope | RETAINED | Close before a second durable deal write in Stage 4. |
| 2D Modiv fan-out | MODIFIED | M5 and M7 own extraction comparison. Stage 5 owns real serving. |
| 2D1 five Modiv defects | MODIFIED | Model timeout waits for new model authority. Database identity goes to Stage 4. Reader defects go to Stage 5. Projection defects go to M6 and Stage 5. |
| 2D2 capitalisation | RETAINED | Remains parked at Stage 9F. |
| 2E TopBuild mapping | MODIFIED | Use the map as a fixture. M2 indexes the document and M5 proves routing before any manual pin is retired. |
| 2F TopBuild fan-out | MODIFIED | M5/M7 own semantics. Stage 5 owns serving. |
| 2G ten to fifteen agreements | MODIFIED | M7 starts with seven frozen agreements. Expansion to at least ten remains an M9 blocker unless a later evidenced decision revises it. |
| 2F1 output ceiling | RETAINED | Live-route guard proof waits for new model authority. |
| 2F2 empty response shapes | RETAINED | Prompt change waits for M8 readiness and new model authority. |
| 2F3 wrong guaranty pin | SUPERSEDED_BY_M2_M5 | Use it as a Wave 4 golden. Do not perform an isolated re-pin. |
| 2F4 replay invalidation | MODIFIED | M0/M5 bind migration inputs. The later live runner still needs its own invalidation guard. |
| 2G1 publish rate | SUPERSEDED_BY_M4_M5_M7 | Complete propositions, family calibration and row review replace the old scalar framing. |
| 2H generalisation table | SUPERSEDED_BY_M7_M9 | M7 supplies member diffs. M9 certifies the exact candidate. |
| 2X diagnosis | COMPLETE | The structural-depth finding is input evidence for M2-M5. |
| 2X-0 merge record | COMPLETE | Closed merge evidence remains in history. |
| 2X-A old structure service | COMPLETE | Reusable implementation evidence. M2/M3 replace its interface and placement seam. |
| 2X-B corroboration fallback | COMPLETE | HOLD remains the result. Preserve the three would-resolves. |
| 2X-D MAE materiality | COMPLETE | Closed in `COMPLETED.md`. |
| 2X-E absence wording | COMPLETE | Closed in `COMPLETED.md`. |
| 2X-F transaction topology detector | COMPLETE | Detector evidence feeds M3. Party topology remains a separate graph. |
| 2X-G promotion substrate | COMPLETE | Later promotion still requires family calibration. |
| 2X-H token telemetry | COMPLETE | Closed. |
| 2X-I prompt batch | COMPLETE | Closed. It grants no new model call. |
| 2X-L representation limbs | COMPLETE | Mechanism landed. M5 must consume complete propositions. |
| 2X-L1 limb dispositions | COMPLETE | All 69 have dispositions. M7 verifies them against source. |
| 2X-K seven-deal ladder | COMPLETE | The 157-run campaign is M0/M7 evidence, not M9 certification. |
| 2Y-K residual census | COMPLETE | The 4,241-occurrence diagnosis is closed evidence. |

### Old Stage 2Y

| Old step | Status | Exact treatment |
|---|---|---|
| 2026-08-10 Phase 0/A/B/C/D/E order | MODIFIED | C/D/E measurement and the architecture review are complete. M0-M9 is the only active build sequence. Phase B stays locked. |
| 2026-08-09 Phase 0-4 order | SUPERSEDED_BY_M0_M9 | Its publication sequence conflicts with the shadow authority and is retired. |
| 2Y-0 cutoff sweep | SUPERSEDED_BY_M7 | Use family calibration, review all material changes and a modest risk-weighted blind sample with size still open. |
| 2Y-0A publication disposition | MODIFIED | Keep fail-closed state design. Publication activation is outside M0-M10. |
| 2Y-A governing chapeau | SUPERSEDED_BY_M2_M3_M4_M5 | Written nodes, context, complete claims and family adapters replace line reconstruction. |
| 2Y-B corroboration | SUPERSEDED_BY_M3_M5 | Preserve conflict cases as tests. Missing fragments do not defeat a complete source-backed claim. |
| 2Y-C registry and lint | MODIFIED | Finish consumption in M4/M5 after role schemas exist. |
| 2Y-D parties and definitions | SUPERSEDED_BY_M3_M5 | M3 builds edges and topology. M5 consumes them. |
| 2Y-E numerals | MODIFIED | Adopt the report-only logic through affected M5 adapters. |
| 2Y-F lexical net | MODIFIED | Preserve 57 covered, 55 gaps and 52 ambiguous. Apply only through complete M5 claims. |
| 2Y-G duplicate suppression | MODIFIED | Use the inactive path as an M5 comparator. Do not activate it separately. |
| 2Y-H representations reconciliation | MODIFIED | Topic is a routing role inside a complete representation proposition. |
| 2Y-I qualifier dispatch | MODIFIED | Consume through the same complete M5 proposition. |
| 2Y-J promotion candidates | MODIFIED | Keep recurrence evidence. No automatic registry mutation before M9. |
| 2Y-N row preview | SUPERSEDED_BY_M6 | M6 owns rows, lineage, grouping and omissions. Reuse the real renderer. |
| 2Y-L live prompt batch | COMPLETE | The 46-call batch is closed and inactive. |
| 2Y-M ladder and blind score | SUPERSEDED_BY_M7_M9 | M7 performs governed comparison and legal review. M9 runs the exact integration gate. |

### Old Stages 3-9

| Old step | Status | Exact treatment |
|---|---|---|
| 3J, 3J1, 3J2 payment timing | MODIFIED | Apply inside M5 Termination Fee complete propositions and M6 rows. |
| 3H open-world dispositions | MODIFIED | Cluster by proposed claim type. Resolve through M5-M7. |
| 4B import driver | RETAINED | Stage 4 after M10. |
| 4C idempotency and resume | RETAINED | Requires a real approved database. |
| 4D refusal tests | MODIFIED | Refuse quarantine, unresolved and incomplete propositions. Review-task presence alone is not refusal. |
| 4E traceability | RETAINED | Add complete claim and source-node lineage. |
| 4F backup and restore | RETAINED | M9 in-memory rollback does not satisfy database restore. |
| 5A database reader | MODIFIED | Read complete claims and graphs. Do not reconstruct context. |
| 5B second deal | RETAINED | Required database-to-row scaling proof. |
| 5C HTTP proof | RETAINED | M6 shadow rows do not prove serving. |
| 5D second family | MODIFIED | Choose from M6-approved owners. |
| 5E remaining families | MODIFIED | Use M6 owner/no-output registry. |
| 6B quote positions | MODIFIED | M2-M4 satisfy V2. Legacy backfill remains a separate decision. |
| 6C claim identity | MODIFIED | M4/M5 own new aliases. Possible legacy rows still need disposition. |
| 6D amendment warning | RETAINED | Independent of the extraction seam. |
| 6E full corpus | MODIFIED | M7 covers seven agreements. The later 40-deal product run remains. |
| 7A, 7B, 7C security | RETAINED | Gates external product work. |
| 7D deferred security gates | COMPLETE | All 32 identifiers are bound in `COMPLETED.md`. |
| 8A market statistics | RETAINED | Preview after certified serving data exists. |
| 8C search | RETAINED | Preview after load and query controls pass. |
| 8D comparison view | RETAINED | Product work after M10. |
| 9A staging rehearsal | RETAINED | Needs explicit hosted-staging authority. |
| 9B production restore | RETAINED | Needs explicit production authority. |
| 9C dark production import | RETAINED | Separate from M10. |
| 9D serving cutover | RETAINED | Separate from the internal extractor selector. |
| 9E real rollback | RETAINED | Required after production serving cutover. |
| 9F capitalisation | RETAINED | Still parked until after the main cutover. |

## 18. Agent work orders and escalation

Each stage starts with one integrator-owned work order. It names:

- exact authorised stage;
- base commit;
- allowed files;
- prohibited effects;
- fixed inputs and digests;
- outputs and schemas;
- exact commands;
- acceptance;
- stop conditions;
- rollback; and
- required reviewer.

Terra agents can implement bounded modules, fixtures and deterministic evidence.
Use disjoint file ownership. One agent integrates. Another agent performs a
read-only adversarial audit. Do not let multiple agents edit the same file.

Escalate to Sol when:

- two parser interpretations remain technically plausible;
- an identity alias is one-to-many or many-to-many;
- a shared rule affects more than one family;
- a current family cannot consume the common interface;
- evidence changes while a claim value appears unchanged;
- rollback needs schema or pin repair; or
- module replacement is proposed before shadow parity.

Escalate to Ben when:

- competing readings change legal meaning;
- a family required-role schema is not legally clear;
- a compact omission or grouping could hide a legal distinction;
- a no-output disposition needs approval;
- the blind-sample size and composition must be fixed;
- M10 authority is requested; or
- production, model, serving or publication authority is requested.

Send Ben the full source provision, competing readings, affected complete
claims, proposed compact and expanded rows, practical effect and one narrow
question. Do not ask Ben to decide parser class names, identifiers or graph
storage.

## 19. Programme stop conditions

Stop the affected stage when:

- a previously resolved claim changes value or state unexpectedly;
- open-world increases in any family;
- exact source bytes cannot be reconstructed;
- evidence cannot be mapped to exact source;
- a required role is missing from a resolved claim;
- a row drops a material fact without approval;
- a family has no output owner or approved no-output result;
- rollback does not reproduce the prior digest;
- a prohibited model, database, selector, serving or publication operation is
  attempted; or
- an old baseline, pin or sealed receipt would need mutation.

Do not fix a downstream row to hide an upstream source or semantic defect.
Return the work to the owning stage.

## 20. Open Ben rulings

Only these known programme questions remain open:

1. What exact size and composition should the modest risk-weighted blind sample
   use before M10?
2. For each family calibration pack, which roles must appear in the compact row
   and which may move to expansion?
3. Which proposed no-output dispositions, if any, are legally acceptable?
4. If M9 passes, does Ben approve the exact M10 selector and named private
   internal consumers?
5. Later, what authority applies to hosted staging and production database
   operations?

New source-specific legal ambiguities may arise. Record them with full
provisions and narrow questions. Do not turn them into broad design questions.
