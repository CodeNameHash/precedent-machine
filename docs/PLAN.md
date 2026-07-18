# PLAN — single source of truth for what happens next

Maintained by Fable; updated as items land. Last update: 2026-07-18
(post route-swap merge to main, PR #258). Corpus program (Phases 0–5)
is COMPLETE — see docs/reports/PHASE-5-REPORT-2026-07-18.md.

## Now in flight (Fable investigations → spec → Sonnet implementation)

1. **Review-page feedback round 3** — 10 items (outside-date placement,
   closing/effective-time brevity, column-width system incl. phone,
   masthead degradation rule, QXO PSU/RSU duplicate rows, NOSOL
   repetition, parent-approvals dump, see-provision left-column move,
   termination-trigger repeats, MAE carve-out mouseover shows item
   extract not definition head). Output:
   docs/handoffs/UI-FEEDBACK-R3-SPEC-*.md → implementation package(s).
2. **Deals index overhaul** — real-buyer naming (shell→parent, e.g.
   Beach→3G), parties dedupe, full dates, no empty value/type,
   public/private column, header-based filter/sort, user-editable
   columns (law firms/lawyers), remove query examples, load-time
   profiling, .mtx conformance. HARD RULE: every data fix ships BOTH
   corpus backfill AND the ingest-pipeline change + ingest-qa gate so
   future deals can't regress. Output: docs/handoffs/DEALS-INDEX-SPEC-*.md.
3. **M4/M5 reconciled plan** — query surface + demo polish, reshaped per
   Ben: M4-03 (20 demo queries correct) → M4-04 (query UI on .mtx) →
   M4-02 (normalizer badges); M5 keeps full-doc overlay, reports UI,
   demo dry-run CI gate; drops tokens/landing-grid (superseded); defers
   admin-queue polish. Output: docs/handoffs/M4-M5-RECONCILED-PLAN-*.md
   incl. the 20 demo queries.

## Queued behind those (order)

4. **Security batch** — Piece 1: Fable writes supabase/rls-lockdown SQL +
   verifies no client-side reads of post-Jul-2 tables → Ben runs SQL
   (2 min, no downtime). Piece 2: legacy JWT rotation — Ben live,
   ~10-min window, brief outage (rotate → paste new anon+service keys
   into Vercel → redeploy; Fable verifies before/after). DO BEFORE DEMO.
5. **Span-accounting merge** — worktree delivered (Parts 1–2 + baseline;
   3,360 sections, 952 flagged incl. ~470 retroactive noise; NEW finding:
   Dyax §5.1 80k mega-section boundary defect). Fable review → merge →
   triage the 482 genuine under-coverage flags → enforcement flag on →
   coverage gate 95→98. Also resolves: QXO bring-down tiers (#10,
   feature-level loss), Redfin 92% (partly locate artifact — verify),
   quote repetition-loop/elision flags (12 remaining, 0 hallucinated).
6. **Implementation waves from specs 1–3** (Sonnet agents, Fable
   diff-review each): review-page fixes → index UI + data backfill
   packages → M4-03 executors → M5-03 overlay + M5-05 reports UI →
   M4-04 query UI → M4-02 badges → M5-06 demo dry-run CI gate.
7. **Recitals-as-deal-facts** extraction addition (Ben-approved).
8. **Proration depth** — real cap values (Maximum Cash Election Number,
   aggregate pools) via defined-term extraction; 2 deals affected.

## Ben's open items (his side)

- [x] EDITOR_KEYS + corrections migration (done, redeploying)
- [ ] Feedback on deployed production Mergertrace
- [ ] Security Piece 1: run RLS SQL when Fable clears it
- [ ] Security Piece 2: name a 10-min window
- [ ] Endeavor proposed-codes curation session (~30 min, 112 codes)
- [ ] M4-03 will surface canonical-field decisions (est. 3–6 approvals)

## Standing rules

- Watchdog protocol: spec-first → cheap production → Fable diff-review →
  mechanical gates (tests/build/ingest-qa/eval) → live verification.
- Never merge unreviewed delegate output. Data fixes must persist at
  ingest, not just backfill. Dry-run before every corpus write.
- Deferred/not-planned: M5-04 admin-queue polish; #12 structured-claims
  store rework (layers on span accounting); coverage-gate tightening
  until span baseline is clean.
