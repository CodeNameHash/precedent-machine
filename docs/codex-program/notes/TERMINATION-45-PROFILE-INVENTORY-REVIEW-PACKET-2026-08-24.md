# Termination 45-profile inventory review packet — Ben instructions

Date: 2026-08-24 (updated after Phase 0/1 packet regeneration)

## What this is

A single human-reviewable JSON packet listing all **45** Termination subtype proposals so you can approve them in **one session**, after Work3 governed-disclosure-note core integration lands.

This packet is **draft evidence only**. It is not construction authority. Phase4 authority and Stage B blueprint receipts remain controlling.

**Current draft packet id:** `217720c231c37963bd51107a0297c103a85af5b3c60ee77947364f7951e660ff` (`inventory_review_packet_id` in the draft JSON).

## Files

| Artefact | Role |
|---|---|
| `scripts/stage-2y-structure-m7-v2-termination-inventory-review-packet.mjs` | CLI to build the packet |
| `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json` | Draft packet output (regenerate; not authority) |
| `evidence/.../m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json` | Phase4 `profile_review_schedule` source (45 items) |
| `docs/codex-program/notes/TERMINATION-BEN-INVENTORY-SESSION-SUCCESSOR-AUTHORITY-DRAFT-2026-08-24.md` | Successor approval-capture authority draft (Phase 1.3; Ben scope review pending) |

The draft packet header also points at `inventory_session_successor_draft` — same successor-authority path above. Do not record approval by editing the draft JSON.

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

**Phase 0.4 (skim only):** Confirm the regenerated packet looks sane before Phase 1 successor-authority scope approval. See [Ben skim checklist](#ben-skim-checklist-phase-04) below.

**Phase 2 (full session):** 45-row inventory approval after Phase 1.3–1.4 successor authority scope is approved.

## Governance stops — read the right one

The packet now separates repository truth from the Stage B facade boundary:

| Block | Meaning |
|---|---|
| `repository_verification` | HEAD test truth: Stage B blueprint GREEN, core integration GREEN, inventory scaffold GREEN; Ben session `NOT_STARTED`; approval capture `NOT_BUILT` |
| `review_workflow.current_governance_stop` | **Use this.** Core integration `PERFORMED`; stop is `STOP_AFTER_INVENTORY_REVIEW_GREEN_BEFORE_BEN_MANUAL_APPROVAL_AND_PACKAGE_SEAL`; successor is `WORK3_TERMINATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY` |
| `review_workflow.stage_b_facade_governance_stop` | Historical facade boundary at blueprint construction time (`core_integration_state: NOT_PERFORMED`). Do **not** treat this as current repo state |
| `review_workflow.stage_b_facade_stop_interpretation` | Explains why both blocks appear |

## Ben skim checklist (Phase 0.4)

Open the draft JSON and spot-check **two rows only** — do not re-litigate the full 45.

### 1. B9e row (disclosure note only)

| Field | Value |
|---|---|
| `proposed_profile_key` | `b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712` |
| `source_deal` | `redhat` |
| Confirm | `is_b9e_profile: true`; `governed_disclosure_notes[0].display_text` = `contained in non-public disclosure letter`; `review_flags` includes `B9E_DISCLOSURE_NOTE_ONLY_DO_NOT_REOPEN`; `missing_required_field_keys` empty on row; jurisdiction list gap in `retained_source_gaps` only |

**Do not** reopen the B9e legal question.

### 2. One outside-date hold row (extension deferred)

| Field | Value |
|---|---|
| `proposed_profile_key` | `261c8790a3247cc495222c2c63e3c82bf09bbcabeae4caa4cb4ff99031a5a6a6` |
| `source_deal` | `metsera` |
| `classification_path` | ends in `OUTSIDE_DATE_RIGHT` |
| Confirm | `shape_summary` readable (party / trigger / exercise buckets); `review_flags` includes `EXTENSION_MECHANICS_DEFERRED_NOT_IN_SIGNATURE` and `HOLD_RECOMMENDED_UNTIL_EXTENSION_DISPOSITION`; base outside-date tokens present, extension mechanics not claimed in signature |

Optional: grep `OUTSIDE_DATE_RIGHT` — expect **5** rows, **4** with `EXTENSION_MECHANICS_DEFERRED_NOT_IN_SIGNATURE`, **1** (skywater) with `EXTENSION_PARTIAL_TOKEN_ONLY_REVIEW_REQUIRED` instead.

### Packet header (30 seconds)

- `inventory_review_packet_id` = `217720c2…`
- `profile_count` = 45; `repository_verification.*` all GREEN except Ben session / approval capture
- `current_governance_stop.core_integration_state` = `PERFORMED` (not the facade stop)

## Default review workflow: approve-all-except-gaps

1. Open `profile_review_items` (45 rows, sorted by `proposed_profile_key`).
2. For each row, read **`shape_summary`** + **`source_deal`** + **`review_flags`** first; use `required_expression_signature` only when those are ambiguous.
3. Default disposition: **APPROVE** the proposed subtype unless you mark a gap or hold.
4. Do not re-litigate rows that are `COMPLETE` with empty `missing_required_field_keys`, no blocking `review_flags`, and no `governed_disclosure_notes` issues — scan for obvious tuple mistakes only.
5. Explicit gaps and holds are the exception list. Stage B expects **44** technically complete profiles plus **one** retained source admission gap (B9e jurisdiction list).

## B9e — already ruled

Profile key: `b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712`

You already ruled the display text:

`contained in non-public disclosure letter`

That ruling is **display-only legal metadata**. It is not a typed fact, target, absence proof, dependency, or inference about Company Letter content.

In Stage B mode the packet shows:

- `governed_disclosure_notes` with `disposition_kind: NON_PUBLIC_DISCLOSURE_LOCATION`
- `missing_required_field_keys` cleared on the profile (gap retained separately in `retained_source_gaps`)
- `completion_state: COMPLETE` on the profile row
- `review_flags` includes `B9E_JURISDICTION_LIST_SOURCE_GAP_RETAINED` and `B9E_DISCLOSURE_NOTE_ONLY_DO_NOT_REOPEN`

**Do not** reopen the B9e legal question. Confirm the packet matches your ruling and move on.

## Outside-date rows — hold until extension disposition

Five rows classify as `OUTSIDE_DATE_RIGHT`. Default Phase 2 disposition: **HOLD** unless you explicitly **PARTIAL_APPROVE** with extension deferral acknowledged.

| Deal | `proposed_profile_key` (prefix) | Extension flag |
|---|---|---|
| metsera | `261c8790…` | `EXTENSION_MECHANICS_DEFERRED_NOT_IN_SIGNATURE` |
| skechers | `4ea33624…` | `EXTENSION_MECHANICS_DEFERRED_NOT_IN_SIGNATURE` |
| concho | `abfa845b…` | `EXTENSION_MECHANICS_DEFERRED_NOT_IN_SIGNATURE` |
| redhat | `e3064850…` | `EXTENSION_MECHANICS_DEFERRED_NOT_IN_SIGNATURE` |
| skywater | `f41fd796…` | `EXTENSION_PARTIAL_TOKEN_ONLY_REVIEW_REQUIRED` |

Phase 3 closes extension mapping; Phase 2 only records which shapes you accept as partial. Full five-deal analysis: `docs/codex-program/notes/TERMINATION-OUTSIDE-DATE-EXTENSION-DISPOSITION-TABLE-2026-08-24.md` (options A/B/C + Skechers Marketing Period Q02).

## What to check per profile

For each `profile_review_items` entry:

| Field | What to verify |
|---|---|
| **`source_deal`** | Fixture deal slug (`redhat`, `skechers`, `metsera`, `concho`, `skywater`) or `null` when shape is cross-deal / schedule-only; sanity check subtype provenance |
| **`shape_summary`** | Human-readable buckets (`party`, `trigger`, `restraint`, `carve_out`, `exercise`, etc.) — primary review surface |
| **`review_flags`** | Holds, deferrals, taxonomy expansion, B9e pre-rulings; e.g. `EXTENSION_MECHANICS_DEFERRED_NOT_IN_SIGNATURE`, `HOLD_RECOMMENDED_UNTIL_EXTENSION_DISPOSITION`, `NEW_SUBTYPE_RELATIVE_TO_SEALED_M5_FOUR_BUCKET_SET` |
| `classification_path` | Three-level path (family → right → bucket) matches your mental model of the subtype |
| `required_expression_signature` | Fallback when `shape_summary` is ambiguous — expression shape for ALL_OF / ANY_OF / EXCEPTION_TO |
| `completion_state` | `COMPLETE` unless you are intentionally holding the row |
| `missing_required_field_keys` | Must be empty for approval; any non-empty key is a gap |
| `governed_disclosure_notes` | If present: `display_text` and `disposition_kind` only; no typed value implied |
| `proposed_validation` | `extraction_state`, `source_quality`, `output_disposition`, `issue_codes` |
| `reference_accounting` | Occurrence and materialisation counts sane for the subtype |
| `source_unit_count` / `m4_claim_count` | Non-zero for real subtypes; sanity check only |

Rows with `is_b9e_profile: true` are pre-ruled; verify disclosure note attachment, not the legal text.

## Packet-level checks

- `inventory_review_packet_id` present (binds session receipt in successor authority)
- `profile_count` = 45
- All 45 rows have `shape_summary` and `review_flags` (array, may be empty)
- 36 rows have non-null `source_deal`; 9 rows have `source_deal: null` (cross-deal / schedule-derived shapes — expected)
- `complete_profile_count` / `incomplete_profile_count` match Stage B census (44 complete, 1 incomplete profile-level gap accounting)
- `retained_source_gaps` lists the one B9e jurisdiction-list source admission gap
- `repository_verification` shows Stage B, core integration, inventory scaffold GREEN
- `review_workflow.current_governance_stop` blocks package approval (`package_approval_permitted: false`)
- `review_workflow.stage_b_facade_governance_stop` is **not** current repo state — do not use it as a gate
- `inventory_session_successor_draft` points at successor authority draft
- `packet_kind` = `DRAFT_NOT_AUTHORITY`

## After your review

Your approval is recorded through the successor **WORK3_TERMINATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY** path (draft at `TERMINATION-BEN-INVENTORY-SESSION-SUCCESSOR-AUTHORITY-DRAFT-2026-08-24.md`). Permitted writes: disposition file + session receipt — not by editing this draft.

Do not treat editing the draft JSON as approval. Do not register or activate from this artefact.

Run plan: `TERMINATION-FAMILY-RUN-PLAN-2026-08-24.md` (Phase 1.4 scope approval → Phase 2 inventory session).
