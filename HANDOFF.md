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

- **Develop on branch** `claude/zealous-gauss-FGD7v`, then merge fast-forward to `main`.
- `main` auto-deploys to production via Vercel git integration.
- Always run `npm run build` before committing — Vercel will fail otherwise.
- Commit messages: imperative mood + 1-3 line body explaining *why*.
- Never push to main without explicit user instruction unless merging from the dev branch.

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
  review/[id].js              # **THE MAIN UX**. Single 6000-line file with all components
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

## Current active deals

After the cleanup, only two deals remain (both tender offers):

| Deal ID | Acquirer | Target | Date |
|---|---|---|---|
| `64d894e4-7cd3-411b-9236-b597dde295c8` | Pfizer | Metsera | 2025-01-07 |
| `5ad40f11-6cbc-4934-8dfc-c46a03cc11a0` | Eli Lilly | Verve Therapeutics | 2025-06-16 |

Review URLs:
- https://precedent-machine.vercel.app/review/64d894e4-7cd3-411b-9236-b597dde295c8
- https://precedent-machine.vercel.app/review/5ad40f11-6cbc-4934-8dfc-c46a03cc11a0

## Open issues / known limitations

1. **Tender-offer agreement parsing is incomplete.** Lilly/Verve currently shows
   0 IOC / 0 NOSOL / 0 COND-B/S / 0 REP-B / 0 CONSID because of classifier
   issues with single-article "COVENANTS" structures and Annex I (Offer Conditions).
   **A parser fix is in flight at the time of this writeup** — check the latest
   commits on the dev branch.

2. **Uncoded provisions: ~89 per ingest.** The canonical code enforcer can't
   classify ~37% of provisions. Many are legitimate inline definitions or
   SECTION-LEFTOVER provisions that genuinely don't have a rubric code, but some
   are real misses. Investigate by querying `code_quality.uncoded_provisions` in
   the ingest response.

3. **Learning Phase 1 is logging only.** Corrections are saved to the
   `corrections` table but nothing feeds them back into the parser yet. Phase 2
   (inject corrections as in-context examples for the classifier) is designed
   but not built.

4. **Auto-merge is conservative.** Currently 0-1 codes auto-merge per ingest.
   This is fine but means we'll accumulate proposed codes that should be approved
   into the rubric over time. There's no UI for that approval yet.

5. **Bring-down catch-all heuristic.** `linkBringDownToReps()` defaults to
   `MAT_MAE_QUALIFIED` when no explicit catch-all is found. This is the standard
   in nearly every M&A deal but might be wrong for unusual structures.

6. **Definition coverage.** Pfizer/Metsera shows 95 DEF provisions including
   inline definitions captured from other sections. Lilly/Verve shows 131 — some
   of those are likely over-capture from articulation that looks like definitions
   but isn't.

7. **No re-ingestion safety net.** If an ingest fails mid-pipeline, you can lose
   data. The store does delete-then-insert with batch fallback, but a hard timeout
   between delete and insert would leave the deal empty. Always test ingests on a
   single deal before bulk operations.

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
6. If working on the UI, the live review pages for Pfizer/Metsera and Lilly/Verve
   are the test surface.
7. Always commit + push + Vercel deploy verify (`mcp__bf4c4c42-..._get_deployment`
   tool) before declaring a change done.

## Contact / context

The user is a senior M&A attorney building this tool primarily for their own
review workflow but with cross-deal comparison as the headline goal. Treat
their domain expertise as ground truth and confirm before introducing structural
opinions about what's "normal" in M&A.
