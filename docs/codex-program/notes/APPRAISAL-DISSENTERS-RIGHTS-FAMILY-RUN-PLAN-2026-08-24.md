# Appraisal / dissenters' rights family — runnable plan (current → seal)

Date: 2026-08-24  
Branch: `codex/recover-m7-20260812`  
Authority: `docs/core/PLAN.md`; prep: `APPRAISAL-DISSENTERS-RIGHTS-WORK3-PARALLEL-PREP-2026-08-24.md`  
Pattern reference: `FINANCING-COVENANTS-FAMILY-RUN-PLAN-2026-08-24.md` (sparse 5-profile wave-4 cluster).

Programme slot: **N1 family #17** — after Consideration (#15) and Key Defined Terms (#16).

---

## What “done” means for Appraisal / dissenters' rights (Milestone A)

| Milestone | Meaning | Not included |
|---|---|---|
| **A. Family shape seal** | 5 comparator-backed blueprint profiles Ben-approved; Work3 package registration authority green; honest holds for legal grouping and subtype partition | Product serving, M9/M10, full calibration-pack Ben approval as `PROFILE_SET_V1` |

Stop at Phase 4 unapproved package review unless a Ben-approved governed-disclosure gap is identified. **Phase 3 reference chain omitted** (D&O-minimal path; all calibration examples have empty `m3_dependency_ids`).

---

## Profile count (verified)

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **3** | Skechers, Skywater, TopBuild |
| Sum of governed M4 claims | **5** | 3 withdrawal-reconversion + 2 settlement-consent |
| Provision examples | **3** | All tagged `APPRAISAL_STATUS` in calibration pack |
| Sealed M5 subtype buckets | **6** | Two populated: `WITHDRAWAL_RECONVERSION`, `SETTLEMENT_CONSENT` |

**Milestone A inventory:** **5 profiles** — one per governed comparator claim (Q01 one-operative-limb).

---

## Current state (verified 2026-08-24)

| Check | State |
|---|---|
| Phase 2 authoring authority | ✅ `m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase2-authority-v2.json` (5 terminals; Consideration Q02 link-only on Skechers §2.7 + TopBuild §2.1) |
| Phase 3 reference chain | **Skipped** |
| Phase 4 review authority | ✅ `m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase4-family-profile-package-review-authority.json` |
| Dedicated Work3 test | ✅ `tests/stage-2y-structure-m7-v2-repair-appraisal-dissenters-rights-work3.test.js` — **10/10 pass** |
| Family-local module | ✅ `lib/canonical-v2/m7-v2-appraisal-dissenters-rights-authoring.js` |
| Inventory disposition | ✅ 5 APPROVE (`LEGAL_GROUPING_REVIEW_REQUIRED` + `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` on all rows) |
| On-disk family package | ✅ `m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights.json` (70,317 bytes) |
| Lawful Work3 fixture override | ✅ `fixture_digest` `b70c9594…` |
| Appraisal Milestone A | ✅ **Complete** |

**Cross-family boundary:** Consideration (#15) owns `APPRAISAL_RIGHTS_STATUS` on shared printed sections; this family owns withdrawal-reconversion and settlement-consent mechanics only.

**Do not edit `m7-v2-profile-authoring.js`, `m7-v2-contract.js`, or `work3.test.js`.**

---

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-appraisal-dissenters-rights-work3.test.js
```

Regenerate on-disk package + refresh lawful fixture after any re-seal:

```bash
node scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family APPRAISAL_DISSENTERS_RIGHTS \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights.json
```
