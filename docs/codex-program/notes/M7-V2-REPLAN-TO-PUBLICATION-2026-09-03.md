# M7 V2 re-plan: from a fixture compiler to a working system, to publication

Date: 2026-09-03. Author: lead session (Fable 5.1). Revision 2, after two
independent adversarial reviews (fresh Fable sessions, lenses: false-
complete risk and feasibility; governance legality and legal-decision
boundary). Status: DRAFT for Ben. Nothing here is authorised. Every
decision is in section 8 as a question with options.

Inputs: the Work 5 blocking note
(`WORK5-BLOCKED-CANDIDATE-NOT-EXECUTABLE-ON-REAL-TEXT-2026-09-03.md`), an
eight-lens diagnosis of the V2 stack, ten deliveries from the external
agent on `ext/m7-verify-finding` (Q-0008 to Q-0017), and the two reviews.
Revision 2 changes from revision 1 are marked "R2" where the change is
material.

## 1. What is broken, in one page

The registered candidate `9a3ccbf7…` is a fixture compiler. It has never
processed a real agreement and cannot.

- **Generator** (`lib/canonical-v2/m7-v2-deterministic-generator.js`).
  Its only non-payload path parses a synthetic grammar. It demands one M4
  claim per M2 node (real agreements: 285 shared nodes across the ten).
  It hard-fails on zero profile matches and has no `REVIEW_ONLY` route.
  It derives the party from M3 `BOUND_ENTITY` relationships; the ten real
  M3 files contain none. It hard-codes the legal subject as COMPANY.
  Every compiled rule is COMPLETE / SUFFICIENT / NORMAL with one MODAL
  effect. Dependencies, ownership links, family corrections and shared
  coverages are always empty.
- **Profiles** (1,382). Clones of one template: two required fields, no
  conditional requirements, no child rules, SECTION as the only allowed
  source kind (real evidence sits on SECTION for 10 of 1,604 evidence
  edges). Match tests are synthetic marker tokens; 0 of 1,399 occur in
  any canonical text; all 3,246 fixtures are marker strings. What is real
  is the classification path (114 distinct subtype paths) and a per-
  occurrence signature that resolves, for 1,380 of 1,382, to a real
  clause with a verified byte span.
- **R2: the "1,380 Ben dispositions" are not per-occurrence judgements.**
  Every inventory disposition file was script-generated with
  `default_disposition_applied: true`: APPROVE 1,509, HOLD 40, PARTIAL 4.
  Revision 1 called them "your approvals"; that was wrong. Session 2 in
  this plan is the first per-occurrence approval.
- **Contract validator** (`m7-v2-contract.js`). Sound on the legal
  invariants and it carries Ben's sealed rulings. But: no review-residue
  treatment (an unmodelled material span fails hard); fixture-tuned
  parsers; the closure must equal one node's extent, so a limb whose
  party or modal lives in its parent can never be complete; the only
  party proof route needs context edges no real M3 supplies; fixtures
  carry no agreement binding, span or hash, so a "real" fixture is
  indistinguishable from a marker string; a NORMAL rule must reproduce
  one exact expression signature per profile, while real clauses under
  one subtype vary in topology.
- **Governance.** Works 2 to 4 record `semantic_runs: 0` by design; the
  Work 2 proof states are constants. The registration and verifier pin
  fixture counts. Evidence runs require a registered candidate; candidate
  change is forbidden without a new authority; no schema records a stop.
  The additive three agreements' M2/M3/M4 are not under any immutable
  prefix. A synthetic CAPITALISATION "validation package" satisfies the
  25-family rule today: the same false-complete pattern.
- **Data that exists and runs on real text.** M2, M3, M4 for all ten
  agreements with byte-exact provenance. M4: 2,101 claims, 1,526 with
  contract-bundle keys (82 numeric or date typed, 770 enum, 674
  presence); the 573 additive-three claims are untyped sentences. Sixteen
  deterministic value parsers and 38 resolver tables, all taking a quote
  string; nothing locates a quote inside clause text deterministically.
  Twenty-five real-text family regexes, measured on real agreements, in a
  V1 module the V2 candidate may not import. Termination's phase-2
  authority: 146 real-text-anchored typed atoms; phase 3: 220 reference
  values. M3 definition edges: 5,998 of 40,751 ambiguous; a preamble rule
  resolves most; 856 cases where deterministic rules disagree. M2 missed
  333 curly-quoted definitions corpus-wide, including `Parent` and
  `Merger Sub` in nine of ten preambles.
- **The fixed 50.** 12 capability groups; 11 items on two-claim nodes;
  13 inline limbs or chapeaux whose party or modal lives in a parent; 8
  representations needing the Article chapeau; 9 needing a definition or
  cross-reference; 6 needing a fact no producer emits (2, 7, 23, 24, 25,
  39); 2 with a page-number artefact inside the span (15, 47).
- **Publication.** Production serves V1; every V2 path is hard-off
  outside preview. One preview path runs the fixture compiler on a
  49-byte marker string under five real deal IDs.

## 2. What is kept

Work 0 evidence root, fixed-sample identity manifest, repair baseline
ledger, family packet set, calibration packs, the 25 sealed family role
schemas (as evidence; consumption as a V2 input needs Q12), the M5
programme rulings and every Ben ruling record. M2, M3, M4 for the ten
agreements, sealed. The contract validator's legal invariants and sealed
rulings. The projector, view-policy builder and projection validator. The
manifest chain, the Work 4 correction pattern, the Work 7 verifier, the
Work 6 report scripts. Termination's phase-2 atoms and phase-3 reference
values (reuse as fixtures needs Q17). The 1,380 occurrence-to-clause
anchors, as anchors only.

## 3. What is abandoned

The generator's synthetic grammar, party projection, COMPANY constant and
one-claim-per-node guard. The 1,382 marker matchers, all marker fixtures,
fixture proofs and dimension evidence: superseded, retained on disk,
never consumed again. The script-applied inventory dispositions, as
approvals. Every receipt proof state that was a constant. The synthetic
CAPITALISATION validation package. The synthetic preview serving path
(quarantined under Q9, outside the repair authority). GRAVEYARD.md and
CODEBASE-GUIDE.md entries for each, under the authority's core-document
regions (Q18).

## 4. The system that works

One deterministic pipeline per agreement, zero model calls, honest
residue.

1. **Governed occurrences.** The M4 claim set, unchanged. Claims sharing
   an M2 node form one authored unit; each claim is a rule linked to its
   siblings. Generator change; the validator already tolerates it. The
   contract test that requires a shared node to throw is retired in the
   same change.
2. **Source closure.** R2: the closure schema gains hash-bound context
   spans drawn from named ancestor nodes (parent chain to SECTION, the
   governing chapeau, the Article chapeau for representations), each with
   a provenance kind, admitted into matcher context and fact provenance.
   Without this the 13 limb items and 8 representation items can never
   be complete; the alternative, treating the enclosing node as the
   authored unit, is Q16. Definition and reference edges come from M3.
   Definition edges are resolved by rules 1 (Definitions article) and 2
   (preamble) only; rule 3 (nearest preceding) applies only when every
   candidate is the same term defined identically; otherwise
   `DEPENDENCY_UNRESOLVED`, review-only, both candidate spans recorded.
   The chosen rule id is recorded on every resolved dependency. The 16
   disagreement term classes go to Ben (Q13). Definition edges are
   projected as context edges (contract change).
3. **Family.** From the M4 claim key through the sealed role schemas'
   key-to-subtype mapping, consumed as a V2 semantic input with its own
   digest binding only after Ben adopts it (Q12); cross-checked by the 25
   family regexes copied into a candidate-bound `m7-v2-*` module with
   real positive and wrong-family fixtures, never imported from the V1
   module. Disagreement, or an unruled bridge, is `NO_SINGLE_PROFILE`,
   review-only. Occurrences with an unruled cross-family question (items
   14, 43) are `FAMILY_CORRECTION_PENDING`, review-only, counted
   separately.
4. **Subtype.** Profiles at subtype granularity, about 114. Each carries
   a real match test in the contract's existing vocabulary, the full
   section 5.3 contract (fields, cardinality, conditional requirements,
   logic forms, non-modelled span rules, excluded dimensions, tree
   terminality), allowed source kinds including LIMB and CHAPEAU, and
   fixtures that are real clauses. R2: the fixture schema gains an
   agreement binding, byte span and text hash, and the validator
   re-derives every fixture's text from sealed M2 bytes and fails on
   mismatch. Positives come only from anchors Ben confirms in session 2;
   HOLD and PARTIAL anchors are never positives. Signature policy per
   subtype is Q11.
5. **Effect ledger.** Modals, enumerated limbs and provisos found in the
   closure text (Q-0018 measures the vocabulary). Every entry maps to a
   rule, an expression node, a dependency or an approved exclusion; an
   unmapped material span is `MATERIAL_SPAN_UNMODELLED`, review-only,
   with its span. The effect kind for definitional and representational
   units and for provisos is Q10; until ruled, those units are review-
   only. Every M2 `PAGE_NUMBER` artefact inside a closure receives a
   `SOURCE_ARTEFACT` coverage entry under one structural rule (Q15).
6. **Facts.** R2: a deterministic quote locator (closure text to
   candidate quote, with span and an ABSTAIN outcome) feeds the sixteen
   parsers and the resolver tables. A claim with no located quote is a
   typed review issue, never a fact. Parties: a `PARTY_PROOF_RULE/V1`
   proof route in the contract, over a context-disposition record that
   lives outside sealed M3 at
   `control/m7-v2-repair-contract-party-context-dispositions.json`,
   created under the replacement authority, one row per agreement and
   party term with a Ben-confirmed span (Q3). Every APPLIES_TO fact's
   source support lies inside its closure; a rule whose closure words do
   not name the party is `CONTEXT_EDGE_UNPROVED`. The COMPANY constant is
   deleted.
7. **Expressions and dispositions.** The operator table Ben rules on
   (Q5); the plan's state table; review-only as the default. The contract
   gains a `REVIEW_RESIDUE` coverage treatment allowed only on review-
   only rules, and the issue codes `MATERIAL_SPAN_UNMODELLED`,
   `DEPENDENCY_UNRESOLVED`, `PARTY_PROOF_UNPROVED`, `SIGNATURE_MISMATCH`,
   `FAMILY_CORRECTION_PENDING`.
8. **Projection.** Existing projector and view policy, regenerated.

**The false-complete guard** (R2, tightened). A work receipt passes only
if:

- it binds one `AGREEMENT_ANALYSIS/V2` per member of the sealed Work 3
  sets, pinned by their record IDs (agreement-analysis set `c45e08bd…`,
  the index set, the context set), never by count;
- each analysis passes `validateAnalysisV2` with the Work 7 verifier's
  repository-tree resolver, the only resolver a receipt may cite;
- each analysis's `governed_input_occurrence_ids` equals that
  agreement's M4 claim set and every closure and context span hash-
  verifies against sealed M2 bytes;
- the receipt binds a per-occurrence attempt record (family-bridge
  result, subtype candidates, ledger entries found, parser hit or abstain
  per claim, party candidates with spans, resolution rule ids), which the
  external agent recomputes independently, so a blanket review-only route
  is distinguishable from a measured one;
- the receipt binds the per-family count report, broken down by reason
  code, as a committed artefact;
- register-candidate declares counts computed from bound bytes and
  verify-candidate independently recounts them from the bytes and fails
  on mismatch;
- the finaliser's tests are behavioural: on a temporary tree with one
  analysis missing, malformed or carrying a changed occurrence set, the
  receipt records FAIL naming that agreement.

A synthetic text cannot satisfy this: the registration binds the sealed
M2, M3 and M4 sets by hash and record ID.

## 5. Phases, gates, owners

Ranges are estimates from the diagnosis. The first real-agreement proof
stays at two weeks, re-scoped honestly (R2): it is an issue-only run.

### Phase 0. Authority, stop record, governance (week 1)

- **Ben**: decision session 1 (section 8, Q1 to Q18 minus the profile
  items). One replacement authority,
  `control/m7-v2-repair-contract-candidate-replacement-authority.json`,
  that: records the `FALSE_COMPLETE_FIXTURE` stop (candidate
  `9a3ccbf7…`, 24 families, the Work 5 note bound by hash) in a stop-
  record member validated by the manifest validator; retains every Work
  2 to 4 output immutable; supersedes, for this replacement only, the
  ordering fields `before_work2_6_gate_evidence`,
  `work2_candidate_state`, `work3_candidate_state` and
  `first_candidate_stage`; authorises one interim `CANDIDATE_PENDING_
  REVIEW` registration before every evidence run (at least three,
  retained, each superseding the last; Work 5 to 7 bind the last);
  enumerates, per phase, the successor manifest path, receipt path and
  schema, transition authority path, entrypoints and tests by exact path,
  argv with finite run limits, commit message and push count, on the
  Work 4 correction template, with receipt names inside the parent's
  prefix rule (`work2-…`, `work3-…`, `work4-…` successor names);
  re-grants the Work 1 write exceptions for `register-candidate.mjs`,
  `verify-candidate.mjs` and `registration.test.js`; adds an import-
  closure binding to the registration schema; adds the three additive
  agreements' `m2`, `m3`, `m4` directories under
  `shadow/m7-generalisation-comparison-entry-correction/` to
  `immutable_prefixes` and extends `M0_M4_TRUST_ROOT_DRIFT` to them;
  names the party and definition context-disposition record paths and
  schemas; names the core-document regions for GRAVEYARD, CODEBASE-GUIDE
  and the DECISIONS entry (Q18); makes the guard a stop condition for
  every later work.
- **lead**: draft the authority; the operator table (Q5); the per-
  agreement party tables from Q-0015 and Q-0017 for Q3; the 16 term-
  class rows from Q-0016 for Q13; register and verify count recount.
- **ext**: Q-0018, Q-0019 (preconditions for Phase 1 day 3), then
  cross-vendor recomputation of the Phase 1 attempt records.
- **Ben, outside the repair authority**: the synthetic serving-path
  quarantine as a product-code PR on his instruction (Q9); it is a
  merge precondition (section 10, node 12), not a repair step.
- Exit gate: authority committed and validated; every write path in
  Phases 1 to 3 named in it and accepted by the manifest validator;
  recovery CI green.

### Phase 1. First slice: ten agreements compile as an issue-only run (weeks 1–2)

R2 scope: interim registration; governed occurrence grouping; hash-bound
closures with the ancestor-context extension; `REVIEW_RESIDUE` and the
issue codes; review-only routing; the attempt record; definition-edge
projection with rules 1 and 2. The existing profile set is bound as a
measurement-only input; the expected result is every occurrence
`NO_SINGLE_PROFILE`, review-only. Ledger, facts, parties and subtype
matching move to Phase 2 with the profile set, because a validated rule
needs a Ben-approved profile and a fact needs an owning rule; before
session 2 there is neither.

- **lead**: the above, for all ten agreements; the retired shared-node
  throw and the 41 synthetic acceptance scenarios re-authored on real
  inputs as they are touched.
- **ext**: recompute every attempt record from the output files;
  report disagreements.
- Proof: the enumerated run command writes ten `AGREEMENT_ANALYSIS/V2`
  files that pass the guard; the report states, per Red Hat item, which
  of the 24 are structurally reachable after the closure extension and
  which are not.
- Exit gate: the Work 2 successor receipt passes the guard for all ten
  agreements. This proves grouping, closures and honest routing on real
  text. It does not prove extraction, and section 9 says so.

Q1a offers a faster path: a first tranche of Ben's profile session for
the families Red Hat's 24 items touch, before the Phase 1 exit, so the
first run can show NORMAL rows where the profile is approved.

### Phase 2. Extraction, profiles, Ben's profile session (weeks 3–6)

- **lead**: effect ledger; quote locator, parsers and resolver facts;
  party route and record; subtype profiles (about 114) drafted with the
  full section 5.3 contract and real hash-bound fixtures; the family
  regex module; interim registration; ten-agreement run under the guard
  with the report broken down by reason code, `SIGNATURE_MISMATCH`
  visible.
- **ext**: fixture packs from anchors (positives only from session-2
  confirmations; HOLD and PARTIAL as near-negatives only after Ben
  rules); cross-vendor check of the party rule and definition chain
  outputs on the ten agreements.
- **Ben**: session 2, per family, real clause beside each subtype: the
  full section 5.3 contract per subtype, the signature policy (Q11), the
  no-comparison profiles, exclusions, family-wide no-output policies
  (CAPITALISATION under Q6), the Termination atoms (Q17). R2: session 2
  precedes sealing. Order: draft packages, session 2, seal, Work 3
  successor receipt.
- Exit gate: every fixture hash-verified by the validator; the receipt
  binds the session-2 record; subtype-path agreement against session-2
  labels reported after the session, never before.

### Phase 3. Candidate, Work 5, 6, 7 (weeks 6–10, one reopen loop budgeted)

- **lead**: Work 4 successor (projector reconciliation, view policy);
  final registration; verifier rerun; Work 5 replay of the fixed 50 with
  the V2 packet (old card, enum, verbatim note beside the new result;
  items 2, 4, 45 afresh; item 39 both trees; item 4 with chapeau; full
  closures for source-limited decisions).
- **ext**: render the packet; rebind and rerun the nine Work 6 reports;
  rerun the Work 7 verifier.
- **Ben**: session 3, all 50 and the 12 controls, plus items 14 and 43
  (Q8); session 4, sign-off after the Work 7 adversarial review, which is
  a fresh session that wrote neither the candidate nor this plan.
- R2: any correction from session 3 or the review is batched into one
  new registration, one full reopen of all 50 and a Work 6 rerun (Q14).
  One such loop is in the estimate.
- Exit gate: Work 5, 6, 7 receipts bind one identical registration ID;
  the M7 V2 repair receipt seals.

### Phase 4. To users (after M7)

M9 certification, M10 private activation (Decision 22, re-confirmed under
Q10), Product Stages 3 to 9, merge of the recovery branch through
`codex/stage-2y-structure-m2` to `main` with the quarantine test as a
precondition, the production runtime gate change under Ben's one-use
authority, V2 rows beside V1 per family. No artefact exists for any of
these today.

## 6. External agent work

In flight: Q-0018, Q-0019. Next: attempt-record recomputation (Phase 1);
fixture packs; cross-vendor check of the party rule and definition chain;
Work 5 renderer; Work 6 rebind and rerun; Work 7 verifier rerun. The
external agent never writes candidate-bound bytes and never answers a
legal question.

## 7. Risks, stated plainly

- Phase 1 is an issue-only run by construction. It proves plumbing and
  honesty, not extraction. Anyone reading its receipt as "V2 works" is
  wrong, and the receipt says so.
- The party rule and definition chain are deterministic heuristics over
  sealed M2 with a known annotation gap. Each applies only where Ben has
  confirmed the span or term class; otherwise the occurrence stays
  review-only.
- The additive three have no typed M4 values; parser-only facts; more
  review-only there.
- Real clauses under one subtype vary in topology. Until Q11 is ruled,
  many matched rules will be `SIGNATURE_MISMATCH`, review-only, and
  visible as such.
- A correction after session 3 reopens all 50. One loop is budgeted; a
  second is not.
- Ben's load: session 1 (governance and rules, section 8), session 2
  (profiles, the heaviest), session 3 (fixed 50), session 4 (sign-off).
- Ranges are estimates; Phase 2 is the least certain.

## 8. Decisions for Ben

Session 1 unless marked S2. Recommendation in brackets.

Q1. Record the finding as a `FALSE_COMPLETE_FIXTURE` affected-class stop
for 24 classes under one replacement authority [yes]; or treat the
constant proof states as `EVIDENCE_ROOT_OR_REGISTRATION_OR_VERIFIER_
FAILURE`, a whole-repair stop with re-planning from Work 3. Q1a: allow a
first-tranche profile session for Red Hat's families before the Phase 1
exit, so the first run shows some NORMAL rows [no; keep Phase 1 honest
and cheap, do session 2 once].

Q2. Interim registrations: authorise one `CANDIDATE_PENDING_REVIEW`
registration before every evidence run, retained and superseded, Work 5
to 7 binding the last [yes]. And: the 1,553 script-applied inventory
dispositions are void as V2 approvals; session 2 is the first per-
occurrence approval and approves the full section 5.3 contract per
subtype, not labels only [yes].

Q3. Party proof: (a) a `PARTY_PROOF_RULE/V1` route over a context-
disposition record outside sealed M3, one row per agreement and party
term, each span confirmed by you from the ten party tables (about 30
rows) [yes]; (b) re-run M2, which is `M0_M4_TRUST_ROOT_DRIFT`, a whole-
repair stop that ends this repair; (c) parties review-only everywhere.

Q4. `REVIEW_RESIDUE` coverage treatment on review-only rules only, plus
the five issue codes in section 4 [yes].

Q5. Operators: rule on the attached table, one row per operator (arity,
child types, precedence, scope, serialisation, one real-clause example),
not on the list [table in Phase 0].

Q6. CAPITALISATION: (a) you issue a family-wide no-output policy with
legal reason, covered occurrence set and fixtures; the synthetic
validation package is removed; item 14 routes under Q8 or stays review-
only with that reason on its card [yes]; (b) author the package in
Phase 2.

Q7. Additive three: parser-only facts, larger review-only residue, no
model calls [yes].

Q8. Items 14 and 43: cross-family owner decided in session 3 with both
readings shown; review-only `FAMILY_CORRECTION_PENDING` until then [yes].

Q9. Quarantine the synthetic preview serving path as a product-code PR
on your instruction, outside the repair authority, before any merge
[yes].

Q10. Re-confirm Decision 22's M9 and M10 pre-authorisation at M7 sealing
[yes].

Q11 (S2). Signature policy per subtype: one required signature; a child
profile per topology; or a signature family [child profile per topology
where the anchors show more than one; the report shows the count].

Q12. Adopt the sealed role schemas' claim-key-to-subtype mapping as a V2
semantic input for the family stage, digest-bound, despite its V1-
evidence-only status today [yes]; else family assignment is review-only.

Q13. Definition resolution: rules 1 and 2 deterministic; rule 3 only for
identical candidates; otherwise review-only until you rule the 16
disagreement term classes (attached from Q-0016) [yes].

Q14. Any correction from session 3 or the Work 7 review is batched into
one new registration and a full reopen of all 50 with a Work 6 rerun,
never per-item patching [yes].

Q15. One structural rule covers every M2 `PAGE_NUMBER` artefact inside a
closure (items 15 and 47) as technical, needing no per-occurrence ruling
[yes].

Q16. Authored unit for an inline limb or chapeau: the limb with hash-
bound context spans from named ancestors [yes]; or the enclosing node.

Q17 (S2). Termination's 146 phase-2 atoms and 11 expression trees,
approved as synthetic components: acceptable as real-clause fixtures for
Termination profiles, or re-presented in session 2 [re-present; they are
real text, the approval was not].

Q18. Records: your answers as DECISIONS.md entry 26, written on your
direct instruction outside the repair authority; the stop record inside
the replacement authority; GRAVEYARD and CODEBASE-GUIDE regions named in
it [yes].

Q19 (S2). Effect kind for definitional and representational units with
no modal or enumerated limb, and for provisos: review-only by default,
or a ruled `DEFINITIONAL` / `REPRESENTATIONAL` effect kind [rule the
kinds in session 2 with examples; review-only until then].

## 9. First two weeks

Days 1–2: session 1; authority drafted, validated, committed; DECISIONS
entry 26 on your instruction; register and verify recount; quarantine PR
opened outside the authority. Day 3 precondition: Q-0018 and Q-0019
delivered; if not, Phase 1 proceeds on the issue-only basis regardless.
Days 3–9: interim registration; grouping; closure extension; residue and
issue codes; routing; attempt record; rules 1 and 2. Days 10–12: all ten
agreements; external recomputation. Days 13–14: Work 2 successor receipt
under the guard; Phase 1 exit; this plan re-read against what the run
showed. Phase 1 proves grouping, closures and honest routing on real
text. It does not prove extraction.

## 10. Dependency graph to publication

1. Replacement authority, stop record, DECISIONS entry (Ben, lead).
2. Governance: unpinning by recount, import-closure binding, enumerated
   paths, immutable prefixes for the additive three (lead).
3. Interim registration 1 (lead; ext verifier).
4. Ten agreements compile as an issue-only run; Work 2 successor receipt
   under the guard (lead; ext recompute).
5. Extraction: ledger, facts, party route, definition chain (lead; ext
   cross-vendor check).
6. Subtype profiles drafted with real fixtures; Ben session 2; seal;
   Work 3 successor receipt (lead, ext, Ben).
7. Interim registration 2; ten-agreement run with reason-code report
   (lead).
8. Work 4 successor; final registration; verifier (lead, ext).
9. Work 5 packet; Ben session 3 (lead, ext, Ben).
10. Work 6 rebind and rerun (ext). Depends on 8, parallel with 9.
11. Work 7: verifier, fresh-session adversarial review, Ben session 4;
    one correction loop if needed (Q14); M7 V2 receipt sealed.
12. Quarantine PR merged; recovery branch merged to
    `codex/stage-2y-structure-m2`, then `main`; evidence gates (lead,
    CI, Ben for the PR).
13. M9 certification; M10 private activation (lead; Ben confirms Q10).
14. Product Stages 3 to 9 (lead; Ben at each named confirmation).
15. Production runtime gate change under one-use authority; V2 beside V1
    per family (Ben, lead).
16. Published to users (Ben's go-live call).
