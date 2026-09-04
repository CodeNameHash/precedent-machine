# Material contracts Work3 parallel prep (2026-08-24)

Research-only handoff for **`MATERIAL_CONTRACTS`**. Programme position: **N1 family #22** (after Interim Operating #21). Repair-plan cluster: wave 4 *material-contract disclosure and threshold covenants* — same stress class as Representations accuracy standards (category criteria, threshold structures, list disclosures).

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## Summary table

| Field | Value |
|---|---|
| **Comparator claims** | **116** (6 deals) |
| **Est. profiles (Milestone A)** | **~116** |
| **Sealed M5 role schema** | ✅ `BEN_APPROVED_AND_SEALED` — 4 subtype buckets, 2 claim defs |
| **Native producer** | ✅ `lib/canonical-v2/native-producer/material-contracts-producer-prompt.js` — `native-producer-material-contracts/v1` |
| **Wave** | 4 |
| **Start gate** | **None — Milestone A can start immediately** (after or parallel with #19 / #21) |

---

## 1. Evidence and calibration

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `preparation/m5/calibration-packs/MATERIAL_CONTRACTS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, wave 4 |
| **Sealed** role schema | `control/family-role-schemas/MATERIAL_CONTRACTS.json` | `BEN_APPROVED_AND_SEALED` |
| Family-specific policy | `control/family-specific-role-policies-v2/MATERIAL_CONTRACTS.json` | `BEN_APPROVED_AND_SEALED` |
| M5 shadow current | `shadow/m5/MATERIAL_CONTRACTS/current.json` | **116** comparator-resolved claims |

**Comparator runs (sealed binding):**

| Deal | Run | Claims |
|---|---|---:|
| concho | `concho-material-contracts-20260809-2xk-final/` | 16 |
| metsera | `metsera-material-contracts-20260809-2xk-final/` | 32 |
| modiv | `modiv-material-contracts-20260809-2xk-final/` | 20 |
| redhat | `redhat-material-contracts-20260809-2xk-final/` | 6 |
| skywater | `skywater-material-contracts-20260809-2xk-final/` | 22 |
| topbuild | `topbuild-material-contracts-20260809-2xk-r2-final/` | 20 |

**Claim definitions (2):**

- `MATERIAL_CONTRACT_BUCKET_PRESENT`
- `MATERIAL_CONTRACT_THRESHOLD_STRUCTURE`

**M5 subtype inventory (4 registered):**

- `MATERIAL_CONTRACTS::MATERIAL_CONTRACT_CATEGORY_CRITERION` (Work3 first candidate)
- `MATERIAL_CONTRACTS::MATERIAL_CONTRACT_DISCLOSURE_LIST`
- `MATERIAL_CONTRACTS::MATERIAL_CONTRACT_STATUS_REPRESENTATION`
- `MATERIAL_CONTRACTS::MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT`

Six provision examples; legal grouping review pending on subtype partition.

**Classifier boundary:** material-contract reps may share printed sections with Representations (#6) — Q02 link-only; verify zero M2 terminal collision with sealed Representations package.

**Gap:** no authoring control files, no family-local module, no dedicated Work3 test file.

---

## 2. Scope and cross-family boundaries

One profile per governed M4 claim (Q01). Metsera is densest (32 claims); Red Hat sparsest (6). Two claim-definition keys drive bucket vs threshold partition.

**Cross-family:** Representations (#6) may own status reps on the same section — Q02 link-only, do not absorb Rep profiles. Termination (#1) breach-termination-right subtype is Q02 link-only against termination-right owner.

**Phase 3:** skip unless Phase 2 proves blocking definition edges.

**Scale note:** 116 profiles — single-shot seal within proven scale (Antitrust 70, Representations 70, Key Defined Terms 76 passed).

---

## 3. Implementation checklist (future agent)

1. Phase 2 + Phase 4 authorities + family-local module
2. Representations collision test (mirror NORF / Rep pattern)
3. Inventory disposition + package seal + dedicated test
4. Lawful fixture override

**Do not implement Milestone A from this prep note alone.**

---

## 4. Why #22

Third medium-large independent family after Interim Operating (#21). No Ben hold, sealed schema, six-deal comparator backing. Queued after wave-3 IOC cluster because Material Contracts shares Rep-cluster boundary stress requiring Representations collision audit.
