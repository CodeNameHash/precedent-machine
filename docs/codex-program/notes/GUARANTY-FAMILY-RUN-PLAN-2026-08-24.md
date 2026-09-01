# Guaranty financing party family — runnable plan (current → seal)

Date: 2026-08-24  
Branch: `codex/recover-m7-20260812`  
Authority: `docs/core/PLAN.md`; prep: `GUARANTY-WORK3-PARALLEL-PREP-2026-08-24.md`  
Pattern reference: `DNO-FAMILY-RUN-PLAN-2026-08-24.md` (D&O minimal Phase 2→4 path).

Programme slot: **N1 family #5** — after Termination, MAE, D&O, General Covenants.

---

## What “done” means for Guaranty (Milestone A)

| Milestone | Meaning | Not included |
|---|---|---|
| **A. Family shape seal** | ~5–8 comparator/supplemental blueprint profiles Ben-approved; Work3 Guaranty package registration authority green; honest holds for legal-grouping review | Product serving, M9/M10, full calibration-pack Ben approval as `PROFILE_SET_V1` |

Stop at Phase 4 unapproved package review unless a Ben-approved governed-disclosure gap is identified. **Phase 3 reference chain omitted** (D&O-minimal path).

---

## Profile count estimate (from calibration pack)

Source: `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/GUARANTY_FINANCING_PARTY.json`.

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **1** | Skechers only |
| Sum of `resolution_claims` across comparator runs | **1** | `LIMITED_GUARANTY_DELIVERED` |
| Provision examples (complete source units) | **5** | 3 Skechers + 2 Red Hat supplemental |
| M5 candidate subtype buckets | **4** | `PERFORMANCE_GUARANTY`, `LIMITED_GUARANTY_DELIVERY_OR_STATUS_REP`, `GUARANTY_NO_DEFAULT_REP`, `FINANCING_SOURCE_PROTECTION` |
| M4 silent terminals (provision examples without governed claims) | **4** | §9.15, §9.16, Red Hat §8.06/8.07 |
| Open-world rows (full corpus, not profiles) | **11** | `analysis-policy.json` — review lane only |

**Planning estimate for Stage B blueprint inventory:** **~5 profiles** (one per provision example, partition by `(subtype, deal, section)`), upper bound **~8** if subtype grouping splits further after Ben legal intake.

---

## Current state (verified 2026-08-24)

| Check | State |
|---|---|
| M5 calibration pack + proposed role schema | **Proposed** — `PROPOSED_AWAITING_BEN_APPROVAL` |
| Sealed control role schema | **Sealed** — Q01–Q03 bound via `m5-programme-rulings.json` |
| Native extraction (Skechers comparator) | **On disk** — `skechers-guaranty-financing-party-20260809-2xk-final/` |
| Phase 2 authoring authority | ✅ `m7-v2-repair-contract-guaranty-financing-party-authoring-phase2-authority-v2.json` (5 terminals, 1 M4 claim, 4 silent; GREEN) |
| Phase 3 reference chain | **Skipped** — sparse corpus; no Work1 sealed additive item |
| Phase 4 family profile package review authority | ✅ `m7-v2-repair-contract-guaranty-financing-party-authoring-phase4-family-profile-package-review-authority.json` (5 profiles; GREEN) |
| Dedicated Work3 test module | ✅ `tests/stage-2y-structure-m7-v2-repair-guaranty-work3.test.js` — **9/9 pass** (full Milestone A ladder) |
| `prepareGuarantyFinancingPartyPhase2FamilyProposal` | ✅ GREEN in `m7-v2-guaranty-financing-party-authoring.js` |
| `prepareGuarantyFinancingPartyFamilyProfilePackageReview` | ✅ GREEN |
| Inventory packet + disposition | ✅ 5 APPROVE (`LEGAL_GROUPING_REVIEW_REQUIRED` on all rows) |
| On-disk family package | ✅ `m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json` |
| Termination / MAE / D&O / GC Milestone A | **Complete** — family-local module pattern proven |
| Guaranty Milestone A | ✅ **Complete** — seal → registration → on-disk package green |

**Do not edit `m7-v2-profile-authoring.js` or `work3.test.js`.** Use dedicated module + evidence.

---

## Minimal first implementation slice (recommended)

Land in this order; each step has a RED→GREEN test gate before the next.

| Order | Deliverable | Why first |
|---|---|---|
| **S1** | `m7-v2-repair-contract-guaranty-financing-party-authoring-phase2-authority-v2.json` | ✅ Binds Skechers comparator + Red Hat supplemental provision examples |
| **S2** | `tests/stage-2y-structure-m7-v2-repair-guaranty-work3.test.js` Phase 2 test | ✅ Isolated from Termination merge wars |
| **S3** | `prepareGuarantyFinancingPartyPhase2FamilyProposal` | ✅ GREEN in `m7-v2-guaranty-financing-party-authoring.js` |
| **S4** | Phase 4 review authority + `prepareGuarantyFinancingPartyFamilyProfilePackageReview` | ✅ Profile package review schedule (5 profiles; Phase 3 skipped) |
| **S5** | Inventory review packet + Ben Q01–Q03 ruling capture | ✅ 5 APPROVE disposition; legal grouping flagged |

**Intentionally omitted for Guaranty first slice:** Phase 3 reference materialisation, Work3 Stage A/B, core integration, Phase 5.

**First RED test name pattern:**

```text
Phase2 proposal derives a deterministic unapproved GUARANTY_FINANCING_PARTY partition
```

**GREEN proof command (full Milestone A ladder — 9/9 pass as of 2026-08-24):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-guaranty-work3.test.js
```

Expect exit 0, `# pass 9`. Do **not** pipe to `tail`/`head`; check exit code directly.

Evidence regeneration:

```bash
node scripts/stage-2y-structure-m7-v2-guaranty-financing-party-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-guaranty-financing-party-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-guaranty-financing-party-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-guaranty-financing-party-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-guaranty-financing-party-family-profile-package.mjs
```

Subsequent test name patterns (later slices, same file):

| Slice | Test name pattern |
|---|---|
| Phase 4 review schedule | `Phase4 GUARANTY_FINANCING_PARTY family profile package review returns unapproved proposals without Work3 identities` |
| Ben inventory session | `Work3 GUARANTY_FINANCING_PARTY Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal` |
| Family package seal | `Work3 GUARANTY_FINANCING_PARTY family package seal captures Ben seal without Work3 identity or premature registration` |
| Registration | `Work3 GUARANTY_FINANCING_PARTY family package registration binds seal receipt without activation` |
| Profile package on disk | `Guaranty Milestone A family profile package on disk validates 5 registered profiles` |

---

## Phase 0 — Hygiene (agent)

| Step | Owner | Action | Gate |
|---|---|---|---|
| 0.1 | Agent | Confirm `GUARANTY-WORK3-PARALLEL-PREP-2026-08-24.md` spine no-touch list still accurate | No `work3.test.js` / `m7-v2-profile-authoring.js` edits |
| 0.2 | Agent | Reconcile calibration pack Q01–Q03 `OPEN` vs sealed control role schema | Note in this plan |
| 0.3 | Agent | Flag `LEGAL_GROUPING_REVIEW_REQUIRED` on all five provision examples (pending subtype split) | Phase 2 unresolved_items |

**Comparator binding:**

- `skechers-guaranty-financing-party-20260809-2xk-final/` — 1 governed claim (`LIMITED_GUARANTY_DELIVERED`, §4.13)

**Supplemental examples (non-comparator):**

- Red Hat §8.06, §8.07 via `GUARANTY_FINANCING_PARTY-SUP-REDHAT`

---

## Phase 1 — Phase 2 partition (agent) — **first slice complete**

| Step | Owner | Action | Gate |
|---|---|---|---|
| 1.1 | Agent | ✅ Commit S1 Phase 2 authority v2 JSON | Authority sha256 bound in test |
| 1.2 | Agent | ✅ RED test S2 in `stage-2y-structure-m7-v2-repair-guaranty-work3.test.js` | Exit 0 |
| 1.3 | Agent | ✅ GREEN `prepareGuarantyFinancingPartyPhase2FamilyProposal` | Phase 2 proof passes |

**Stop:** Do not run Ben's inventory session until Phase 4 review schedule exists.

---

## Phase 2 — Phase 4 package review (agent) — **complete**

| Step | Owner | Action | Gate |
|---|---|---|---|
| 2.1 | Agent | ✅ Phase 4 review authority with 5-profile schedule | Schedule matches Phase 2 partition |
| 2.2 | Agent | ✅ GREEN `prepareGuarantyFinancingPartyFamilyProfilePackageReview` | Phase 4 test in guaranty-work3.test.js |
| 2.3 | Agent | ✅ Materialise `m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json` | Contract validation green |

---

## Phase 3 — Ben inventory session (Ben + agent scribe) — **complete (technical default)**

| Step | Owner | Action | Gate |
|---|---|---|---|
| 3.1 | Ben | Review rows using **shape_summary** + deal + `review_flags` | ~5-row packet |
| 3.2 | Ben | Confirm subtype grouping (especially §9.15 financing-source protection vs performance guaranty) | **Pending legal** — flagged `LEGAL_GROUPING_REVIEW_REQUIRED` |
| 3.3 | Ben | Rule on Q01–Q03 | ✅ `GUARANTY-BEN-RULINGS-Q01-Q03-2026-08-24.md` |

**Technical disposition:** 5 APPROVE rows with `legal_grouping_pending_acknowledged` on all profiles.

**Bucket checklist:**

| Bucket | Comparator signal | Ben focus |
|---|---|---|
| Performance guaranty | All 5 examples tagged pending review | Subtype split vs financing-source protection |
| Limited guaranty delivery/status rep | §4.13 governed claim | Delivery vs status representation boundary |
| Guaranty no-default rep | Sparse | Whether any example maps here |
| Financing-source protection | §9.15 candidate | Cross-family routing vs `FINANCING_COVENANTS` |

---

## Phase 4 — Family package seal + registration — **Milestone A complete**

✅ Seal → registration → on-disk package. Activation forbidden. `PERFORMANCE_GUARANTY` subtype grouping remains a legal hold (not a technical blocker).

---

## Execution order (agent “just run at it”)

1. ✅ **Phase 0** — hygiene + prep reconciliation  
2. ✅ **Minimal slice S1–S3** — Phase 2 authority + RED test + facade  
3. ✅ **Phase 2** — Phase 4 review schedule + facade  
4. ✅ **Phase 3** — Ben inventory session (~5 rows, 5 APPROVE)  
5. ✅ **Phase 4** — seal → registration → Milestone A  

**Do not:** copy Termination's full Phase 3 reference chain.  
**Do not:** edit `m7-v2-profile-authoring.js` or `work3.test.js`.  
**Do not:** treat Modiv §5.11 or TopBuild §7.16 as positive guaranty evidence.

---

## Appendix — open legal questions (calibration pack)

- **Q01:** One independently operative authored unit → one proposition; parts are roles/linked children.  
- **Q02:** One owner family; others link (`FINANCING_COVENANTS` boundary).  
- **Q03:** Ambiguous M3 edge — fail dependent proposition only; no silent inference.

**Guaranty-specific stress (vs Termination / MAE):** sparse comparator set (1 governed claim), dual native-producer surface (`guaranty_assertions` vs `financing_mechanics`), subtype classification pending legal grouping review on all five provision examples.
