# Codex directive — M2 restructure + WP-M2-00 wire-up

Supersedes PR #186 (BLOCKED-WP-M2-02). Close #186 without merging (delete the branch too). The blocker was correct in substance but wrong in form — see "Pattern fix" at the bottom.

## What Ben decided

Ben's read: the audit sequence in `PLAN-M2-schema-deploy.md` was wrong. It assumed a schema-first render path existed. It does not. WP-M2-01 shipped reconciliation artefacts but there is no render code that reads them and no `provision_cards` rows in the corpus.

**M2 restructures:** insert a new WP-M2-00 at the top of M2 that wires up the schema-first render path + backfills the corpus. Then M2-02 through M2-05 run as originally planned (they finally have something real to audit).

**Semantics pulled forward:** rather than ship a placeholder card shape now and re-migrate in M3, do the canonical work once. G1, G2, G4, G5, G10, G11 (from `PLAN-TAXONOMY-GAPS.md`) move from M3 to M2-00 so the card table is right the first time.

## New M2 sequence

Update `PLAN-M2-schema-deploy.md`:

| WP | Status | Notes |
|---|---|---|
| WP-M2-00 | **NEW** — must ship first | Schema-first render wire-up + backfill. Includes canonical work pulled forward from M3. |
| WP-M2-01 | ✅ merged | Reconciliation downstream. Already done. |
| WP-M2-02 | unblocked once M2-00 ships | Schema parity audit. |
| WP-M2-03 | unblocked once M2-00 ships | All-deals card-backed audit. |
| WP-M2-04 | as originally planned | Legacy vocab deletion. |
| WP-M2-05 | as originally planned | Legacy renderer deletion. |

Also update `PLAN-M3-ingest-seamless.md`: remove WP-M3-01, WP-M3-03, WP-M3-04 (their content is now in WP-M2-00). M3 shrinks to: WP-M3-02 (normalizer manifest), WP-M3-05 (ingest surface + smoke), plus the waitlist drain hooks from WP-M2-01.

Also update `PLAN-TAXONOMY-GAPS.md`: G1, G2, G4, G5, G10, G11 owner column becomes WP-M2-00 (M2). G3, G6, G7, G8, G9 unchanged.

## WP-M2-00 — Schema-first render wire-up + backfill

Branch prefix: `wp/m2-00-*`. Multiple PRs. Full sequence below.

### Step 1 — Queue entry: canonical schema decisions (mechanical PR — Queue entry only)

Branch: `wp/m2-00-01-queue-canonical-schema`
Classification: `mechanical`

Add one file: `docs/review-queue/<uuid>.json`:

```json
{
  "id": "<uuid>",
  "created_at": "<now ISO>",
  "kind": "canonical",
  "title": "WP-M2-00 canonical schema: provision identity, provenance, kind, definitions",
  "summary": "Before wiring up the schema-first render path, three canonical shapes must be locked: (1) provision-instance identity (stable across reingest) + excerpt IDs; (2) provenance bundle (source doc, page, offset, extractor + version, model, prompt hash, run_id) + extractor stamp visible on card; (3) Provision.kind field with values standard | definition | cross-reference, enabling definitions-as-provisions with cross-references. Approving unblocks WP-M2-00 Steps 2-8 to write the actual PRs. See evidence for the proposed shapes.",
  "evidence": [
    {"label": "This directive", "url": "docs/handoffs/CODEX-DIRECTIVE-M2-02-restructure.md"},
    {"label": "PLAN-TAXONOMY-GAPS.md (pre-restructure)", "url": "PLAN-TAXONOMY-GAPS.md"},
    {"label": "Closed blocker PR #186", "url": "https://github.com/CodeNameHash/precedent-machine/pull/186"}
  ],
  "choices": [
    {"key": "approve", "label": "Approve all three shapes as proposed", "codex_action": "proceed with WP-M2-00 Steps 2-8"},
    {"key": "reject", "label": "Reject — reopen with counter-proposal", "codex_action": "halt WP-M2-00, ping Ben"},
    {"key": "modify", "label": "Approve with changes", "codex_action": "await Ben-authored diff to this directive"}
  ],
  "resolution": null,
  "resolved_at": null,
  "resolved_by": null
}
```

Also in this PR: check in this directive at `docs/handoffs/CODEX-DIRECTIVE-M2-02-restructure.md`.

**Proposed shapes to include in the Queue entry summary or a linked evidence doc `docs/handoffs/M2-00-canonical-shapes.md`:**

**(A) Provision-instance identity (G1 + G2):**
- `provision_instance_id`: `<deal_id>:<section_path>:<span_hash>` where `span_hash = sha256(normalized_text)[:12]`. Stable across reingest of the same source span. Different if the text changes.
- `excerpt_id`: `<provision_instance_id>:<excerpt_index>` where `excerpt_index` is a 0-based index into the ordered excerpts of the provision. Stable per-excerpt.

**(B) Provenance bundle (G4 + G5):**
```json
{
  "source_doc_id": "<deal doc uuid>",
  "source_doc_page": <int>,
  "source_doc_offset_start": <int>,
  "source_doc_offset_end": <int>,
  "extractor_name": "<string>",
  "extractor_version": "<semver>",
  "model": "<string>",
  "prompt_hash": "<sha256>",
  "run_id": "<uuid>",
  "extracted_at": "<ISO>"
}
```
Attached to every `provision_card` row. Visible in card debug view.

**(C) Provision.kind + definitions (G10 + G11):**
- `kind`: enum `standard | definition | cross-reference`.
- `standard`: normal provision, self-contained.
- `definition`: a defined term from the Definitions section (or inline definition). Carries `defined_term` (canonical string) and `defined_value` (definition text).
- `cross-reference`: a provision that references a definition. Carries `references[]` = array of `provision_instance_id` of definitions it points to.
- Renderer: cross-refs hover-expand into definition cards. Definitions get a dedicated tab on `/review/[id]`.
- Two-pass extractor pattern: pass 1 emits standard provisions; pass 2 walks Definitions section, emits definition provisions, rewrites consuming provisions with `kind=cross-reference` + `references[]`.

Self-merge on green. Ben clicks approve at `/admin/review-queue`.

### Step 2 — Card schema migration (mechanical PR — Ben pre-approved via Step 1)

Branch: `wp/m2-00-02-card-schema`
Classification: `mechanical`

Ships:
- Supabase migration for `provision_cards` table columns: `provision_instance_id` (text, indexed), `excerpt_id` (text), `kind` (enum), `defined_term` (text nullable), `defined_value` (text nullable), `references` (jsonb array nullable), `provenance` (jsonb, matches shape B above).
- Migration adds indexes on `deal_id`, `provision_instance_id`, `kind`.
- `lib/schema/provision-card.ts` (or `.js`) — typed shape definitions matching the migration.
- Golden fixture: `fixtures/schema/provision-card-example.json` demonstrating each `kind`.

Self-merge on green.

### Step 3 — Extractor output → card writer (mechanical PR)

Branch: `wp/m2-00-03-store-cards`
Classification: `mechanical`

Ships:
- `lib/parser-v2/store-cards.js` — takes extractor output, writes rows into `provision_cards` with all fields from Step 2.
- Two-pass logic: pass 1 emits `kind=standard` for all provisions; pass 2 walks Definitions section, emits `kind=definition` rows, rewrites consuming provisions with `kind=cross-reference` + `references[]`.
- Unit tests against `fixtures/schema/provision-card-example.json` + a golden Metsera fixture.

Self-merge on green.

### Step 4 — Card reader (mechanical PR)

Branch: `wp/m2-00-04-review-deal-query`
Classification: `mechanical`

Ships:
- `lib/queries/review-deal.js` — reads `provision_cards` for a deal, returns grouped-by-section shape ready for the renderer.
- Handles cross-reference expansion: when a card has `kind=cross-reference`, resolves `references[]` to the actual definition cards and attaches them for hover-expand.
- Unit tests.

Self-merge on green.

### Step 5 — Card renderer (mechanical PR)

Branch: `wp/m2-00-05-provision-card-table`
Classification: `mechanical`

Ships:
- `components/review/ProvisionCardTable.jsx` — renders the grouped shape from Step 4.
- Definition cards get their own visual treatment. Cross-refs hover-expand.
- Card debug view shows provenance bundle inline.
- Storybook or fixture-rendered snapshot tests.

Self-merge on green.

### Step 6 — Render path switch in review page (mechanical PR)

Branch: `wp/m2-00-06-review-page-switch`
Classification: `mechanical`

Ships:
- `pages/review/[id].js` — adds branch: `if (provision_cards.count(deal_id) >= 40) → ProvisionCardTable, else → legacy renderers`. Threshold is 40 per PART 3 §3.5.
- Legacy fallback branch stays intact. M2-05 will delete it once M2-02 (parity) passes.
- Feature-flag override for dev/QA: query param `?render=legacy` or `?render=schema` forces one path regardless of card count.

Self-merge on green.

### Step 7 — Corpus backfill (mechanical PR + a long-running job)

Branch: `wp/m2-00-07-corpus-backfill`
Classification: `mechanical`

Ships:
- `scripts/backfill/extract-to-cards.js` — runs the extractor across all 40 deals, writes to `provision_cards` via `store-cards.js`.
- Idempotent (safe to rerun). Uses `provision_instance_id` as the upsert key.
- Emits `docs/reprocess/round-m2-00-backfill.md` with per-deal card counts + timing.
- Runs the backfill as part of PR CI (or, if too slow, as a separate long-running job with a follow-up PR that adds the completion report). Ben can decide via a Queue entry if it needs to run out-of-band.
- Exit criterion: every deal has ≥40 rows. Metsera has ≥40 rows.

Self-merge on green.

### Step 8 — Waitlist drain (mechanical PR)

Branch: `wp/m2-00-08-waitlist-drain`
Classification: `mechanical`

Ships:
- Scans `docs/reprocess/schema-deferred-waitlist.jsonl` (from WP-M2-01).
- Any entries whose `waiting_on` matches `Provision.kind`, `provision-instance ID`, or `provenance bundle` (all delivered above) get promoted to MERGE (or SPLIT if applicable), reextracted, and struck from the waitlist.
- Updates the drain status badge on `/admin/reconciliation/deferred`.

Self-merge on green.

### Step 9 — Plan doc updates (mechanical PR — can bundle with Step 8)

Branch: `wp/m2-00-09-plan-updates`
Classification: `mechanical`

Edit `PLAN-M2-schema-deploy.md` to add WP-M2-00 as the first WP in the milestone. Update exit criteria to require "WP-M2-00 shipped, corpus backfill green" before M2-02 can start.

Edit `PLAN-M3-ingest-seamless.md` to remove WP-M3-01, WP-M3-03, WP-M3-04 (content now in WP-M2-00). M3 becomes:
- WP-M3-02: Normalizer manifest (as before)
- WP-M3-05: Ingest surface + smoke test (as before)
- Plus residual waitlist review at end of M3 (as before)

Edit `PLAN-TAXONOMY-GAPS.md`: G1, G2, G4, G5, G10, G11 owner column becomes WP-M2-00 (M2). G3, G6, G7, G8, G9 unchanged. Add a note explaining the M3→M2 pull-forward.

## Then resume M2-02

WP-M2-02 (schema parity audit) can now proceed. The audit compares:
- schema-first: `pages/review/[id].js` with `?render=schema` forced
- legacy: `pages/review/[id].js` with `?render=legacy` forced

The audit harness from `pm-wp-schema-parity-audit.codex.md` becomes runnable as originally briefed.

## Pattern fix — READ THIS

M1 shipped `/admin/review-queue` to replace the `BLOCKED-*.md` pattern. This is the **third** time a blocker has been filed as a `BLOCKED-*.md` file or a PR titled `BLOCKED-*` since M1 shipped (PR #186, PR #186's body, plus the earlier BLOCKED-P0-C files on Ben's Mac).

Going forward, blocker discovery = **create a Review Queue entry**, not a BLOCKED-*.md file or a BLOCKED-* PR title. The Queue entry is Ben's tool. `BLOCKED-*.md` files force Ben back to file-hunting, which is the exact anti-pattern M1 exists to prevent.

If the blocker is discovered mid-implementation and there is no natural "canonical decision" to file, the correct move is still a Queue entry with `kind: "clarify"` — Ben clicks a button describing the unblock path. Never a `BLOCKED-*.md` file. Never a PR titled `BLOCKED-*`.

This is the last reminder. Update your classifier rules so this pattern stops.

## Classification summary

- Step 1: mechanical (Queue-entry PR). Ben clicks approve at `/admin/review-queue` = 1 click.
- Steps 2-9: all mechanical, self-merge on green.

**Total Ben clicks: 1.**

## Order of operations

Step 1 opens PR → self-merge → Ben clicks approve → Steps 2-9 run in dependency order (2 → 3 → 4/5 parallel → 6 → 7 → 8 → 9). Steps 4 and 5 can be parallel PRs. Everything else is sequential because each depends on the prior schema state.

## What to do with PR #186 right now

Close #186. Delete branch `wp/m2-02-schema-parity-audit`. Move the diagnostic content from `BLOCKED-WP-M2-02-SCHEMA-PARITY-AUDIT.md` into the Step 1 Queue entry's evidence — it's useful context. Then start Step 1.

Go.
