# TAX_MATTERS — Work3 Milestone A run plan

**Family:** N1 #13 `TAX_MATTERS`
**Branch:** `codex/recover-m7-20260812`
**Date:** 2026-08-24
**Status:** Milestone A **complete** — 10/10 tests pass, package sealed on disk, nothing committed
**Prep:** `TAX-MATTERS-WORK3-PARALLEL-PREP-2026-08-24.md`

---

## Outcome

| Item | Value |
|---|---|
| Profiles | **17** (prep estimated ~15–17) |
| Comparator deals | 4 — Concho, Skechers, Skywater, TopBuild |
| Governed M4 claims | 17, all accounted; 0 M4-silent terminals |
| Disposition | 17 APPROVE, 0 HOLD — every row carries `LEGAL_GROUPING_REVIEW_REQUIRED` |
| Subtype buckets | 4 populated of 8 registered |
| Phase 3 | **skipped** — every calibration provision example has empty M3 dependency ids |
| Spine | untouched; family-local module only |

Package: `evidence/.../control/m7-v2-repair-family-work3-profile-package-tax-matters.json`
`family_profile_package_id` `63f286316389604e…`, 215,056 bytes, sha256 `5350378332…`,
`validateSingleFamilyPackageInventory` → `FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`.

---

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-tax-matters-work3.test.js
```

2026-08-24, exit 0, **10 pass / 0 fail**, ~16 s.

---

## Why the partition is claim-scale

The calibration pack carries four provision examples but the comparator M4 evidence carries
seventeen governed claims. A section-scale partition would fold Skechers §6.18 (three opinion-
cooperation limbs) and TopBuild §4.23 (four cooperation/protection limbs). Q01
(`M5-RULING-ONE-OPERATIVE-LIMB`) requires each independently operative limb to keep its own
profile.

CC tax-opinion receipt-only closing conditions are recorded as a **link-only boundary owned
by `CLOSING_CONDITIONS`**, not as Tax Matters terminals, under Q02
(`M5-RULING-ONE-SEMANTIC-OWNER`).

---

## Open holds (honest — not bugs)

1. **All 17 rows: `LEGAL_GROUPING_REVIEW_REQUIRED`.** The sealed M5 role schema admits all four
   Tax Matters claim keys under all eight subtype buckets; the claim-key → subtype mapping used
   here is a proposal, not a sealed rule.
2. **7 rows: `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE`.** Calibration pack
   tags every provision example `INTENDED_TAX_TREATMENT` while comparator claims populate four
   subtype buckets.
3. **9 rows: `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`.** Governed M4 claims with
   no matching calibration provision example (e.g. Concho §5.11, §6.18; Skechers §3.17, §4.14,
   §6.18 protection rows).

---

## Regenerate evidence (order matters)

```bash
node scripts/stage-2y-structure-m7-v2-tax-matters-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-tax-matters-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-tax-matters-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-tax-matters-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-tax-matters-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family TAX_MATTERS \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-tax-matters.json
```

After any package re-seal, refresh the lawful fixture override (digests are pinned into
`m7-v2-tax-matters-authoring.js` and the dedicated test).

---

## Files touched (family-local only)

- `lib/canonical-v2/m7-v2-tax-matters-authoring.js`
- `tests/stage-2y-structure-m7-v2-repair-tax-matters-work3.test.js`
- `scripts/stage-2y-structure-m7-v2-tax-matters-*.mjs` (6 scripts)
- `evidence/.../control/m7-v2-repair-contract-tax-matters-authoring-phase2-authority-v2.json`
- `evidence/.../control/m7-v2-repair-contract-tax-matters-authoring-phase4-family-profile-package-review-authority.json`
- `evidence/.../control/m7-v2-repair-tax-matters-17-profile-inventory-*`
- `evidence/.../control/m7-v2-repair-contract-work3-tax-matters-*`
- `evidence/.../control/m7-v2-repair-family-work3-profile-package-tax-matters.json`
- `tests/fixtures/.../lawful-work3-family-package-set.json.gz.b64` (override inserted)

**Not touched:** spine, `work3.test.js`, `m7-v2-contract.js`, `m7-v2-deterministic-generator.js`,
sealed other-family packages.
