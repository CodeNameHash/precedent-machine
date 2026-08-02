# Process Intelligence execution plan — 2026-08-02 amendment

**Status:** DRAFT AMENDMENT — pending Fable delta review (planning
review; NOT one of the programme's three independent adversarial
review milestones, which remain exactly WP3A pre-freeze,
vertical-slice completion if uncovered, and pre-activation).
**Amends:** `2026-07-29-process-intelligence-execution-plan.md` under
the authority of the
`2026-07-27-process-intelligence-design.md` (both provided by Ben
2026-08-02; neither is superseded — this amendment REBASES the plan
onto current repo reality and imports the Agreement-side lessons of
2026-07-31 → 2026-08-02).
**Provenance (delta-review C-1):** the plan bytes Ben supplied hash
SHA-256 `570e19ff0ef8a8a1…`. HISTORICAL ledger revisions (e.g. commit
`7b6bc641`) pinned a process-design-repo copy at `a255661c…f1d49b0`;
the CURRENT ledger carries NO plan pin. Whether `570e19ff…` equals the
process-design repo's committed copy cannot be verified from this
environment; creating the current ledger pin is part of the
commit-of-record step below.
**Source-of-record note:** the parent plan's own rule requires
amendments to be committed to the Deal Storylines repository (believed to be
`precedent-machine-process-design`, per the historical ledger path —
confirm at commit time) with the ledger
SHA-256 updated. That repo is not pushed/reachable from this
environment. This file is the working copy; Ben (or a session with
that repo attached) must commit the reviewed amendment there and
update `docs/codex-program/EXECUTION-LEDGER.md`'s pinned hash. Until
then the 2026-07-29 bytes remain the plan of record.

## 1. Rebase: what the ledger shows against the plan's packages

| Package | Plan status → actual (ledger evidence) |
|---|---|
| P-1 gate check | **OBSOLETE.** The protected programme-status/signer apparatus was retired 2026-07-30 (`PM-GOV-BALANCE-01`); milestone Markdown acknowledgements are the only pre-production approval artefact. The plan's every "protected status" reference re-bases onto: exact-commit basis + allowlist per unit (already enforced by CI `phase-allowlist`) + milestone acknowledgements. P-1's merge-staleness rule survives as `docs/certification/PM-PROCESS-CONCURRENCY-RULE.md` (exact main basis per unit; PM agent moves main once per batch) — that document, not this table, is the governing control. |
| P0 baselines | **COMPLETE** — both inventories exist and are content-addressed (`evidence/process-intelligence/baseline/`). |
| P1 successor contracts | **COMPLETE** — full tree under `contracts/canonical-v2/successor/process/` incl. exclusivity predicate catalogue v2, completeness-challenge protocol, witness contracts. |
| P2 shared authority | **PARTIAL.** Kernels/manifests exist (`wp-shared-authority-*` allowlists). The WP3A scope decision — full shared-field release vs expressly reduced — is OPEN and is a Ben decision this amendment schedules (§3, A2). |
| P3 process semantics | **COMPLETE** for exclusivity — typed-state semantics live in `lib/canonical-v2/process-exclusivity-contract.js` and sibling process-* modules with their focused tests (request≠grant, silence≠refusal). NOTE (delta-review M-5): the parent plan budgeted 6-10 Ben hours for P3 legal semantics with no ledger record they were spent; that judgment debt is named and rolled into the WP3A freeze-package review rather than assumed discharged. |
| P4 catalogue/Query IR | **NOT DONE** (product-side; some Query IR groundwork via `PM-METSERA-PRODUCT-ROW-01`). |
| P5 passage serving | **LARGELY COMPLETE** for the pilot shape (phrasebook result rows, presentation, source reader refusal, four surfaces — `PM-METSERA-*` chain). Paragraph-context repeat-click action: NOT yet built (design mandates a successor parent-bound action). |
| P6 interface | **NOT DONE** beyond the guarded preview route (`PM-METSERA-BROWSER-01`). |
| P7 acquisition/extraction machinery | **PILOT-PROVEN** (acquisition, dual enumeration, graph validation, materialisation — sealed Metsera only). Not exercised beyond one deal/family. |
| PE1 Metsera gold | **COMPLETE except task 10** — gold sealed (`metsera-gold/exclusivity-gold.v1`, dual enumerations + reconciliation + blind-challenge freeze artefacts), but the sampling-frame PRE-REGISTRATION duty (PE1 task 10) has no artefact on disk; it is scheduled as C1 below. |
| P8 freeze/slices | **OPEN — the live blocker.** Multiple ledger rows carry "Reserved exact contract freeze only." WP3A pre-freeze review + Ben approval + `ContractFreezeAttestation` + fresh same-pair slices have not run. |
| P9 certification | **NOT STARTED** (the 25-deal tuning + one-shot holdout programme; the plan's own estimate makes it the largest block: 220-380 team hours, 15-22 Ben hours). |
| P10/P11 | **NOT STARTED** (plus the M2 envelope debt is a named P10 prerequisite: slim write sets to digest-carried sources before corpus scale). |
| P12 | Post-cutover, unchanged. |

## 2. Lessons imported from the Agreement programme (binding deltas)

D1. **Adversarial spec audit as part of AUTHORING (reworded per
delta-review M-1).** Spec authoring on Fable includes an adversarial
audit of the spec BEFORE handoff — part of authoring QA, not a review
event (it produces no tracked dispositions and creates no milestone;
three consecutive such audits this week each caught critical fail-open
holes pre-build). The build then receives exactly the parent plan's
ONE cheap Stage 2 conformance review; Stage 3 escalation only per the
existing legal-semantics/identity rule, which also implements the
repo watchdog's two-strike escalation. NO per-build Fable review and
NO fourth review milestone.

D2. **Instrument first-workload gating.** Every discovery/verification
instrument (the lexical enumerator, the completeness oracle, the
reconciler) ships tagged UNTRUSTED until its first real-workload
triage is a committed dated handoff. Precedent: the Agreement
limb-enumeration scan failed 21/21 on its first real document shape;
the plan's disagreement-rate retention makes this cheap to honor.

D3. **The checker-derives-its-own-answer defect class** (two Agreement
incidents). Any process instrument that derives its own answer for
comparison (the citation-style rederivations, span checks) must
resolve within the governed unit/span, never global first-match —
named as an explicit test class in every P7-family unit.

D4. **Recorded-fixture replay as the default test substrate.** The
pilot already records everything content-addressed; every remaining
unit pins recorded artefacts and replays deterministically, with live
runs as dated handoffs only.

D5. **Adjudication-loop speed.** Open-world process observations
(outside the governed taxonomy) get the deterministic commonality
clustering + adjudication-artifact loop that turned 136 Agreement
candidates into 14 Ben decisions in one day. This implements the
design's "observation outside the governed taxonomy → review" branch
at corpus scale without queue drowning.

D6. **Envelope debt is a scheduled unit, not a note** (§3, B1).

D7. **Two-strike escalation + never-commit-unreviewed** (the watchdog
protocol) governs all delegated production, as on the Agreement side.

## 3. Remaining work, sequenced for ASAP-without-gate-skipping

**Lane A — Ben-gated path to freeze (starts immediately):**
- A1. Assemble the WP3A pre-freeze package: exact successor root,
  delta since the last reviewed state, prior-disposition regression
  table (the four Sol/Fable review dispositions in the design are the
  regression baseline).
- A2. The shared-authority SCOPE DECISION goes to Ben as a single
  costed question (full shared-field release vs expressly reduced
  first release omitting named-entity/adviser/equity filters). The
  design already licenses the reduced release honestly; deciding it
  BEFORE freeze is the single highest-leverage ASAP move because it
  unblocks WP3A regardless of the upstream entity-authority
  workstream's pace.
- A3. WP3A independent adversarial review (milestone 1 of 3) → Ben
  approval → `ContractFreezeAttestation` → fresh same-pair
  `P1_VERTICAL_SLICE_PASS` + `PROCESS_VERTICAL_SLICE_PASS` replays.

**Lane B — build lanes that need no freeze (start immediately,
parallel):**
- B1. Envelope slimming (M2 debt): digest-carried sources; cap back to
  4 MiB; retire the `--db-url` transport exception. Acceptance:
  byte-identical pilot replay.
- B2. P4 field catalogue + navigation catalogue + Ask/Browse → one
  Query IR, built against immutable fixtures (the parent plan already
  authorizes generic code work). Spec-on-Fable (the checked phrase
  mappings and refusal semantics are legal-adjacent), produce on
  Codex/Sonnet, golden utterance suites from day one (design:
  "a handwritten lexicon with inspected examples is not
  certification").
- B3. P5 remainder: the parent-bound repeat-click paragraph-context
  action (successor contract already named in P1's member list).
- B4. P6 interface against immutable fixtures (acceptance tests 1-76
  trace). UI is Codex-friendly; the four-surface pilot fixtures make
  the browser acceptance concrete.

**Lane C — certification runway (starts now, pays off at P9):**
- C1. Pre-register the 25-deal sampling frame + tuning/holdout split
  NOW (PE1 task 10; zero build dependency; the custodian rules demand
  it before any holdout detail exists). The frame MUST record this
  governing exclusion (delta-review M-4): any deal whose sources,
  fixtures or extraction transcripts are committed to either
  programme's repositories, or otherwise known to the extractor team,
  is EXCLUDED from holdout strata and may enter only the tuning set —
  Skechers, Modiv and TopBuild are therefore tuning-only, permanently
  holdout-invalid. Ben-hours: minutes.
- C2 (STRICTLY AFTER C1; reframed per delta-review M-3). Evidence-lane
  work ONLY: for 2-3 tuning deals (the repo-exposed trio qualifies as
  tuning-only), run TWO INDEPENDENT SOURCE-ONLY ENUMERATIONS plus
  reconciliation per deal and seal the source universes as inert
  content-addressed artefacts — the PE1/Metsera pattern exactly.
  Exercising the P7 PRODUCTION acquisition machinery against new deals
  waits for `candidate_scope_and_extraction: PASS`; gold readers never
  receive a list derived from extractor output.
- C3 (STRICTLY AFTER C1). Dual-enumeration gold protocol on tuning
  deal #2 with delegated enumeration labour (the design's budget
  rule), so P9 doesn't start cold. C1 → C2 → C3 is a hard dependency
  chain.

**Order of Ben touchpoints:** A2 scope decision (+ the costed-delta
block below) → A3 WP3A approval → C1 frame sign-off → package-level
reviews as P4/P5/P6/P8 land → then the P9 blind reads. Honest budget
(delta-review M-5): the parent plan's own estimates for the still-open
packages total **6-13 Ben hours before P9** (P2 1-2, P4 1-2, P5 0-1,
P6 2-4, P8 2-4, plus the P3 judgment debt rolled into WP3A), then P9's
15-22h. The earlier ≈3-6h figure counted only A2/A3/C1 and is
withdrawn.

**Costed decisions FOR Ben (delta-review M-6 — these are
SCOPE_EXPANSION under the design's own taxonomy and are NOT bound by
this amendment until Ben accepts each):**
1. D1 pre-handoff spec audits (~1-3 Fable-hours per remaining spec;
   demonstrated yield: every audit this week found critical holes).
2. D2 instrument UNTRUSTED-until-first-workload tagging (near-zero
   cost; formalizes what the design's disagreement-rate retention
   already collects).
3. D5 the commonality-clustering + adjudication-artifact loop for
   Process open-world observations (reuses the Agreement tooling;
   cost is the clustering run + one artifact per batch; the
   alternative is raw queue review of every unmapped observation).
D3/D4/D6/D7 and the §1 rebase are plain rebase items, binding as
written; C2/C3 bind in their evidence-lane form above.

## 4. What this amendment does NOT change

The three-milestone review structure; the one-shot holdout rule and
custodian regime; the mandatory predicate floor; the no-narrative-LLM
product boundary; source-of-record residence in the process-design
repo; the freeze-before-broad-extraction gate; Storylines'
evidence-only status; every accepted Sol/Fable disposition. Where any
wording here conflicts with the 2026-07-27 design, the design wins.

## Ben's rulings on the amendment's open decisions (2026-08-02)

1. **Scope decision (A2): FULL shared-field release, day one.** The
   reduced-release option is rejected. Consequence: the shared
   deal-facts/entity-authority workstream is now a HARD PREREQUISITE
   on the critical path before the release can claim its filter set —
   WP3A fails on an absent or incompatible shared projection exactly
   as the design's own rule provides. Lane B gains a workstream:
   scope, spec and build the shared-authority projection to
   release-compatibility.
2. Costed deltas D1/D2/D5: presented to Ben; disposition recorded in
   the conversation of 2026-08-02 (D1/D2/D5 pending his three
   yes/nos).
3. Ben directive: prioritize proving core extraction/segmentation
   rigor (see the segmentation-parity assessment of 2026-08-02) and
   reuse the v1 Storylines UI as the interaction baseline for P6.
