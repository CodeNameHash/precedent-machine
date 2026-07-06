# WP-REVIEW-STRICT-V1 Report

## Phase A - Canonical sweeps + schema

- Added deterministic canonical sweep scripts under `scripts/canonical-sweep/`.
- Generated proposal reports:
  - `reports/canonical-sweep/ioc-other-exclusions.md`
  - `reports/canonical-sweep/rw-sec-filings-portions-excluded.md`
  - `reports/canonical-sweep/rw-general-lookback-scopes.md`
- Added canonical vocab scaffolds under `lib/vocab/`.
- Added strict schema migration at `supabase/wp-review-strict-v1.sql`.

## Phase B - Extract/classify fixes

- Added heading-preferred IOC category resolution in `lib/parser-v2/classify.js`.
- Carried IOC `categoryCanonical` through extraction in `lib/parser-v2/extract.js`.
- Hardened R&W look-back display to reject decimal or over-240-month values.
- Hardened SEC Filing / Meeting rows so unlabeled values render as QA rows, not blank left cells.

## Phase C - Rendering rewrites

- Added `components/review/ProvisionSubRowTable.jsx`.
- Rebuilt Employee Equity as the strict five-column table.
- Added `ConsiderationBadge` and wired it into the deal header.
- Reworked Antitrust summary and SEC Filing / Meeting onto the shared sub-row table.
- Added Outside Date strict pill row and reused it in Antitrust.
- Added strict hooks for bring-down scope, stockholder approval, MAE split/absence, sidebar canonicality, Material Contracts width, and Employee Benefits party attribution.
- Removed visible banned review headers from the reviewed source surfaces.

## Phase D - Acceptance tests

- Added `tests/review-strict-v1.test.js`.
- Updated existing source-contract tests where the strict header contract superseded older labels.
- Full suite result: `904` passing, `0` failing.

## Reingest / corpus status

- Canonical sweeps were run against available local data.
- No live corpus reingest was run in this pass.

## Screenshots

- Not captured in this local pass.

## Deviations

- The brief's four separate PR/reviewer gates were collapsed into one local implementation pass because the active instruction was to do all phases in this workspace.
- Reviewer approval of the proposed canonical vocab lists is still a human gate before freezing vocab in a real PR flow.
- `.env.local` was not printed.
- No model switch was made.
