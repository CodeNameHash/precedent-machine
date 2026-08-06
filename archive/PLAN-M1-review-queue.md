# M1 — Review Queue is live

Goal: every future Ben-decision is a click in one UI. No more PR-hunts.

## Exit criteria (all must be true)

- `/admin/review-queue` page renders every unresolved entry, sorted newest-first.
- Each entry shows: title, kind pill, summary, evidence links (clickable), choice buttons.
- Clicking a choice button POSTs to `/api/admin/review-queue/[id]/resolve`, writes the resolution to disk, updates HANDOFF.md with a machine-readable line Codex can grep.
- Codex-side helper `scripts/review-queue/create.js` — Codex calls this to create a Queue entry from within any PR.
- Codex-side helper `scripts/review-queue/poll.js` — Codex calls this at the start of any WP to check whether any of its open PRs have a resolved Queue entry it needs to act on.
- Test coverage: creating an entry, rendering the page, resolving an entry, poller detecting resolution.
- Documented in `docs/admin/review-queue.md` for future engineers.
- `PLAN.md` reference to the queue works end-to-end.

## WPs in M1 (do in order)

### WP-M1-01: Review Queue backend + storage

- File: `pm-wp-m1-01-review-queue-backend.codex.md` (Codex to write from this outline)
- Ships:
  - `docs/review-queue/README.md` explaining the schema + directory layout
  - `docs/review-queue/schema.json` — JSON schema for entries
  - `lib/review-queue/store.js` — read/write helpers over `docs/review-queue/*.json`
  - `lib/review-queue/create.js` — validate + write a new entry
  - `lib/review-queue/resolve.js` — mark resolved + append HANDOFF machine-readable line
  - `pages/api/admin/review-queue/index.js` — GET list
  - `pages/api/admin/review-queue/[id]/resolve.js` — POST resolution
  - Tests for all of the above
- Classification: **mechanical**. Codex self-merges on green.
- Branch: `wp/m1-01-review-queue-backend`

### WP-M1-02: Review Queue admin page

- File: `pm-wp-m1-02-review-queue-page.codex.md`
- Ships:
  - `pages/admin/review-queue.js` using the same design-token language as other admin pages
  - `components/admin/ReviewQueueEntry.js` — one entry card with evidence links + choice buttons
  - `docs/admin/nav-registry.json` gets a new entry
  - Playwright/RTL test: page renders, buttons work end-to-end
- Classification: **mechanical**.
- Branch: `wp/m1-02-review-queue-page`

### WP-M1-03: Codex-side helpers

- File: `pm-wp-m1-03-codex-helpers.codex.md`
- Ships:
  - `scripts/review-queue/create.js` — CLI wrapper Codex calls from within any WP PR (`node scripts/review-queue/create.js --kind canonical --title "..." --pr <n>`)
  - `scripts/review-queue/poll.js` — CLI that reads HANDOFF.md for resolution lines, returns JSON, exits 0 if a decision is available for a given PR
  - `scripts/review-queue/README.md`
  - Tests
- Classification: **mechanical**.
- Branch: `wp/m1-03-codex-helpers`

### WP-M1-04: Documentation + first live decision

- File: `pm-wp-m1-04-documentation.codex.md`
- Ships:
  - `docs/admin/review-queue.md` — how it works, for future engineers
  - Retrofit: create one Review Queue entry for "authorize legacy vocab deletion" — this becomes the first live use of the queue, and it also unblocks M2's destructive-delete step.
- Classification: **mechanical** for the docs, **canonical** for the retrofit entry (which is itself the first canonical-review the queue handles — meta).
- Branch: `wp/m1-04-documentation`

## Estimated velocity

Four PRs. All mechanical except the retrofit entry itself. Codex can ship in one Codex-session (a few hours end-to-end). Ben's one click on the retrofit entry closes M1.

## Handoff to M2

Once M1's four WPs merge and `/admin/review-queue` is live, Codex moves to M2. All M2 Ben-decisions route through the queue.
