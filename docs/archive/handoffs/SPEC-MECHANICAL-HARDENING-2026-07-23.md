# Acceptance spec: mechanical hardening pair (PLAN §1.1 + §1.4 residue)

Fable-authored, pre-implementation. Two additive, behavior-preserving
changes. Neither touches extraction, taxonomy, canonical-v2, or any frozen
file. Corpus execution remains Ben-run local; nothing here runs a DB write
from CI or tests.

## A. Opt-in `--rematerialize` on `scripts/reprocess.js`

DATA-1 (Ben's queue) decides whether rematerialize runs automatically after
reprocess. Until he signs off, DEFAULT BEHAVIOR MUST NOT CHANGE: without
the new flag, `--apply` runs print `formatRematerializeWarning` exactly as
today.

- New flag `--rematerialize` (boolean). With it:
  - dry-run (default): after printing the extraction PLAN, also print the
    claims rematerialize PLAN for the same deals (no writes, no LLM) using
    the existing planner in `scripts/reprocess/rematerialize-claims.js`
    (import its functions if exported; otherwise refactor that script
    minimally to export its plan/write entry points without changing its
    CLI behavior — its own tests must stay green unmodified).
  - `--apply`: after successful extraction for the selected deals, run the
    rematerialize write path for exactly those deal ids, STRICT mode
    (ambiguity/coverage failure ⇒ exit 1 after printing the per-deal
    table; extraction writes are already committed at that point — say so
    plainly in the failure output so Ben knows claims are stale for the
    listed deals and can rerun `rematerialize-claims.js --partial` by
    hand). Optional pass-through `--rematerialize-partial` maps to the
    existing `--partial` semantics.
  - The warning block is replaced by a completion summary only when the
    rematerialize actually ran for those deals.
- No change to any other reprocess behavior, arg, or output line.

## B. Additive claims gate in `scripts/ingest-qa.js`

Today ingest-qa has zero claims awareness. Add, without altering any
existing gate, output line, or default:

- Per deal: fetch `claims` rows (paginated, same pattern as provisions) and
  `provision_cards` (id, excerpt_id only). Compute:
  - `claimsCount`;
  - `codedCardCoverage` = fraction of cards whose excerpt_id has ≥1 claim,
    over cards belonging to provisions that carry coded features (reuse or
    mirror `provisionHasCodedFeatures` from rematerialize-claims.js —
    import if exported, else replicate with a comment naming the source).
- New gates, defaults calibrated to the corpus evidence
  (`reports/TASK3-CORPUS-REPORT-2026-07-13.md`: 98.97% match): fail if
  `claimsCount == 0` while any coded features exist; fail if
  `codedCardCoverage < 0.95`. Both overridable via the existing gate
  override mechanism, same style as current gates.
- If the `claims` table is unreachable, degrade exactly like
  `review-deal.js` does (report "claims gate skipped", do not fail the
  run) — ingest-qa must keep working against databases predating claims.

## Tests (node:test, fakes only, no live DB)

1. reprocess arg parsing: `--rematerialize` recognized; absent ⇒ plan
   equals today's (snapshot the warning path); mutual behavior with
   `--apply`/dry-run as specced.
2. Wiring: with a fake sb + fake rematerialize entry points, `--apply
   --rematerialize` invokes the write path once with exactly the selected
   deal ids; dry-run invokes only the planner; strict failure propagates
   exit code and prints the stale-claims warning.
3. rematerialize-claims.js refactor (if needed): its existing test suite
   passes UNMODIFIED; CLI behavior byte-identical (same argv ⇒ same
   output on the same fake inputs).
4. ingest-qa claims gate: coverage math on fake rows (mixed coded/uncoded
   provisions, cards with/without claims); zero-claims-with-codes fails;
   0.95 boundary; override flag works; missing-table degrade path.

## Verification battery

Post-commit `npm test` green; `npm run build` green; `verify:codex-program`
PASS; `git diff --check` clean. No browser smoke needed (CLI-only), but
`node scripts/reprocess.js --deal metsera --types TERMF` (dry-run, no env)
must fail gracefully exactly as it does today when Supabase env is absent.

## Review gates (Fable)

Default-behavior byte-parity for both scripts when new flags/gates are not
engaged; no new DB writes reachable from tests; no threshold invented
beyond the calibrated 0.95; DATA-1 default flip NOT included.
