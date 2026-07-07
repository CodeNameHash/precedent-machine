# BLOCKED-WP-UX-SHELL

WP-UX-SHELL cannot start from the current authoritative instructions because its required self-contained brief is missing from `origin/main`.

The roadmap at `precedent-machine-roadmap-v5.md` line 404 says WP-UX-SHELL uses `pm-wp-ux-shell.codex.md`. The post-P0C master brief also points to that same existing brief for WP-UX-SHELL. That file is not present in `origin/main`, and a local search did not find it under `/Users/bengoodchild/Documents/Claude` or `/Users/bengoodchild/.codex/attachments`.

Existing UX-shell scaffold files are present on `origin/main` (`lib/design/**`, `pages/design/index.js`, and related tests), but the runtime review-page integration is not complete: `pages/review/[id].js` still renders the old `Full Document` button/tab flow and does not import the new design-shell components. Without the missing brief, I cannot safely infer the remaining integration and delete-legacy steps.

Add `pm-wp-ux-shell.codex.md` to the repo root, or provide a replacement authoritative WP-UX-SHELL brief, then delete this blocker and resume.
