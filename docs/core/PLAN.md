# Precedent Machine programme plan

As at 2026-08-11.

This is the only executable programme plan. It owns live execution and may
summarise closed prerequisites where an open stage depends on them.
`COMPLETED.md` contains the detailed closed-work evidence. `DECISIONS.md`
contains binding legal, technical and programme rulings. Dated notes and the
old Stage 2Y orders are evidence, not instructions.

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
article, annex, section, sentence, chapeau, list limb or heading.

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

The architecture review and M0 to M4 are complete. Their evidence and commits
are in `COMPLETED.md`.

Ben authorised M5, M6 and M7. Those stages ran locally. The recovered M5
correction labelled 1,111 shadow propositions complete, and M6 projected 1,111
normal rows. M7 admitted three additional agreements and created a fixed
50-item lawyer-review packet.

Ben completed that review on 14 August 2026. He marked 19 items correct and 31
incorrect. Six items marked correct also contain a substantive missing-law
note, and one contains a page-number artefact. The M7 gate is
`FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR`. Only 12 items are clean
regression controls. The correction's definition of complete is not accepted.

The repair must return to the M5-M6 semantic seam. The proposed repair plan is
`docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md`. The exact
questions, source text, failed cards and Ben answers are in
`docs/codex-program/notes/M7-LAWYER-REVIEW-QUESTIONS-AND-ANSWERS-2026-08-14.md`.
Fable's independent review is in
`docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-ADVERSARIAL-REVIEW-2026-08-14.md`.
It found 22 material gaps in the first plan. The plan now incorporates or
qualifies all 22. An amendment-integrity recheck completed. Fable then verified
all 22 plan dispositions and identified two final document-level conditions:
candidate registration must remain byte-identical from Work 5 through Work 7,
and generic output needs an output-complete subtype tree or exact Ben approval.
Both conditions are now operative plan gates. Ben adopted the amended M7 V2
repair plan and confirmed the exact bootstrap authority for Work 0 only. Work
0 passed under
`evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json`.
The receipt binds the failed review, the fixed 50-item sample, the 38 repair
items, the 12 controls, the sealed programme rulings and the sealed M3 and M4
trust roots. Work 0 preserves that evidence. It does not repair or accept M7.
Work 1 to Work 7 remain locked. Ben must give a separate authority that binds
the completed Work 0 evidence root before any Work 1 command or write.

The amended M7 V2 plan remains deterministic. Model calls remain zero. A
model-proposed shadow experiment is recorded only as a later decision path and
requires an explicit PLAN/Decision exception plus separate Ben experiment
authority before any call. Experiment output remains isolated and
non-consumable. A later adoption decision would require a blind sample and a
further programme amendment.

M8 is not authorised and remains locked. Do not start M8 while M7 has a failed
legal-review gate or while the M7 V2 repair is incomplete.

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
- sealed M0, M1 and M2 artefacts: unchanged.

From M3 onward, a final passing stage receipt is the machine trust root for the
next stage. A downstream runner must accept an explicit receipt for every
upstream output root that it reads and must re-hash the complete bound root.
It rejects an unbound, extra, missing or wrong-cohort file, a non-passing
receipt or a digest mismatch. Each final receipt binds its immediate
predecessor, so the chain is transitive. An earlier receipt is also a direct
input when the stage reads that earlier root.

| Output | Final passing receipt | Predecessor receipts |
|---|---|---|
| M3 context | `receipts/stage-2y-structure-m3-context-compilation.json` | M2 |
| M4 analysis | `receipts/stage-2y-structure-m4-agreement-analysis.json` | M2 and M3 |
| M5 family adapters | `receipts/stage-2y-structure-m5-family-adapters.json` | M4 |
| M6 projection | `receipts/stage-2y-structure-m6-agreement-projection.json` | M5, which binds M4 |
| M7 corpus | `receipts/stage-2y-structure-m7-corpus-verification.json` | Direct M2, M3, M5 and M6; transitive M4 through M5; M7 generalisation |
| M8 Phase B readiness | `receipts/stage-2y-structure-m8-phase-b-readiness.json` | Direct M2, M5 and M7 |
| M9 certification | `shadow/m9/stage-2y-certificate.json` | M7 and optional M8 |

The signed M9 `STAGE_2Y_CERTIFICATE/V1` contains the standard final-receipt
fields plus the certification measurements. It is the M10 trust root. Do not
create a second M9 receipt that could disagree with it.

Phase B is deferred and locked. M8 is also not authorised. Under a separate M8
work order, it may prepare a deterministic input and evaluation packet without
calling a model. A later Phase B run requires another explicit instruction from
Ben.

Do not repeat a passing check against the same commit and input digests. Run
the focused checks named by the active stage. These packet checks do not
replace the governing merge gates. At M9, run
`bash scripts/ci/run-all-invariants.sh` once and then `npm run build` once. The
invariants script already runs `npm test`; do not run it separately. If an
earlier M-stage branch is merged before M9, the governing merge gates apply at
that merge.

## 4. Measured baseline

The frozen baseline covers 130 saved runs across 25 families and seven
agreements. The control is
`evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json`.

| Measure | Count | Meaning |
|---|---:|---|
| attempted | 2,201 | Resolved claim revisions plus review-queue rows whose `has_resolution` is exactly false. |
| resolved | 1,526 | Claim revisions in `resolution.resolved`. |
| open-world | 1,701 | Entries in the separate `resolution.open_world` arrays. No deduplication is applied. |
| review | 675 | `review_queue` rows whose `has_resolution` is exactly false. |
| mechanical row matches | 1,241 | Resolved claims that match a current rendered row by the mechanical comparator. |
| cautious known-loss-adjusted rows | 1,097 | Mechanical matches after subtracting known material-loss cases. |
| feature-row lineage not unique | 109 | Claims for which the expected feature matched zero or more than one row. The aggregate does not prove grouping as the cause. |
| routed claim with no row | 1 | A claim with a route but no produced row. |
| claims with no approved output owner | 175 | Resolved claims whose family has no approved row owner. |

Do not add the four extraction measures. Attempted is the aggregate resolved
plus review: `1,526 + 675 = 2,201`. The counted review set excludes review-queue
rows that already have a resolution. Open-world is a separate array that can
coexist with an attempted claim. It is not the remainder of attempted.

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

The consolidated `AgreementAnalysis` contains context, reference and definition
edges, party topology, evidence and complete semantic claims. The M4 base form
may retain `SCHEMA_APPROVAL_PENDING` claims until M5 applies the approved family
schemas. Its internal context compiler is not a fourth public entry point.

`AgreementProjection` contains compact and expanded rows, row lineage,
grouping decisions, omissions and output-owner decisions.

The data flow is:

```text
exact source
  -> M2 AgreementIndex
  -> M3 context and relationship graphs
  -> M4 base AgreementAnalysis plus proposition validator and diff
  -> M5 family adapters plus consolidated AgreementAnalysis
  -> M6 AgreementProjection
  -> M7 corpus and legal verification
  -> M9 certificate
  -> M10 private internal extractor selector
  -> Stage 3 remaining semantic and taxonomy closure
  -> Stage 4 durable write
  -> Stage 5 serving and rows
  -> Stages 6-9 corpus, security, product and production cutover
```

The containment tree supports collapse and expansion directly. Cross-references
and party relationships are graph edges because they can connect distant
nodes. The target is therefore a tree plus graphs, not a graph instead of a
tree.

Index traversal starts at the agreement root. Semantic analysis starts at the
smallest authored node or node set that contains the complete governing
grammar. It then closes proved ancestors and declared graph dependencies. A
sentence can be that node. A chapeau and its limbs can be that node set.
Analysis does not start from a detached evidence line.

## 6. Stage order

| Stage | State | Result |
|---|---|---|
| M0 | Complete | Frozen authority, cohort, baseline and diff contract. |
| M1 | Complete | `INCREMENTAL_RESTRUCTURE` decision with identity and provenance proof. |
| M2 | Complete | Seven sealed shadow `AgreementIndex` files, with exact source and authored-block trees. |
| M3 | Complete | Provenanced context, references, definitions and party topology. |
| M4 | Complete | Base AgreementAnalysis, required-role validator and resolution-set diff. |
| M5 | Ran; M7 V2 repair required | The correction bypassed the sealed subtype schemas and accepted coarse role buckets as complete. Its 1,111 complete labels are not legally accepted. |
| M6 | Ran; M7 V2 repair required | The 1,111 shadow rows are evidence only. Projection performed legal inference and did not prove zero material omissions. |
| M7 | Failed lawyer review; Work 0 passed; Work 1-7 locked | Ben completed the fixed 50-item review: 19 correct and 31 incorrect. The repair baseline contains 38 repair items and 12 controls. Work 0 froze the evidence under its passing evidence-root receipt. M7 is not accepted. A separate evidence-root-bound authority is required before Work 1. |
| M8 | Not authorised; locked readiness only | Phase B packet, no call. Optional for M9. |
| M9 | Not authorised | Certified shadow candidate and rollback proof. |
| M10 | Separate authority required | `PRIVATE_INTERNAL_EXTRACTOR_ACTIVE`. |
| Stages 3-9 | Retained after M10 | Durable product, serving, security, features and go-live. |

M0-M9 restructure and certify extraction. M10 activates that extractor for
named private internal consumers only. M0-M10 roughly replace the extraction
part of old Stage 2 and Stage 2Y plus an internal cutover. They do not complete
the old extract, validate, write, serve and render ladder. They do not complete
Stages 3-9.

Each Terra agent receives one bounded stage or one disjoint family wave. The
agent may implement only the frozen interfaces, files and fixtures in that
work order. The agent stops for Sol when a shared schema, identity, source
boundary, provenance rule or cross-family rule is absent or inconsistent. The
agent stops for Ben when two legally plausible meanings, role requirements,
grouping rules or omission rules remain. A local family defect stops that
family. It does not stop unrelated family agents unless the shared M2-M4
contract failed.

## 7. Completed input to the open plan

M2 is sealed and complete. It created the pure
`indexAgreement(exactSource, structuralPolicy) -> AgreementIndex` entry point
and seven shadow indexes. The authored tree includes agreements, articles,
annexes, sections, paragraphs, sentences, headings, chapeaux, limbs and
qualifications. Markers, references and defined-term occurrences remain
annotations. Page and conversion material remains in `source_artefacts`.

The M2 receipt proves exact source retention, complete byte coverage, stable
identities, one-to-one current aliases, six authored annexes, deterministic
output and zero current-system effect. Its private inline parser distinguishes
accepted authored lists, non-structural marker-shaped text and typed unresolved
lists. Every candidate marker has exactly one disposition. Accepted markers
have one structural materialisation. `COMPLETED.md` records the evidence,
review and commit. No executable M2 task remains here.

M2 recorded 5,184 marker-sequence dispositions. It mechanically admitted
1,376 authored inline lists, classified 3,785 records as non-structural markers
and retained 23 typed parser ambiguities. The admitted lists produced or reused
3,963 authored limb nodes. These are structural-parser results, not human legal
acceptance. The 23 parser ambiguities are not the historical 69 Red Hat
semantic limb cases.

## 8. M3: compile context and relationship graphs

**Owner:** one Terra implementer, one fixture auditor, Sol for shared rules.

**Dependency:** M2 receipt and Sol review pass.

**Effect:** shadow-only.

**Authority:** not granted. The text below is the proposed work order. It does
not permit implementation.

The internal interface is:

```text
compileContext(focusNodeIds, AgreementIndex, semanticPolicy)
  -> ContextCompilation
```

The interface remains private behind `analyseAgreement`.

### Entry gate before Terra starts

M3 is on hold until both gates pass:

1. Ben authorises the exact M3 work order. A passing M2 receipt is not that
   authority.
2. Sol freezes the `ContextCompilation` schema, identity and ordering rules,
   the closed context-role and diagnostic vocabularies, the scope-edge proof
   rule, reference and definition resolution rules, topology entity and time
   rules, dependency behaviour and receipt contract.

### Smallest first experiment

After the entry gate passes, implement only TopBuild 6.2. Bind these inputs:

- M2 receipt:
  `evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m2-agreement-index.json`,
  SHA-256 `dde0fdcf5f92c08c2522ea3847cd53450949691f93141a15b677d90b55819585`;
- TopBuild index:
  `evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-index.json`,
  SHA-256 `e8f03463e792220b421bf8ccae1cb9a55e8e05a41396c60512cf63ae50b031af`;
- TopBuild index identity
  `e5ca967c6d1af76f53fdd6bb0c402aef416272f7757fcdbaa11d3e8968d0c29a`
  and canonical-text SHA-256
  `7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d`;
- chapeau node
  `8807b25eb5ce3da6a2a6d0f014f5930becc74921e722316337b60e76fc283096`,
  bytes `[364423, 364547)`; and
- limb nodes
  `20800cde2e005201e9182939b5ea73785f0e25b4b3051b0695cba9a52e1f1cd7`,
  `81fff54644db6c9cdd8dc553c389a464489ed04e2a993a8df46c25e5f327636b`,
  `492c594ec9814564bf30d5657ea5d774b760aabe20acbd29f02c61d763b74d4d`
  and
  `e1491fafffa0d5e77e4e703aeac3c211e2bc48518dcd05a6bc32572cebe11c9d`,
  in source order.

The compiler passes these six facts from the chapeau to all four limbs:

| Role | Exact words | Byte span |
|---|---|---|
| object | `This Agreement` | `[364423, 364437)` |
| modal | `may` | `[364438, 364441)` |
| verb | `be terminated` | `[364442, 364455)` |
| time | `at any time prior to the Titanium Merger Effective Time` | `[364456, 364511)` |
| actor | `either Parent or the Company` | `[364515, 364543)` |
| connective | `if` | `[364544, 364546)` |

Acceptance for this experiment is exact:

- all six facts reach all four limbs as `INHERITED`;
- every fact binds the chapeau node, exact span, target limb and explicit scope
  edge;
- no fact claims a local limb span;
- the local provisos in 6.2(a) and 6.2(d) do not reach sibling limbs;
- repeated compilation is byte-identical;
- unknown, duplicate or out-of-index focus identifiers fail closed;
- changed index or policy digests fail closed; and
- the M2-bound claim, row, open-world, selector, pin, baseline, model, network,
  database, serving and publication states remain unchanged.

Limit the first experiment to `control/m3-authority.json`,
`control/semantic-policy.json`, `lib/canonical-v2/context-compilation.js` and
`tests/canonical-v2-context-compilation.test.js`. One Terra agent implements
the pure compiler. A second Terra agent owns the exact fixture. Root integrates.
Sol owns the frozen shared contract and the final review.

### Work

1. Freeze `control/m3-authority.json` and `control/semantic-policy.json`. Bind
   the M2 receipt, all seven M2 indexes, frozen current-state digests and the
   complete Sol-approved M3 contract.
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
11. After the first experiment passes, add the bounded shadow runner and build
    one context compilation per M2 index. Its closed input list includes the
    M3 authority, final M2 receipt, control, cohort manifest, M2 root, semantic
    policy and output root.
12. Seal a complete diagnostics ledger, draft receipt, independent Sol review
    and final
    `receipts/stage-2y-structure-m3-context-compilation.json`. Extend the
    migration validator to re-hash every input, implementation file, output,
    review, frozen current-state binding and predecessor receipt.

### Required fixtures

- Concho 6.9(a): use the sealed sentence, chapeau, four limb nodes and two
  limb-local provisos. M3 must not reconstruct those blocks from raw text.
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

Stop for Sol when M2 would need to change, a shared rule affects more than one
family, identity or digest rules are incomplete, a reference has several valid
targets, topology requires evidence beyond exact source, or the private
interface would need another public entry point. Stop for Ben when two legally
plausible scope readings remain after the technical analysis. Stop immediately
on any model or Phase B call, current-extractor or selector change, pin or
baseline change, database or product write, serving change, publication change
or external access.

## 9. M4: create the base AgreementAnalysis and proposition validator

**Owner:** integrator and one Terra semantic implementer.

**Dependency:** the final M3 context-compilation receipt passes.

**Effect:** in-memory shadow repository and sealed JSON only.

Implement:

```text
analyseAgreement(index, analysisTask) -> AgreementAnalysis
```

### Work

1. Freeze `control/analysis-policy.json`. Bind M2, M3, the diff contract,
   contract bundle and current resolver configuration. `analysisTask` names the
   requested scope and binds the exact analysis-policy digest. Policy is a
   controlled dependency of the task, not a second public argument.
2. Define the versioned required-role schema contract. It records the claim
   definition, required roles, role types, provenance requirements and schema
   authority. Do not invent family role lists in M4.
3. Define `MISSING_REQUIRED_ROLE` as a fail-closed resolution result and build
   the common validator.
4. Give each shadow claim two separate states. `legacy_resolution_state`
   preserves the immutable current state for parity. It never authorises a
   shadow row. `proposition_validation_state` is `COMPLETE`,
   `SCHEMA_APPROVAL_PENDING`, `MISSING_REQUIRED_ROLE` or `UNRESOLVED`; only
   `COMPLETE` can reach projection.
5. Allow a claim to cite one or more source nodes and ordered, discontiguous
   evidence spans. Do not replace these spans with one min-to-max envelope.
6. Link every semantic role to direct or inherited provenance.
7. Link claims to definition, reference, qualification and party-topology
   relationships.
8. Preserve current claim revision identities when meaning is unchanged.
   Otherwise create an explicit alias and equivalence record.
9. Create an in-memory shadow repository that round-trips every field.
10. Seal one `AGREEMENT_ANALYSIS/V1` per agreement.
11. Seal a field-level resolution-set diff before any later selector or pin
    decision.
12. Make the M4 runner accept the final M2 and M3 receipts as explicit inputs
    for the M2 and M3 roots that it reads. Seal the final
    `receipts/stage-2y-structure-m4-agreement-analysis.json`, which binds both
    predecessor receipts, every M4 output, the diff, policy, implementation,
    test and Sol review.

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
- Unexpected `legacy_resolution_state`, value, party, scope, attribute,
  evidence and relationship changes are zero.
- Official open-world does not increase in any family.
- Metsera 7.04 satisfies its approved golden schema and records
  `proposition_validation_state: COMPLETE`. Other family claims retain their
  immutable legacy comparison state and record
  `proposition_validation_state: SCHEMA_APPROVAL_PENDING` until their M5
  calibration pack is approved. They are not shadow-renderable.
- Current storage and readers remain unchanged.

Stop on any unapproved semantic difference. Sol decides technical identity.
Ben decides legal value, scope or role requirements.

## 10. M5: migrate all families in waves

**Owner:** one integrator. Terra agents receive disjoint family files.

**Dependency:** the final M4 agreement-analysis receipt passes.

**Effect:** shadow adapters only. Saved responses only.

For each family:

1. inventory each current source-reconstruction rule;
2. map it to an M2 node, M3 context fact or M4 role;
3. prepare a source-first calibration pack with three to ten materially
   different full provisions and one proposed family required-role schema;
4. obtain Ben's approval of that family schema before calling any claim under
   it a resolved complete proposition;
5. run current and shadow adapters side by side;
6. compare every field in `control/diff-contract.json`;
7. record intended improvements with exact source and legal authority;
8. require zero unexpected resolved changes and zero open-world increase;
9. retire duplicate reparsing only in the shadow adapter after parity; and
10. prove isolated rollback.

Use these waves:

| Wave | Families |
|---|---|
| 1 | `EMPLOYEE_MATTERS`, `TERMINATION`, `GENERAL_COVENANTS` |
| 2 | `CLOSING_CONDITIONS`, `MAE_DEFINITION`, `KEY_DEFINED_TERMS`, `REPRESENTATIONS` |
| 3 | `INTERIM_OPERATING`, `NO_SHOP`, `DNO_INDEMNIFICATION`, `NO_OTHER_REPS_FRAUD`, `ANTITRUST_REGULATORY` |
| 4 | `APPRAISAL_DISSENTERS_RIGHTS`, `CAPITALISATION`, `CONSIDERATION`, `DIVIDENDS`, `FINANCING_COVENANTS`, `GUARANTY_FINANCING_PARTY`, `MATERIAL_CONTRACTS`, `MERGER_STRUCTURE_CLOSING`, `MISC_BOILERPLATE`, `PROXY_MEETING`, `SPECIFIC_PERFORMANCE_REMEDIES`, `TAX_MATTERS`, `TERMINATION_FEE` |

Wave 4 does not unpark the product treatment of capitalisation. It only makes
the registered extraction family structurally safe.

Before a family runner starts, Ben seals
`control/family-role-schemas/<family_key>.json` under schema
`STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1`, with exact roles, provenance rules,
ruling identifiers, Ben approval identifier and payload digest. The runner
accepts that file as an explicit immutable input. It cannot manufacture legal
authority. Every family packet contains current output, shadow output, adapter
identity, claim diff, row diff, reparse-retirement ledger, open-world counts,
selector state and rollback receipt. The runner also accepts the final M4
receipt and M4 analysis root as explicit inputs. Each family receipt binds the
exact role-schema input and packet outputs.
After all 25 registered families pass, seal the aggregate final
`receipts/stage-2y-structure-m5-family-adapters.json`. It binds every family
exactly once and re-hashes the M4 trust root and every family packet output.
The aggregate finaliser also writes one consolidated `AGREEMENT_ANALYSIS/V1`
per agreement under `shadow/m5/analysis/`. It preserves the M4
`legacy_resolution_state`, applies only approved family schemas and results,
updates `proposition_validation_state` through those governed results and
retains exact role provenance. M6 receives this consolidated AgreementAnalysis
as its one semantic input. Projection must not combine stale M4 analysis with
family packets behind the public interface.

Implement the consolidation once in
`lib/canonical-v2/agreement-analysis-consolidation.js` behind
`consolidateAnalysis(baseAnalysis, approvedFamilyPackets) -> AgreementAnalysis`.
The M5 aggregate finaliser and M7 generalisation runner both call this module.

Stop the affected family on a local defect. Stop all waves only when the shared
M2-M4 contract failed. Sol handles shared contracts and identity. Ben handles
legal meaning and family calibration.

## 11. M6: own and project every approved claim

**Owner:** integrator for the output contract. Terra prepares ledgers and
focused tests.

**Dependency:** the aggregate M5 family-adapter receipt passes.

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
5. Route and project only claims whose `proposition_validation_state` is
   `COMPLETE`. `legacy_resolution_state` is comparison evidence only.
6. Make each row field name its source claims, source nodes and evidence.
7. Keep an omission ledger. A known material fact must be displayed or have an
   approved omission.
8. Use useful legal words for cross-references. A bare `See provision` row
   fails.
9. Keep exact citations as links. Expansion shows target heading and relevant
   text.
10. Keep separate branch claims. Group only in projection.
11. Permit one Metsera 7.04 collapsed rule only after both branch propositions
   are complete and a family-specific equivalence signature proves the same
   legal standard, threshold, timing and qualifications.
12. Add a changed-standard negative fixture that requires separate rows.
13. Use `Parent` shorthand for a Parent and Merger Sub side only under the
    topology and no-hidden-effect rule in Decision 18.
14. Make the M6 runner accept the final M5 receipt and consolidated
    `shadow/m5/analysis/` root as explicit inputs. Seal the final
    `receipts/stage-2y-structure-m6-agreement-projection.json`, which binds the
    M5 receipt and every projection, owner, lineage, omission and diff output.
    The M5 receipt supplies the transitive M4 trust root.

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

**Dependency:** the final M6 agreement-projection receipt passes.

**Effect:** report-only.

### M7 entry packet: reach ten agreements without reopening M2

The seven sealed M2 agreements do not count as ten. Before the M7 lawyer
sample is frozen, this additive packet must pass. The packet does not amend the
M2 cohort, policy, indexes or receipt. Ben may later revise the numeric gate,
but that decision must update this PLAN and the M7 runner contract before work
continues. The current work order has no fewer-than-ten fallback.

The M7 work order may authorise evidence-only reads from the exact SEC URLs in
the next table. It does not authorise another network destination, a model or
Phase B call, product data, a selector, a pin, serving or publication.

| Candidate | Existing evidence | Admission required before counting |
|---|---|---|
| Lilly / Verve | `VERVE_AGREEMENT`; SEC URL `https://www.sec.gov/Archives/edgar/data/1840574/000119312525141748/d30505dex21.htm`; raw SHA-256 `0c5317d92be7616364e801ecff9b90c950e466d3e4787f6821294b6bf095317c`, 600,876 bytes; canonical SHA-256 `90242bd60f9a28464c42344f4f92a7e024b0c5825ca9b8374f72e7dc754203a4`, 369,081 bytes | Its verified SEC source must receive an approved governed deal membership. Do not invent the deal key. |
| AbbVie / Landos | `__fixtures__/demo-deal/landos-abbvie-agreement.txt`; SEC URL `https://www.sec.gov/Archives/edgar/data/1785345/000119312524075991/d779916dex21.htm`; canonical SHA-256 `fa2c0a883c64001e792cbed7b03077cfc4fc31909ac7a1d9e63c0e67b2c233be`, 394,336 bytes; governed key `deal:landos-abbvie` | Re-admit the complete agreement through the verified SEC source route. The current fixture-level admission is not enough for M9 certification. |
| Rocket / Redfin | Candidate `455b0ad3-b798-4bfb-9d1a-9dc4d87459f4` in `docs/ingest/seed-50-manifest-2026-07-05.json`; SEC URL `https://www.sec.gov/Archives/edgar/data/1382821/000162828025011457/exhibit21-8xk31025.htm`; selection fingerprint `c2a12299a2d24b7a671b91640f09faf0d82d5fdfb305ec3ce00d163fb79286fb` | Acquire and admit the full source, freeze raw and canonical bytes, create the source map and approve governed deal membership. The selection fingerprint is not an admission receipt. |

Create `control/m7-generalisation-authority.json`, schema
`STAGE_2Y_M7_GENERALISATION_AUTHORITY/V1`. It binds the base commit, allowed
files and SEC reads, existing source fingerprints, admission commands, M2-M6
implementation and policy digests, output roots, limits, prohibited effects,
rollback and approvers. Implement
`scripts/stage-2y-generalisation-source-admit.mjs` and
`tests/stage-2y-generalisation-source-admit.test.js`. Reuse the verified SEC
source chain. Preserve raw response bytes, canonical UTF-8 bytes and the source
map under `source/m7-generalisation/<candidate>/`. Reject a redirect or content
change, non-full document, amendment uncertainty, missing governed deal key,
duplicate immutable source identity or non-deterministic conversion.

The source-admission runner takes no URL argument. It reads URLs only from the
signed M7 authority. Each candidate receipt binds the authority, requested and
final URL, redirect count, HTTP status, response and preserved-raw lengths and
SHA-256 values, and one `network_read_status`: `PERFORMED` or
`NOT_PERFORMED_BOUND_EXISTING_SOURCE`. A performed read requires HTTP 200, zero
redirects, identical requested and final URLs, and response bytes identical to
the preserved raw bytes. The existing-source status requires a prior verified
source receipt bound by exact path, schema, length and SHA-256. A fixture or
candidate record is not enough. The M7 generalisation receipt records the
exact performed-read count and sorted read bindings. Extend the migration
validator in this packet to reject an unbound URL, call, receipt, source or
count mismatch. The final M7 corpus receipt records zero new reads and binds
the generalisation receipt.

After all three admissions pass, Sol seals
`control/m7-generalisation-cohort.json`, schema
`STAGE_2Y_M7_GENERALISATION_COHORT/V1`. It contains exactly those three complete
agreements. For each it binds the governed deal key, raw and canonical paths,
lengths and digests, canonical-text and immutable-source identifiers, source
map, admission receipt, selection reason, and a recorded input status for every
registered family. Allowed input states are an exact recorded-input binding,
`DETERMINISTIC_NO_PROVIDER` or `INPUT_NOT_AVAILABLE`. The last state never
authorises a model call and does not count as semantic family coverage.

Implement `scripts/stage-2y-structure-generalisation-shadow.mjs` and
`tests/stage-2y-structure-generalisation-shadow.test.js`. The runner accepts
only `--authority`, `--agreement-manifest` and `--output-root`. It imports the
frozen M2-M6 module interfaces and policies. It does not call the sealed
seven-agreement M2 runner. It writes only under
`shadow/m7-generalisation/`, plus its Sol review and M7 receipt. It produces
M2 index, M3 context, M4 analysis, M5 family and M6 projection outputs for each
new agreement, including one consolidated M5 AgreementAnalysis used by M6,
plus generalisation, ambiguity, claim-closure, resolution-diff and open-world
ledgers. The receipt binds those outputs, the three additive
agreement identities, the unchanged sealed-seven cohort digest and one combined
ten-agreement corpus digest. Where no legacy input exists, record
`NO_LEGACY_BASELINE`. The no-increase check compares current and shadow only
for the same sealed seven agreements, by family. The three additive agreements
have no legacy comparator. Record every unresolved additive occurrence in the
combined ten-agreement output. Do not add it to, subtract it from or compare it
with the historical seven-agreement total of 1,701.

`shadow/m7/open-world-by-family.json` contains two explicit views: a
sealed-seven current-to-shadow comparison by family, and combined-ten absolute
members and counts by family. Every combined member has one unique
`open_world_occurrence_id`; do not deduplicate. M7 fails if any sealed-seven
family delta is positive. An additive occurrence is not a migration increase,
but it remains in the combined ledger and any dependent incomplete claim still
fails closed. M9 consumes the combined-ten members, not the sealed-seven
comparator.

Run the two focused tests, source admission, generalisation runner and standard
receipt validator once. Do not repeat unchanged M2-M6 suites. M9 remains the
single full-suite gate.

```bash
node --test tests/stage-2y-generalisation-source-admit.test.js
node scripts/stage-2y-generalisation-source-admit.mjs \
  --authority evidence/canonical-v2/stage-2y-structure-migration/control/m7-generalisation-authority.json \
  --output-root evidence/canonical-v2/stage-2y-structure-migration/source/m7-generalisation
node --test tests/stage-2y-structure-generalisation-shadow.test.js
node scripts/stage-2y-structure-generalisation-shadow.mjs \
  --authority evidence/canonical-v2/stage-2y-structure-migration/control/m7-generalisation-authority.json \
  --agreement-manifest evidence/canonical-v2/stage-2y-structure-migration/control/m7-generalisation-cohort.json \
  --output-root evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-generalisation
node scripts/stage-2y-structure-migration-validate.mjs \
  --receipt evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-generalisation.json
```

This entry packet passes only when:

- exactly three distinct full agreements join the seven sealed agreements;
- every new source and AgreementIndex reconstructs its canonical bytes and
  has deterministic identifiers, valid parentage, an exact marker partition
  and typed ambiguities;
- every focus node has proven context or a typed unresolved result;
- every registered family has an explicit input state, and at least one
  complete role-valid proposition reaches a fully lineaged projection for each
  new agreement without a model call;
- incomplete propositions do not render, available current-to-shadow
  comparisons have zero unexpected differences, and no-baseline cases are
  labelled;
- every new ambiguity enters the M7 lawyer packet and blocks dependent claims;
- the sealed seven M2-M6 digests remain byte-identical; and
- the M7 Sol review and receipt pass.

Stop below ten if any source cannot be admitted, any governed deal membership
is missing, fewer than three agreements qualify, a required module or policy
would need to change, or one new agreement lacks a complete end-to-end
proposition. Ben may approve a replacement agreement or revise the numeric
gate. A replacement requires an updated exact work order, authority and cohort
contract before execution. A numeric revision requires a new PLAN entry and
work order. Terra and Sol must not infer either decision. Rollback excludes
the additive receipt from M9 and leaves the failed evidence inert.

### Machine work

1. Run the sealed seven-agreement, 130-run cohort through current and shadow
   paths. The corpus runner accepts the final M2, M3, M5 and M6 receipts as
   explicit inputs beside their matching roots and rejects any unbound file.
   The M5 receipt binds the consolidated AgreementAnalysis and the transitive
   M4 receipt. Import the passing additive three-agreement receipt into the
   combined M7 outputs without changing the sealed seven. Raw M5 family packets
   are audit evidence only. Claims, resolutions and projections come only from
   the consolidated AgreementAnalysis.
2. Produce combined ten-agreement source coverage, context provenance, claim closure, field-level
   resolution diffs, open-world by family, output ownership, row preservation
   and omission measurements.
3. Recheck all 69 former unresolved limb cases against authored nodes and
   complete claims.
4. Recheck all 244 known-loss claims individually.
5. Recheck all 23 M2 inline parser ambiguities. Record the source span, parser
   reason, competing structure, affected claims, dependent-claim block and
   reviewed disposition for each one.
6. Bind the passing M7 generalisation receipt and the combined ten-agreement
   corpus digest. If the entry packet did not pass, stop M7. Seven must not
   silently count as ten.
7. Make the M7 corpus runner accept the generalisation receipt and root as
   explicit inputs. Every M7 machine output binds the same combined corpus
   digest and includes the exact union of the sealed-seven and additive-three
   members where that output applies.
8. After machine and lawyer gates pass, seal the Sol review and
   `receipts/stage-2y-structure-m7-corpus-verification.json`. The receipt binds
   the direct final M2, M3, M5 and M6 receipts, transitive M4 receipt through
   M5, generalisation receipt, combined corpus digest,
   every M7 output and the family-manifest path, schema, byte length and
   SHA-256, plus the lawyer sample, decisions and legal sign-off.

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
combined seven-plus-three corpus digest, strata, random seed and threshold
before answers are opened. Include at least one source-to-row case from each
new agreement.
Do not insert 50, 300 or another number without Ben's decision.

After internal launch, accumulate the broader uniform sample through ordinary
review. Report the overall one per cent target with sample size and confidence.
It is a metric and alarm. It is not a per-family or 300-row shipment gate.

### Acceptance

- Unexpected semantic differences on the sealed-seven current-to-shadow
  comparison are zero.
- No sealed-seven family has a positive open-world delta. Every additive-three
  unresolved occurrence appears in the combined-ten ledger with
  `NO_LEGACY_BASELINE`; the combined absolute count is not compared with
  1,701.
- The M7 generalisation receipt proves ten distinct admitted agreements.
- The final M7 corpus-verification receipt passes and binds the same combined
  corpus digest as every M7 output and lawyer-sample record.
- Every historical limb case and M2 parser ambiguity has a reviewed
  member-level disposition.
- Every known material information loss in the 244-record set has a verified
  fix. A non-material or false-positive member has an evidenced disposition.
- Every family has an approved calibration or no-output policy.
- The frozen blind sample is complete and passes its pre-approved threshold.
- Human acceptance is labelled as human acceptance.
- No error class is hidden by an overall average.

A failed legal class returns only that class to M5 or M6. Do not change sample
membership after review begins.

## 13. M8: prepare Phase B input, keep the route locked

**Owner:** Sol. Terra may prepare deterministic packets only under an explicit
M8 work order.

**Dependency:** M7 passes and Ben authorises the exact M8 work order.

**Effect:** no model call and no runtime route.

**Authority:** not granted. M8 packet preparation and a later Phase B model
experiment are two separate authority decisions.

Build a `PhaseBInputPacket` from the exact M2 to M4 representations and the
final M5 family-adapter receipt. The M5 input supplies the approved family
required-role schemas and consolidated AgreementAnalysis. A pending or
unapproved role schema cannot enter the packet. The packet contains source
nodes, inherited context, reference and definition edges, required-role
schemas and deterministic evidence anchors. It must not accept detached raw
section text as a substitute.

Create a bounded packet runner with the closed inputs: final M2 receipt and
index root, final M5 receipt and consolidated analysis root, final M7 receipt,
a frozen recorded-input manifest and output root. The recorded-input manifest
binds every saved evaluation input by path, schema, byte length and SHA-256.
The runner rejects any unbound input and has no provider-call interface.

Use recorded responses to test packet and comparator interfaces. Preserve
historical Phase B candidates and decisions. Produce a bounded experiment plan
with call cap, cost cap and stop conditions. Sol decides the technical
comparator. Ben alone can authorise a later live experiment.

Seal the final
`receipts/stage-2y-structure-m8-phase-b-readiness.json`. It binds the direct
final M2, M5 and M7 receipts, every M8 packet, builder and test digests and the
zero-call Phase B lock proof.

M8 passes when the packet is complete and every existing Phase B lock still
refuses calls. M8 is optional for M9 unless Ben separately authorises a Phase B
experiment.

## 14. M9: certify the shadow extractor

**Owner:** Sol integrator, Terra evidence agents, Ben for legal sign-off.

**Dependency:** M7 passes. M8 is optional while Phase B stays locked.

**Effect:** certification only.

### Work

1. Build and test `shadow/m9/remaining-open-world.json`, schema
   `STAGE_2Y_PRIVATE_INTERNAL_REMAINING_OPEN_WORLD/V1`, from the final M7
   receipt and its exact combined open-world, claim-closure, source-coverage
   and family-manifest inputs. The builder rejects any path, schema, length,
   digest or certified agreement-set mismatch. It records those exact input
   bindings in the output. It preserves one item per unique M7
   `open_world_occurrence_id` without deduplication. Derive each stable item ID
   from that occurrence ID under domain
   `STAGE_2Y_REMAINING_OPEN_WORLD_ITEM/V1`; require state `OPEN_WORLD`; sort by
   item ID; reject duplicate item and upstream identifiers; and assign exactly
   one governed family or `UNOWNED`. Source anchors keep their node ID,
   canonical UTF-8 half-open byte span and slice hash together. Validate each
   slice. Require claim or proposal lineage. Prove that total and family counts
   form an exact partition, emit canonical JSON and require byte-identical
   repeated output.
2. Freeze a release candidate with exact commit and all policy, adapter,
   projection and receipt digests, including the M7 generalisation receipt and
   combined ten-agreement corpus digest.
   Bind the ledger path, schema, byte length, SHA-256, `ledger_id`, total and
   family counts.
   Bind the remaining-open-world builder and test paths and digests.
3. Create an isolated candidate harness. It can choose current and shadow
   implementations in memory only.
4. Run focused seam checks once on the exact candidate.
5. Run `bash scripts/ci/run-all-invariants.sh` once, then run `npm run build`
   once. The invariants script already runs `npm test`; do not run a separate
   duplicate test command.
6. If shadow persistence changed, run the database-backed writer gate once
   against an approved throwaway database. If no approved database exists,
   record `NOT_RUN` and stop certification.
7. Rehearse current, shadow, current in the isolated harness. Record the
   current, shadow and restored claim, row and open-world digests.
8. Seal rollback proof and the Stage 2Y certificate.
9. Record whether M8 was unused, prepared only or separately authorised.
10. Confirm selector authority, product writes, publication and external
   serving remain `NONE`.

### Acceptance

- Every M0-M7 gate passes on the exact candidate.
- Unexpected differences are empty.
- Every expected difference has technical and, where required, legal approval.
- Full rollback restores the old claim, row and open-world digests.
- At least ten agreements have passed certification.
- The certificate proves seven sealed plus three additive agreement identities
  and binds the passing M7 generalisation receipt.
- The certificate states that M10 is ready for a separate authority decision.
- The certificate does not claim product readiness.

## 15. M10: activate the certified private internal extractor

**Owner:** programme integrator. Sol verifies. Ben signs the exact authority
packet.

**Dependency:** unchanged M9 certificate.

**Result:** `PRIVATE_INTERNAL_EXTRACTOR_ACTIVE`.

Before any change, freeze a smoke plan, cutover test, current and target
selector, named private internal consumers, exact versions, optional new
immutable pin manifest, rollback command and expected digests. The packet also
binds the exact M9 remaining-open-world ledger by path,
schema, byte length, SHA-256, `ledger_id`, total and family counts. Ben signs
that exact packet.

The final activation certificate binds the exact signed M10 authority and M9
certificate by path, schema, byte length and SHA-256, plus the M9 packet
identifier and candidate digest. Authority, M9 trust root, installed target and
observed selector must agree exactly. The cutover receipt also binds the M9
release candidate and smoke plan and records the authority ID, selectors,
commands, results and rollback proof. The activation certificate binds that
receipt and repeats the authority ID, M9 certificate and release-candidate
digests. Product Stage 3 validates this equality before use.

The expected prior-state digests include claims, rows and open-world output.

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
restoration of the prior selector, including its open-world digest. The
activation certificate binds the path,
schema, byte length, SHA-256, `ledger_id`, total and family counts of
`remaining-open-world.json`, schema
`STAGE_2Y_PRIVATE_INTERNAL_REMAINING_OPEN_WORLD/V1`. This ledger contains the
exact M10 open-world records and is the input to Product Stage 3. The
historical 1,701 count remains the M0 comparison baseline only.

The planned certificate is
`STAGE_2Y_PRIVATE_INTERNAL_EXTRACTOR_ACTIVE_CERTIFICATE/V1`. Do not use
`MISSION_READY_CERTIFICATE`.

## 16. Product work after M10

M10 changes an extractor selector. It does not complete the product path.
These stages remain.

Each stage has one final machine trust root under
`evidence/canonical-v2/product-stage-<stage>/`. It uses schema
`PRODUCT_STAGE_PACKET_RECEIPT/V1` and binds the exact base commit, authority,
predecessor receipts, inputs, outputs, environment, permitted effects, focused
checks and rollback. A downstream work order accepts and validates the final
receipt for every earlier output root that it reads. A prose statement that a
stage passed is not enough.

| Stage | Final trust root | Required predecessor |
|---|---|---|
| 3 | `product-stage-3/receipt.json` | Direct M9 certificate, Stage 2Y M6 receipt and M10 activation certificate |
| 4 | `product-stage-4/receipt.json` | Stage 3 receipt |
| 5 | `product-stage-5/receipt.json` | Direct Stage 3 and Stage 4 receipts |
| 6 | `product-stage-6/receipt.json` | Direct Stage 3, Stage 4 and Stage 5 receipts; binds `corpus-certificate.json` and `certified-corpus-candidate.json` |
| 7 | `product-stage-7/receipt.json` | Stage 6 receipt |
| 8 | `product-stage-8/receipt.json` | Stages 5, 6 and 7 receipts; binds `preview-import-state.json` |
| 9 | `product-stage-9/production-cutover-receipt.json` | Stages 3 to 8 receipts and exact one-use authority |
| 9F | `product-stage-9f/receipt.json` | Direct Stage 6 and Stage 9 receipts, separate Capitalisation work order and exact one-use Stage 9F authority |

Sol reviews every final receipt. Ben signs any legal ruling or external effect
required by the stage. Earlier passing receipts are immutable.

An additive product-stage revision writes
`product-stage-<stage>/revisions/<revision_id>/receipt.json`. It binds the exact
prior receipt and never overwrites it. Every downstream work order names the
exact base or revision receipt that it consumes. There is no mutable `current`
alias.

### Stage 3: finish unresolved semantic and taxonomy work

Input gate: the unchanged final M9 certificate, final Stage 2Y M6 receipt and
M10 activation certificate bind the exact remaining-open-world ledger and base
output controls by path, schema, byte length and SHA-256. The ledger binding
also records `ledger_id`, total and family counts. Reject an absent or changed
trust root or binding. The 1,701 figure is the historical M0 baseline only, not
the Stage 3 input count.

1. Apply the payment-trigger and structured-delay rulings within the complete
   Termination Fee proposition. Do not activate the old unreachable path
   separately.
2. Cluster every member of that bound ledger by proposed legal and comparison
   type.
3. Use family calibration rulings. Do not ask Ben to classify raw technical
   records one by one.
4. Keep capitalisation parked until Stage 9F.
5. Ben seals `product-stage-3/semantic-disposition-targets.json`, schema
   `PRODUCT_STAGE_3_SEMANTIC_DISPOSITION_TARGETS/V1`. It contains separate
   sorted claim-definition, no-output and legal-question targets. Each target
   binds its kind, family, definition, required roles, provenance rules,
   rulings, Ben approval and payload digest. IDs are unique across all three
   kinds. A claim-definition target has a non-empty required-role schema.
6. Seal one decision per input `item_id`. Use only
   `APPROVED_CLAIM_DEFINITION`, `APPROVED_NO_OUTPUT` or
   `OPEN_LEGAL_QUESTION`, with a target identifier plus ruling and approver
   lineage. Reject an unknown, duplicate or wrong-kind target. Every target in
   the target set must be referenced by at least one M10 item; reject an extra
   unreferenced target.
7. Build and test
   `evidence/canonical-v2/product-stage-3/open-world-disposition-ledger.json`,
   schema `PRODUCT_STAGE_3_OPEN_WORLD_DISPOSITION_LEDGER/V1`. The builder
   accepts the exact M10 activation certificate, ledger, semantic-target set
   and decision file,
   verifies their path, schema, length and digest bindings, sorts by item ID,
   emits canonical JSON and rejects a duplicate, missing or extra item. The
   output binds all four input files and proves counts by the closed
   disposition values.
8. For every `APPROVED_CLAIM_DEFINITION`, seal a versioned extension to the M6
   output-owner registry and view policy. Give it exactly one approved output
   owner or an approved no-output disposition. Bind field lineage and compact
   omissions. The extensions contain exactly one governed entry for each
   reachable approved claim target and no extra entry. Do not mutate the sealed
   M6 registry.
9. Seal a deterministic Stage 3 semantic candidate. It binds role-complete
   claims, relationships, projections, resolution diff, open-world results,
   the approved semantic-target set, disposition ledger and output-owner and
   view-policy extensions by exact path, schema, byte length and SHA-256. It
   applies those extensions to the sealed M6 controls and writes one
   consolidated output-owner registry and view policy. Later product stages
   read those consolidated controls only. Bind that candidate and its output
   set in the final Stage 3 receipt. Incomplete claims cannot enter its
   projection set, and a candidate claim can arise only from a reachable
   matching-kind claim-definition target.

Stage 3 passes when every remaining proposed concept has an approved claim
definition, an approved no-output disposition or a typed unresolved legal
question. Every bound member is accounted for exactly once and the input
digest is unchanged. The disposition-ledger test and one-to-one partition pass.
Every new approved claim definition also passes the M6-equivalent ownership,
lineage and omission gate before Stage 4.

Rollback disables only the Stage 3 shadow policy and restores the M10 claim,
row, open-world and selector digests. The exact M10 remaining-open-world path,
schema, byte length, SHA-256, `ledger_id`, total and family counts remain
unchanged. The semantic target set, decisions, disposition ledger, owner/view
extensions, semantic candidate and candidate output set remain inert evidence.

### Stage 4: durable validation and import

The final Stage 3 receipt and its exact semantic candidate are mandatory
inputs. The import driver rejects any changed path, schema, length, digest,
corpus or output binding.

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
7. Seal `product-stage-4/import-state.json`, schema
   `PRODUCT_STAGE_4_IMPORT_STATE/V1`, binding the Stage 3 candidate, authorised
   non-secret database target and namespace, stable `import_run_id`, before and
   after state and table digests, lineage checks, both deal identities,
   idempotency, resume and backup-and-restore results. Derive `import_state_id`
   from the payload excluding that ID. Imported rows store `import_run_id`.
   Bind the file and post-import digest in the final Stage 4 receipt.

Stage 4 passes when approved candidate bytes can be written, repeated,
recovered and traced without touching production.

### Stage 5: database reader, serving and rendered rows

The final Stage 3 and Stage 4 receipts are direct inputs. Stage 5 validates
both plus the Stage 4 import-state file before reading imported claims or the
Stage 3 owner/view-policy extension. Reject a live database state that differs
from the bound post-import digest.

1. Read complete claims and relationships. Never reconstruct lost context from
   raw text in the reader.
2. Render a second deal without a hand-written serving file.
3. Prove the value through an HTTP response and the real rendered page.
4. Repeat the recipe for a second family.
5. Roll every serving family using the consolidated output-owner registry and
   view policy bound by the Stage 3 semantic candidate.
6. Keep compact and expanded source lineage accessible.
7. Route every Stage 3 claim through those consolidated controls. Do not merge
   base and extension inside the reader or renderer.

Stage 5 passes when every approved serving family has a database-to-HTTP-to-row
proof, every Stage 3 claim uses its approved registry extension and no family
relies on hand-written deal data.

### Stage 6: identity, source integrity and corpus certification

The final Stage 3, Stage 4 and Stage 5 receipts are direct inputs. Validate all
three before reading their controls, import state or results.

1. Freeze `product-stage-6/product-corpus-manifest.json`, schema
   `PRODUCT_STAGE_6_CORPUS_MANIFEST/V1`, with exactly 40 unique fully admitted
   agreement identities, source receipts, canonical and source-map digests,
   governed deal keys and family input states. Forty is the retained product
   target, not a measured current cohort. A revision requires an evidenced PLAN
   decision before execution.
2. Decide whether legacy V1 quotation spans need backfill before V1 retirement.
   M2-M4 already satisfy the V2 span requirement.
3. Use M4/M5 aliases for future claim identity. Identify the possible 128
   legacy database rows. Deletion needs Ben's approval.
4. Make amendment and restatement warnings reach a human and close bypasses.
5. Run all 25 families across the exact 40-member manifest using the sealed
   Stage 3 semantic-target, schema and policy contract. The ten-agreement Stage
   3 candidate is evidence, not 40-agreement coverage.
6. The first 40-agreement pass writes
   `product-stage-6/discovery/<discovery_id>/corpus-open-world-ledger.json`,
   schema
   `PRODUCT_STAGE_6_CORPUS_OPEN_WORLD_LEDGER/V1`. It binds every new drafting
   variant and open-world occurrence outside the governed Stage 3 candidate.
   Each source-anchored member has one stable identifier and one closed
   `governance_state`: `UNREVIEWED`, `COMPLETE_CLAIM`,
   `APPROVED_NO_OUTPUT` or `OPEN_LEGAL_QUESTION`. An `UNREVIEWED` member stops
   Stage 6. Seal
   `product-stage-6/discovery/<discovery_id>/receipt.json`, schema
   `PRODUCT_STAGE_6_DISCOVERY_RECEIPT/V1`, with
   `status: RETURN_TO_STAGE_3`. It binds the exact Stage 3, Stage 4 and Stage 5 inputs,
   40-member manifest and corpus digest, run outputs and ledger. Feed those members to
   `scripts/product-stage-3-revision.mjs`, which accepts the prior Stage 3
   receipt, discovery receipt, fixed manifest, ledger, successor target and
   decision files and one revision output root. It applies the same one-to-one target,
   disposition, complete-proposition, owner and view-policy gates as the base
   Stage 3 packet. It writes a successor semantic candidate and
   `product-stage-3/revisions/<revision_id>/receipt.json`. Rerun the affected
   Stage 4 packet into
   `product-stage-4/revisions/<revision_id>/receipt.json`, which binds the
   Stage 3 revision, and Stage 5 packet into
   `product-stage-5/revisions/<revision_id>/receipt.json`, which binds both
   revision receipts. Then rerun Stage 6 against those exact successors and the
   unchanged manifest and corpus digest. Never mutate a prior receipt. A typed
   legal question remains non-serving.
7. Require ingest QA, exact quote verification and the golden evaluation
   harness.
8. Seal `product-stage-6/certified-corpus-candidate.json`, schema
   `PRODUCT_STAGE_6_CERTIFIED_CORPUS_CANDIDATE/V1`. It lists every importable
   40-agreement claim, relationship, source-node, evidence-span and projection
   file by path, schema, byte length and SHA-256. It binds the exact corpus
   digest and the complete open-world ledger, total and counts by family.
9. Seal `product-stage-6/corpus-certificate.json`, schema
   `PRODUCT_STAGE_6_CORPUS_CERTIFICATE/V1`, binding the Stage 5 receipt, exact
   manifest and corpus digest, all 25 family results, source, identity and QA
   measurements, the certified corpus candidate, every file that it lists and
   Sol review. Bind both files and the exact final Stage 3, Stage 4 and Stage 5
   base-or-revision receipt paths in the final Stage 6 receipt.

Stage 6 passes when the exact manifest, 25 families, governed corpus open-world
ledger, certified corpus candidate, corpus certificate and final receipt
certify the complete product corpus, not only the seven-agreement migration
cohort. Every served claim is complete.

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

The final Stage 5, Stage 6 and Stage 7 receipts are direct inputs. Validate the
Stage 6 corpus certificate and prove that preview reads the same certified
corpus digest before enabling a feature.

1. Run `scripts/product-stage-8-preview-import.mjs` with the exact Stage 6
   receipt, certified corpus candidate, named protected-preview target and one
   output path. The runner rejects a candidate not bound by that receipt. Seal
   `product-stage-8/preview-import-state.json`, schema
   `PRODUCT_STAGE_8_PREVIEW_IMPORT_STATE/V1`, binding the candidate, namespace,
   before and after state digests, idempotency, lineage and rollback proof.
2. Enable market statistics in preview with corpus and selected-deal scopes.
3. Restore search in preview only after load and query guards pass.
4. Build the comparison view with selected terms, no three-deal limit,
   horizontal scrolling and source-completeness indicators.
5. Prove each feature reads the same certified V2 corpus and open-world digest.

Stage 8 passes in preview. It does not grant production authority.

### Stage 9: production cutover and rollback

Before staging, derive `candidate_id` from the complete payload excluding that
field and seal
`product-stage-9/candidates/<candidate_id>/production-candidate.json`, schema
`PRODUCT_STAGE_9_PRODUCTION_CANDIDATE/V1`. It binds the final Stage 3 to Stage 8
receipts, Stage 4 import state, Stage 6 corpus certificate and certified corpus
candidate, Stage 8 preview import state, corpus and family set, expected claim,
row and open-world digests and open-world counts by family, selectors,
serving-family allow-list, publication transition, import and rollback
commands. It accepts no independent import-file list. Every production import
file must be listed in and bound by the Stage 6 candidate. It records
`CAPITALISATION=PARKED`, with zero Capitalisation import, serving or publication
effect.

Tasks 1 and 2 derive `rehearsal_id` from the complete receipt payload excluding
that field and seal
`product-stage-9/rehearsals/<rehearsal_id>/receipt.json`, schema
`PRODUCT_STAGE_9_STAGING_REHEARSAL_RECEIPT/V1`, binding the candidate, named
staging target, commands, backup and restore proof, state digests and results.
Ben then signs
`product-stage-9/attempts/<authority_id>/production-authority.json`, schema
`PRODUCT_STAGE_9_PRODUCTION_AUTHORITY/V1`. It binds the candidate and staging
receipt, exact target and dark namespace, allowed commands and files, selector
changes, serving families, publication transition, backup, rollback and
move-forward scope, expiry and unique one-use authority ID. It repeats
`CAPITALISATION=PARKED`. Authority permits one cutover run, not one command.
`scripts/product-stage-9-cutover.mjs` atomically creates
`product-stage-9/attempts/<authority_id>/authority-consumption.json`, schema
`PRODUCT_STAGE_9_AUTHORITY_CONSUMPTION/V1`, before the first production effect.
It binds the authority, candidate and one `cutover_run_id` to an append-only
expected-state sequence for tasks 4 to 9. No second run may start under the
same authority ID. A new attempt requires a new authority. After a
crash, allow only `--resume <cutover_run_id>` at the next signed state or
`--rollback <cutover_run_id>`. Expiry blocks a new run but never a safety
rollback.

1. Under a signed Stage 9 rehearsal work order, rehearse import and rollback
   against one named hosted-staging target. Production remains prohibited.
2. Prove the proposed production backup and restore procedure against that
   hosted-staging target. Do not access production.
3. Seal the named staging receipt. Stop and obtain Ben's exact named one-use
   production authority.
4. Under that authority, perform and record the production backup and restore
   drill.
5. Import only the exact Stage 6 certified-corpus files named by the production
   candidate into the authorised dark
   production namespace that the live site does not read.
6. Verify counts, identities, source lineage, security and the bound
   open-world total and family counts before serving and after every selector
   state.
7. Enable V2 serving by approved family.
8. Run outside-in smoke tests.
9. Roll back in production once, verify restoration, and move forward again.
10. Seal
    `product-stage-9/attempts/<authority_id>/production-cutover-receipt.json`,
    schema `PRODUCT_STAGE_9_CUTOVER_ATTEMPT_RECEIPT/V1`, binding the authority,
    candidate, staging receipt, production backup,
    attempt-scoped `authority-consumption.json`, the single `cutover_run_id`
    and full state sequence, every selector state, command, open-world
    comparison, result and rollback or move-forward result. On PASS, install
    the top-level `product-stage-9/production-cutover-receipt.json` once under
    `PRODUCT_STAGE_PACKET_RECEIPT/V1`. That immutable final trust root directly
    binds, by path, schema, byte length and SHA-256, the production authority,
    attempt authority-consumption record, attempt cutover receipt, rollback
    receipt and `cutover_run_id`. Never overwrite a failed or successful
    attempt.

Stage 9 passes only when the real product writes, serves, renders and rolls back
under explicit production authority. Its mission-ready family set excludes
Capitalisation under the approved non-serving disposition. Stage 9F is a
governed post-cutover extension, not a hidden Stage 9 dependency.

Rollback restores the prior database namespace and reader, extractor selector,
serving-family allow-list and routes, publication state, feature flags and
security configuration. Verify their exact prior digests and the prior
open-world total and family counts. Keep the failed dark namespace inert. Seal
`product-stage-9/attempts/<authority_id>/rollback-receipt.json`, schema
`PRODUCT_STAGE_9_ROLLBACK_RECEIPT/V1`, against the same `cutover_run_id`.

### Stage 9F: Capitalisation

Stage 9F is separate from Stage 9. Stage 9 grants it no authority. Its direct
inputs are the final Stage 6 and Stage 9 receipts, the exact Stage 6 40-member
manifest, and a separate Ben-approved Capitalisation required-role schema and
work order.

1. Derive `candidate_id` from the complete payload excluding that field and
   build
   `product-stage-9f/candidates/<candidate_id>/capitalisation-candidate.json`,
   schema
   `PRODUCT_STAGE_9F_CAPITALISATION_CANDIDATE/V1`, from every parked
   Capitalisation member in the Stage 6 manifest.
2. Bind complete propositions, exact provenance, the output owner and view
   policy, 40-agreement results, same-cohort open-world comparison and exact
   import files.
3. Pass the same semantic, non-production import, serving, corpus, security,
   protected-preview, hosted-staging and rollback gates used in Product Stages
   3 to 9.
4. Derive `rehearsal_id` from the complete receipt payload excluding that
   field and seal `product-stage-9f/rehearsals/<rehearsal_id>/receipt.json`,
   schema
   `PRODUCT_STAGE_9F_STAGING_REHEARSAL_RECEIPT/V1`, after the Capitalisation
   candidate imports, serves and rolls back on the named hosted-staging target.
5. Seal `product-stage-9f/rehearsals/<rehearsal_id>/readiness-receipt.json`,
   schema
   `PRODUCT_STAGE_9F_READINESS_RECEIPT/V1`, after the non-production and
   hosted-staging gates pass. It binds the staging receipt.
6. Ben signs
   `product-stage-9f/attempts/<authority_id>/production-authority.json`, schema
   `PRODUCT_STAGE_9F_PRODUCTION_AUTHORITY/V1`. It binds the candidate and
   readiness receipt, exact production target and dark namespace, allowed
   commands and files, current and target selectors and routes,
   Capitalisation serving and publication scope, backup, rollback and
   move-forward scope, expiry and one unique `authority_id`. It prohibits every
   other effect.
7. Run `scripts/product-stage-9f-cutover.mjs`. It accepts only the Stage 9F
   candidate and authority schemas and writes
   `product-stage-9f/attempts/<authority_id>/authority-consumption.json`,
   schema `PRODUCT_STAGE_9F_AUTHORITY_CONSUMPTION/V1`,
   `production-cutover-receipt.json`, schema
   `PRODUCT_STAGE_9F_CUTOVER_ATTEMPT_RECEIPT/V1`, and
   `rollback-receipt.json`, schema `PRODUCT_STAGE_9F_ROLLBACK_RECEIPT/V1`, under
   the same attempt root, using Stage 9's one-run and safety-rollback state
   model.
8. After the authorised cutover, real rollback and authorised move-forward all
   pass, seal
   `product-stage-9f/receipt.json` under
   `PRODUCT_STAGE_PACKET_RECEIPT/V1`, binding all three Stage 9F control
   receipts, the signed Stage 9F production authority, the staging and
   readiness receipts, the single cutover run, the final active Capitalisation
   selector, serving-family allow-list and publication state, all final digests
   and the signed outside-in result.

Stage 9F passes only when every governed Capitalisation claim is complete,
traceable, owned or expressly omitted, the independent cutover and rollback
receipts pass, and the authorised move-forward leaves Capitalisation actively
serving. Without move-forward approval, status remains `PARKED`, not `PASS`.
Until then, Capitalisation remains an approved non-serving disposition. A
failure leaves the candidate inert and restores the Stage 9 production digests.

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
| 2G ten to fifteen agreements | MODIFIED | M7 keeps the seven frozen agreements and admits three distinct additions. Ten remains an M9 blocker. Any later numeric revision must first update this PLAN and the runner contract. |
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
| 6E full corpus | MODIFIED | M7 covers ten agreements through the sealed-seven plus additive-three receipt chain. The later 40-deal product run remains. |
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
- open-world increases in any family on the same compared cohort. At M7 this
  means the sealed seven, while every additive occurrence must remain in the
  combined-ten ledger;
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

### Legal and legal-review rulings

1. For each family and provision subtype, which semantic roles are required
   before a claim can resolve?
2. What exact size and composition should the modest risk-weighted blind sample
   use before M10?
3. For each family calibration pack, which roles must appear in the compact row
   and which may move to expansion?
4. Which proposed no-output dispositions, if any, are legally acceptable?

### Authority and operational decisions

5. After recovery and M7 legal acceptance, does Ben authorise the exact M9
   work order? M8 remains a separate optional readiness stage and has no
   authority.
6. Does Ben authorise any later Phase B or other model run?
7. If M9 passes, does Ben approve the exact M10 selector and named private
   internal consumers?
8. Later, what authority applies to hosted staging and production database
   operations?
9. Before external activation, does Ben require login for the live site and
   has the exposed service key been rotated?
10. Does Ben authorise the exact serving, publication and production-cutover
    packet after the retained product stages pass?
11. Must legacy V1 quotation spans be backfilled before V1 retirement?
12. May any of the possible 128 legacy database rows be deleted, or must each
    remain with an alias or retention record?

New source-specific legal ambiguities may arise. Record them with full
provisions and narrow questions. Do not turn them into broad design questions.
