# WP-UX-SHELL — Codex Execution Brief

> **This brief is a pointer.** Substantive scope lives in `precedent-machine-roadmap-v5.md` §WP-UX-SHELL (lines 398–435 of the on-repo v5). This file exists to name the branch, confirm the allowlist entry, and restate exit criteria. If anything here conflicts with Roadmap v5, Roadmap v5 wins.

## Source of truth

Read **`precedent-machine-roadmap-v5.md` §WP-UX-SHELL** before writing any code. That section defines the full spec. Do not proceed until you have read it.

## Branch and allowlist

- **Branch:** `feat/ux-shell` (Roadmap v5 explicitly overrides the default `wp/<slug>` pattern for this WP).
- **Phase id:** `WP-UX-SHELL`.
- **Allowlist file:** `.github/phase-allowlists/wp-ux-shell.json`. If this file does not exist yet on `main`, create it as the first commit of this WP, matching the exact schema of any existing `wp-*.json` in that directory. It must permit only the files listed under "Ships" in Roadmap v5 §WP-UX-SHELL plus this brief file itself.

## Discovery step (mandatory, before any file write)

1. Read Roadmap v5 §WP-UX-SHELL end-to-end.
2. Read `pm-master-straitjacket.codex.md` PART 3 §3.3 line 2 to confirm this WP is still current-topmost and no dependency has changed.
3. Verify no file listed under Roadmap v5's "Does NOT touch" set is in your edit plan. If any is, STOP and write `BLOCKED-WP-UX-SHELL-scope-drift.md`.
4. Verify the allowlist file exists (or plan its creation as commit 1).

## Ships (from Roadmap v5 §WP-UX-SHELL — reread the roadmap for the authoritative list)

- `lib/design/tokens.ts`
- `pages/design/index.tsx`
- An ESLint rule that enforces token usage (name and location per Roadmap v5)
- New two-level sidebar component
- Dense header component
- Canonical short-form dictionary
- Full-document overlay component
- Landing grid
- Section persistence (URL/state persistence per Roadmap v5)

## Does NOT touch

- `components/review/**` provision-card renderers
- `lib/features/**`
- `lib/rubric/**`
- `lib/taxonomy/**`
- Anything under `pages/api/**` (no route changes)
- Ingest pipeline (`lib/parser-v2/**`, `scripts/ingest/**`)

If Roadmap v5 lists additional excluded paths, treat those as also binding.

## Exit criteria

Exact exit criteria live in Roadmap v5 §WP-UX-SHELL. At minimum:

- Token file exists, ESLint rule green across the repo, no raw hex/px values in the new shell components.
- Design page (`pages/design/index.tsx`) renders and shows every token + shell primitive.
- Sidebar renders the two-level structure without regressing existing routes.
- Header dense variant renders on every non-review page.
- Full-doc overlay opens and closes from a canonical trigger.
- Section persistence: reload preserves current section per URL segment.
- All existing tests pass; no visual regression on `/review/[id]` (Roadmap v5 explicitly forbids touching that renderer here).

## Merge posture

Self-merge on green CI per Inv-25. This WP does not cross a freeze gate and does not modify canonical legal semantics.

## If blocked

Write `BLOCKED-WP-UX-SHELL.md` naming the specific Roadmap v5 line that could not be resolved, or the specific "Does NOT touch" path a required change would violate. Do not half-ship the shell.
