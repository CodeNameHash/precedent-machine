# Session summary, 2026-07-23 — canonical Query UI slices 1–2 + hardening

Everything below is merged to `main` (and content-synced to
`codex/canonical-corpus-v2`), each through the full watchdog loop:
Fable spec → delegated production → Fable adversarial review → post-commit
battery → browser smoke → PR → merge → production live-verify. Production
behavior is unchanged throughout: every flag is off, containment intact
(`/api/canonical-v2/query` 503 FEATURE_DISABLED, market-stats 503).

## Shipped (PRs #317–#321)

1. **Slice 1** — feature-flagged canonical Query UI path for the seller
   termination fee (% of deal value). Spec:
   `SPEC-CANONICAL-QUERY-UI-SLICE-2026-07-22.md`.
2. **Slice 2** — governed refinements (dropdowns sourced only from the
   view's own metadata/rows), percent bounds, chips, bounded "Show more"
   pagination with corpus-release identity safety. Spec:
   `SPEC-CANONICAL-QUERY-UI-SLICE-2-2026-07-23.md`.
3. **PLAN.md refresh** — §1 "critical path" was already built and run
   corpus-wide 2026-07-13; the plan now matches the evidence.
4. **Mechanical hardening** — opt-in `--rematerialize` on `reprocess.js`
   (default unchanged pending DATA-1) and an additive claims-coverage gate
   in `ingest-qa.js`. Spec: `SPEC-MECHANICAL-HARDENING-2026-07-23.md`.
5. **Analysis** — `ANALYSIS-SLICE-4-FIELD-METRIC-CORRESPONDENCE-2026-07-23.md`:
   none of the three remaining QUERY_METRICS can be safely mapped from a
   legacy request today; evidence recorded per metric.

Suite grew 2,674 → 2,734 tests, all green. Programme digest unchanged
(`48442a6b…`). Staging REST keys verified working and fail-closed
(zero canonical function grants — by design); keys live only in this
session container's gitignored `.env.local`.

## Ben's decision queue (nothing else is blocked on these)

1. **DATA-1**: flip `--rematerialize` to default-on in `reprocess.js`?
   (Capability shipped; default untouched.)
2. **Entity classes**: does the governed cohort dimension `lawyers[]` hold
   individual names or firm names, and is `adviser_firms[]` financial
   advisers only? One line unlocks (or kills) the legacy
   `law_firm`/`lawyer` filter mapping.
3. **QUERY_METRICS widening**: authorize serving
   `NO_SHOP_INITIAL_MATCH_PERIOD_DAYS` (frozen-contract change) so the one
   promising legacy pair (`initialMatchPeriodDays`) becomes routable?
4. **QXO termination taxonomy Freeze Gate** — unchanged, pending.
5. **Prune round 2** (22 deals) — per-card decisions,
   `reports/PRUNE-ROUND2-DRAFT-2026-07-14.md`.
6. **Flag enablement** anywhere (preview or prod), and the staging
   serving-role connection string if a live canonical happy-path test on
   the Vercel preview is wanted.
7. **Local fast-forward** of `codex/canonical-corpus-v2` to exact-SHA
   parity with `main` if the recorded convention matters (content parity
   is already maintained via sync PRs #318/#320/#322).
