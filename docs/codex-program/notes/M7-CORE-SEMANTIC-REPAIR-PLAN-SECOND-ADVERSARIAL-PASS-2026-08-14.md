# Second adversarial pass: amended M7 core semantic repair plan

**Date:** 14 August 2026
**Reviewer:** Fable, auditor role, same independent session as the first review.
**Reviewed:** amendment commit `1e7cd5a8` on `codex/recover-m7-20260812`
("Amend M7 repair plan after adversarial review"), diffed against `0ad55f43`.
Scope per the amended plan §13: the amendment only — the seven attack routes
re-run, every §14 disposition verified, and the six new questions (13-18)
answered.

## Verdict

**PASS, with two drafting conditions and one factual correction owned by the
auditor.** All 22 dispositions in §14 are genuine: each accepted finding is
closed by specific, testable plan text, and each qualification is fair. No new
material route was found. The two conditions below are one-sentence additions;
neither blocks adoption, and both can be satisfied in the bootstrap or Work 1-7
authority text. Adoption of the amended plan plus a bootstrap authority for
Work 0 only — with Work 1-7 authority withheld until the evidence root passes —
is the correct next decision and matches the plan's own §9.

## 1. Correction owned: finding F2 was wrong in its strong form

Ben's factual correction is verified. The three programme rulings exist in
`evidence/canonical-v2/stage-2y-structure-migration/control/m5-programme-rulings.json`
(SHA-256 `2711dc5c…` — recomputed against the file, and it matches the pin the
amended plan §4 now carries; record ID `03198dab…`; approver `BEN_GOODCHILD`;
scope `ALL_25_REGISTERED_FAMILIES`; the question-2 note expressly records the
duplicate-storage clarification), receipt-bound via
`receipts/stage-2y-structure-m5-schema-approval.json` (`PASS`, `SEALED`) and
others, and present at `0ad55f43`, the commit the first review examined.

The first review missed it twice: its label search was truncated before this
file appeared in the results, and its field probe searched `ben_ruling_id`
where this file uses `ruling_id`. The auditor then trusted the 25 calibration
packs — which still say `OPEN_REQUIRES_BEN_RULING` with null ruling IDs — which
is precisely the stale-record trap this repository documents. What survives of
F2 is only the staleness: two contradictory records coexist in evidence, and
Work 0's re-bind-and-map disposition (map all 75 pack questions to the three
sealed ruling IDs; do not create a replacement ruling) is the correct fix. The
qualification in §14 is accurate.

## 2. Disposition verification, F1-F22

Each §14 row was checked against the amendment text. All verified. The
substantive closures, with where they land:

- **F1** → Work 0 evidence root binding the completed ledger, packet, policy,
  adopted plan, Q&A, adversarial review, sealed rulings, M3/M4 trust roots,
  pre-Work-0 manifest and bootstrap authority; §11 orders the chain with no
  circular binding. Closed.
- **F3** → §1 binds all six inputs per rule and receipt; a separately sealed
  candidate registration outside the compiler; independent recomputation
  (invariants 16-17, acceptance 17). Closed subject to condition C1 below.
- **F4** → closed overlay set, item 39 only, unknown-ID/duplicate/changed-byte
  rejection, materialised candidate trees, Work 6 inspect-but-not-add. Closed.
- **F5** → `FAILED_HUMAN_REVIEW_NOT_CONSUMABLE` registration, supersession
  ledger, M6 V2 rejects V1, acceptance 19, gate line. Closed.
- **F6** → Work 0 corrects OPERATING-RULES citing Decision 19 and the sealed
  M3/M4 receipts without inventing a historical seal event; boundary reworded
  to "M0-M4 bytes remain fixed under their sealed receipts". Fairly qualified.
- **F7** → fixed-sample identity manifest (ordinals, IDs, node occurrences or
  ambiguity ID, byte spans, slice hashes), `RESAMPLE_REQUIRES_NEW_AUTHORITY`,
  field-by-field replay gate. Closed; the qualification (the resample predated
  the current answers) is accurate — the ledger keys on the resealed packet's
  review-item IDs.
- **F8** → both Q&A dispositions rewritten exactly as required (verified in
  the diff); acceptance 7; gate line reworded. Closed.
- **F9** → atomic typed facts; no operative connective, proviso marker,
  enumeration boundary, condition, exception, timing or threshold operator
  inside a fact span; sub-clause quotes banned by name; item 2's exact tree
  specified in Work 1 and acceptance 1. Closed.
- **F10** → cross-profile minimum legal floor; positive / near-negative /
  wrong-family / wrong-subtype fixtures; finite excluded-dimension declaration
  with owner links; the broad meaning question and an explicit family-and-
  subtype question retained in every replay (Q&A §3 preamble amended to
  match). Closed subject to condition C2.
- **F11** → authored-unit effect ledger (invariant 3, acceptance 9); legal
  prose can never be structural under a deterministic rule; every legal-text
  exclusion needs a specific Ben ruling; "For purposes of this Section only"
  fixture added. Closed.
- **F12** → reviewed source closure defined and digest-bound; per-field
  observations; a reachable unresolved dependency is `INCOMPLETE`, never
  `SOURCE_LIMITED` (invariant 10, acceptance 11); per-field market-stat
  exclusion. Closed.
- **F13** → `CONTEXT_EDGE_UNPROVED`, heading-derived context banned
  (invariant 2, acceptances 8/12/22), later context dispositions need separate
  authority outside sealed M3. Note the quiet companion fix: §11 now requires
  an "evidenced disposition" for all 38, not an "evidenced repair" — so item
  40 staying honestly review-only no longer conflicts with the gate. Closed.
- **F14** → constraint removed; occurrence-delta-zero replaces it; the plan
  now states in §6 and Work 6 that a rising `REVIEW_ONLY` count is expected
  and reported. Closed.
- **F15** → all 25 family sets are candidates; most-specific-proved subtype;
  descendant-only-when-proved; typed lawyer-ruled `FAMILY_CORRECTION`
  (invariant 12); Work 5 maps to the complete linked rule set (acceptance 20).
  Closed subject to condition C2.
- **F16** → `NO_OUTPUT` as a distinct occurrence-level disposition with a full
  governed record after all-family classification, cross-family normal match
  taking priority, per-family disposition counts at the gate, item 15 as a
  mandatory negative fixture (acceptance 6, 25). Closed.
- **F17** → versioned eleven-operator vocabulary including `IF_THEN`,
  `OVERRIDES`, `DEEMS_AS`, `TO_EXTENT`, `CONSEQUENCE_MODIFIER`; unsupported
  relationship → `INCOMPLETE`, never approximated; determinism invariant 15;
  near-duplicate comparability tests (acceptance 16). The Work 1 item 6 tree
  (`ALL_OF` of an intentional-conduct branch and a knowledge-and-causation
  branch, knowledge scoping over causation) is a legally correct encoding of
  the double-knowledge standard Ben flagged. Closed.
- **F18** → family-neutral semantic fact key (type, normalised value, subject,
  temporal/scope signature, source-support set, legal-effect role); items
  28/42's identical six-year values stay separate by legal-effect role;
  item 25 becomes a consumer link (acceptance 21). Closed.
- **F19** → render bindings (fact ID, field key, label ID, canonical and
  rendered value digests, layout ID); deterministic type formatters; label
  swaps fail by name; separate compact and expanded omission ledgers; compact
  floor. Closed.
- **F20** → non-regression precisely defined; all 12 controls return to Ben;
  gate requires fresh approval. Closed.
- **F21** → repair-baseline ledger preserves enums and notes unedited;
  membership derived from the Q&A §4 repair-class table; items 2, 4, 45
  flagged for fresh questions; item 4 shown with its chapeau. Closed.
- **F22** → two-step non-circular authority (bootstrap → Work 0 evidence root
  → separate Work 1-7 authority); external and product effects defined; the
  deferred generator experiment requires a PLAN/Decision amendment plus its
  own authority, output permanently `MODEL_PROPOSAL_REVIEW_ONLY`, runtime
  adoption needing a blind sample and a further amendment. This exceeds the
  first review's ask — the all-50 requirement (so the experiment measures
  generator quality, not missing profiles) and the control arm for measuring
  degradation are improvements the auditor endorses. Closed.

All eleven minor findings are carried forward correctly (TopBuild reported
separately; additive-three calibration beyond the fixed 50 — necessary, since
that path has one clean human-confirmed result; packet coverage metadata
asserted; graveyarded V3/V4 timing schemas checked before rebuild; corpus
digest described as a state binding; affected-class stop defined; `M7 V2`
naming replacing "successor"; item 39's `7.01(d)` parent surfaced; PLAN.md
update deferred to adoption).

## 3. Conditions and notes

**C1 (before Work 7 registration exists).** Invariant 16 requires rules to
bind a registration "outside the compiler", but Work 7 registers "the exact
approved candidate only after technical and legal review". Works 2-6 therefore
need a working registration the plan does not name, and nothing yet states
that the final approved registration must be byte-identical to the candidate
that produced the evidence Ben reviewed. Add one sentence to Work 7: *the
approved registration must bind digests identical to those under which every
reviewed receipt was produced; any change to the candidate reopens Work 5.*
Without it, a post-review patch could be registered as "the approved
candidate" — acceptance 17 would likely catch the mismatch, but only if the
verifier is defined to compare reviewed receipts against the final
registration.

**C2 (before any family emits normal rows).** §5.3 blocks a generic ancestor
only "when registered child profiles exist". A family whose subtype tree is
knowingly incomplete during the Work 3 rollout can emit generic-level `NORMAL`
rows through the gap. Add: *each approved family profile set declares whether
its subtype tree is output-complete; a family whose tree is declared
incomplete emits no `NORMAL` row at generic level without an express Ben
approval of generic-level output for that family.*

**N1.** The plan header's "Targeted second review passed" refers to the
mechanical integrity recheck (the 50 questions, excerpts, rows, answers and
notes against the sealed records — independently re-confirmed here: the
amendment touches only three documents, none of the 50 records, and the
packet and ledger hashes are unchanged). It should be labelled as such so it
is not read as this §13 second adversarial review, which is the present
document.

**N2.** The pre-Work-0 evidence-input manifest should bind both adversarial
review documents — the first review and this second pass — at the adoption
commit.

## 4. The six new questions (§13, 13-18)

**Q13 — self-attestation or unbound paths?** Closed by design: registration
outside the compiler, independent digest recomputation (invariant 17,
acceptance 17), V1 hard-gated and non-consumable. Subject to C1's continuity
sentence.

**Q14 — can enumeration, exclusions, no-comparison or no-output hide a
limb?** Substantially closed: the effect ledger accounts for every modal and
limb before matching; legal-prose exclusions each need a Ben ruling; every
`NO_OUTPUT` occurrence carries a full classification record and cannot
suppress a compatible cross-family match; item 15 is a mandatory negative
fixture. The residue is profile-authorship honesty, now bounded by fixtures,
the excluded-dimension declaration, Ben's approvals and the Work 7 adversarial
gate.

**Q15 — blob, unsupported operator, or generic ancestor?** Blob: no —
atomic-fact rule plus invariant 6. Unsupported operator: no — `INCOMPLETE`,
never approximated. Generic ancestor: no once C2 closes the partial-rollout
window.

**Q16 — wrong value or label with passing reconciliation?** No — render
bindings carry canonical and rendered value digests validated by the
deterministic formatter per type, and label bindings fail by name
(acceptance 14). Layout ledgers are separate, with a compact floor.

**Q17 — can the 50 identities or 12 controls change without a fresh lawyer
decision?** No — the identity manifest binds ordinals, IDs, occurrences or
ambiguity ID, byte spans and slice hashes recomputable against sealed text;
any member change is `RESAMPLE_REQUIRES_NEW_AUTHORITY`; the gate compares
field by field; the 12 controls need fresh Ben approval under the defined
non-regression test.

**Q18 — model-call route in Work 0-7?** None: §1 forbids waiting for or
silently calling a model, acceptance 23 asserts zero calls, both authorities'
allow-lists prohibit them, and the experiment is expressly outside current
authority, requiring a PLAN/Decision exception plus a separate experiment
authority, with output non-consumable even after lawyer scoring.

## 5. The seven routes, re-run against the amendment

1. **Mark incomplete complete** — closed (atomic facts, effect ledger,
   minimum floor, coverage partition, independent verifier; evidence root
   seals the FAILED gate itself).
2. **Omit a material source fact** — closed (source closure, per-field
   source limitation, render bindings, per-layout omission ledgers).
3. **Wrong legal topic** — closed subject to C2 (all-25 candidacy,
   most-specific-proved, lawyer-ruled family corrections, broad question
   retained).
4. **Misuse the limited-drafting exception** — closed (closure-bound
   per-field absence proofs; reachable dependencies can never be
   source-limited).
5. **Alter sealed M0-M4 work** — closed (bytes fixed under sealed receipts;
   artefact spans instead of text mutation; closed overlay set; context
   dispositions outside sealed M3; Work 0 repairs the stale rules text).
6. **Bypass the compiler or family rules** — closed subject to C1 (external
   registration, independent recomputation, V1 superseded and hard-gated).
7. **Regress the 12 controls** — closed (defined non-regression, all 12
   before Ben, gate requires fresh approval).

## 6. Mechanical verification of this pass

- `1e7cd5a8` changes exactly three documents; no evidence, code, or sealed
  artefact. Ben's "no implementation, model call or M8 work occurred" is
  confirmed for the commit range.
- §4's pinned rulings-file SHA-256 recomputes exactly.
- The Q&A amendment changes the replay-question preamble and three required
  repair dispositions (items 6, 15, 39) — programme diagnoses, not Ben's
  answers. "No answer was changed" still holds across all 50.
- PLAN.md §3 and the stage table accurately describe the amended state and
  expressly deny implementation authority.
