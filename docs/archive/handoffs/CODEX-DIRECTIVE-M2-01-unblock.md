# Codex directive — WP-M2-01 unblock

Supersedes `BLOCKED-WP-RECONCIL-DOWNSTREAM-malformed-entries.md`. The BLOCKED-*.md pattern is deprecated — from now on all Ben-gates go through the Review Queue that M1 just delivered. Delete the BLOCKED file as part of the first PR below.

## What Ben decided

The reconciliation queue has four action types. Treatment:

| Action | Count | Treatment |
|---|---:|---|
| MERGE | 410 | Reextract. Apply `resolution.targetCanonicalKey` as the canonical field value. |
| SPLIT | 15 | Reextract. Apply `resolution.targetCanonicalKey`. Tag the resulting card with `origin: "split"` in card metadata. |
| MOVED_OR_DROPPED | 44 | **Do not reextract.** Emit into `docs/reprocess/moved-or-dropped-cleanup.md` as a one-time audit report. |
| SCHEMA_DEFERRED | 175 | **Do not reextract.** Emit into `docs/reprocess/schema-deferred-waitlist.jsonl`. Drained progressively in M3 (see "M3 drain hooks" below). |

Net: 425 entries reextracted in WP-M2-01. 219 entries routed elsewhere. WP-M2-01 exit criterion is now "425 reextracted, 219 correctly routed, both admin surfaces render."

## Step 1 — Create the Review Queue entry (mechanical PR)

Branch: `wp/m2-01-contract-queue-entry`
Classification: `mechanical`

Add one file: `docs/review-queue/<uuid>.json` with:

```json
{
  "id": "<uuid>",
  "created_at": "<now ISO>",
  "kind": "canonical",
  "title": "WP-M2-01 contract: four-action treatment + admin surfaces",
  "summary": "Reconciliation queue has 644 RESOLVED entries across four action types (MERGE=410, SPLIT=15, MOVED_OR_DROPPED=44, SCHEMA_DEFERRED=175). Ben has pre-approved the treatment (see evidence). This entry exists as the audit record — approving unblocks WP-M2-01 to write the actual PRs below. Rejecting halts and re-opens the discussion.",
  "evidence": [
    {"label": "This directive", "url": "docs/handoffs/CODEX-DIRECTIVE-M2-01-unblock.md"},
    {"label": "Original blocker (to be deleted)", "url": "BLOCKED-WP-RECONCIL-DOWNSTREAM-malformed-entries.md"},
    {"label": "reconciliation-queue.json", "url": "docs/schema-shape/reconciliation-queue.json"}
  ],
  "choices": [
    {"key": "approve", "label": "Approve four-action treatment + admin surfaces", "codex_action": "proceed with Steps 2-6"},
    {"key": "reject", "label": "Reject — reopen discussion", "codex_action": "halt WP-M2-01, ping Ben"},
    {"key": "modify", "label": "Approve with changes", "codex_action": "await Ben-authored diff to this directive"}
  ],
  "resolution": null,
  "resolved_at": null,
  "resolved_by": null
}
```

Also in this PR: check in this directive itself at `docs/handoffs/CODEX-DIRECTIVE-M2-01-unblock.md` (verbatim copy) so the evidence link resolves.

Self-merge on green.

## Ben clicks approve at /admin/review-queue

Ben pre-approved above. The click is the audit record. Proceed to Steps 2-6 on click.

## Step 2 — Delete the BLOCKED file (mechanical PR)

Branch: `wp/m2-01-remove-blocked-file`
Classification: `mechanical`

Delete `BLOCKED-WP-RECONCIL-DOWNSTREAM-malformed-entries.md` from Ben's repo (it may only exist on his Mac — if it's not in the repo, this step is a no-op; skip the PR).

## Step 3 — WP-M2-01 reextraction (main WP work, mechanical PR)

Branch: `wp/m2-01-reconcil-downstream`
Classification: `mechanical` (Ben pre-approved contract via Step 1 Queue entry)

Ships:
- `scripts/reprocess/apply-reconciliation.js` — reads `docs/schema-shape/reconciliation-queue.json`, filters to MERGE + SPLIT (425 entries), applies `resolution.targetCanonicalKey` to each affected card via reextraction.
- SPLIT entries carry `origin: "split"` in card metadata (add to card schema; this is a mechanical field addition per the schema convention — schema field is pre-approved because it's a metadata tag, not a canonical semantics change).
- `docs/reprocess/moved-or-dropped-cleanup.md` — auto-generated audit report of the 44 MOVED_OR_DROPPED entries. Columns: field_key, raw_value, rationale, source deals, resolved_at.
- `docs/reprocess/schema-deferred-waitlist.jsonl` — auto-generated waitlist of the 175 SCHEMA_DEFERRED entries. Each row includes `waiting_on` (Codex's best classification of which schema object it's waiting on, defaulting to `unclassified` if no match).
- `docs/reprocess/round-reconcil.md` — WP-M2-01's required completion doc; enumerates all 644 entries and their outcome (reextracted / dropped-audited / deferred-waitlisted).

Self-merge on green.

## Step 4 — Admin surfaces (mechanical PR)

Branch: `wp/m2-01-admin-reconciliation-surfaces`
Classification: `mechanical`

Ships two new admin pages:

### `/admin/reconciliation/dropped`

- Renders the 44 MOVED_OR_DROPPED entries from `docs/reprocess/moved-or-dropped-cleanup.md` (source of truth) as a sortable, filterable table.
- Columns: `field_key`, `raw_value`, `rationale`, `source deals` (comma-separated), `resolved_at`.
- Row click → expands inline to show full JSON + link back to `reconciliation-queue.json` line.
- Top-right "Download CSV" button.
- Uses `AdminShell` if it exists (M5-01); otherwise inline minimal shell — M5-01 will migrate later.

### `/admin/reconciliation/deferred`

- Renders the 175 SCHEMA_DEFERRED entries from `docs/reprocess/schema-deferred-waitlist.jsonl`.
- **Grouped by `waiting_on` field** (not entry-by-entry). Expected groups:
  - Waiting on `Provision.kind = definition` (M3-04)
  - Waiting on stable provision-instance ID (M3-01)
  - Waiting on provenance bundle (M3-03)
  - Unclassified (flag prominently — this is the risk bucket)
- Each group header shows: group name, count, target M3 WP, drain status badge (`Waiting` / `Drained` / `Reclassified`).
- Expand a group → table of its entries. Columns: `raw_value`, `field_key`, `source deals`, `resolved_at`.
- Top-right "Download CSV" button (dumps all 175 in one CSV with `waiting_on` as a column).
- Add both pages to `docs/admin/nav-registry.json`.

Self-merge on green.

## Step 5 — Update PLAN-M3-ingest-seamless.md (mechanical PR)

Branch: `wp/m2-01-plan-m3-drain-hooks`
Classification: `mechanical`

Edit `PLAN-M3-ingest-seamless.md` — add to each of WP-M3-01, WP-M3-03, WP-M3-04 exit criteria:

> **Waitlist drain:** Scan `docs/reprocess/schema-deferred-waitlist.jsonl`. Any entries whose `waiting_on` matches this WP's newly-delivered schema object get promoted to MERGE (or SPLIT if applicable), reextracted, and struck from the waitlist. Updates the drain status badge on `/admin/reconciliation/deferred` to `Drained`.

Add to M3's overall exit criteria:

> **Residual waitlist review:** At end of M3, any entries still on `schema-deferred-waitlist.jsonl` get a Review Queue entry: "N SCHEMA_DEFERRED entries have no matching schema after M3 — reclassify as MOVED_OR_DROPPED or extend schema?"

## Step 6 — Update PLAN-TAXONOMY-GAPS.md (mechanical PR, can bundle with Step 5)

Add a note at the bottom:

> **Schema-deferred waitlist:** 175 reconciliation entries are on the waitlist waiting for M3 schema objects. See `PLAN-M3-ingest-seamless.md` for per-WP drain hooks and `/admin/reconciliation/deferred` for live status.

## Classification note

Steps 3, 4, 5, 6 are all mechanical because Ben pre-approved the contract via the Step 1 Queue entry. Self-merge on green for each.

## Order of operations

Step 1 opens PR → self-merge → Ben clicks approve at `/admin/review-queue` → Codex runs Steps 2-6 in parallel where independent (Step 2 independent; Steps 3+4 sequential because Step 4 renders Step 3's output; Steps 5+6 can be one PR).

Total PRs: 4-5. Total Ben clicks: 1.
