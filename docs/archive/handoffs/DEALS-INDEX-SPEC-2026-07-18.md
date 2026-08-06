# DEALS-INDEX-SPEC — 2026-07-18

Fable investigation + implementation spec for Ben's nine deals-index
requirements, plus the addendum: **every data fix must persist at ingest**
(backfill the 40 existing deals AND change the pipeline so future deals get
the right value, gated by ingest-qa).

All findings below were verified against the live Supabase corpus
(40 deals, 12,786 provisions) and a locally running dev server on
2026-07-18. Implementers: do not re-derive the audit tables — they are the
deliverable of a service-role DB sweep; trust them, and re-verify only the
rows explicitly marked VERIFY.

---

## 0. Which page is live

- **Live index = `pages/index.js`** (route `/`, the "Corpus" HomePage, fed by
  `/api/home`). It matches every complaint: Deal name + Parties duplicate
  columns (lines 233-235, 263-264), month-year dates (`fmtDate`, lines 20-23),
  dropdown filter row (lines 196-218), commented-out query-examples wiring
  (lines 215-217), non-Mergertrace styling (styled-jsx block, lines 278-334).
  `next.config.js` redirects `/newhome` → `/`.
- **`pages/deals/index.js` is legacy** (Tailwind-era). It is only reachable
  from breadcrumbs inside other legacy pages (`pages/deals/[id].js:69`,
  `pages/review-v1/*`, `pages/provisions/[id].js:273`). It uses `useDeals()` →
  `/api/deals`.
- **Spec:** `/` is the one canonical deals index. Delete
  `pages/deals/index.js`, add `{ source: '/deals', destination: '/',
  permanent: false }` to `next.config.js` redirects, and leave the legacy
  breadcrumb hrefs alone (they'll ride the redirect). `pages/deals/[id].js`
  stays (different page).

---

## 1. Buyer naming (shell entities)

**Current behavior.** The row label comes from `dealName()` in
`lib/query/types.js:105-112`, called by `publicDeal()` in
`pages/api/home.js:19-31`. Precedence is:

```
facts.parties.parent_entity → meta.ultimateParent → meta.ultimate_parent
  → meta.acquirer_display → deal.acquirer
```

**Root cause (render).** `parent_entity` is the *legal* ultimate-parent
entity from the agreement preamble. In sponsor deals the preamble names only
the acquisition vehicle, so ingest stored the shell there — and `dealName`
prefers it over `acquirer_display`. Skechers is the clean proof:
`metadata.acquirer_display = "3G Capital"` and `metadata.ultimateParent =
"3G Capital"` are BOTH present, but `deal_facts.parties.parent_entity =
"Beach Acquisition Co Parent, LLC"` (a *locked* parties record,
`method: stored_deal_metadata`) wins. **No data fix is needed for Skechers —
it is purely a precedence bug.**

**Root cause (data).** For five other sponsor deals the extractor never had
the sponsor name in the 10k-char preamble window
(`extractDealMetadata`, `pages/api/ingest/from-url.js:136-196` and
`scripts/ingest-local.js:148-186`), so `acquirer_display` is null or a shell.
The sponsor IS in the stored full text — in the limited-guarantee /
equity-commitment-letter recitals — which is how the proposed values below
were verified.

**Fix spec — render.** New helper `resolveBuyerDisplay(deal)` (put it in
`lib/query/types.js`, export, and use it inside `dealName`):

```
meta.acquirer_display → meta.ultimateParent → meta.ultimate_parent
  → meta.parent_entity → deal.acquirer
```

with a shell guard: skip any candidate matching
`/\b(parent|holdco|holdings|midco|bidco|topco|opco|merger\s+sub|acquisition(\s+co)?|buyer)\b/i`
when a later candidate exists. `deal_facts.parties.*` is the *legal-entity
record* and must NOT drive display naming. Seller side analogous:
`target_display → target_entity → deal.target`. `dealName()` returns
`"${buyerDisplay} / ${targetDisplay}"`.

**Fix spec — backfill (rows needing data).** Script
`scripts/backfill-buyer-display.js` (pattern: existing
`scripts/backfill-parent-entities.js` — dry-run default, `--apply`,
`--deal <sub>`). Sets `metadata.acquirer_display` + `metadata.ultimateParent`
and corrects `deal_facts.parties.acquirer_display` where a locked record
holds a shell:

| deal (id prefix) | today shows | proposed buyer display | source / status |
|---|---|---|---|
| Skechers `af4940e1` | Beach Acquisition Co Parent, LLC | 3G Capital | already in metadata — precedence fix only, no backfill |
| Envestnet `1f80bec7` | BCPE Pequod Buyer, Inc. | Bain Capital | VERIFIED in stored agreement: Equity Investors = Bain Capital Fund XIII + Reverence Capital funds; notices c/o Bain Capital Private Equity |
| Endeavor `0a043659` | Wildcat EGH Holdco | Silver Lake | VERIFIED: Specified Stockholders = Silver Lake West HoldCo L.P./II |
| HireRight `13211d88` | Hearts Parent | General Atlantic & Stone Point | VERIFIED: Guarantors = General Atlantic Partners 100 L.P. + Trident VII funds (Stone Point) |
| European Wax Center `86a01770` | Glow Midco | General Atlantic | VERIFIED: Guarantor = General Atlantic Partners 100 L.P. |
| Superior Industries `667447f0` | SUP Parent Holdings, LLC | (lender consortium — likely Oaktree-led) | **VERIFY from 8-K/proxy before applying.** Agreement recites only the existing credit agreement (Oaktree Fund Administration as admin agent). Do not guess; if the 8-K names the lender group, use "Oaktree-led lender group"; otherwise keep legal name with buyer_profile=financial |
| ENDRA `65a3e3c8` (staging) | ENDRA Life Sciences | ASP Isotopes | staging-only; preamble names ASP Isotopes Inc. as Parent. Fix if/when promoted |

Also correct: `aad132ee` United Homes Group — "Stanley Martin Homes" is a
real operating company (Daiwa House subsidiary); display is fine, optionally
set `ultimateParent = "Daiwa House Industry"` (no display change).

**Fix spec — ingest persistence.** In BOTH `extractDealMetadata` copies
(`pages/api/ingest/from-url.js`, `scripts/ingest-local.js` — they are
near-duplicates; extract the prompt to a shared module,
`lib/ingest/deal-metadata-prompt.js`, so they cannot drift):

1. Add field `"buyer_is_shell": boolean` — true when the filed acquirer is a
   newly formed vehicle (Parent/Holdco/Midco/Merger Sub naming, no operating
   history recited).
2. When `buyer_is_shell` is true and no sponsor name appears in the preamble,
   run a **second targeted pass**: scan the full text for the
   limited-guarantee / equity-commitment recitals and the notices section
   (`Guarantor(s)`, `Equity Investors`, `equity commitment letter`, `c/o`),
   feed those excerpts (±500 chars each, cap ~8k chars) to the same model,
   and ask for `sponsor_name` (colloquial, e.g. "Bain Capital") →
   `acquirer_display` + `ultimateParent`.
3. Keep `parent_entity` as the legal ultimate-parent entity (unchanged
   semantics).

Classification: item is **render bug + data gap + ingest gap** (all three).

---

## 2. Parties column redundancy

**Current behavior.** `pages/api/home.js:25` literally sets
`parties: row.deal_name` — the same string — and `pages/index.js:263-264`
renders both `<td><b>{deal.deal_name}</b></td>` and
`<td>{deal.parties}</td>`.

**Fix spec (render only).** One canonical presentation: a single **Deal**
column rendering `buyerDisplay / targetDisplay` (bold buyer, regular
target). Delete the `parties` field from `publicDeal` and the Parties
`<th>`/`<td>`. No separate deal-name string exists in the schema, so
nothing else consumes `parties` (verified by grep: only pages/index.js).

---

## 3. Signing date — full date

**Current behavior.** `fmtDate` (`pages/index.js:20-23`) does
`String(date).slice(0, 7)` → "2025-05". The underlying data is a full date:
`deals.announce_date` is populated from the extracted agreement
`signing_date` at ingest (`scripts/ingest-local.js:285`,
`announce_date: meta.signing_date`) and is non-null for all 40 rows.
`dealRow()` maps it to `signing_date` (`lib/query/types.js:121`).

**Fix spec (render only).**
`new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric',
month: 'long', day: 'numeric' })` → "May 4, 2025". Column header: "Signed".
Use `--mtx-mono` tabular-nums for the cell. (The `T00:00:00` suffix avoids
the UTC-shift off-by-one-day bug.) No data or ingest change needed.

---

## 4. Value — no empty cells

**Current behavior.** `fmtMoney` renders "-" when `value_usd` is null.
Audit: **13 of 40 rows are null** (below). 20 of the populated rows carry
`metadata.value_provenance` from the 2026-07-04 press-release research
backfill — reuse exactly that pattern (kind / set_by / note / source).

**Backfill list** — script `scripts/backfill-deal-values.js`, per-deal table
pinned in the script, provenance object REQUIRED for every write:

| deal (id prefix) | proposed value_usd | source / status |
|---|---|---|
| Apollo / Bridge Investment `1dfb11d5` | $1.5B | announced all-stock equity value, Feb 2025 press release — CONFIDENT, cite PR |
| Sophos / SecureWorks `bf31d586` | $859M | $8.50/sh cash, Oct 2024 PR — CONFIDENT |
| Bain / Envestnet `1f80bec7` | $4.5B | $63.15/sh cash, Jul 2024 PR — CONFIDENT |
| GA-Stone Point / HireRight `13211d88` | $1.65B | $28.75/sh cash, Feb 2024 PR — CONFIDENT |
| Sekisui House / M.D.C. `1e4b7102` | $4.9B | $63.00/sh cash, Jan 2024 PR — CONFIDENT |
| RBI / Carrols `ce061fd0` | $1.0B | $9.55/sh cash, Jan 2024 PR (~"approximately $1.0 billion") — CONFIDENT |
| Zymeworks / Theravance `0d38cc1f` | VERIFY | Jun 2026 deal — pull 8-K/PR (Ex-99.1) at backfill time |
| GNL / Modiv `dfaa71fa` | VERIFY | May 2026 — 8-K/PR |
| QXO / TopBuild `7dc3a05f` | VERIFY | Apr 2026 — 8-K/PR |
| Stanley Martin / United Homes `aad132ee` | VERIFY | Feb 2026 — 8-K/PR |
| GA / European Wax Center `86a01770` | VERIFY | Feb 2026 — 8-K/PR |
| IonQ / SkyWater `13894e33` | VERIFY | Jan 2026 — 8-K/PR |
| SUP Parent / Superior Industries `667447f0` | VERIFY — likely no headline value | debt-restructuring take-private; if no stated value, set `value_provenance.kind = 'no_stated_value'` and render the per-share/EV note |

VERIFY rows: the researcher agent fetches the deal's 8-K press-release
exhibit (same EDGAR filing index as the stored `metadata.source_url`),
quotes the headline value into `value_provenance.note`, and only then
writes `value_usd`. No unquoted values.

**Render rule (no empty cells).** If `value_usd` is null AND
`value_provenance.kind === 'no_stated_value'`, render "n/a" with a title
tooltip from the provenance note — never a bare dash. Any other null is a
data bug that the ingest gate (below) prevents going forward.

**Ingest persistence.** `extractDealMetadata` already asks for `value_usd`
but agreements rarely state a total. Add a value-derivation step to both
pipelines after metadata extraction: (a) if the agreement states per-share
consideration and fully-diluted share count, compute and mark
`value_provenance.kind = 'derived_per_share'`; (b) else fetch the sibling
press-release exhibit (EX-99.1) from the same EDGAR filing index the
agreement came from and extract the stated transaction value with a quote;
(c) else write `value_provenance.kind = 'no_stated_value'` explicitly.
Silence (null value + no provenance) becomes an ingest-qa failure.

---

## 5. Type column + new Public/Private column

**Current behavior + root cause.** Type renders
`dealRow().consideration_type` (`lib/query/types.js:123`):

```
facts.consideration.summary → meta.headlineConsiderationType → meta.considerationType
```

`deal_facts.consideration.summary` holds **per-share prices**, so the column
shows junk: "52.5" (Summit), "63.5" (Catalent), "63" (MDC), "40" (Juniper),
"14.35" (HireRight), "190" (Red Hat), "2" (Marriott), "41.75" (Cooper),
"20.42 + CVR" (Landos). Meanwhile `headlineConsiderationType` is a clean
enum (CASH / STOCK / MIXED / MIXED_ELECTION / CASH_PLUS_CVR) on 26/40 rows.

**Fix spec — render.** Invert precedence:
`headlineConsiderationType → considerationType → facts.consideration.summary
only if it is non-numeric`. Map enum → display: Cash, Stock, Mixed,
Mixed election, Cash + CVR.

**Type gaps — backfill (13 rows null on both enum fields).**
Zymeworks/Theravance, Superior, Verizon/Frontier, Apollo/Bridge,
Charter/Cox, QXO/TopBuild, Sophos/SecureWorks, RBI/Carrols,
Stanley Martin/UHG, IonQ/SkyWater, Glow/EWC, BCPE/Envestnet,
Wildcat/Endeavor. Every one of these deals has extracted CONSIDERATION
provisions in the corpus — derive `headlineConsiderationType` from the
deal's own CONSID provisions via `scripts/reprocess.js` per-type refresh
(preferred; zero external research) or a small classifier script over the
stored provisions. Known cross-checks: Frontier = CASH ($38.50/sh),
Bridge = STOCK, Carrols = CASH, Envestnet = CASH, Endeavor = CASH,
Sophos = CASH, Cox = MIXED.

**New column: Buyer type (public/private).** New metadata field
`buyer_profile ∈ { 'strategic', 'financial' }` (financial = sponsor
take-private). **Derivation rule (ingest):** `financial` iff the acquirer
is a newly formed shell (item 1's `buyer_is_shell`) AND the agreement
recites a limited guarantee / equity commitment letter from fund
guarantors; `strategic` otherwise. Display: "Take-private" / "Strategic".

**Backfill (all 40, from this audit):** `financial` for Skechers (3G),
Superior (lender consortium), Envestnet (Bain), Endeavor (Silver Lake),
HireRight (GA/Stone Point), EWC (GA), Catalent (Novo Holdings),
Forest City (Brookfield). **Everything else `strategic`**, including the
judgment calls: MDC (Sekisui House — operating homebuilder), United Homes
(Stanley Martin — operating co), Heinz/Kraft (operating-company merger;
3G/Berkshire-backed but Heinz is the combining business — note in
metadata), ENDRA (staging; strategic/reverse-merger).

`metadata.merger_form` is already populated on all 40 (REVERSE_TRIANGULAR
etc.) — expose as an optional picker column for free.

---

## 6. Header-based filtering/sort + editable columns

**Current behavior.** Separate dropdown row (`pages/index.js:196-218`) with
sector/year/size selects + a sort select, URL-synced at lines 59-79.

**Fix spec.**
- Delete the `.filters` row. Each `<th>` becomes a button: click opens a
  popover with (a) Sort asc/desc, (b) a filter control — checklist of
  distinct values for enum-ish columns (Sector, Type, Buyer type, Law firm),
  the existing three bands for Value, year list for Signed. Active
  filter/sort shows a marker in the header (▲/▼ + a filled funnel glyph).
  Keep URL sync; params become `sort=<colKey>_<asc|desc>` and
  `f_<colKey>=<csv>`. Existing `sector`/`year`/`size` params: map them on
  read for back-compat, write the new form.
- **Column registry** (new `lib/deals-index-columns.js`): each entry
  `{ key, label, accessor(deal), sortable, filterable, defaultVisible,
  coverage }`. Default-visible: Deal, Signed, Value, Type, Buyer type,
  Sector. Picker-only: Law firm (buyer), Law firm (target), Lawyers (buyer),
  Lawyers (target), Merger form, Provisions. A gear icon at the right end of
  the header row opens the picker (checkbox list). Persist to
  `localStorage['deals_index_columns_v1']`. No server state.
- **Advisor/lawyer data (verified):** lives in `metadata.advisors_v2` with
  keys `buyer_firm`, `buyer_firms[]`, `seller_firm`, `seller_firms[]`,
  `buyer_lawyers[]`, `seller_lawyers[]`, plus `raw.blocks` (side,
  designation, entity_line, firms[].lawyers). **Coverage 17/40** (audited).
  Individual lawyers ARE captured (e.g. Metsera: Wachtell — David K. Lam,
  Steven R. Green vs Paul, Weiss — Scott A. Barshay, Benjamin Goodchild).
  Extractor: `lib/parser-v2/advisors.js` (+ `notice-advisors.js`),
  conservative-by-design, canonical firm list.
- `/api/home` must ship `advisors: { buyer_firms, seller_firms,
  buyer_lawyers, seller_lawyers }` per deal (NOT `raw`). Advisor column
  headers carry a coverage badge ("17/40"); empty cells render "—" with
  tooltip "not extracted for this deal".
- **Advisor backfill:** run the existing `scripts/backfill-advisors.js`
  over the 23 uncovered deals. Expect partial success — many older filings
  omit firm names from the exhibit; the coverage badge is the honest UI for
  that. Ingest already runs `extractAdvisors` in both pipelines
  (`from-url.js:212-214`, `ingest-local.js:224-225`) — no pipeline change;
  add `advisors_found` as an **informational (not gated)** ingest-qa metric.

---

## 7. Query examples block

**Verified:** already commented out. `pages/index.js:215-217` holds the
comment ("Ben (2026-07-16): query examples hidden until the query feature is
fully built — NewQueryMenu and its wiring are kept intact for the
re-enable"). Dead wiring that must now be **deleted**: `NewQueryMenu`
(lines 365-385), `newOpen` state (line 39), `queryKinds` state +
`/api/query/kinds` fetch (lines 40, 52-57), and the `.newQuery`/`.menu` CSS
(lines 312-316). `/api/query/kinds` itself stays (used by query pages).

Open question flagged for Ben: the **"Featured queries" tiles** section
(lines 156-187) is a *different*, live block at the top of the page. This
spec keeps it. If Ben meant that block too, it is a one-line section
removal — confirm before deleting.

---

## 8. Performance (measured)

**Symptoms (local dev, 2026-07-18):** `/api/home` cold **10.4s**, warm
**2.1s**, response 178KB. `/api/deals` 1.9s/1.2s.

**Root causes, in order of cost:**

1. **`DEAL_SELECT` ships whole `metadata`** (`pages/api/home.js:7`):
   the 40 deals' metadata totals **31.7MB** (measured: `full_text` 14.7MB +
   `classified_sections` 13.8MB + `extraction_runs` 2.4MB) — 2.2s
   Supabase→function transfer per request, then discarded.
2. **Provisions query silently truncated at 1000 rows**
   (`pages/api/home.js:8,168`): the table has **12,786** rows; Supabase's
   default max-rows cap returns the first 1000 (~2.3MB with `full_text` +
   `ai_metadata`). **Correctness bug, not just perf: market snapshots and
   the search index are computed over ~8% of the corpus.**
3. `buildSnapshots` (`pages/api/home.js:109-158`) runs dozens of
   MARKET_RANGE `runQuery` evaluations in-request, every request.
4. No `Cache-Control` headers anywhere on the endpoint.
5. **Staging leak (adjacent bug):** `/api/home` never filters
   `metadata.ingest_status === 'staging'` (`/api/deals` does, lines
   31-38/117). Six staging deals (ENDRA, Summit, Frontier, Endeavor,
   Catalent, Juniper) show on the public index. Add the filter.

**Fix spec:**

- **F1 (biggest win, trivial):** replace `DEAL_SELECT` with targeted
  `metadata->>` selects, exactly the `/api/deals` `DEAL_LIST_SELECT`
  pattern (`pages/api/deals.js:4-29`) plus the advisor keys from item 6.
  31.7MB → ~50KB; the warm request drops to a few hundred ms.
- **F2:** slim the provisions select to `id, deal_id, type, ai_metadata,
  category` (drop `full_text` — nothing in home.js uses it; `getFeatures`
  reads `ai_metadata`) AND page past the 1000-row cap with a `.range()`
  loop so snapshots/search see the full corpus.
- **F3:** precompute. This branch (`corpus-reprocess-materialize`) already
  has the `deal_quality_metrics` materialized-table precedent
  (`lib/deal-quality-metrics.js:14`). Add `home_snapshots` (or a
  `corpus_materialized` JSON row): snapshots + search_index refreshed at
  the end of every ingest/reprocess run. `/api/home` then does zero
  provision reads. F2 remains as the fallback path until F3 lands.
- **F4:** `res.setHeader('Cache-Control', 's-maxage=300,
  stale-while-revalidate=86400')` on `/api/home` GET (Vercel CDN caching;
  the page is not user-personalized).
- **F5:** staging filter as above.
- **DB indexes: not needed.** 40 deals / single ordered scan; the cost is
  payload shape, not query plans. Do not spend time here.

Classification: pure render/API — no data backfill.

---

## 9. Mergertrace visual conformance

**Current behavior.** `pages/index.js` uses its own styled-jsx look
(rounded 7-8px corners, generic font stack, ad-hoc grays) — none of the
Mergertrace tokens.

**Fix spec.** Wrap the page content in `className="mtx"` and mount
`<MergertraceStyles />` (`components/review-v2/MergertraceStyles.jsx` —
global CSS fully scoped under `.mtx`). Conform:

- Fonts: body/labels `var(--mtx-sans)` (Inter); all numeric/date/code cells
  `var(--mtx-mono)` (IBM Plex Mono, `font-variant-numeric: tabular-nums`).
  **No serif anywhere on this page** (`--mtx-serif` is for document bodies
  only).
- Table: sharp corners (`border-radius: 0`), 1px `#E0E0E0` borders,
  `#F6F6F6` header bar, header labels 9-10px tracked uppercase Inter
  (match `.mtx-meta-label`, lines 61-66), row hover per the existing
  provision-table hover rule.
- Tiles/snapshots/header chrome: same treatment — square, 1px `#E0E0E0`,
  no drop shadows beyond what MergertraceStyles uses.
- Keep the styled-jsx block but reduce it to layout; all color/type/radius
  decisions defer to the `.mtx` tokens. Verify on the deployed preview, not
  just locally (watchdog gate 4).

---

## Ingest-qa gates (Ben addendum — persistence enforcement)

`scripts/ingest-qa.js` currently gates provision counts/coverage/quotes
(`DEFAULT_GATES`, lines 173-199). Add a **deal-metadata gate group**,
evaluated per deal, default-on for `--all` and for the post-ingest QA run:

| gate | rule | failure meaning |
|---|---|---|
| `buyer_display` | `resolveBuyerDisplay(deal)` returns non-null AND does not match the shell regex | sponsor resolution failed at ingest |
| `value` | `value_usd` non-null OR `metadata.value_provenance.kind === 'no_stated_value'` | value derivation silently skipped |
| `consideration_type` | `metadata.headlineConsiderationType` non-null | CONSID extraction/typing gap |
| `buyer_profile` | `metadata.buyer_profile ∈ {strategic, financial}` | classification missing |
| `signing_date` | `announce_date` full `YYYY-MM-DD` | preamble date extraction failed |
| `advisors_found` | **informational only, never gated** | some filings genuinely lack firm names |

A clean ingest that would ship a blank index cell must exit 1. Wire the same
checks into `pages/api/ingest/from-url.js`'s response payload so the admin
UI shows them immediately.

---

## Summary table

| # | Item | Class | Root cause | Fix |
|---|---|---|---|---|
| 0 | Live page | render | two index pages | `/` canonical; delete `pages/deals/index.js`, redirect `/deals`→`/` |
| 1 | Shell buyers | render + data + ingest | `dealName` prefers `facts.parties.parent_entity`; sponsor absent from preamble extraction | `resolveBuyerDisplay` precedence; 5-row backfill (1 VERIFY); sponsor second-pass at ingest; qa gate |
| 2 | Parties duplication | render | `parties: row.deal_name` | single Deal column; drop field |
| 3 | Month-year dates | render | `fmtDate` slices to 7 chars; data already full-date | "May 4, 2025" format |
| 4 | Empty Value | data + ingest | 13/40 null value_usd | backfill table (6 confident, 7 VERIFY); value-derivation step + provenance; qa gate |
| 5 | Type junk + gaps; Buyer type | render + data + ingest | `facts.consideration.summary` (per-share $) preferred over enum; 13 rows no enum | precedence flip; derive enum from stored CONSID provisions; new `buyer_profile` (8 financial / 32 strategic) + ingest rule; qa gates |
| 6 | Header filters + column picker | render (+advisor backfill) | separate dropdown row; advisors_v2 17/40 | th popovers, registry + localStorage picker, advisor columns w/ coverage badges; rerun backfill-advisors |
| 7 | Query examples | render | already commented out | delete NewQueryMenu + wiring; ASK Ben re Featured-queries tiles |
| 8 | Slow load | render/API | 31.7MB metadata select; 1000-row provision truncation (also a correctness bug); in-request snapshots; no caching; staging leak | targeted select, slim+paged provisions, materialized snapshots, CDN cache headers, staging filter |
| 9 | Visual | render | non-Mergertrace styling | `.mtx` wrap + MergertraceStyles tokens; no serif |

---

## Implementation split (two delegable packages)

Routing per CLAUDE.md: both packages are Codex-producible with specs above
as acceptance criteria; Fable reviews diffs; ingest-qa + `npm test` +
`npm run build` + live preview check are the mechanical gates. The
backfill-package VERIFY rows need a research step (Sonnet subagent or
`codex exec -s read-only` over EDGAR) whose quoted sources Fable reviews
before `--apply`.

### Package A — UI/API (no data writes)

Files: `pages/index.js`, `pages/api/home.js`, `lib/query/types.js`
(resolveBuyerDisplay + consideration precedence), new
`lib/deals-index-columns.js`, `next.config.js`, delete
`pages/deals/index.js`, `components/review-v2/MergertraceStyles.jsx`
(consume only).

Scope: items 0, 1-render, 2, 3, 5-render, 6-UI, 7, 8 (F1/F2/F4/F5; F3
optional if the materialized table already exists on this branch), 9.

Acceptance: no Parties column; buyer shows "3G Capital / Skechers" with
TODAY'S data (proves precedence fix independent of backfill); full dates;
Type never numeric; header popovers replace the dropdown row with URL
back-compat; picker adds law-firm/lawyer columns with 17/40 badges;
`/api/home` deals response < 100KB and warm < 500ms; no staging deals
visible; `.mtx` styling, zero serif; `npm test` + `npm run build` green.

### Package B — Data backfill + ingest persistence

Files: new `scripts/backfill-buyer-display.js`, new
`scripts/backfill-deal-values.js`, new
`scripts/backfill-buyer-profile.js`, rerun `scripts/backfill-advisors.js`;
shared `lib/ingest/deal-metadata-prompt.js` consumed by
`pages/api/ingest/from-url.js` + `scripts/ingest-local.js` (sponsor second
pass, buyer_profile, value derivation + provenance);
`scripts/ingest-qa.js` new gate group; CONSID-derived
`headlineConsiderationType` refresh via `scripts/reprocess.js`.

Scope: items 1-data, 4, 5-data, 6-advisors, addendum gates.

Acceptance: all 40 rows show real buyer, non-empty value (or provenanced
"n/a"), enum type, buyer_profile; every write carries provenance; VERIFY
rows quote an 8-K/PR source reviewed before `--apply`; `node
scripts/ingest-qa.js --all` passes with the new gates; a test ingest of a
fresh sponsor deal produces sponsor display + value + profile without
manual touch-up. Never commit unreviewed delegate output.

Order: A and B are independent; land A first (visible wins + the precedence
fix already repairs Skechers), B behind it.
