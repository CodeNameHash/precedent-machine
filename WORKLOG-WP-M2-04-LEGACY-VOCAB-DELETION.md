# WP-M2-04 Legacy Vocab Deletion Worklog

Date: 2026-07-08

Scope:
- Added `scripts/audit/legacy-vocab-references.js`.
- Added `tests/audit/legacy-vocab-references.spec.js`.
- Generated `docs/schema-migration/legacy-vocab-references.json`.
- Replaced the placeholder `docs/schema-migration/deletions.md` with the audited deletion manifest.

Evidence:
- Review Queue approval: `authorize-legacy-vocab-deletion`, approved by Ben on 2026-07-08.
- Audit command: `node scripts/audit/legacy-vocab-references.js`.
- Targets audited: 7.
- Safe-to-delete targets: 0.
- Deferred targets: 7.

Deferred targets:
- `lib/feature-validation.js`: 22 references.
- `lib/expected-sets.js`: 19 references.
- `lib/category-summary-features.js`: 16 references.
- `lib/taxonomy.js`: 35 references.
- `lib/rubric.js`: 74 references.
- `lib/vocab/party-role-aliases.js`: 4 references.
- `lib/vocab/trigger-code-aliases.js`: 4 references.

Decision:
- No deletion PR was opened because the safe-to-delete set is empty.
