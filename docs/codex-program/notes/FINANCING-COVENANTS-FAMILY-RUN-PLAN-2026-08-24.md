# FINANCING_COVENANTS — Work3 Milestone A run plan

**Family:** N1 #9 `FINANCING_COVENANTS`
**Branch:** `codex/recover-m7-20260812`
**Date:** 2026-08-24
**Status:** Milestone A **complete** — 9/9 tests pass, package sealed on disk, nothing committed
**Prep:** `FINANCING-COVENANTS-WORK3-PARALLEL-PREP-2026-08-24.md`

---

## Outcome

| Item | Value |
|---|---|
| Profiles | **5** (prep estimated 5–10) |
| Comparator deals | 3 — Concho, Skechers, TopBuild |
| Governed M4 claims | 5, all accounted; 0 M4-silent terminals |
| Disposition | 5 APPROVE, 0 HOLD, 0 PARTIAL — every row carries `LEGAL_GROUPING_REVIEW_REQUIRED` |
| Subtype buckets | 3 populated of 7 registered (`OBTAIN_FINANCING`, `PAYOFF`, `NO_FINANCING_CONDITION`) |
| Phase 3 | **skipped** — every calibration provision example has empty M3 dependency ids |
| Spine | untouched; family-local module only |

Package: `evidence/.../control/m7-v2-repair-family-work3-profile-package-financing-covenants.json`
`family_profile_package_id` `05d04132c67da38…`, 30,025 bytes, sha256 `59733929674…`,
`validateSingleFamilyPackageInventory` → `FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`.

---

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js
```

2026-08-24, exit 0, **9 pass / 0 fail**, ~13.6 s. Covers Phase 2 partition, Phase 4 package
review, Work3 unapproved inventory review, Ben inventory session disposition, family package
seal, registration, the packet draft's honest holds, the disposition's ruling reuse, and the
on-disk package.

`bash scripts/lint/forbidden-patterns.sh` reports one pre-existing INVARIANT-4 failure in
`family-role-schemas/ANTITRUST_REGULATORY.json`, unrelated to this family. No new hits.

---

## Why the partition is claim-scale

The calibration pack carries three provision examples but the comparator M4 evidence carries
five governed claims. A section-scale partition would have folded Concho §6.17: it prints one
section but carries two payoff lead-time claims that differ only by `delivery_stage` (DRAFT vs
FINAL). Folding them would invent a single obligation the agreement does not contain, so each
governed claim gets its own terminal and the required expression signature appends the stage
token wherever a claim carries one:

```
FINANCING_COVENANTS::PAYOFF::CONCHO_6_17_PAYOFF_DELIVERY_LEAD_TIME_DAYS_DRAFT
FINANCING_COVENANTS::PAYOFF::CONCHO_6_17_PAYOFF_DELIVERY_LEAD_TIME_DAYS_FINAL
```

Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each independently operative limb to keep its own
standard, which is the same reasoning Closing Conditions and Representations applied.

TopBuild §7.16 (financing-source protection waiver) is recorded as a **link-only boundary owned
by `GUARANTY_FINANCING_PARTY`**, not as a Financing Covenants terminal, under Q02
(`M5-RULING-ONE-SEMANTIC-OWNER`).

---

## Open holds (honest — not bugs)

1. **All 5 rows: `LEGAL_GROUPING_REVIEW_REQUIRED`.** The sealed M5 role schema admits all three
   Financing Covenants claim keys under all seven subtype buckets, so the claim-key → subtype
   mapping used here is a proposal, not a sealed rule. The seal records
   `legal_grouping_disposition_state: PENDING_LEGAL_REVIEW`.
2. **2 rows: `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE`.** Both Concho payoff
   lead-time rows are authored under `PAYOFF`, while the calibration pack tags every provision
   example `OBTAIN_FINANCING`. The divergence is stamped, not silently resolved.
3. **1 row: `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`.** The
   no-financing-condition acknowledgment is a governed M4 claim with no matching calibration
   provision example.

Ben was unavailable, so the sealed M5 programme rulings were applied verbatim
(`M5-RULING-ONE-OPERATIVE-LIMB`, `M5-RULING-ONE-SEMANTIC-OWNER`,
`M5-RULING-FAIL-DEPENDENT-PROPOSITION`). `new_family_specific_ruling_count` is **0** — no lawyer
ruling was invented.

### The one question for Ben

The sealed role schema lets any Financing Covenants claim sit in any of the seven subtype
buckets, and the calibration pack labels all three examples `OBTAIN_FINANCING`. This run instead
files the two payoff lead-time claims under `PAYOFF` and the no-financing-condition
acknowledgment under `NO_FINANCING_CONDITION`, because the claim keys say so. Ben needs to
confirm whether that split is right or whether all five belong under `OBTAIN_FINANCING`.

---

## Regenerate in order

Digests are pinned into the family-local module and the test, so run these in sequence and
re-run the test after any change:

```bash
node scripts/stage-2y-structure-m7-v2-financing-covenants-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-financing-covenants-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-financing-covenants-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-financing-covenants-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-financing-covenants-family-profile-package.mjs
```

Regeneration is idempotent: the package script reproduced identical bytes on a second run.

---

## Artefacts

**Module:** `lib/canonical-v2/m7-v2-financing-covenants-authoring.js` — self-contained
family-local module (mirrors the Representations pattern, not the Guaranty shim). Six public
facades: Phase 2 proposal, Phase 4 package review, Work3 unapproved inventory review, Ben
inventory session disposition, family package seal, family package registration.

**Test:** `tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js`

**Evidence** (all under `evidence/canonical-v2/stage-2y-structure-migration/control/`):

| File | Record id field |
|---|---|
| `m7-v2-repair-contract-financing-covenants-authoring-phase2-authority-v2.json` | `financing_covenants_authoring_phase2_authority_id` |
| `m7-v2-repair-contract-financing-covenants-authoring-phase4-family-profile-package-review-authority.json` | `…phase4_family_profile_package_review_authority_id` |
| `m7-v2-repair-contract-work3-financing-covenants-unapproved-inventory-review-authority.json` | `work3_financing_covenants_unapproved_inventory_review_authority_id` |
| `m7-v2-repair-financing-covenants-5-profile-inventory-review-packet-draft.json` | `inventory_review_packet_id` |
| `m7-v2-repair-financing-covenants-5-profile-inventory-disposition.json` | `inventory_disposition_id` |
| `m7-v2-repair-financing-covenants-ben-inventory-session-receipt.json` | `ben_inventory_session_receipt_id` |
| `m7-v2-repair-contract-work3-financing-covenants-ben-inventory-session-successor-authority.json` | `…ben_inventory_session_successor_authority_id` |
| `m7-v2-repair-contract-work3-financing-covenants-family-package-seal-successor-authority.json` | `…family_package_seal_successor_authority_id` |
| `m7-v2-repair-financing-covenants-family-package-seal-receipt.json` | `financing_covenants_family_package_seal_receipt_id` |
| `m7-v2-repair-contract-work3-financing-covenants-registration-successor-authority.json` | `…registration_successor_authority_id` |
| `m7-v2-repair-family-work3-profile-package-financing-covenants.json` | `family_profile_package_id` |

**Not wired into the lawful Work3 fixture.** `on_disk_family_package_overrides` in
`lawful-work3-family-package-set.json.gz.b64` is shared with the do-not-touch spine test and
with in-flight parallel family work, so this package is validated directly through
`validateSingleFamilyPackageInventory` in the family test instead. Registering it later is one
override entry plus
`scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs`.

---

## Next

- Spine merge: queue as a PR alongside Closing Conditions and Representations
  (`WORK3-FAMILY-LOCAL-TO-SPINE-MERGE-PLAN-2026-08-24.md`).
- Ben's subtype-grouping answer lifts the three review flags and re-seals the package.
- Family #10 `TERMINATION_FEE` is independent of this one.
