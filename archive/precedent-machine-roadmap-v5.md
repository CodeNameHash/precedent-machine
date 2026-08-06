# Precedent Machine — Roadmap v5

**Date:** July 5, 2026 (afternoon)
**Author:** Fable (Perplexity Computer)
**Supersedes:** `precedent-machine-roadmap-v4.md` (July 5, 2026, morning)

## What changed vs v4

- **WP-UX split into two work packages.** v4 had one WP-UX gated on WP-SCHEMA. That was leaving obvious shell-level wins (navigation, header, full-doc exit, long-name overflow, monospace "see text", landing page) on the shelf for two weeks.
  - **WP-UX-SHELL** — design tokens, sidebar rewrite, header rewrite, full-doc-as-overlay, landing grid, long-name handling. **No dependency on WP-SCHEMA.** Runs in parallel with schema-first and ingest work starting immediately.
  - **WP-UX-REVIEW** — provision card redesign, section row redesign, employee benefits per-instrument split, bring-down-quotes-the-actual-bring-down-section. Blocked on WP-SCHEMA landing.
- **Card/row work explicitly deferred.** The provision card gets a root-and-branch rebuild but only after the FeatureDef shape exists. Trying to redesign it now would rework twice.
- **Locked shell-level design decisions** (from Ben's UX review + Fable audit, 8:56–9:10 EDT July 5): sidebar clicks always exit modals and land on long page with anchor scroll + highlight; sidebar labels are provision names (no numbers, no ellipsis); sections collapsed on load with persistence; full-doc is an overlay not a tab; "Filtered" indicator deleted from the review page; monospace font banned outside code; long-name handling is one strategy applied consistently (canonical short forms + tooltip); header is one dense row with buyer/target counsel + value + type + date.
- **Employee benefits card rebuild** locked to stacked per-instrument cards with highlighted source quotes. Scheduled in WP-UX-REVIEW.

## What changed vs v3

v3 buried the highest-value surfaces (cross-cutting query, comparative
suite reports, favorability rankings) behind a small "benchmark cards"
WP, and treated corpus growth as an end-of-roadmap task. Both wrong.

v4 restructures around Ben's actual value model:
- **Cross-cutting queries** ("get me all X representations across the
  corpus, filtered by structure/sector/counsel/value") become their
  own first-class WP.
- **Comparative suite reports** ("pick N deals, generate a memo")
  ship earlier and independently.
- **Buyer/seller favorability** is a toggleable overlay layer with
  transparent per-field contributions, versioned rules, and per-user
  overrides. Never blended into primary data.
- **Corpus growth starts now, in parallel with schema-first.** N=50
  target before schema Phase 3's registry audit. N=100 target before
  UX/query/reports work starts. Continuous ingest runs from week 2.
- **Learning loops** (correction mining, re-extract diff clustering,
  novelty detection, needs-review analytics) become a persistent
  operating layer, not a milestone.

## Ingest model (locked with Ben, 8:40 EDT July 5)

- Codex CLI (highest tier) is the extractor for all new ingest from
  now forward. Effectively unmetered throughput for this workload.
- On July 8+ when Claude subscription refreshes, run a Claude
  quality-parity pass on the newly-ingested deals. Disagreements
  between Claude and Codex on a given field become high-value
  `needs_review` signal AND feed the schema audit as evidence of
  which features have ambiguous canonical shape.
- All provisions tagged `extractedBy: 'claude' | 'codex' | 'both'`
  with per-field agreement metadata for the `'both'` case.

## Sequencing overview

```
week 1        week 2        week 3        week 4        week 5-6
────────────────────────────────────────────────────────────────
WP-SCHEMA P1-2                                                        (schema types + inventory)
  ├─ WP-INGEST-CATALOG                                                (parallel; passive discovery)
  └─ WP-INGEST-SEED-50 ──────                                         (parallel; get to N=50)
              WP-SCHEMA P3-8                                          (registry populated with N=50 signal)
              WP-ROUTE                                                (parallel; direct-link fix)
                            WP-STABLEID                               (stable anchors)
                            WP-INGEST-CONTINUOUS                      (auto-ingest starts; targets N=100)
                                          WP-UX                       (review page redesign)
                                          WP-QUERY                    (cross-cutting search)
                                                      WP-META         (metadata enrichment)
                                                      WP-SCORE        (favorability overlay)
                                                                  WP-REPORTS  (suite reports)
                                                                  WP-BENCH    (benchmark cards)
                                                                  WP-NOVELTY  (outlier watch)
                                                                  WP-LEARN    (correction mining)
                                                                  WP-DOCS     (document families)
                                                                  WP-CORPUS-BACKFILL (deep history)
                                                                  WP-RUNS     (run history UI)
```

Not every WP runs strictly in the order shown — the roadmap allows
Codex to pick the next WP based on prerequisites met. But the top-of-
list dependencies are hard.

## Current state (unchanged from v3)

- 19 deals, Supabase, Vercel prod, `github.com/CodeNameHash/precedent-machine`
- 650 tests, QA gate = 19/19 PASS with 0 unverified quotes
- STRUCT-OFFER schema for tender-offer mechanics landed (WP04B P4)
- PR #93/#94/#95 all merged; per-type reprocess runs full backfills

## Non-goals (through this roadmap)

- No extraction-pipeline rewrite
- No drafting workflows
- No reverse-sync to external systems
- No model-prior "market" answers — all analytics computed from
  stored corpus features with clause citations
- No SPA rewrite

──────────────────────────────────────────────────────────────────────
# WP-SCHEMA — Schema-first feature model

**Status:** Detailed brief written; see `pm-schema-first-migration.codex.md`.

**Adjustment vs v3:** the FeatureDef now includes
`favorabilityDirection`, `favorabilityWeight`, and `favorabilityRule`
fields (patched into the brief on July 5). Phase 3 audit populates
these where meaningful; Phase 3 does NOT need to be complete on
favorability to move forward — that layer is filled in during
WP-SCORE.

**Ingest coordination:** WP-SCHEMA Phase 3 (registry population)
should not begin until WP-INGEST-SEED-50 has landed. The additional
30 deals materially change the pattern signal used to canonicalize
labels, detect orphans, and choose stable-anchor fields.

**Blocks:** WP-STABLEID, WP-UX, WP-QUERY, WP-SCORE, WP-REPORTS,
WP-BENCH, WP-NOVELTY, WP-LEARN, WP-DOCS, WP-RUNS.

**Success criteria** (unchanged from v3):
- `lib/schema/features.js` + `lib/schema/tags.js` as source of truth
- Zero renders of `[object Object]`, raw enums, `Not specified`
- Corpus safety-diff ≤ 1% variance, 0 new unverified quotes
- Benchmark-readiness report identifies features meeting min N

──────────────────────────────────────────────────────────────────────
# WP-INGEST-CATALOG — Passive SEC EDGAR watcher

**Depends on:** none (starts immediately, parallel with WP-SCHEMA P1)
**Branch:** `feat/ingest-catalog-passive-edgar`

## Scope

Stand up a passive candidate-catalog pipeline: monitors EDGAR daily
for new 8-Ks containing merger-agreement exhibits, dedupes, and
stores metadata in a queue table. **This WP does NOT extract
provisions** — that's WP-INGEST-SEED-50 and WP-INGEST-CONTINUOUS.

## Scaffold

**Data:**
- New table `deal_candidates`:
  ```
  id UUID PRIMARY KEY,
  cik TEXT NOT NULL,
  filing_accession TEXT NOT NULL,
  filing_date DATE NOT NULL,
  form_type TEXT NOT NULL,
  filed_by_party TEXT,
  target_name TEXT,
  acquirer_name TEXT,
  deal_value_usd BIGINT,
  announced_at DATE,
  agreement_exhibit_url TEXT,
  agreement_text_hash TEXT NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending', -- pending|queued|ingested|skipped|error
  skip_reason TEXT,
  ingested_deal_id UUID,
  UNIQUE (agreement_text_hash),
  UNIQUE (cik, filing_accession)
  ```
- Index on `filing_date DESC`, `status`, `agreement_text_hash`.

**Discovery script (`scripts/edgar-watch.js`):**
1. Fetch recent 8-K filings from EDGAR full-text search — parameters:
   `type=8-K`, `q="merger agreement" OR "agreement and plan of merger"`,
   filed in the last N days (default 7 for cron; longer for backfill).
2. For each hit: parse the filing index, locate exhibit 2.1 (typical
   merger-agreement exhibit slot), download the exhibit text.
3. Extract metadata heuristically from Item 1.01 of the 8-K (parties,
   deal value, announcement date). This can miss — that's fine, we
   fill from provisions once extracted.
4. Hash the exhibit text (SHA-256 of normalized whitespace-collapsed
   text).
5. Insert into `deal_candidates` with `status='pending'`. Duplicate
   hash = skip.

**Scheduling:**
- Cron: daily at 3 AM ET via existing task-scheduling infra.
- Backfill: one-shot mode (`--since 2024-01-01`) to seed the catalog
  with recent M&A activity.

**Deliverables:**
- Migration file for `deal_candidates`
- `scripts/edgar-watch.js` runnable in daily and backfill modes
- Admin surface at `/admin/candidates` (basic list view, no
  intervention needed for v1 — Codex can query the table directly
  when picking deals for WP-INGEST-SEED-50)
- Cron job scheduled

**Tests:**
- Same 8-K discovered twice: second discovery is a no-op (hash dedupe)
- Malformed filing: caught, logged, `status='error'`, does not stop
  the batch
- Rate limit from EDGAR: exponential backoff, no crash

**Verify gate:**
- Backfill run populates ≥ 200 candidate rows spanning the last
  ~24 months of M&A activity
- Zero duplicate rows by `agreement_text_hash`
- Cron scheduled and runs cleanly overnight (verify by checking
  next-day row count)

**Estimate:** 1 PR, ~500-800 lines + one migration.

──────────────────────────────────────────────────────────────────────
# WP-INGEST-SEED-50 — Expand corpus to N=50 before schema audit

**Depends on:** WP-INGEST-CATALOG (needs the candidate queue)
**Branch:** `feat/ingest-seed-expansion-to-50`
**Extractor:** Codex CLI (subscription-inclusive, highest tier)

## Scope

Ingest ~30-35 new deals from the candidate catalog, bringing the
corpus from 19 to ~50 deals. Selected to maximize schema-audit signal:
- Diverse structures (one-step long-form AND tender offers)
- Diverse sectors (life sci, tech, industrials, financials, energy)
- Diverse sizes ($1B – $50B range)
- Diverse counsel (Wachtell, Sullivan Cromwell, Simpson Thacher,
  Skadden, etc.)
- Both recent (2024-2026) and historical (2018-2023) to test
  temporal drafting drift

## Scaffold

**Selection algorithm (`scripts/select-seed-deals.js`):**
- Query `deal_candidates` where `status='pending'`
- Score each candidate by: sector diversity (relative to current
  corpus), structure diversity, size distribution match, counsel
  diversity (if known)
- Select top N (default 32) that maximize marginal diversity
- Present the list; require Codex to log the selection rationale
  before batch ingest

**Ingest orchestrator (`scripts/batch-ingest.js`):**
- Reads candidate list, iterates
- For each candidate:
  1. Create `deals` row + `documents` row (merger_agreement kind if
     WP-DOCS has landed, else legacy single-doc mode)
  2. Run existing `scripts/ingest-local.js` extractor via Codex CLI
     with `EXTRACTOR=codex` env var (add if missing)
  3. Tag every resulting provision with `ai_metadata.extractedBy: 'codex'`
     and `ai_metadata.extractionModel: 'gpt-5.5'`
  4. Run `ingest-qa.js` for THIS deal only; if unverified quotes > 0
     or duplicates > 0, mark deal `status='needs_review'` in `deal_candidates`
- Concurrency: cap at 3 concurrent extractions (Codex CLI throughput
  is fine but Supabase writes need to serialize on shared tables)
- Progress dashboard: write per-deal status to
  `docs/ingest/seed-50-YYYY-MM-DD.md` as it runs
- **Quota handling**: reuse the `.quota` sentinel pattern from
  codex_runner_v2 — if a rate limit hits, pause the batch, requeue
  after cooldown (~30 min), resume from last incomplete deal
- Idempotency: batch can be re-run safely; skips already-ingested
  candidates

**Post-batch tasks:**
- Regenerate `ingest-qa --all`; corpus at N=50 should still be
  clean (0 unverified quotes for CLEAN deals; `needs_review` deals
  quarantined)
- Update `HANDOFF.md` with new N, per-deal QA summary
- Write `docs/ingest/seed-50-summary.md`: what was added, sector/
  structure/counsel distribution, extractor agreement stats (once
  Claude parity pass runs on July 8+, this doc gets appended)

**Claude parity pass (`scripts/claude-parity-pass.js`, run July 8+):**
- For each Codex-extracted deal, run the same extractor with
  `EXTRACTOR=claude`
- Store Claude output in `provisions_parity` shadow table (same
  schema as `provisions` + `run_id`)
- Compute per-field agreement rate; tag disagreements as
  `needs_review` in the primary `provisions` table with a
  `parity_disagreement` flag
- Do NOT overwrite Codex extractions — the primary table stays as
  Codex; Claude is a shadow QA signal
- Produce `docs/ingest/parity-report.md`: fields with lowest
  agreement rate → highest priority for schema audit + prompt
  refinement

## Ordering with WP-SCHEMA

- WP-SCHEMA Phase 1 (inventory) can run in parallel with the ingest
  batch — inventory operates on rubric/taxonomy files, not corpus data
- **WP-SCHEMA Phase 3 (registry population) waits until seed-50
  ingest completes**, so the audit uses N=50 signal
- Phase 3 audit incorporates parity-report findings when they exist
  (July 8+)

**Verify gate:**
- Corpus at ≥ 50 deals
- Every ingested deal either PASSES `ingest-qa` or is quarantined
  `needs_review` in `deal_candidates`
- Selection rationale documented
- Batch is fully idempotent (re-run produces 0 new writes)

**Estimate:** 1-2 PRs (batch orchestrator + parity harness),
~1,200-1,800 lines. Wall time: 3-5 days of overnight runs to hit N=50.

──────────────────────────────────────────────────────────────────────
# WP-ROUTE — Direct-link routing (unchanged from v3)

Content unchanged from v3. Runs in parallel with WP-SCHEMA and
WP-INGEST-SEED-50 — pure Next.js routing work, no cross-dependency.

──────────────────────────────────────────────────────────────────────
# WP-STABLEID — Stable provision anchors (unchanged from v3)

Content unchanged. Runs after WP-SCHEMA Phase 3 (needs stableAnchor
flag on FeatureDef).

──────────────────────────────────────────────────────────────────────
# WP-INGEST-CONTINUOUS — Auto-ingest new candidates

**Depends on:** WP-INGEST-CATALOG, WP-INGEST-SEED-50 (harness reuse),
WP-SCHEMA (validation gates), WP-STABLEID (anchor computation)
**Branch:** `feat/ingest-continuous-auto`

## Scope

Turn the daily EDGAR watcher into an auto-ingest pipeline. Any new
candidate passes through: dedupe → extract (Codex) → QA → novelty
check → auto-add-if-clean or queue-for-review-if-flagged.

## Scaffold

**Daily job (extends WP-INGEST-CATALOG's cron):**
1. Fetch new candidates (already discovered by watcher)
2. For each `status='pending'`:
   a. Extract via Codex CLI (same harness as seed-50 batch)
   b. Run `ingest-qa` for the deal
   c. Run novelty check (WP-NOVELTY dependency; skip if not yet
      landed, add gate check)
   d. If QA passes AND novelty flag count ≤ 3 fields: auto-promote
      to `provisions` table; `status='ingested'`
   e. If QA passes AND novelty flags > 3: `status='needs_review'`
      with details in `deal_candidates.review_notes`
   f. If QA fails: `status='error'` with error details
3. Weekly parity pass (Wednesdays overnight): Claude re-extract of
   the week's new deals; disagreements → `needs_review` at field level
4. Notification: daily summary to Ben's in-app notification: "3
   new deals ingested cleanly, 1 queued for review, 0 errors" with
   links

**Admin queue UI:**
- `/admin/candidates?status=needs_review` — list, per-row: preview,
  novelty flags, disagreement fields, "approve" / "reject" / "edit"
  buttons

**Backpressure:**
- If `needs_review` queue exceeds 10, pause auto-ingest and switch
  to catalog-only mode until queue drained. Prevents drowning in
  quality issues.

**Verify gate:**
- Daily cron runs cleanly for 5 consecutive days
- Auto-ingest success rate ≥ 80% on candidates that pass initial
  8-K structure heuristics (measured over 30 days)
- Zero corruption events (no partial-write states)

**Estimate:** 1-2 PRs, ~1,500-2,200 lines.

──────────────────────────────────────────────────────────────────────
# WP-CORPUS-BACKFILL — Deep historical corpus

**Depends on:** WP-INGEST-CONTINUOUS
**Branch:** `feat/corpus-backfill-historical`

## Scope

Once continuous ingest is stable, work the candidate catalog backward
through history in prioritized batches. Target: 500-1000 deals across
the last decade.

## Scaffold

**Prioritization tiers:**
- Tier 1 (immediate): 2020-2026 large-cap ($5B+) — ~100 deals
- Tier 2 (next): 2020-2026 mid-cap ($1-5B) — ~200 deals
- Tier 3 (later): 2015-2020 large-cap — ~150 deals
- Tier 4 (fill): 2010-2015 large-cap + full mid-cap 2015-2020 — ~250 deals
- Tier 5 (comprehensive): everything else in the catalog

Each tier is a batch. Ben approves tier initiation; batch runs
overnight; QA report next morning.

**Batch harness:** reuses WP-INGEST-SEED-50 orchestrator with tier
selection instead of diversity-maximizing selection.

**Cost/time:** Tier 1 at highest Codex tier = ~4-8 hours of extraction,
free within subscription, ~$0 wall cost. Each subsequent tier same
mechanics.

**Verify gate per tier:**
- Tier's target deal count reached
- ≥ 90% first-pass QA success
- Novelty flags reviewed within 48 hours

**Estimate:** small orchestration WP; the WORK is running the batches.
Codex can manage this autonomously with the harness from earlier WPs.

──────────────────────────────────────────────────────────────────────
# WP-UX-SHELL — Design system + navigation + header + full-doc overlay

**Depends on:** nothing
**Blocks:** WP-UX-REVIEW, WP-QUERY UI polish, WP-REPORTS UI polish
**Branch:** `feat/ux-shell`
**Runs:** in parallel with WP-SCHEMA and WP-INGEST-SEED-50, starting immediately.
**Brief:** `pm-wp-ux-shell.codex.md` (self-contained, Codex-app-runnable).

## What ships

- `lib/design/tokens.ts` — 5-size type scale, 2 font families (editorial + sans, monospace banned outside code/diff), semantic colour tokens, 8-value spacing scale, 4-value radii, 2-value motion durations. Single source of truth. Tailwind config extends from it. No raw hex outside tokens.
- `pages/design/index.tsx` — dev-only Storybook-lite route showing every token and primitive with its usage rule and stories.
- `lib/design/lint/no-context-in-body.ts` — custom ESLint rule enforcing the invariant: context lives in the frame, data lives in the body. Fires if shell components render section-number-like identifiers.
- New sidebar: two-level (category → provision name), no section numbers, no ellipsis truncation, duplicate labels disambiguated at data-prep time via `disambiguateSidebarLabels()`. Categories collapsible with persistence. Click behaviour: always exits any open overlay, scrolls target section to top with 2s highlight, updates URL hash without a route change. `/` focuses sidebar search.
- New review header: single dense row on desktop. Display type line: `<Acquirer> → <Target>`. Meta strip: value, structural type, signing date, buyer counsel firm, target counsel firm. Everything else (financial advisors, governing law, forum, effective time) drops to a "More" popover. `EDIT MODE` hidden unless `?edit=1`. Header height cap: 96px desktop.
- Long-name handling: canonical short-form dictionary (`lib/design/data/party-short-forms.json`) applied when a deal name exceeds 44 chars in the display; full names appear in a subtitle. Nav chrome and breadcrumb truncate to a hard character budget with tooltip on hover. Ellipsis truncation banned in sidebar labels.
- Full-doc as an overlay: right-anchored slide-over, deep-linkable via `?doc=<sectionAnchor>`, dismissable via Esc / backdrop / large explicit close button. All existing "see in document" links open the overlay. The `Full Document` tab is deleted. Old `?tab=full` URL redirects.
- "Filtered" indicator, `All provisions 310` sidebar top item, and monospace "see text" font treatment all deleted (Phase 7 delete-legacy, requires explicit user authorization to run).
- Landing page becomes a grid: deal-list table demoted to one tile; empty tiles stubbed for WP-QUERY, WP-REPORTS, WP-NOVELTY, WP-SCORE (each labelled "coming in <WP>").
- Sections on the review page: all collapsed on load, sticky Expand-all / Collapse-all control, per-deal persistence in localStorage.

## What this WP does NOT touch

- The provision card (`components/review/ProvisionCard*`, `FeatureRow*`, `components/features/**`). That's WP-UX-REVIEW.
- Any file under `lib/features/**`, `lib/rubric/**`, `lib/taxonomy/**`. That's WP-SCHEMA.
- Ingest, extraction, API routes.
- Font pass on card content.

## Exit criteria

- PR + CI + squash, zero quote flags, ingest QA green.
- `/design` route renders every primitive in dev.
- Sidebar, header, full-doc overlay, landing grid all verified on Metsera and IBM/Red Hat.
- Lighthouse a11y ≥ 95 on `/design`, `/`, and `/review/<uuid>` for both deals.
- No new runtime dependencies.
- No `Full Document` tab, no `Filtered` indicator, no `All provisions 310`, no monospace "see text" anywhere in `/review/[dealId]` DOM.

───────────────────────────────────────────────────────────────────
# WP-UX-REVIEW — Provision card + section row rebuild

**Depends on:** WP-SCHEMA AND WP-UX-SHELL
**Blocks:** nothing directly, but its output is what makes WP-QUERY / WP-REPORTS visibly good.
**Branch:** `feat/ux-review`

## What ships

- **Provision card, rebuilt.** Fields kept: (a) key data extracted — thresholds, qualifiers, MAE, bring-down standard, exceptions; (b) verbatim quote from THIS section; (c) bring-down quote from the ACTUAL bring-down section (not this section); (d) Fable-chosen minimum context (deal name in overlay top bar only, since header + sidebar already carry section number and name). Fields deleted: cross references, schedule references, `SECTION NUMBER` field (redundant with header + sidebar + breadcrumb), `PROVISION` all-caps label heading, monospace treatments. Card fields consumed via FeatureDef only — no `rubric.js` / `category-summary-features.js` reads.
- **Summary text is falsifiable.** The "summary" slot on each card must be either the insight statement ("800M authorised, 105.3M outstanding, MAE-qualified bring-down, no poison pill") or the delta statement ("Standard cap-structure rep with MAE bring-down, no unusual carve-outs"). Never a run-on restatement of the section title. This is enforced by a schema-first FeatureDef requiring a `summaryPattern` field on every FeatureDef, of type `'insight' | 'delta'`, with a validator that rejects summaries longer than 30 words or without a numeric or standard-name anchor.
- **Bring-down quotes bind to the bring-down section.** When a FeatureDef has a `bringDownStandard` property, the card fetches and renders the quote from the section stableId referenced by `bringDownStandard.sourceSectionAnchor`, not from the current section. Enforced at data-prep, not display.
- **Employee benefits card rebuilt.** Per-instrument stacked cards (Options, RSUs, PSUs, ESPP, plus any instrument present in the target's capital stack). Each stacked card shows: treatment mechanic (cash-out at deal price / assumed by buyer / cashed at deal price minus exercise / etc.), vesting acceleration terms (single-trigger / double-trigger / none / partial), highlighted source quote from the merger agreement clause justifying it. Buyer-comparability verdict shown as a derived signal chip, not primary data. Instruments not present in the deal are hidden entirely, not shown as empty.
- **Section header carries reserved slots** for WP-SCORE favorability lean chip (empty when WP-SCORE hasn't shipped) and WP-LEARN changes-since-last-review badge (empty until WP-LEARN starts). Reservation prevents rework when those WPs land.
- **Font pass on card content.** Card body consumes `body` and `caption` tokens only. Quote blocks get a distinct treatment (indented, editorial family, weight 400, italic optional) but stay on the type scale.
- **`no-context-in-body` lint rule extended** to fire in `components/review/**`, closing the invariant across the whole app.

## Exit criteria

- Every card field consumed via FeatureDef.
- No `rubric.js` or `category-summary-features.js` imports in card components.
- Every bring-down quote resolves to a different section stableId than the section being viewed.
- Employee benefits card renders per-instrument on at least three test deals with different capital structures.
- Manual review by Ben on Metsera §3.02, Employee Benefits section, and one tender-offer deal.
- All the standard gates.


──────────────────────────────────────────────────────────────────────
# WP-QUERY — Cross-cutting query surface

**Depends on:** WP-SCHEMA, WP-STABLEID
**Branch:** `feat/cross-cutting-query`

## Problem

Right now the corpus is browseable one deal at a time. Ben's actual
workflow: "get me all X representations across the corpus" — for
example, every REP-T:Cybersecurity clause, every NOSOL:Matching-
Rights notice period, every ANTI:HellOrHighWater clause. Currently
possible only via ad-hoc Supabase queries.

## Scope

First-class "provisions view" that treats provisions across deals as
the primary object, with rich filtering, faceting, and comparison.

## Scaffold

**Data:** no schema changes — reads from existing `provisions` table
via schema registry.

**UI:** new page `/provisions`:

- Left rail: faceted filters
  - Provision type (STRUCT, CONSID, REP-T, REP-B, IOC, NOSOL, ANTI,
    COND-M, COND-B, COND-S, TERMR, TERMB) as a hierarchy
  - Within type: canonical code (e.g. REP-T:Cybersecurity)
  - Deal filters: structure (one-step / two-step), sector, deal
    value range, announcement year, acquirer counsel, target counsel
  - Feature filters (dynamic based on registry): every feature with
    a numeric or enum type gets a range/select filter (e.g.
    "outsideDateMonths ≥ 6" or "effortsStandard = HELL_OR_HIGH_WATER")

- Center: results as a comparative table
  - One row per matching provision, one column per key feature +
    evidence quote + deal chip
  - Sort by any feature
  - Density toggle: compact | comfortable | source-heavy (adds
    full quote column)

- Right rail: preview pane
  - Click a row → full provision detail with source quote,
    annotations, other provisions from same deal in the same displayGroup

- Top bar: "Save this view" (persists filter state per user) and
  "Open as suite report" (hands off to WP-REPORTS)

**Query API:** `pages/api/provisions/search.js`:
```
POST /api/provisions/search
{
  types: ["REP-T"],
  codes: ["REP-T:Cybersecurity"],
  dealFilters: {
    structure: ["ONE_STEP_LONG_FORM"],
    valueRangeUsd: [1e9, 50e9],
    sectors: ["Life Sciences", "Technology"]
  },
  featureFilters: [
    { key: "materialityQualifier", op: "in", values: ["MATERIAL_ADVERSE_EFFECT"] }
  ],
  sort: { feature: "outsideDateMonths", direction: "desc" },
  limit: 200,
  offset: 0
}
```
Response: `{ provisions: [...], totalCount, facets: {...} }` where
facets give per-filter available values + counts for progressive
disclosure.

**Performance:**
- Postgres full-text index on `provisions.text` (already may exist)
- Composite indexes on `(provision_type, canonical_code)` and
  `(deal_id, provision_type)` (add if missing)
- Feature filters use JSONB path operators; add expression indexes
  on the top 20 most-benchmarkable features
- Target: p95 query latency ≤ 500ms at N=500 deals

**Saved queries:**
- `saved_queries` table: `id, user_id, name, filter_json, created_at`
- Basic CRUD endpoints
- Sidebar in `/provisions` lists user's saved queries

**Tests:**
- Every faceted filter returns correct count
- Sort direction correct on numeric + enum + date fields
- Query with 5 filters chained runs under 500ms at current corpus size
- Saved query round-trips

**Verify gate:**
- All 12 provision types filterable
- At least 30 feature filters usable
- p95 ≤ 500ms at N ≥ 50 deals

**Estimate:** 2 PRs (API + UI), ~2,500-3,500 lines.

──────────────────────────────────────────────────────────────────────
# WP-META — Metadata enrichment (unchanged from v3)

Content unchanged. Note: consumed by WP-QUERY as deal-level filters
and by WP-REPORTS for deal-selection facets.

──────────────────────────────────────────────────────────────────────
# WP-SCORE — Buyer/seller favorability overlay

**Depends on:** WP-SCHEMA (favorability fields on FeatureDef),
WP-QUERY (for ranking surface)
**Branch:** `feat/favorability-overlay`

## Constraint from Ben (locked, 8:37 EDT July 5)

**The scoring layer is a toggleable overlay. It never blends into
primary data render. It is transparent (every score shows field-level
contributions), inspectable (every rule visible), overridable
(per-user weight/rule adjustments), and versioned (so ranking
history is preserved when rules change).**

The layer is likely to be wrong at the start. Design assumes wrong-
ness and prioritizes trust-through-transparency, not accuracy.

## Scope

For every deal, compute:
- Overall buyer favorability score (0-100 or z-score)
- Overall seller favorability score (0-100 or z-score)
- Per-family scores across the standard families:
  - Deal certainty
  - Termination economics
  - Fiduciary out
  - Regulatory / antitrust
  - Structure & closing mechanics
  - Consideration
  - Risk allocation
  - Interim covenants
- Every score shows contributing fields with their signed
  contribution

## Scaffold

**Data:**
- `lib/schema/favorability-weights.js` — versioned rule module,
  editable independently of `features.js`:
  ```
  const RULES = {
    version: 'v1.0.0',
    updated_at: '2026-07-10',
    updated_by: 'ben',
    fields: {
      'terminationFeePercentEquityValue': {
        direction: 'buyer',       // higher = worse for target
        weight: 4,
        curve: 'linear_percent',
        // for values 0.5% - 4.5%, score maps 0 - 100
        params: { pctLow: 0.005, pctHigh: 0.045 }
      },
      'reverseTerminationFeePercentEquityValue': {
        direction: 'seller',      // higher = better for target
        weight: 3,
        curve: 'linear_percent',
        params: { pctLow: 0.01, pctHigh: 0.08 }
      },
      'effortsStandard': {
        direction: 'seller',
        weight: 5,
        curve: 'enum_map',
        params: {
          'HELL_OR_HIGH_WATER': 100,
          'REASONABLE_BEST_EFFORTS_PLUS_DIVEST_CAP': 70,
          'REASONABLE_BEST_EFFORTS': 40,
          'COMMERCIALLY_REASONABLE_EFFORTS': 10
        }
      },
      // ...
    },
    familyWeights: {
      deal_certainty: 3,
      termination_economics: 2,
      fiduciary_out: 2,
      regulatory: 2,
      structure: 1,
      consideration: 1,
      risk_allocation: 1,
      interim_covenants: 1
    }
  };
  ```
- `favorability_score_runs` table (versioned):
  `id, rule_version, deal_id, computed_at, buyer_score, seller_score,
  family_scores JSONB, field_contributions JSONB`
- Recompute triggered on: (a) rule version change, (b) provision
  extraction for the deal, (c) manual admin recompute

**Overlay UI:**
- Global toggle in top nav: "Favorability overlay: OFF | ON"
- OFF by default. Never on for anonymous / first-time users.
- When ON:
  - Deal cards on home page + `/review` index show buyer + seller
    score chips
  - Individual review pages show a scoring panel (collapsible, off
    by default) with family breakdown and field contributions
  - `/provisions` results table gains sortable buyer/seller score
    columns
  - New page `/rankings`:
    - Best deals for buyer / worst deals for buyer
    - Best deals for seller / worst deals for seller
    - Per-family rankings
    - Filterable by structure, sector, size (uses WP-QUERY filter
      framework)
    - Every ranking row shows the top 3 contributing fields (why is
      this deal ranked here)

**Transparency requirements:**
- Every score chip is clickable → drill-down modal showing every
  field's contribution
- Every rule is inspectable via `/admin/favorability-rules`
- Rule changes are versioned; ranking pages show `Rules: v1.2.0
  (updated 2026-08-15)` and link to `/admin/favorability-rules/history`
- Users can save "my rules" (a fork of the current version with
  weight tweaks); their ranking view uses their rules
- Field-level "override this contribution for this deal" for
  situations where a rule is clearly wrong on a specific fact
  pattern

**Data invariants:**
- Primary `provisions` table never has any favorability field
- The overlay reads from `favorability_score_runs` and joins at
  query time
- Turning the overlay OFF returns the app to the primary-data-only
  render — no residual visual noise

**Tests:**
- Every scoring rule has a positive and negative test case
- Score computation deterministic for the same inputs + rule version
- Overlay toggle actually disables all overlay rendering (grep-test
  the rendered HTML)
- Rule version change: prior score run preserved, new run computed
- Per-user override: user A's ranking differs from user B's after
  A applies a custom weight

**Verify gate:**
- ≥ 20 rules in the initial rule set covering all 8 families
- Ranking page functional for 4 dimensions (buyer-best, buyer-worst,
  seller-best, seller-worst)
- Overlay-off state is bit-for-bit identical to no-overlay
- Rule-history log shows every rule change

**Estimate:** 2 PRs (rules engine + overlay UI + rankings page),
~2,500-3,500 lines.

──────────────────────────────────────────────────────────────────────
# WP-REPORTS — Suite reports

**Depends on:** WP-SCHEMA, WP-QUERY, WP-META (for filter facets),
optionally WP-SCORE (for favorability annotations)
**Branch:** `feat/suite-reports`

## Scope

Pick a suite of deals (2-50); generate a comparative report. Two
linked views per report: comparative-table and prose-memo.

## Scaffold

**Data:**
- `reports` table: `id, user_id, title, deal_ids UUID[], filter_json
  JSONB, template TEXT, generated_at, generation_run_id`
- `report_versions` table: preserves every generation so a report
  can be re-generated later with newer data + newer schema without
  losing the prior version
- Reports live under `/reports/<id>`; comparative-table and memo
  are TABS within the report page

**Report generation flow:**

1. **Deal selection.**
   - From `/provisions` filter → "Open as suite report" (deal set =
     unique deals in current filter)
   - From `/review` index → multi-select checkboxes → "Report on N deals"
   - From `/rankings` → "Report on top 10 buyer-favorable deals"
   - Manual: `/reports/new` → filter/search + add-to-suite chips
2. **Template selection.** Default template: 8 sections matching
   the displayGroup hierarchy. Alternative templates (v1.1): "buy-
   side memo", "sell-side memo", "regulatory-heavy memo" — each
   varies section order and emphasis.
3. **Generate.**
   - **Comparative-table view.** For each section (displayGroup),
     a table: one row per key feature, one column per deal. Cells
     show the feature value (formatted via schema formatter) + hover-
     revealed quote. Cells that are unusual (2σ from suite median
     or corpus median) are visually flagged.
   - **Prose-memo view.** For each section, generate a lawyer-style
     synthesis paragraph via LLM (Codex) with a strict schema-
     grounded prompt:
     - Input: JSON of every deal's feature values for this section,
       plus corpus median for context
     - Prompt: "Write a 2-4 paragraph summary of how these N deals
       compare on <section>. Reference specific deals by name.
       Every specific fact you state must be citable to a feature
       value provided in the JSON. Do NOT invent facts. Do NOT
       reference market practice outside this suite."
     - Output: prose + inline citation markers matching feature keys
   - **Linked navigation.** Every cell in comparative-table links to
     the source provision on the source deal's review page. Every
     citation marker in prose-memo links to the same. Every citation
     also shows the verbatim quote inline (popover).
4. **Sanity gate.** Before saving the report, an LLM QA step verifies
   every prose factual claim resolves to a citation in the provided
   JSON. Any unresolved claim triggers regeneration of that paragraph
   with a stricter prompt. Two failed regenerations → paragraph
   dropped, note added: "Insufficient citations — regenerate manually".

**Export:**
- PDF: table + memo, print-styled
- DOCX: for lawyer editing
- Markdown: for internal notes

**Versioning:**
- Editing rules-of-the-suite (adding/removing deals) creates a new
  version, prior version preserved
- Re-running against fresher extraction data creates a new version
- Diff view: "what changed between v1 and v2" — added/removed deals,
  changed feature values, changed prose paragraphs

**Tests:**
- Suite of 3 deals produces a report with all 8 sections populated
- Every prose citation resolves to a real feature value
- QA gate catches an intentionally-hallucinated fact (via a fixture
  test)
- Export round-trip: PDF/DOCX/MD all render cleanly

**Verify gate:**
- Report generation for 5-deal suite completes in < 60 seconds
- Zero uncited factual claims across 10 generated test reports
- PDF export renders correctly for 20-page reports

**Estimate:** 2 PRs (generator + UI), ~3,000-4,000 lines.

──────────────────────────────────────────────────────────────────────
# WP-BENCH — Benchmark cards (scope-reduced from v3)

**Depends on:** WP-SCHEMA, WP-QUERY (uses same query engine)
**Branch:** `feat/benchmarks-cards-v1`

## Scope reduction

In v3 this was the marquee feature. It's now a smaller supporting
surface — WP-QUERY and WP-REPORTS carry the primary value. Benchmarks
are shipped as inline "market context" chips on the review page and
as a `/benchmarks` grid.

**No changes to schema or data model.** Reads via WP-QUERY's search
API with `groupBy: 'feature'` mode.

**Content is unchanged from v3's WP-BENCH:**
- 3 families to start (termination economics, deal certainty,
  fiduciary out)
- Every card cites deals; min-N gating; source-clause links

**Estimate:** 1 PR, ~800-1,200 lines (smaller because it rides on
WP-QUERY's API and rendering).

──────────────────────────────────────────────────────────────────────
# WP-NOVELTY — Novelty detection and outlier watch

**Depends on:** WP-SCHEMA, WP-QUERY, ideally N ≥ 40
**Branch:** `feat/novelty-detection`

## Problem (Codex's audit brief, explicit)

"KEY ISSUE - we need to be better at flagging stuff that is new and
could be a problem"

## Scope

At ingest time and on demand: for every extracted feature value,
compare against the corpus distribution and flag if 2σ from median
(numeric) or ≤ 15% frequency (enum). Persistent surface tracks
outlier deals over time as corpus grows and median shifts.

## Scaffold

**At-ingest-time novelty check:**
- Extends WP-INGEST-CONTINUOUS pipeline
- For every extracted provision on the new deal:
  - For each feature with `benchmarkable: true`:
    - Fetch corpus distribution for that feature (excluding new deal)
    - If numeric: compare against median ± 2σ
    - If enum: check frequency of that value in corpus
    - If deemed unusual: record `provisions.ai_metadata.novelty_flags[]`
      with reason and reference to comparable deals
- Aggregate: if new deal has > 3 novelty flags, WP-INGEST-CONTINUOUS
  routes it to `needs_review`

**Persistent outlier watch UI:**
- `/outliers` — list of deals with novelty flags
- Filter by feature, deal, sector, structure, year
- Every entry links to the source provision + median comparable
- **Retroactive re-check**: as corpus grows and median shifts, a
  weekly cron re-evaluates all outlier flags. Some become no-longer-
  outliers (corpus caught up); some remain outliers (persistent
  unusual pattern); some new-outliers emerge (retroactive flag).
  Track state transitions.

**"Precedent alert" feature:**
- User can subscribe to "notify me if any new deal has X unusual
  feature" — e.g., "notify me if any deal has a naked-no-vote fee
  > 3%"
- Delivered via existing notification infra
- Subscriptions stored in a small table

**Tests:**
- Insert a synthetic deal with clearly outlier values; assert novelty
  flags fire correctly
- Corpus grows past a threshold; re-check downgrades a formerly-
  outlier value
- Subscription notification fires on matching new ingest

**Verify gate:**
- At N ≥ 50, novelty flags fire on at least 5 deals with plausible
  reasons
- Zero false-positive spam (median deals have 0 novelty flags)
- Outlier state transitions logged correctly over a 2-week window

**Estimate:** 1-2 PRs, ~1,500-2,200 lines.

──────────────────────────────────────────────────────────────────────
# WP-LEARN — Iterative learning loops

**Depends on:** WP-SCHEMA, WP-STABLEID, WP-INGEST-CONTINUOUS, ≥ N=40
**Branch:** `feat/learning-loops`

## Scope

Four persistent operating layers that treat every human touch on the
system as training signal:

### Layer 1: Correction mining

- Every correction on a provision is already logged with the field
  that was corrected and the before/after values (existing corrections
  table)
- New nightly cron: cluster corrections by (feature_key, before_pattern,
  after_pattern). Any cluster with ≥ 5 similar corrections across ≥ 3
  deals = candidate systematic extractor bug
- Output: weekly `docs/learn/systematic-bugs.md` report ranking
  candidates by cluster size. Each candidate links to the corrections.
- Codex reads this report weekly and files WP-BUG-XX briefs to fix
  the top items.

### Layer 2: Re-extract diff clustering

- When a new prompt version or extractor code change rolls out, run
  the modified extractor against all deals in dry-run
- Cluster diffs by (feature_key, direction_of_change) — did this
  change ADD a field to N deals? REMOVE it? MOVE it?
- Any cluster with impact on ≥ 10 deals gets flagged for review
  before the change is applied to live data
- Prevents silent data drift on prompt tweaks

### Layer 3: Needs-review analytics

- `whenEmpty: 'needs_review'` provisions are Codex-audit-flagged;
  `parity_disagreement: true` provisions are Codex-vs-Claude
  disagreement flags
- Aggregate weekly: top 10 features by needs_review count → priority
  fields for schema audit or prompt refinement
- Feed into schema Phase 3 audit as a "which features are known
  problematic" input

### Layer 4: Novelty state history

- Track novelty flags as they emerge and resolve over time (from
  WP-NOVELTY's retroactive re-check)
- Publish a monthly "corpus market drift" report: which fields have
  median values that have shifted materially over the last N months
- Basis for a future "trend detection" feature

## Scaffold

- All four layers are cron-driven, produce Markdown reports in
  `docs/learn/`
- Weekly summary notification to Ben
- No UI in v1 beyond the reports (add drilldown UI in a future WP if
  useful)

**Verify gate:**
- All four cron jobs scheduled and running
- Systematic-bugs report identifies at least 2 candidate clusters
  after 4 weeks of operation
- Re-extract diff clustering catches a synthetic-injection change
  (fixture test)

**Estimate:** 1 PR, ~1,200-1,800 lines.

──────────────────────────────────────────────────────────────────────
# WP-DOCS — Document families (unchanged from v3)

Content unchanged.

──────────────────────────────────────────────────────────────────────
# WP-RUNS — Run history + safe re-extract UI (unchanged from v3)

Content unchanged.

──────────────────────────────────────────────────────────────────────
# Long horizon (v4-post)

Once WP-QUERY, WP-SCORE, WP-REPORTS, WP-NOVELTY, and WP-LEARN are
live and the corpus is at 200-500 deals:

- **Search v2** — semantic + faceted + saved queries + subscriptions
- **Comparison workbench** — deep 2-N deal side-by-side view with
  clause-level alignment, distinct from suite reports
- **Change log per provision** — timeline of amendments +
  re-extract runs
- **Lawyer QA harness** — ground-truth question set, run periodically
- **Amendment tracking** — as new amendments file for deals in the
  corpus, auto-detect and link to the parent merger agreement
- **Cross-corpus drafting suggestions** — for drafters: given a
  clause type and target favorability profile, retrieve the closest
  precedent clauses from the corpus with citations. **Only after all
  the above is stable and lawyer-validated.**

──────────────────────────────────────────────────────────────────────
# Hand-off protocol (for Codex)

If Ben is unavailable, WPs run in the sequence at the top of this
file. Every WP is executable in the Codex desktop app with no further
guidance:

1. Open the WP's brief (start with schema-first at
   `pm-schema-first-migration.codex.md`). For WPs without a separate
   brief file, use this roadmap's WP section as the brief and expand
   as needed.
2. Follow Discovery → Implement → Verify → Commit → PR for each phase.
3. Never merge to main without CI green + `npm test` + QA gate.
4. On any phase failure, STOP and leave a plain-English summary.
5. Between WPs, append a completion summary to `HANDOFF.md` in the
   repo root: date, WP name, PRs, notable data changes, follow-ups.

## Ingest-model invariants

- All new deals extracted by Codex CLI (highest tier)
- All Codex-extracted deals in the last N days get a Claude parity
  pass on the next Wednesday overnight cron; disagreements flagged
- Provisions tagged with `extractedBy` and `extractionModel`
- Parity disagreements populate `needs_review` and feed WP-LEARN

## Data invariants (unchanged)

- Branch → PR → CI green → squash merge; never push main
- Verbatim-only quote repairs; correction rows per repair
- QA gate = `ingest-qa --all` = ALL PASS with 0 unverified quotes,
  0 duplicates
- `.env.local` = `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Codex CLI plan-locked to gpt-5.5, reasoning=high
- Corrections + annotations survive re-extract via stable anchors

## Favorability invariants (locked with Ben 8:37 EDT July 5)

- Overlay is OFF by default; user must toggle ON
- Overlay never blends into primary data render
- Every score is inspectable (drill down to field contributions)
- Rules are versioned; ranking history preserved across rule changes
- Users can fork rules (per-user overrides)
- Field-level override supported for demonstrably-wrong rule outputs
- Turning overlay OFF produces bit-for-bit identical render to no-overlay

## Escalation

If any WP's Discovery reveals assumptions above are broken (codebase
moved, ingest infra changed, etc.), STOP and write a plain-English
summary. Do not re-plan silently.
