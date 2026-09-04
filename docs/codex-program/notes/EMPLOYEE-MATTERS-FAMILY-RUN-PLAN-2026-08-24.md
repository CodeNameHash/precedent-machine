# EMPLOYEE_MATTERS — Work3 Milestone A run plan

**Family:** N1 #14 `EMPLOYEE_MATTERS`
**Branch:** `codex/recover-m7-20260812`
**Date:** 2026-08-24
**Status:** Milestone A **complete** — 10/10 tests pass, package sealed on disk, nothing committed
**Prep:** `EMPLOYEE-MATTERS-WORK3-PARALLEL-PREP-2026-08-24.md`

---

## Outcome

| Item | Value |
|---|---|
| Profiles | **27** (prep estimated ~25–27) |
| Comparator deals | 6 — Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild |
| Governed M4 claims | 27, all accounted; 0 M4-silent terminals |
| Disposition | 27 APPROVE, 0 HOLD — every row carries `LEGAL_GROUPING_REVIEW_REQUIRED` |
| Subtype buckets | 3 populated of 4 registered (`RETIREMENT_PLAN_ACTION` empty) |
| Phase 3 | **skipped** — every calibration provision example has empty M3 dependency ids |
| Spine | untouched; family-local module only |

Package: `evidence/.../control/m7-v2-repair-family-work3-profile-package-employee-matters.json`
`family_profile_package_id` `0a03846c919dc6a7…`, 340,824 bytes, sha256 `248f302a8f…`,
`validateSingleFamilyPackageInventory` → `FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`.

---

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-employee-matters-work3.test.js
```

2026-08-24, exit 0, **10 pass / 0 fail**, ~23 s.

---

## Why the partition is claim-scale

The calibration pack carries six provision examples but the comparator M4 evidence carries
twenty-seven governed claims. A section-scale partition would fold Concho §6.9 (six comp-item,
service-credit and welfare-relief limbs), Skechers §6.11 dual welfare-relief rows, and Metsera
severance vs benefits splits. Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each independently
operative limb to keep its own profile.

TopBuild §3.1(h) benefit-plan accuracy rep is recorded as a **link-only boundary owned by
`REPRESENTATIONS`**, not as an Employee Matters terminal, under Q02
(`M5-RULING-ONE-SEMANTIC-OWNER`).

---

## Open holds (honest — not bugs)

1. **All 27 rows: `LEGAL_GROUPING_REVIEW_REQUIRED`.** The sealed M5 role schema admits all three
   claim keys under all four subtype buckets; the claim-key → subtype mapping used here is a
   proposal, not a sealed rule.
2. **16 rows: `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE`.** Calibration pack
   tags every provision example `EMPLOYEE_COMPENSATION` while comparator claims populate three
   subtype buckets (`SERVICE_CREDIT`, `WELFARE_RELIEF`).
3. **0 rows: `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`.** All 27 governed claims
   appear in calibration example `m4_claim_ids`.

---

## Regenerate evidence (order matters)

```bash
node scripts/stage-2y-structure-m7-v2-employee-matters-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-employee-matters-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-employee-matters-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-employee-matters-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-employee-matters-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family EMPLOYEE_MATTERS \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-employee-matters.json
```

After any package re-seal, refresh the lawful fixture override (digests are pinned into
`m7-v2-employee-matters-authoring.js` and the dedicated test).

---

## Files touched (family-local only)

- `lib/canonical-v2/m7-v2-employee-matters-authoring.js`
- `tests/stage-2y-structure-m7-v2-repair-employee-matters-work3.test.js`
- `scripts/stage-2y-structure-m7-v2-employee-matters-*.mjs` (5 scripts)
- `scripts/bootstrap-employee-matters-work3-from-proxy-meeting.mjs`
- `evidence/.../control/m7-v2-repair-contract-employee-matters-authoring-phase2-authority-v2.json`
- `evidence/.../control/m7-v2-repair-contract-employee-matters-authoring-phase4-family-profile-package-review-authority.json`
- `evidence/.../control/m7-v2-repair-employee-matters-27-profile-inventory-*`
- `evidence/.../control/m7-v2-repair-contract-work3-employee-matters-*`
- `evidence/.../control/m7-v2-repair-family-work3-profile-package-employee-matters.json`
- `tests/fixtures/.../lawful-work3-family-package-set.json.gz.b64` (override inserted)

**Not touched:** spine, `work3.test.js`, `m7-v2-contract.js`, `m7-v2-deterministic-generator.js`,
sealed other-family packages.
