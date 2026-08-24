# Work 4 — M6 formatter gap analysis

**Date:** 24 August 2026  
**Plan authority:** `docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` §Work 4, §8  
**Code reviewed:** `lib/canonical-v2/agreement-projection.js` (working tree, dirty)  
**Constraint:** this note does not edit projection or shared spine files.

## Executive summary

`agreement-projection.js` is a **split module**. The V2 entrypoint (`projectAgreement`, lines 645–827) is largely a formatter: it reads `AGREEMENT_ANALYSIS/V2`, applies view-policy labels/formatters/layouts, emits per-layout `render_bindings` and `omission_ledger`, routes dispositions, and hard-rejects V1. The legacy V1 path (`projectLegacyAgreementV1`, lines 477–542, plus helpers 54–448) is still the **active M6 runner** and embodies every Work 4 prohibition (topic inference, source scanning, hard-coded omission truth). Work 4 is therefore **half done in library code, not done in dispatch**.

---

## 1. Work 4 requires vs current behaviour

| Work 4 / §8 requirement | V2 `projectAgreement` | Legacy `projectLegacyAgreementV1` + runners |
|---|---|---|
| No topic inference from claim keys / attributes | Pass — uses `profile.classification_path` and M5 `field_key` facts only | **Fail** — `comparisonPointTexts`, `humaniseKey`, `COMPARISON_POINT_LABELS` |
| No source scanning for actor/timing/exception | Pass — no raw source reads | **Fail** — `actorTexts` regex-filters `ACTOR_OR_PARTIES` by span and party pattern; `attributeTexts` mines `MEMBER_FACTS` |
| Render approved hierarchy + typed material facts | Pass — `v2Classification`, profile `display_order`, `renderV2Fact` | **Fail** — builds prose comparison points from inferred topics |
| Render bindings: fact ID, field key, label, typed digest, rendered value, layout | Pass — `v2RenderBinding` (630–642); validated by `validateRenderBinding` in `m7-v2-contract.js` | **Absent** — `fieldLineage` only stores opaque text blobs |
| Separate compact / expanded omission ledgers; no hard-coded zero | Pass — per-layout `omission_ledger` (747–750); omits only policy-permitted facts | **Fail** — single flat `omissions[]` with `material_fact_omitted: false` always (500, 512, 534) |
| Compact floor (applies-to + full classification) | Pass when view policy defines `required_classification_levels` / `required_field_keys`; enforced in `validateProjectionRows` | **Fail** — compact line is first inferred comparison point only (`compactText` 353–357) |
| Deterministic typed-value formatting | Pass — `renderV2Fact` + view-policy formatter map | **Partial** — `structuredValue` / `STRUCTURED_VALUE_LABELS` re-encode enums in M6 |
| Source-limited drafting shown clearly | Pass — `source_limitation` block for `APPROVED_LIMITED` (755–761) | **Absent** |
| Incomplete / ambiguous → review lane | Pass — `review_rows` from `REVIEW_ONLY` dispositions (777–784) | Partial — review lane exists but uses inferred `expandedText` as “proposed” card |
| Accept only `AGREEMENT_ANALYSIS/V2`; block V1 on M7 V2 path | Pass at API (650–651) + `validateProjectionV2` | **Fail at dispatch** — `scripts/stage-2y-structure-m6-project.mjs` and `scripts/stage-2y-structure-generalisation-shadow.mjs` still call `projectLegacyAgreementV1` on V1 analysis |

**Topic inference (plan §3.4, §8):** M6 must not discover legal meaning. Legacy path derives “comparison points” from `claim_definition_keys`, `representation_topics`, `owner_id`, `restriction_category`, etc., then humanises internal codes into lawyer-facing topics.

**Source scanning (plan §8):** Legacy `actorTexts` (213–228) inspects provenance spans and applies a Parent/Company regex cap — that is M5’s job.

**Omission ledgers (plan §8, §10 case 15):** V2 computes ledger entries from `display_rule` + layout `permitted_omission_rule_ids` (712–724). Legacy asserts `material_fact_omitted: false` without reconciling displayed vs display-required facts.

**V1 blocking (plan §8, Work 0):** Library V2 gate exists; historical 1,111-row supersession is in Work 0 evidence. **M7 V2 consumer dispatch still projects V1** via `m6-project.mjs` (line 253). Work 4 must close that route or fence it as legacy-verification-only.

---

## 2. Functions / lines that violate Work 4

All paths are in `/Users/bengoodchild/precedent-machine-restored-20260812/lib/canonical-v2/agreement-projection.js`.

### Legacy V1 semantic path (remove or quarantine from M7 V2 dispatch)

| Lines | Function / constant | Violation |
|---|---|---|
| 99–119 | `humaniseKey` | Humanises internal claim keys into supposed legal meaning |
| 127–152 | `COMPARISON_POINT_LABELS` | M6-owned topic vocabulary |
| 154–190 | `comparisonPointTexts` | Topic inference from claim keys and member attributes |
| 192–200 | `hasCompleteComparisonPoint` | M6 decides whether a legal comparison point is “proved” |
| 202–211 | `spanInsideAuthoredSource` | Source-span inspection for display filtering |
| 213–228 | `actorTexts` | Scans actor roles with regex and length cap |
| 239–262 | `ATTRIBUTE_EXCLUSIONS` | M6 suppresses attributes it deems non-display |
| 295–327 | `STRUCTURED_VALUE_LABELS`, `structuredValue` | M6 re-labels enum tokens |
| 329–342 | `attributeTexts` | Mines and filters member attributes for “key facts” |
| 344–351, 364–365 | `structuredSupplementaryTexts`, timing/qualification lines | Supplementary scanning with dedup against inferred topics |
| 353–374 | `compactText`, `expandedText` | Prose comparison cards, not typed render bindings |
| 496–514 | `omissions` in `projectLegacyAgreementV1` | `material_fact_omitted: false` without proof |

### V2 path — remaining gaps (not topic inference, but Work 4 completion)

| Lines | Issue |
|---|---|
| 477–542, 829–832 | Legacy API still exported alongside V2; no runtime guard preventing accidental V1 use on repair path |
| 769 | `group_id: null` always — grouping by M5 `equivalence_signature` not implemented (§8 permits grouping when profile authorises) |
| 645–827 | No integration test file `stage-2y-structure-m7-v2-repair-work4.test.js` yet (manifest references it) |
| — | Runners (`m6-project.mjs`, `generalisation-shadow.mjs`) not switched to `projectAgreement` + V2 analysis |

Shared validator (`m7-v2-contract.js` `validateProjectionV2`, 11352+) already enforces compact floor, render reconciliation, per-layout omission authority, and V1 schema rejection — **tests exercise this more strictly than production runners**.

---

## 3. Minimal change list for Work 4 agent

**Do not touch M5 consolidation or sealed M0–M4 bytes.**

1. **Dispatch fence** — In `scripts/stage-2y-structure-m6-project.mjs` (and any M7 V2 shadow runner), call `projectAgreement` only on `AGREEMENT_ANALYSIS/V2` that has passed `validateAnalysisV2`; keep `projectLegacyAgreementV1` behind an explicit legacy-verification flag, not the default repair path.
2. **Quarantine legacy helpers** — Move or clearly segregate lines 15–448 + `projectLegacyAgreementV1` so the M7 V2 module surface is formatter-only; leave exports only if Work 0 historical replay still needs them under `FAILED_HUMAN_REVIEW_NOT_CONSUMABLE`.
3. **Wire V2 view policy** — Ensure repair candidate registration binds `STAGE_2Y_M7_V2_VIEW_POLICY/V1` (labels, layouts, formatters, grouping policy) consumed by `projectAgreement`.
4. **Omission reconciliation** — Keep per-layout ledgers; add projection-level counts if receipt schema requires them (e.g. material omission count derived from ledger, never hard-coded `false`).
5. **Grouping (if in scope)** — When `viewPolicy.grouping_policy.allowed` and profile `grouping_policy.allowed`, set `group_id` from exact `equivalence_signature` equality only (§8).
6. **Receipt / manifest** — Add Work 4 finalise + validate scripts and `tests/stage-2y-structure-m7-v2-repair-work4.test.js` per execution-manifest contract (already stubbed in `execution-manifest.test.js` 3195–3197).
7. **Prove V1 bypass** — Extend registration / manifest tests so any argv binding `projectLegacyAgreementV1` to a non-superseded consumer fails.

**Out of scope for Work 4:** fixing termination extraction (Work 3), new family profiles, expression compilation.

---

## 4. What Work 3 Termination must finish before Work 4 starts

Work 3 class 1 (plan §9) is **nested conditions and provisos**, archetype **Termination** (item 2). M6 can only format what M5 emits; Work 4 on real termination rows is blocked until:

| Prerequisite | Evidence / status |
|---|---|
| Ben-approved V2 termination subtype profiles with dimension evidence, fixtures, subtype-tree declaration | Work 3 family packages (`m7-v2-repair-family-work3-profile-package-termination.json`); Phase 4 review still reports **45 unapproved proposals** (`work3.test.js` ~16563) |
| Item 2 expression topology in M5 (`ANY_OF` cures, `EARLIER_OF` deadlines, `EXCEPTION_TO` proviso) | `tests/canonical-v2-m7-v2-contract-nested-expression-evidence.test.js`, `tests/canonical-v2-m7-v2-deterministic-generator-nested-expression.test.js` — M5-side, not projection |
| Termination Phase 2/3 authoring authorities sealed (reference resolution, temporal phase 1, governed disclosure notes) | Bindings in `work3.test.js` / `m7-v2-contract.js` `TERMINATION_PHASE2_*` |
| Termination Work3 Stage B blueprint + B9e note | **Done in repo** (`prepareTerminationWork3StageBBlueprintProposal`, commit `b9bca8c7`); core integration + inventory review still open. Historical `STAGE_B_HANDOFF.md` producer v12 work is revoked — not a blocker. |
| Work 3 execution manifest closure | `prepareWork3` must produce PASS receipt with **25** family profile packages, dimension-evidence bindings, Item 39 overlay fixture, C3 inventory digests (`execution-manifest.test.js` Work4 bootstrap tests 4908+) |
| Rich V2 `AGREEMENT_ANALYSIS/V2` for termination fixed-sample items | Consolidation output for item 2 — formatter tests can use contract fixtures before corpus-wide termination PASS |

**Practical gate:** Work 4 **contract/unit formatter work** can proceed on synthetic scenarios in `stage-2y-structure-m7-v2-repair-contract.test.js` now. Work 4 **candidate transition / receipt** (`prepareVerifiedWork4`) requires Work 3 manifest + receipt PASS with full profile inventory, not merely library formatter code.

---

## 5. Test files that prove Work 4

| File | What it proves |
|---|---|
| `tests/stage-2y-structure-m7-v2-repair-contract.test.js` | **Primary.** `projectAgreement` determinism (11613+), per-layout omission ledgers (11636–11791), source-limited rows (11793+), delegated ownership links (11831+), all formatters (11867+), V1/wrong-policy rejection (11928+), `validateProjectionV2` negatives (projection omission/truncation/label-swap cases ~11550+) |
| `tests/stage-2y-structure-m7-v2-repair-work0.test.js` | V1 1,111-row supersession `FAILED_HUMAN_REVIEW_NOT_CONSUMABLE`; `NO_V1_SEMANTIC_ADMISSION` |
| `tests/stage-2y-structure-m7-v2-repair-registration.test.js` | V1 analysis cannot masquerade as V2 base set (`V1_SEMANTIC_FALLBACK`, ~1167); candidate binds M6 script path |
| `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` | Work 4 bootstrap, Work 3 predecessor closure, candidate transition authority (~3084+, 4908+) |
| `tests/stage-2y-structure-m7-v2-repair-work4.test.js` | **Not present yet** — required by manifest; add with Work 4 receipt |
| `tests/stage-2y-structure-m6-projection.test.js` | Legacy V1 only — historical 1,111-row behaviour; **not** Work 4 acceptance |
| `tests/canonical-v2-m7-v2-contract-nested-expression-evidence.test.js` | M5 termination expression evidence — prerequisite, not M6 formatter proof |

**Proof command (Work 4 agent):**

```bash
CI=true node --test tests/stage-2y-structure-m7-v2-repair-contract.test.js
```

Filter to `projectAgreement` tests once Work 4 test file exists.

---

## Diagram: current vs target dispatch

```text
Today (repair path leak):
  AGREEMENT_ANALYSIS/V1 → projectLegacyAgreementV1 → AGREEMENT_PROJECTION/V1 (1,111 rows)

Target (Work 4):
  AGREEMENT_ANALYSIS/V2 → validateAnalysisV2 → projectAgreement → AGREEMENT_PROJECTION/V2
  AGREEMENT_ANALYSIS/V1 → superseded ledger only (legacy verification)
```
