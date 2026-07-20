# PLAN — single source of truth for what happens next

Maintained by Fable; updated as items land. Last update: 2026-07-20
(post PR #286: wave-3 QA fixes + r13 round merged and deployed).
Historical program detail lives in the docs it shipped with
(docs/reports/PHASE-5-REPORT-2026-07-18.md for the corpus program;
HANDOFF-REEXTRACT.md for the coordinated re-extract). This file is the
live state: where we are, what finalizes the current push, and whose
move each item is.

## Where we are (shipped and live)

- Corpus program Phases 0–5 COMPLETE (40 deals, claims layer, canonical
  cards, QA gates). Demo of 2026-07-20 shipped on PRs #258–#283.
- 2026-07-19/20 session (PRs #284–#286 + branch commits through
  c828ac1), all merged to main and deployed:
  - IOC party attribution is evidence-only (Heinz/Kraft inversion,
    Zymeworks mutual band, ENDRA fixed); band-order guessing removed.
  - NOSOL title rule guarded against employee/proxy solicitation titles.
  - IOC restrictionComponents tagger rewritten precision-first
    (exception-tail + false-friend false positives; ~214 bad tags across
    27 decks identified). CODE fixed; DATA restamp pending (Ben, below).
  - Query surface: correct control shapes on first paint; "No
    Solicitation" legal-English labels; results toolbar/stat formatting;
    NOSOL cross-cut grouped under legal headings; % of deal value on
    market-range (percent-basis distribution + per-deal column);
    pick-a-deal flow fixed for compare/deal-to-market.
  - Review page: See provision on IOC exception rows; empty "Specific
    restrictions" suppressed; mislabeled §1.01 chapeau rows excluded;
    sidebar distinguishes uncomparable rows from genuine coverage gaps;
    fee rows show % of deal value (extracted percent wins);
    expense-reimbursement rows show when they carry a real cap.
  - "…" truncation removed corpus-wide (full text stays reachable via
    See provision / hover); bare stored edge-ellipses stripped at render.
  - Robustness: 15s fetch timeouts + retry on market/compare; friendly
    errors for bad links and upstream 522s; maxDuration caps on heavy
    API routes; /api/corpus-version content-fingerprint endpoint with
    week-long version-keyed edge caching on corpus-stats.

## In flight (agent-side, this session)

- [ ] Corpus-stats batch endpoint (one claims fetch for all section
      codes — kills deal-to-market's N-scan fan-out), `&v=` cache-token
      client wiring, featureKeys threading for termination-rights/
      conditions rows. Under review; merges as the next PR.

## Ben gates — what finalizes this push (in priority order)

- [ ] **Restamp IOC restriction pills** (5 min, deterministic, no AI):
      `node scripts/restamp-ioc-restrictions.js` (dry run, prints the
      per-deal diff) then `--apply`. Fixes the wrong "Specific
      restrictions" pills stored by the old tagger. Note: a full
      `reprocess.js --types IOC` is NOT needed and wouldn't overwrite
      existing tags anyway.
- [ ] **Supabase SQL block** (dashboard, one-time): two claims indexes
      (kills the corpus-stats full scans behind the 10x compute spike),
      created_at probe indexes, and updated_at touch-triggers so
      in-place corrections bump the cache version. Full statements in
      pages/api/corpus-version.js's header comment.
- [ ] **Claims sync** (dry-run-gated): `node
      scripts/sync-claims-to-provisions.js` — makes ~10 claims-layer
      fields queryable (forceTheVoteType hard/soft/none, fiduciary-out
      standard, matching period, cure days, …). Check
      reports/query-field-conflicts.md before extending the field list.
- [ ] Per-deal data corrections from reports/query-field-conflicts.md
      (antitrust effortsStandard 10 deals, governingLaw 11 deals).
- [ ] Class-4 boolean codebook decisions: interveningEvent,
      informationSharing, appraisalRights — which get graded codebooks
      (like FTV hard/soft/none) vs stay boolean. Legal-judgment call.
- [ ] Key-alias decisions: fiduciaryOutStandard vs
      fiduciaryEngageStandard / matchingPeriod vs
      subsequentMatchingPeriod — semantically distinct or alias?
- [ ] Feedback rounds on deployed production as batches land.

## Next re-extract punchlist (fold into the next corpus write)

Canonical copy here; HANDOFF-REEXTRACT.md carries the same list for the
re-extract session's context.

1. Intervening-event quote-capture window: stored
   interveningEventDefinition/scope/exceptions/termination quotes are
   fixed-length excerpts with literal edge "…" — widen the window so
   full definitions are stored (render layer already strips the edge
   ellipsis, but the text is genuinely truncated).
2. IOC taxonomy gap: IOC_CATEGORY_META has no DIVIDENDS/ISSUANCE/
   SPLITS/CHARTER families, so those rows carry no self-family tag
   (safe but uninformative post-restamp). Decide: extend the taxonomy
   with self-family codes, or accept suppressed pills. Fable-tier call.
3. Cosmetic (optional): IOC limb-title rubric ranks retain-officers
   above preserve-organization — 5 compound limbs title by their
   secondary duty.
4. Backfill section_ref repair for the Heinz/Kraft §5.02/§5.03 chapeau
   cards mislabeled "1.01 | General / Preamble" (display-side exclusion
   already shipped; the stored refs are still wrong).

## Deferred / backlog (unchanged priorities)

- Deal-to-market saved-search persistence (query_cache table) — needs a
  small Ben-side migration; edge caching + batching land first, then
  judge whether it's still needed.
- Scope-granular cache invalidation (per-buyer/sector version probes) —
  only if ingestion becomes daily-or-faster; global version is enough
  at current corpus-change frequency.
- Security client-auth story (branch wp/api-auth-middleware — Ben picks
  Vercel-protection / session / BFF); numeric backfill (blocked on
  Ben's canonical_numeric column); Endeavor proposed-codes curation
  (112 codes); render-parity audit tool merge; #12 structured-claims
  store rework; #13 enforcement phase; #14 party-token lint.
- Compute upgrade: deferred by Ben (indexes above likely make it moot).

## Standing rules

- Watchdog protocol: spec-first → cheap production → Fable diff-review →
  mechanical gates (tests/build/ingest-qa/eval) → live verification.
- Never merge unreviewed delegate output. Data fixes must persist at
  ingest, not just backfill. Dry-run before every corpus write.
- Fingerprint-lint caveat: INVARIANT-4 diffs HEAD^1..HEAD, so it is
  BLIND to uncommitted files — run scripts/lint/forbidden-patterns.sh
  after committing (or expect the exemption-table dance post-commit).
- DB concurrency 1 for agent sweeps; treat agent completion
  notifications as claims, not facts — verify state before acting.
