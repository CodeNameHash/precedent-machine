# Closing conditions family — runnable plan (current → seal)

Date: 2026-08-24  
Branch: `codex/recover-m7-20260812`  
Authority: `docs/core/PLAN.md`; prep: `CLOSING-CONDITIONS-WORK3-PARALLEL-PREP-2026-08-24.md`  
Pattern reference: `DNO-FAMILY-RUN-PLAN-2026-08-24.md`, `GUARANTY-FAMILY-RUN-PLAN-2026-08-24.md` (D&O-minimal Phase 2→4 path).

Programme slot: **N1 family #7** — after Termination, MAE, D&O, General Covenants, Guaranty, Representations.

---

## What "done" means for closing conditions (Milestone A)

| Milestone | Meaning | Not included |
|---|---|---|
| **A. Family shape seal** | 57 comparator blueprint profiles captured; Work3 closing conditions package registration authority green; honest holds recorded where the comparator bucket has no sealed M5 subtype label | Product serving, M9/M10, full calibration-pack Ben approval as `PROFILE_SET_V1`, subtype partition reconciliation |

Stop at Phase 4 unapproved package review unless a Ben-approved governed-disclosure gap is identified. **Phase 3 reference chain omitted** (D&O-minimal path); no blocking M3 reference edges appeared.

---

## Profile count (from comparator resolutions, not provision examples)

Source: `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/CLOSING_CONDITIONS.json`.

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed bindings) | **7** | Skechers, Red Hat, Metsera, and four further deals |
| Sum of `resolution_claims` across comparator runs | **57** | one resolved condition limb each |
| Provision examples (complete source units) | **7** | section containers, all tagged `STOCKHOLDER_APPROVAL` in the pack |
| Sealed M5 subtype labels | **8** | all sharing the same 12 `claim_definition_keys` |
| Derived comparator classification buckets | **9** | from 10 distinct `concept_key` values |

**Decision — one profile per resolved claim, not per provision example.** The Guaranty family authored one terminal per provision example because its comparator set had a single governed claim. Closing conditions is the opposite shape: seven section containers carrying 57 independently operative condition limbs. Q01 (`M5-RULING-ONE-OPERATIVE-LIMB`) requires each limb to keep its own standard, so collapsing to seven rows would destroy the standards the ruling protects. The family therefore follows the General Covenants pattern and builds terminals from comparator resolution entries, giving **57 profiles**.

**Bucket distribution:**

| Bucket | Rows | Sealed M5 label? |
|---|---:|---|
| `OFFICER_CERTIFICATE` (`COND-B-CERT` + `COND-S-CERT`) | 12 | yes |
| `LEGAL_RESTRAINT` | 10 | yes |
| `COVENANT_COMPLIANCE` | 9 | **no** |
| `S4_EFFECTIVENESS` | 8 | yes |
| `REGULATORY_APPROVAL` | 6 | yes |
| `STOCKHOLDER_APPROVAL` | 5 | yes |
| `LISTING` | 4 | **no** |
| `NO_MAE` | 2 | **no** |
| `FRUSTRATION` | 1 | **no** (Metsera §7.04 branch) |

Two sealed labels — `BRINGDOWN` and `TAX_OPINION` — drew no comparator instances. A family returning zero for a label is not a defect; these deals simply carry no separately resolved tax-opinion condition, and bring-down content resolved into `OFFICER_CERTIFICATE`.

---

## Honest holds (16 of 57)

Ben was unavailable, so no new lawyer rulings were invented. The sealed M5 programme rulings were applied verbatim (see `CLOSING-CONDITIONS-BEN-RULINGS-Q01-Q03-2026-08-24.md`), and every row the rulings cannot dispose of is held rather than generalised:

| Hold flag | Rows | Meaning |
|---|---:|---|
| `M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED` | 15 | comparator bucket (`COVENANT_COMPLIANCE`, `LISTING`, `NO_MAE`) has no sealed M5 subtype label |
| `METSERA_FRUSTRATION_BRANCH_DISPOSITION_REQUIRED` | 1 | Metsera frustration branch needs an explicit legal disposition |

Technical disposition recorded: **41 APPROVE / 16 HOLD / 0 REJECT**, with `LEGAL_GROUPING_REVIEW_REQUIRED` on all 57 rows. Cross-family rows additionally carry `CROSS_FAMILY_LINK_ONLY_MAE_DEFINITION` or `CROSS_FAMILY_LINK_ONLY_REPRESENTATIONS_BRINGDOWN` so that Q02's one-owner rule is not violated by a later collapse.

**What Ben still owns:** reconciling the nine comparator buckets against the eight sealed M5 subtype labels, and disposing of the Metsera frustration branch. Neither blocks Milestone A.

---

## Current state (verified 2026-08-24)

| Check | State |
|---|---|
| M5 calibration pack + proposed role schema | **Proposed** — `PROPOSED_AWAITING_BEN_APPROVAL`; pack Q01–Q03 read as `OPEN` |
| Sealed control role schema | **Sealed** — 8 subtypes, Q01–Q03 bound via `m5-programme-rulings.json` |
| Phase 2 authoring authority | ✅ `m7-v2-repair-contract-closing-conditions-authoring-phase2-authority-v2.json` (57 terminals, 57 M4 claims, 7 agreements) |
| Phase 3 reference chain | **Skipped** — no blocking M3 reference edges |
| Phase 4 package review authority | ✅ `...-phase4-family-profile-package-review-authority.json` (57-row schedule, 16 hold rows) |
| Family-local module | ✅ `lib/canonical-v2/m7-v2-closing-conditions-authoring.js` (self-contained; spine untouched) |
| Dedicated Work3 test module | ✅ `tests/stage-2y-structure-m7-v2-repair-closing-conditions-work3.test.js` — **10/10 pass** |
| Inventory packet + disposition | ✅ 41 APPROVE / 16 HOLD |
| Seal → registration successor authorities | ✅ all three on disk with receipts |
| On-disk family package | ✅ `m7-v2-repair-family-work3-profile-package-closing-conditions.json` (57 profiles, contract validation green) |
| Closing conditions Milestone A | ✅ **Complete** |

**Spine untouched.** No edits to `m7-v2-profile-authoring.js`, `m7-v2-contract.js`, `m7-v2-deterministic-generator.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`, or any sealed package for Termination / MAE / D&O / GC / Guaranty / Representations.

---

## Implementation slice order (as landed)

| Order | Deliverable | State |
|---|---|---|
| **S1** | Phase 2 authority v2 JSON (57 terminals from comparator resolutions) | ✅ |
| **S2** | Family-local module Phase 2 facade | ✅ |
| **S3** | Phase 4 review authority + 57-row schedule + facade | ✅ |
| **S4** | Inventory review authority + packet draft with honest hold flags | ✅ |
| **S5** | Ben rulings note (sealed M5 rulings applied), disposition, session receipt | ✅ |
| **S6** | Seal successor authority + seal receipt | ✅ |
| **S7** | Registration successor authority + registration facade | ✅ |
| **S8** | On-disk family profile package + regenerate script | ✅ |
| **S9** | Dedicated Work3 test file — full ladder | ✅ 10/10 |

**Intentionally omitted:** Phase 3 reference materialisation, Work3 Stage A/B, core integration, Phase 5, activation.

---

## GREEN proof command (full Milestone A ladder — 10/10 pass as of 2026-08-24)

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-closing-conditions-work3.test.js
```

Expect exit 0, `# pass 10`. Do **not** pipe to `tail`/`head`; redirect to a log and check the exit code directly.

Evidence regeneration, in order (each step's output digests are pinned into the module, so re-run the whole chain):

```bash
node scripts/stage-2y-structure-m7-v2-closing-conditions-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-closing-conditions-family-profile-package.mjs
```

Test names in the ladder:

| Slice | Test name |
|---|---|
| Phase 2 | `Phase2 proposal derives a deterministic unapproved CLOSING_CONDITIONS partition` |
| Phase 4 | `Phase4 CLOSING_CONDITIONS package review returns 57 unapproved proposals without Work3 identities` |
| Inventory review | `Work3 CLOSING_CONDITIONS unapproved inventory review passes the validator without Work3 identity` |
| Ben disposition | `Work3 CLOSING_CONDITIONS Ben inventory disposition captures 41 approve and 16 honest holds` |
| Family seal | `Work3 CLOSING_CONDITIONS family package seal defers subtype partition without registering` |
| Registration | `Work3 CLOSING_CONDITIONS family package registration binds the seal receipt without activation` |
| Packet shape | `CLOSING_CONDITIONS inventory packet carries per-row shape summaries and honest hold flags` |
| Disposition rule | `CLOSING_CONDITIONS Ben disposition holds every row whose bucket has no sealed M5 label` |
| Rulings provenance | `CLOSING_CONDITIONS Ben rulings note reuses the sealed M5 programme rulings` |
| Package on disk | `CLOSING_CONDITIONS Milestone A family package on disk validates 57 registered profiles` |

---

## Ben inventory session (technical default applied)

| Step | Owner | Action | Gate |
|---|---|---|---|
| 3.1 | Ben | Review rows using `shape_summary`, deal, and `review_flags` | 57-row packet with `subtype_bucket_counts` and `honest_hold_summary` |
| 3.2 | Ben | Reconcile the nine comparator buckets against the eight sealed M5 subtype labels | **Pending legal** — 15 rows held |
| 3.3 | Ben | Dispose of the Metsera frustration branch | **Pending legal** — 1 row held |
| 3.4 | Agent | Apply sealed M5 Q01–Q03 rather than invent family rulings | ✅ `CLOSING-CONDITIONS-BEN-RULINGS-Q01-Q03-2026-08-24.md` |

---

## Appendix — cross-family boundaries

Closing conditions is downstream of four other families. Q02 (`M5-RULING-ONE-SEMANTIC-OWNER`) means it links rather than restates:

| Fact | Owner | Closing conditions row |
|---|---|---|
| MAE definition and carve-outs | `MAE_DEFINITION` | `NO_MAE` trigger only |
| Representation bring-down text | `REPRESENTATIONS_WARRANTIES` | `OFFICER_CERTIFICATE` bring-down test only |
| Termination for failure of a condition | `TERMINATION_RIGHTS` | not stored here |
| Covenant text complied with | `GENERAL_COVENANTS` | `COVENANT_COMPLIANCE` test only |

**Closing-conditions-specific stress (vs Guaranty / GC):** the family's provision examples and its comparator claims disagree by an order of magnitude (7 vs 57), the calibration pack tags every example `STOCKHOLDER_APPROVAL`, and the sealed subtype schema gives all 8 labels the same 12 claim definition keys — so the sealed schema provides no partition signal and the partition had to come from comparator `concept_key` values.
