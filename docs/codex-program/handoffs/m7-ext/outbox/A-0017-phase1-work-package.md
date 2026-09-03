id: A-0017
from: lead
to: ext
date: 2026-09-03
re: Phase 1 work package (re-plan §5 Phase 1); independence rule adjusted
status: OPEN (deliver as Q-0023 onward; PR title prefix [ext-m7] Work 2 real-text)

# Change of rule

Ben has directed that the external workstream carries as much of the
build as possible. From now: you MAY write candidate-bound code on your
own `ext/*` branches under a spec from me. You still never register a
candidate, seal a receipt, write under `evidence/…/control/` or
`receipts/`, or answer a legal question. The verifier of a phase is never
its author: Phase 1's attempt-record recompute moves to an internal
agent; you build. Lead answers arrive on a two-hour cadence for the next
day; batch your questions and keep moving on assumptions recorded in
`status/`.

# Base

Branch `ext/m7-w2-real-text` from `origin/codex/recover-m7-20260812` at
`d1b8805d` or later. Read first: the replacement authority
`evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-candidate-replacement-authority.json`
(the `phases[0]` entry names every path, argv, run limit and commit
message for Work 2 real-text; use exactly those names), the re-plan
revision 2 §4 and §5 Phase 1, DECISIONS.md #26, and the two review
findings files under `scratch/plan-reviews.txt` are not on git; rely on
the plan text.

A count-unpinning change to `register-candidate.mjs`,
`verify-candidate.mjs`, `execution-manifest-validate.mjs` and
`registration.test.js` lands from my side within hours. Do not edit
those four files until A-0018 names the commit; everything below avoids
them.

# Deliverables (all ten agreements, zero model calls)

## D1. Generator: real-text plumbing (`lib/canonical-v2/m7-v2-deterministic-generator.js`)

- Governed occurrences stay the M4 claim set. Claims sharing an M2 node
  form one authored unit; each claim is its own rule, linked to its
  siblings (`linked_rule_ids`), with one shared source closure. Remove
  the one-claim-per-node throw; retire the matching required-throw case
  in `tests/stage-2y-structure-m7-v2-repair-contract.test.js`
  ("two claims share one governed node", around line 8584) and replace
  it with a positive case.
- Zero or several profile matches never throw: the occurrence gets a
  review-only disposition with issue `NO_SINGLE_PROFILE` and the
  candidate profile ids recorded.
- Delete the `COMPANY` legal-subject constant. With no party proof the
  rule carries `PARTY_PROOF_UNPROVED`; APPLIES_TO is never invented.
  Remove the BOUND_ENTITY requirement; party edges are projected only
  from a context-disposition record when one exists (Phase 2).
- Any unmatched material span in the closure is `MATERIAL_SPAN_UNMODELLED`
  with its exact byte span. An unresolved definition or reference edge is
  `DEPENDENCY_UNRESOLVED` with both candidate spans.
- Every occurrence emits an attempt record (see D4) whatever its
  disposition.
- The existing approved profile set is bound as a measurement-only input;
  the expected Phase 1 outcome is every occurrence review-only. Do not
  author profiles in this package.

## D2. Contract (`lib/canonical-v2/m7-v2-contract.js`)

- `REVIEW_RESIDUE` coverage treatment, admitted only on review-only rules;
  a NORMAL or APPROVED_LIMITED rule with residue fails as today.
- Issue codes: `MATERIAL_SPAN_UNMODELLED`, `DEPENDENCY_UNRESOLVED`,
  `PARTY_PROOF_UNPROVED`, `SIGNATURE_MISMATCH`, `FAMILY_CORRECTION_PENDING`,
  `NO_SINGLE_PROFILE`.
- Closure extension: `context_spans[]` on a source closure, each
  `{kind: PARENT_CHAIN | GOVERNING_CHAPEAU | ARTICLE_CHAPEAU,
  node_occurrence_id, start_byte, end_byte, text_sha256}` drawn from named
  ancestor nodes, hash-verified against sealed M2 bytes by the validator,
  admitted into matcher context and fact provenance. The authored unit
  stays the limb (Decision 26 Q16).
- Definition edges projected as context edges, with the resolution rule
  id recorded (`RULE_1_DEFINITIONS_ARTICLE`, `RULE_2_PREAMBLE`; rule 3
  only for byte-identical candidates after whitespace normalisation,
  otherwise unresolved).
- Duplicate-claim disposition: two M4 claims on one node naming the same
  effect yield two linked rules, never one dropped claim.
- Every M2 `PAGE_NUMBER` source artefact inside a closure receives a
  `SOURCE_ARTEFACT` coverage entry under one structural rule.
- Sealed rulings (items 15, 28, 39, 41, 42, 44; state table; generic-
  ancestor gate) unchanged; run the existing contract test file and keep
  every non-retired case passing.

## D3. Run, finalise, validate (`scripts/stage-2y-structure-m7-v2-repair-work2-real-text-{run,finalise,validate}.mjs`)

- `run`: for each member of the sealed Work 3 sets, build the compiler
  input exactly as the Work 5 dry run did (governance from the selected
  registration: `--registration <path>` mandatory, no default), call
  `consolidateAnalysis`, write `AGREEMENT_ANALYSIS/V2` to
  `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/v2-candidate/<agreement_id>.agreement-analysis.json`
  plus `<agreement_id>.attempt-record.json`, and write the per-family
  report `…/m7-v2-repair/v2-candidate/work2-real-text-report.json`
  broken down by reason code. Deterministic and byte-identical on re-run.
- `finalise`: writes the receipt named in the authority's `phases[0]`,
  computing every count from the bound files; `validate`: re-derives the
  receipt's counts from the files and fails on any mismatch, and applies
  the real-agreement receipt guard as written in the authority
  (`real_agreement_receipt_guard`): one analysis per sealed-set member by
  record id, `validateAnalysisV2` with the Work 7 verifier's repository-
  tree resolver, occurrence set equal to the M4 claim set, closures and
  context spans hash-verified.
- Tests `tests/stage-2y-structure-m7-v2-repair-work2-real-text.test.js`,
  behavioural: withholding one analysis, corrupting one closure hash, or
  changing one occurrence id makes `validate` FAIL naming the agreement;
  a synthetic fixture text cannot pass the guard; re-run is byte-
  identical.

## D4. Attempt record schema (`docs/codex-program/notes/WORK2-REAL-TEXT-ATTEMPT-RECORD-2026-09-03.md` plus the JSON shape in the run script)

Per occurrence: `claim_occurrence_id`, `node_occurrence_id`,
`closure` (spans and sha), `family_bridge_result` (null in Phase 1),
`subtype_candidates` (profile ids matched, expected empty),
`ledger_entries` (modals, limbs, proviso markers found, from your Q-0018
vocabulary), `parser_hit_or_abstain` (null in Phase 1),
`party_candidates_with_spans` (from your Q-0021 tables, recorded, not
proved), `definition_resolution` (edge, rule id or unresolved with both
candidates), `disposition`, `issue_codes`.

# Not in this package

Interim registration and the manifest-validator recognition of the
replacement authority (mine, after the unpinning lands); the successor
manifest bootstrap; profiles, facts, parties, expressions (Phase 2).

# Acceptance

`node scripts/…work2-real-text-run.mjs --registration <interim registration path I will name in A-0018>`
produces ten analyses; until then run with `--registration` pointing at
`9a3ccbf7…` and expect the guard's governance check to be the only
failure, reported as such. `CI=true node --test` on your test file and on
`tests/stage-2y-structure-m7-v2-repair-contract.test.js` exit 0. The
phase-1 boundary test passes with your new scripts classified (tell me
the category you chose; I will apply it at integration). Deliver as a
draft PR `[ext-m7] Work 2 real-text successor` against the recovery
branch and a Q naming it, with the report's reason-code counts in the Q.
No round limit.

Q-0018 and Q-0019 remain due; D1's ledger entries depend on Q-0018.
