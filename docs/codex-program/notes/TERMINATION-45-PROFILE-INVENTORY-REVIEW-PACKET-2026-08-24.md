# Termination 45-profile inventory review packet — Ben instructions

Date: 2026-08-24

## What this is

A single human-reviewable JSON packet listing all **45** Termination subtype proposals so you can approve them in **one session**, after Work3 governed-disclosure-note core integration lands.

This packet is **draft evidence only**. It is not construction authority. Phase4 authority and Stage B blueprint receipts remain controlling.

## Files

| Artefact | Role |
|---|---|
| `scripts/stage-2y-structure-m7-v2-termination-inventory-review-packet.mjs` | CLI to build the packet |
| `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json` | Draft packet output (regenerate; not authority) |
| `evidence/.../m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json` | Phase4 `profile_review_schedule` source (45 items) |

## Regenerate the draft

Preferred (full packet with B9e governed disclosure note):

```bash
node scripts/stage-2y-structure-m7-v2-termination-inventory-review-packet.mjs \
  --mode stage-b
```

Fallback (schedule only, no disclosure notes):

```bash
node scripts/stage-2y-structure-m7-v2-termination-inventory-review-packet.mjs \
  --mode phase4-schedule
```

Default output path is the draft JSON under `evidence/canonical-v2/stage-2y-structure-migration/control/`.

Stage B mode runs `prepareTerminationWork3StageBBlueprintProposal` with the same governed test fixtures as `tests/stage-2y-structure-m7-v2-repair-work3.test.js`. Expect ~30s runtime.

## When to use this

**After** core integration lands and Stage B is green. **Before** any Work3 identity, family package approval, or inventory derivation.

The packet is for subtype inventory approval, not for package registration or activation.

## Default review workflow: approve-all-except-gaps

1. Open `profile_review_items` (45 rows, sorted by `proposed_profile_key`).
2. Default disposition for each row: **APPROVE** the proposed subtype unless you mark a gap.
3. Do not re-litigate rows that are `COMPLETE` with empty `missing_required_field_keys` and no `governed_disclosure_notes` — scan for obvious tuple mistakes only.
4. Explicit gaps are the exception list. Stage B expects **44** technically complete profiles plus **one** retained source admission gap (B9e jurisdiction list).

## B9e — already ruled

Profile key: `b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712`

You already ruled the display text:

`contained in non-public disclosure letter`

That ruling is **display-only legal metadata**. It is not a typed fact, target, absence proof, dependency, or inference about Company Letter content.

In Stage B mode the packet shows:

- `governed_disclosure_notes` with `disposition_kind: NON_PUBLIC_DISCLOSURE_LOCATION`
- `missing_required_field_keys` cleared on the profile (gap retained separately in `retained_source_gaps`)
- `completion_state: COMPLETE` on the profile row

**Do not** reopen the B9e legal question. Confirm the packet matches your ruling and move on.

## What to check per profile

For each `profile_review_items` entry:

| Field | What to verify |
|---|---|
| `classification_path` | Three-level path (family → right → bucket) matches your mental model of the subtype |
| `required_expression_signature` | Expression shape is the intended ALL_OF / ANY_OF / EXCEPTION_TO structure for that subtype |
| `completion_state` | `COMPLETE` unless you are intentionally holding the row |
| `missing_required_field_keys` | Must be empty for approval; any non-empty key is a gap |
| `governed_disclosure_notes` | If present: `display_text` and `disposition_kind` only; no typed value implied |
| `proposed_validation` | `extraction_state`, `source_quality`, `output_disposition`, `issue_codes` |
| `reference_accounting` | Occurrence and materialisation counts sane for the subtype |
| `source_unit_count` / `m4_claim_count` | Non-zero for real subtypes; sanity check only |

Rows with `is_b9e_profile: true` are pre-ruled; verify disclosure note attachment, not the legal text.

## Packet-level checks

- `profile_count` = 45
- `complete_profile_count` / `incomplete_profile_count` match Stage B census (44 complete, 1 incomplete profile-level gap accounting)
- `retained_source_gaps` lists the one B9e jurisdiction-list source admission gap
- `review_workflow.next_governance_stop` still blocks package approval
- `packet_kind` = `DRAFT_NOT_AUTHORITY`

## After your review

Your approval is recorded through the successor **WORK3_TERMINATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY** path (not by editing this draft). This packet is the checklist input for that session.

Do not treat editing the draft JSON as approval. Do not register or activate from this artefact.
