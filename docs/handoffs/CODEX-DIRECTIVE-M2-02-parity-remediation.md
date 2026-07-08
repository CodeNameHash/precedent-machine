# Codex directive — M2-02 parity remediation

Follow-up to PR #197 and the Queue entry `docs/review-queue/m2-02-schema-parity-diffs.json`.

## What Ben decided

Ben walked through a sample of the 972 diffs. They fall into four buckets, each with a straightforward fix. The `972 diffs` count is scary but the underlying cause is four render-pipeline bugs plus one small canonical rule. Not a semantics crisis.

**Category-by-category treatment:**

| Category | Count | Root cause | Treatment | Classification |
|---|---:|---|---|---|
| `short_title_mismatch` | 480 | Schema-first renderer isn't stripping the `[PROPOSED] ` prefix that legacy user-mode strips | Add prefix strip in user-mode read/render | mechanical |
| `type_mismatch` | 285 | Card writer defaults `STRUCT` and `OTHER` provisions to `MISC_BOILERPLATE` — mapping table missing entries | Extend type-mapping table in `store-cards.js` to preserve `STRUCT` and `OTHER`; reextract affected cards | mechanical |
| `missing_schema_card` (~100 recital/preamble) | ~100 | Legacy user-mode renders WHEREAS/preamble text under `DEF General Definitions Section` as if they were provisions. Schema-first correctly skips them | Suppress these from the audit as **not real diffs** — schema-first is right, legacy is wrong. Codified as an audit rule. | canonical (one Queue click) |
| `missing_schema_card` (~45 genuine) | ~45 | Extractor coverage gaps: real provision the extractor missed | Fix extractor coverage in `lib/parser-v2/extract.js`; reextract affected deals | mechanical |
| `schema_only_card` | 62 | `Uncovered text — <section>` cards are QA/admin plumbing; legacy user-mode doesn't render them; schema-first renderer shows them in both modes | Filter cards where `field_key` starts with `"Uncovered text"` in user-mode reads only. Admin reads still show them. | mechanical |

**Expected diff-count trajectory:**

- After PR #1 ([PROPOSED] strip): 972 → 492
- After PR #2 (STRUCT/OTHER mapping): 492 → 207
- After PR #3 (uncovered-text user-mode filter): 207 → 145
- After Queue click on recital-suppression rule + PR #4: 145 → ~45
- After PR #5 (extractor coverage fix): ~45 → 0

## Step 1 — Refine the existing Queue entry (mechanical PR)

Branch: `wp/m2-02-parity-queue-refine`
Classification: `mechanical`

Update `docs/review-queue/m2-02-schema-parity-diffs.json` in place. Keep the same `id`. Replace the `summary` and `choices`:

```json
{
  "id": "m2-02-schema-parity-diffs",
  "created_at": "2026-07-08T03:20:00.000Z",
  "kind": "clarify",
  "title": "WP-M2-02 schema parity audit found 972 diffs — remediation plan",
  "summary": "The 972 diffs decompose into four mechanical bugs plus one canonical rule. Root causes: (1) [PROPOSED] label not stripped in schema-first user-mode render — 480 diffs; (2) STRUCT and OTHER types mapped to MISC_BOILERPLATE by the card writer — 285 diffs; (3) Uncovered-text coverage cards visible in user mode instead of admin-only — 62 diffs; (4) legacy user-mode renders WHEREAS/preamble text as definitions (legacy is wrong, schema-first is right) — ~100 diffs; (5) genuine extractor coverage gaps — ~45 diffs. Expected trajectory: 972 → 492 → 207 → 145 → ~45 → 0. Bucket (4) needs a small canonical rule to codify; a separate Queue entry has been filed. Approving here approves the mechanical remediation plan.",
  "evidence": [
    {"label": "Parity report", "url": "docs/schema-migration/phase-8-parity.md"},
    {"label": "Parity triage", "url": "docs/schema-migration/phase-8-parity-triage.md"},
    {"label": "Discovery counts", "url": "docs/audit/parity-discovery.md"},
    {"label": "This directive", "url": "docs/handoffs/CODEX-DIRECTIVE-M2-02-parity-remediation.md"},
    {"label": "Canonical rule Queue entry (recital suppression)", "url": "docs/review-queue/m2-02-recital-suppression.json"}
  ],
  "choices": [
    {"key": "approve-plan", "label": "Approve remediation plan (5 sequential mechanical PRs + reaudit after each)", "codex_action": "proceed with Steps 3-8"},
    {"key": "modify", "label": "Approve with changes", "codex_action": "await Ben-authored diff"},
    {"key": "reject", "label": "Reject — reopen discussion", "codex_action": "halt WP-M2-02"}
  ],
  "resolution": null,
  "resolved_at": null,
  "resolved_by": null
}
```

Also in this PR: check in this directive at `docs/handoffs/CODEX-DIRECTIVE-M2-02-parity-remediation.md`.

Self-merge on green.

## Step 2 — File the canonical Queue entry for recital suppression (mechanical PR)

Branch: `wp/m2-02-recital-suppression-queue`
Classification: `mechanical`

Add `docs/review-queue/m2-02-recital-suppression.json`:

```json
{
  "id": "m2-02-recital-suppression",
  "created_at": "<now ISO>",
  "kind": "canonical",
  "title": "Are WHEREAS/preamble/recital paragraphs 'provisions' for parity purposes?",
  "summary": "Legacy user-mode renders freeform WHEREAS clauses, preamble paragraphs, and recitals inside the DEF section as if they were provisions. Schema-first extraction (correctly, per the M&A canon) treats these as narrative preface — not enforceable provisions — and does not emit cards for them. This creates ~100 diffs in the parity audit that are not real diffs. Ben's counsel view (proposed): recitals are context, not provisions. Approving means: (a) parity audit adds a `recital_suppression` rule that excludes DEF-section cells whose text matches recital patterns (WHEREAS lead-in, preamble, non-numbered paragraph before Section 1) from diff counting; (b) schema-first extraction continues to skip them; (c) if a user genuinely wants to see recitals, they render in admin mode only. Rejecting means: schema-first must emit cards for recitals to match legacy — increases card count by ~100/deal with no analytical value.",
  "evidence": [
    {"label": "Sample recital diffs", "url": "docs/schema-migration/phase-8-parity.md"},
    {"label": "Parent directive", "url": "docs/handoffs/CODEX-DIRECTIVE-M2-02-parity-remediation.md"}
  ],
  "choices": [
    {"key": "approve", "label": "Approve — recitals are not provisions; suppress in audit and user-mode", "codex_action": "add recital_suppression rule to schema-parity.js audit; ensure schema-first render stays as-is"},
    {"key": "reject", "label": "Reject — recitals must render as provisions", "codex_action": "extend extractor to emit recital cards; back out schema-first skip logic"},
    {"key": "modify", "label": "Approve with modifications", "codex_action": "await Ben diff"}
  ],
  "resolution": null,
  "resolved_at": null,
  "resolved_by": null
}
```

Self-merge on green.

**Ben sees both Queue entries at `/admin/review-queue`. Two clicks.**

## Ben approves both entries

Then Codex proceeds. Reaudit after every step. Do not batch — a reaudit between steps proves each fix landed.

## Step 3 — PR #1: [PROPOSED] label strip (mechanical)

Branch: `wp/m2-02-strip-proposed`
Classification: `mechanical` (pre-approved via Step 1 Queue)

Ships:
- `lib/queries/review-deal.js`: strip leading `[PROPOSED] ` (case-sensitive, trailing space) from `short_title` when render mode is `user`. Admin mode preserves it.
- Alternative if the tag lives in card data itself: same strip in `ProvisionCardTable.jsx` render function. Prefer the query-layer strip so the audit sees the stripped value.
- Unit test with 5 fixture cases (with/without prefix, admin vs user mode).
- Rerun the audit as part of PR CI. Attach the new diff count to PR body. **Expected: 972 → 492.** If off by more than ±20, halt and file a new Queue entry.

Self-merge on green.

## Step 4 — PR #2: STRUCT/OTHER type mapping fix + reextract (mechanical)

Branch: `wp/m2-02-fix-type-mapping`
Classification: `mechanical`

Ships:
- `lib/parser-v2/store-cards.js`: extend type-mapping table so `STRUCT` → `STRUCT` and `OTHER` → `OTHER` instead of falling through to `MISC_BOILERPLATE`. Any other legacy types the diff surfaces that map wrong: fix them too.
- Reextraction script: idempotent, targets only cards whose current `type` is `MISC_BOILERPLATE` and whose extracted provenance suggests they should be `STRUCT` or `OTHER`. Uses `provision_instance_id` as upsert key.
- Reaudit in CI. **Expected: 492 → 207.** If off by more than ±20, halt.

Self-merge on green.

## Step 5 — PR #3: Uncovered-text user-mode filter (mechanical)

Branch: `wp/m2-02-uncovered-text-user-mode`
Classification: `mechanical`

Ships:
- `lib/queries/review-deal.js`: when render mode is `user`, filter out cards where `field_key` starts with `"Uncovered text"`. Admin mode still returns them.
- Verify `/admin/review/[id]?render=schema` (user mode default) hides them; `/admin/coverage/[id]` (or wherever admin coverage view lives) still shows them.
- Reaudit in CI. **Expected: 207 → 145.** If off by more than ±20, halt.

Self-merge on green.

## Step 6 — PR #4: Recital-suppression audit rule (mechanical — pre-approved via Step 2 Queue)

Branch: `wp/m2-02-recital-suppression`
Classification: `mechanical`

Ships:
- `scripts/audit/schema-parity.js`: add a `recital_suppression` rule. Cells in section `DEF` where the legacy text matches known recital patterns (starts with "WHEREAS,", or is the numbered/unnumbered paragraph before Section 1, or lives in the preamble block) are excluded from diff counting.
- Recital pattern detection is regex-based on the legacy text; conservative — if a candidate cell doesn't match a recital pattern, it stays in the audit.
- Log every suppressed cell to `docs/audit/parity-suppressed-recitals.md` so the suppression is auditable.
- Reaudit. **Expected: 145 → ~45.** If off by more than ±20, halt.

Self-merge on green.

## Step 7 — PR #5: Extractor coverage fix + reextract (mechanical)

Branch: `wp/m2-02-extractor-coverage`
Classification: `mechanical`

Ships:
- Read the remaining ~45 `missing_schema_card` diffs (post-Step 6) from the audit report.
- Group by section. Diagnose what pattern the extractor missed. Common candidates: NOSOL variations (e.g. Standstill Waiver / Don't-Ask-Don't-Waive), non-standard section headers, tail paragraphs.
- Extend `lib/parser-v2/extract.js` to catch each pattern. One commit per pattern class for reviewability.
- Reextract affected deals.
- Reaudit. **Target: ~45 → 0.** If not zero, file a new Queue entry titled "M2-02 parity residual: N diffs after full remediation" with the residual list.

Self-merge on green **only if diff count is 0**. If nonzero, do not self-merge — file Queue entry and wait.

## Step 8 — Merge PR #197 (the WP-M2-02 draft PR)

Once Step 7 lands with 0 diffs, mark PR #197 ready for review. It's mechanical (audit tooling only, no product behavior change). Self-merge.

WP-M2-02 done.

## Then proceed to M2-03

M2-03 (all-deals card-backed audit) becomes trivial — parity is green, so the audit's job reduces to confirming every deal renders schema-first without error. Codex proceeds automatically per PLAN-M2-schema-deploy.md.

## Pattern feedback (positive)

Codex correctly filed the parity blocker as a Queue entry (`m2-02-schema-parity-diffs.json`) this time instead of a `BLOCKED-*.md` file. That's the pattern working. Also: the visible saved/not-saved feedback added in #189 + manually recording the earlier clicks was exactly right. Keep both behaviors.

## Classification summary

- Step 1: mechanical (Queue-refine PR)
- Step 2: mechanical (Queue-new PR)
- Ben clicks approve × 2 at `/admin/review-queue`
- Steps 3-7: all mechanical, self-merge on green, halt on unexpected diff count
- Step 8: mechanical merge of PR #197

**Total Ben clicks: 2.**

Go.
