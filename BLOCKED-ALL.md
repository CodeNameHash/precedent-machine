# BLOCKED-ALL

All remaining WP-track work in `pm-post-p0c-master.codex.md` is blocked on the same CI assumption break.

The master brief schedules WP-track branches as `feat/*`:

- `feat/promote-newhome-to-root`
- `feat/query-adopt-and-harden`
- `feat/schema-first-feature-model`
- `feat/ingest-catalog-passive-edgar`
- `feat/direct-link-routing`
- and the remaining Section 9-17 `feat/*` branches

Current CI does not support those branch names. The `phase-allowlist` job calls `node scripts/ci/detect-phase.js` for every pull request except the hardcoded `infra/ci-allowlist-shallow-checkout` branch. `detect-phase.js` rejects non-`phase-*` branches with:

`Branch name must match phase-{N}/*`

Therefore any WP-track PR opened exactly as briefed is guaranteed to fail CI before its own allowlist can be evaluated. Rebranching WPs under existing `phase-*` names would be a silent scope workaround, and adding WP detection/allowlists inside an arbitrary WP would bootstrap missing infrastructure contrary to the blocker policy.

Required unblock: a CI-infra WP that teaches `detect-phase.js` / `check-allowlist.js` how to recognise documented WP-track branches and enforce each WP's allowlist, or a master-brief correction that maps WP-track branches to committed phase/WP allowlists before WP work resumes.
