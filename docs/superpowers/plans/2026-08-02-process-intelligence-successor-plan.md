# Process Intelligence execution plan — 2026-08-02 amendment

**Status:** DRAFT AMENDMENT — pending Fable delta review (planning
review; NOT one of the programme's three independent adversarial
review milestones, which remain exactly WP3A pre-freeze,
vertical-slice completion if uncovered, and pre-activation).
**Amends:** `2026-07-29-process-intelligence-execution-plan.md`
(ledger-pinned SHA-256 `a255661c…f1d49b0`) under the authority of the
`2026-07-27-process-intelligence-design.md` (both provided by Ben
2026-08-02; neither is superseded — this amendment REBASES the plan
onto current repo reality and imports the Agreement-side lessons of
2026-07-31 → 2026-08-02).
**Source-of-record note:** the parent plan's own rule requires
amendments to be committed to the Deal Storylines
(`precedent-machine-process-design`) repository with the ledger
SHA-256 updated. That repo is not pushed/reachable from this
environment. This file is the working copy; Ben (or a session with
that repo attached) must commit the reviewed amendment there and
update `docs/codex-program/EXECUTION-LEDGER.md`'s pinned hash. Until
then the 2026-07-29 bytes remain the plan of record.

## 1. Rebase: what the ledger shows against the plan's packages

| Package | Plan status → actual (ledger evidence) |
|---|---|
| P-1 gate check | **OBSOLETE.** The protected programme-status/signer apparatus was retired 2026-07-30 (`PM-GOV-BALANCE-01`); milestone Markdown acknowledgements are the only pre-production approval artefact. The plan's every "protected status" reference re-bases onto: exact-commit basis + allowlist per unit (already enforced by CI `phase-allowlist`) + milestone acknowledgements. |
| P0 baselines | **COMPLETE** — both inventories exist and are content-addressed (`evidence/process-intelligence/baseline/`). |
| P1 successor contracts | **COMPLETE** — full tree under `contracts/canonical-v2/successor/process/` incl. exclusivity predicate catalogue v2, completeness-challenge protocol, witness contracts. |
| P2 shared authority | **PARTIAL.** Kernels/manifests exist (`wp-shared-authority-*` allowlists). The WP3A scope decision — full shared-field release vs expressly reduced — is OPEN and is a Ben decision this amendment schedules (§3, A2). |
| P3 process semantics | **COMPLETE** for exclusivity (typed states incl. request≠grant, silence≠refusal; 68-test connector `PI-METSERA-RUNTIME-01`). |
| P4 catalogue/Query IR | **NOT DONE** (product-side; some Query IR groundwork via `PM-METSERA-PRODUCT-ROW-01`). |
| P5 passage serving | **LARGELY COMPLETE** for the pilot shape (phrasebook result rows, presentation, source reader refusal, four surfaces — `PM-METSERA-*` chain). Paragraph-context repeat-click action: NOT yet built (design mandates a successor parent-bound action). |
| P6 interface | **NOT DONE** beyond the guarded preview route (`PM-METSERA-BROWSER-01`). |
| P7 acquisition/extraction machinery | **PILOT-PROVEN** (acquisition, dual enumeration, graph validation, materialisation — sealed Metsera only). Not exercised beyond one deal/family. |
| PE1 Metsera gold | **COMPLETE AND SEALED** (`metsera-gold/exclusivity-gold.v1`, dual enumerations + reconciliation + blind-challenge freeze artefacts). |
| P8 freeze/slices | **OPEN — the live blocker.** Multiple ledger rows carry "Reserved exact contract freeze only." WP3A pre-freeze review + Ben approval + `ContractFreezeAttestation` + fresh same-pair slices have not run. |
| P9 certification | **NOT STARTED** (the 25-deal tuning + one-shot holdout programme; the plan's own estimate makes it the largest block: 220-380 team hours, 15-22 Ben hours). |
| P10/P11 | **NOT STARTED** (plus the M2 envelope debt is a named P10 prerequisite: slim write sets to digest-carried sources before corpus scale). |
| P12 | Post-cutover, unchanged. |

## 2. Lessons imported from the Agreement programme (binding deltas)

D1. **Audit-before-build on every spec.** Every remaining package unit
gets spec → adversarial Fable audit → cheap-model build → Fable
review. This is COMPATIBLE with the parent plan's "cheap Stage 2
review" language: the adversarial audit runs on the SPEC (pre-build,
where three consecutive audits this week each caught critical
fail-open holes), Stage 2 stays the cheap conformance check on the
build, Stage 3 escalation unchanged. No new milestone reviews are
created.

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
  NOW (PE1's pre-registration duty; zero build dependency; the
  custodian rules in the design demand it before any holdout detail
  exists). Ben-hours: minutes, not the P9 15-22h.
- C2. Seal source universes for the 2-3 tuning deals that double as
  Agreement-side deals (Skechers, Modiv, TopBuild proxies) — reuses
  the acquisition machinery, feeds both programmes' breadth, and
  de-risks the ten-minute-per-deal extraction target early.
- C3. Run the dual-enumeration + gold protocol on tuning deal #2 with
  delegated enumeration labour (the design's own budget rule), so P9
  doesn't start cold.

**Order of Ben touchpoints (total ≈ 3-6 hours before P9):** A2 scope
decision → A3 WP3A approval → C1 frame sign-off → then the P9 blind
reads on the plan's own schedule.

## 4. What this amendment does NOT change

The three-milestone review structure; the one-shot holdout rule and
custodian regime; the mandatory predicate floor; the no-narrative-LLM
product boundary; source-of-record residence in the process-design
repo; the freeze-before-broad-extraction gate; Storylines'
evidence-only status; every accepted Sol/Fable disposition. Where any
wording here conflicts with the 2026-07-27 design, the design wins.
