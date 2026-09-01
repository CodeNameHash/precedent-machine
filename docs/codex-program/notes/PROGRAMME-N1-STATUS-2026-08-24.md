# Programme N1 status — pickup sheet (live)

**Updated:** 2026-09-01 (UTC-4). **Twenty-four** families have Milestone A packages on disk (#1–#24 except Capitalisation). **CAPITALISATION (#25) is blocked** (0 comparator claims). The lawful fixture has **24** `on_disk_family_package_overrides`.
**Branch:** `codex/recover-m7-20260812` (confirm with `git status --short --branch`)  
**Authority:** `docs/core/PLAN.md`, `docs/core/OPERATING-RULES.md`

**Technical next (no Ben gate):** Capitalisation comparator write-up (`CAPITALISATION-COMPARATOR-BLOCKAGE-2026-08-25.md`); fixture-proof crosscheck (**0 failures**, 5,240 proofs, 2026-09-01); spine merge PR6+ queue (`WORK3-FAMILY-LOCAL-TO-SPINE-MERGE-PLAN-2026-08-24.md` §11). See also `N1-NEXT-FAMILY-2026-08-24.md`.

---

## Done — Work3 Milestone A (twenty-four families with on-disk packages)

| Family | Profiles | Disposition | On-disk package | Tests (family file) | Run plan |
|---|---:|---|---|---|---|
| **Termination** | 45 | 41 APPROVE + 4 PARTIAL outside-date | `m7-v2-repair-family-work3-profile-package-termination.json` (re-sealed Blocker A 2026-08-24: 1,121,991 bytes) | `work3.test.js` Milestone A slice 19 pass | `TERMINATION-FAMILY-RUN-PLAN-2026-08-24.md` |
| **MAE_DEFINITION** | 4 | 4 APPROVE (review stamps acknowledged) | `m7-v2-repair-family-work3-profile-package-mae-definition.json` | `work3-mae.test.js` 17 pass | `MAE-FAMILY-RUN-PLAN-2026-08-24.md` |
| **DNO_INDEMNIFICATION** | 33 | 33 APPROVE | `m7-v2-repair-family-work3-profile-package-dno-indemnification-item-42-successor-2026-09-01.json` (431,970 bytes) | `dno-work3.test.js` 12 pass | `DNO-FAMILY-RUN-PLAN-2026-08-24.md` |
| **GENERAL_COVENANTS** | 54 | 54 APPROVE (6 ACCESS item-44 stamps) | `m7-v2-repair-family-work3-profile-package-general-covenants.json` | `general-covenants-work3.test.js` 9 pass | `GENERAL-COVENANTS-FAMILY-RUN-PLAN-2026-08-24.md` |
| **GUARANTY_FINANCING_PARTY** | 5 | 5 APPROVE (legal grouping pending) | `m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json` | `guaranty-work3.test.js` 9 pass | `GUARANTY-FAMILY-RUN-PLAN-2026-08-24.md` |
| **CLOSING_CONDITIONS** | 57 | 41 APPROVE + 16 HOLD (subtype partition unresolved) | `m7-v2-repair-family-work3-profile-package-closing-conditions.json` | `closing-conditions-work3.test.js` 11 pass | `CLOSING-CONDITIONS-FAMILY-RUN-PLAN-2026-08-24.md` |
| **REPRESENTATIONS** | 70 | 70 APPROVE (subtype partition pending legal; 15 knowledge rows link-only) | `m7-v2-repair-family-work3-profile-package-representations.json` | `representations-work3.test.js` 11 pass | `REPRESENTATIONS-FAMILY-RUN-PLAN-2026-08-24.md` |
| **FINANCING_COVENANTS** | 5 | 5 APPROVE (subtype grouping pending legal; 2 divergence + 1 outside-calibration stamps) | `m7-v2-repair-family-work3-profile-package-financing-covenants.json` | `financing-covenants-work3.test.js` 9 pass | `FINANCING-COVENANTS-FAMILY-RUN-PLAN-2026-08-24.md` |
| **TERMINATION_FEE** | 20 | 8 APPROVE + 12 HOLD (10 comparator owner-family, 2 reverse-side fee) | `m7-v2-repair-family-work3-profile-package-termination-fee.json` | `termination-fee-work3.test.js` 13 pass | `TERMINATION-FEE-FAMILY-RUN-PLAN-2026-08-24.md` |
| **NO_OTHER_REPS_FRAUD** | 36 | 36 APPROVE (subtype partition pending legal; 24 shared-citation + 3 Representations link-only) | `m7-v2-repair-family-work3-profile-package-no-other-reps-fraud.json` | `no-other-reps-fraud-work3.test.js` 11 pass | `NO-OTHER-REPS-FRAUD-FAMILY-RUN-PLAN-2026-08-24.md` |
| **ANTITRUST_REGULATORY** | 70 | 70 APPROVE (subtype partition pending legal; 6 M5 bucket unresolved, 5 non-HSR, 12 one-sided) | `m7-v2-repair-family-work3-profile-package-antitrust-regulatory.json` | `antitrust-regulatory-work3.test.js` 11 pass | `ANTITRUST-REGULATORY-WORK3-PARALLEL-PREP-2026-08-24.md` |
| **PROXY_MEETING** | 31 | 31 APPROVE (subtype partition pending legal; 27 calibration divergence, 2 outside-calibration) | `m7-v2-repair-family-work3-profile-package-proxy-meeting.json` | `proxy-meeting-work3.test.js` 10 pass | `PROXY-MEETING-WORK3-PARALLEL-PREP-2026-08-24.md` |
| **TAX_MATTERS** | 17 | 17 APPROVE (subtype grouping pending legal; 7 divergence, 9 outside-calibration) | `m7-v2-repair-family-work3-profile-package-tax-matters.json` | `tax-matters-work3.test.js` 10 pass | `TAX-MATTERS-FAMILY-RUN-PLAN-2026-08-24.md` |
| **EMPLOYEE_MATTERS** | 27 | 27 APPROVE (subtype grouping pending legal; 16 divergence, 0 outside-calibration) | `m7-v2-repair-family-work3-profile-package-employee-matters.json` | `employee-matters-work3.test.js` 10 pass | `EMPLOYEE-MATTERS-FAMILY-RUN-PLAN-2026-08-24.md` |
| **CONSIDERATION** | 7 | 7 APPROVE (subtype grouping pending legal; 7 divergence, 0 outside-calibration) | `m7-v2-repair-family-work3-profile-package-consideration.json` | `consideration-work3.test.js` 10 pass | `CONSIDERATION-WORK3-PARALLEL-PREP-2026-08-24.md` |
| **KEY_DEFINED_TERMS** | 76 | 76 APPROVE (subtype grouping pending legal; 41 divergence, 20 outside-calibration; Representations knowledge rows link-only) | `m7-v2-repair-family-work3-profile-package-key-defined-terms.json` (948,264 bytes) | `key-defined-terms-work3.test.js` 10 pass | `KEY-DEFINED-TERMS-WORK3-PARALLEL-PREP-2026-08-24.md` |
| **APPRAISAL_DISSENTERS_RIGHTS** | 5 | 5 APPROVE (subtype grouping pending legal; 5 divergence, 0 outside-calibration; Consideration Q02 link-only on shared sections) | `m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights.json` (70,317 bytes) | `appraisal-dissenters-rights-work3.test.js` 10 pass | `APPRAISAL-DISSENTERS-RIGHTS-FAMILY-RUN-PLAN-2026-08-24.md` |
| **NO_SHOP** | 365 | 365 APPROVE (subtype grouping pending legal; 88 divergence, 94 outside-calibration; KEY_DEFINED_TERMS / TERMINATION_FEE / PROXY_MEETING / TERMINATION Q02 link-only) | `m7-v2-repair-family-work3-profile-package-no-shop.json` (4,394,952 bytes) | `no-shop-work3.test.js` 10 pass | `NO-SHOP-WORK3-PARALLEL-PREP-2026-08-24.md` |
| **DIVIDENDS** | 1 | 1 APPROVE (subtype grouping pending legal; 0 divergence, 0 outside-calibration) | `m7-v2-repair-family-work3-profile-package-dividends.json` (18,004 bytes) | `dividends-work3.test.js` 10 pass | `DIVIDENDS-WORK3-PARALLEL-PREP-2026-08-24.md` |
| **SPECIFIC_PERFORMANCE_REMEDIES** | 8 | 1 APPROVE + 7 HOLD (Termination Fee sole-remedy owner-family open; no invented ruling) | `m7-v2-repair-family-work3-profile-package-specific-performance-remedies.json` (110,000 bytes) | `specific-performance-remedies-work3.test.js` 10 pass | `SPECIFIC-PERFORMANCE-REMEDIES-FAMILY-RUN-PLAN-2026-08-24.md` |
| **INTERIM_OPERATING** | 113 | 113 APPROVE (subtype grouping pending legal) | `m7-v2-repair-family-work3-profile-package-interim-operating.json` (1,418,275 bytes) | `interim-operating-work3.test.js` 11 pass | `INTERIM_OPERATING-WORK3-PARALLEL-PREP-2026-08-24.md` |
| **MATERIAL_CONTRACTS** | 116 | 116 APPROVE (subtype grouping pending legal) | `m7-v2-repair-family-work3-profile-package-material-contracts.json` (1,497,422 bytes) | `material-contracts-work3.test.js` 11 pass | `MATERIAL-CONTRACTS-WORK3-PARALLEL-PREP-2026-08-24.md` |
| **MERGER_STRUCTURE_CLOSING** | 103 | 103 APPROVE (subtype grouping pending legal; 23 divergence, 71 outside-calibration; Closing Conditions / Proxy Q02 link-only) | `m7-v2-repair-family-work3-profile-package-merger-structure-closing.json` (1,308,628 bytes) | `merger-structure-closing-work3.test.js` 11 pass | combined note §23 |
| **MISC_BOILERPLATE** | 114 | 114 APPROVE (subtype grouping pending legal; 12 divergence, 102 outside-calibration; Termination survival Q02 link-only) | `m7-v2-repair-family-work3-profile-package-misc-boilerplate.json` (1,418,307 bytes) | `misc-boilerplate-work3.test.js` 11 pass | combined note §24 |

**Family-local modules (spine merge in progress):**

- `lib/canonical-v2/m7-v2-profile-authoring.js` — Termination + MAE_DEFINITION + DNO_INDEMNIFICATION + GENERAL_COVENANTS + **GUARANTY_FINANCING_PARTY** merged (PR1–PR4, ~27,850 lines)
- `lib/canonical-v2/m7-v2-mae-definition-authoring.js` — thin re-export shim (38 lines → spine)
- `lib/canonical-v2/m7-v2-dno-indemnification-authoring.js` — thin re-export shim (57 lines → spine)
- `lib/canonical-v2/m7-v2-general-covenants-authoring.js` — thin re-export shim (57 lines → spine)
- `lib/canonical-v2/m7-v2-guaranty-financing-party-authoring.js` — thin re-export shim (57 lines → spine)
- `lib/canonical-v2/m7-v2-closing-conditions-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR6)
- `lib/canonical-v2/m7-v2-representations-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR7)
- `lib/canonical-v2/m7-v2-financing-covenants-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR8)
- `lib/canonical-v2/m7-v2-termination-fee-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR9)
- `lib/canonical-v2/m7-v2-no-other-reps-fraud-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR10)
- `lib/canonical-v2/m7-v2-antitrust-regulatory-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR11)
- `lib/canonical-v2/m7-v2-proxy-meeting-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR12)
- `lib/canonical-v2/m7-v2-tax-matters-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR13)
- `lib/canonical-v2/m7-v2-employee-matters-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR14)
- `lib/canonical-v2/m7-v2-consideration-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR15)
- `lib/canonical-v2/m7-v2-key-defined-terms-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR16)
- `lib/canonical-v2/m7-v2-appraisal-dissenters-rights-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR17)
- `lib/canonical-v2/m7-v2-dividends-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR18)
- `lib/canonical-v2/m7-v2-no-shop-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR19)
- `lib/canonical-v2/m7-v2-specific-performance-remedies-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR20)
- `lib/canonical-v2/m7-v2-interim-operating-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR21)
- `lib/canonical-v2/m7-v2-material-contracts-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR22)
- `lib/canonical-v2/m7-v2-merger-structure-closing-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR23)
- `lib/canonical-v2/m7-v2-misc-boilerplate-authoring.js` — **self-contained family-local module** (not yet merged to spine; queue as PR24)
- Merge playbook: `WORK3-FAMILY-LOCAL-TO-SPINE-MERGE-PLAN-2026-08-24.md`

**Spine merge PR1 (MAE) — complete 2026-08-24:**

- MAE authoring inlined into `m7-v2-profile-authoring.js` (append-only; Termination untouched)
- `m7-v2-mae-definition-authoring.js` re-exports from spine (script import paths preserved)
- Proof: `work3-mae.test.js` 17 pass; Termination slice 19 pass (`Milestone A|family package|Work3 Termination`)

**Spine merge PR2 (D&O) — complete 2026-08-24:**

- DNO_INDEMNIFICATION authoring inlined into `m7-v2-profile-authoring.js` (append-only; Termination + MAE untouched)
- `m7-v2-dno-indemnification-authoring.js` re-exports from spine (script import paths preserved)
- Proof: `dno-work3.test.js` 9 pass; `work3-mae.test.js` 17 pass; Termination slice 19 pass

**Spine merge PR3 (General Covenants) — complete 2026-08-24:**

- GENERAL_COVENANTS authoring inlined into `m7-v2-profile-authoring.js` (append-only; Termination + MAE + D&O untouched)
- `m7-v2-general-covenants-authoring.js` re-exports from spine (script import paths preserved)
- Proof: `general-covenants-work3.test.js` 9 pass; `work3-mae.test.js` 17 pass; `dno-work3.test.js` 9 pass; Termination slice 19 pass

**Spine merge PR4 (Guaranty) — complete 2026-08-24:**

- GUARANTY_FINANCING_PARTY authoring inlined into `m7-v2-profile-authoring.js` (append-only)
- `m7-v2-guaranty-financing-party-authoring.js` re-exports from spine
- Proof: `guaranty-work3.test.js` 9 pass; spine export snapshot **120** keys

**Spine merge optional `module_path` audit (2026-08-24):** **no change needed.** All script and authority JSON `module_path` pins for MAE, D&O, GC, and Guaranty already target the family-local shim files (`m7-v2-*-authoring.js`), which re-export spine — not `m7-v2-profile-authoring.js` directly. Work3 successor authorities carry no `module_path` authoring pins. Smoke: four shims `require()` OK (23–25 exports each); four `*-family-profile-package.mjs` regenerate scripts exit 0 with stable package ids/sha256.

**Lawful Work3 fixture:** **twenty-four** Milestone A on-disk packages are wired via `on_disk_family_package_overrides` in `lawful-work3-family-package-set.json.gz.b64` (Termination 45, MAE 4, D&O 33, General Covenants 54, Guaranty 5, Closing Conditions 57, Representations 70, Financing Covenants 5, Termination Fee 20, No Other Reps / Fraud 36, Antitrust / Regulatory 70, Proxy / Meeting 31, Tax Matters 17, Employee Matters 27, Consideration 7, Key Defined Terms 76, Appraisal / dissenters' rights 5, **No-Shop 365**, Dividends 1, **Specific Performance Remedies 8**, **Interim Operating 113**, **Material Contracts 116**, **Merger Structure / Closing 103**, **Misc Boilerplate 114**). Synthetic `family_package_sources` records remain for `useOnDiskFamilyPackages: false` validator/registration paths. Remaining **1** family stays synthetic: **CAPITALISATION** (comparator blocked).

**Lawful fixture (manifest contract):**

```bash
CI=true node --test tests/stage-2y-structure-m7-v2-repair-contract.test.js \
  --test-name-pattern='Work3 manifest contract lawful fixture'
CI=true node --test tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js \
  --test-name-pattern='Work3 entry manifest binds exact P50'
```

On-disk validation loads 25 family packages and 1,310 profiles. Twenty-four packages are sealed on disk. Capitalisation remains the one synthetic family. The richer preparation paths continue to use synthetic packages by design.

**Lawful-fixture closure (updated 2026-09-01): Blockers A and B are closed.** Full background is in `LAWFUL-FIXTURE-DIMENSION-EVIDENCE-GAP-2026-08-24.md`.

- **D&O predecessor preserved.** The 31-profile predecessor records 26 APPROVE and 5 HOLD rows. It remains unchanged at 407,522 bytes, SHA-256 `5fccaa143aed5deb4eecd81e9efaf3782930eaf282b069e6e5bc35f939acb0ed`, id `e5b568d8eaa764a63a17e4fc6337b3049c8cfa5163947cb230c120027c38395e`.
- **Termination Blocker A closed (corrected 2026-09-01 at landing).** Per-profile fixture proofs were added across all 45 profiles. The authoritative local package, test pin and lawful-fixture pin are 1,121,991 bytes, SHA-256 `22afbea939eb086d63f415008d1cc1c52db89214bf720363b9a4ed1d509ad550`, id `f0718b673a6a22bf41f3492c72bbf3fed15eeb1745c06d2eb6d19a007103adeb`, and **45** dimension-evidence rows. These supersede both the earlier 519,840-byte seal and the later 1,121,931-byte figure in this note.
- **D&O Blocker B closed.** Ben's 2026-08-25 ruling applies because the Metsera rights-survival and no-adverse-amendment duties are separate operative units. The successor session added those two profiles and approved the five previously held Metsera rows. The current lawful-fixture package has 33 profiles and 33 dimension-evidence rows. It is `m7-v2-repair-family-work3-profile-package-dno-indemnification-item-42-successor-2026-09-01.json`, 431,970 bytes, SHA-256 `f66610f532c347e1546ca8df3131d100cc131b33b9d2be200385292959df0e74`, id `bed7b4e2b0294cc4d0505e1439f79f6a719e523caa59aa4ff73029c4b4605925`.
- **Validation green.** The on-disk set passes with 25 packages and 1,310 profiles. The fixture-proof crosscheck passes 5,240 proofs with 0 failures.
- **Independent review pending.** The application receipt is `docs/codex-program/notes/N1-DNO-ITEM-42-RULING-APPLICATION-RECEIPT-2026-09-01.json`. Its independent-review state is `PENDING` and its stamp remains uncleared.

**Regenerate packages** (any re-seal invalidates the lawful fixture's `on_disk_family_package_overrides` — refresh them after):

```bash
node scripts/stage-2y-structure-m7-v2-termination-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-mae-definition-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-dno-indemnification-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-general-covenants-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-guaranty-financing-party-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-family-profile-package.mjs

node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs          # rewrite + re-seal
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs --check  # exit 1 if stale
```

**Guaranty Milestone A proof:**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-guaranty-work3.test.js
```

**Closing conditions Milestone A proof (2026-08-24, exit 0, 11 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-closing-conditions-work3.test.js
```

Regenerate closing conditions evidence in order (digests are pinned into the family-local module):

```bash
node scripts/stage-2y-structure-m7-v2-closing-conditions-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-family-profile-package.mjs
```

Closing Conditions is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `135a570d…`). The package itself passes single-family inventory validation (`FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`). The on-disk full set passes 25 packages and 1,310 profiles.

**Representations Milestone A proof (2026-08-24, exit 0, 11 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-representations-work3.test.js
```

Regenerate representations evidence in order (digests are pinned into the family-local module and the test):

```bash
node scripts/stage-2y-structure-m7-v2-representations-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-representations-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-representations-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-representations-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-representations-family-profile-package.mjs
```

Representations is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `db2785b0…`). The package passes single-family inventory validation (`FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`). The on-disk full set passes 25 packages and 1,310 profiles.

**Financing covenants Milestone A proof (2026-08-24, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js
```

Regenerate financing covenants evidence in order (digests are pinned into the family-local module and the test):

```bash
node scripts/stage-2y-structure-m7-v2-financing-covenants-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-financing-covenants-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-financing-covenants-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-financing-covenants-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-financing-covenants-family-profile-package.mjs
```

Financing Covenants is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `db2785b0…`). The package itself passes single-family inventory validation (`FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`). The on-disk full set passes 25 packages and 1,310 profiles.

**Combined proof (run separately — full `work3.test.js` takes ~15+ min):**

**Milestone A five-family proof (2026-08-24 20:27:02 EDT):** **51 pass / 0 fail** (exit 0 both commands).

| Step | Log | Exit | Pass | Duration |
|---|---|---:|---:|---|
| MAE + D&O + General Covenants + Guaranty (`*-work3.test.js` ×4) | `/tmp/n1-five-families.out` | 0 | 44 | ~56 s |
| Termination slice (`Milestone A\|family package`) | `/tmp/n1-term.out` | 0 | 7 | ~296 s (~5 min) |

Refreshed full-suite log (2026-08-24 evening): `evidence/canonical-v2/stage-2y-structure-migration/control/n1-combined-work3-verification-2026-08-24.log` — **210 pass / 0 fail** + `CI=true npm run build` exit 0. Spine export snapshot in `work3.test.js` synced through Guaranty PR4 merge (**120** exports).

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js \
  tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js \
  tests/stage-2y-structure-m7-v2-repair-general-covenants-work3.test.js \
  tests/stage-2y-structure-m7-v2-repair-guaranty-work3.test.js \
  > /tmp/n1-five-families.out 2>&1
# Termination slice (~5 min):
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  --test-name-pattern 'Milestone A|family package' \
  tests/stage-2y-structure-m7-v2-repair-work3.test.js \
  > /tmp/n1-term.out 2>&1
```

**Build:** `CI=true npm run build` — green as of 2026-08-24.

---

## N1 family #6 — REPRESENTATIONS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **REPRESENTATIONS** | `REPRESENTATIONS-FAMILY-RUN-PLAN-2026-08-24.md` | **70** (landed; estimate was ~50–75) | 6 deals, 70 governed claims; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per resolved accuracy standard, not per provision example: the six provision examples are section containers, and Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each independently operative standard to keep its own materiality scale. Claim definition split is 55 `REPRESENTATION_ACCURACY_STANDARD` and 15 `KNOWLEDGE_QUALIFIER`; the 70 claims cover 34 distinct authored shapes, and the signature keeps the M4 claim identifier so the inventory stays claim-scale.

N1 ladder: Termination ✅ → MAE ✅ → D&O ✅ → General Covenants ✅ → Guaranty ✅ → **Representations ✅** → Closing Conditions ✅.

---

## N1 family #7 — CLOSING_CONDITIONS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **CLOSING_CONDITIONS** | `CLOSING-CONDITIONS-FAMILY-RUN-PLAN-2026-08-24.md` | **57** (landed; estimate was ~45–57) | 7 deals, 57 governed claims; wave-1 nested-condition stress; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per resolved condition limb, not per provision example: the seven provision examples are section containers, and Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each independently operative limb to keep its own standard.

---

## N1 family #8 — NO_OTHER_REPS_FRAUD (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **NO_OTHER_REPS_FRAUD** | `NO-OTHER-REPS-FRAUD-FAMILY-RUN-PLAN-2026-08-24.md` | **36** (landed; estimate was ~30–36) | 7 deals, 36 governed claims; Rep-cluster sibling; wave-3 four-element disclaimer stress; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per resolved disclaimer limb, not per provision example: the seven examples are section containers holding a target-side disclaimer, a buyer-side disclaimer, a non-reliance acknowledgment and an extra-contractual reliance disclaimer with separate actors and carve-outs, and Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each to keep its own scope. Claim definition split is 22 `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT`, 9 `NON_RELIANCE_ACKNOWLEDGMENT_PRESENT` and 5 `EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT` across 33 distinct authored shapes.

**Classifier boundary against REPRESENTATIONS verified, not assumed.** The section classifier suppresses `REPRESENTATIONS` on any M2 node this family wins, so the two could have collided. Comparing the 36 terminals against the sealed Representations Phase 2 registry finds **zero** shared M2 source nodes; the test asserts it. Three TopBuild rows share a printed section (the disclaimer is a lettered sub-paragraph of the representations article) and carry `CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY`, link-only under Q02. No Representations profile was absorbed.

**Proof (2026-08-24, exit 0, 12 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-no-other-reps-fraud-work3.test.js
```

Regenerate no-other-reps evidence in order (digests are pinned into the family-local module and the test):

```bash
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-family-profile-package.mjs
```

Package `83c227097450…` (469,420 bytes) passes single-family inventory validation (`FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`) and is wired into `on_disk_family_package_overrides` (`fixture_digest` `d93fdf23…`). Re-sealed with per-profile fixture proofs (Blocker A sweep); profiles and inventory disposition unchanged at 36 APPROVE / 0 HOLD.

N1 ladder: … → Representations (#6 ✅) → Closing Conditions (#7 ✅) → **No Other Reps / Fraud (#8 ✅)**.

---

## N1 family #9 — FINANCING_COVENANTS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **FINANCING_COVENANTS** | `FINANCING-COVENANTS-FAMILY-RUN-PLAN-2026-08-24.md` | **5** (landed; estimate was ~5–10) | 3 deals, 5 governed claims; wave-4 Guaranty-class sparse set; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per governed M4 claim, not per provision example: Concho §6.17 prints one section but carries two payoff lead-time claims separated only by delivery stage (DRAFT / FINAL), so a section-scale partition would have folded two distinct obligations into one. Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) keeps each limb its own standard, and the required expression signature appends the stage token to stay unique. TopBuild §7.16 (financing-source protection waiver) is a link-only boundary owned by `GUARANTY_FINANCING_PARTY` under Q02, never a Financing Covenants terminal.

---

## N1 family #10 — TERMINATION_FEE (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **TERMINATION_FEE** | `TERMINATION-FEE-FAMILY-RUN-PLAN-2026-08-24.md` | **20** (landed; estimate was ~18–25) | 6 deals, 20 governed claims; wave-4 fee-economics cluster; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per resolved fee limb, not per provision example: the six examples are section containers (Metsera §8.02 alone carries five limbs), and Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires the fee amount, the tail-period test, the sole-remedy legal effect and each carve-out to keep their own standards. Four comparator buckets populated (`FEE_AMOUNT` 6, `TAIL_FEE` 4, `SOLE_REMEDY_LINK` 5, `CARVEOUT` 5); four sealed M5 labels (`FEE_TRIGGER`, `EXPENSE_REIMBURSEMENT`, `LATE_INTEREST`, `CONDITIONAL_FEE_SCHEDULE`) drew no comparator instances and were not materialised. Fee-trigger cross-references to `TERMINATION` are Q02 link-only, so no Termination profile was absorbed and Phase 3 was skipped.

**Proof (2026-08-24, exit 0, 13 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-termination-fee-work3.test.js
```

Regenerate termination fee evidence in order (digests are pinned into the family-local module and the test):

```bash
node scripts/stage-2y-structure-m7-v2-termination-fee-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-termination-fee-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-termination-fee-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-termination-fee-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-termination-fee-family-profile-package.mjs
```

Package `b87ffa21dba7…` (251,294 bytes) passes single-family inventory validation (`FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`) and is wired into `on_disk_family_package_overrides` (`fixture_digest` `db2785b0…`). It was sealed twice: once with anchor-only fixture proofs, then again by the Blocker-A sweep that gave every profile all four fixture kinds. The current bytes are what the test pins and what the generator reproduces.

**Adding a family to the lawful fixture:** the existing refresh script only rewrites bindings for families already listed. A first-time insert now has a generator that carries every other family's entry through byte-identical, so it is safe to run during parallel family work:

```bash
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family TERMINATION_FEE --package evidence/.../m7-v2-repair-family-work3-profile-package-termination-fee.json
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs --family TERMINATION_FEE --package ... --check
```

N1 ladder: … → Financing Covenants (#9 ✅) → **Termination Fee (#10 ✅)**.

---

## N1 family #11 — ANTITRUST_REGULATORY (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **ANTITRUST_REGULATORY** | `ANTITRUST-REGULATORY-WORK3-PARALLEL-PREP-2026-08-24.md` | **70** (landed; estimate was ~55–75) | 7 deals, 70 governed claims; wave-3 regulatory-efforts cluster; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per governed M4 claim across seven comparator deals. Fourteen source-first comparator buckets populated; twelve sealed M5 subtype labels registered. Three comparator buckets have no sealed M5 label (`FILING_TIMING_STANDARD`, `NOTIFICATION`, `WITHDRAWAL_REFILING`) — six rows carry `M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED`. One sealed label (`REGULATORY_REQUEST_RESPONSE`) drew no comparator instances. Closing-conditions regulatory cross-references are Q02 link-only and were not duplicated here. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings.

**Proof (2026-08-24, exit 0, 11 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-antitrust-regulatory-work3.test.js
```

Regenerate antitrust / regulatory evidence in order (digests are pinned into the family-local module and the test):

```bash
node scripts/stage-2y-structure-m7-v2-antitrust-regulatory-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-antitrust-regulatory-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-antitrust-regulatory-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-antitrust-regulatory-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-antitrust-regulatory-family-profile-package.mjs
```

Package `56ba1c5ed345…` (287,309 bytes) passes single-family inventory validation (`FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`) and is wired into `on_disk_family_package_overrides` (`fixture_digest` `a283b0e4…`).

N1 ladder: … → Termination Fee (#10 ✅) → **Antitrust / Regulatory (#11 ✅)**.

---

## N1 family #18 — NO_SHOP (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **NO_SHOP** | `NO-SHOP-WORK3-PARALLEL-PREP-2026-08-24.md` | **365** (7 deals) | concho–topbuild; all 13 claim keys across 6 populated subtype buckets; wave-1 nested-condition / exception-ladder stress; D&O-minimal Phase 2→4; Phase 3 skipped |

Phase 2 terminal registry and Milestone A package both cover all **365** governed claims (slices A–D merged: prohibited + exception, recommendation-change cluster, standstill/representative/cease, match periods).

Q02 link-only boundaries recorded in Phase 2 authority: **KEY_DEFINED_TERMS** (Acquisition Proposal / Superior Proposal definitions), **TERMINATION_FEE** (recommendation-change fee triggers), **PROXY_MEETING** (stockholder-meeting adjacency), **TERMINATION** (termination-for-superior-proposal cross-refs). No definition or fee content absorbed.

All 365 rows APPROVE with subtype grouping pending legal (88 calibration divergence stamps, 94 outside-calibration stamps; 6 populated of 8 registered subtype buckets).

**No-Shop Milestone A proof (2026-08-25, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-no-shop-work3.test.js
```

Package `be14f1e6dd43…` (4,394,952 bytes) passes single-family inventory validation (`FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`) and is wired into `on_disk_family_package_overrides` (`fixture_digest` `9f8c769d…`).

Regenerate:

```bash
node scripts/stage-2y-structure-m7-v2-no-shop-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-no-shop-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-no-shop-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-no-shop-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-no-shop-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family NO_SHOP \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-shop.json
```

---

## N1 family #23 — MERGER_STRUCTURE_CLOSING (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **MERGER_STRUCTURE_CLOSING** | combined note §23 | **103** | 7 deals, 103 governed claims; eight sealed M5 subtype buckets (six populated); Closing Conditions / Proxy Q02 link-only |

One profile per governed M4 claim across seven comparator deals (Concho, Metsera, Modiv, Red Hat, Skechers, Skywater, TopBuild). All 103 rows APPROVE with subtype grouping pending legal (23 calibration divergence, 71 outside-calibration stamps). Phase 3 skipped.

**Merger Structure / Closing Milestone A proof (2026-08-25, exit 0, 11 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-merger-structure-closing-work3.test.js
```

Regenerate evidence in order (digests pinned into the family-local module and test):

```bash
node scripts/stage-2y-structure-m7-v2-merger-structure-closing-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-merger-structure-closing-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-merger-structure-closing-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-merger-structure-closing-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-merger-structure-closing-family-profile-package.mjs
```

Merger Structure / Closing is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `206338c3…`).

**Misc Boilerplate Milestone A proof (2026-08-25, exit 0, 11 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-misc-boilerplate-work3.test.js
```

Regenerate misc boilerplate evidence in order (digests pinned into the family-local module and test):

```bash
node scripts/stage-2y-structure-m7-v2-misc-boilerplate-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-misc-boilerplate-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-misc-boilerplate-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-misc-boilerplate-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-misc-boilerplate-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family MISC_BOILERPLATE \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-misc-boilerplate.json
```

Misc Boilerplate is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `8fdc272d…`).

---

## Next — remaining N1 family

| N1 # | Family | Claims | Est. profiles | Prep note | Start gate |
|---:|---|---:|---:|---|---|
| **25** | **CAPITALISATION** | 0 | blocked | combined note §25 | **comparator blocked** (supplemental-only) |

**#20–#24 Milestone A complete** (SPR sealed with 7 honest HOLDs on the open Termination Fee sole-remedy owner-family question). Only Capitalisation remains unsealed among N1 families, and it cannot start until sealed comparator runs exist.

---

## N1 family #16 — KEY_DEFINED_TERMS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **KEY_DEFINED_TERMS** | `KEY-DEFINED-TERMS-WORK3-PARALLEL-PREP-2026-08-24.md` | **76** | 6 deals, 76 governed claims; wave-2 definitions article; D&O minimal Phase 2→4 path; Phase 3 skipped |

One profile per governed M4 claim across six comparator deals (Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild). Twelve claim-definition keys; five sealed M5 subtype buckets all populated. Representations `KNOWLEDGE_QUALIFIER` rows (15) stay Q02 link-only — this family owns knowledge-person and standard definition content. All 76 rows APPROVE with subtype grouping pending legal (41 calibration divergence, 20 outside-calibration stamps).

**Key Defined Terms Milestone A proof (2026-08-24, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-key-defined-terms-work3.test.js
```

Key Defined Terms is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `ec289147…`).

---

## N1 family #17 — APPRAISAL_DISSENTERS_RIGHTS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **APPRAISAL_DISSENTERS_RIGHTS** | `APPRAISAL-DISSENTERS-RIGHTS-FAMILY-RUN-PLAN-2026-08-24.md` | **5** | 3 deals, 5 governed claims; wave-4 sparse cluster; D&O minimal Phase 2→4 path; Phase 3 skipped |

One profile per governed M4 claim across Skechers, Skywater, and TopBuild (withdrawal-reconversion + settlement-consent limbs). Two claim-definition keys populated; six sealed M5 subtype buckets with two populated. Consideration (#15) owns appraisal-rights **status** on shared printed sections (Q02 link-only). All 5 rows APPROVE with subtype grouping pending legal (5 calibration divergence, 0 outside-calibration stamps).

**Appraisal / dissenters' rights Milestone A proof (2026-08-24, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-appraisal-dissenters-rights-work3.test.js
```

Appraisal / dissenters' rights is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `b70c9594…`).

---

## N1 family #19 — DIVIDENDS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **DIVIDENDS** | `DIVIDENDS-WORK3-PARALLEL-PREP-2026-08-24.md` | **1** | 1 deal (Concho), 1 governed claim; wave-4 dividend-coordination cluster; D&O minimal Phase 2→4 path; Phase 3 skipped |

One profile per governed M4 claim on the Concho comparator deal (§6.21 dividend-coordination covenant). One claim-definition key populated (`DIVIDEND_COORDINATION_COVENANT`); five sealed M5 subtype buckets with one populated (`DIVIDEND_COORDINATION`). Calibration tags all five provision examples `DIVIDEND_COORDINATION`, matching the comparator claim — 0 subtype-divergence stamps. Consideration (#15) and Interim Operating (#21) Q02 link-only boundaries apply only when those rows surface elsewhere. All 1 row APPROVE with subtype grouping pending legal.

**Dividends Milestone A proof (2026-08-24, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-dividends-work3.test.js
```

Regenerate dividends evidence in order (digests pinned into the family-local module and test):

```bash
node scripts/stage-2y-structure-m7-v2-dividends-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-dividends-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-dividends-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-dividends-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-dividends-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family DIVIDENDS \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-dividends.json
```

Dividends is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `5a490d65…`).

---

## N1 family #19 — DIVIDENDS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **DIVIDENDS** | `DIVIDENDS-WORK3-PARALLEL-PREP-2026-08-24.md` | **1** | 1 deal (Concho), 1 governed claim; wave-4 sparse dividend-coordination cluster; D&O minimal Phase 2→4 path; Phase 3 skipped |

One profile per governed M4 claim on Concho §6.21 (`DIVIDEND_COORDINATION_COVENANT`). Five sealed M5 subtype buckets with one populated (`DIVIDEND_COORDINATION`). Calibration tags all five provision examples `DIVIDEND_COORDINATION`; the sole comparator claim matches (0 subtype divergence, 0 outside-calibration). All 1 row APPROVE with subtype grouping pending legal.

**Dividends Milestone A proof (2026-08-24, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-dividends-work3.test.js
```

Dividends is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `5a490d65…`).

---

## N1 family #15 — CONSIDERATION (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **CONSIDERATION** | `CONSIDERATION-WORK3-PARALLEL-PREP-2026-08-24.md` | **7** | 4 deals, 7 governed claims; wave-4 deal-economics cluster; D&O minimal Phase 2→4 path; Phase 3 skipped |

One profile per governed M4 claim across four comparator deals. Two claim-definition keys populated (`PER_SHARE_CASH_CONSIDERATION` 3, `APPRAISAL_RIGHTS_STATUS` 4); ten sealed M5 subtype buckets with two populated (`CASH_COMPONENT`, `APPRAISAL_LINK`). Selected over `KEY_DEFINED_TERMS` (76 claims — Representations knowledge link-only overlap) and `NO_SHOP` (365 — too large for immediate Milestone A). All 7 rows APPROVE with subtype grouping pending legal (7 calibration divergence, 0 outside-calibration stamps).

**Consideration Milestone A proof (2026-08-24, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-consideration-work3.test.js
```

Consideration is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `352ea2bb…`).

---

## N1 family #14 — EMPLOYEE_MATTERS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **EMPLOYEE_MATTERS** | `EMPLOYEE-MATTERS-FAMILY-RUN-PLAN-2026-08-24.md` | **27** | 6 deals, 27 governed claims; wave-1 continuing-employee cluster; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per governed M4 claim across six comparator deals. Three claim-definition keys populated; four sealed M5 subtype buckets with `RETIREMENT_PLAN_ACTION` empty. Sealed Representations (#6) Q02 boundary for TopBuild §3.1(h) benefit-plan rep. All 27 rows APPROVE with subtype grouping pending legal (16 calibration divergence, 0 outside-calibration stamps).

**Employee matters Milestone A proof (2026-08-24, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-employee-matters-work3.test.js
```

Employee Matters is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `a7271c58…`).

---

## N1 family #13 — TAX_MATTERS (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **TAX_MATTERS** | `TAX-MATTERS-FAMILY-RUN-PLAN-2026-08-24.md` | **17** | 4 deals, 17 governed claims; wave-4 tax/treatment cluster; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per governed M4 claim across four comparator deals. Four claim-definition keys populated; eight sealed M5 subtype buckets with four empty. Sealed CC (#7) Q02 boundary for receipt-only tax opinion closing conditions. All 17 rows APPROVE with subtype grouping pending legal (7 calibration divergence, 9 outside-calibration stamps).

**Tax matters Milestone A proof (2026-08-24, exit 0, 10 pass / 0 fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-tax-matters-work3.test.js
```

Regenerate tax matters evidence in order (digests pinned into the family-local module and test):

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

Tax Matters is wired into `on_disk_family_package_overrides` in the lawful Work3 fixture (`fixture_digest` `05e23a26…`).

---

## N1 family #12 — PROXY_MEETING (Milestone A complete)

| Family | Run plan | Profiles | Comparator signal |
|---|---|---:|---|
| **PROXY_MEETING** | `PROXY-MEETING-WORK3-PARALLEL-PREP-2026-08-24.md` | **~28–31** (estimate; 31 comparator claims) | 6 deals, 31 governed claims; wave-4 meeting/proxy cluster; D&O minimal Phase 2→4 path, Phase 3 skipped |

One profile per governed M4 claim across six comparator deals. Six sealed M5 subtype buckets; all six calibration examples currently tagged `DOCUMENT_FILING` pending legal grouping review. Sealed CC (#7) and Termination (#1) Q02 boundaries for tender-offer minimum conditions and vote-failure cross-refs. Selected over `NO_SHOP` (365 claims — too large) and `SPECIFIC_PERFORMANCE_REMEDIES` (Termination Fee #10 Ben hold on sole-remedy owner family).

---

## In progress / next

**Flat-out parallel push (2026-08-24 evening):** Spine merge PR1–PR4 complete (MAE, D&O, GC, Guaranty); Representations Milestone A (family-local), family #7 prep, lawful-fixture dimension-evidence diagnosis — running without Ben gates.

| Priority | Work | Prep / plan |
|---|---|---|
| **1** | **REPRESENTATIONS** Milestone A (#6) — ✅ **complete** (70 profiles, 70 APPROVE / 0 HOLD, 11/11 tests incl. lawful-fixture override); spine merge pending | `REPRESENTATIONS-FAMILY-RUN-PLAN-2026-08-24.md` |
| 2 | Spine merge — **PR1–PR4 done** (MAE, D&O, GC, Guaranty); optional `module_path` audit **closed — no change needed** | `WORK3-FAMILY-LOCAL-TO-SPINE-MERGE-PLAN-2026-08-24.md` |
| 3 | Lawful fixture on-disk full-set validation is green at **25 packages / 1,310 profiles**; Blockers A and B are closed | `LAWFUL-FIXTURE-DIMENSION-EVIDENCE-GAP-2026-08-24.md` |
| 4 | **CLOSING_CONDITIONS** Milestone A (#7) — ✅ **complete** (57 profiles, 41 APPROVE / 16 HOLD, 11/11 tests incl. lawful-fixture override); spine merge pending | `CLOSING-CONDITIONS-FAMILY-RUN-PLAN-2026-08-24.md` |
| 5 | **NO_OTHER_REPS_FRAUD** Milestone A (#8) — ✅ **complete** (36 profiles, 36 APPROVE / 0 HOLD, 12/12 tests incl. lawful-fixture override); spine merge pending | `NO-OTHER-REPS-FRAUD-FAMILY-RUN-PLAN-2026-08-24.md` |
| 6 | **FINANCING_COVENANTS** Milestone A (#9) — ✅ **complete** (5 profiles, 5 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `FINANCING-COVENANTS-FAMILY-RUN-PLAN-2026-08-24.md` |
| 7 | **TERMINATION_FEE** Milestone A (#10) — ✅ **complete** (20 profiles, 8 APPROVE / 12 HOLD, 13/13 tests incl. lawful-fixture override); spine merge pending | `TERMINATION-FEE-FAMILY-RUN-PLAN-2026-08-24.md` |
| 8 | **ANTITRUST_REGULATORY** Milestone A (#11) — ✅ **complete** (70 profiles, 70 APPROVE / 0 HOLD, 11/11 tests incl. lawful-fixture override); spine merge pending | `ANTITRUST-REGULATORY-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 9 | **PROXY_MEETING** Milestone A (#12) — ✅ **complete** (31 profiles, 31 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `PROXY-MEETING-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 10 | **TAX_MATTERS** Milestone A (#13) — ✅ **complete** (17 profiles, 17 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `TAX-MATTERS-FAMILY-RUN-PLAN-2026-08-24.md` |
| 11 | **EMPLOYEE_MATTERS** Milestone A (#14) — ✅ **complete** (27 profiles, 27 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `EMPLOYEE-MATTERS-FAMILY-RUN-PLAN-2026-08-24.md` |
| 12 | **CONSIDERATION** Milestone A (#15) — ✅ **complete** (7 profiles, 7 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `CONSIDERATION-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 13 | **KEY_DEFINED_TERMS** Milestone A (#16) — ✅ **complete** (76 profiles, 76 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `KEY-DEFINED-TERMS-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 14 | **APPRAISAL_DISSENTERS_RIGHTS** Milestone A (#17) — ✅ **complete** (5 profiles, 5 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `APPRAISAL-DISSENTERS-RIGHTS-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 15 | **NO_SHOP** Milestone A (#18) — ✅ **complete** (365 profiles, 365 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `NO-SHOP-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 16 | **DIVIDENDS** Milestone A (#19) — ✅ **complete** (1 profile, 1 APPROVE / 0 HOLD, 10/10 tests incl. lawful-fixture override); spine merge pending | `DIVIDENDS-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 17 | **INTERIM_OPERATING** Milestone A (#21) — ✅ **complete** (113 profiles, 113 APPROVE / 0 HOLD, 11/11 tests incl. lawful-fixture override); spine merge pending | `INTERIM_OPERATING-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 18 | **MATERIAL_CONTRACTS** Milestone A (#22) — ✅ **complete** (116 profiles, 116 APPROVE / 0 HOLD, 11/11 tests incl. lawful-fixture override); spine merge pending | `MATERIAL-CONTRACTS-WORK3-PARALLEL-PREP-2026-08-24.md` |
| 19 | **MERGER_STRUCTURE_CLOSING** Milestone A (#23) — ✅ **complete** (103 profiles, 103 APPROVE / 0 HOLD, 11/11 tests incl. lawful-fixture override); spine merge pending | combined note §23 |
| 20 | **MISC_BOILERPLATE** Milestone A (#24) — ✅ **complete** (114 profiles, 114 APPROVE / 0 HOLD, 11/11 tests incl. lawful-fixture override); spine merge pending | combined note §24 |
| 21 | **SPECIFIC_PERFORMANCE_REMEDIES** Milestone A (#20) — ✅ **complete** (8 profiles, 1 APPROVE / 7 HOLD, 10/10 tests); sole-remedy owner-family still open for Ben | `SPECIFIC-PERFORMANCE-REMEDIES-FAMILY-RUN-PLAN-2026-08-24.md` |
| 22 | **CAPITALISATION** (#25) — **blocked** (0 comparator claims) | `REMAINING-N1-FAMILIES-WORK3-PARALLEL-PREP-2026-08-24.md` §25 |
| 23 | Programme N2–N9 | `TERMINATION-FAMILY-RUN-PLAN` ladder |

---

## Open holds (honest — not bugs)

- **Termination:** 4 outside-date rows PARTIAL (extension linked, not in signature)
- **D&O:** no remaining item-42 holds. All 33 rows are approved. Independent review of the application receipt remains pending
- **MAE:** self-containment unproven + Metsera subject-term mismatch flagged in review stamps
- **Guaranty:** 5 profiles APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED` on all rows (`PERFORMANCE_GUARANTY` subtype grouping pending legal)
- **GC:** item-44 access-scope disposition deferred (6 ACCESS rows APPROVED with review stamp)
- **Representations:** all 70 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. The calibration pack registers six subtype buckets but tags all six provision examples `STATUS_REPRESENTATION`, and the resolution data carries no field separating the other five, so every row is authored under `STATUS_REPRESENTATION` and the seal records `PENDING_LEGAL_REVIEW` (1 populated of 6 registered buckets). 15 knowledge-qualifier rows additionally carry `CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY` — the knowledge-person definition is owned by `KEY_DEFINED_TERMS` under Q02. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim
- **Financing covenants:** all 5 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. The sealed M5 role schema admits all three Financing Covenants claim keys under all seven subtype buckets, so the claim-key → subtype mapping is a proposal, not a sealed rule (3 populated of 7 registered buckets; seal records `PENDING_LEGAL_REVIEW`). 2 Concho payoff rows additionally carry `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` (calibration tags every example `OBTAIN_FINANCING`; the claim keys say `PAYOFF`) and 1 row carries `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Termination fee:** 12 of 20 rows HOLD. Ten `REM-SOLE` rows (5 sole-remedy-link + 5 carve-out) carry `owner_family: SPECIFIC_PERFORMANCE_REMEDIES` in the comparator resolution, produced by the supplemental resolver `native-sole-remedy-resolution/v1` rather than by the termination fee producer — Q02 permits one owner and the source does not say whether that owner is the fee those rows cap or the remedy they restrict (`COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED`). **This is the one termination fee item that needs Ben.** Two reverse-side fee rows (Skechers §8.3, TopBuild §6.5, both `party.capacity = BUYER`) are held because the single sealed `FEE_AMOUNT` label does not distinguish fee side (`FEE_SIDE_PARTITION_DISPOSITION_REQUIRED`). All 20 rows carry `LEGAL_GROUPING_REVIEW_REQUIRED`. Four sealed M5 labels drew no comparator instances. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **No other reps / fraud:** all 36 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. The calibration pack registers four subtype buckets but tags all seven provision examples `NO_OTHER_REPRESENTATIONS_DISCLAIMER`, and the sealed role schema admits all three claim keys under all four buckets, so every row is authored under the tagged bucket and the seal records `PENDING_LEGAL_REVIEW` (1 populated of 4 registered). Two evidence-derived link censuses ride alongside, neither assigning ownership: 24 rows carry `SHARED_SOURCE_CITATION_LINK_ONLY` (another governed claim sits on the same authored citation — the open half of Q01), and 3 TopBuild rows carry `CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY` (shared printed section, Q02). Red Hat §8.03(p) willful-breach definitions stay open-world rather than being inferred into `FRAUD_CARVEOUT`. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Closing conditions:** 16 of 57 rows HOLD — 15 sit in comparator buckets with no sealed M5 subtype label (`COVENANT_COMPLIANCE`, `LISTING`, `NO_MAE`) and 1 is the Metsera frustration branch. Two sealed labels (`BRINGDOWN`, `TAX_OPINION`) drew no comparator instances. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim rather than new family rulings invented
- **Antitrust / regulatory:** all 70 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. Fourteen source-first comparator buckets populated against twelve sealed M5 labels; three buckets without sealed labels (`FILING_TIMING_STANDARD`, `NOTIFICATION`, `WITHDRAWAL_REFILING`) drive six `M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED` rows, and one sealed label (`REGULATORY_REQUEST_RESPONSE`) drew no comparator instances. Five rows carry `NON_HSR_FILING_REGIME` and twelve carry `ONE_SIDED_OBLIGOR_CAPACITY`. Closing-conditions regulatory cross-references stay Q02 link-only. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Proxy / meeting:** all 31 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. Five populated comparator buckets against six sealed M5 labels (`SUBSIDIARY_APPROVAL` empty); 27 rows diverge from calibration's all-`DOCUMENT_FILING` tagging and 2 Metsera §6.11 rows sit outside calibration provision examples. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Tax matters:** all 17 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. Four populated comparator buckets against eight sealed M5 labels (four empty); calibration tags all four provision examples `INTENDED_TAX_TREATMENT` while comparator claims span four subtype buckets — 7 rows carry `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` and 9 carry `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`. CC tax-opinion receipt-only closing conditions stay Q02 link-only against sealed Closing Conditions (#7). Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Employee matters:** all 27 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. Three populated comparator buckets against four sealed M5 labels (`RETIREMENT_PLAN_ACTION` empty); calibration tags all six provision examples `EMPLOYEE_COMPENSATION` while comparator claims span three subtype buckets — 16 rows carry `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE`. TopBuild §3.1(h) benefit-plan rep stays Q02 link-only against sealed Representations (#6). Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Consideration:** all 7 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. Two populated comparator buckets against ten sealed M5 labels (eight empty); calibration tags all four provision examples `CONSIDERATION_PACKAGE` while comparator claims span `CASH_COMPONENT` and `APPRAISAL_LINK` — 7 rows carry `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE`. Shared-section appraisal mechanics stay Q02 link-only against `APPRAISAL_DISSENTERS_RIGHTS`. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **No-shop:** all 365 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. Six populated comparator buckets against eight sealed M5 labels; calibration tags all seven provision examples `RESTRICTION` while comparator claims span RESTRICTION, STANDSTILL, RECOMMENDATION_CHANGE, REPRESENTATIVE_CONTROL, SAFE_DISCLOSURE, and ENGAGEMENT_PERMISSION — 88 rows carry `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` and 94 carry `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`. KEY_DEFINED_TERMS owns Acquisition Proposal / Superior Proposal definitions; TERMINATION_FEE, PROXY_MEETING, and TERMINATION cross-refs stay Q02 link-only — recorded in Phase 2 `cross_family_link_only_boundaries`, none absorbed. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Dividends:** the single profile APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. One populated comparator bucket against five sealed M5 labels (four empty); calibration tags all five provision examples `DIVIDEND_COORDINATION`, matching the comparator claim — 0 subtype-divergence stamps. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Merger structure / closing:** all 103 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. Six populated comparator buckets against eight sealed M5 labels (`TRANSACTION_PLAN`, `ORGANISATIONAL_DOCUMENT` empty); calibration tags all seven provision examples `TRANSACTION_STEP` while comparator claims span six subtype buckets — 23 rows carry `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` and 71 carry `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`. Closing Conditions stockholder-approval and Proxy / Meeting mechanics stay Q02 link-only. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings
- **Misc boilerplate:** all 114 rows APPROVE with `LEGAL_GROUPING_REVIEW_REQUIRED`. Twelve populated comparator buckets against twelve sealed M5 labels (all populated); calibration tags all six provision examples `GOVERNING_LAW` while comparator claims span twelve subtype buckets — 12 rows carry `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` and 102 carry `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`. Termination rights-survival rows on shared sections stay Q02 link-only. Ben was unavailable, so the sealed M5 programme rulings were applied verbatim — 0 new family rulings

---

## Ben escalation

**Legal questions only.** Ben delegated all technical/governance decisions. See `.cursor/rules/ben-escalation-only-legal.mdc`.

---

## Uncommitted work

Large WIP on branch — Termination + MAE + D&O + Guaranty (Phase 2 slice) + Closing Conditions + Representations evidence JSONs, family modules, generator scripts, test files, notes, `.cursor/rules/`. **Not committed** unless Ben requests. `git status` for full list.

---

## Do not

- Rebuild from stale `STAGE_B_HANDOFF.md`
- Edit draft inventory packets as approval
- Production serving / activation without explicit authority
- Pipe `npm test` to `tail`/`head`

---

## Process compressions (Ben, 2026-09-01)

- **Small-family batch:** Dividends, Material Adverse Effect definition,
  Guaranty, Appraisal, Financing Covenants and Consideration use one combined
  brief and one sitting. Each family keeps its own ruling record and receipt.
  Specific Performance Remedies is excluded. It follows the sole-remedy limb
  map, which is the pending list that separates each independent part of a
  sole-remedy clause.
- **Review limit:** A legal-semantic change alters clause meaning, ownership,
  grouping or comparison output. Each such change gets one adversarial review,
  meaning a separate review that tries to find a legal or evidence error. A
  fix gets at most one further adversarial review. A mechanical change does
  not alter legal meaning. Examples include hash-pin updates and file-path
  wiring. Mechanical changes use only the normal automated tests and required
  merge checks.
- **Brief queue:** The legal-review order is small-family batch, Interim
  Operating, No-Shop, Antitrust / Regulatory, General Covenants / Access,
  mid-size families (Tax Matters, Employee Matters and Proxy / Meeting), large
  families, Closing Conditions after its new comparison labels are available,
  then Specific Performance Remedies after the sole-remedy limb map is ready.
