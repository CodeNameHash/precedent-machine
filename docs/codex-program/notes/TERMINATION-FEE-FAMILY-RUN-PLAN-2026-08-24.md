# Termination fee family — Work3 Milestone A run plan (2026-08-24)

**Family:** `TERMINATION_FEE` (N1 family #10)  
**Branch:** `codex/recover-m7-20260812`  
**State:** Milestone A complete — 20 profiles sealed and registered, 8 APPROVE / 12 HOLD, dedicated test file **13 pass / 0 fail**  
**Prep note:** `TERMINATION-FEE-WORK3-PARALLEL-PREP-2026-08-24.md` (estimated 18–25 profiles; landed 20)

---

## What was built

Family-local module, mirroring the Closing Conditions pattern rather than the spine:

- `lib/canonical-v2/m7-v2-termination-fee-authoring.js` — self-contained, ~1,530 lines. Not merged into `m7-v2-profile-authoring.js`; queue as a later spine PR alongside Closing Conditions, Representations and Financing Covenants.
- `tests/stage-2y-structure-m7-v2-repair-termination-fee-work3.test.js` — 13 tests, family-local (loads no other family's package).

Six generator scripts, run in this order (each seals digests that the next one and the module pin):

```bash
node scripts/stage-2y-structure-m7-v2-termination-fee-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-termination-fee-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-termination-fee-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-termination-fee-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-termination-fee-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs
```

Phase 3 was skipped. The fee-trigger cross-references to the Termination family are Q02 link-only under the sealed programme rulings, so no reference edges were materialised and no Termination profile was absorbed.

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-termination-fee-work3.test.js
```

Exit 0, **13 pass / 0 fail** (2026-08-24). The suite covers the Phase 2 partition, the Phase 2 residual blocks, the Phase 4 review candidate, per-row hold-flag derivation, all four Work3 ladder steps (inventory review → Ben disposition → family package seal → registration), the inventory packet and disposition records, the Ben rulings note against the sealed M5 rulings, the on-disk package under `validateSingleFamilyPackageInventory`, and the lawful-fixture on-disk override.

## Sealed artefacts

| Artefact | Path (under `evidence/.../control/`) | Bytes |
|---|---|---:|
| Phase 2 authority | `m7-v2-repair-contract-termination-fee-authoring-phase2-authority-v2.json` | 68,551 |
| Phase 4 review authority | `m7-v2-repair-contract-termination-fee-authoring-phase4-family-profile-package-review-authority.json` | 27,799 |
| Inventory review authority | `m7-v2-repair-contract-work3-termination-fee-unapproved-inventory-review-authority.json` | 1,990 |
| Inventory review packet | `m7-v2-repair-termination-fee-20-profile-inventory-review-packet-draft.json` | 28,015 |
| Inventory disposition | `m7-v2-repair-termination-fee-20-profile-inventory-disposition.json` | 8,293 |
| Ben session receipt | `m7-v2-repair-termination-fee-ben-inventory-session-receipt.json` | 1,126 |
| Ben session successor authority | `m7-v2-repair-contract-work3-termination-fee-ben-inventory-session-successor-authority.json` | 2,759 |
| Package seal successor authority | `m7-v2-repair-contract-work3-termination-fee-family-package-seal-successor-authority.json` | 3,308 |
| Package seal receipt | `m7-v2-repair-termination-fee-family-package-seal-receipt.json` | 2,141 |
| Registration successor authority | `m7-v2-repair-contract-work3-termination-fee-registration-successor-authority.json` | 2,888 |
| **Family profile package** | `m7-v2-repair-family-work3-profile-package-termination-fee.json` | **251,294** |

Package identity `b87ffa21dba7…`, sha256 `58504b579038…`, validation status `FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`. Regenerating twice reproduces the same bytes.

Rulings note: `TERMINATION-FEE-BEN-RULINGS-Q01-Q03-2026-08-24.md` (sha256 `94b5bf978…`) — the sealed M5 programme rulings applied verbatim, **no new family rulings invented**, because Ben was unavailable.

---

## Why 20 profiles, not six

The calibration pack registers six provision examples across six deals (Concho §8.3, Metsera §8.02, Red Hat §5.06, Skechers §8.3, SkyWater §10.5, TopBuild §6.5), but those are section containers. Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each independently operative limb to keep its own standard, and the resolved comparator data carries 20 governed M4 claims across four operative shapes:

| Comparator bucket | Concept / claim definition | Rows |
|---|---|---:|
| `FEE_AMOUNT` | `TERMF-TARGET` / `TERMF-REVERSE` + `TERMINATION_FEE_AMOUNT` | 6 |
| `TAIL_FEE` | `TERMF-TAIL` + `TERMINATION_FEE_TAIL_PERIOD_MONTHS` | 4 |
| `SOLE_REMEDY_LINK` | `REM-SOLE` + `SOLE_REMEDY_LEGAL_EFFECT_PRESENT` | 5 |
| `CARVEOUT` | `REM-SOLE` + `SOLE_REMEDY_CARVEOUT_KIND` | 5 |

Metsera §8.02 alone carries five of those limbs. Deal spread: TopBuild 5, Metsera 5, Red Hat 4, Skechers 3, Concho 2, SkyWater 1.

The buckets are technical partition keys, not assertions of M5 subtype membership — the Phase 2 authority records that explicitly (`BUCKETS_ARE_TECHNICAL_PARTITION_KEYS_ONLY_AND_DO_NOT_ASSERT_M5_SUBTYPE_MEMBERSHIP`). Four sealed M5 labels drew no comparator instances at all (`FEE_TRIGGER`, `EXPENSE_REIMBURSEMENT`, `LATE_INTEREST`, `CONDITIONAL_FEE_SCHEDULE`) and were not materialised. Inventing profiles for them would assert provisions these six deals do not contain.

---

## The 12 holds (honest — not bugs)

**Ten sole-remedy rows: comparator assigns them to another family.** Every `REM-SOLE` row (5 `SOLE_REMEDY_LINK` + 5 `CARVEOUT`) carries `owner_family: SPECIFIC_PERFORMANCE_REMEDIES` in the comparator resolution, produced by the supplemental resolver `native-sole-remedy-resolution/v1` rather than by the termination fee producer. Q02 (`M5-RULING-ONE-SEMANTIC-OWNER`) permits exactly one owner, and the source does not settle whether that owner is termination fee (the fee those rows cap) or specific performance remedies (the remedy they restrict). Flag: `COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED`. **This is the one item that needs Ben.**

**Two reverse-side fee rows: sealed label does not distinguish fee side.** Skechers §8.3 and TopBuild §6.5 each carry a `TERMF-REVERSE` fee with `party.capacity = BUYER`. The sealed M5 role schema offers a single `FEE_AMOUNT` label, so whether a reverse termination fee is the same subtype with a different payer role or a subtype of its own is not decided by the source. Flag: `FEE_SIDE_PARTITION_DISPOSITION_REQUIRED`.

The eight approved rows are the four target-side fee amounts and the four tail-period rows: the family owns the semantics and the sealed label is unambiguous.

All 20 rows additionally carry `LEGAL_GROUPING_REVIEW_REQUIRED`, consistent with every other Milestone A family — the seal records the subtype partition as `PENDING_LEGAL_REVIEW`, not as decided.

---

## Concurrency note (why the package was re-sealed mid-run)

The on-disk package was first sealed at 88,080 bytes with fixture proofs on the anchor profile only, matching the Milestone A generators as they stood. While this family was being authored, the Blocker-A sweep (per-profile fixture proofs, see `LAWFUL-FIXTURE-DIMENSION-EVIDENCE-GAP-2026-08-24.md`) introduced the shared closure helper `scripts/lib/stage-2y-structure-m7-v2-family-package-fixture-closure.mjs` and rewrote every family generator, including this one, to derive fixture proofs per profile. The package re-sealed to 251,294 bytes with all four fixture kinds on each of the 20 profiles.

The current bytes are what this run plan and the test file pin, and the generator reproduces them. If the sweep lands further changes to the closure helper, re-run the package generator and the fixture-override refresh, then re-pin the package binding in the test file — those are the only three places the bytes appear.

## Fixture override

`TERMINATION_FEE` is wired into `on_disk_family_package_overrides` in `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64`, joining the eight families already there. The insert used a new generator, since the existing refresh script only rewrites bindings for families already listed:

```bash
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family TERMINATION_FEE \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-termination-fee.json
```

It carries every other family's entry through byte-identical, so it is safe to run while other families are being authored. `--check` exits 1 if the override is stale.

---

## What Milestone A does not do

- No activation, no product write, no database write. The registration successor authority records `package_registration_count: 1` with `product_write_count: 0`, and stops before activation.
- No spine merge. The module is family-local.
- No Phase 3 reference materialisation.
- No decision on the ten sole-remedy rows or the two reverse-side rows; both are carried as holds into the inventory packet.

## Next

1. **Ben, when available:** rule on sole-remedy ownership (termination fee vs specific performance remedies) and on whether a reverse termination fee is its own subtype. Both are in the packet.
2. Spine merge PR for this module, queued behind Closing Conditions, Representations and Financing Covenants.
3. N1 family #11.
