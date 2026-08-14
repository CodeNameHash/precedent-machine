# M7 core semantic repair plan

**Date:** 14 August 2026

**State:** Proposed for adversarial review
**Programme boundary:** M0-M4 stay sealed. M8 stays locked. This document does
not authorise implementation, model calls, database writes, selector changes,
serving changes or publication.

## 0. Plain-language terms

**M5:** the stage that identifies and structures the legal rule in each source
clause.

**M6:** the stage that displays the structured M5 rule as a comparison.

**M5-M6 semantic seam:** the hand-off from M5, which identifies the legal rule,
to M6, which displays it.

**Sealed:** fixed by a completed evidence record. This work cannot change the
sealed file or its fingerprint.

**Locked:** not authorised to run. M8 is locked.

**Compiler or consolidation module:** the internal M5 code that turns approved
source units and context into structured legal rules.

**Sealed seven:** the original seven agreements completed through M2-M4.

**Additive three:** the three later agreements admitted for M7 testing. They do
not alter the sealed-seven baseline.

**Digest:** a SHA-256 file fingerprint. A changed byte produces a different
digest.

**Receipt:** the fixed record of a stage's inputs, outputs, fingerprints and
result.

**Regression control:** a review item that passed without a note. It is rerun
to prove that the repair did not break a correct result.

**Authored unit:** the source sentence, limb or connected node set that carries
one complete piece of contract drafting.

**Independently operative legal effect:** a duty, permission, condition,
definition or consequence that has its own legal operation. Separate effects
can appear in the same authored unit.

## 1. Decision

Do not patch the comparison-card wording again.

Replace the internal M5-M6 semantic seam. M5 must produce a complete,
structured legal rule. M6 must only format that rule. The same M5 compiler must
serve the sealed-seven correction path and the additive-three M7 path.

The existing public architecture stays in place:

```text
indexAgreement(exactSource, structuralPolicy) -> AgreementIndex
analyseAgreement(AgreementIndex, analysisTask) -> AgreementAnalysis
projectAgreement(AgreementAnalysis, viewPolicy) -> AgreementProjection
```

The repair deepens the one existing M5 consolidation module after the sealed
M4 `analyseAgreement` call and before M6. It does not add a competing M5
interface, or change the M4 function or its output:

```text
consolidateAnalysis({
  baseAnalysis,
  agreementIndex,
  contextCompilation,
  approvedFamilyPackets,
  approvedFamilyProfileSet,
  approvedStructureDispositions
}) -> AgreementAnalysisV2
```

This is the V2 successor to
`agreement-analysis-consolidation.js` and its existing
`consolidateAnalysis(baseAnalysis, approvedFamilyPackets)` contract. It
preserves every M4 claim identity, legacy state, evidence edge and dependency
edge, then adds V2 legal rules and validation. It never rewrites the sealed M4
AgreementAnalysis files.

In plain terms, M4 still produces the same sealed `AGREEMENT_ANALYSIS/V1` base
file. The new M5 module reads that base file and produces a separate proposed
`AGREEMENT_ANALYSIS/V2` file. The successor M6 projector reads only that M5 V2
file. `AgreementAnalysisV2` in this plan means the new
`AGREEMENT_ANALYSIS/V2` schema, not a renamed M4 output.

The M5 correction and additive-three runners both call this one module. A later
product orchestrator may compose the public calls only under later authority.
This repair does not redefine the sealed M4 boundary.

`consolidateAnalysis` owns legal classification, extraction,
completeness, ambiguity, source limitations and approved no-comparison
decisions. `projectAgreement` owns labels, order, grouping and citations only.

## 2. Bound review result

The repair baseline is fixed. Do not resample it.

- Combined ten-agreement corpus digest:
  `b8825b712ab905a175cfc4a86c3504705f1d8bf509ddcee40f951764c3cf6e3d`
- Review packet ID:
  `1508b03c8c081cc208ab5115e7bd7c369e4165d69d4115e665c30f25af8a679d`
- Review packet SHA-256:
  `7a3fb9e78bd3fb12743cbcf37f96127ceb9ecb69fa0f92c6d066a35a3e6adaeb`
- Decision ledger ID:
  `7a23e0073de1ccb366710931fafde9f863b4a942574bd9ada005f22dacfd5e3f`
- Decision ledger SHA-256:
  `d9caf0eafa84591f8df410f9636956e0de422fefa451f0cdcfbc8d653bfc49e0`
- Gate result: `FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR`

Ben answered all 50 items:

| Result | Count |
|---|---:|
| Marked correct | 19 |
| Marked incorrect | 31 |
| Cannot judge | 0 |

Six cards marked correct also contain a substantive note that identifies
missing legal meaning. One other correct card contains a page-number artefact.
Only 12 cards passed with no qualification. Treat 38 cards as the repair set
and the 12 clean cards as regression controls.

The 38 repair items break down as follows:

| Failure class | Count | Meaning |
|---|---:|---|
| Material rule part omitted or hidden | 21 | The source was found, but a party, condition, exception, timing rule, threshold, scope or linked definition did not reach the card. |
| Wrong classification or shallow legal understanding | 14 | The system found text but assigned the wrong topic, wrong subtype or an unusably broad description. |
| False parser ambiguity | 1 | Repeated nested numbering was treated as unclear even though its parentage resolves it. |
| Approved no-comparison case | 1 | The source is payment administration and should receive a recorded no-comparison disposition. |
| Source artefact | 1 | A page number reached legal text. |

The exact questions, source text, proposed cards, decisions and Ben's notes are
in [M7-LAWYER-REVIEW-QUESTIONS-AND-ANSWERS-2026-08-14.md](./M7-LAWYER-REVIEW-QUESTIONS-AND-ANSWERS-2026-08-14.md).

## 3. Root causes

### 3.1 The corrected M5 path bypassed the approved family schemas

The repository contains 25 sealed files under
`control/family-role-schemas/`. The correction runner does not give those
files to `family-compound-adapter.js`. It calls `policyForFamily()` instead.
That function creates a much coarser policy with broad buckets such as actor,
timing and qualifications.

This is the main contract failure. The legal profiles exist as evidence, but
the path that produced the 1,111 rows did not enforce them.

### 3.2 “Complete” currently means “some broad buckets are non-empty”

The adapter can mark a rule complete when these broad buckets contain any
value:

- authored source;
- legal effect or mechanic;
- member facts;
- actor, for selected families; and
- timing, if a timing word is detected.

Qualifications are not universally required. A full source clause can also be
copied into the timing bucket and satisfy the presence check. This proves that
text exists. It does not prove that the legal rule was understood.

Review item 2 is the clearest example. The M5 record was marked complete even
though it did not structure the condition failures, the incurability or cure
branches, written notice, the 30-Business-Day deadline, the Termination Date or
the proviso that removes Parent's right in stated circumstances.

### 3.3 The V1 family profiles are still too generic

The sealed V1 files name useful subtypes, but many subtypes repeat the same
five generic roles. They do not state the exact fields that make each legal
subtype complete.

A breach termination right and a mutual-consent termination are not complete
under the same field test. A change-in-law MAE carve-out and a general MAE
prong are not complete under the same field test.

### 3.4 M6 is doing legal analysis

`agreement-projection.js` currently derives comparison topics from claim keys,
humanises internal codes, filters attributes and decides which values look
useful. It then records `material_fact_omitted: false` without proving that
every material fact was displayed or deliberately omitted.

M6 must not discover legal meaning. It must receive typed facts from M5 and
format them.

### 3.5 The M7 source selector has an unsafe fallback

A heading may narrow the search area. It cannot prove that a child unit states
the family's rule. The present additive path can use the first authored unit
when no child matches the family. That fallback caused wrong-topic and
wrong-source results.

The replacement rule is simple:

- enumerate each independently operative legal effect in the unit;
- one approved subtype proves each derived legal rule: compile it;
- no subtype proves the unit: return unclassified or incomplete;
- incompatible subtypes prove the same legal effect: return ambiguous; and
- independent legal rules appear in one unit: create linked child rules.

Never choose the first unit because it appears first.

### 3.6 The structure parser treats a normal nesting pattern as unclear

Item 39 contains `(i)` inside `(B)`. The label repeats, but the parents differ.
Marker identity must be scoped to the parent authored node. Repetition alone
does not prove ambiguity. The structure is resolved only when parentage and
ordered siblings leave one valid tree.

M2 is sealed. This repair must not edit its parser or output. M5 must consume a
governed structure-disposition overlay for this exact ambiguity. The overlay
binds the M2 ambiguity ID, source bytes, competing structures, chosen
parent-scoped reading and lawyer ruling. It changes only the dependent M5
analysis. A future M2 parser improvement requires separate authority.

### 3.7 The lawyer question was too broad

Thirty-six cards asked the same question: whether the row preserved the
important legal meaning. Thirteen asked the same no-row question. This made Ben
reconstruct the expected field list himself.

The successor packet must ask concrete questions based on the rule profile.
For example:

> Does this termination row identify the terminating party, the breached duty,
> the closing-condition effect, the cure alternatives, written notice, both
> deadlines and the proviso that removes the right?

## 4. Ben's programme rulings

These rulings apply across all 25 families.

1. One independently operative authored limb is one legal rule. Connected
   components can stay together, but each limb keeps its own standard,
   conditions and exceptions.
2. Store one authoritative legal fact under its proper family. Other families
   may display it through a stable link. Do not store duplicate facts.
3. Do not guess a missing definition, reference, condition or other required
   fact. Mark and flag only the dependent rule as incomplete or ambiguous.

These rulings do not mean that every sentence produces one flat row. One
authored unit can contain linked child rules when it contains duties with
different legal effects or standards.

## 5. Target legal-rule contract

### 5.1 Definitions

**Legal rule:** one source-backed statement of legal effect. It includes all
conditions, exceptions, timing, thresholds and parties needed to understand
that effect.

**Family profile:** the approved field contract for one legal subtype. For
example, a breach termination right has a different profile from a mutual
termination right.

**Provenance:** proof of where a fact came from. Each fact must point to an
exact source node and byte span, or to a resolved definition, reference or
context edge that has its own exact source proof.

**Source coverage:** a non-overlapping account of the complete governing legal
text after an approved whitespace and punctuation policy. Every exact span must
become a fact, a logic link, a resolved dependency or a governed non-modelled
disposition.

**Logic link:** the proved relationship between facts, such as `and`, `or`, an
exception, earlier-of or later-of.

**Resolved dependency:** a proved link to another source-backed definition,
cross-reference, condition or context fact.

**Non-modelled disposition:** an approved reason why exact source text is not a
legal fact, such as a page number or section label. It must cite the exact rule
that permits that treatment.

Source coverage applies to governing legal text, not to whitespace or
punctuation. In review item 2, the termination grant, condition references,
cure branches, written-notice rule, deadlines and proviso each need a
source-backed treatment. The spaces and commas do not become facts.

### 5.2 LegalRule V2

Each rule must contain:

```text
identity
  family
  provision type
  subtype path
  authored unit

governance
  compiler ID and exact code digest
  profile ID and approved profile-set digest
  validation-result ID

applies to
  proved party or parties

facts
  typed, labelled and source-proved values

legal expression
  canonical, ordered AND, OR, NOT, exception, earlier-of and later-of tree

links
  child rules, definitions, references and cross-family owners

source coverage
  non-overlapping partition with a reason and authority for every span

validation
  extraction state, source quality, output disposition and issues
```

The legal expression is necessary. A flat list cannot preserve a termination
right with alternative cure branches, a no-shop proviso or an MAE carve-out
with a disproportionate-effect exception.

Each expression node contains:

- a stable expression ID;
- one operator;
- ordered child fact, rule or expression IDs;
- its parent expression ID;
- the exact span and provenance of the connective; and
- the exact source scope governed by that node.

Two trees with the same flat facts but different nesting are different legal
rules.

Each fact contains:

- a stable field key;
- a lawyer-readable label;
- a typed value;
- materiality;
- exact provenance;
- the deterministic normalisation rule, if the value was normalised; and
- a display rule.

Whole-clause text is citation evidence only. It never satisfies a semantic
field.

### 5.3 FamilyProfile V2

Each subtype profile declares:

- the deterministic test that proves the subtype;
- the classification path shown to the lawyer;
- required and optional fields;
- field type and cardinality;
- conditional requirements;
- allowed source and dependency types;
- allowed logic forms;
- child-rule profiles;
- materiality and display order;
- approved non-modelled span rules, each with an exact reason code and
  deterministic profile rule or specific lawyer ruling;
- approved no-comparison rules; and
- the lawyer ruling that authorises each non-obvious choice.

An authored unit can yield more than one linked legal rule. Each derived legal
rule must match exactly one compatible profile. Profiles that overlap on the
same legal effect create an ambiguity. Profiles for separate effects create
linked child rules. The compiler must not take the first profile as a fallback.

## 6. Rule states

Keep extraction state, source quality and output disposition separate.

### Extraction state

- `COMPLETE`: every material source part and every required field is proved.
- `INCOMPLETE`: extraction left a required field, dependency or material span
  unresolved.
- `AMBIGUOUS`: two plausible structures, classifications or legal readings
  remain.

### Source quality

- `SUFFICIENT`: the source states the required comparison dimensions.
- `SOURCE_LIMITED`: the source itself does not expressly state an expected
  dimension, the complete reviewed source scope proves that result, and a
  lawyer approved that finding.
- `DRAFTING_AMBIGUOUS`: the source wording itself supports more than one
  plausible reading.

### Output disposition

- `NORMAL`: complete rule with sufficient source.
- `APPROVED_LIMITED`: complete extraction of source-limited drafting. The row
  must show `Not expressly stated in the complete reviewed clause`, the
  reviewed scope and the lawyer ruling.
- `REVIEW_ONLY`: incomplete or ambiguous extraction. It cannot appear as a
  normal answer.
- `NO_COMPARISON`: an approved legal or administrative subtype that should not
  be compared. It remains in the disposition ledger.

This is how imperfect drafting can pass through the system without being
confused with failed extraction. An `APPROVED_LIMITED` result can appear only
with a typed `SOURCE_NOT_EXPRESSLY_STATED` observation. That observation binds
the expected field, complete reviewed source scope, profile requirement and
lawyer ruling. It is proof about the reviewed source, not a negative legal
fact inferred from silence. Exclude such rows from market statistics unless an
approved policy says otherwise.

`DRAFTING_AMBIGUOUS` is always `REVIEW_ONLY` until a lawyer resolves the
competing readings. A resolved result receives a new source-quality state and
ruling. It does not remain drafting-ambiguous in a normal row.

The allowed combinations are:

| Extraction | Source | Extra authority | Output |
|---|---|---|---|
| `COMPLETE` | `SUFFICIENT` | None | `NORMAL` |
| `COMPLETE` | `SOURCE_LIMITED` | Exact lawyer ruling and absence-proof record | `APPROVED_LIMITED` |
| `INCOMPLETE` | Any | Not applicable | `REVIEW_ONLY` |
| `AMBIGUOUS` | Any | Not applicable | `REVIEW_ONLY` |
| Any | `DRAFTING_AMBIGUOUS` | Unresolved | `REVIEW_ONLY` |
| `COMPLETE` | `SUFFICIENT` | Approved no-comparison profile | `NO_COMPARISON` |

This lets genuine source limitations through after proof and legal approval.
It never lets failed extraction through as a normal comparison.

## 7. Completion invariants

M5 may return `COMPLETE` only when all of these tests pass:

1. The complete governing authored unit is known. It includes any operative
   chapeau and inherited context needed for meaning.
2. Each derived legal rule has exactly one compatible approved subtype.
   Separate legal effects in one authored unit become linked rules. Overlapping
   subtype matches for the same effect are ambiguous.
3. Every subtype-required field is present.
4. Every displayed or normalised fact has exact provenance.
5. The rule preserves source connectives and nesting.
6. The governing legal text has a non-overlapping coverage partition after the
   approved whitespace and punctuation policy. Every span is one of:
   - a proved fact;
   - a logic connective;
   - a resolved dependency;
   - structural text under an exact deterministic profile rule;
   - a source artefact under an exact structural-policy rule or occurrence
     ruling; or
   - an exact approved omission under a deterministic profile rule or specific
     lawyer ruling.
   Every non-modelled span carries its source span, reason code and authority
   ID. Free-form structural, artefact or non-material labels fail validation.
7. No material span is unmodelled.
8. Every required definition or reference edge is resolved.
9. Every semantic fact has one owner or an approved link to its owner.
10. The result passes invariant validation before it leaves the module.
11. The rule binds the exact approved compiler, profile set and validation
    result. A caller cannot substitute an unbound semantic path.

Expected legal limits return typed results. They do not crash the run. Input,
identity, source-hash, authority and impossible-state defects stop the run.

## 8. M6 projection contract

M6 may:

- apply approved labels and field order;
- create compact and expanded layouts;
- group only when the family profile authorises grouping and M5 supplies the
  same proved equivalence signature;
- attach exact citations;
- route incomplete and ambiguous items to review; and
- record approved no-comparison items.

M6 must not:

- inspect source text to infer a topic;
- scan for an actor, timing or exception;
- humanise an internal claim key into supposed legal meaning;
- decide whether a fact is material;
- suppress a display-required fact; or
- declare that no fact was omitted without proof.

Projection must reconcile fact IDs. Every required fact must be shown or be
covered by an approved omission. M6 stops if either list contains an unmatched
fact.

M5 owns each **equivalence signature**, which is the structured list of terms
that must be identical before two rules can share a display group. It includes
actor or subject, legal effect, standard, threshold, timing, conditions and
qualifications. M6 may compare the signature only for exact equality under the
view policy. Linked child rules with different legal effects stay visibly
separate even when they share a source unit. A test containing two different
standards must prove that M6 keeps them separate.

The normal lawyer view follows Ben's hierarchy:

```text
Applies to: Company and its Subsidiaries
Provision type: MAE Definition
Sub-provision type: MAE Carve-out
Nested subtype: Change in Law
Included concepts: GAAP; applicable Law
Interpretations: Not expressly stated in the complete reviewed clause
Comparator: Participants of a similar size in the industry
Disproportionate-effect exception: Yes
Effect counted: Incremental disproportionate effect only
```

This is a typed comparison record. It is not an interpretation paragraph or a
compressed copy of the clause.

## 9. Implementation work order after adversarial approval

### Work 0: freeze failure evidence

- Keep the exact 50 review-item IDs, ordinals, source nodes and answers.
- Add a machine-readable repair disposition for each of the 38 affected items.
- Keep the 12 unqualified passes as fixed controls.
- Bind any implementation authority to this plan, the packet and the ledger.

### Work 1: write contract tests before implementation

- Add V2 rule, profile, provenance and coverage validators.
- Convert every substantive lawyer note into a focused expectation.
- Add negative fixtures for unmodelled provisos, broken references, missing
  parties, changed `and`/`or`, missing proof and wrong-topic heading matches.
- Prove that a whole-clause catch-all cannot satisfy a semantic field.
- Prove that the same flat facts with different `and`/`or` or exception scope
  produce different expression trees and rule identities.
- Prove that an exception attached to the wrong branch fails, and that
  earlier-of or later-of children cannot be reversed without a changed rule.
- Prove that a sourced qualifier cannot be omitted and relabelled
  `SOURCE_LIMITED`.
- Prove that a proviso cannot be hidden as structural text, a source artefact
  or non-material text without its exact approved rule.

### Work 2: deepen the shared M5 consolidation module

- Bound the candidate source set. In the original seven agreements, inspect
  only the source units already bound by the exact M4 claim, evidence and
  member ledgers. Account for every governed M4 identity exactly once. The
  repair must not create more unresolved source items than existed before. In
  the three later agreements, inspect only authored units recorded in the
  governed M7 cohort. “Source-first” means reading the exact text inside these
  approved units before trusting the old label. It does not mean scanning every
  M2 node for new candidates.
- Add only M3-proved chapeaux, definitions, references and party context.
- Enumerate independently operative legal effects in each bound unit.
- Give each derived rule exactly one approved subtype. Link disjoint effects
  and reject overlapping subtype matches for the same effect.
- Extract typed facts and the legal expression.
- Build source coverage.
- Resolve one owner and linked consumers.
- Validate and return the typed disposition.
- Make both the sealed-seven correction runner and additive-three M7 runner
  call this same `consolidateAnalysis` module.
- Bind each rule to the compiler ID, exact compiler code digest, profile ID,
  approved profile-set digest and validation-result ID. Bind those values in
  each successor receipt. Reject a stale, unbound or bypassed compiler or
  profile set.

Do not expose 25 family functions or parser helpers to callers. Family logic
stays behind the compiler interface.

### Work 3: repair by legal class

Repair one failure type through M5 extraction, M6 display and lawyer review.
Before accepting that repair, check every corpus row that the same rule could
change. Then move to the next failure type.

1. Nested conditions and provisos:
   `TERMINATION`, `NO_SHOP`, `CLOSING_CONDITIONS`, `PROXY_MEETING`,
   `SPECIFIC_PERFORMANCE_REMEDIES`, `TAX_MATTERS`, `TERMINATION_FEE`.
2. Definitions and carve-outs:
   `MAE_DEFINITION`, `KEY_DEFINED_TERMS`.
3. Parties, scope, materiality and linked duties:
   `REPRESENTATIONS`, `MATERIAL_CONTRACTS`, `INTERIM_OPERATING`,
   `DNO_INDEMNIFICATION`, `GUARANTY_FINANCING_PARTY`,
   `GENERAL_COVENANTS`.
4. Remaining families, source artefacts and approved no-comparison cases.
5. Governed M5 structure-disposition overlay for the sealed item 39 ambiguity.
   Preserve the M2 bytes and ambiguity record. Do not reparse raw source.

Begin with four archetypes:

- Termination, for nested conditions and exceptions;
- MAE, for hierarchy and carve-backs;
- D&O, for linked duties inside one source unit; and
- General Covenants, for topic classification and access-covenant scope.

Do not edit the sealed V1 profiles in place. Create V2 profiles. Ben must
approve the legal field contract for each subtype before that subtype can
produce a normal row.

### Work 4: make M6 a formatter

- Remove topic inference and source scanning from projection.
- Render the approved hierarchy and typed material facts.
- Add fact-level lineage.
- Compute omission counts from reconciliation. Do not hard-code zero.
- Show source-limited drafting clearly.
- Keep incomplete and ambiguous rules in the review lane.

### Work 5: replay the fixed 50

- Preserve all 50 source identities, order and corpus binding.
- Preserve sample membership through the fixed review-item ID and source
  identity. Map each old row to its successor rule. If the old family was
  wrong, record the family correction rather than requiring the old family to
  match.
- Re-review the 38 affected items.
- Re-run the 12 clean items as controls.
- Replace generic questions with subtype-specific field questions.
- Show each old answer beside the repaired result.

### Work 6: audit the whole affected corpus

- Check every row touched by a corrected rule, not only the sample.
- Recheck all 244 known-loss cases.
- Recheck all 69 historical limb cases.
- Recheck all 23 parser ambiguities.
- Run ten-agreement family calibration.
- Record every unfamiliar drafting pattern as complete, source-limited,
  incomplete, ambiguous or approved no-comparison.

### Work 7: adversarial and legal gates

- Fable reviews the proposed contracts and tries to produce false-complete
  results.
- Resolve every material adversarial finding.
- Ben reviews the changed legal results.
- Seal successor M5, M6 and M7 receipts only after both gates pass.
- Do not start M8.

## 10. Required focused acceptance cases

1. Review item 2 cannot be complete unless it records the condition links,
   cure alternatives, notice, both deadlines and Parent-breach proviso.
2. Review item 33 renders Ben's hierarchy and records GAAP, Law, a proved
   `SOURCE_NOT_EXPRESSLY_STATED` observation for interpretations, the peer
   comparison, the disproportionate-effect exception and incremental-effect
   treatment.
3. Review items 28 and 42 produce linked exculpation, indemnification,
   advancement and charter-continuation rules with exact scope and six-year
   duration.
4. Review item 44 records access scope, purpose, advance notice, normal business
   hours, reasonableness and non-interference.
5. The item 39 M5 overlay resolves nested `(i)` inside `(B)` only when M2
   parentage and ordered siblings yield one structure. A genuinely ambiguous
   repeated-marker fixture remains blocked.
6. Review item 41 returns approved `NO_COMPARISON`, never a silent omission.
7. A heading match with no operative-body match produces no normal rule.
8. A cross-reference keyword does not prove a legal topic.
9. A synthetic unmodelled material proviso blocks completeness and names its
   exact span.
10. A displayed fact without exact provenance fails projection.
11. A display-required fact missing from the row and omission ledger fails
    projection.
12. M6 produces the same output from the same AgreementAnalysis without
    reading raw source.
13. A stale or unbound compiler ID, code digest, profile ID, profile-set digest
    or validation result fails the M5 runner and successor receipt.

## 11. Final acceptance gate

M7 can pass only when:

- every one of the 31 incorrect decisions has an evidenced repair;
- all six substantive notes on correct cards have an evidenced repair;
- the page-number artefact is removed;
- the 12 clean controls do not regress;
- no normal row has the wrong family or subtype;
- no complete rule lacks a profile-required material field;
- no complete rule has an unmodelled material span;
- no displayed fact lacks exact provenance;
- every material fact is displayed or deliberately omitted under an approved
  rule;
- every governed sealed-seven M4 claim identity is accounted for exactly once,
  with no increase in unresolved source items compared with before;
- every additive-three candidate comes only from its governed recorded-input
  units;
- every no-comparison result has an approved reason;
- every source-limited result is explicit and lawyer-approved;
- the fixed 50 membership, source identities and order do not change;
- every affected cohort row is checked;
- all 25 families have approved V2 calibration or an approved no-output policy;
- every rule and receipt binds the exact compiler and approved profile set;
- Fable's material adversarial findings are closed;
- Ben gives legal sign-off;
- M0-M4 remain byte-identical;
- all external and product effects remain zero; and
- no M8 artefact exists.

## 12. Stop conditions

Stop the affected legal class if:

- no single approved subtype fits;
- a required field cannot be proved;
- a material source span remains unmodelled;
- a reference or definition needed for meaning is unresolved;
- a source-limited result lacks a lawyer ruling; or
- the proposed repair changes a clean control unexpectedly.

Stop the whole repair only if:

- an M0-M4 trust root changes;
- the fixed sample or corpus binding changes;
- the shared AgreementIndex or context contract is defective across families;
- an unauthorised effect occurs; or
- the repair would require M8.

## 13. Questions for Fable's adversarial review

Fable should try to disprove this plan, not polish it.

1. Can any catch-all source value still make an incomplete rule look complete?
2. Can a heading, cross-reference or first-in-document fallback still select
   the wrong topic?
3. Can the source-coverage test miss a material proviso or nested limb?
4. Can two profiles match and still produce a normal row?
5. Can `SOURCE_LIMITED` be abused to excuse extraction failure?
6. Can M6 omit a required fact while its reconciliation still passes?
7. Can one source fact be duplicated across families despite the owner rule?
8. Does the legal-expression model preserve the actual `and`, `or`, exception,
   earlier-of and later-of structure without becoming too broad?
9. Are the V2 profiles specific enough to prevent false completeness without
   creating an unmanageable subtype explosion?
10. Does any runner bypass the shared compiler?
11. Can the fixed 50 be silently remapped to easier source units or new rows?
12. Is there any path that changes M0-M4, serves data, calls a model or starts
    M8?
