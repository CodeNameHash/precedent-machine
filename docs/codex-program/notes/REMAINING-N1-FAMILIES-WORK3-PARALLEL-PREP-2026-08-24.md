# Remaining N1 families Work3 parallel prep (2026-08-24)

Combined research handoff for the **five remaining unsealed families** after individual prep notes for #19–#22. Programme context: **seventeen families sealed** on disk (#1–#17 including KEY_DEFINED_TERMS and APPRAISAL_DISSENTERS_RIGHTS); **NO_SHOP (#18)** prep complete; **eight families** remain without Work3 profile packages.

Individual prep notes exist for immediate starters:

- `DIVIDENDS-WORK3-PARALLEL-PREP-2026-08-24.md` (#19)
- `INTERIM_OPERATING-WORK3-PARALLEL-PREP-2026-08-24.md` (#21)
- `MATERIAL-CONTRACTS-WORK3-PARALLEL-PREP-2026-08-24.md` (#22)

**Do not edit shared spine.**

---

## Unsealed inventory (verified on disk 2026-08-24)

| N1 # | Family | Package on disk | Seal receipt | Prep note |
|---:|---|---|---|---|
| 18 | **NO_SHOP** | ❌ | ❌ | `NO-SHOP-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 19 | **DIVIDENDS** | ❌ | ❌ | individual ✅ |
| 20 | **SPECIFIC_PERFORMANCE_REMEDIES** | ❌ | ❌ | §20 below |
| 21 | **INTERIM_OPERATING** | ❌ | ❌ | individual ✅ |
| 22 | **MATERIAL_CONTRACTS** | ❌ | ❌ | individual ✅ |
| 23 | **MERGER_STRUCTURE_CLOSING** | ❌ | ❌ | §23 below |
| 24 | **MISC_BOILERPLATE** | ❌ | ❌ | §24 below |
| 25 | **CAPITALISATION** | ❌ | ❌ | §25 below |

**Sealed mid-flight (now complete):** KEY_DEFINED_TERMS (#16), APPRAISAL_DISSENTERS_RIGHTS (#17) — both have `m7-v2-repair-family-work3-profile-package-*.json` and seal receipts on disk.

---

## §20 — SPECIFIC_PERFORMANCE_REMEDIES (#20)

| Field | Value |
|---|---|
| **Comparator claims** | **8** (6 deals) |
| **Est. profiles** | **~8** |
| **Sealed schema** | ✅ `BEN_APPROVED_AND_SEALED` — 7 subtype buckets, 1 claim def (`SPECIFIC_PERFORMANCE_REMEDY_PRESENT`) |
| **Producer** | ✅ `specific-performance-remedies-producer-prompt.js` — `native-producer-specific-performance-remedies/v1` |
| **Wave** | 4 |
| **Start gate** | **Ben hold — prep only; do not start Milestone A inventory disposition until Termination Fee (#10) sole-remedy owner-family question is resolved** |

**Comparator spread:** concho 1, metsera 2, redhat 1, skechers 1, skywater 1, topbuild 2.

**Subtypes (7):** `GENERAL_EQUITABLE_RELIEF` (first candidate), `CLOSING_ENFORCEMENT`, `NON_OBJECTION`, `BOND_SECURITY_WAIVER`, `REMEDY_COORDINATION`, `REMEDY_ACTION_EXTENSION`, `COST_SHIFT`.

**Cross-family blocker:** Termination Fee (#10) holds ten `REM-SOLE` rows (5 sole-remedy-link + 5 carve-out) with `owner_family: SPECIFIC_PERFORMANCE_REMEDIES` from supplemental resolver `native-sole-remedy-resolution/v1` — `COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED` (the one Termination Fee item that needs Ben). Milestone A authoring can proceed in parallel with Phase 2 evidence, but **inventory disposition must flag held rows** until Ben decides whether this family owns the remedy those fee rows cap or the fee caps the remedy.

**Why #20 (not #19):** Sparse (8 claims) and sealed schema, but Ben hold blocks clean disposition. Prep now so implementation agent has boundary map when hold lifts.

---

## §23 — MERGER_STRUCTURE_CLOSING (#23)

| Field | Value |
|---|---|
| **Comparator claims** | **103** (7 deals) |
| **Est. profiles** | **~103** |
| **Sealed schema** | ✅ `BEN_APPROVED_AND_SEALED` — 8 subtype buckets, 2 claim defs |
| **Producer** | ✅ `merger-structure-producer-prompt.js` — `native-producer-merger-structure/v1` |
| **Wave** | 4 |
| **Start gate** | **None — Milestone A can start after #21–#22 or in parallel** |

**Comparator spread:** concho 13, metsera 10, modiv 14, redhat 15, skechers 14, skywater 17, topbuild 20.

**Claim defs:** `MERGER_STRUCTURE_MECHANIC_PRESENT`, `MERGER_TRANSACTION_STEP`.

**Subtypes (8):** `TRANSACTION_STEP` (first candidate), `TRANSACTION_PLAN`, `CLOSING`, `EFFECTIVE_TIME`, `LEGAL_EFFECT`, `GOVERNANCE_SUCCESSION`, `ORGANISATIONAL_DOCUMENT`, `BOARD_DESIGNATION`.

**Cross-family:** Closing Conditions (#7) and Proxy / Meeting (#12) Q02 boundaries for stockholder approval and meeting mechanics — link-only, do not duplicate CC / Proxy profiles.

---

## §24 — MISC_BOILERPLATE (#24)

| Field | Value |
|---|---|
| **Comparator claims** | **114** (6 deals) |
| **Est. profiles** | **~114** |
| **Sealed schema** | ✅ `BEN_APPROVED_AND_SEALED` — 12 subtype buckets, 1 claim def (`MISC_BOILERPLATE_MECHANIC_PRESENT`) |
| **Producer** | ✅ `remedies-misc-producer-prompt.js` — `native-producer-remedies-misc/v1` |
| **Wave** | 4 |
| **Start gate** | **None — Milestone A can start after #21–#23** |

**Comparator spread:** concho 17, metsera 16, modiv 14, skechers 24, skywater 17, topbuild 26.

**Subtypes (12):** `GOVERNING_LAW` (first candidate), `FORUM`, `ASSIGNMENT`, `AMENDMENT_WAIVER`, `NOTICE`, `ENTIRE_AGREEMENT`, `THIRD_PARTY_BENEFICIARY`, `SEVERABILITY`, `COUNTERPARTS`, `SURVIVAL`, `CONSTRUCTION`, `EXPENSES`.

**Cross-family:** Survival subtype may Q02-link to Termination (#1) rights-survival rows — do not duplicate Termination profiles. Low semantic coupling otherwise.

---

## §25 — CAPITALISATION (#25)

| Field | Value |
|---|---|
| **Comparator claims** | **0** (sealed comparator registry empty) |
| **Est. profiles** | **Unknown — blocked** |
| **Sealed schema** | ✅ `BEN_APPROVED_AND_SEALED` — 7 subtype buckets, 7 claim defs |
| **Producer** | ✅ `capitalisation-producer-prompt.js` — `native-producer-capitalisation/v1` (mature; QXO serving path exists) |
| **Wave** | 4 |
| **Start gate** | **Blocked — no sealed M5 comparator runs.** Calibration pack has **5 supplemental-only** bindings (concho, metsera, modiv, redhat, skywater) classified `SUPPLEMENTAL_NON_COMPARATOR`. Milestone A cannot seal until comparator resolution runs exist and enter the sealed binding set. |

**Claim defs (7):** `CAPITALISATION_AUTHORISED_CAPITAL`, `ISSUED_AND_OUTSTANDING`, `RESERVED_OR_ISSUABLE_SECURITIES`, `EQUITY_AWARD_INVENTORY`, `PARTNERSHIP_OR_SUBSIDIARY_EQUITY`, `CAPITALISATION_ABSENCE`, `VALID_ISSUANCE_STATUS`.

**Subtypes (7):** match claim defs one-to-one (`AUTHORISED_CAPITAL` first candidate).

**Note:** Representations (#6) often carries capitalisation reps on the same sections — expect Q02 link-only boundary once comparator data exists. QXO capitalisation product path (`lib/canonical-v2/qxo-capitalisation-*`) is serving/metric lane, not Work3 profile inventory.

---

## §18 — NO_SHOP (queued; prep already complete)

| Field | Value |
|---|---|
| **Comparator claims** | **365** (7 deals) |
| **Est. profiles** | **~365** (mandatory **four-slice seal plan**) |
| **Sealed schema** | ✅ 8 subtype buckets, 13 claim defs |
| **Producer** | ✅ `no-shop-producer-prompt.js` v3 |
| **Start gate** | **KEY_DEFINED_TERMS (#16) prerequisite now met** (Acquisition Proposal / Superior Proposal Q02 boundary sealed). Milestone A still requires four-slice plan: (A) prohibited + exception, (B) recommendation-change, (C) standstill/rep/cease, (D) match periods. See `NO-SHOP-WORK3-PARALLEL-PREP-2026-08-24.md`. |

---

## Recommended Milestone A start order

| Priority | N1 # | Family | Claims | Start gate | Rationale |
|---:|---:|---|---:|---|---|
| 1 | 19 | **DIVIDENDS** | 1 | ✅ immediate | Smallest; validates sparse path |
| 2 | 21 | **INTERIM_OPERATING** | 113 | ✅ immediate | Wave-3 GC sibling; parallel with #19 |
| 3 | 22 | **MATERIAL_CONTRACTS** | 116 | ✅ immediate | Rep-cluster boundary; six deals |
| 4 | 23 | **MERGER_STRUCTURE_CLOSING** | 103 | ✅ immediate | Seven deals; CC/Proxy Q02 only |
| 5 | 24 | **MISC_BOILERPLATE** | 114 | ✅ immediate | Independent boilerplate cluster |
| 6 | 18 | **NO_SHOP** | 365 | four-slice plan | Largest; #16 prerequisite cleared |
| 7 | 20 | **SPECIFIC_PERFORMANCE_REMEDIES** | 8 | **Ben hold** | Prep ready; wait on Termination Fee sole-remedy owner |
| 8 | 25 | **CAPITALISATION** | 0 | **comparator blocked** | Needs sealed comparator runs first |

**Parallelism:** #19 Dividends can run alone or alongside #21–#22. #20 and #25 should not consume implementation bandwidth until their gates clear.

---

## Shared implementation pattern (all families)

Mirror Consideration / Appraisal / Employee Matters structure:

1. Phase 2 + Phase 4 authoring authorities
2. Family-local module (`lib/canonical-v2/m7-v2-<family>-authoring.js`)
3. Inventory review packet + Ben disposition
4. Family package generator + seal receipt
5. Dedicated `tests/stage-2y-structure-m7-v2-repair-<family>-work3.test.js`
6. Lawful fixture override via `lawful-work3-fixture-add-override.mjs`

**Do not implement Milestone A from this combined note alone.**
