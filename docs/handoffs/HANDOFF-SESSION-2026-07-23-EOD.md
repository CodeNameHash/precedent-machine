# Session handoff, 2026-07-23 end-of-day — next: QXO candidate build (online import, Option A)

Governing programme: `docs/CODEX-PROGRAM.md` (Ben directed: codex-program
only, not PLAN.md). Registry status: `docs/certification/
programme-gate-status.json` generation 3 — G0 owner-deemed, both P1 gates
closed, contract amendment recorded. Working branch:
`claude/persistent-sessions-infrastructure-u10wiz` (Ben granted standing
merge authorization; merges go via PR to `main`, then a content-parity
sync PR to `codex/canonical-corpus-v2`; direct pushes to other branches
are blocked by the harness).

## What is true right now (all merged to main, PRs #317–#334, all live-verified)

- Canonical Query UI slices 1+2 (seller fee, refinements, pagination) +
  D3 widening (NO_SHOP_INITIAL_MATCH_PERIOD_DAYS) + D2 mapping
  (law_firm→adviser_either, lawyer→lawyer_either), all behind
  `NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED` (off in production, ON in
  Vercel Preview).
- LIVE end-to-end proven twice on the branch preview against real
  staging: active pointer `eda01d98…`, release `c9c19dc1…` (F1), Landos
  row at 5.09%. Serving is release-declared-fingerprint (PR #333) — the
  compiled contract governs candidate building only, so F2's existence
  does not disturb F1 serving (live-proven post-merge).
- Freeze-gate amendment complete in code: versioned contract inputs
  (`FIXTURE_CONTRACT_INPUT_V1` frozen at F1
  `56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d`;
  V2 adds Ben's four concepts TERMR-NOSOL-BREACH / TERMR-BREACH /
  TERMR-NOVOTE / TERMR-OUTSIDE at F2
  `46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83`);
  seven trigger codes + three conditions + one timing code; QXO
  termination fixture (`__fixtures__/canonical-v2/qxo-termination-fee-row.js`)
  re-keyed to honest concepts, built via the WP-EXP-01 harness from
  verbatim EDGAR text (`qxo-termination-fee-reviewed-excerpts.txt`).
- Reprocess/QA hardening + `/api/query/run` guard merged; production
  aliases healthy and contained at every check.

## THE NEXT WORK PACKET: QXO termination candidate release + Option A import

Ben cannot run anything locally. He chose **Option A**: the next session
generates PASTE-READY SQL artifacts and Ben executes them in the staging
Supabase SQL Editor (project `sjumbznveyyiizhwvixj`) from his iPad —
dry-run/verification SELECTs first, then the guarded apply statements,
then post-apply verification. Record this in the status artifact as the
owner-approved runbook adaptation of "Ben-run local."

Steps for the next session:
1. Read, in order: this file; `SPEC-QXO-TERMF-AMENDMENT-2026-07-23.md`;
   `SPEC-CONTRACT-AMENDMENT-PATH-2026-07-23.md`;
   `SPEC-VERSIONED-CONTRACT-2026-07-23.md`;
   `docs/handoffs/CANONICAL-V2-HANDOFF-2026-07-22.md` (the prior QXO
   candidate's staging flow — seed/manifest/import-plan/receipt digests);
   `scripts/canonical-v2-staging-qxo-*.mjs` +
   `scripts/canonical-v2-staging-schema.mjs` (the import machinery and
   SQL function surface); `lib/canonical-v2/qxo-material-candidate-identity.js`.
2. Build the QXO termination candidate under F2 through the established
   machinery: admitted source capture (SEC bytes, hash-verified — the
   admission path the prior slices used), proposal batch, candidate
   release seed/manifest, import plan. Producer-built, Fable-reviewed;
   every digest deterministic and printed so Ben can compare dry-run
   output against the committed values.
3. Generate the Option A artifacts: an ordered set of SQL files/blocks
   (verify-before, dry-run, apply via the guarded import RPC, verify-
   after, rollback-rehearsal equivalent) sized for SQL-Editor pasting.
   NOTE the prior producer's finding: no admitted termination-fee source
   exists in staging yet — the admission step is part of this packet,
   not skippable.
4. ALSO REQUIRED before an F2 release can serve: the step-1 SQL widening
   (`canonical_v2_active_query_page` release-declared fingerprint) has
   NOT been applied to staging. `scripts/canonical-v2-staging-active-release-fingerprint.mjs`
   exists; for Option A, extract its function-replacement SQL into a
   paste block for Ben (apply is idempotent/additive; F1 serving
   unaffected — verified in code review).
5. Import is INACTIVE only. Activation is a separate Ben decision (the
   serialisable release-state switch), not part of this packet.

## Environment notes for the fresh session

- Staging REST keys lived only in this container's gitignored
  `.env.local` — GONE in a new container. Not needed for the candidate
  build (pure code-side) or Option A (Ben executes). If live REST checks
  are wanted, ask Ben to re-supply or add to the environment config.
- Vercel Preview env is set (both flags + `CANONICAL_V2_ENVIRONMENT` +
  `CANONICAL_V2_STAGING_DATABASE_URL` with the `canonical_v2_preview`
  role). Vercel env vars require a redeploy to take effect. Preview URLs
  are SSO-protected; `get_access_to_vercel_url` mints bypass links, and
  each new deployment invalidates prior auth cookies.
- Deployment verification lesson: check deployment STATE via the Vercel
  tools, never alias curls alone (aliases serve the last READY build);
  and remember `.vercelignore` excludes `/scripts/*` with explicit
  whitelists — any new cross-directory require from a whitelisted file
  needs its own entry or every Vercel build fails while local stays
  green (that exact incident: PR #330).
- The battery runs POST-commit (diff-scoped lints); Codex CLI does not
  exist in this environment (CLAUDE.md's gpt-5.x lane is local-only);
  production work runs on Sonnet producers, Fable specs/reviews, per the
  session pattern Ben endorsed.

## Small open items

- Rotate the `canonical_v2_preview` password (transited chat 2026-07-23).
- Ben to eyeball live legacy card `fec8549c`: does it really carry the
  nonexistent `8.02` citations / unsourced 18-month tail found in the
  test reconstruction? (Canonical fixture already built from source, so
  informational.)
- `TERMR-OUTSIDE` minted, not yet exercised by any fixture (corpus-
  evidenced, Ben-approved; first outside-date fee deal exercises it).
- `adviser_firms[]` naming irony (holds law firms) — recorded in
  `ANALYSIS-D2-ADVISER-LAWYER-ENTITY-CLASSES-2026-07-23.md`; any future
  financial-adviser dimension is a NEW dimension.
- Decision console artifact (resolved-record):
  https://claude.ai/code/artifact/4a296bee-563a-44a6-9f15-e70f1b3bc582
