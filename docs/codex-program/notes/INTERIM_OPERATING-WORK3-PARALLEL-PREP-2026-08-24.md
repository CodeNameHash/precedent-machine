# Interim operating covenants Work3 parallel prep (2026-08-24)

Research-only handoff for **`INTERIM_OPERATING`**. Programme position: **N1 family #21** (after Dividends #19, Specific Performance Remedies #20 prep). Repair-plan cluster: wave 3 *interim operating covenant / ordinary-course restriction* — same stress class as General Covenants (#4) and Closing Conditions (#7) (nested operative units, consent thresholds, exception ladders).

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## Summary table

| Field | Value |
|---|---|
| **Comparator claims** | **113** (6 deals) |
| **Est. profiles (Milestone A)** | **~113** |
| **Sealed M5 role schema** | ✅ `BEN_APPROVED_AND_SEALED` — 5 subtype buckets, 1 claim def (`IOC_RESTRICTION_PRESENT`) |
| **Native producer** | ✅ `lib/canonical-v2/native-producer/ioc-producer-prompt.js` — `native-producer-ioc/v1` |
| **Wave** | 3 |
| **Start gate** | **None — Milestone A can start immediately** (parallel with #19 Dividends) |

---

## 1. Evidence and calibration

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `preparation/m5/calibration-packs/INTERIM_OPERATING.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, wave 3 |
| **Sealed** role schema | `control/family-role-schemas/INTERIM_OPERATING.json` | `BEN_APPROVED_AND_SEALED` |
| Family-specific policy | `control/family-specific-role-policies-v2/INTERIM_OPERATING.json` | `BEN_APPROVED_AND_SEALED` |
| M5 shadow current | `shadow/m5/INTERIM_OPERATING/current.json` | **113** comparator-resolved claims |

**Comparator runs (sealed binding):**

| Deal | Run | Claims |
|---|---|---:|
| concho | `concho-interim-operating-20260809-2xk-final/` | 18 |
| metsera | `metsera-interim-operating-20260809-2xk-final/` | 18 |
| redhat | `redhat-interim-operating-20260809-2xk-final/` | 13 |
| skechers | `skechers-interim-operating-20260809-2xk-final/` | 19 |
| skywater | `skywater-interim-operating-20260809-2xk-final/` | 19 |
| topbuild | `topbuild-interim-operating-20260809-2xk-r2-final/` | 26 |

**M5 subtype inventory (5 registered; 1 claim key):**

- `INTERIM_OPERATING::RESTRICTIVE_COVENANT` (Work3 first candidate)
- `INTERIM_OPERATING::AFFIRMATIVE_COVENANT`
- `INTERIM_OPERATING::CONSENT_STANDARD`
- `INTERIM_OPERATING::THRESHOLD`
- `INTERIM_OPERATING::EXCEPTION`

Six provision examples in calibration pack; all tagged `RESTRICTIVE_COVENANT` pending legal grouping review.

**Classifier boundary:** suppresses overlap with General Covenants (#4) where Interim Operating wins on section title — Milestone A must verify zero M2 terminal collision with sealed General Covenants package (mirror No Other Reps / Representations test pattern).

**Gap:** no authoring control files, no family-local module, no dedicated Work3 test file.

---

## 2. Scope and cross-family boundaries

One profile per governed M4 claim across six comparator deals (Q01 one-operative-limb). TopBuild is densest (26 claims); Red Hat sparsest (13).

**Cross-family:** Dividends (#19) subtype `INTERIM_RESTRICTION_LINK` is Q02 link-only — dividend restrictions embedded in IOC articles stay owned here; Dividends owns coordination covenant only.

**Phase 3:** skip unless Phase 2 audit finds blocking reference edges (D&O-minimal default).

**Scale note:** at 113 profiles this is ~1.5× Antitrust / Regulatory (70) — single-shot seal is within proven scale; no mandatory slice plan unlike NO_SHOP (365).

---

## 3. Implementation checklist (future agent)

1. Phase 2 terminal registry + Phase 4 review authority + family-local module
2. Classifier collision test against sealed General Covenants (#4)
3. Inventory disposition with `LEGAL_GROUPING_REVIEW_REQUIRED` on five-bucket subtype partition
4. Package seal + dedicated test + lawful fixture override

**Do not implement Milestone A from this prep note alone.**

---

## 4. Why #21 (not earlier)

Deferred behind Dividends (#19, 1 claim) and Specific Performance Remedies prep (#20, Ben hold). Selected over Material Contracts (116) and Merger Structure (103) as the wave-3 GC-sibling cluster with the most sealed comparator precedent (six deals, proven producer). Can run in parallel with Dividends once a dedicated agent is available.
