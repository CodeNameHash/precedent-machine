# Precedent Machine — Project Handoff

This document is the complete handoff for a new Claude session (or human collaborator)
working on the Precedent Machine. Read this before making changes.

## What this is

A Next.js web app for **M&A lawyers** that parses merger agreements, classifies provisions
into canonical rubric codes, extracts structured features, and presents them for
cross-deal comparison.

- **Live**: https://precedent-machine.vercel.app
- **Repo**: `codenamehash/precedent-machine` (GitHub, public)
- **Stack**: Next.js 14.2 Pages Router · Supabase (Postgres + RLS) · Anthropic API (Claude Sonnet 4) · Tailwind CSS
- **Vercel project**: `precedent-machine` on team `codenamehashs-projects`
  (project ID `prj_pseZ68ISXsxADzNcffHTO2NuGM8b`, team ID `team_Zu8dnrxhP3FY0BcfOZtQ4z71`)

## Workflow conventions

- Work on a fresh branch from `origin/main`.
- Open a PR, wait for CI to pass, then squash merge. Do not push directly to `main`.
- `main` auto-deploys to production via Vercel git integration.
- Run the focused tests for the touched surface, then `npm test`, before opening a PR.
- Commit messages: imperative mood + 1-3 line body explaining *why*.

## Current status as of 2026-07-05

- Production `main`: `98c61bd` (`feat(ingest): add passive EDGAR candidate catalog`), deployed green on Vercel.
- Live smoke checks after merge: `/`, `/review`, and `/admin/candidates` all returned HTTP 200.
- Corpus remains 19 deals. `node scripts/ingest-qa.js --all` passed 19/19 with 0 unverified quotes and 0 duplicate clauses after the latest ingest-catalog work.
- Recent merged work:
  - PR #100: WP04 P5 per-type extraction parity follow-ups.
  - PR #101: WP-SCHEMA P1 feature-key inventory and drift audit.
  - PR #102: WP-SCHEMA P2 empty schema registry, formatters, and empty-state policy.
  - PR #103: WP-INGEST-CATALOG passive EDGAR watcher, `deal_candidates` SQL, `/admin/candidates`, cron route, dry-run/backfill CLI.
- WP-INGEST-CATALOG operational follow-ups:
  - Apply `supabase/deal-candidates-schema.sql` in Supabase. Codex could not apply it directly because only Supabase URL/service-role env vars were available locally, not a Postgres migration URL.
  - Run the catalogue backfill, for example `node scripts/edgar-watch.js --since 2024-01-01`, after SQL is applied. Do not run this before the table exists.
  - Verify at least 200 candidate rows, zero duplicate `agreement_text_hash` rows, and the next overnight cron run.
- Current sequencing:
  - WP-SCHEMA Phase 3 is blocked until WP-INGEST-SEED-50 lands.
  - WP-INGEST-SEED-50 is blocked until `deal_candidates` exists and is populated.
  - WP-UX-SHELL has no dependency and can start now from `pm-wp-ux-shell.codex.md`.
  - WP-ROUTE can also run in parallel if needed.

## Repo layout (the important bits)

```
lib/
  rubric.js                   # SOURCE OF TRUTH: 240+ canonical codes, FEATURES schemas, aliases
  taxonomy.js                 # Canonical code dictionaries (EXCEPTION_CODES, MATERIALITY_CODES,
                              #   CONSENT_STANDARDS, EFFORTS_STANDARDS, EQUITY_*, COMP_*, etc.)
                              #   + taxonomyForFeatureKey(key) lookup
  supabase.js                 # Server-side Supabase client (uses SUPABASE_SERVICE_ROLE_KEY)
  useSupabaseData.js          # React hooks (useDeals, useDeal, useProvisions, useAnnotations)
  edgar-cleanup.js            # EDGAR text cleanup helpers (smart quotes, page numbers, etc.)
  parser-v2/
    index.js                  # (no-op; pipeline is orchestrated from segment-v2.js)
    structural.js             # Phase 1: regex section/article splitting + displayCleanText()
    classify.js               # Phase 2: AI section classification w/ article context
    extract.js                # Phase 3: AI sub-provision extraction (Strategies A/B/C/D)
                              #   + canonical code enforcement + auto-merge + bring-down writeback
    validate.js               # Phase 4: rubric validation + coverage check
    store.js                  # Phase 5: atomic storage to provisions + deals.metadata
    format-renderer.js        # Parses [[ARTICLE]] / [[SECTION]] / [[REF]] markers for the Full Doc view

pages/
  index.js                    # Legacy SPA (public/spa.js) — kept around but not the live UX
  review/[id].js              # **THE MAIN UX**. Large page shell backed by components/review/*
  review/index.js             # Review index listing deals
  api/
    deals.js                  # GET/POST/PATCH/DELETE deals
    provisions.js             # GET/POST/PATCH/DELETE provisions + auto-log corrections on PATCH
    annotations.js            # GET/POST/PATCH annotations (per-provision character ranges)
    corrections.js            # Learning Phase 1: POST log, GET list, GET ?summary aggregates
    agreement-source.js       # GET agreement text from deals.metadata.full_text
    ingest/
      segment-v2.js           # THE INGEST API. POST /api/ingest/segment-v2 — full pipeline
      segment.js              # Legacy v1 parser (don't use)
      agreement.js            # Legacy parser entry (don't use)
    admin/
      reprocess-cond.js       # Re-extract COND provisions for a single deal (legacy)

components/
  Layout.js                   # Top bar (Recital wordmark + breadcrumb + user avatar) + side nav
  UI.js                       # Shared bits: Breadcrumbs, SkeletonCard, EmptyState, AIBadge

styles/
  globals.css                 # Recital design tokens + .rec-* component classes
tailwind.config.js            # Color/font/radius tokens map to CSS custom props

supabase/
  schema.sql                  # Full schema (idempotent CREATE TABLE)
  corrections-schema.sql      # corrections table (run separately)
  ai-metadata-schema.sql      # ALTER TABLE provisions ADD COLUMN ai_metadata (run separately)

scripts/
  ingest-agreements.js        # Batch ingestion script (legacy, stale deal IDs)

HANDOFF.md                    # ← this file
RUBRIC.md                     # Markdown spec of the canonical rubric (human-readable)
SETUP.md                      # Setup walkthrough for new clones
```

## Pipeline (read this to understand the system)

```
POST /api/ingest/segment-v2
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Phase 1: structural.js                                            │
│   cleanText() → parseStructure() → { sections, articles }         │
│   Also: displayCleanText() — aggressive cleanup for UI display    │
│   (adds [[ARTICLE]]/[[SECTION]]/[[TOC]]/[[REF]] markers)          │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Phase 2: classify.js                                              │
│   1. classifyArticle(title) → article-level type (REP-T, COND…)  │
│   2. tryDeterministic(section, articleType) — regex section rules │
│      + article-level fallback (e.g. COND article party detection) │
│   3. Remaining ambiguous sections → Claude in batches of 30       │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Phase 3: extract.js                                               │
│   Four extraction strategies dispatched by provision type:        │
│   A: regex split (a)/(b)/(c) + AI classify per sub-clause         │
│      → IOC, COND-M/B/S, TERMR/-M/-B/-T                            │
│   B: AI multi-code extraction with overlap                        │
│      → NOSOL, ANTI, TERMF                                         │
│   C: section-level AI per type                                    │
│      → REP-T, REP-B, COV, MISC, OTHER, STRUCT (mostly)            │
│   D: regex "TERM" means + AI per-definition classification        │
│      → DEF (incl. inline definitions in other sections)           │
│   Plus post-processors:                                           │
│   - splitIocPreamble() → "Affirmative Covenants" + "General Exc"  │
│   - expandConsidEquityByInstrument() → one row per instrument     │
│   - linkBringDownToReps() → stamp REP-T/REP-B w/ tier-derived     │
│     bring-down standard from COND-B-REP / COND-S-REP tiers        │
│   - sortDefinitionsAlphabetically()                               │
│   - backfillSectionLeftovers() → emit SECTION-LEFTOVER for any    │
│     uncovered run >50 chars per section (100% text coverage)      │
│   - enforceCanonicalCodes() → every provision gets a valid code   │
│     from rubric.js OR isNewCode flag + proposed code              │
│   - consolidateProposedCodes() → auto-merge similar codes via AI  │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Phase 4: validate.js                                              │
│   - Check every code is in rubric.js                              │
│   - Text coverage % (warn if <95%)                                │
│   - Duplicate detection                                           │
│   - Universal coverage gaps                                       │
│   - Report uncoded / auto-merged / pending new codes              │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Phase 5: store.js                                                 │
│   1. Delete all existing provisions + annotations for deal_id     │
│   2. Update deals.metadata with { full_text, agreement_title }    │
│   3. Batch insert provisions; per-row fallback if batch fails     │
│   ai_metadata JSONB column stores { code, features,               │
│      relatedDefinitions, isNewCode, proposedCode, ... }           │
└──────────────────────────────────────────────────────────────────┘
```

Total time: ~3-5 min per agreement (depends on size + AI batches).

## The Rubric system

`lib/rubric.js` is the **single source of truth** for what's a valid provision.

```js
PROVISION_TYPES  // 16 types: STRUCT, CONSID, REP-T, REP-B, IOC, NOSOL, ANTI,
                 //   COND-M, COND-B, COND-S, COND, TERMR, TERMR-M, TERMR-B,
                 //   TERMR-T, TERMF, COV, DEF, MISC, OTHER
                 // (NOSOL and ANTI have classificationMode: 'multi')

CODES            // 240+ flat keyed object: 'IOC-DEBT', 'COND-M-LEGAL',
                 //   'TERMR-OUTSIDE', 'DEF-MAE', etc.
                 // Each: { type, label, description, aliases[], frequency, industries[] }

FEATURES         // Per-type schema (sometimes per-code) of extractable features.
                 // Each feature has key, label, type (text|boolean|currency|
                 //   percentage|duration|enum|list|tagged|list-tagged|tiers),
                 //   sometimes scope ('preamble' | 'clause'), sometimes source.

// Helpers
getCodesForType(typeKey)
isValidCode(code)
findCodeByAlias(alias)
getTypeLabel(typeKey)
getFeaturesForType(typeKey)
getFeaturesForCode(code)
```

**Display labels in the UI come from the rubric, NOT from the AI's free text.**
The category column showed in tables maps from the canonical code's label.
The AI's original category text is preserved as `sourceCategory` for traceability.

## The Taxonomy system

`lib/taxonomy.js` defines canonical short-codes for VALUES inside features (not
provisions themselves). These are how we make cross-deal comparison work.

Dictionaries:
- `EXCEPTION_CODES` — `WHOLLY_OWNED_SUB`, `ORDINARY_COURSE`, `REQUIRED_BY_LAW`, etc.
- `MATERIALITY_CODES` — `MAT_ALL_RESPECTS`, `MAT_MAE_QUALIFIED`, `MAT_ALL_MATERIAL`,
  `MAT_ALL_RESPECTS_DE_MINIMIS`, etc.
- `CONSENT_STANDARDS` — `PRIOR_WRITTEN`, `NOT_UNREASONABLY_WITHHELD`, `SOLE_DISCRETION`
- `EFFORTS_STANDARDS` — `REASONABLE_BEST_EFFORTS`, `HELL_OR_HIGH_WATER`, etc.
- `EQUITY_INSTRUMENTS` — `STOCK_OPTIONS`, `RSUs`, `PSUs`, `ESPP`, `RESTRICTED_STOCK`, etc.
- `EQUITY_TREATMENT` — `CASHED_OUT_AT_CONSIDERATION`, `ACCELERATED_VESTING`, etc.
- `VESTING_STATUS` — `FULLY_ACCELERATED`, `DOUBLE_TRIGGER_ACCEL`, etc.
- `COMP_STANDARDS` — `NO_LESS_FAVORABLE`, `SUBSTANTIALLY_SIMILAR`, `IN_THE_AGGREGATE`, etc.
- `COMP_ITEMS` — `BASE_SALARY`, `TARGET_BONUS`, `HEALTH_WELFARE`, etc.
- `TERMINATION_PARTY` — `PARTY_MUTUAL`, `PARTY_BUYER`, `PARTY_TARGET`
- `APPLIES_TO_PARTY` — `PARTY_PARENT`, `PARTY_COMPANY`, `PARTY_MUTUAL`
- `ANTITRUST_CONTROL` — `CONTROL_PARENT`, `CONTROL_COMPANY`, `CONTROL_SHARED`, `CONTROL_SILENT`

`taxonomyForFeatureKey(featureKey)` returns the right dictionary for that feature.

**Tagged-item shape**: `{ code, label, text }` where code is the canonical taxonomy
code, label is the human-readable canonical phrase, and text is the verbatim source.
List-tagged items are arrays of these. The UI's `CodeBadge` component renders the
humanized code as a chip.

## The Recital design system

We rebranded the review page in late development per the design handoff at
`/tmp/recital-design/design_handoff_recital_rebrand/`. Key tokens (in `styles/globals.css`):

- `--paper: #FAFAF9` (app bg)
- `--surface: #FFFFFF` (panels)
- `--ink/-mid/-light/-faint: #1A1A18/...` (text hierarchy)
- `--line / --line-soft: #E8E7E3 / #F1F0EE` (borders)
- `--accent: #1B3FA0` (Paul Weiss royal blue — confirm exact hex with design owner)
- `--accent-deep: #142E78`
- `--buyer / --seller / --neutral: #2F6B43 / #9A3326 / #8A8782`
- Provision-type colors: `--type-struct`, `--type-consid`, ..., `--type-anti`, etc.

Fonts:
- `--font-serif`: Hanken Grotesk (display + body, since "Modern" direction was chosen)
- `--font-sans`: Hanken Grotesk
- `--font-mono`: Spline Sans Mono (labels, refs, counts)

Loaded via `/pages/_document.js` Google Fonts preload.

Component classes (in globals.css): `.rec-card`, `.rec-card-meta`, `.rec-lead`,
`.rec-hero`, `.rec-terms`, `.rec-carveouts`, `.rec-source`, `.rec-type-head`,
`.rec-deal-eyebrow/-title/-meta`, `.rec-tabs/-tab`, `.rec-view-toggle`,
`.rec-side-item`, `.rec-stat-bar`, `.rec-ptable`, `.rec-doc`, etc.

**The card layout puts the structured summary FIRST (the "lead" is a 20px serif
sentence), with raw text demoted behind a `+ Show Full Text` toggle.** This is
deliberate — the old visual had raw text dominating and the summary buried.

## Data model

### Tables (Supabase)

```sql
-- Core
deals
  id uuid PK
  acquirer text
  target text
  value_usd numeric
  announce_date date
  sector text
  metadata jsonb         -- includes full_text + agreement_title since we ditched agreement_sources
  created_at timestamptz

provisions
  id uuid PK
  deal_id uuid FK
  type text                  -- e.g. 'IOC', 'COND-M', 'REP-T'
  category text              -- canonical label from rubric (display category)
  full_text text             -- the provision text
  ai_favorability text       -- 'strong-buyer' | 'mod-buyer' | 'neutral' | 'mod-seller' | 'strong-seller'
  ai_metadata jsonb          -- { code, features, relatedDefinitions, classifiedBy,
                             --   confidence, isNewCode, proposedCode, proposedLabel,
                             --   sourceCategory, autoMergedFrom }
  created_at timestamptz

annotations
  id uuid PK
  provision_id uuid FK
  user_id uuid FK
  phrase text
  start_offset int           -- character offset in provision.full_text
  end_offset int
  favorability text
  note text
  is_ai_generated boolean
  verified_by uuid FK
  overrides_id uuid FK       -- self-ref for override chains
  created_at timestamptz

corrections                  -- LEARNING PHASE 1: every edit logged here
  id uuid PK
  deal_id uuid FK
  provision_id uuid FK
  correction_type text       -- 'type_change' | 'category_change' | 'text_change' |
                             --   'favorability_change' | 'feature_change' | 'multi_change'
  before jsonb               -- snapshot of provision before edit
  after jsonb                -- snapshot after
  context jsonb              -- { original_ai_type, original_ai_category, original_ai_favorability }
  reason text                -- optional user-supplied "why this change?"
  user_id uuid FK
  created_at timestamptz

comments
  id uuid PK
  annotation_id uuid FK
  user_id uuid FK
  body text
  created_at timestamptz

signoffs
  id uuid PK
  entity_type text           -- 'provision' | 'deal' | etc.
  entity_id uuid
  user_id uuid FK
  created_at timestamptz

users
  id uuid PK
  name text
  is_admin boolean
  created_at timestamptz
```

### Tables that DO NOT exist

- `agreement_sources` — was planned but never created. Agreement text lives in
  `deals.metadata.full_text` instead.

## Current corpus

The live corpus has 19 merger-agreement deals across biopharma, technology,
energy, consumer, financial services, real estate, grocery retail, hospitality,
food and beverage, automotive, and healthcare. Review pages are available at:

- https://precedent-machine.vercel.app/review

Representative current review URLs:

- https://precedent-machine.vercel.app/review/885edae5-49e8-464a-9f33-edd229119d7c — Pfizer / Metsera
- https://precedent-machine.vercel.app/review/320a3899-0d74-42d6-a412-3a962997d6ca — Lilly / Verve
- https://precedent-machine.vercel.app/review/af4940e1-a645-437c-acfa-4a53e8d9f7ac — Beach / Skechers

## Current trust layer

- Quote verification exists in `lib/verification.js` and is exercised by
  `scripts/ingest-qa.js`; the current corpus gate is 0 unverified quotes.
- Coverage accounting and section-leftover backfills exist in the parser and
  QA gate. Coverage is a pipeline/QA capability, not yet a polished review-page
  product surface.
- Run history exists in `deals.metadata.extraction_runs`, with diff helpers in
  `lib/run-history.js` and `scripts/diff-runs.js`. It is not yet a first-class
  table or UI.
- Human corrections are logged and re-applied for per-type reprocesses via
  `lib/parser-v2/reapply-corrections.js`.
- RLS lockdown was applied to production on 2026-07-02; see
  `supabase/lockdown-rls.sql`.
- Tender-offer mechanics are covered by `STRUCT-OFFER`; Verve, CSRA, Bioverativ,
  and Pharmasset classify without non-tender collateral.

## Open issues / known limitations

1. **Stable provision identity is not solved.** Provision IDs still churn on
   re-extract. Corrections can be re-applied, but durable permalinks and
   annotation identity need a stronger anchor model.

2. **Document families are not modelled.** A deal is still primarily one merger
   agreement, even though real matters include CVR agreements, disclosure-letter
   excerpts, tender-offer materials, and amendments.

3. **The ingest pipeline needs a real job runner.** Per-type runs have run
   history and dry-run support, but full ingestion still lacks queue-backed
   resumability, progress UI, retry controls, and per-step cost/timing tracking.

4. **Feature schemas are better but not fully single-source.** `rubric.js`,
   `taxonomy.js`, validation, extraction prompts, and UI renderers are closer
   than before, but feature shape and rendering are not generated from one typed
   schema.

5. **Metadata and analytics are thin.** Deal value is populated, but consideration
   split, premium, structure, parties' counsel, industry taxonomy, benchmarks,
   saved screens, and outlier flagging remain the next product layer.

6. **Review UX needs expert audit.** The core data is much stronger than the old
   roadmap described, but review-page hierarchy, hover behaviour, card/detail
   paths, canonical labels, and duplicate/wordy rows need a dedicated pass before
   building benchmarks.

## Common tasks

### Trigger a re-ingest

```bash
# Pull agreement text from EDGAR (example: Lilly/Verve)
curl -A "research@example.com" \
  "https://www.sec.gov/Archives/edgar/data/1840574/000119312525141748/d30505dex21.htm" \
  -o /tmp/agreement.htm

# Convert HTML to text (any stripper works; we use a Python one-liner)

# Ingest
python3 -c "
import json
with open('/tmp/agreement.txt') as f: text = f.read()
payload = {
  'deal_id': '<deal-uuid>',
  'full_text': text,
  'title': '<deal title>',
  'source_url': '<edgar url>',
  'preview': False
}
with open('/tmp/payload.json','w') as f: json.dump(payload, f)
"

curl -X POST "https://precedent-machine.vercel.app/api/ingest/segment-v2" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json \
  --max-time 800 \
  -o /tmp/result.json
```

### Inspect what got extracted

```bash
curl -s "https://precedent-machine.vercel.app/api/provisions?deal_id=<uuid>" \
  | python3 -c "
import json,sys
provs = json.load(sys.stdin)['provisions']
types = {}
for p in provs: types[p['type']] = types.get(p['type'],0)+1
for t,c in sorted(types.items()): print(f'  {t:18s}: {c}')
print(f'Total: {len(provs)}')
"
```

### Test the parser locally (no DB, no AI)

```bash
node -e "
const fs = require('fs');
const { parseStructure, cleanText } = require('./lib/parser-v2/structural.js');
const text = fs.readFileSync('/tmp/agreement.txt', 'utf-8');
const r = parseStructure(cleanText(text));
console.log('Sections:', r.sections.length, '| Articles:', r.articles.length);
r.articles.forEach(a => console.log(' ', a.number, '-', a.title));
"
```

### Test the classifier locally (mock AI)

```bash
node -e "
const fs = require('fs');
const { parseStructure, cleanText } = require('./lib/parser-v2/structural.js');
const { classifySections } = require('./lib/parser-v2/classify.js');
const text = fs.readFileSync('/tmp/agreement.txt', 'utf-8');
const r = parseStructure(cleanText(text));
const mockClient = { messages: { create: async () => ({ content: [{ text: '[]' }] }) } };
classifySections(r.sections, r.articles, mockClient).then(c => {
  const types = {};
  c.forEach(s => { types[s.provisionType] = (types[s.provisionType]||0)+1; });
  Object.entries(types).sort().forEach(([k,v]) => console.log(k, v));
});
"
```

### Deploy a fix

```bash
git add -A
git commit -m "fix: ..."
git push -u origin claude/zealous-gauss-FGD7v
git checkout main
git merge claude/zealous-gauss-FGD7v --no-edit
git push -u origin main
git checkout claude/zealous-gauss-FGD7v
# Wait ~60s for Vercel deploy
```

## Recent design decisions worth remembering

1. **Categories in the table show canonical labels, not AI free text.** This
   keeps cross-deal comparison clean. The AI's original wording is preserved as
   `sourceCategory` for traceability.

2. **Tagged values render as a humanized badge in the UI** (not the raw
   `UPPER_SNAKE_CASE` code). `humanizeBadgeText()` in review/[id].js does
   `ACCELERATED_VESTING` → `Accelerated Vesting`.

3. **NOSOL and ANTI use Term/Details layout** (same as STRUCT table), not the
   wide sparse table or the structured-summary card stack. Per-feature columns
   are mostly empty for multi-code provisions.

4. **COV (Other Covenants) always renders as cards**, never as a table. Every
   "other covenant" is too different to compare in tabular form.

5. **IOC preamble is split into "Affirmative Covenants" + "General Exceptions"**,
   rendered as side-by-side cards above the negative-restrictions table. The
   three affirmative limbs (ordinary course / preserve relationships / maintain
   assets) live as `features.affirmativeLimbs` on the IOC-AFFIRMATIVE provision.

6. **Equity Treatment table on the CONSID page** shows one row per instrument
   (Common Stock + Options + RSUs + ESPP, etc.), pulled from CONSID-EQUITY
   provisions plus a synthetic Common Stock row from CONSID-CONVERT.

7. **Parent group click in sidebar shows all children combined.** Clicking
   "Conditions to Closing" filters to COND-M + COND-B + COND-S together. Single-
   type clicks still work for drilling into one party's conditions.

8. **DEF cards have no structured summary box.** The full text is the summary;
   we surface `sourceSection` + `inlineDefinition` as metadata only.

9. **TERMR pages have no preamble card.** The structural preamble for a
   termination section is just procedural text — not worth a summary.

10. **Provision edit panel does NOT allow free-text typing in the text field.**
    The user must click "Re-select Text" and highlight the correct text in the
    Full Document view. This prevents data corruption (edited text would no
    longer match the actual agreement).

## Environment variables (Vercel)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (server + client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_URL` | (server-side alias) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side writes |
| `ANTHROPIC_API_KEY` | Claude API key |

## How to onboard a new Claude session

1. Read this file.
2. Read `RUBRIC.md` for the canonical code system.
3. Skim `lib/rubric.js`, `lib/taxonomy.js`, `lib/parser-v2/extract.js`,
   `pages/review/[id].js` (especially the FEATURE_DISPLAY_ORDER and
   HIDDEN_TABLE_COLUMNS maps).
4. Look at the latest 5-10 commits on `main` — they show the recent direction.
5. If working on the parser, test locally with the node one-liners above before
   spending tokens on a Vercel re-ingest.
6. If working on the UI, spot-check multiple live review pages across the 19-deal
   corpus, including at least one tender offer and one one-step merger.
7. Always commit + push + Vercel deploy verify (`mcp__bf4c4c42-..._get_deployment`
   tool) before declaring a change done.

## Contact / context

The user is a senior M&A attorney building this tool primarily for their own
review workflow but with cross-deal comparison as the headline goal. Treat
their domain expertise as ground truth and confirm before introducing structural
opinions about what's "normal" in M&A.

## WP-CI-INFRA-01 completion note

2026-07-07: WP-CI-INFRA-01: phase-allowlist CI job fixed for shallow-checkout PRs. Unblocks PR #132.

## Phase 0-B-tail completion note

2026-07-07: Phase 0-B-tail: canonical-registry-v1.md + normalized-v1.json shipped. Phase 0-C may now rebase and proceed. Added `ingest-qa` npm script alias and recorded the pre-existing ingest QA quarantine baseline at `docs/ingest/quarantine-baseline-2026-07-07.md`.

## WP-CI-INFRA-02 completion note

2026-07-07: WP-CI-INFRA-02: phase detection now maps `phase-*-tail` recovery branches to the base phase allowlist while retaining the raw tail phase in CI state. Phase 0-B allowlist extended for Phase 0-B-tail-2 recovery files, with explicit denies preserving the rest of the phase-allowlist directory. Unblocks PR #135 phase-allowlist.

## Phase 0-B-tail-2 completion note

2026-07-07: Phase 0-B-tail-2: frozen triggerCode/party_role vocabs, normalizer, shape helpers, and Phase 0-C allowlist shipped. Phase 0-C may rebase and proceed.

## WP-CI-INFRA-01 large-diff follow-up

2026-07-07: WP-CI-INFRA-01: replaces PR files API with local git diff for phase-allowlist changed-files collection. Fixes HTTP 422 on large-diff PRs (PR #140). Preserves original API call as fallback.

## CI phase detection

2026-07-07: `-tail-N` for N ≥ 3 now preserves the full phase id (added 2026-07-07 to support WP-REGISTRY-EVOLVE-01).

## WP-track branches

2026-07-07: WP-track work now uses branch shape `wp/<slug>`, where `<slug>` is kebab-case, at least three characters, and has no leading or trailing dash. The CI phase id is `WP-<UPPER-SLUG>` with dashes preserved. The allowlist file lives at `.github/phase-allowlists/wp-<slug>.json` and uses the same `{ phase, name, allowed, denied, note }` schema as phase allowlists. Example: `wp/promote-newhome-to-root` maps to `WP-PROMOTE-NEWHOME-TO-ROOT` and loads `.github/phase-allowlists/wp-promote-newhome-to-root.json`. WP-CI-INFRA-01/02/03 remain hardcoded self-hosting exceptions for CI-infra branches.

## WP-PROMOTE-NEWHOME completion note

2026-07-07: WP-PROMOTE-NEWHOME: promoted `/newhome` to `/`, moved library/query routes to root-level paths, moved `/api/newhome` to `/api/home`, added legacy redirects, deleted legacy search/provisions index routes, and removed the WP branch-support blocker files resolved by WP-CI-INFRA-03.

## WP-SCHEMA-LOSS-AUDIT-01 completion note

2026-07-07: WP-SCHEMA-LOSS-AUDIT-01: PR #156 shipped Dimension A residual-audit scaffolding, Dimension B claim-integrity warnings, guarded decision routing, and `/admin/schema-loss`. Notable data changes: added empty Dimension A queues because no committed Provision text snapshot exists, added 200 deterministic suspect-Claim warnings from `normalized-v1.json`, and added empty append-only decision/handoff JSONL files. Follow-ups: Dimension A needs a provisions snapshot or live provisions table to surface substantive uncovered-text clusters; PR #151 has `CLASSIFICATION_APPROVED` and PR #158 carries the G-0B-T3 apply step.

## WP-REGISTRY-EVOLVE-01 apply note

2026-07-07: WP-REGISTRY-EVOLVE-01 steps 3-6 prepared in PR: 61 approved registry deltas applied, 19 reconciliation-log rename records appended, no c_noise rows. G-0B-T3 crossing: Ben merge required.
