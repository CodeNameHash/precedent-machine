# M7 V2 re-plan: from a fixture compiler to a working system, to publication

Date: 2026-09-03. Author: lead session (Fable 5.1). Status: DRAFT for Ben.
Nothing here is authorised. Every decision is listed in section 8 as a
question with options.

Inputs: the Work 5 blocking note
(`WORK5-BLOCKED-CANDIDATE-NOT-EXECUTABLE-ON-REAL-TEXT-2026-09-03.md`), an
eight-lens diagnosis of the V2 stack run today (generator and compiler,
profiles and matchers, contract validator, existing real-text capability,
family authoring pipeline, governance and gates, the fixed 50 as target,
the publication path), and eight independent deliveries from the external
agent on `ext/m7-verify-finding` (Q-0008 to Q-0015: defect verification,
capability inventory, profile anchor table, fixed-50 typed coverage,
source closures, synthetic serving path, definition resolution, party
identity). Every number below traces to one of those.

## 1. What is broken, in one page

The registered candidate `9a3ccbf7…` is a fixture compiler. It has never
processed a real agreement and cannot.

- **Generator** (`lib/canonical-v2/m7-v2-deterministic-generator.js`).
  Its only non-payload path parses a synthetic grammar
  (`shall <A> and <B> <family-token> <sig-token> all_of`). It demands one
  M4 claim per M2 node (real agreements: 285 shared nodes across the ten).
  It hard-fails on zero profile matches; it has no `REVIEW_ONLY` route at
  all (grep count 0). It derives the party from M3 `BOUND_ENTITY`
  relationships; the ten real M3 files contain none (51 relationships,
  all CONTROLS, SUBSIDIARY_OF, CAUSES_TO_PERFORM). Every compiled rule is
  hard-coded COMPLETE / SUFFICIENT / NORMAL with one MODAL effect.
  Dependencies, ownership links, family corrections and shared coverages
  are always empty. Sections 5.2, 6 and 7 of the adopted plan have no
  implementation.
- **Profiles** (1,382, "Ben-approved"). All are clones of one template:
  two required fields (LEGAL_EFFECT, APPLIES_TO), no conditional
  requirements, no child rules, `SECTION` as the only allowed source kind
  (real evidence sits on SECTION for 10 of 1,604 sealed evidence edges).
  Their match tests are synthetic marker tokens; 0 of 1,399 tokens occur
  in any canonical text. All 3,246 fixtures are marker strings. What is
  real in each profile is its classification path (114 distinct subtype
  paths) and a per-occurrence signature that resolves, for 1,380 of
  1,382, to a real clause with a verified byte span.
- **Contract validator** (`m7-v2-contract.js`). Sound on the legal
  invariants and it does carry Ben's sealed rulings. But it has no
  review-residue treatment (an unmodelled material span fails hard
  instead of routing to `REVIEW_ONLY`), its parsers are fixture-tuned
  (number words zero to ten, ISO dates only, no Business Days), and 1,380
  of 1,382 approved signatures are unreachable through it.
- **Governance.** Works 2, 3 and 4 record `semantic_runs: 0` by design.
  The Work 2 proof states are literal constants. The registration,
  verifier and manifest validator pin fixture-derived counts (1,382
  profiles, 24 packages, 53 paths, an eight-test roster). Candidate change
  is forbidden without a new authority. No schema defines how a stop
  condition is recorded.
- **Data the plan needs but nobody wired.** M2, M3 and M4 exist for all
  ten agreements with byte-exact provenance. M4 holds 2,101 claims; 1,526
  carry contract-bundle keys (82 numeric or date typed, 770 enum, 674
  presence); the 573 additive-three claims are untyped sentences. Sixteen
  deterministic value parsers and 38 resolver tables exist in
  `lib/canonical-v2/native-producer/`. Twenty-five real-text family
  regexes (`m7-deterministic-generalisation.js`) were measured on real
  agreements and are absent from the repair plan. Termination's phase-2
  authority carries 146 real-text-anchored typed atoms and phase 3
  materialised 220 reference values. M3 definition edges are 15%
  ambiguous, 43 of the 47 fixed-50 cases being a party term defined in
  the preamble and again in the body. M2 mostly failed to annotate
  `Parent` and `Merger Sub` because preambles use curly quotes. M0–M4
  bytes are sealed.
- **The fixed 50.** 12 capability groups. 11 items sit on two-claim
  nodes. 13 are inline limbs or chapeaux whose party or modal lives in a
  parent node. 9 need a definition or cross-reference resolved. 6 need a
  fact no producer emits (items 2, 7, 23, 24, 25, 39). 41 are coverable
  from words M4 already holds, which is not the same as a producer
  emitting the fact.
- **Publication.** Production serves V1 for all ten agreements; every V2
  path is hard-off outside Vercel preview. One preview path
  (`termination-rights-review-serving-source.js`) runs the fixture
  compiler on a 49-byte marker string and maps the result onto five real
  deal IDs. After M7 there are M9, M10 and Product Stages 3 to 9 before
  users see a row, with zero artefacts for any of them today.

## 2. What is kept

- Work 0 evidence root, the fixed-sample identity manifest, the repair
  baseline ledger, the family packet set, the calibration packs, the 25
  sealed family role schemas, the M5 programme rulings and every Ben
  ruling record. Unchanged.
- M2, M3, M4 for the ten agreements. Sealed, consumed as-is.
- The contract validator's legal invariants and sealed rulings (items 15,
  28, 39, 41, 42, 44; the state table; the generic-ancestor gate).
- The projector, view-policy builder and projection validator.
- The manifest chain, the Work 4 correction pattern (successor set,
  superseded outputs retained), the Work 7 verifier, the Work 6 report
  scripts, the CI critical-path work.
- Real content inside the Work 3 corpus: the 114 classification paths,
  the 1,380 occurrence-to-clause anchors with Ben's per-occurrence
  dispositions, Termination's phase-2 atoms and phase-3 reference values.

## 3. What is abandoned

- The generator's synthetic grammar, party projection and one-claim-per-
  node guard (about 20% of the file). The rest is reusable: envelope
  validation, duration and cardinal parsers, fact and span builders,
  profile ancestry selection, capability checks, the selector-driven
  expression materialiser, analysis assembly.
- The 1,382 marker matchers, all 3,246 marker fixtures, the fixture
  proofs and dimension evidence in the 24 packages. Superseded, retained
  on disk, never consumed again.
- Every receipt proof state that was a constant.
- The synthetic preview serving path, quarantined before any merge.

## 4. The system that works

One deterministic pipeline per agreement, zero model calls, honest
residue. Each step names the component that exists today.

1. **Governed occurrences.** The M4 claim set, unchanged (the contract
   requires it). Claims sharing an M2 node form one authored unit; each
   claim becomes a rule linked to its siblings. Generator change; the
   validator already tolerates several occurrences per node.
2. **Source closure.** Node, parent chain to SECTION, governing chapeau,
   Article chapeau for representations. Exactly what Q-0012 built from
   M2 for all 50 items. Definition and cross-reference edges from M3,
   resolved by a three-rule chain (Definitions article, preamble, nearest
   preceding; Q-0016 measures it). An unresolved edge is a
   `DEPENDENCY_UNRESOLVED` review-only disposition, never a guess.
3. **Family.** From the M4 claim key through the sealed family role
   schemas (the only committed key-to-subtype bridge), cross-checked by
   the 25 real-text family regexes. Disagreement is review-only.
4. **Subtype.** Profiles re-authored at subtype granularity: about 114,
   not 1,382. Each carries a real match test using the vocabulary the
   contract already evaluates (`SOURCE_TOKEN_*`, `INDEX_NODE_KIND`,
   `CONTEXT_EDGE`, `TYPED_FACT_EQUALS`), a required-field contract from
   the family role schema, allowed source kinds that include LIMB and
   CHAPEAU, and fixtures drawn from the 1,380 anchored real clauses:
   positive from the profile's own anchors, near-negative and
   wrong-subtype from sibling subtypes, wrong-family from other
   families. Zero or several matches after ancestry pruning is
   review-only with the reason recorded.
5. **Effect ledger.** Modals, enumerated limbs and proviso markers found
   in the closure text (Q-0018 measures the vocabulary on the 50). Every
   entry maps to a rule, an expression node, a dependency or an approved
   exclusion; an unmapped material span is `MATERIAL_SPAN_UNMODELLED`,
   review-only, with its exact span.
6. **Facts.** Typed values from the sixteen parsers and the resolver
   tables driven off the closure text (Q-0019 measures parse rates on the
   50). Parties from a deterministic party rule over the preamble
   definitions, M2 annotations and a curly-quote-tolerant definition
   scan, since M2 is sealed and M3 has no party relationships. That rule
   needs Ben's ruling (section 8, Q3).
7. **Expressions and dispositions.** The plan's operator vocabulary;
   the plan's state table. `REVIEW_ONLY` is the default for anything not
   proved. The contract gains one treatment: a review-residue coverage
   entry allowed only on review-only rules.
8. **Projection.** Existing projector and view policy, regenerated from
   the new profile set.

The false-complete guard, applied at every gate from here on: a work
receipt passes only if it binds an `AGREEMENT_ANALYSIS/V2` file for every
agreement in the sealed sets, each validated by `validateAnalysisV2` with
bindings resolved from the repository tree, each with
`governed_input_occurrence_ids` equal to that agreement's M4 claim set,
and each with every source closure hash-verified against the sealed M2
canonical text. A synthetic text cannot satisfy this because the
registration binds the real M2, M3 and M4 sets. Receipt fields are
computed from those files, never written as constants; the finaliser
test asserts that.

## 5. Phases, gates, owners

Estimates are ranges; the first real-agreement proof is fixed at two
weeks.

### Phase 0. Authority, stop record, unpinning (week 1)

- **Ben**: one decision session (section 8). One new authority,
  `m7-v2-repair-contract-candidate-replacement-authority.json`, that
  records the `FALSE_COMPLETE_FIXTURE` stop for candidate `9a3ccbf7…`
  and all 24 families, retains every Work 2–4 output immutable,
  authorises successor Work 2R/3R/4R manifests and one new registration,
  re-grants the Work 1 write exceptions for `register-candidate.mjs`,
  `verify-candidate.mjs` and `registration.test.js`, and makes the
  real-agreement receipt guard above a stop condition for every later
  work.
- **lead**: parameterise the three count pins by the registration's own
  contents; add an import-closure binding to the registration schema so
  a new matcher module is candidate-bound; add a stop-record schema; move
  the synthetic serving path behind an explicit quarantine flag that no
  preview sets.
- **ext**: Q-0016 to Q-0019 censuses (in flight).
- Exit gate: authority committed and validated by the Work 1–7 authority
  validator; recovery CI green; quarantine test proves the fixture path
  cannot attach to a deal.

### Phase 1. First slice: one real agreement compiles (weeks 1–2)

- **lead**: generator changes in section 4 (occurrence grouping,
  closures, family bridge, subtype from anchors, effect ledger, parser-
  driven facts, party rule, review-only routing); contract changes
  (review residue, parser extensions, duplicate-claim disposition,
  definition-edge projection). Run on Red Hat (`06ec3016…`, 24 of the 50).
- **ext**: cross-vendor verification of the run: independent recompute of
  closures and dispositions for the 24 items from the output file.
- Proof: `node scripts/stage-2y-structure-m7-v2-repair-work2r-run.mjs
  --agreement 06ec3016…` writes one `AGREEMENT_ANALYSIS/V2` under the
  candidate output root that passes `validateAnalysisV2` with repository
  bindings, and `validateProjectionV2` on its projection; a report lists
  NORMAL / APPROVED_LIMITED / REVIEW_ONLY / NO_OUTPUT counts per family
  with the reason code per review-only rule. A large review-only residue
  is expected and is the honest measurement.
- Exit gate: the same command passes for all ten agreements with zero
  hard failures. Not one.

### Phase 2. Profile set successor and Ben's profile session (weeks 3–5)

- **ext**: from the anchor table, build the fixture packs per subtype
  (positive, near-negative, wrong-family, wrong-subtype), all real
  clauses with spans; the Work 5 packet renderer (parked branch).
- **lead**: author the ~114 subtype profiles with real match tests and
  role-schema field contracts; Work 3R successor packages and receipt
  under the guard; re-run all ten agreements; compare dispositions
  against the 1,380 Ben dispositions (APPROVE / HOLD / PARTIAL) as a
  labelled set and report agreement rate per family.
- **Ben**: session 2, per family, with the real clause text beside each
  subtype label: confirm the labels as profile fixtures (or correct
  them), rule on the family-wide questions the run raises (no-comparison
  profiles, exclusions, parked CAPITALISATION).
- Exit gate: ten-agreement run under the guard; profile fixtures 100%
  real; disposition agreement rate reported, not thresholded.

### Phase 3. Candidate, Work 5, 6, 7 (weeks 5–8)

- **lead**: Work 4R (projector reconciliation, view policy regenerated);
  register the new candidate; independent verifier rerun; Work 5 replay
  of the fixed 50 with the V2 packet (old card, enum, verbatim note
  beside the new result; items 2, 4, 45 asked afresh; item 39 both
  trees; item 4 with chapeau; full closures for source-limited
  decisions).
- **ext**: render the packet; rebind the nine Work 6 reports to the new
  ID and rerun; rerun the Work 7 verifier.
- **Ben**: session 3, all 50 fixed items and 12 controls; session 4,
  final legal sign-off after the Fable adversarial review.
- Exit gate: Work 5, 6, 7 receipts bind one identical registration ID;
  the M7 V2 repair receipt seals.

### Phase 4. To users (after M7; weeks, not days)

M9 certification, M10 private activation (pre-authorised by Decision 22,
subject to Q10), Product Stages 3 to 9, merge of the recovery branch
through `codex/stage-2y-structure-m2` to `main`, the production runtime
gate change under Ben's one-use authority, V2 rows beside V1 per family.
Each stage is a named node in section 10 with an owner. None has an
artefact today; the plan does not pretend otherwise.

## 6. External agent work, now and next

Now (in flight): Q-0016 definition rules, Q-0017 M2 annotation gap,
Q-0018 modal and limb census, Q-0019 temporal and amount census. Next:
fixture packs from anchors; cross-vendor verification of every real run
receipt; Work 5 renderer; Work 6 rebind and rerun; Work 7 verifier rerun.
The external agent never writes candidate-bound bytes and never answers a
legal question.

## 7. Risks, stated plainly

- The review-only residue on the first run may be large, including on
  the 12 controls. That is measurement, not failure; the plan says so in
  advance so it is not read as one.
- The party rule and the definition chain are deterministic heuristics
  over sealed M2 with a known annotation gap. Their error modes are
  recorded per occurrence; they do not silently supply a party.
- The additive three have no typed M4 values. Their typed facts come
  only from the parsers over text; expect more review-only there.
- Ben's review load: one profile session (about 114 labels, grouped by
  family, real text beside each), one fixed-50 session, one sign-off.
  Batched; nothing asked twice.
- Time estimates are ranges from the diagnosis, not commitments.

## 8. Decisions for Ben (one session)

Q1. Adopt this plan and record `FALSE_COMPLETE_FIXTURE` for candidate
`9a3ccbf7…` across all 24 families under one replacement authority?
Options: (a) yes, as drafted; (b) yes, but as a whole-repair stop with
re-planning from Work 3 under a new plan amendment; (c) no.
Recommendation: (a).

Q2. Profile granularity: (a) about 114 subtype profiles with many real
fixtures each, your 1,380 occurrence dispositions re-presented as fixture
labels with the clause text; (b) 1,382 per-occurrence profiles with one
fixture each. Recommendation: (a). Your existing APPROVE dispositions are
carried as labels for you to confirm in session 2, not assumed.

Q3. Party proof on real text, given M2 is sealed and missed curly-quoted
party terms and M3 has no party relationships: (a) a deterministic party
rule (preamble definitions, M2 annotations, curly-quote-tolerant scan)
recorded per occurrence as a `PARTY_PROOF_RULE` context disposition you
ruled on; (b) re-run M2 under a new M0–M4 trust-root amendment; (c) leave
parties review-only everywhere. Recommendation: (a).

Q4. Review residue in the contract: allow a `REVIEW_RESIDUE` coverage
treatment only on review-only rules, so a resistant clause routes to
review instead of crashing the run? Recommendation: yes; it is the plan's
own rule (section 6, acceptance case 23).

Q5. Operators: admit BEFORE, ON_OR_BEFORE, OFFSET_AFTER, OFFSET_BEFORE,
CAPABLE, OVERRIDES, DEEMS_AS, LATER_OF, TO_EXTENT, CONSEQUENCE_MODIFIER to
the executable vocabulary (all already in approved signatures or the
plan's minimum set)? Recommendation: yes.

Q6. CAPITALISATION has no approved package: (a) explicit parked-family
exception through Work 7; (b) author it in Phase 2. Recommendation: (a).

Q7. Additive three: accept parser-only typed facts and a larger
review-only residue for AbbVie/Landos, Lilly/Verve, Rocket/Redfin?
Recommendation: yes; no model calls.

Q8. Items 14 and 43: both carry a REPRESENTATIONS claim on the same node
that the V1 lineage ignored, and your notes call both representations.
Cross-family owner decision in session 3, or now? Recommendation: session
3, with both readings shown.

Q9. Quarantine the synthetic preview serving path before any merge?
Recommendation: yes.

Q10. Does Decision 22's pre-authorisation of M9 and M10 survive a
candidate replacement, or do you re-confirm it at M7 sealing?
Recommendation: re-confirm at sealing; costs nothing now.

Q11. PR #486 (nine Work 6 reports) and PR #487 (verification scratch):
hold both open as drafts until the new registration exists?
Recommendation: yes.

## 9. First two weeks, day by day where it matters

Days 1–2: Ben session 1; authority drafted, validated, committed; stop
record; unpin counts; quarantine. Days 3–8: generator and contract
changes; Red Hat compiles under the validator; report. Days 9–12: the
other nine agreements; every hard failure becomes a review-only route or
a listed contract change; cross-vendor verification from the external
agent. Days 13–14: Work 2R receipt under the guard; Phase 1 exit; plan
review against what the run actually showed.

## 10. Dependency graph to publication

Nodes, in order, with owner. Each depends on the one before unless
stated.

1. Replacement authority and stop record (Ben, lead).
2. Governance unpinning, import-closure binding, quarantine (lead).
3. One agreement compiles under the validator (lead; ext verifies).
4. Ten agreements compile; Work 2R receipt under the guard (lead).
5. Subtype profiles with real fixtures; Ben profile session; Work 3R
   receipt (lead, ext, Ben).
6. Work 4R; new registration; verifier (lead, ext).
7. Work 5 packet; Ben decides 50 (lead, ext, Ben).
8. Work 6 rebind and rerun (ext). Depends on 6, parallel with 7.
9. Work 7: verifier, Fable audit, Ben sign-off; M7 V2 receipt sealed
   (ext, lead, Ben).
10. M9 certification; M10 private activation (lead; Ben confirms Q10).
11. Product Stages 3–9: disposition, durable import, serving, 40-
    agreement corpus, security, preview, production candidate (lead;
    Ben at each named confirmation).
12. Merge recovery branch to `codex/stage-2y-structure-m2`, then `main`;
    evidence gates on the merged tree (lead, CI).
13. Production runtime gate change under one-use authority; V2 beside V1
    per family (Ben, lead).
14. Published to users (Ben's go-live call).
