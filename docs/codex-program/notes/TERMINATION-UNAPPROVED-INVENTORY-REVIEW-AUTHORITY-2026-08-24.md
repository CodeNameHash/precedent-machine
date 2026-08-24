# WORK3_TERMINATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY — scaffold note

Date: 2026-08-24

## What landed

| Artefact | Role |
|---|---|
| `evidence/.../m7-v2-repair-contract-work3-termination-unapproved-inventory-review-authority.json` | Construction authority (RED/GREEN TDD schedule) |
| `prepareTerminationWork3UnapprovedInventoryReview` in `m7-v2-profile-authoring.js` | Ephemeral review facade |
| `validateTerminationUnapprovedInventoryReviewEvidence` in `m7-v2-contract.js` | 45-profile census validator |
| `tests/stage-2y-structure-m7-v2-repair-work3.test.js` | GREEN proof without Work3 identity |

Successor chain: Stage A → Stage B → core integration → **inventory review** (this authority).

## Zero-effect boundary

This scaffold derives an in-memory inventory review candidate only. It does **not**:

- record Ben approval (`ben_approval_state: NOT_RECORDED`)
- approve the 45-profile package
- emit Work3 profile/package/inventory identity
- register, activate, or write to database/product

The draft packet under `m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json` remains **DRAFT_NOT_AUTHORITY** checklist input.

## Deliberately unresolved — Ben manual steps

The authority stops at `STOP_AFTER_INVENTORY_REVIEW_GREEN_BEFORE_BEN_MANUAL_APPROVAL_AND_PACKAGE_SEAL` with empty `required_successor_sequence`. The following are **not** specified in this scaffold and require a separate authority/decision before implementation:

1. **How Ben records approval** — per-profile disposition capture, session receipt shape, and whether approval is all-at-once or gap-marked.
2. **Successor after approval** — family package seal / Work3 registration authority name and admission contract.
3. **Whether approved inventory digest** is derived from Ben session receipt or from a restamped blueprint.

Do not infer approval semantics from the draft packet JSON or by editing the draft.

## Ben review session (manual)

Use the existing packet workflow in `TERMINATION-45-PROFILE-INVENTORY-REVIEW-PACKET-2026-08-24.md`:

1. Regenerate draft packet (`--mode stage-b`) after confirming core integration GREEN.
2. Review 45 rows in `profile_review_items` (default: approve-all-except-gaps).
3. Confirm B9e disclosure note attachment matches prior ruling; do not reopen legal text.
4. Record approval through the **future** post-scaffold authority path — not by editing the draft.

## Proof command

```bash
NODE_OPTIONS='--max-old-space-size=8192' CI=true node --test --test-name-pattern 'inventory review' tests/stage-2y-structure-m7-v2-repair-work3.test.js
```
