# NO_OTHER_REPS_FRAUD — Work3 Milestone A run plan

**Family:** N1 #8 `NO_OTHER_REPS_FRAUD`
**Branch:** `codex/recover-m7-20260812`
**Date:** 2026-08-24
**Status:** Milestone A **complete** — 11/11 tests pass, package sealed on disk, nothing committed
**Prep:** `NO-OTHER-REPS-FRAUD-WORK3-PARALLEL-PREP-2026-08-24.md`

---

## Outcome

| Item | Value |
|---|---|
| Profiles | **36** (prep estimated 30–36) |
| Comparator deals | 7 — Concho, Metsera, Modiv, Red Hat, Skechers, SkyWater, TopBuild |
| Governed M4 claims | 36, all accounted; 0 M4-silent terminals |
| Disposition | 36 APPROVE, 0 HOLD, 0 PARTIAL — every row carries `LEGAL_GROUPING_REVIEW_REQUIRED` |
| Subtype buckets | 1 populated of 4 registered (`NO_OTHER_REPRESENTATIONS_DISCLAIMER`) |
| Link censuses | 24 rows `SHARED_SOURCE_CITATION_LINK_ONLY`, 3 rows `CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY` |
| Phase 3 | **skipped** — every calibration provision example has empty M3 dependency ids |
| Spine | untouched; family-local module only |

Package: `evidence/.../control/m7-v2-repair-family-work3-profile-package-no-other-reps-fraud.json`
`family_profile_package_id` `45a1f152f160…`, 159,559 bytes, sha256 `307254f8473f…`,
`validateSingleFamilyPackageInventory` → `FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`.

---

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-no-other-reps-fraud-work3.test.js
```

2026-08-24, exit 0, **11 pass / 0 fail**, ~26.5 s. Covers the Phase 2 partition, the two link
censuses and the classifier boundary against sealed Representations, Phase 4 package review,
Work3 unapproved inventory review, Ben inventory session disposition, family package seal,
registration, the packet draft's honest holds, the disposition's ruling reuse, and the on-disk
package.

---

## Why the partition is claim-scale

The calibration pack carries seven provision examples but the comparator M4 evidence carries 36
governed claims. The seven examples are section containers: a single no-additional-representations
section routinely holds a target-side disclaimer, a buyer-side disclaimer, a non-reliance
acknowledgment and an extra-contractual reliance disclaimer, each with its own actor and its own
carve-out. Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each independently operative limb to keep
its own standard, so every governed claim becomes one terminal.

Claim definition split: `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT` 22,
`NON_RELIANCE_ACKNOWLEDGMENT_PRESENT` 9, `EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT` 5. The 36
claims cover 33 distinct authored shapes; the required expression signature appends the M4 claim
identifier so the inventory stays claim-scale even where two limbs print identically.

---

## The classifier boundary against REPRESENTATIONS

`section-family-classifier.js` deletes a `REPRESENTATIONS` classification when
`NO_OTHER_REPS_FRAUD` wins the same M2 source node, so the two families could in principle have
fought over the same content. They did not. Comparing this family's 36 terminals against the
sealed Representations Phase 2 terminal registry finds **zero** shared M2 source nodes and zero
shared source-unit keys, and the family test asserts both.

Three TopBuild rows (§3.1(w), §3.2(r) ×2) share a *printed section* with sealed Representations
profiles, because the disclaimer is a lettered sub-paragraph of the representations article. Those
carry `CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY` with disposition `LINK_ONLY_DO_NOT_DUPLICATE` under
Q02 (`M5-RULING-ONE-SEMANTIC-OWNER`). No Representations profile was absorbed and no disclaimer
content was duplicated into the sealed Representations package.

Both link flags are **derived, not assigned**: the Phase 2 generator computes them from observed
evidence into each terminal's `linked_rule_bindings`, and the Phase 4 generator maps `link_kind`
one-to-one onto `review_flags`. Nothing in the ladder invents a link.

---

## Open holds (honest — not bugs)

1. **All 36 rows: `LEGAL_GROUPING_REVIEW_REQUIRED`.** The calibration pack registers four subtype
   buckets but tags all seven provision examples `NO_OTHER_REPRESENTATIONS_DISCLAIMER`, and the
   sealed role schema admits all three claim definition keys under all four buckets. Nothing in the
   sealed evidence separates them, so every row is authored under the tagged bucket and the seal
   records `legal_grouping_disposition_state: PENDING_LEGAL_REVIEW` (1 populated of 4 registered).
2. **24 rows: `SHARED_SOURCE_CITATION_LINK_ONLY`.** Those rows sit on an authored citation that
   carries at least one other governed claim (Concho §5.19(b) and Modiv §3.25 carry three apiece;
   nine further citations carry two). Whether each is a separate proposition or one proposition
   with ordered roles is the open half of Q01. The partition keeps them separate and links them,
   which is reversible; folding them would not be.
3. **3 rows: `CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY`** — the TopBuild shared-section rows above.

Red Hat §8.03(p) willful-breach definitions are left in the open world as definition-only content,
not forced into a `FRAUD_CARVEOUT` terminal; inferring that bucket without intake is what Q03
(`M5-RULING-FAIL-DEPENDENT-PROPOSITION`) forbids.

Ben was unavailable, so the sealed M5 programme rulings were applied verbatim
(`NO-OTHER-REPS-FRAUD-BEN-RULINGS-Q01-Q03-2026-08-24.md`). `new_family_specific_ruling_count` is
**0** — no lawyer ruling was invented.

### The one question for Ben

The sealed role schema lets any no-other-reps claim sit in any of the four subtype buckets, and the
calibration pack labels all seven examples `NO_OTHER_REPRESENTATIONS_DISCLAIMER`. It is tempting to
read `NON_RELIANCE_ACKNOWLEDGMENT_PRESENT` claims into the `NON_RELIANCE_ACKNOWLEDGMENT` bucket on
the strength of the name, but nothing sealed says so, so this run filed all 36 under the tagged
bucket. Ben needs to say which disclaimer element belongs in which of the four buckets — and,
separately, whether coordinated elements on one authored citation are one proposition with roles or
several linked propositions.

---

## Regenerate in order

Digests are pinned into the family-local module and the test, so run these in sequence and re-run
the test after any change:

```bash
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-family-profile-package.mjs
```

---

## Artefacts

**Module:** `lib/canonical-v2/m7-v2-no-other-reps-fraud-authoring.js` — self-contained family-local
module (mirrors the Representations pattern, not the Guaranty shim). Six public facades: Phase 2
proposal, Phase 4 package review, Work3 unapproved inventory review, Ben inventory session
disposition, family package seal, family package registration.

**Test:** `tests/stage-2y-structure-m7-v2-repair-no-other-reps-fraud-work3.test.js`

**Rulings note:** `docs/codex-program/notes/NO-OTHER-REPS-FRAUD-BEN-RULINGS-Q01-Q03-2026-08-24.md`

**Evidence** (all under `evidence/canonical-v2/stage-2y-structure-migration/control/`):

| File | Record id field |
|---|---|
| `m7-v2-repair-contract-no-other-reps-fraud-authoring-phase2-authority-v2.json` | `no_other_reps_fraud_authoring_phase2_authority_id` |
| `m7-v2-repair-contract-no-other-reps-fraud-authoring-phase4-family-profile-package-review-authority.json` | `…phase4_family_profile_package_review_authority_id` |
| `m7-v2-repair-contract-work3-no-other-reps-fraud-unapproved-inventory-review-authority.json` | `work3_no_other_reps_fraud_unapproved_inventory_review_authority_id` |
| `m7-v2-repair-no-other-reps-fraud-36-profile-inventory-review-packet-draft.json` | `inventory_review_packet_id` |
| `m7-v2-repair-no-other-reps-fraud-36-profile-inventory-disposition.json` | `inventory_disposition_id` |
| `m7-v2-repair-no-other-reps-fraud-ben-inventory-session-receipt.json` | `ben_inventory_session_receipt_id` |
| `m7-v2-repair-contract-work3-no-other-reps-fraud-ben-inventory-session-successor-authority.json` | `…ben_inventory_session_successor_authority_id` |
| `m7-v2-repair-contract-work3-no-other-reps-fraud-family-package-seal-successor-authority.json` | `…family_package_seal_successor_authority_id` |
| `m7-v2-repair-no-other-reps-fraud-family-package-seal-receipt.json` | `no_other_reps_fraud_family_package_seal_receipt_id` |
| `m7-v2-repair-contract-work3-no-other-reps-fraud-registration-successor-authority.json` | `…registration_successor_authority_id` |
| `m7-v2-repair-family-work3-profile-package-no-other-reps-fraud.json` | `family_profile_package_id` |

**Not wired into the lawful Work3 fixture.** `on_disk_family_package_overrides` in
`lawful-work3-family-package-set.json.gz.b64` is shared with the do-not-touch spine test and with
in-flight parallel family work, so this package is validated directly through
`validateSingleFamilyPackageInventory` in the family test instead. Registering it later is one
override entry via
`scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs`.

---

## Next

- Spine merge: queue as a PR alongside Closing Conditions, Representations, Financing Covenants
  and Termination Fee (`WORK3-FAMILY-LOCAL-TO-SPINE-MERGE-PLAN-2026-08-24.md`).
- Ben's subtype-bucket answer lifts `LEGAL_GROUPING_REVIEW_REQUIRED` on all 36 rows and re-seals
  the package; his Q01 answer on shared-citation limbs may fold or keep the 24 linked rows.
- Family #11 `ANTITRUST_REGULATORY` is independent of this one.
