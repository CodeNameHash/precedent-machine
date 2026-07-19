# PLAN — single source of truth for what happens next

Maintained by Fable; updated as items land. Last update: 2026-07-19
(post PR #261: WP-2 query UI + review-feedback r3 + span-accounting
report layer merged to main). Corpus program (Phases 0–5) is COMPLETE —
see docs/reports/PHASE-5-REPORT-2026-07-18.md.

## Merged to main (this program)

- PR #258 — Mergertrace route swap (+ r1/r2 polish).
- PR #259 — Package A (deals index perf: 31.7MB→95.6KB payload,
  1000-row-cap fix, staging filter, cache headers) — urgent post
  Supabase Disk IO incident.
- PR #260 — Package B (deal-metadata persistence: shared ingest prompt,
  shell-buyer resolution SPV-only, PR value ladder, backfill 72 rows,
  ingest-qa gates) + WP-1 (20 demo queries green).
- PR #261 — WP-2 (query UI on .mtx primitives, CSV export, demo tiles),
  review-feedback r3 (all 16 items, screenshot-verified 1440+390px),
  span accounting Parts 1–3 (report-only), scoped TOOLTIP_MAX lint
  exemption (legacy /review-v1 only importer).

## Now in flight

1. **WP-5 — full-doc overlay** (M5-03): client-side only; data path
   (card primary_quote offsets) confirmed complete. Sonnet worktree →
   Fable review.
2. **WP-6 — reports UI + run_reports migration** (M5-05): Ben OK'd the
   table. Deliver migration SQL for Ben + UI reading run_reports.

## Queued behind those (order)

3. **WP-3 — normalizer badges** (M4-02): read-path provenance display;
   provenance already written at ingest.
4. **WP-4 — M4-01 delta** (~20% remaining).
5. **WP-7 — demo dry-run CI gate** (M5-06): prod DB + staging tags,
   staging-invisibility assertion + idempotent teardown (Fable
   recommendation, standing unless Ben objects).
6. **Span-residual triage** — 482 genuine under-coverage sections;
   Dyax §5.1 80k mega-section boundary defect; then enforcement flag →
   coverage gate 95→98. Resolves #10 (QXO bring-down tiers) and the
   Redfin 92% fixture. Fable verification still owed on agent claim
   that Redfin/QXO stored TEXT is already whole (feature- vs
   text-level loss).
7. **r3 data repairs (dry-runs delivered, NOT applied)** —
   scripts/cleanup-fragment-definitions.js (junk list entries); termf
   trigger recode (optional). Side-finding: Theravance 52/57
   definition rows have defined_term=NULL — needs its own fix.
8. **Recitals-as-deal-facts** extraction addition (Ben-approved).
9. **Proration depth** — real cap values via defined-term extraction;
   2 deals affected.
10. **F3 materialized snapshots** for /api/home cold-load (7.8s → target
   sub-second).

## Security close-out (2026-07-18/19)

- RLS lockdown: DONE — Ben ran supabase/rls-lockdown-2026-07.sql;
  service-role access verified (12,403 cards readable).
- JWT rotation: MOOT — legacy JWT keys were platform-disabled
  2026-04-20; production runs on sb_publishable_/sb_secret_ keys.
  Do NOT replace Vercel env vars with JWT-format keys.
- Compute upgrade: deferred by Ben.

## Ben's open items (his side)

- [ ] Feedback on deployed production (post-#261 deploy)
- [ ] Run the run_reports migration SQL when WP-6 delivers it
- [ ] Endeavor proposed-codes curation session (~30 min, 112 codes +
      hellOrHighWater claims-vs-features disagreement)
- [ ] Compute upgrade (deferred, his call on timing)

## Standing rules

- Watchdog protocol: spec-first → cheap production → Fable diff-review →
  mechanical gates (tests/build/ingest-qa/eval) → live verification.
- Never merge unreviewed delegate output. Data fixes must persist at
  ingest, not just backfill. Dry-run before every corpus write.
- DB concurrency 1 for agent sweeps (post Disk IO incident).
- Treat agent completion notifications as claims, not facts — verify
  state (DB/git) before acting on them.
- Deferred/not-planned: M5-04 admin-queue polish; #12 structured-claims
  store rework (layers on span accounting; includes moving full_text
  out of deals.metadata for Disk IO); #13 enforcement phase; #14
  party-token lint; coverage-gate tightening until span baseline clean.
