# PROXY_MEETING — Work3 Milestone A run plan

**Family:** N1 #12 `PROXY_MEETING`
**Branch:** `codex/recover-m7-20260812`
**Date:** 2026-08-24
**Status:** Milestone A **complete** — 10/10 tests pass, package sealed on disk, nothing committed
**Prep:** `PROXY-MEETING-WORK3-PARALLEL-PREP-2026-08-24.md`

---

## Outcome

| Item | Value |
|---|---|
| Profiles | **31** (prep estimated ~28–31) |
| Comparator deals | 6 — Concho, Metsera, Modiv, Red Hat, SkyWater, TopBuild |
| Governed M4 claims | 31, all accounted; 0 M4-silent terminals |
| Disposition | 31 APPROVE, 0 HOLD, 0 PARTIAL — every row carries `LEGAL_GROUPING_REVIEW_REQUIRED` |
| Subtype buckets | 5 populated of 6 registered (`DOCUMENT_FILING`, `MEETING_CALL_OR_HOLD`, `RECORD_DATE_OR_BROKER_SEARCH`, `RECOMMENDATION_INCLUSION`, `ADJOURNMENT`; `SUBSIDIARY_APPROVAL` empty) |
| Phase 3 | **skipped** — every calibration provision example has empty M3 dependency ids |
| Spine | untouched; family-local module only |

Package: `evidence/.../control/m7-v2-repair-family-work3-profile-package-proxy-meeting.json`
`family_profile_package_id` `d39988aa5e841919…`, 388,729 bytes, sha256 `a859198669e1…`,
`validateSingleFamilyPackageInventory` → `FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`.

---

## Post-seal extraction backlog

Ben settled ownership for two V1 facts on 2026-09-01. Decision 23 records the
rulings. This is an extraction backlog only. It does not alter the sealed
31-profile package or answer the grouping question below.

| Fact | V1 fields | Settled owner | Current state |
|---|---|---|---|
| Vote standard | `approvalDefinition`; `voteThreshold` | `PROXY_MEETING` | Owner set; extraction open. The sealed package has no Vote-standard topic. |
| Force-the-vote | `forceTheVote`; `forceTheVoteDetails`; `forceTheVoteType` | `PROXY_MEETING` | Owner set; extraction open. Store whether the meeting obligation survives a recommendation change. No-shop supplies only the recommendation-change reference. |

This record is a mechanical application of Decision 22 and paragraph 2 of
`BEN-STANDING-AUTHORIZATION-2026-09-01.md`. It authorises no new extraction
claim, taxonomy change, review-flag clearance, serving change or production
effect.

---

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-proxy-meeting-work3.test.js
```

2026-08-24, exit 0, **10 pass / 0 fail**, ~29 s. Covers Phase 2 partition, Phase 4 package
review, Work3 unapproved inventory review, Ben inventory session disposition, family package
seal, registration, the packet draft's honest holds, the disposition's ruling reuse, the
on-disk package, and the lawful Work3 fixture override.

---

## Why the partition is claim-scale

The calibration pack carries six provision examples (all tagged `DOCUMENT_FILING`) but the
comparator M4 evidence carries 31 governed claims across five populated subtype buckets.
A section-scale partition would fold multi-limb sections — Concho §6.6 alone carries duplicate
claim-definition rows under different source citations (e.g. two `MEETING_CONVENE_OBLIGATION`
limbs at 6.6(a) and 6.6(b)), and TopBuild §4.5 carries eight claims. Each governed claim gets
its own terminal; expression signatures append source-citation and adjournment `reason_kind`
discriminators where the comparator resolves multiple rows under one citation.

Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each independently operative limb to keep its own
standard, matching D&O and Closing Conditions practice.

---

## Open holds (honest — not bugs)

1. **All 31 rows: `LEGAL_GROUPING_REVIEW_REQUIRED`.** The sealed M5 role schema admits all seven
   claim keys under all six subtype buckets, so the claim-key → subtype mapping used here is a
   proposal, not a sealed rule. The seal records `legal_grouping_disposition_state:
   PENDING_LEGAL_REVIEW`.
2. **27 rows: `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE`.** Every calibration
   provision example is tagged `DOCUMENT_FILING` while the comparator spans five populated
   buckets. The divergence is stamped, not silently resolved.
3. **2 rows: `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES`.** Metsera §6.11 carries
   two governed claims (meeting deadline and convene obligation) with no matching calibration
   provision example (calibration anchors §6.10 only).

Ben was unavailable, so the sealed M5 programme rulings were applied verbatim
(`M5-RULING-ONE-OPERATIVE-LIMB`, `M5-RULING-ONE-SEMANTIC-OWNER`,
`M5-RULING-FAIL-DEPENDENT-PROPOSITION`). `new_family_specific_ruling_count` is **0** — no lawyer
ruling was invented.

### The one question for Ben

The calibration pack labels all six provision examples `DOCUMENT_FILING`, but the comparator
spans five populated buckets (filing, meeting-call, record-date/broker-search, recommendation,
adjournment). Ben needs to confirm whether that six-bucket split is right or whether a
different subtype partition should collapse or expand the inventory.

---

## Regenerate in order

Digests are pinned into the family-local module and the test, so run these in sequence and
re-run the test after any change:

```bash
node scripts/stage-2y-structure-m7-v2-proxy-meeting-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-proxy-meeting-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-proxy-meeting-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-proxy-meeting-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-proxy-meeting-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family PROXY_MEETING \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-proxy-meeting.json
```

Then patch pinned digests in `lib/canonical-v2/m7-v2-proxy-meeting-authoring.js` and
`tests/stage-2y-structure-m7-v2-repair-proxy-meeting-work3.test.js` from script stdout.

---

## Files touched (family-local only)

- `lib/canonical-v2/m7-v2-proxy-meeting-authoring.js`
- `scripts/stage-2y-structure-m7-v2-proxy-meeting-*.mjs` (5 scripts)
- `tests/stage-2y-structure-m7-v2-repair-proxy-meeting-work3.test.js`
- `evidence/.../control/m7-v2-repair-contract-proxy-meeting-*` (Phase 2 + Phase 4 authorities)
- `evidence/.../control/m7-v2-repair-proxy-meeting-*` (inventory, disposition, seal receipts)
- `evidence/.../control/m7-v2-repair-contract-work3-proxy-meeting-*` (Work3 successor authorities)
- `evidence/.../control/m7-v2-repair-family-work3-profile-package-proxy-meeting.json`
- `tests/fixtures/.../lawful-work3-family-package-set.json.gz.b64` (PROXY_MEETING override added)

**Not touched:** spine, `work3.test.js`, `m7-v2-contract.js`, `m7-v2-deterministic-generator.js`,
sealed other-family packages.
