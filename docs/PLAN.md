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
- PR #262 — WP-5 (full-doc overlay: SourceOverlay + resolve-source-span,
  ?card= deep-link; 5/5 verbatim gate, 10/400 unresolved = pre-existing
  Redfin/Noble elision defects) + WP-6 (run_reports writer fail-soft,
  /admin/reports UI, ingest-qa --json; review-caught fix: ingest-worker
  handleQa boolean-return QA-gate bypass). KEY FINDING: primary_quote
  offsets are region-relative, not absolute — plan doc was wrong;
  resolver validates before trusting.
- PR #263 — WP-4 (decided_by actor, claim_ids linkage, _meta.version
  bump on every reconcile decision) + WP-3 (normalizer _prov badges on
  query cells; alias fixture; CSV isolation). KEY FINDING: no reliable
  provisions→provision_cards join exists (region_id spaces disjoint,
  hash join matches nothing) — extraction_version renders "—" until
  #12 lands.

## Roadmap to demo-ready (2026-07-19, Ben away window)

Wave 1 — in flight now (each: agent → Fable review → merge → deploy):
1. r4 render fixes (9 items: material contracts, MAE labels, fonts,
   election/proration, equity shapes, knowledge dedupe, IOC thresholds,
   NOSOL pills, two-step merger from transaction_steps).
2. Query redesign (chrome parity, section order, natural-language
   filters, fonts, perf) + QueryLaunchBox component.
3. Render-parity audit tool (Class A wrong-card / Class B
   structured-but-unrendered; calibrated on 4 known bugs).
4. Review-page speed investigation (Fable): measure → quick wins vs
   structural (deferred provision payloads, ISR like the index).
5. WP-7 green run #2 → final review → PR with matcher fix.

Wave 2 — sequenced behind wave 1 merges:
6. Index integration: QueryLaunchBox embed + drop "Deals (40)/visible".
7. Sidebar row-granularity: rowFocus (click PSU row → PSU-only sidebar),
   wire reps/MAE/IOC/conditions families, empty-state sidebar on load,
   see-provision as full-width colspan row.
8. Columns package: law firms (ingest prompt + gate + backfill),
   natural-language merger form, drop Provisions, add termF $/%, RTF,
   outside date, go-shop.
9. Review-page perf implementation per investigation.

Wave 3 — data quality (pipeline runs, QA-gated):
10. NOSOL re-extraction cohort (9 deals; Frontier has zero NOSOL cards)
    + QXO COND-B tiers (#10) + optional equity summary-shape deals.
11. Data hygiene: orphaned election_mechanisms rows, Skechers
    is_prorated=false, zero source_doc_offset_start backfill. NOTE:
    corpus writes may be classifier-blocked → may become Ben-run SQL.
12. Render-parity audit findings triage → fix batch.

Wave 4 — pre-demo: full corpus visual sweep + Fable adversarial audit
(standing rule 6), deploy, live verification.

## Ben gates (his side, in priority order)

- [ ] Run supabase/schema-06-run-reports.sql (2 min — /admin/reports and
      demo-dryrun report rows silently skip until then)
- [ ] B-env decision: make WP-7 CI job required? (currently non-required,
      prod+staging-tag)
- [ ] Possible SQL approvals for wave-3 data-hygiene writes if the
      permission layer blocks agent-side writes again
- [ ] What/when is the demo — affects polish vs data-depth prioritization
- [ ] Endeavor curation session (112 codes; data quality, not blocking)
- [ ] Deployed-site feedback rounds as waves land

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
