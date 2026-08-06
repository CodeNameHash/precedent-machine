# M5 — UI homogenized + demo-ready

Goal: every admin/review/query page speaks the same visual language. Landing grid is clean. Full-doc overlay works. Reports UI is polished. Deployable/showable end-to-end without visual embarrassment.

Absorbs the pending WP-UX-SHELL + WP-UX-REVIEW WPs from roadmap v5 (lines 398-436).

## Exit criteria

- Design tokens (`styles/tokens.css` or equivalent) applied to every admin page + `/review/[id]` + `/query` + landing.
- Landing (`pages/index.js`) shows a grid of 40 deal cards with consistent thumbnails, metadata, hover states.
- Full-document overlay works on `/review/[id]`: click any provision card → source PDF opens in overlay with highlight on the exact span.
- Admin nav consistent across all admin pages (nav-registry pattern extended to cover `/admin/review-queue`, `/admin/ingest`, `/admin/reports`).
- Reports UI (`/admin/reports`) exists and renders the parity audit + reconciliation log + ingest QA reports.
- Visual QA pass: a single reviewer walks the whole app and finds nothing embarrassing.

## WPs in M5

### WP-M5-01: Design tokens + shared shell

- Ships:
  - `styles/tokens.css` — color, spacing, type scale, radius, shadow tokens
  - `components/shell/AdminShell.js` — shared admin layout (nav + header + content)
  - Every admin page migrated to `AdminShell`
- Classification: **mechanical**
- Branch: `wp/m5-01-tokens-shell`
- **Runs early — M4-04 depends on this.**

### WP-M5-02: Landing grid

- Ships:
  - `pages/index.js` — 40-deal grid, consistent card, hover, search filter
  - Card shows: parties, date, provision count, ingest status
- Classification: **mechanical**
- Branch: `wp/m5-02-landing-grid`

### WP-M5-03: Full-doc overlay

- Ships:
  - `/review/[id]` provision cards clickable → opens `SourceOverlay` component with PDF viewer + highlight
  - Uses provenance bundle (M3-03) for exact span
- Classification: **mechanical** (requires M3-03 merged)
- Branch: `wp/m5-03-full-doc-overlay`

### WP-M5-04: Review Queue polish

- Ships:
  - `/admin/review-queue` gets the same shell/tokens
  - Evidence drilldown expands inline
  - Bulk actions (approve all mechanical, defer all destructive, etc.)
- Classification: **mechanical**
- Branch: `wp/m5-04-review-queue-polish`
- Depends on M1 merged (obviously).

### WP-M5-05: Reports UI

- Ships:
  - `/admin/reports` — index of parity audit, reconciliation log, ingest QA reports
  - Each report gets a dedicated page: `/admin/reports/parity`, `/admin/reports/reconciliation`, `/admin/reports/ingest-qa`
  - Absorbs the WP-REPORTS work from roadmap v5 line 715
- Classification: **mechanical**
- Branch: `wp/m5-05-reports-ui`

### WP-M5-06: Demo dry-run

- Ships:
  - Full end-to-end walkthrough: ingest a fresh test deal → land in corpus → runs through parity/reconciliation → renders on `/review/[id]` → queryable → visible in `/admin/reports`
  - Recorded as a script Codex runs in CI on every PR to any of the M5 branches
  - If dry-run fails, PR is red — regardless of unit tests
- Classification: **mechanical**
- Branch: `wp/m5-06-demo-dryrun`

## Ben interruptions in M5

- Zero. Every M5 WP is mechanical. This is the payoff milestone — pure polish, no semantic decisions.

If Ben wants a specific visual direction (color palette, brand feel), he drops it into a Queue entry titled "M5 direction: <X>" and Codex applies it in M5-01.

## Handoff

M5 complete = demo-ready. Ben can show the tool to prospective users.
