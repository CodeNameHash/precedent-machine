# Handoff: canonical Query UI slice complete, 2026-07-23

Continues `CANONICAL-V2-HANDOFF-2026-07-22.md`. The "next bounded slice"
defined there is implemented, reviewed, verified, and pushed to
`claude/persistent-sessions-infrastructure-u10wiz` (commit `b40e5f5`),
based on `main` at `20c0b4a`. Not merged — Ben decides the merge into
`codex/canonical-corpus-v2` / `main`.

## What shipped

See `SPEC-CANONICAL-QUERY-UI-SLICE-2026-07-22.md` (the pre-implementation
acceptance spec, including the four review-accepted amendments) and commit
`b40e5f5`. Summary: exact ad hoc seller-termination-fee `MARKET_RANGE`
requests route — behind `NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED`,
default OFF — to one bounded POST `/api/canonical-v2/query`, rendered from
`CANONICAL_QUERY_RESULT_VIEW/V1` with row-level isolation and no
client-side cohort stats. Saved queries, reverse fees, unmappable filters,
and every other shape stay on the untouched legacy path.

Process followed the CLAUDE.md watchdog protocol: Fable spec → delegated
production (Sonnet) → Fable adversarial diff review (two findings fixed:
network-rejection safety in the routing helper; non-integer `signing_year`
stays legacy) → full battery.

## Verification record

- `npm test`: 2693/2693 (baseline 2674 + 19 new).
- `npm run verify:codex-program`: PASS, digest `48442a6b…` (unchanged).
- `npm run build`: clean (pre-existing warnings only).
- `git diff --check`: clean.
- Browser smoke (Chromium/Playwright, production build, both flag
  states): flag off ⇒ one `/api/query/run` call, zero canonical calls;
  flag on ⇒ exactly one canonical POST, zero legacy calls,
  `FEATURE_DISABLED` safe-error panel (server flag off by design), no
  stuck loading state.

## Deliberately not mapped in this slice (decisions parked, not made)

- `law_firm` / `lawyer` deal-filters → the governed
  `adviser_either`/`lawyer_either` correspondence is an unmade semantics
  call; such queries stay legacy.
- QXO termination taxonomy Freeze Gate remains pending and remains Ben's
  decision. No codes were invented; the mapper uses only the frozen
  fixture-contract vocabulary.

## Staging access state (this container only)

- Staging project `sjumbznveyyiizhwvixj`: legacy JWT API keys were
  disabled 2026-07-22T06:34Z. New-format keys (`sb_secret_…` /
  `sb_publishable_…`) work and live in this container's gitignored
  `.env.local` — they are NOT in the environment configuration, so new
  sessions will not have them unless Ben adds them there.
- Least-privilege grants confirmed live: the secret key is denied execute
  on e.g. `canonical_v2_active_release` (fail-closed by design). The
  serving RPCs exist and match `lib/canonical-v2/serving-client.js`.

## Containment unchanged

No corpus writes, no activation, no production touches, no taxonomy
changes, both feature flags off everywhere. `main` stays deployable.
