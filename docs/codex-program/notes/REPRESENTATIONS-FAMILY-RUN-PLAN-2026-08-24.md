# Representations family — Work3 Milestone A run plan

Date: 2026-08-24  
Family: `REPRESENTATIONS` (N1 family #6)  
Branch: `codex/recover-m7-20260812`  
Status: **Milestone A green** — Phase 2 → Phase 4 → inventory → disposition → seal → registration → on-disk package, 10/10 tests passing. Not committed.

## What was built

D&O-minimal path, family-local. Phase 3 reference materialisation was skipped: all six calibration provision examples carry empty M3 dependency identifier lists and no authored terminal carries a blocking reference edge, so there was nothing for a reference chain to resolve.

| Artefact | Path |
|---|---|
| Phase 2 authority | `evidence/.../control/m7-v2-repair-contract-representations-authoring-phase2-authority-v2.json` |
| Phase 4 authority | `evidence/.../control/m7-v2-repair-contract-representations-authoring-phase4-family-profile-package-review-authority.json` |
| Family module | `lib/canonical-v2/m7-v2-representations-authoring.js` |
| Inventory review authority | `evidence/.../control/m7-v2-repair-contract-work3-representations-unapproved-inventory-review-authority.json` |
| Inventory packet draft | `evidence/.../control/m7-v2-repair-representations-70-profile-inventory-review-packet-draft.json` |
| Inventory disposition | `evidence/.../control/m7-v2-repair-representations-70-profile-inventory-disposition.json` |
| Ben session receipt | `evidence/.../control/m7-v2-repair-representations-ben-inventory-session-receipt.json` |
| Ben session successor authority | `evidence/.../control/m7-v2-repair-contract-work3-representations-ben-inventory-session-successor-authority.json` |
| Seal successor authority | `evidence/.../control/m7-v2-repair-contract-work3-representations-family-package-seal-successor-authority.json` |
| Seal receipt | `evidence/.../control/m7-v2-repair-representations-family-package-seal-receipt.json` |
| Registration successor authority | `evidence/.../control/m7-v2-repair-contract-work3-representations-registration-successor-authority.json` |
| On-disk family package | `evidence/.../control/m7-v2-repair-family-work3-profile-package-representations.json` |
| Ben rulings note | `docs/codex-program/notes/REPRESENTATIONS-BEN-RULINGS-Q01-Q03-2026-08-24.md` |
| Tests | `tests/stage-2y-structure-m7-v2-repair-representations-work3.test.js` |

Generator scripts, in run order:

```bash
node scripts/stage-2y-structure-m7-v2-representations-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-representations-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-representations-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-representations-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-representations-family-profile-package.mjs
```

Each script prints the byte length, sha256 and record id of what it wrote. Those values are pinned as constants in `lib/canonical-v2/m7-v2-representations-authoring.js` and again in the test module, so re-running any script means re-pinning both.

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-representations-work3.test.js
```

10 tests, 10 pass, 0 fail (2026-08-24).

## Profile census

**70 profiles from 70 governed comparator M4 claims**, one profile per claim, across six comparator deals.

| Deal | Profiles |
|---|---|
| skechers | 23 |
| concho | 12 |
| metsera | 10 |
| topbuild | 10 |
| redhat | 9 |
| skywater | 6 |

| Claim definition key | Profiles |
|---|---|
| `REPRESENTATION_ACCURACY_STANDARD` | 55 |
| `KNOWLEDGE_QUALIFIER` | 15 |

The 70 claims fall into only 34 distinct authored shapes once the claim identifier is dropped from the signature. The signature deliberately retains the M4 claim identifier, so the inventory stays claim-scale rather than collapsing to 34 rows or to the six calibration provision examples. This mirrors `GENERAL_COVENANTS`, which takes the same approach for the same reason.

## Honest holds

**`LEGAL_GROUPING_REVIEW_REQUIRED` on all 70 rows.** The calibration pack registers six subtype buckets (`STATUS_REPRESENTATION`, `COMPLIANCE_REPRESENTATION`, `DOCUMENT_REPRESENTATION`, `CONTRACT_REPRESENTATION`, `FINANCIAL_REPRESENTATION`, `NEGATIVE_REPRESENTATION`) but tags every one of its six provision examples `STATUS_REPRESENTATION`, and the comparator resolution data carries no field that separates the other five. Assigning them is lawyer judgment, so all six buckets are registered in the classification path registry, all 70 terminals are authored under `STATUS_REPRESENTATION`, and the seal records `disposition_status: PENDING_LEGAL_REVIEW` with `populated_subtype_bucket_count: 1` against `registered_subtype_bucket_count: 6`. Nothing was guessed.

**`CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY` on 15 rows.** The knowledge-qualifier rows depend on the knowledge-person definition, which `KEY_DEFINED_TERMS` owns under the Q02 one-owner ruling. The rows store that the standard is knowledge-limited; they do not restate who the knowledge persons are. This is a link marker, not a hold.

Neither flag is a hold: the technical disposition is APPROVE on all 70 rows with flags acknowledged, `hold_count: 0`. Holding rows here would mean inventing a taxonomy decision to hold them against.

## Deliberate omission

The family is **not** registered in `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` as an on-disk override. That fixture is shared: `tests/helpers/m7-v2-work3-family-package-fixture.js` feeds it to `tests/stage-2y-structure-m7-v2-repair-work3.test.js`, which is a do-not-touch file on this track, and another agent is merging `GENERAL_COVENANTS` into the spine at the same time. Adding a seventh override would have put a family-local change into a shared, contended artefact.

The on-disk package is instead validated directly in the family test through `validateSingleFamilyPackageInventory`, which is the same check the fixture route performs. Registering the override, and re-sealing the fixture digest with `scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs`, is a one-line follow-up for whoever lands the spine merge.

## What Milestone A does not do

No activation, no product write, no database write, no M6, and no approval of the 70-profile inventory as a legal matter — the registration candidate carries `activation_permitted: false` and every zero-effect boundary in the ladder reports zero product writes. `NO_OTHER_REPS_FRAUD` (family #8) can now take this seal as its classifier boundary.
