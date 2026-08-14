# M7 core semantic repair plan

**Date:** 14 August 2026

**State:** Amended after Fable's adversarial review. The amendment-integrity
recheck completed. Fable then verified that all 22 plan dispositions are
genuine, subject to the two document-level conditions recorded in section 13.
This is not implementation acceptance. Awaiting Ben adoption and explicit
bootstrap and Work 1-7 authorities.

**Adversarial review:**
[M7-CORE-SEMANTIC-REPAIR-PLAN-ADVERSARIAL-REVIEW-2026-08-14.md](./M7-CORE-SEMANTIC-REPAIR-PLAN-ADVERSARIAL-REVIEW-2026-08-14.md),
commits `2766d56b` and `ce9ec3ac` on this branch.

**Programme boundary:** M0-M4 bytes remain fixed under their sealed receipts.
M8 stays locked. Current authority fixes model calls at zero through M9. This
document does not authorise implementation, model calls, database writes,
selector changes, serving changes, publication or any other external effect.

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

**Evidence root:** the first receipt for this repair. It fixes the failed
lawyer review, the exact 50 source identities, this adopted plan and the
bootstrap authority that permits Work 0.

**Bootstrap authority:** a narrow Ben-approved record that permits only Work
0. It binds the adopted plan and an already prepared, non-authoritative
manifest of the known evidence inputs. It names the intended evidence-root
path and schema but cannot bind a receipt that Work 0 has not yet created.

**Work 1-7 authority:** a separate Ben-approved record created only after Work
0 passes. It binds the completed evidence root and gives an exact file,
command and effect allow-list for the deterministic repair.

**Validator:** deterministic code that checks a proposed legal rule. A
validator never calls a model and never supplies missing legal meaning.

**Generator:** code that proposes a legal rule for validation. The authorised
M7 repair uses only deterministic generators. A possible model-assisted
generator is a separate, unauthorised experiment described in section 9.

**Reviewed source closure:** the complete governing authored unit, its
operative chapeau and every definition, reference and context edge needed to
decide one field.

**Superseded:** kept as historical evidence, but prohibited as an input to any
M7 V2 consumer or future serving path.

**M7 V2 repair:** the new shadow-only analysis, projection and receipt set
defined here. Its schema and file names use `STAGE_2Y_M7_V2_REPAIR`. Do not use
the generic word `successor` in code or paths because the repository already
has an unrelated `contracts/canonical-v2/successor/` tree.

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

This is the M7 V2 replacement for
`agreement-analysis-consolidation.js` and its existing
`consolidateAnalysis(baseAnalysis, approvedFamilyPackets)` contract. It
preserves every M4 claim identity, legacy state, evidence edge and dependency
edge, then adds V2 legal rules and validation. It never rewrites the sealed M4
AgreementAnalysis files.

In plain terms, M4 still produces the same sealed `AGREEMENT_ANALYSIS/V1` base
file. The new M5 module reads that base file and produces a separate proposed
`AGREEMENT_ANALYSIS/V2` file. The M7 V2 projector reads only that M5 V2
file. `AgreementAnalysisV2` in this plan means the new
`AGREEMENT_ANALYSIS/V2` schema, not a renamed M4 output.

The M5 correction and additive-three runners both call this one module. A later
product orchestrator may compose the public calls only under later authority.
This repair does not redefine the sealed M4 boundary.

`consolidateAnalysis` owns legal classification, extraction,
completeness, ambiguity, source limitations and approved no-comparison
decisions. `projectAgreement` owns labels, order, grouping and citations only.

Under current authority, compilation is deterministic. The same six bound
inputs, compiler bytes, profile set and structure-disposition set must produce
byte-identical V2 rules and identities on repeated runs. A clause that resists
deterministic compilation becomes `INCOMPLETE` or `AMBIGUOUS` and enters the
review lane. The compiler must not wait for or silently call a model.

Every V2 rule and receipt binds all six inputs to `consolidateAnalysis`:

1. the sealed M4 base analysis;
2. the sealed M2 AgreementIndex;
3. the sealed M3 ContextCompilation;
4. the approved family packets;
5. the approved V2 family-profile set; and
6. the approved structure-disposition set.

Each binding records path, schema, record ID where present, byte length and
SHA-256. Before a Work 2-6 run can create evidence used by a later gate, an
immutable `CANDIDATE_PENDING_REVIEW` registration must exist outside the
compiler. It binds the exact compiler, deterministic generator, validators,
runners, tests, all six input sets, profile set, structure-disposition set,
approved M6 view policy, predecessor receipts and allowed output root by path,
byte length and SHA-256.
Every Work 2-6 output and receipt binds that candidate-registration ID. A
change to any bound byte creates a new candidate-registration ID. The
compiler's own stamped digest is not proof. An independent verifier recomputes
the registered bytes before any receipt can pass.

The V1 analysis and 1,111-row projection remain historical evidence. They must
be registered as `FAILED_HUMAN_REVIEW_NOT_CONSUMABLE`. The M7 V2 projection
stage accepts only a fully bound `AGREEMENT_ANALYSIS/V2`. Any retained V1
runner is legacy-verification-only and cannot feed V2 or a future serving
path.

## 2. Verified but not yet sealed review result

The repair baseline is verified and fixed for planning. Do not resample it.
The completed decision ledger is not yet bound by a post-review receipt. Its
known hash is an observation, not implementation authority. Work 0 must create
the repair evidence root before any V2 run.

The combined ten-agreement corpus digest below is a governed corpus-state
binding. It is not a direct content hash of ten raw agreement files.

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

The adversarial review confirmed the packet, ledger and transcript content,
but found 22 material gaps in the first plan. Section 14 records how this
amendment closes or qualifies each finding.

## 3. Root causes

### 3.1 The corrected M5 path bypassed the approved family schemas

The repository contains 25 sealed files under
`evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/`.
The correction runner does not give those files to
`family-compound-adapter.js`. It calls `policyForFamily()` instead. That
function creates a much coarser policy with broad buckets such as actor,
timing and qualifications. It also manufactures its own approval markers,
instead of consuming a sealed authority record.

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
the family's rule. The run that produced the reviewed packet could use the
first authored unit when no child matched the family. Current code already
blocks the document-order fallback. The heading-only container fallback
remains and must be removed from the M7 V2 path.

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
closed structure-disposition overlay set. Each entry binds one sealed M2
ambiguity ID, source span and hash, a generic parent-scoping rule and version,
all materialised candidate trees, the chosen tree, technical review and any
required legal ruling. The set rejects unknown IDs, duplicate entries,
changed bytes and unregistered overlays.

This plan proposes only the item 39 entry. It applies a generic parent-scoping
rule to one ruled occurrence. It is not a source-specific parser exception.
The existing ledger records zero dependent propositions blocked for item 39,
so the overlay corrects the recorded M5 reading and review disposition. It
does not claim to restore an already blocked row. Any additional overlay needs
its own governed authority. A future M2 parser improvement requires separate
authority.

### 3.7 The lawyer question was too broad

Thirty-six cards asked the same question: whether the row preserved the
important legal meaning. Thirteen asked the same no-row question. This made Ben
reconstruct the expected field list himself.

The V2 review packet must retain the broad meaning question because it caught
wrong-family results. It must also ask whether the family and subtype are
right, then ask concrete questions based on the rule profile.
For example:

> Does this termination row identify the terminating party, the breached duty,
> the closing-condition effect, the cure alternatives, written notice, both
> deadlines and the proviso that removes the right?

## 4. Ben's sealed programme rulings

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

These are not prose-only conclusions. They are sealed in:

- `control/m5-programme-rulings.json`, SHA-256
  `2711dc5c958da271bfd86a154712c251978ac1f1aec713d22302946bf8f87497`,
  record ID
  `03198dab444302f28721f5553096154a294341e1bbd8f5999ff8c937b65afc2e`;
  and
- `receipts/stage-2y-structure-m5-schema-approval.json`, status `PASS`,
  lifecycle `SEALED`.

The sealed ruling for question 2 expressly records Ben's agreement after the
duplicate-storage clarification. No fresh confirmation is required. Work 0
must re-bind this existing record and map the 75 calibration-pack question
references to its three ruling IDs. It must not create a replacement ruling.

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

**Authored-unit effect ledger:** the source-first account made before rule
compilation. Every operative modal, enumerated limb and independently
operative effect maps to a proposed rule, an expression node, a dependency or
an exact lawyer-approved legal-text exclusion.

**Semantic fact key:** family-neutral identity for one legal fact. It combines
the agreement ID, canonical semantic type, normalised typed value, legal
subject, temporal and scope signature, governing source-support set and
legal-effect role. Display labels, family labels and consumer-reference spans
do not create identity.

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
  deterministic generator kind and code digest
  validator ID and exact code digest
  profile ID and approved profile-set digest
  six exact input bindings and predecessor receipt bindings
  structure-disposition-set digest
  validation-result ID

applies to
  proved party or parties

facts
  typed, labelled and source-proved values

legal expression
  canonical ordered tree under the versioned operator vocabulary

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

The minimum V2 operator vocabulary is:

`ALL_OF`, `ANY_OF`, `NOT`, `IF_THEN`, `EXCEPTION_TO`, `OVERRIDES`,
`DEEMS_AS`, `EARLIER_OF`, `LATER_OF`, `TO_EXTENT` and
`CONSEQUENCE_MODIFIER`.

Each operator has fixed arity, allowed child types, child order, precedence,
scope, connective provenance and canonical serialisation. A family profile
authorises the operator forms it can use. An unsupported relationship makes
the dependent rule `INCOMPLETE`. The compiler must not approximate it with a
different operator.

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

Each fact is atomic and typed. A semantic fact span must not contain an
unmodelled operative connective, proviso marker, enumeration boundary,
condition, exception, timing operator or threshold operator. Parties,
standards, thresholds, deadlines and periods use typed values, not quoted
blobs. Exact source text remains citation evidence. Neither a whole clause nor
a labelled sub-clause quote can satisfy completeness.

Rule identity includes the canonical expression and semantic fact keys. Two
runs over the same complete bound input set must produce byte-identical rules
and IDs. Near-duplicate clauses in different agreements need not share rule
IDs, because their agreement and provenance differ. Their corresponding
operator topology and comparison signatures must be comparable after
agreement-specific identity is removed.

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
- approved non-modelled span rules, each with an exact reason code. Purely
  technical spans cite a deterministic structural rule. Legal prose cites a
  specific Ben ruling;
- approved no-comparison rules; and
- the lawyer ruling that authorises each non-obvious choice.

Every profile also contains:

- positive real-clause fixtures;
- near-negative, wrong-family and wrong-subtype fixtures;
- the expected family and most-specific subtype for each fixture;
- every known relevant legal dimension found in calibration and adversarial
  fixtures;
- a finite declaration of relevant dimensions deliberately excluded or
  delegated;
- the exact owner link for each delegated dimension; and
- the Ben ruling for each legal-text exclusion, no-comparison rule or
  family-wide no-output rule.

Each family profile set owns exactly one digest-bound, versioned subtype-tree
declaration. Each subtype profile references that declaration's ID and digest.
The declaration names every known output-relevant subtype and parent-child
edge in the approved calibration and adversarial-fixture scope, marks each
node `ABSTRACT` or `TERMINAL_OUTPUT_PERMITTED`, and states whether the tree is
`TREE_OUTPUT_COMPLETE`. Conflicting, missing or stale profile references fail
the profile set. Any `GENERIC_LEVEL_OUTPUT_APPROVED` exception binds an exact
Ben ruling, profile-set version and covered occurrence class.

No profile may omit an express actor, subject, legal effect, operative object,
condition, exception, timing term, standard, threshold, materiality qualifier,
scope qualifier or definition or reference needed for meaning. This is the
cross-profile minimum legal floor. It does not require an impossible list of
every fact that any future clause might contain. It requires all known
dimensions in the approved calibration and adversarial fixtures.

Before subtype matching, the compiler builds the authored-unit effect ledger.
A deterministic profile cannot classify alphabetic legal prose, a scope
preamble or an operative limb as structural. Every non-modelled rule that
covers legal prose requires an exact Ben ruling. Pure whitespace, punctuation
and separately proved page-marker rules may use approved technical structural
rules.

An authored unit can yield more than one linked legal rule. Each derived legal
rule must match exactly one compatible profile. All 25 family-profile sets are
candidates for every bound authored unit. Deterministic pruning is allowed
only under an approved rule with negative tests.

Within one family, an ancestor and descendant resolve to the descendant only
when the descendant's own test passes. A generic ancestor can produce
`NORMAL` or `APPROVED_LIMITED` output only when either:

1. the exact approved profile-set version declares its governed subtype tree
   `TREE_OUTPUT_COMPLETE`, marks that ancestor `TERMINAL_OUTPUT_PERMITTED` and
   proves that no more-specific descendant matches; or
2. Ben expressly approves generic-level output for the named ancestor, exact
   profile-set version, covered occurrence class, legal reason, inclusion
   fixtures and exclusion fixtures under `GENERIC_LEVEL_OUTPUT_APPROVED`, and
   that ruling marks the named ancestor `TERMINAL_OUTPUT_PERMITTED` for only
   that covered occurrence class.

The presence or absence of registered child profiles is not proof. If neither
route passes, an ancestor-only match is `INCOMPLETE` and `REVIEW_ONLY`.
Matching siblings or overlapping families for the same effect are ambiguous.
Profiles for separate effects create linked child rules. A cross-family change
creates a typed `FAMILY_CORRECTION` with old family, new family, proof, rule ID
and lawyer ruling. The compiler must not take the first or only coarse profile
as proof of correctness.

One semantic fact has one owner. A consumer reference resolves to the owner's
source-support set and becomes a typed link, not a duplicate fact. Two facts
with the same number and source span remain separate if their legal-effect role
or scope differs. This preserves the distinct six-year D&O rights-survival and
no-adverse-amendment duties while letting a termination-fee rule link to the
owner of a referenced termination event.

Every `NO_COMPARISON` profile has positive and near-negative fixtures. Review
item 41 is the positive payment-administration occurrence. Item 15 is a
required negative fixture. A family-wide no-output policy names Ben as
approver, states the legal reason and binds the exact covered occurrence set.

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
  dimension, the complete reviewed source closure proves that result, and a
  lawyer approved that field-level finding.
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
- `NO_OUTPUT`: an approved occurrence-level suppression under a
  classification-only family policy. It remains in the disposition ledger and
  is not a no-comparison legal rule.

Every `NO_OUTPUT` record binds the governed input-occurrence ID, prior family,
reviewed source-closure digest, inspected candidate-set digest, result of
classification against all 25 family-profile sets, no-output policy ID and
version, exact reason, inclusion and exclusion tests, exact covered occurrence
set and Ben ruling. It also proves that no compatible cross-family comparison
rule matched. A cross-family `NORMAL` or `APPROVED_LIMITED` match takes
priority over the prior family's no-output policy. `NO_OUTPUT` cannot hide an
unclassified, incomplete or ambiguous occurrence.

This is how imperfect drafting can pass through the system without being
confused with failed extraction. An `APPROVED_LIMITED` result can appear only
with a typed `SOURCE_NOT_EXPRESSLY_STATED` observation. That observation binds
the expected field, complete reviewed source-closure digest, exact authored
unit, governing chapeau, dependency edges checked, profile requirement and
lawyer ruling. A reachable but unresolved dependency makes the field
`INCOMPLETE`; it can never support `SOURCE_LIMITED`. It is proof about the
reviewed source, not a negative legal fact inferred from silence.

Source limitation and market-statistics eligibility are per field. Exclude the
affected metric unless an approved policy says otherwise. Do not exclude an
otherwise complete row merely because one field is source-limited.

`DRAFTING_AMBIGUOUS` is always `REVIEW_ONLY` until a lawyer resolves the
competing readings. A resolved result receives a new source-quality state and
ruling. It does not remain drafting-ambiguous in a normal row.

The allowed combinations are:

| Extraction | Source | Extra authority | Output |
|---|---|---|---|
| `COMPLETE` | `SUFFICIENT` | Approved most-specific terminal profile; section 5 generic-ancestor gate where applicable | `NORMAL` |
| `COMPLETE` | `SOURCE_LIMITED` | Same profile gate; exact lawyer ruling and absence-proof record | `APPROVED_LIMITED` |
| `INCOMPLETE` | Any | Not applicable | `REVIEW_ONLY` |
| `AMBIGUOUS` | Any | Not applicable | `REVIEW_ONLY` |
| Any | `DRAFTING_AMBIGUOUS` | Unresolved | `REVIEW_ONLY` |
| `COMPLETE` | `SUFFICIENT` | Approved no-comparison profile | `NO_COMPARISON` |
| `COMPLETE` | `SUFFICIENT` | Approved occurrence-level no-output policy after all-family classification | `NO_OUTPUT` |

This lets genuine source limitations through after proof and legal approval.
It never lets failed extraction through as a normal comparison.

A stricter V2 run is expected to send many of the old 1,111 rows to
`REVIEW_ONLY`. That is an honest measurement, not a run failure or an
open-world increase. Each governed input occurrence must still receive one
M7 V2 disposition, and every linked rule must retain that input identity.

## 7. Completion invariants

M5 may return `COMPLETE` only when all of these tests pass:

1. The reviewed source closure is complete and digest-bound. It includes the
   governing authored unit, operative chapeau and every required definition,
   reference and context edge.
2. The exact inspected candidate set is digest-bound. A heading may locate a
   candidate. It cannot prove family, subtype, actor, condition, waiver or
   scope.
3. The authored-unit effect ledger accounts for every operative modal,
   enumerated limb and independently operative legal effect.
4. Each derived legal rule has exactly one most-specific approved subtype
   after all 25 family-profile sets are considered. Separate legal effects
   become linked rules. Overlapping matches for the same effect are ambiguous.
5. Every subtype-required field and every cross-profile minimum-floor field is
   present.
6. Every semantic fact is atomic, typed and exactly proven. No fact span hides
   an operative connective, condition, proviso, timing operator or threshold.
7. The rule preserves source connectives, nesting, priority and consequence
   modification under an approved canonical expression.
8. The governing legal text has a non-overlapping coverage partition after the
   approved whitespace and punctuation policy. Every span is one of:
   - a proved fact;
   - a logic connective;
   - a resolved dependency;
   - structural text under an exact deterministic profile rule;
   - a source artefact under an exact structural-policy rule or occurrence
     ruling; or
   - an exact approved legal-text exclusion under a specific lawyer ruling.
   Every non-modelled span carries its source span, reason code and authority
   ID. Free-form structural, artefact or non-material labels fail validation.
9. No material span is unmodelled.
10. Every required definition, reference and context edge is resolved. A
    reachable unresolved edge cannot support `SOURCE_LIMITED`.
11. Every semantic fact has one canonical owner or a validated link to its
    owner.
12. Every cross-family change has a typed, lawyer-ruled family correction.
13. Every no-comparison or no-output disposition has an inclusion test,
    exclusion test, covered occurrence set and Ben ruling. Every no-output
    occurrence has the full classification record defined in section 6 and
    cannot be relabelled as no-comparison or silently omitted.
14. The deterministic generator, compiler and validators pass independently.
15. The same complete bound inputs produce byte-identical rules and IDs on a
    repeated run.
16. The rule binds one immutable `CANDIDATE_PENDING_REVIEW` registration ID
    created outside the compiler. That registration binds the exact compiler,
    deterministic generator, validators, runners, tests, all six inputs,
    profile set, structure-disposition set, approved M6 view policy,
    predecessor receipts and allowed output root.
17. Every Work 2-6 output and receipt binds that same registration ID. A
    changed candidate-bound byte creates a new registration and invalidates
    the prior candidate's review evidence.
18. A dependency-light independent verifier recomputes every registered digest
    and rejects any missing, extra, stale or changed binding.
19. The result passes invariant validation before it leaves the module.

Expected legal limits return typed results. They do not crash the run. Input,
identity, source-hash, authority and impossible-state defects stop the run.

If a required context edge is not proved, M5 records
`CONTEXT_EDGE_UNPROVED`, names the proposed governing M2 node and keeps the
rule `REVIEW_ONLY`. It must not infer context from a heading or silently edit
M3. A later source-backed context-disposition record requires separate
authority, binds unchanged M2 and M3 inputs, exact proof and a lawyer ruling,
and lives outside the sealed M3 bytes.

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

Projection reconciles render bindings, not fact IDs alone. Each displayed
value binds:

```text
fact ID
field key
approved label ID
canonical typed-value digest
rendered-value digest
layout ID
```

Labels come only from the approved profile and view policy. M6 keeps the
canonical typed value beside its rendering and validates that rendering with
the deterministic formatter for that type. A truncated value or swapped
payer/payee or from-whom/to-whom label fails even when the fact ID is present.

Compact and expanded layouts have separate reconciliation and omission
ledgers. The compact layout always shows applies-to and the full classification
hierarchy. A material fact omitted from compact needs an approved
compact-omission entry and remains visible in expanded. Expanded shows every
display-required material fact unless a specific approved omission applies.

M5 owns each **equivalence signature**, which is the structured list of terms
that must be identical before two rules can share a display group. It includes
actor or subject, legal effect, standard, threshold, timing, conditions and
qualifications. M6 may compare the signature only for exact equality under the
view policy. Linked child rules with different legal effects stay visibly
separate even when they share a source unit. A test containing two different
standards must prove that M6 keeps them separate.

M6 V2 rejects V1 analysis and V1 rows. No active M7 V2 dispatch or future
serving path may consume the superseded 1,111-row output set.

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

## 9. Planned work and authority boundary

Neither this amended plan nor an adversarial `PASS` authorises implementation.
Authority has two non-circular steps.

Before Work 0, Ben must approve a machine-readable bootstrap authority. It
binds the adopted plan commit and an already prepared, non-authoritative
pre-Work-0 evidence-input manifest. That manifest binds the exact review
packet, decision ledger, sample policy, readable Q&A, adversarial review,
sealed programme rulings and M3/M4 trust-root receipts. The bootstrap authority
names the intended evidence-root path and schema. It does not bind the future
receipt's digest. It permits only the exact Work 0 paths, commands and local
effects that it lists.

Work 0 creates the evidence-root receipt. That receipt binds the bootstrap
authority by path, schema, record ID, byte length and SHA-256. After Work 0
passes, Ben must approve a separate Work 1-7 authority. The second authority
binds the completed evidence root and states the exact allowed paths, output
root, commands and effects for the deterministic repair. No Work 1 command or
write may occur before it exists.

The future Work 1-7 authority may allow branch-local code, test and script
changes in named paths; deterministic local tests and runs; and new V2 control,
shadow, review and receipt writes under one named governed output root. Commits
and push to the recovery branch are allowed only if listed. Both authorities
must continue to prohibit changes to sealed M0-M4 bytes, model calls, unbound
network reads, database writes, selector or serving changes, publication,
production data, M8 and M7 V2 consumption of V1 output.

An **external effect** is a model, network, database or third-party-system
action. A **product effect** changes selection, serving, publication or
production data. A named local shadow-evidence write is neither an external
effect nor a product effect only when the relevant authority's allow-list
expressly permits it.

### Work 0: freeze failure evidence

- Correct the stale current-authority summary in `OPERATING-RULES.md`. Cite
  Decision 19 and the sealed M3 and M4 receipts, record the failed M7 gate and
  keep M8 locked. Do not invent a new historical seal event.
- Create the repair evidence-root receipt before any V2 run. It binds the
  completed decision ledger, review packet, sample policy, adopted plan,
  readable Q&A transcript, adversarial review, sealed programme-ruling record,
  exact M3/M4 trust-root receipts, pre-Work-0 evidence-input manifest and
  bootstrap authority by path, schema, record ID, byte length and SHA-256.
- Record the failed gate and exact 38 repair / 12 control split. Every later
  receipt binds this evidence root.
- Stop after the evidence-root verifier passes. Obtain the separate Work 1-7
  authority before running Work 1.
- Create a fixed-sample identity manifest for all 50 items. Bind ordinal,
  review-item ID, agreement ID, item kind, source-node occurrence IDs or
  ambiguity ID, exact byte spans and slice hashes, and prior row ID where one
  exists. Any member change is `RESAMPLE_REQUIRES_NEW_AUTHORITY`.
- Create a separate repair-baseline ledger. Preserve each original decision
  enum and note. Derive repair membership from the Q&A section 4 repair-class
  table, not `decision === INCORRECT`. Flag items 2, 4 and 45 as contradictory
  or insufficient records requiring fresh Work 5 questions.
- Re-bind the existing sealed programme-ruling record and map all 75
  calibration-pack questions to its three ruling IDs.
- Register the complete 1,111-row V1 set and ledgers as
  `FAILED_HUMAN_REVIEW_NOT_CONSUMABLE`. Create a supersession ledger without
  deleting or rewriting the historical files. Hard-gate every active M7 V2
  dispatch against V1 input.

### Work 1: write contract tests before implementation

- Add dependency-light V2 rule, profile, provenance, candidate-set, source-
  closure, expression, ownership, rendering and coverage validators. They must
  run in a fresh checkout and in CI without loading the product UI.
- Convert every substantive lawyer note into a focused expectation. Add a
  broad legal-meaning question and a family/subtype question to every replay.
- Prove that whole-clause and sub-clause quoted blobs cannot satisfy a semantic
  field. Operative connectives, provisos, enumeration boundaries, conditions,
  timing and thresholds must be typed facts or expression nodes.
- Test item 2's exact tree: alternative cure branches under `ANY_OF`, its two
  deadlines under `EARLIER_OF`, written notice as a separate fact, and the
  Parent-breach proviso as `EXCEPTION_TO` scoped to the termination grant.
- Test item 23 as a three-effect unit. Test scope-limiting preambles such as
  `For purposes of this Agreement` and `For purposes of this Section only` as
  legal text, never generic structural text.
- Test item 31 conditional deeming, item 23 priority, items 33-36 and 47 scoped
  partial exceptions and consequence modification. Test item 6 as an
  `ALL_OF` between (a) an intentional-conduct branch using `ANY_OF` for an
  intentionally taken act or an intentionally omitted act, including the
  stated failure-to-cure scope, and (b) a knowledge-and-causation branch. In
  that branch, `ANY_OF` for knows or reasonably should have known scopes over
  `ANY_OF` for would cause or would reasonably be expected to cause a material
  breach. Bind every connective and scope edge to the source. A flat fact list,
  an `ANY_OF` at the root or reversed scope must fail.
- Prove that the same bound input run twice yields byte-identical rules. Prove
  that items 11/30 and the MAE near-duplicates have the same operator topology
  and comparable signatures after agreement-specific identity is removed.
- Prove that a sourced qualifier cannot be omitted and relabelled
  `SOURCE_LIMITED`; a reachable dependency such as item 9's defined match
  period must be inspected.
- Prove that an operative span cannot be hidden as structural, artefact,
  non-material or excluded legal text without its exact permitted rule and
  authority.
- Add profile positive, near-negative, wrong-family, wrong-subtype and
  declared-exclusion fixtures. Item 41 is the positive no-comparison fixture;
  item 15 is a required negative fixture.
- Add a rollout-window fixture in which a generic ancestor matches while a
  known subtype is not yet registered. It must remain `REVIEW_ONLY` unless the
  exact profile set is `TREE_OUTPUT_COMPLETE` for that scope and marks the
  ancestor `TERMINAL_OUTPUT_PERMITTED`, or carries exact Ben
  `GENERIC_LEVEL_OUTPUT_APPROVED` authority. Prove that an absent, false,
  stale or profile-digest-mismatched tree declaration, an abstract ancestor
  that has not been made terminal by the applicable ruling, and an uncovered
  Ben ruling each return `REVIEW_ONLY`. The absence of a child profile cannot
  produce a generic normal row.
- Add M6 truncation, label-swap, compact-floor and per-layout reconciliation
  negatives.
- Prove that every governed no-output occurrence receives the exact `NO_OUTPUT`
  record defined in section 6. It cannot disappear, inherit suppression from
  its old M4 family label or be relabelled `NO_COMPARISON`. A compatible
  cross-family normal match must defeat the old-family no-output policy.
- Assert the review packet's own coverage metadata, including grouped-row and
  linked-point counts.
- Prove that no V1 analysis or row can enter an M7 V2 consumer path.
- Prove that a missing, extra, stale or changed registration or six-input
  binding stops the run and M7 V2 receipt.

### Work 2: deepen the shared M5 consolidation module

- Bound the candidate source set. In the original seven agreements, inspect
  only the source units already bound by the exact M4 claim, evidence and
  member ledgers. In the three later agreements, inspect only authored units
  recorded in the governed M7 cohort. Bind the exact inspected candidate set
  and its digest. “Source-first” means reading exact text inside those approved
  units before trusting the old label. It does not mean scanning every M2 node
  for new candidates.
- Preserve the sealed-seven governed input-occurrence set exactly. Map every
  occurrence to one M7 V2 disposition. Report state transitions by family.
  `REVIEW_ONLY` may rise and does not count as a new source occurrence.
- Add only M3-proved chapeaux, definitions, references and party context. A
  heading proves none of those facts. Missing context returns
  `CONTEXT_EDGE_UNPROVED` with the proposed M2 source node. It does not create
  an M3 edge.
- Build the authored-unit effect ledger before subtype matching. Account for
  every modal, limb and independently operative effect.
- Consider all 25 profile sets. Link disjoint effects, reject overlapping
  matches for the same effect and require the most-specific proved subtype.
- Apply `NO_OUTPUT` only after classification against all 25 approved profile
  sets and the classification-only no-output policy. The old M4 family label
  is not suppression authority. A compatible cross-family comparison rule
  takes priority.
- Extract atomic typed facts, canonical expressions and the complete reviewed
  source closure.
- Resolve each semantic fact to one canonical owner and validate every linked
  consumer.
- Return typed dispositions, family corrections, issues and state transitions.
- Make both the sealed-seven correction runner and additive-three M7 runner
  call this same `consolidateAnalysis` module.
- Use deterministic compilation only. A resistant unit becomes review-only;
  it never triggers or waits for a model.
- Bind the compiler, deterministic generator, validators, all six input sets,
  profile set, structure-disposition set, approved M6 view policy, predecessor
  receipts and validation result under the immutable
  `CANDIDATE_PENDING_REVIEW` registration. Reject any unbound or bypassed path.
  Every Work 2-6 output binds its registration ID.

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
5. Closed M5 structure-disposition overlay set. Initially it contains only the
   sealed item 39 ambiguity. Materialise every candidate tree, apply the
   generic parent-scoping rule and preserve the M2 bytes and ambiguity record.
   Work 6 may inspect the other 22 ambiguities but cannot add overlays without
   their required authority.

Begin with four archetypes:

- Termination, for nested conditions and exceptions;
- MAE, for hierarchy and carve-backs;
- D&O, for linked duties inside one source unit; and
- General Covenants, for topic classification and access-covenant scope.

Do not edit the sealed V1 profiles in place. Create V2 profiles. Ben must
approve the legal field contract for each subtype before that subtype can
produce a normal row. Each approval includes the positive and negative
fixtures, captured dimensions, finite excluded-dimension declaration,
legal-text exclusions, no-comparison rules, family-correction rules and a
digest-bound subtype-tree declaration with node terminality for every
ancestor. A knowingly incomplete tree cannot emit generic-level normal output
without exact Ben approval for the profile-set version and covered occurrence
class that marks the named ancestor `TERMINAL_OUTPUT_PERMITTED` for that class.

Before building new termination-fee timing types, inspect and reuse the
graveyarded V3/V4 typed payment-timing schemas where they satisfy this V2
contract. Decision 18's correction of Decision 13 remains the authority:
exact source plus an approved role schema is the oracle.

### Work 4: make M6 a formatter

- Remove topic inference and source scanning from projection.
- Render the approved hierarchy and typed material facts.
- Add render bindings for fact ID, field key, approved label, canonical typed
  value, rendered value and layout.
- Compute compact and expanded omission ledgers separately. Do not hard-code
  zero.
- Enforce the compact floor and deterministic typed-value formatting.
- Show source-limited drafting clearly.
- Keep incomplete and ambiguous rules in the review lane.
- Reject any input other than a registered `AGREEMENT_ANALYSIS/V2` and prove
  that no V1 output can reach an M7 V2 consumer.

### Work 5: replay the fixed 50

- Bind the V2 review packet and decision ledger to the immutable
  `CANDIDATE_PENDING_REVIEW` registration ID and exact output set shown to Ben.
- Compare the replay field by field against the fixed-sample identity manifest.
  Fail on a missing, added, reordered or remapped item.
- Map each old item to its complete linked M7 V2 rule set, not one
  convenient child. Record every family correction and its legal ruling.
- Put all 50 V2 cards before Ben. Show the old card, enum and verbatim
  note beside the new result.
- Ask every item: `Is this the right family and subtype?`, `Does it preserve
  the important legal meaning?`, and each subtype-specific field question.
- Ask items 2, 4 and 45 afresh. Show item 4 with its operative chapeau. Do not
  silently reinterpret the original ledger.
- Show item 39's sealed parent reference `7.01(d)` and both materialised
  candidate trees.
- Show the complete reviewed source closure, including chapeau and required
  linked definition or reference text, for every source-limited decision.
- Treat the 12 clean items as lawyer-reviewed legal controls. Non-regression
  means the same source identity; same family and subtype unless Ben corrects
  it; `NORMAL` disposition; no correct meaning removed; no unsupported fact
  added; and no new unresolved material span. Richer V2 presentation is
  expected.

### Work 6: audit the whole affected corpus

- Bind the corpus audit and every audit output to the same
  `CANDIDATE_PENDING_REVIEW` registration ID used in Work 5.
- Check every row touched by a corrected rule, not only the sample.
- Recheck all 244 known-loss cases.
- Recheck all 69 historical limb cases.
- Recheck all 23 parser ambiguities. Report unresolved or uniquely resolved
  cases. Do not create an overlay without its required authority.
- Run ten-agreement family calibration. Report TopBuild separately because it
  had zero cards in the fixed human review despite the largest projection and
  known-loss contribution.
- Add additive-three calibration beyond the fixed 50 because that path has
  only one clean human-confirmed sample result.
- Record every unfamiliar drafting pattern as complete, source-limited,
  incomplete, ambiguous or approved no-comparison.
- Report, by family and agreement: input occurrences, normal rows,
  approved-limited rows, incomplete rows, ambiguous rows, no-comparison
  occurrences, no-output occurrences and linked consumers.
- Report the full old-to-new state transition matrix. A larger honest
  `REVIEW_ONLY` residue is expected and is not a gate failure.

### Work 7: adversarial and legal gates

- A dependency-light verifier independently recomputes the registered code,
  tests, all six input sets, profiles, structure dispositions and outputs. The
  compiler cannot attest its own authority.
- Fable reviews the proposed contracts and tries to produce false-complete,
  wrong-family, hidden-omission and V1-bypass results.
- Resolve every material adversarial finding.
- Ben reviews all 50 fixed cards, changed legal results, family corrections,
  legal-text exclusions, no-comparison tests, family-wide no-output policies
  and per-family disposition counts.
- Work 7 does not create or rewrite the candidate registration. The independent
  verifier proves that the proposed final candidate is byte-identical to the
  candidate registered for Work 5 and audited in Work 6. Technical and legal
  approval promote that same registration ID from `CANDIDATE_PENDING_REVIEW`
  to sealed.
- Any change to a candidate-bound byte after Work 5 begins invalidates the Work
  5 decisions, creates a new candidate-registration ID and reopens the full
  fixed-50 Work 5 review. If the change occurs after Work 6, rerun Work 6 for
  the new candidate before Work 7.
- Seal M7 V2 repair receipts only after both gates pass.
- Do not start M8.

### Deferred generator experiment, not authorised

Fable recommends a model-proposed, deterministically-verified generator. This
plan records that decision path but does not authorise a call. Current
programme authority fixes model calls at zero through M9. Before the first
experiment call, Ben must approve both (a) an explicit PLAN/Decision amendment
that creates a narrow experiment exception and (b) a separate model-experiment
authority. A work-order file alone cannot override the zero-model rule.

The all-50 experiment may start only after Work 1 validators pass and every
subtype required by the fixed 50 has a sealed V2 profile. Starting after only
the four archetype profiles would measure missing profiles rather than
generator quality.

If Ben later authorises the experiment, freeze before any call:

- model provider, model/version, prompt digest and tool policy;
- sampling settings or seed where available;
- exact input, profile and validator digests;
- call, cost and time ceilings;
- isolated output root and retention policy; and
- prohibited effects.

Run deterministic-only and model-proposed arms over all fixed 50 cards and the
adversarial negative fixtures. The 12 controls are needed to measure
degradation. Both arms use the same sealed profiles and deterministic
validators. Model identity and prompt digest enter each proposal's governance
block. Model output remains isolated and non-consumable
`MODEL_PROPOSAL_REVIEW_ONLY` even after a lawyer scores it. A lawyer's
experiment decision is an evaluation label, not a route to `NORMAL`. Span
verification proves source support; it does not prove that the model found
every effect or chose the right subtype.

Predeclare legal-completeness, classification, material-span omission,
validator-rejection, control-regression, review-time, proposal-convergence,
cost and latency measures. Repeat the model arm enough to measure convergence.
The fixed 50 is a diagnostic because it shaped the profiles. Runtime adoption
requires a separate blind sample, a new Ben adoption decision, a further
programme-rule amendment and a new runtime authority. Only that later adoption
can create a route from model proposals to consumable output. The model may
remain only a profile-design or review aid.

## 10. Required focused acceptance cases

1. Item 2 has separate condition links, cure branches, written notice and two
   typed deadlines. Its expression uses `ANY_OF`, `EARLIER_OF` and a
   Parent-breach `EXCEPTION_TO` scoped to the termination grant.
2. Item 33 renders Ben's hierarchy and records GAAP, Law, the peer comparator,
   disproportionate-effect exception and incremental-effect consequence. A
   per-field `SOURCE_NOT_EXPRESSLY_STATED` observation for interpretations
   binds the complete source closure and ruling.
3. Items 28 and 42 produce linked D&O rules. The identical six-year values for
   rights survival and no-adverse-amendment remain separate semantic facts.
4. Item 44 separately types access objects, purpose, notice, business-hours
   timing, reasonableness and non-interference.
5. The item 39 M5 overlay materialises both candidate trees and applies the
   generic parent-scoping rule. M2 bytes, parser and ambiguity record remain
   unchanged. A genuinely ambiguous repeated-marker fixture remains blocked.
6. Item 41 returns approved `NO_COMPARISON`; item 15 cannot match that profile.
7. Item 15's page-number span is covered by an approved `SOURCE_ARTEFACT`
   disposition without changing source bytes or offsets.
8. A heading match, heading-derived context or cross-reference keyword without
   operative proof produces no normal rule.
9. Item 23's effect ledger finds all three effects. A scope-limiting preamble
   cannot be labelled structural.
10. Item 31 uses conditional deeming. Items 33-36 and 47 preserve scoped
    partial exceptions and consequence modifiers. Item 6 uses the proved
    `ALL_OF(intentional-conduct, knowledge-and-causation)` root. Its two
    `ANY_OF` branches and the knowledge branch's scope over the causation
    branch have exact connective provenance. The same leaves under another
    topology fail.
11. Item 9 cannot be source-limited without inspecting its required defined
    match-period term.
12. Item 4 stays review-only when its governing chapeau is unproved. A heading
    cannot supply the missing context.
13. A whole-clause or sub-clause quote cannot satisfy a fact. A synthetic
    unmodelled material proviso blocks completeness and names its exact span.
14. A displayed fact without exact provenance fails projection. A changed,
    truncated or label-swapped value fails its render binding.
15. Compact output contains applies-to and full classification. Expanded
    output and both omission ledgers reconcile independently.
16. The same complete bound input run twice produces byte-identical rules and
    IDs. Near-duplicate clauses produce comparable topology and signatures.
17. Any missing, extra, stale or changed compiler, deterministic-generator,
    validator, six-input, profile, overlay or predecessor binding fails the
    runner and receipt under independent recomputation.
18. A changed inspected-candidate set or fixed-50 identity manifest fails.
19. A V1 analysis or row cannot enter any M7 V2 consumer path.
20. An old item with several legal effects maps to its full linked M7 V2
    rule set. A cross-family correction cannot become normal without its legal
    ruling.
21. Item 25 uses a consumer link to the owner of the termination event rather
    than creating a duplicate owner fact.
22. A missing context edge returns `CONTEXT_EDGE_UNPROVED` and review-only. It
    never causes silent M3 or heading-derived context.
23. Deterministic Work 0-7 performs zero model calls. A resistant clause goes
    to review-only.
24. The same V2 analysis and view policy produce byte-identical M6 output
    without reading raw source.
25. Every governed no-output occurrence has one exact `NO_OUTPUT` record after
    all-family classification. It cannot disappear, become `NO_COMPARISON` or
    suppress a compatible cross-family normal rule.
26. Work 5, Work 6, Work 7 and the final M7 V2 receipt bind the same
    candidate-registration ID. A one-byte candidate change creates a new ID,
    invalidates the prior review and reopens Work 5.
27. A generic ancestor cannot emit `NORMAL` or `APPROVED_LIMITED` during an
    incomplete subtype-tree rollout. It can do so only under
    `TREE_OUTPUT_COMPLETE` or exact `GENERIC_LEVEL_OUTPUT_APPROVED` authority
    that marks the named ancestor terminal for the covered occurrence class.

## 11. Final acceptance gate

M7 can pass only when:

- the bootstrap authority, pre-Work-0 evidence-input manifest, repair evidence
  root, separate Work 1-7 authority and independent verifier pass in that
  order, with no circular binding;
- the current authority summary cites the sealed M3/M4 receipts, Decision 19,
  the failed M7 gate and locked M8;
- the exact 50 identity manifest is unchanged and every replay member matches
  it field by field;
- all 38 repair-baseline items have an evidenced disposition, including all 31
  original incorrect enums and six substantive notes on correct cards;
- items 2, 4 and 45 have fresh answers with their record conflict visible;
- all 12 controls receive fresh Ben approval under the defined non-regression
  test;
- the candidate-registration ID bound by Work 5, Work 6, Work 7 and the final
  M7 V2 receipt is identical. Any candidate-bound byte change created a new
  registration and reopened Work 5 before approval;
- the page-number span is governed as `SOURCE_ARTEFACT`, absent from legal
  facts and display, and the sealed source bytes and offsets are unchanged;
- no normal row has the wrong family or subtype;
- no complete rule lacks a profile-required field or a cross-profile minimum-
  floor dimension;
- no complete rule has an unmodelled material span;
- no displayed fact has a missing, truncated, changed or wrongly labelled
  render binding;
- every material fact is displayed or deliberately omitted under an approved
  layout-specific rule;
- the sealed-seven input-occurrence set delta is zero and every occurrence maps
  to exactly one M7 V2 disposition, with linked rules retaining its
  identity;
- old-to-new state counts are reported by family; an honest rise in
  `REVIEW_ONLY` is accepted and never hidden as an open-world increase;
- every additive-three candidate comes only from its governed recorded-input
  units and the additive path has calibration beyond the fixed 50;
- TopBuild and every affected cohort row are explicitly checked;
- every no-comparison test has positive and negative fixtures and a Ben ruling;
- every family-wide no-output policy names Ben, states its reason and exact
  occurrence set, has inclusion and exclusion fixtures, and appears in the
  family disposition counts;
- every governed no-output occurrence has one full `NO_OUTPUT` record after
  all-family classification; none disappeared, became `NO_COMPARISON` or
  suppressed a compatible cross-family normal rule;
- every source-limited field is explicit, closure-bound and lawyer-approved;
- all 25 families have approved V2 classification profile sets. A family with
  intentionally suppressed occurrences also has an expressly Ben-approved
  classification-only no-output policy;
- every family profile set has a digest-bound subtype-tree declaration before
  use. Every generic normal or approved-limited result binds either the exact
  `TREE_OUTPUT_COMPLETE` declaration marking that ancestor
  `TERMINAL_OUTPUT_PERMITTED`, or exact Ben `GENERIC_LEVEL_OUTPUT_APPROVED`
  authority for its profile-set version and covered occurrence class that
  marks the named ancestor `TERMINAL_OUTPUT_PERMITTED` for that class. No
  incomplete tree emitted consumable output outside the exact class covered by
  `GENERIC_LEVEL_OUTPUT_APPROVED`, and no abstract ancestor emitted consumable
  output;
- every rule and receipt binds the immutable candidate-registration ID and its
  registered compiler, deterministic generator, validators, runners, tests,
  all six input sets, profile set, overlay set, approved M6 view policy,
  predecessor receipts and allowed output root;
- the same complete bound inputs reproduce byte-identical rules;
- the V1 output set is fully superseded and has zero active M7 V2 consumer
  routes;
- Fable's material adversarial findings are closed;
- Ben gives legal sign-off;
- the sealed M0-M4 trust-root bytes remain unchanged;
- deterministic Work 0-7 records zero model, database, selector, serving,
  publication and other prohibited effects; and
- no M8 artefact exists.

## 12. Stop conditions

An individual source unit becomes `REVIEW_ONLY`, without stopping unrelated
work, if:

- no single approved subtype fits;
- a required field cannot be proved;
- a material source span remains unmodelled;
- a reference, definition or context edge needed for meaning is unresolved;
- an operator needed for the legal relationship is unsupported; or
- a source-limited result lacks a lawyer ruling.

An **affected legal class** means one family, one most-specific subtype and one
profile version. Stop that class, but not all families, if a shared profile or
compiler defect is shown by any false-complete fixture, a clean-control
regression, or the same unhandled structural pattern in two governed
agreements. A source-specific drafting gap alone stays review-only. Do not
weaken the profile or call a model to clear the class stop.

Stop the whole repair only if:

- an M0-M4 trust root changes;
- the fixed sample or corpus binding changes;
- the shared AgreementIndex or context contract is defective across families;
- the evidence root, candidate registration or independent verifier fails;
- an unauthorised effect occurs; or
- the repair would require M8.

## 13. Fable's document-level adversarial review

The review instruction was to test only this amendment and try to disprove it,
not polish it. The review repeated the original attack routes, checked every
section 14 disposition and used these questions:

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
13. Can a compiler, runner or V1 path attest its own authority or avoid the
    independently registered six-input bindings?
14. Can effect enumeration, profile exclusions, no-comparison or no-output
    rules hide an operative limb?
15. Can a quoted blob, unsupported operator or wrong generic ancestor still
    produce a complete rule?
16. Can M6 display the wrong value or label while its layout reconciliation
    passes?
17. Can any of the 50 fixed identities or 12 controls change without a fresh
    lawyer decision?
18. Does deterministic Work 0-7 have any model-call route, and is the deferred
    experiment clearly outside current authority?

### Recorded document-level result

Fable verified all 22 dispositions in section 14 as genuine. Fable also
confirmed that the correction to F2 is accurate: the sealed programme-ruling
record already contains all three rulings and the Q2 clarification. This was a
review of the amended plan text, not an implementation, evidence or legal-
acceptance gate.

| Question | Result | Condition |
|---|---|---|
| 1-12 | Plan disposition verified | Attack the implemented candidate again in Work 7. |
| 13 | Closed at plan level | Registration continuity: any candidate-bound byte change after Work 5 creates a new registration and reopens Work 5. |
| 14 | Closed at plan level | Apply the stated effect-ledger and suppression controls. |
| 15 | Closed at plan level | The family subtype tree must be output-complete, or Ben must expressly approve generic-level output and terminality for the exact scope. |
| 16 | Closed at plan level | Apply render-binding validation. |
| 17 | Closed at plan level | Apply the fixed-sample and fresh-decision rules. |
| 18 | Closed at plan level | Keep Work 0-7 model-free and the experiment separately locked. |

This result does not adopt the plan, authorise Work 0 or Work 1-7, permit a
model call, start M8 or satisfy the future Work 7 gate.

## 14. Disposition of Fable's findings

Every material finding is accepted or qualified. None is ignored.

| Finding | Disposition | Plan closure |
|---|---|---|
| F1 | Accept | Work 0 creates the repair evidence root and fixed-sample manifest before V2 runs. |
| F2 | Qualify | The premise was incomplete. The three rulings already exist in a sealed record and receipt. Section 4 cites them; Work 0 re-binds rather than replaces them. |
| F3 | Accept | Sections 1, 7, 9 and 11 bind all six inputs plus code, profiles, overlays and predecessor receipts under independent recomputation. One immutable candidate-registration ID continues through Works 5-7 and the final receipt. |
| F4 | Qualify | Section 3.6 defines a closed overlay set and only item 39. The other 22 ambiguities may be inspected, not silently overlaid. |
| F5 | Accept | Work 0 supersedes the historical 1,111 rows; M6 V2 rejects V1 and no active M7 V2 route consumes it. |
| F6 | Qualify | Sealed M3/M4 receipts already exist. Work 0 corrects the stale authority summary and binds those receipts without inventing a new historical seal. |
| F7 | Qualify | The prior resample happened before the current answers. Work 0 now fixes every current member and source identity; any later change needs new authority. |
| F8 | Accept | Item 15 uses a non-mutating source-artefact disposition. Item 39 uses an M5 overlay and never changes M2. |
| F9 | Accept | Section 5.2 bans whole- and sub-clause blob facts and requires atomic typed values and expression nodes. |
| F10 | Accept | Section 5.3 adds the cross-profile legal floor, real positive/negative fixtures and approved exclusions. Work 5 keeps broad and classification questions. |
| F11 | Qualify | The effect ledger closes enumeration. Legal-prose exclusions need Ben rulings; whitespace, punctuation and proved page markers may use technical rules. |
| F12 | Accept | Source limitation is per field over a complete digest-bound source closure and all required dependencies. |
| F13 | Qualify | Missing context becomes `CONTEXT_EDGE_UNPROVED`. M3 stays sealed; any later context disposition needs separate authority. |
| F14 | Accept | The old unresolved-count limit is removed. Input occurrence identity stays fixed; review-only counts may rise and are reported. |
| F15 | Accept | All 25 families are candidates, compatibility is defined, and family corrections need legal rulings. Generic output also requires an output-complete subtype tree or exact Ben approval for its scope. |
| F16 | Accept | No-output is a distinct occurrence disposition after all-family classification. It has a full governed record, cannot replace no-comparison and cannot defeat a compatible cross-family normal rule. |
| F17 | Accept | Section 5.2 expands and versions the operator vocabulary and adds determinism and convergence tests. |
| F18 | Qualify | Section 5.2 defines a stronger family-neutral semantic fact key and validated ownership links. Existing sealed ruling 2 remains controlling. |
| F19 | Accept | Section 8 reconciles fact, typed value, approved label, rendered value and layout, with separate compact and expanded ledgers. |
| F20 | Accept | All 12 controls return to Ben with a precise non-regression test. |
| F21 | Accept | Work 0 preserves the original ledger and flags items 2, 4 and 45 for fresh questions in Work 5. |
| F22 | Accept | Section 9 uses a non-circular bootstrap authority for Work 0 and a separate evidence-root-bound authority for Work 1-7. Deterministic work stays model-free. Any experiment needs a PLAN/Decision exception and its own authority. |

The minor findings are also carried forward:

- Work 6 reports TopBuild separately and adds additive-three calibration.
- Work 1 verifies packet coverage metadata and provides a dependency-light CI
  verifier.
- Work 3 checks the graveyarded typed termination-fee timing schemas before
  building replacements.
- Work 0 and the final gate treat the combined corpus digest as a state binding,
  not ten raw-source hashes.
- Section 12 defines the affected-class stop.
- M7 V2 names avoid the unrelated `contracts/canonical-v2/successor/` tree.
- The V2 review packet shows item 39's parent reference `7.01(d)`.
- `PLAN.md` and its receipt table must be updated when Ben adopts the amended
  authorities. This plan amendment alone is not that adoption.
