# Specific performance remedies Work3 parallel prep (2026-08-24)

Research-only handoff for **`SPECIFIC_PERFORMANCE_REMEDIES`**. Programme position: **N1 family #20**. Repair-plan cluster: wave 4 equitable-remedy / remedy-coordination provisions — sparse comparator set, one governed M4 claim per profile, cross-family tension with Termination Fee on sole-remedy rows.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Profile census (landed 8)

| Deal | Profiles | Owner-family hold rows |
|---|---:|---:|
| Concho | 1 | 1 |
| Metsera | 2 | 2 |
| Red Hat | 1 | 1 |
| Skechers | 1 | 1 |
| SkyWater | 1 | 0 (APPROVE) |
| TopBuild | 2 | 2 |
| **Total** | **8** | **7 HOLD / 1 APPROVE** |

All eight profiles carry `LEGAL_GROUPING_REVIEW_REQUIRED`. Seven also carry `COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED` because Termination Fee sole-remedy resolution already names this family as owner while Termination Fee holds the mirror rows — Ben has not ruled which family owns those limbs.

Phase 3 skipped: every calibration example has empty `m3_dependency_ids`.

---

## 2. Open Ben question (do not invent)

**Termination Fee sole-remedy owner-family:** Five Termination Fee `REM-SOLE` rows (plus related carveouts) and seven SPR profiles on shared remedy sections disagree on semantic owner under Q02 (`M5-RULING-ONE-SEMANTIC-OWNER`). The supplemental resolver `native-sole-remedy-resolution/v1` points at `SPECIFIC_PERFORMANCE_REMEDIES`; Termination Fee Milestone A honestly HOLDs its mirror rows. This family mirrors that honesty: seven HOLD rows, SkyWater only APPROVE (no owner-family flag on its terminal).

Cross-family Q02 boundaries are link-only to Termination Fee sole-remedy sections (Concho §8.3, Metsera §8.02, Red Hat §5.06, Skechers §8.3, TopBuild §6.5). Neither family absorbs the other's contested rows pending Ben.

---

## 3. Generator scripts (family-local)

```bash
node scripts/stage-2y-structure-m7-v2-specific-performance-remedies-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-specific-performance-remedies-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-specific-performance-remedies-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-specific-performance-remedies-ben-inventory-disposition.mjs
node scripts/fix-specific-performance-remedies-bindings.mjs
node scripts/stage-2y-structure-m7-v2-specific-performance-remedies-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family SPECIFIC_PERFORMANCE_REMEDIES \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-specific-performance-remedies.json
```

Module: `lib/canonical-v2/m7-v2-specific-performance-remedies-authoring.js`  
Test: `tests/stage-2y-structure-m7-v2-repair-specific-performance-remedies-work3.test.js`
