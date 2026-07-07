P0-C strings cleanup is blocked by the phase allowlist.

Branch / PR:
- codex/registry-strings-reconcile-cleanup
- PR #140

Local gates:
- npm test: PASS
- node scripts/ingest-qa.js --all: revised QA blockers PASS, with 0 unverified quotes and 0 duplicate clauses. The command exits non-zero only for existing per-deal coverage / canonical-rate threshold quarantine signals.

CI state:
- test-and-build: PASS
- invariants: PASS
- Vercel: PASS
- phase-allowlist: FAIL

The GitHub phase-allowlist job first failed while collecting changed files because the GitHub PR files API timed out on the large normalized-v1.json diff.

The underlying local allowlist check also fails for Phase 0-C:

- Denied files:
  - docs/schema-shape/canonical-registry-v1.md
  - pages/api/admin/registry/strings.js

- Outside allowlist:
  - pages/admin/registry/strings.js

This cleanup intentionally adds the strings review surface and updates the canonical registry artifact, so it cannot be merged under the current Phase 0-C allowlist without an explicit allowlist/phase decision.
