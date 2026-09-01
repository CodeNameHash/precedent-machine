# Dividends Work3 parallel prep (2026-08-24)

Research-only handoff for **`DIVIDENDS`**. Programme position: **N1 family #19** (after seventeen sealed families, NO_SHOP #18 prep complete). Repair-plan cluster: wave 4 *dividend coordination covenants* — same stress class as Consideration / Appraisal (sparse comparator set, one operative unit per claim).

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## Summary table

| Field | Value |
|---|---|
| **Comparator claims** | **1** (1 deal: concho) |
| **Est. profiles (Milestone A)** | **~1** |
| **Sealed M5 role schema** | ✅ `BEN_APPROVED_AND_SEALED` — 5 subtype buckets, 1 claim def (`DIVIDEND_COORDINATION_COVENANT`) |
| **Native producer** | ✅ `lib/canonical-v2/native-producer/dividends-producer-prompt.js` — `native-producer-dividends/v1` |
| **Wave** | 4 |
| **Start gate** | **None — Milestone A can start immediately** |

---

## 1. Evidence and calibration

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `preparation/m5/calibration-packs/DIVIDENDS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, wave 4 |
| **Sealed** role schema | `control/family-role-schemas/DIVIDENDS.json` | `BEN_APPROVED_AND_SEALED` |
| Family-specific policy | `control/family-specific-role-policies-v2/DIVIDENDS.json` | `BEN_APPROVED_AND_SEALED` |
| M5 shadow current | `shadow/m5/DIVIDENDS/current.json` | **1** comparator-resolved claim |

**Comparator runs (sealed binding):**

| Deal | Run | Claims |
|---|---|---:|
| concho | `concho-dividends-20260809-2xk-final/` | **1** |

Four supplemental calibration bindings (non-comparator) exist for metsera, modiv, redhat, skywater — do not materialise profiles without comparator backing.

**M5 subtype inventory (5 registered; 1 claim key):**

- `DIVIDENDS::DIVIDEND_COORDINATION` (Work3 first candidate)
- `DIVIDENDS::PERMITTED_PRE_CLOSING_DISTRIBUTION`
- `DIVIDENDS::UNPAID_DECLARED_DISTRIBUTION`
- `DIVIDENDS::CONSIDERATION_ADJUSTMENT_LINK`
- `DIVIDENDS::INTERIM_RESTRICTION_LINK`

All five provision examples in the calibration pack are tagged `DIVIDEND_COORDINATION` pending legal grouping review.

**Gap:** no `m7-v2-repair-contract-dividends-*-authoring-*` control files, no `lib/canonical-v2/m7-v2-dividends-authoring.js`, no dedicated Work3 test file.

---

## 2. Scope and cross-family boundaries

One profile per governed M4 claim (Q01 one-operative-limb). The sole comparator claim is a dividend-coordination covenant on Concho — do not expand to supplemental-only deals.

**Cross-family:** no sealed dependencies. Subtype buckets `CONSIDERATION_ADJUSTMENT_LINK` and `INTERIM_RESTRICTION_LINK` are Q02 link-only against Consideration (#15) and Interim Operating (#21) when those rows surface — this family owns dividend-coordination content only.

**Phase 3:** skip unless Phase 2 proves blocking M3 definition edges (D&O-minimal path).

---

## 3. Implementation checklist (future agent)

1. Phase 2 + Phase 4 authoring authorities + family-local module (`m7-v2-dividends-authoring.js`)
2. Inventory review packet + Ben disposition (flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition)
3. Family package seal + `tests/stage-2y-structure-m7-v2-repair-dividends-work3.test.js`
4. Lawful fixture override via `lawful-work3-fixture-add-override.mjs`

**Do not implement Milestone A from this prep note alone.**

---

## 4. Why #19 first

Smallest remaining independent family (1 claim / 1 profile). Sealed schema, native producer, no Ben hold, no cross-family blocker. Validates sparse-family Milestone A path before wave-3 covenant clusters (113+ claims).
