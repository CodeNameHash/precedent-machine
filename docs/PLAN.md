# PLAN — single source of truth for what happens next

Maintained by Fable; updated as items land. Last update: 2026-07-20
(post PR #300: r18 unified compare/market + sidebar redesign + both
codebooks merged and deployed). Historical program detail lives in the
docs it shipped with; this file is the live state.

## Where we are (shipped and live through PR #300)

- Corpus program Phases 0–5 complete; 40 deals live.
- 2026-07-19/20 mega-session (PRs #284–#300): IOC party attribution
  evidence-only; restrictionComponents tagger precision-first + DATA
  RESTAMPED (Ben, verified); NOSOL title guard; query surface redesigned
  end to end (plain-English kinds, typeahead picking, show-all mode, FTV
  hard/soft live); % of deal value + relative-period (months-before-
  signing) comparison bases; unified compare tables (band-agnostic IOC
  matching, definitions, scroll sync, names-only masthead); deal-vs-
  market as a synthetic MARKET column; sidebar redesigned with
  deal-counted, rep-scoped distributions, favorability-ordered variants,
  numeric scales, working hide toggle; election mechanics verified
  per-deal and rendered as table rows with unelided quotes; zero inline
  raw dumps corpus-wide; content-versioned corpus caching + Supabase
  indexes/triggers (Ben ran the SQL — cold corpus-stats 90s+ → 4s);
  claims sync + FTV backfill applied (Ben, verified); intervening-event
  and information-sharing codebooks implemented with reviewed
  classification tables embedded in delivery scripts.

## Ben gates — open items on your side (priority order)

- [ ] **Run the two codebook scripts** (deployed, dry-run-gated):
      `node scripts/code-intervening-event.js` → review diff → `--apply`
      (11 deals; 2 positive-only, both GA); then
      `node scripts/code-information-sharing.js` → `--apply` (36 deals,
      5 fields).
- [ ] **Classify re-run for the four mass-null deals** (r16 P0 — the
      biggest remaining false-"Not extracted" source in compare):
      `node scripts/reprocess.js --deal Summit --classify-only` (dry,
      then `--apply`); repeat for Catalent, Juniper, ENDRA. AI-assisted
      for uncached sections (subscription CLI, uses plan quota).
- [ ] **Canonicalize the two true-duplicate codes** (decision 1B data
      half): `node scripts/canonicalize-duplicate-codes.js` → `--apply`
      (REP-T-CONTRACTS→REP-T-MATERIAL-CONTRACTS, COV-PAYAGENT→
      CONSID-EXCHANGE). Display union already live, so no urgency.
- [ ] Per-deal data corrections from reports/query-field-conflicts.md
      (antitrust effortsStandard 10 deals, governingLaw 11 deals).
- [ ] Gilead/Pharmasset cards cache/serve check (deck missing from the
      corpus-cards pull; production serves it — verify and re-pull).

## DECIDED (implemented; kept for the record)

- Decision 1: taxonomy splits → option B (row-family display union
  live; data canonicalization script for the 2 true duplicates above).
- Decision 2: intervening event = positive-only / positive-or-negative /
  none + exceptions family (Ben's grades); information sharing =
  multi-field (grade + copiesScope + bidderIdentity + ongoingUpdates +
  engagementNotice); appraisal codebook (AVAILABLE / NOT_AVAILABLE /
  SILENT) approved but NOT yet implemented — next build round.
- Decision 3: no key aliasing; clarified registry labels shipped.

## Next build round (agent-side, queued)

1. Appraisal-rights codebook implementation (approved shape; same
   delivery-script pattern; corpus evidence already gathered in the r16
   audit — Heinz §2.01(c), ENDRA §3.5 express no-appraisal language).
2. Market-column numeric cells: extend /api/corpus-stats-batch with the
   numeric percentile distributions (corpus-stats-core already computes
   them) and wire off-market markers into the OffMarketSection feed.
3. Nosol table configs carry hardcoded row labels — align with the
   clarified registry labels where the context warrants.

## Next re-extract punchlist (fold into the next corpus write)

1. Intervening-event quote-capture window (edge-truncated definitions)
   + the 15 decks with an IE provision but NO stored definition text
   (needed to grade them; script currently skips with reasons).
2. Mid-quote elision in mechanics capture (QXO proration case; render-
   side unelide shipped, data should converge).
3. Skechers stored-quote truncations: fiduciaryFinalStandard headless
   fragment; DEF-SUPERIOR mislabeled + 164-char cut.
4. r16 P0 — Quikrete/Summit fee economics ($279M fee, triggers,
   12-month tail, sole-remedy in §11.04 — none extracted).
5. r16 P1 — Heinz/Kraft equity-award treatment (§6.04) as CONSID-EQUITY;
   ENDRA CoR/match-right machinery out of COV-MEETING fold-in.
6. r16 P2 — appraisal fold-ins (Heinz §2.01(c), ENDRA §3.5 flag);
   mis-familied cards (ENDRA §7.3, Heinz litigation/listing/publicity);
   Heinz chapeau section_ref repair ("1.01 | General / Preamble").
7. short_title sentinel drift corpus-wide ('Unclassified' vs
   '[PROPOSED] Unclassified', 475 cards) — standardize at ingestion
   (render side accepts both since r18).
8. Recurring fold-in pattern (proxy-in-meeting, jury-in-jurisdiction,
   appraisal-in-conversion) — extraction-prompt revision candidate.
9. IOC taxonomy gap (no DIVIDENDS/ISSUANCE/SPLITS/CHARTER self-family
   codes — suppressed pills accepted for now); IOC limb-title rubric
   rule-order cosmetic (5 compound limbs).
10. HireRight + GD/CSRA receipt-notice paragraphs and Bain/Envestnet
    receipt notice absent from stored text (information-sharing
    UNRESOLVED deals).

## Deferred / backlog (unchanged)

- Deal-to-market saved-search persistence (query_cache table) — judge
  need after the batch+edge caching beds in.
- Scope-granular cache invalidation — only if ingestion becomes
  daily-or-faster.
- Security client-auth story (branch wp/api-auth-middleware — Ben
  picks); numeric backfill (canonical_numeric column); Endeavor
  proposed-codes curation (112 codes); render-parity audit tool; #12
  structured-claims rework; #13 enforcement; #14 party-token lint.

## Standing rules

- Watchdog protocol: spec-first → cheap production → Fable diff-review →
  mechanical gates → live verification. Never merge unreviewed delegate
  output. Dry-run before every corpus write.
- Fingerprint-lint caveat: INVARIANT-4 diffs HEAD^1..HEAD — blind to
  uncommitted files; run it post-commit or expect the exemption dance.
- Agents must NEVER `git stash` on the shared worktree (two incidents,
  2026-07-20; recovery cost real work). Treat completion notifications
  as claims — verify state before acting.
