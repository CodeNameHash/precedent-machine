# M4-M5 RECONCILED PLAN — 2026-07-18

Fable planning spec replacing the stale `PLAN-M4-query.md` / `PLAN-M5-ui-homogenized.md`
work packages, per Ben's approved reshaping (verbatim, binding):

- **M4 order: M4-03 first** (20 demo queries answering correctly vs the 40-deal
  corpus; each missing canonical field = flagged taxonomy decision for Ben),
  **then M4-04** (query UI on the `.mtx` system, NOT new tokens),
  **then M4-02** (normalizer badges last). **M4-01** (reconciliation log): audit
  what exists in today's claims/provenance layer and spec only the delta.
- **M5: DROP M5-01** (superseded by `.mtx`; remnant = extend `.mtx` to
  admin/query pages, folded into WP-2/WP-6 below) and **DROP M5-02**
  (superseded by `docs/handoffs/DEALS-INDEX-SPEC-2026-07-18.md`, commit
  `0c0fb5a`, on this branch — do not duplicate). **KEEP M5-03** (full-doc
  overlay), **M5-05** (reports UI), **M5-06** (demo dry-run CI gate).
  **DEFER M5-04** (review-queue polish).
- Implementers are **Sonnet agents** working from this spec (no Codex in this
  environment). Every package passes the CLAUDE.md watchdog protocol: spec
  first (this doc), Fable diff review, `npm test` + `npm run build`, live
  verification for user-facing work, two-strike escalation.

All current-state findings below were verified 2026-07-18 against the working
tree (branch `_mainmerge`, HEAD `0c0fb5a`) and the **live Supabase corpus
(40 deals, ~12.6k provisions, ~61k claims)**. Implementers: trust the audit
tables; re-verify only rows marked VERIFY.

---

## 0. Current-state audit — what ALREADY exists (surprises first)

Things the stale plans assumed missing that are already built:

1. **A working 5-kind query engine with reconciliation.** `lib/query/engine.js:1-74`
   (`runQuery`/`validate`/`executeQuery`), kinds `DEAL_COMPARE`,
   `PROVISION_CROSS_CUT`, `MARKET_RANGE`, `FILTER_THEN_LIST`, `DEAL_TO_MARKET`
   (`lib/query/types.js:6-12`), one executor each under `lib/query/executors/`,
   per-kind JSON Schemas under `lib/query/schemas/`, delta scoring
   (`lib/query/delta.js`), corpus statistics (`lib/query/market-baseline.js`).
   Queries are **structured payload objects** (base64url in URL or persisted in
   `saved_queries`), not free text.
2. **Raw→canonical resolution ("reconciliation") is the core of the read path.**
   `lib/query/resolve.js:40-78` resolves aliases via
   `docs/schema-shape/normalized-v1.json`, returns `{key, raw, matchedKey,
   entry}`, hard-fails unknown keys with `BLOCKED_KEY_MISSING`. A custom lint
   (`lib/query/lint/no-raw-feature-key.js` + `tests/query/wp-query.test.js:181-213`)
   forbids bypassing it. **The old M4-01 "make reconciliation explicit" is
   ~80% done.**
3. **An append-only reconciliation log with typed events exists** —
   `docs/schema-shape/reconciliation-log.jsonl` (MERGE / PROMOTE /
   MOVED_OR_DROPPED / SPLIT events with `field_key`, `raw_value`,
   `targetCanonicalKey`, `rationale`, `touched[]`, `resolved_at`), written by
   `pages/api/admin/reconcile/decide.js:56-83`, driven by the
   `pages/admin/registry/reconcile.js` UI. Gaps: **no `decided_by` actor**, file
   is local-write-only (blocked on Vercel, `decide.js:71-73`), and events
   reference triple ids, not `claims.id`.
4. **Per-value extractor/normalizer citation exists at write time.**
   `claims.provenance` (built in `lib/parser-v2/store-claims.js:166-178`)
   carries `extractor_id`, `extractor_version`, `model`, `run_id`, `code`,
   `feature_key`, raw `feature_value`; `provision_cards.provenance` is
   CHECK-constraint-enforced to carry `source_doc_id`, offsets,
   `extractor_name/version`, `model`, `prompt_hash`, `run_id`, `extracted_at`
   (`supabase/schema-04-provision-card-canonical.sql:29-120`). Gap: the read
   path drops it — `lib/queries/claims-adapter.js` keeps only
   verbatim/canonical/evidence_quote; query cells carry quotes + `card_id` but
   no version stamp (`lib/query/version.js` stamps payloads/rows only).
5. **Provenance drilldown in the query UI exists** —
   `pages/query/[kind]/[id].js:232-248` (quote drawer + link to
   `/review-v1/{deal_id}/provision/{card_id}`). Saved queries + featured
   surfacing exist (`pages/api/saved-queries.js`, `pages/api/home.js:65-82`,
   `pages/library.js:42`).
6. **Card-level span offsets for the overlay already exist and are populated.**
   `provision_cards.primary_quote_start/end` are absolute char offsets into
   `deals.metadata.full_text` (`supabase/schema-03-card-model.sql:17-19`,
   CHECK end>start), and that full text is already served by
   `GET /api/agreement-source` (`pages/api/agreement-source.js:27-38`) and
   already fetched by the review page (`pages/review/[id].js:148`). The
   card-level overlay is a **client-side rendering task only**.
7. **DEALS-INDEX-SPEC-2026-07-18.md is real and on this branch** (HEAD commit
   `0c0fb5a`; it is NOT on origin/main yet). It fully covers the landing/index
   redesign incl. `.mtx` conformance, perf, backfills, ingest-qa gates. Nothing
   here may duplicate it.

Things the stale plans assumed existing that are NOT there:

- `lib/query/fixtures/demo-set.json` — does not exist. Only code-generated
  `featuredQueries()` in `lib/query/fixtures.js:8-62`.
- CSV export, query-builder UI, text input — none.
- `/admin/reports` — no such page; **nothing renders any report JSON**.
  `scripts/ingest-qa.js` is **console-only** (no JSON emitter at all);
  `coverage-audit.js`, `curation/mint-cards.js`,
  `reprocess/rematerialize-claims.js` write JSON to `reports/` which is
  **gitignored and absent from Vercel**. There is no dedicated
  span-residual-baseline script (that logic lives in
  `scripts/schema-loss/audit-residuals.js` / `audit-feature-residuals.js`).
- E2E / demo dry-run: nothing. CI (`.github/workflows/ci.yml`) = test+build,
  11 invariant lint/audit gates, conditional schema-parity (PR + secrets),
  phase-allowlist.
- **Span-claims is NOT on this branch.** `lib/parser-v2/span-claims.js` +
  `subclauses.js` exist only in commit `68f824a` on branch
  `worktree-agent-acd8f0221e15d78cd` (report-only, inert-by-flag, no DB
  persistence — per `docs/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md`).
  Claims have `evidence_quote` **text but no char offsets**.

### Two data paths — the load-bearing architectural fact

The query engine reads `provisions.ai_metadata.features` (via
`pages/api/query/run.js:56-59` → `resolve.js` → `lib/feature-compare`), while
the review UI reads the **claims/cards layer** (`lib/queries/review-deal.js`,
`claims-adapter.js` over `provision_cards` + `claims`). Coverage differs
(measured): e.g. `companyTerminationFee` 35 deals in ai_metadata vs 17 in
claims; `forceTheVote` 11 vs 7. **Decision (mine, not Ben's): M4 stays on the
ai_metadata path** — it is the more complete surface today and the engine +
lint are built on it. Migrating the query engine to claims is a post-M5
project; M4-02 bridges provenance via the `card_id` join instead.

---

## 1. WP order and dependency graph

| # | WP | Old id | Depends on | Sized for |
|---|----|--------|-----------|-----------|
| 1 | Demo-set completeness | M4-03 | — | Sonnet |
| 2 | Query UI on `.mtx` | M4-04 (+M5-01 remnant) | WP-1 (demo set drives the UI) | Sonnet |
| 3 | Normalizer badges | M4-02 | WP-2 (renders in its cells) | Sonnet |
| 4 | Reconciliation delta | M4-01 | — (parallel any time) | Sonnet |
| 5 | Full-doc overlay | M5-03 | — (parallel; MVP has zero M4 deps) | Sonnet |
| 6 | Reports UI + persistence | M5-05 | WP-2 (`.mtx` primitives) | Sonnet |
| 7 | Demo dry-run CI gate | M5-06 | WP-1, WP-5, WP-6 | Sonnet |

Parallelizable lanes: (WP-1 → WP-2 → WP-3), (WP-4), (WP-5). WP-6 starts once
WP-2's `.mtx` primitives merge. WP-7 is last. One WP = one branch = one PR,
Fable-reviewed before merge; never commit unreviewed delegate output.

---

## 2. WP-1 (M4-03) — Demo-set completeness: 20 queries answering correctly

**Branch:** `wp/m4-03-demo-set`

**Deliverables**

1. `lib/query/fixtures/demo-set.json` — 20 entries, each:
   `{ id, title, question, kind, payload, expected: {…}, notes }`.
   `expected` pins the answer at authoring time (deal-name lists for
   FILTER_THEN_LIST, `{median, n}`-style stats for MARKET_RANGE, per-deal
   value maps for PROVISION_CROSS_CUT/DEAL_COMPARE, status counts for
   DEAL_TO_MARKET). Deal references by **name substring**, resolved to ids at
   runtime (ids are environment-stable but names are the reviewable form).
2. `scripts/query-demo-check.js` — loads the live corpus exactly as
   `pages/api/query/run.js` does (paginated provisions, `ai_metadata`), runs
   all 20 payloads through `runQuery`, diffs against `expected`, prints a
   per-query PASS/FAIL table, exit 1 on any FAIL. Flags `--query <id>`,
   `--update` (rewrite expected — requires explicit use; never in CI).
3. Executor/feature gap fixes needed to make the 20 pass (see the per-query
   table: derived fee-percent, derived outside-date months, rich-object
   boolean handling already exists via `feature-compare` — verify).
4. `tests/query/demo-set.test.js` — offline: every entry validates against its
   kind's JSON schema via `validate()` with a stub context; payload decode
   round-trips; expected shapes well-formed. (The live check is WP-7's job and
   the conditional CI job below.)
5. CI: extend the existing conditional pattern (`ci.yml` schema-parity job,
   lines 54-102) with a `demo-set` job running `scripts/query-demo-check.js`
   on PRs touching `lib/query/**` or the fixture, when Supabase secrets exist.

**The 20 demo queries** (feature coverage measured live 2026-07-18; deal
counts are out of 40):

| # | Question (M&A substance) | Kind | Feature key(s) | Coverage | Pinned answer / note |
|---|---|---|---|---|---|
| 1 | Which deals have force-the-vote provisions? | FILTER_THEN_LIST | `forceTheVote` | 11 true | Starwood, Covance, CSRA, Anadarko, Juniper, HireRight, Mr. Cooper, Summit, SkyWater, TopBuild, Noble Africa |
| 2 | Company termination fees over 3% of deal value | FILTER_THEN_LIST | derived `feePctOfDealValue` (**gap G-A**) | 24 computable | Landos 5.09%, Verve 3.97%, Redfin 3.74%, Skechers 3.62%, Starwood 3.28%, Mr. Cooper 3.27%, Dyax 3.05%, Anadarko 3.03%, Pharmasset 3.02%, Prometheus 3.01% |
| 3 | Market range: termination fee as % of deal value | MARKET_RANGE | same derived field | 24 | cluster 2.6–3.3%, median ≈3.0% |
| 4 | Which deals have go-shop periods, and how long? | FILTER_THEN_LIST | `goShopPresent`, `goShopPeriodDays` | 1 true | **Carrols only** — see **gap G-D** (suspected extraction gap in the sponsor take-privates) |
| 5 | Match-right initial windows across the corpus | MARKET_RANGE | `initialMatchPeriodDays` | 32 | typical 3–5 business days |
| 6 | Cash vs stock vs mixed vs cash+CVR mix | MARKET_RANGE (frequency) | `considerationType` | 37 | enum canonicals verified in claims (`all-cash`, `all-stock`, `mixed-cash-and-stock`, `cash-with-cvr`) |
| 7 | Which deals include CVRs? | FILTER_THEN_LIST | `cvrIncluded` | 3 true | Landos, Metsera, Theravance |
| 8 | In mixed-election deals, what do non-electing holders receive? | PROVISION_CROSS_CUT | `prorationMechanics` (text) — **gap G-B** (no `electionDefaultConsideration` canonical) | 2 | e.g. Cox/Charter-style deemed-election language; answer is verbatim text until G-B decided |
| 9 | Outside dates: months from signing | MARKET_RANGE | derived from `outsideDateISO` − `signing_date` (**gap G-C**; raw `outsideDateMonths` only 8) | 25 | — |
| 10 | Which deals allow extension of the outside date, and by how much? | FILTER_THEN_LIST | `outsideDateExtension`, `extensionMonths` | 8 with months | — |
| 11 | Reverse termination fees: who has one and how large? | PROVISION_CROSS_CUT | `reverseTerminationFee` (object: amount, triggers) | 15 | amounts verified present (e.g. $534.1M, $600M, $590M rows) |
| 12 | Superior-proposal definition thresholds (% of assets/equity) | MARKET_RANGE | `superiorProposalPercentage` | 27 | — |
| 13 | Which agreements have intervening-event outs (vs superior-proposal-only)? | FILTER_THEN_LIST | `interveningEventProvision` | 31 | — |
| 14 | Financing-cooperation covenants: which deals, and is breach a closing condition? | PROVISION_CROSS_CUT | `financingCooperationPresent`, `financingCooperationBreachIsCondition` | 25 | — |
| 15 | MAE definitions with pandemic carveouts | FILTER_THEN_LIST | `pandemicCarveout` | 24 | expect post-2020 skew — good demo narrative |
| 16 | MAE carveouts with disproportionate-impact write-backs | FILTER_THEN_LIST | `disproportionateImpact` | 31 | — |
| 17 | Regulatory efforts: who took a burdensome-condition cap? | FILTER_THEN_LIST | `burdensomeConditionPresent` | 17 | — |
| 18 | HSR filing deadlines (business days) across the corpus | MARKET_RANGE | `hsrFilingDeadlineBusinessDays` | 19 | typical 10–15 bd |
| 19 | Compare the deal-protection package of the three 2025 Rocket-adjacent / recent tech deals | DEAL_COMPARE | NOSOL + TERMF key fields | n/a | pick Redfin, Mr. Cooper, Juniper (payload pins by name) |
| 20 | How does Metsera / Pfizer sit vs market? | DEAL_TO_MARKET | scorecard (`SCORE_FIELDS`, `executors/deal-to-market.js:5-11`) | n/a | — |

Reserve bench (if a flagged gap stalls a query): `appraisalRightsAvailable`
(26), `cureDays` (37), `specificPerformanceMutual` (29 rows),
`dealStructure` one-step vs two-step (38), `governingLaw` +
`jurisdictionExclusive` (40/24), `sufficientFundsRepPresent` (34),
`dontAskDontWaive` (5 in ai_metadata). Do NOT use `hellOrHighWater` (0 true
corpus-wide in ai_metadata — see G-E), `tickingFee`/`tenderOffer`/
`walkAwayRight`/`collarType`/`tailFeeWindowMonths` (0 coverage).

**Flagged taxonomy decisions for Ben (per his rule: each missing canonical
field = a flagged decision, not a silent workaround):**

- **G-A `terminationFeePercentEquityValue`** — registry key exists
  (`lib/schema/features.js`) but **0 rows corpus-wide**. Amounts live inside
  `companyTerminationFee.amount` as strings ("$400,000,000"). Proposal:
  compute `feePctOfDealValue = parse(amount) / deals.value_usd` at query time
  as a **derived deal-meta field** in `lib/query/types.js` (do NOT fabricate
  extracted claims). 6 fee-bearing deals lack `value_usd` — that backfill is
  DEALS-INDEX-SPEC Package B, item 4; note the dependency. **Ben: approve
  derived-at-query-time vs. extractor backfill.**
- **G-B `electionDefaultConsideration`** — no canonical field for what
  non-electing holders receive in mixed-election deals. Today it is prose
  inside `prorationMechanics`. **Ben: add a CONSID enum field
  (`CASH`/`STOCK`/`PRORATED_MIX`/`DEEMED_ELECTION`) or keep prose.**
- **G-C outside-date months** — `outsideDateMonths` extracted on only 8 deals;
  `outsideDateISO` on 25. Proposal: derive months from
  `outsideDateISO − signing_date` at query time. **Ben: approve derivation.**
- **G-D go-shop coverage** — 1/40 true. The corpus contains ≥6 sponsor
  take-privates (Envestnet, Endeavor, HireRight, EWC, Skechers, Catalent)
  where a go-shop is plausible. Before demoing query #4, run a targeted
  verification sweep (grep stored full_text for "go-shop"/"Go-Shop Period"
  solicitation carveouts) and report. **Ben: accept corpus truth or order a
  NOSOL re-extract for flagged deals** (`scripts/reprocess.js` per-type).
- **G-E `hellOrHighWater`** — 0 true in ai_metadata while the claims table has
  7 non-false verbatims. Likely honest (no true HOHW deals in corpus) but the
  claims/ai_metadata disagreement should be reported alongside G-D's sweep.

**Acceptance / gates:** `scripts/query-demo-check.js` prints 20/20 PASS
against live Supabase; `npm test` + `npm run build` green; the G-A/G-C
derived fields covered by unit tests with pinned fixtures; the G-D/G-E sweep
report filed in the PR description; no change to any extraction prompt or
`lib/rubric.js`/`lib/taxonomy.js` semantics (that would be Fable-only work).

---

## 3. WP-2 (M4-04 + M5-01 remnant) — Query UI on the `.mtx` system

**Branch:** `wp/m4-04-query-ui-mtx`

**Current state.** The whole query UI is one file,
`pages/query/[kind]/[id].js:1-269`, self-styled with `.qp` styled-jsx classes
and its own CSS variables — zero `.mtx`. `MergertraceStyles.jsx` is a global
styled-jsx sheet fully scoped under `.mtx` (used ONLY by
`pages/review/[id].js:18,251`); it re-skins the v1 provision tables **by
testid** and has **no standalone table/input/button/badge primitives**
(audit: `components/review-v2/MergertraceStyles.jsx:89-297` tables are
`[data-testid^='provision-table-']`-scoped; no form styles at all).

**Deliverables**

1. **Extend `MergertraceStyles.jsx` with generic primitives** (the approved
   M5-01 remnant — extending `.mtx`, not inventing new tokens): `.mtx-table`
   (sharp corners, 1px `#E0E0E0`, `#F6F6F6` header, tracked-uppercase header
   labels matching `.mtx-meta-label`, row hover per the provision-table rule),
   `.mtx-input` / `.mtx-select`, `.mtx-btn` (+ `.mtx-btn-primary`),
   `.mtx-badge`, `.mtx-drawer`. Reuse the existing custom properties
   (`--mtx-sans/mono`, ink/paper vars) — **no new color/spacing/type values**.
   These primitives are what WP-6 and DEALS-INDEX item 9 consume; keep them
   generic.
2. **Restyle `pages/query/[kind]/[id].js`**: wrap in `className="mtx"`, mount
   `<MergertraceStyles />`, replace `.qp` styling with the primitives; numeric
   cells `--mtx-mono` tabular-nums; no serif (document bodies only). Keep the
   styled-jsx block for layout only.
3. **Query index page `pages/query/index.js`**: saved-query list (existing
   `GET /api/saved-queries`), featured queries, and a **payload builder**
   consuming `GET /api/query/kinds` schemas (kind picker → schema-driven form:
   deal multi-select, provision-type select, field-path select from
   `FIELD_ALIASES` + registry). No natural-language input — out of scope
   (`pages/api/ask.js` stays unwired).
4. **CSV export**: client-side serialization of the current result (all five
   kinds have tabular projections; MARKET_RANGE exports `deal_points`).
   Filename `mergertrace-<kind>-<date>.csv`, quotes/section refs included as
   columns.
5. **Demo-set surfacing**: the 20 WP-1 queries listed on `pages/query/index.js`
   (title + question, linking to `/query/<slug>/adhoc?payload=…` via
   `encodePayload`). This is the demo entry point.
6. Keep and restyle the provenance drilldown drawer (`[id].js:232-248`);
   retarget its link from `/review-v1/...` to the current review route
   (`/review/[id]`) with the card anchor WP-5 introduces (coordinate; plain
   `/review/[id]` link until WP-5 merges).

**Acceptance / gates:** all 5 kinds render under `.mtx` with no `.qp`
remnants; builder produces valid payloads for every kind (schema-validated
before run); CSV opens in a spreadsheet with correct headers; review page
visually unchanged (screenshot diff of `/review/[id]` before/after — the
style-sheet edit is shared, this is the regression risk); `npm test` +
`npm run build`; **live verification on the Vercel preview** of `/query/...`
and `/review/[id]` (watchdog gate 4).

---

## 4. WP-3 (M4-02) — Normalizer badges (last, and slimmer than the old plan)

**Branch:** `wp/m4-02-normalizer-badges`

**Current state.** Cell-level version metadata does not exist;
`versionedPayload`/`attachVersion` (`lib/query/version.js:4-24`) stamp
payloads/rows only. But every cell already carries `card_id` +
`quote_section_ref`, `resolve.js` already returns `matchedKey` (the raw alias
actually matched), and `provision_cards.provenance` carries
`extractor_name/version`, `model`, `run_id` (CHECK-enforced).

**Deliverables**

1. Executors attach to each value-bearing cell:
   `_prov: { canonical_key, matched_key, registry_version, extraction_version }`
   — `matched_key` from `resolveFeatureValue`; `registry_version` = a version
   string added to `docs/schema-shape/normalized-v1.json` (introduce
   `_meta.version`, start `normalized-v1.0`; bump discipline documented in
   WP-4's doc); `extraction_version` resolved via the cell's `card_id` →
   `provision_cards.provenance.extractor_version` (batch-fetch card
   provenances in `pages/api/query/run.js`, not per-cell).
2. Renderer: a small `.mtx-badge` on hover/click of any cell showing
   `canonical ← raw alias`, registry version, extractor version + run id.
   Silent (no badge) when the cell is empty.
3. Schema: extend the result JSON contract (documented in
   `lib/query/schemas/README` note) — additive only, `_prov` optional.
4. Tests: fixture-based — a provision whose raw key is an alias
   (e.g. `go_shop` → `goShopPresent`) must surface both keys in `_prov`.

**Explicitly out:** per-claim normalizer versioning on the claims read path
(claims-adapter) — that is the future claims-migration project, noted in
WP-4's audit doc.

**Acceptance / gates:** unit tests; `npm test`/`npm run build`; live preview
shows badges on demo query #6; DEAL_COMPARE/CSV unaffected when `_prov`
absent (backward compatibility test).

---

## 5. WP-4 (M4-01) — Reconciliation log: delta only

**Branch:** `wp/m4-01-reconciliation-delta`

**Audit conclusion (the "audit first" Ben asked for — done, §0 items 2-4):**
typed-event log, reconcile UI, decision API, alias registry, read-path
resolution and a bypass lint all exist. The old M4-01 (create the log, wire
executors to read it) is **already satisfied** — executors resolve through the
registry the log maintains. Remaining delta, in priority order:

1. **`decided_by` actor** on every event: `pages/api/admin/reconcile/decide.js`
   accepts and records `decided_by` (from the session user / `EDITOR_KEYS`
   pattern in `CORRECT-TAB-SPEC-2026-07-17.md`); the reconcile UI sends it;
   replace the hardcoded `"Bulk merge from reconcile UI"` rationale
   (`pages/admin/registry/reconcile.js:45`) with rationale + actor.
2. **Claim linkage:** events additionally record `claim_ids[]` (resolvable
   from `touched[]` triple ids) so a claim's canonical history is queryable.
3. **Registry versioning:** `_meta.version` in `normalized-v1.json`, bumped by
   `decide.js` on every write (feeds WP-3's `registry_version`).
4. **Docs:** `docs/schema-shape/README-reconciliation.md` — event shape, file
   locations, local-write-only constraint, version-bump rule, and the
   explicitly-deferred item: migrating the JSONL to a DB table (needed before
   reconciliation decisions can be made from production; **not now**).

**Acceptance / gates:** a reconcile decision made locally produces an event
with actor + claim ids + version bump; existing JSONL rows still parse
(additive schema); `npm test`/`npm run build`.

---

## 6. WP-5 (M5-03) — Full-doc overlay with exact span highlight

**Branch:** `wp/m5-03-full-doc-overlay`

**Current state.** Data path already complete at card granularity:
`card.primary_quote_start/end` are absolute offsets into
`deals.metadata.full_text`, served by `/api/agreement-source` and already
fetched by `pages/review/[id].js:148`. But agreement view and card view are
mutually exclusive (`[id].js:265-268`), and `AgreementView.jsx` re-parses text
into blocks with **no offset-addressable anchors** — nothing to scroll to or
`<mark>`. Card clicks open `ClauseSidebar` (`[id].js:317-324`) which shows the
quote as an isolated blockquote. The nearest highlight precedent is
`components/admin/schema-loss/ResidualHighlighter.jsx`. `parser_regions`
(deal_id, start_char, end_char, section_ref, raw_text;
`supabase/parser-regions-consideration-schema.sql:6-24`) has **no API route**.

**Scope decision:** ship **card-level highlight (primary_quote span)** now.
Per-claim/sub-clause highlight requires the unmerged span-accounting branch
(commit `68f824a`, section-relative offsets, inert, not persisted) — **defer**;
leave a seam (see item 4).

**Deliverables**

1. `components/review-v2/SourceOverlay.jsx` — full-screen `.mtx` overlay
   (dismiss on Esc/backdrop): renders the agreement text with an
   offset-tracking pass so every rendered text node knows its
   `[start,end)` in `full_text`. Implementation guidance: do NOT reuse
   `parseFormattedDocument`'s lossy block parse for the highlight layer;
   either (a) render `full_text` in a single offset-faithful pane
   (mono/serif doc styling, `[[...]]` markers stripped with an offset map), or
   (b) extend the AgreementView parser to carry source offsets per block.
   (a) is acceptable for v1 and much cheaper; pattern-match
   `ResidualHighlighter.jsx`.
2. Entry points: a "View in agreement" affordance on each provision row/card
   and inside `ClauseSidebar` (near the quote blockquote,
   `ClauseSidebar.jsx:402-409`). Opens the overlay scrolled to the span,
   `<mark class="mtx-doc-highlight">` on `[primary_quote_start,
   primary_quote_end)`, section ref shown in the overlay header
   (`card.section_ref`).
3. Fallback chain when offsets are missing/invalid (defensive — offsets are
   NOT NULL but bad data exists): try exact-string find of
   `card.primary_quote`, else `card.region_full_text`, else open the overlay
   unscrolled with a visible "span unresolved" notice — never silently wrong
   highlights. Log unresolved cards to console + a counter surfaced in the
   overlay footer (feeds the quote-verification zero-flag discipline).
4. Seam for per-claim spans: the overlay takes `{start, end}` props, not a
   card — when span-claims merges and persists offsets, claim chips can call
   the same overlay. Document this in the component header comment referencing
   `SPAN-ACCOUNTING-SPEC-2026-07-18.md`.
5. Deep-link: `/review/[id]?card=<card_id>` opens the overlay directly (this
   is what WP-2's drilldown link and WP-7's dry-run use).

**Explicitly out:** PDF rendering (the old plan said "source PDF" — the source
of record is the stored full text; there are no PDFs in the pipeline);
`parser_regions` API (not needed at card granularity).

**Acceptance / gates:** for 5 named cards across 3 deals (pick from Metsera,
Redfin, Starwood incl. one DEF and one TERMF card), the highlighted text ==
`card.primary_quote` **verbatim** (automated check in a small script or test
using the same offset logic); overlay works on the deployed preview on a
long doc (Cox/Charter-scale, 1MB+ text — verify scroll performance);
`npm test`/`npm run build`; zero unresolved-span notices across a scripted
sweep of all 40 deals' first 10 cards (report actual count in PR; >0 is a
data finding, not an auto-fail — Fable adjudicates).

---

## 7. WP-6 (M5-05) — Reports UI

**Branch:** `wp/m5-05-reports-ui`

**Current state.** Producers and shapes (audited):
`scripts/coverage-audit.js` → `{flaggedExclusions, missedContent, deals}` to
`reports/coverage-audit-<ts>.json` (:162-164);
`scripts/curation/mint-cards.js` and `scripts/reprocess/rematerialize-claims.js`
→ `{generatedAt, apply, summary, deals[]}` to `reports/` (:648-652, :485-491);
`scripts/ingest-qa.js` → **console only**, no JSON (:209-328);
span-residual baseline → no dedicated script (schema-loss audits).
`reports/` is **gitignored** → invisible to Vercel. No `/admin/reports` page.

**Deliverables**

1. **Persistence first** — new table `run_reports`
   (`supabase/schema-06-run-reports.sql`):
   `id uuid, kind text CHECK (kind in ('ingest-qa','coverage-audit',
   'rematerialize-claims','mint-cards','span-residual','demo-dryrun')),
   generated_at timestamptz, git_ref text, summary jsonb, payload jsonb,
   created_at`. Shared writer `lib/reports/persist-report.js`; wire into the
   four producers behind `--report-db` (default ON when
   `SUPABASE_SERVICE_ROLE_KEY` present, still writing the local file).
   `summary` = small (top-level counts, pass/fail); `payload` = full report,
   capped ~1MB (truncate `deals[]` detail beyond cap with a `truncated: true`
   marker).
2. **ingest-qa JSON emitter**: refactor `scripts/ingest-qa.js` to build a
   structured result `{generatedAt, deals: [{dealId, counts, rawCoveragePct,
   excludedRegions, checks[], pass}], pass}` alongside its console output;
   `--json <path>` and the `--report-db` write. **No change to gate logic or
   thresholds** — output plumbing only (the gates are load-bearing for
   DEALS-INDEX Package B; behavior change there would collide).
3. `pages/admin/reports/index.js` — latest-per-kind cards + run history table
   (from `run_reports.summary`), `.mtx`-wrapped using WP-2 primitives, listed
   in `docs/admin/nav-registry.json`.
4. `pages/admin/reports/[kind].js` — per-kind renderers: ingest-qa =
   per-deal gate table (PASS/FAIL badges); coverage-audit = flagged
   exclusions + missed-content lists; rematerialize/mint-cards = summary +
   per-deal entry counts with apply/dry-run marker; demo-dryrun (WP-7's rows)
   = step table. Raw-JSON `<details>` fallback for anything unrenderered —
   never a blank page.
5. API: `pages/api/admin/reports.js` (list + get by id/kind, service-role,
   admin-gated like existing admin APIs).

**Ben decision (B-schema): one new DB table + migration.** Flag before merge —
schema changes have been Ben-visible territory since M2. The alternative
(committing report JSONs to the repo) is rejected: `reports/` was gitignored
deliberately (commits `c5935cf`, `ba600ea`).

**Acceptance / gates:** run each producer locally once → 4 rows in
`run_reports` → all render at `/admin/reports` on the preview deployment;
ingest-qa console output byte-identical for the PASS path (snapshot test);
`npm test`/`npm run build`.

---

## 8. WP-7 (M5-06) — Demo dry-run as CI gate

**Branch:** `wp/m5-06-demo-dryrun`

**Current state.** No e2e anything (§0). CI has the conditional-secrets
pattern to copy (`ci.yml:54-102`) and the phase-allowlist machinery.

**Deliverables**

1. `scripts/demo-dryrun.js` — sequential steps, each timed, structured
   result, exit non-zero on first hard failure:
   1. **Ingest** a pinned fixture agreement (committed under
      `__fixtures__/demo-deal/` — use a small real corpus agreement, e.g. the
      Landos filing, stripped to <500KB) via `scripts/ingest-local.js` with
      `--staging` naming (`DRYRUN-<timestamp>` target name, metadata
      `ingest_status: 'staging'`, `dryrun: true`).
   2. **QA gate**: `scripts/ingest-qa.js --deal <id>` passes.
   3. **Review surface**: `GET /api/review/<id>/cards` returns >0 cards, and
      one card's `primary_quote` is found verbatim at
      `[primary_quote_start, primary_quote_end)` in
      `/api/agreement-source` text (the WP-5 overlay contract, checked
      headlessly).
   4. **Query surface**: `scripts/query-demo-check.js` passes 20/20 — the
      corpus queries must still answer correctly with the staging deal
      present (staging deals must be excluded from query context; if they are
      not today, that exclusion is part of this WP — mirror the
      `/api/deals` staging filter noted in DEALS-INDEX-SPEC item 8/F5).
   5. **Reports**: a `run_reports` row of kind `demo-dryrun` written with the
      step results (WP-6 writer).
   6. **Teardown** (always, incl. on failure): delete the staging deal's
      rows (deals, provisions, provision_cards, claims, parser_regions) by
      deal_id; verify count 0 after.
2. CI job `demo-dryrun` in `ci.yml`: PRs touching `lib/query/**`,
   `lib/parser-v2/**`, `lib/queries/**`, `pages/api/**`, `scripts/ingest*`,
   or `components/review-v2/**`; conditional on Supabase secrets (same
   pattern/skip semantics as schema-parity); **red PR on failure regardless of
   unit tests** (job is required, not allow-failure). Concurrency group
   `demo-dryrun` (serialize — two runs would race the staging deal).
   Hard timeout 15 min.
3. Local runbook note in the script header: `node scripts/demo-dryrun.js`
   with `.env.local` = the exact pre-demo smoke test Ben runs.

**Ben decision (B-env): this writes to the production Supabase project**
(staging-tagged, serialized, torn down — but still prod). Alternative: a
second Supabase project for CI (cleaner, costs setup + secret plumbing).
Spec assumes prod-with-staging-tag; **Ben to confirm or fund the second
project before the CI job is made required.** Until decided, land the script
+ a non-required CI job.

**Acceptance / gates:** dry-run green twice consecutively from a clean state;
a deliberately broken fixture (truncated text) makes step 2 fail red and
teardown still runs; no residual staging rows after either outcome; the CI
job skips cleanly on forks/no-secrets.

---

## 9. Consolidated Ben decision points

| id | Decision | WP | Default if unanswered |
|----|----------|----|----|
| G-A | Termination-fee % of deal value: derive at query time from `companyTerminationFee.amount` ÷ `value_usd` (vs extractor backfill of `terminationFeePercentEquityValue`) | WP-1 | derive at query time |
| G-B | Add `electionDefaultConsideration` canonical CONSID field (non-electing holders) vs keep prose | WP-1 | prose (query #8 shows verbatim) |
| G-C | Derive outside-date months from `outsideDateISO` − signing date | WP-1 | derive |
| G-D | Go-shop 1/40: accept corpus truth or order NOSOL re-extract for the 6 sponsor take-privates after the verification sweep | WP-1 | sweep report first, no re-extract |
| G-E | hellOrHighWater 0/40 true + claims/ai_metadata disagreement | WP-1 | excluded from demo set; report only |
| B-schema | New `run_reports` table + migration | WP-6 | blocked until approved |
| B-env | Demo dry-run against prod Supabase (staging-tagged) vs dedicated CI project | WP-7 | prod + staging tag; CI job non-required until approved |
| (existing) | DEALS-INDEX-SPEC item 7: Featured-queries tiles keep/delete | — | keep (already flagged there) |

---

## 10. Delegation mechanics (per CLAUDE.md)

- Each WP = one Sonnet agent, one branch, prompt = the WP section above
  verbatim + the §0 findings it cites. Self-contained; no conversation
  history assumed; no secrets in prompts (agents read `.env.local` themselves).
- Fable reviews every diff against the WP's acceptance list, reading for
  dropped requirements and silent scope-narrowing; two failed reviews →
  Fable redoes the WP.
- Legal-judgment guardrail: WPs 1-7 must not touch `lib/rubric.js`,
  `lib/taxonomy.js`, or extraction prompts in `lib/parser-v2/extract.js`.
  Any G-* decision Ben resolves that requires those files is Fable-only work
  in a separate PR.
- Live verification: WP-2, WP-5, WP-6 require checking the deployed Vercel
  preview, not just local build. WP-1's live gate is the demo-check script;
  WP-7 is itself the gate.
