# M2 — Schema is deployed corpus-wide

Goal: every deal renders from the schema-first path. Legacy fallback is dead code. Reconciliation applied. Zero parity drift.

## Exit criteria

- Every deal in `deals` has `provision_cards.count(deal_id) ≥ 40` (Metsera threshold, per PART 3 §3.5).
- Full-corpus parity audit: zero diffs between schema-first render and legacy render across all 40 deals.
- `pages/review/[id].js` legacy fallback branch is deleted; only the schema-first branch remains.
- `lib/rubric.js`, `lib/vocab/*-aliases.js` legacy exports deleted (only their canonical replacements remain).
- Reconciliation (644 RESOLVED entries) has been applied via reextraction; `docs/reprocess/round-reconcil.md` attached.
- CI has a required `schema-parity` check on any PR touching schema/rubric/vocab/renderer paths.

## WPs in M2 (do in order — some parallel)

### WP-M2-01: Reconciliation downstream sweep

- File: `pm-wp-reconcil-downstream.codex.md` (already staged; drops the "Ben checkpoint" gate — replaced by Review Queue)
- Modifications from staged version:
  - The "Ben checkpoint after queue population" becomes: Codex creates a Review Queue entry summarizing the queue (deal count, top affected fields), continues to Step B automatically after 30 minutes if no rejection, so Ben can either intervene via Queue or let it run.
  - If Ben clicks "reject with reason" in Queue, Codex halts and applies the reason.
  - If Ben clicks "approve" OR the 30-minute timer expires, Codex proceeds.
- Classification: **canonical** for the queue-populate step (Ben can veto); **mechanical** for the actual reextraction (has automated diff coverage).
- Branch: `wp/m2-01-reconcil-downstream`

### WP-M2-02: Schema parity audit + CI wiring

- File: `pm-wp-schema-parity-audit.codex.md` (already staged; no material changes)
- Classification: **mechanical** entirely.
- Branch: `wp/m2-02-schema-parity-audit`
- **Runs in parallel with WP-M2-03.**

### WP-M2-03: All-deals card-backed audit

- File: `pm-wp-all-deals-card-backed-audit.codex.md` (already staged; drops the "spawn one WP per failing deal" ceremony)
- Modifications from staged version:
  - If any deal fails: Codex creates ONE Review Queue entry listing all failing deals + Codex's diagnosed root cause per deal + a proposed remediation plan (usually: "re-run extractor with fix X").
  - Ben clicks: `approve remediation plan` → Codex executes; `investigate further` → Codex writes more diagnostics into the Queue entry; `defer` → Codex marks those deals as known-legacy and proceeds with the rest.
- Classification: **mechanical** for the audit itself; **canonical** for any remediation plan (Ben approves).
- Branch: `wp/m2-03-all-deals-audit`

### WP-M2-04: Legacy vocab deletion plan + execution

- File: `pm-wp-schema-deletion-plan.codex.md` (already staged; massively simplified)
- Modifications:
  - Codex builds `scripts/audit/legacy-vocab-references.js` and runs it.
  - Codex creates ONE Review Queue entry titled "Authorize legacy vocab deletion" with the full manifest inline: which files/exports, how many references each, Codex's per-item safe/unsafe verdict.
  - Ben clicks per-item checkboxes: `delete` / `keep` / `defer`. Bulk-click supported.
  - On submit: Codex opens the deletion PR with only the approved items, classified `destructive (Ben-authorize)` — but that authorization already happened, so Codex self-merges on green.
- Classification: **destructive** for the deletion PR (already authorized via Queue).
- Branch: `wp/m2-04-legacy-vocab-deletion`

### WP-M2-05: Delete legacy fallback branch in review renderer

- Ships:
  - Removes the `else` branch in `pages/review/[id].js` that falls back to legacy tables.
  - Deletes the legacy table components (`ConsiderationTables.js`, `NosolFourTables.js`, `EmployeeBenefitsTable.js`, `SecMeetingTable.js`, `NoOtherRepsFraudTable.js`).
  - Requires: WP-M2-02 (parity green) + WP-M2-03 (all deals card-backed) both merged.
- Classification: **destructive** — one Queue entry: "Authorize legacy renderer deletion". Ben clicks. Codex opens PR + self-merges.
- Branch: `wp/m2-05-legacy-renderer-deletion`

## Handoff to M3

M3 (ingest seamless) starts once M2-05 merges. At that point every existing deal renders from schema-first with no fallback — the definition of "same as any other deal" that M3 has to preserve for fresh ingests.

## Ben interruptions in M2

- ONE queue entry for M2-01 (queue-populate summary; 30-min auto-approve)
- ONE queue entry for M2-03 (only if audit fails)
- ONE queue entry for M2-04 (legacy vocab deletion authorization)
- ONE queue entry for M2-05 (legacy renderer deletion authorization)

Worst case: four clicks. Best case: two clicks (M2-03 passes cleanly).
