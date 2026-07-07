# WORKLOG-P0-A

Phase: 0-A registry dedup + reviewer UI

Status: ready for human registry review and freeze.

## Files

- `scripts/registry/dedupe.js`
- `scripts/registry/detect-duplicates.js`
- `scripts/registry/coverage-detector.js`
- `docs/market-registry/generated-v1.deduped.json`
- `docs/market-registry/merge-report.md`
- `docs/market-registry/reviewer-state.json`
- `pages/admin/registry.js`
- `pages/api/admin/registry/decision.js`
- `pages/api/admin/registry/freeze.js`
- `pages/api/admin/registry/preview.js`
- `components/admin/AdminNav.js`
- `components/admin/registry/RegistryCard.jsx`
- `components/admin/registry/RegistrySidebar.jsx`
- `components/admin/registry/FlagBadge.jsx`
- `tests/registry/dedupe.spec.js`
- `tests/admin/registry-ui.spec.js`

## Registry Output

- Input rows: 1327.
- Output rows: 680.
- Mechanical merges: 701.
- Reviewer-flagged rows: 59.
- `mainConcept` rows: 1.
- `mainConcept.also_matches_provision_codes`: 61.

## Human Gate

- `docs/market-registry/FROZEN-v1.json` was not committed.
- `/api/admin/registry/freeze` writes `FROZEN-v1.json` only after every deduped row has a reviewer decision.
- The freeze route returns `409 pending_reviewer_decisions` while rows are pending.

## Deviations From PM Assumptions

- The source registry already had one schema `mainConcept`; the duplicate pressure was from rubric suffix rows such as `rubric.*.main_concept`.
- Fully absorbing every rubric suffix match would have produced 626 rows, below the PM target range. The deduper therefore preserves 54 matched rubric rows as `REQUIRES_REVIEWER_DECISION` review cards while also recording their proposed canonical merge.
- `lib/rubric.js` exports 17 top-level `PROVISION_TYPES`, not 20-plus. The UI renders all 17, plus `FLAGGED`, `ALL`, and `VOCAB`.
- `docs/vocab` is absent in this checkout. The VOCAB tab is present and read-only, with no files listed.

## Verification

- `node scripts/registry/dedupe.js`
- `node --test tests/lint/phase-minus-one.spec.js tests/registry/dedupe.spec.js tests/admin/registry-ui.spec.js`
- `npm test`
- `npm run build`
- `bash scripts/ci/run-all-invariants.sh`

All commands passed.
