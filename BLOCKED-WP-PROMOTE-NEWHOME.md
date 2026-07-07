# BLOCKED-WP-PROMOTE-NEWHOME

Attempted WP-PROMOTE-NEWHOME from `origin/main` at `d33e72ef11739bd8cafe13afd43b744dfa653b67`.

Preflight passed the substantive gates:

- `docs/schema-shape/phase-0-C.frozen` exists on `origin/main`.
- `docs/schema-shape/normalized-v1.json` exists on `origin/main`.
- `docs/schema-shape/canonical-registry-v1.md` exists on `origin/main`.
- Main CI is green for `Phase 0-C replay G-0B-T3 reconciliation (#159)`.
- Revised ingest QA gate is clean: 40 deals checked, 0 nonzero unverified-quote rows, 0 duplicate-clause rows, 13 expected quarantine-only threshold failures.

What was attempted:

- Began the route promotion specified in Section 3: move `pages/newhome.js` to `pages/index.js`, `pages/newhome/library.js` to `pages/library.js`, `pages/newhome/query/[kind]/[id].js` to `pages/query/[kind]/[id].js`, and `pages/api/newhome.js` to `pages/api/home.js`.
- Updated stale `/newhome`, `/newhome/query`, `/newhome/library`, and `/api/newhome` references locally.
- Added the required redirects in `next.config.js` locally.
- Deleted the specified legacy pages locally.

What failed:

- The CI `phase-allowlist` job cannot run on the WP branch required by the brief: `feat/promote-newhome-to-root`.
- `scripts/ci/detect-phase.js` rejects that branch shape with: `Branch name must match phase-{N}/*, got "feat/promote-newhome-to-root"`.
- `.github/workflows/ci.yml` only special-cases `infra/ci-allowlist-shallow-checkout`; all other pull requests call `node scripts/ci/detect-phase.js`.
- There is no `.github/phase-allowlists/` file or `detect-phase.js` path for WP-track branches such as `feat/promote-newhome-to-root`.

Why this blocks proceeding:

- The master brief requires every PR to pass CI before merge.
- Opening WP-PROMOTE-NEWHOME as written would produce a guaranteed red `phase-allowlist` check for branch-shape reasons unrelated to the route changes.
- Rebranching this WP under an existing `phase-*` name would be a silent allowlist workaround and would touch files outside that phase's declared scope.
- Adding WP branch detection / WP allowlists here would bootstrap missing CI infrastructure from inside the current WP, which the blocker policy forbids.

Needed unblock:

- Add CI support for WP-track branches, probably one of:
  - extend `detect-phase.js` / `check-allowlist.js` to recognise documented WP names and load a WP allowlist, or
  - add a workflow special-case for WP-PROMOTE-NEWHOME with its Section 3 allowlist, or
  - re-brief WP-track branch naming so each WP maps to an explicit phase allowlist committed before the WP starts.

No route-promotion changes were committed.
