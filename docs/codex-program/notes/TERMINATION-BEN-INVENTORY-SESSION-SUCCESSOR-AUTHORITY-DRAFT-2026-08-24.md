# WORK3_TERMINATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY — schema draft (Phase 1.3)

Date: 2026-08-24  
Status: **APPROVED (Phase 1.4)** — authority JSON committed; GREEN facade landed.

**RED proof (expected fail):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  --test-name-pattern 'Ben inventory session disposition' \
  tests/stage-2y-structure-m7-v2-repair-work3.test.js
```

Expect exit 1: `Work3 termination Ben inventory session disposition facade export is missing.`

Predecessor: `WORK3_TERMINATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY` (scaffold GREEN).  
Run plan: `TERMINATION-FAMILY-RUN-PLAN-2026-08-24.md` Phase 1.3–1.4.

---

## Purpose

Give Ben’s 45-profile inventory session a **permitted write surface** for approval capture without registering Work3 package identity or touching product.

---

## Permitted writes (exact paths, create-once)

| Path | Role |
|---|---|
| `evidence/.../m7-v2-repair-termination-45-profile-inventory-disposition.json` | One row per `proposed_profile_key` with Ben disposition |
| `evidence/.../m7-v2-repair-termination-ben-inventory-session-receipt.json` | Session receipt binding disposition digest + rulings digest |

Optional (Phase 1.2 Ben choice — completion receipts for already-GREEN runs):

| Path | Role |
|---|---|
| `evidence/.../m7-v2-repair-contract-work3-governed-disclosure-note-core-integration-execution-completion-receipt.json` | Evidence-only GREEN run for core integration fixture |
| `evidence/.../m7-v2-repair-contract-work3-termination-unapproved-inventory-review-execution-completion-receipt.json` | Evidence-only GREEN run for inventory scaffold |

---

## Forbidden until family package seal (Phase 4)

- Work3 `profile_id`, `family_profile_package_id`, registration, activation
- Editing `m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json` as approval
- Database or product writes
- Treating disposition file as package seal

---

## Disposition record schema (proposed)

```json
{
  "schema_version": "STAGE_2Y_M7_V2_TERMINATION_45_PROFILE_INVENTORY_DISPOSITION/V1",
  "inventory_disposition_id": "<content_id>",
  "session_receipt_id": "<digest of session receipt>",
  "packet_digest": "<sha256 of draft packet at session start>",
  "ben_rulings_digest": "<sha256 of TERMINATION-BEN-RULINGS-Q01-Q03 note>",
  "reviewer": "BEN_GOODCHILD",
  "default_disposition_applied": true,
  "profile_dispositions": [
    {
      "proposed_profile_key": "<digest>",
      "ordinal": 1,
      "disposition": "APPROVE | HOLD | REJECT | PARTIAL_APPROVE",
      "disposition_reason": "<optional short text>",
      "review_flags_acknowledged": ["..."],
      "extension_deferred_acknowledged": false
    }
  ],
  "session_summary": {
    "approved_count": 0,
    "hold_count": 0,
    "reject_count": 0,
    "partial_count": 0,
    "outside_date_hold_count": 0,
    "b9e_note_only_acknowledged": true
  }
}
```

**Disposition rules (proposed):**

- Default: `APPROVE` unless Ben marks `HOLD`, `REJECT`, or `PARTIAL_APPROVE`.
- All `OUTSIDE_DATE_RIGHT` rows: default `HOLD` until extension disposition (Phase 3) unless Ben explicitly sets `PARTIAL_APPROVE` with `extension_deferred_acknowledged: true`.
- B9e row: `APPROVE` shape with retained source gap; do not reopen disclosure text.

---

## Session receipt schema (proposed)

```json
{
  "schema_version": "STAGE_2Y_M7_V2_TERMINATION_BEN_INVENTORY_SESSION_RECEIPT/V1",
  "ben_inventory_session_receipt_id": "<content_id>",
  "session_classification": "TERMINATION_45_PROFILE_INVENTORY_BEN_REVIEW",
  "completion_state": "COMPLETE",
  "disposition_binding": {
    "path": "evidence/.../m7-v2-repair-termination-45-profile-inventory-disposition.json",
    "inventory_disposition_id": "<digest>"
  },
  "packet_binding": {
    "path": "evidence/.../m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json",
    "inventory_review_packet_id": "<digest from packet>"
  },
  "immutable_parent_bindings": {
    "unapproved_inventory_review_authority": { "...": "..." },
    "ben_rulings_note": { "...": "..." }
  },
  "zero_effect_boundary": {
    "work3_identity_count": 0,
    "package_registration_count": 0,
    "product_write_count": 0
  },
  "next_governance_stop": {
    "state": "STOP_AFTER_BEN_INVENTORY_DISPOSITION_BEFORE_EXTENSION_OR_SEAL",
    "required_successor_sequence": [
      "WORK3_TERMINATION_OUTSIDE_DATE_EXTENSION_DISPOSITION",
      "WORK3_TERMINATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY"
    ]
  }
}
```

---

## Authority shape (proposed JSON authority, TDD after 1.4)

| Field | Value |
|---|---|
| `authority_classification` | `WORK3_TERMINATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY` |
| `authority_state` | `AUTHORISED_BEN_MANUAL_DISPOSITION_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT` |
| `predecessor_binding` | Unapproved inventory review authority envelope |
| `execution_schedule` | **None** — Ben manual session; agent writes disposition only under Ben instruction |
| `forbidden_output_contract` | Same Work3 identity surfaces as inventory scaffold |
| `implementation_contract.exported_function` | `prepareTerminationWork3BenInventorySessionDisposition` (name TBD) |
| `caller_produced_disposition_forbidden` | true — disposition derived from Ben-authored file read, not caller injection |

---

## Ben decisions required before implementation

1. **Phase 1.2:** Stamp GREEN completion receipts for core integration + inventory scaffold, or leave ephemeral test-only proof?
2. **Phase 1.4:** Approve this scope — disposition file + session receipt only; no package seal in this authority.
3. **Disposition granularity:** Per-profile rows sufficient, or require bucket-level summary block?
4. **Partial outside-date:** Allow `PARTIAL_APPROVE` with explicit extension deferral flag in disposition file?

---

## Proof after implementation (future)

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  --test-name-pattern 'Ben inventory session disposition' \
  tests/stage-2y-structure-m7-v2-repair-work3.test.js
```

RED→GREEN TDD: validator rejects caller-produced disposition; accepts disposition file matching packet digest; still zero Work3 identity.
