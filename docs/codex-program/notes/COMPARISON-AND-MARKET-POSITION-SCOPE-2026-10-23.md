# Comparison and market position: scoping note

Written 2026-10-23 for Ben, in a parallel chat while the manager session runs.
Scoping only: no code changed. This is a dated design note, not a plan
authority; the single executable checklist remains
`docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`.
It extends `QUERY-ON-LAYERED-FACTS-DESIGN-2026-10-18.md` (the Query design
note commissioned in plan finding (163)) with the two features Ben asked for
here:

> "a comparison function across different merger agreement summaries, along
> with a feature that shows how 'market' a provision compared with others."

Ben's earlier direction still controls the timing: "we do need to build a
query function etc but we should be thoughtful on how we do that once we have
solid data we're happy with - add to the future planning (probably the first
thing we build as it will drive the side bar etc)" (2026-10-18, finding (163)).

---

## Summary for Ben

- **What it is.** One read over accepted facts and their coded conclusions:
  the deal you are looking at, the reference set's comparison, and each
  provision's cells scored against that set. Every point opens on its exact
  source words.
- **It has existed before.** Legacy `DEAL_COMPARE`, `MARKET_RANGE`,
  `DEAL_TO_MARKET`, "What's market?" and the `market-metrics` /
  `row-market-stats` engines are all still in the tree but switched off. The
  semantics are worth keeping (denominator, absence, comparability, the
  sample size, evidence); the V1 code is not portable.
- **The V2 substrate is ready.** Facts, summaries, components and conclusions
  cells exist; `table-shapes.v3` gives 49 tables, 47 fixed row lists, 68
  vocabulary columns and 34 value columns. `buildTableView` already renders
  the units a comparison needs.
- **Three blockers.** (1) Release summaries do not carry conclusions; (2) the
  published read labels an agreement by its SEC URL, though parties and date
  are already in the source payload; (3) there is no published release yet,
  so market stats run on READY drafts until there is.
- **The shape.** Compare = the provision column first: the deal you are
  looking at, the reference set's comparison, exact codes/values/words,
  differences flagged. Market = the provision's cells over a reference set
  that answers the question, with a distribution, a percentile, a label, `n`
  and the composition; the comparison is never hidden.
- **Effort.** Two weeks for the first useful slice (compare + distributions),
  after one decision on conclusions-in-release and one on draft vs published.
  The sample-size line is always shown; no threshold suppresses or flags the label.
- **Decision needed.** The remaining questions are in section 10; each has a
  recommendation. The top three are draft-first vs published-first, the
  reference-set defaults, and whether conclusions are published into the
  release summary.

---

## 1. The two features in one sentence

| Feature | The question it answers | The unit |
| --- | --- | --- |
| **Compare** | "These agreements say different things about the same provision. What exactly does each say, and where do they part?" | One provision row: your deal, the reference set, and optionally a peer deal |
| **Market position** | "This provision sits somewhere in the corpus. Is it common, middle-of-the-road or unusual, and how many agreements actually answer the question?" | The provision's coded cells or values over a stated reference set, with a distribution |

They are one feature with two faces, and should share one read, one
reference-set definition and one evidence path. Compare without market is a diff; market
without compare is a statistic with no words behind it. The product's
differentiator is that every point in either view opens on its exact source
words.

---

## 2. The features that already existed

Ben is right that the documents and the code carry prior art. The legacy
surface was switched off rather than deleted. The Q4 evidence note
(`Q4-LEGACY-QUERY-COMPARE-EVIDENCE-2026-10-18.md`) records the state: legacy
Query answers 503 at every route, every page but `/query/provisions`
redirects, and Compare survives only as `?compare=` / `?market=1` on the
legacy review page, reachable by typing a URL. The prior features are
therefore design evidence, not a running system.

| Prior feature | Where it lives now | What it did | What to carry forward |
| --- | --- | --- | --- |
| `DEAL_COMPARE` | `lib/query/executors/deal-compare.js` | Two to four deals side by side, one row per provision type, field groups, per-cell `delta_severity` versus peers | Agreements as columns, one row per provision, differences flagged. Its field-level model does **not** transfer. |
| `PROVISION_CROSS_CUT` | `lib/query/executors/provision-cross-cut.js` | One provision type across every deal, as written | One-provision comparison is the natural first screen. |
| `MARKET_RANGE` | `lib/query/executors/market-range.js`, `lib/query/market-baseline.js` | Numeric stats (`min`, `p10`, `p25`, `median`, `p75`, `p90`, `max`), histogram, every deal's point, plus % of deal value and relative-months variants | The distribution shape, the stat vocabulary and the "every point has a quote" rule. |
| `DEAL_TO_MARKET` | `lib/query/executors/deal-to-market.js` | A deal's scorecard of `MARKET` / `OFF_MARKET` / `UNUSUAL` / `MISSING` / `NOT_APPLICABLE` against the cohort, with counts | The label vocabulary and the deal-level scorecard idea. |
| `FILTER_THEN_LIST` | `lib/query/executors/filter-then-list.js` | Deals filtered on a field condition | The filter form, later. |
| "What's market?" | `lib/query/whats-market.js`, `pages/query/whats-market/adhoc.js` | A question resolved to a provision/feature intent, then a corpus overview | The intent table; a later natural-language entry point, not the first build. |
| Legacy Compare columns | `components/review-v2/compareData.js`, `pages/review/[id].js` | Extra columns on a review page, market data contained | Only the idea of comparing beside a review. Do not revive the page. |
| `lib/feature-compare.js` | general cross-deal engine | Cohort statistics, `featureOutliers`, every point cited, **`offMarket` only when cohort n ≥ 12** | The old n=12 suppression rule. The product now flags a small sample and proceeds; the flag replaces suppression. |
| `lib/market-metrics/*` | contract + registry + audit | Explicit cohort scope/eligibility, absence-vs-unknown, seven result states, non-comparable reasons, coverage audit | The result-state and comparability vocabulary. Reuse the contract's discipline; do not port the V1 field engine. |
| `lib/row-market-stats/*` | calculation engine | Quantiles, distributions, semantic cohorts, money normalisation, dependency-ordered metrics | The aggregation semantics and the exclusion reasons. Not the V1 card/claim readers. |
| `CanonicalMarketRange` / query result page | `components/query/CanonicalMarketRange.jsx`, `pages/query/[kind]/[id].js` | Stat tiles, distribution bars, market/off-market styling | The visual grammar of a market strip, restyled to the product chrome. |

**What does not transfer.** The V1 unit is a provision card with
`ai_metadata.features` and a 698-name alias registry. The V2 unit is a fact
with verbatim components and a conclusions cell keyed by `table_key`,
`row_label`, `column_id`, `code`/`value`. There is no migration path for the
executors: the fields they filter on do not exist in V2. The useful transfer
is the *semantics* — denominator, absence, comparability, the sample size, evidence —
not the code.

---

## 3. What the V2 data can support today

### 3.1 The substrate exists

- **Facts.** A published fact carries `headline { label, summary,
  distinguishing_component_ids }`, `components[]` with UTF-8 byte spans,
  `section_reference`, `family_key`, `subtype_key`, `fact_type`, `statement`,
  `roles`, `canonical_value` and `coverage_only`
  (`lib/product/review-state.js` `compileReviewSummary`). The headline
  summary is the one-line reading Ben asked for.
- **Conclusions.** A fact may carry `conclusions { table_key, row_label,
  row_detail?, cells[] }` (`contracts/product/fact-conclusions.v1.json`),
  each cell one of a vocabulary `code`, a parsed `value { canonical, unit }`,
  a verbatim `text` or a `present` boolean, with `component_refs` and
  `component_ids` back to the words. Validated by
  `lib/product/fact-conclusions.js`; stored in `product_fact_conclusions`
  (immutable, per run and proposal) and in the proposal payload. The stored
  row carries `table_key`, `row_label` and `cells`; `row_detail` survives in
  the proposal payload only, so a read that needs limb sub-items must use
  the payload or add the column.
- **Tables.** `contracts/product/table-shapes.v3.json`, 29 operative
  sections, 49 tables, 47 fixed-row-list tables, 68 vocabulary columns, 487
  codes, 34 value columns (`AMOUNT`, `PERIOD`, `COUNT`, `DATE`, `PERCENTAGE`),
  8 boolean columns, 49 verbatim columns, 4 term columns. Row labels are the
  canonical axis the fixed-list design already provides; the unresolved limb
  names (Q5) sit in `row_detail`, not in `row_label`.
- **The viewer.** `lib/product/table-view.js` `buildTableView` already
  resolves a fact to its table and row, applies `absent_code` to a blank
  cell, attaches words to every cell, applies the column rules and emits
  `{ sections: [{ section_key, tables: [{ table_key, columns, rows }] }] }`.
  `PublishedSummary` / `ProvisionTables` / `EvidenceSidebar` are the render
  path; `ProvisionRail` is the section rail.

### 3.2 The gaps that block the feature

| Gap | Evidence | Why it matters |
| --- | --- | --- |
| **No release carries conclusions** | `compileReviewSummary` writes `components`, `headline`, `coverage_only`, `section_reference` and nothing else; `listPublishedLayeredFacts` reads only `release.summary` | The coded cells are the whole comparison/market surface. They currently live only in the run (`product_fact_conclusions`, proposal payload). |
| **No published release at all** | Manager handoff, 2026-10-23: Ben has not published a first review; production has never been written | The market feature has no denominator until releases exist. It can run on READY drafts, marked as drafts. |
| **Agreement label is a URL** | `listPublishedLayeredFacts` returns `agreement_label = retrieval_url`; `product_source_documents` has only the URL and hashes | A comparison of three SEC URLs is not a product. The parties and `agreement_date` *are* already extracted by `lib/product/sec-intake.js` into the source `payload`, but the published read does not expose them. |
| **No deal metadata** | No sector, size, structure or sponsor field on the product tables | Reference-set filters and money normalisation need it. Until then the set is "all released agreements", with date and structure taken from the agreement if at all. |
| **Vocabulary can drift** | `table-shapes.v3.json` is versioned; a release records the run's schema and prompt bundle | A code renamed or split in a later shape version must not silently merge with the old code. |
| **Limb names are not canonical** | Q5 open: 489 distinct limb names for 528 facts across two deals (finding (120)) | Start at fixed `row_label` level. Limb-level (`row_detail`) comparison waits on Q5. |
| **Only V9+ runs have conclusions** | V8 (NCS generation 4) carries none; V9 runs (Metsera generation 8, NCS generation 5) do | The feature is V9+ only. A V8 release reads as "no readout", not as "nothing stated". |

---

## 4. Feature A: Compare

### 4.1 The provision is the unit; three views, in order of build

The lawyer navigates by **provision** (the clause/term: "Company termination
fee"). A fact is one legal effect inside it; a cell is one coded attribute
(amount, trigger, payer). The cell is the unit of measurement, not the unit
of research. The screen is provision-first.

1. **Readout comparison (the backbone).** One provision table (e.g.
   Termination Fees), rows aligned by `row_label`, the deal you are looking
   at, the reference set's comparison, and optionally one compare deal; one
   cell per `column_id`. Codes and values are compared exactly. This is the
   first screen and the one that makes market possible, because the cell is
   the unit the distribution counts.
2. **Summary comparison (the reading).** One family/subtype (e.g. No-Shop),
   every accepted fact's `headline.summary` grouped by `fact_type`, each
   agreement's facts side by side, with "only in A" and "in all" markers.
   This is literally "compare the summaries" and works even where no table
   exists (V8, coverage-only families, Defined Terms).
3. **Whole-agreement comparison (later).** Every family at once, collapsed,
   with a difference count per family. This is a navigation surface, not a
   first build.

### 4.2 How rows align

| Axis | Key | Fallback |
| --- | --- | --- |
| Fixed-list table | `table_key` + `row_label` | — |
| Open-row table | `table_key` + `row_label` (the fact's own subject) | Normalise case/whitespace; never fuzzy-match by default |
| Sub-item / limb | `row_label` + `row_detail` | **Off until Q5.** Show sub-items as indented detail, not as an alignment key |
| One-per-agreement table | `table_key` (single row) | — |
| Summary layer | `family_key` + `subtype_key` + `fact_type` | If several facts share the key, show them as a group, not a forced 1:1 |
| Cross-table | not aligned | A fact whose readout lands on no table stays in the summary layer |

A row that exists in one agreement and not another is a first-class result:
`ONLY IN A`, `ONLY IN B`, or `NOT STATED` — never silently dropped. The
fixed-list tables make this safe because the row list is the shape's, not the
extractor's.

### 4.3 What "different" means

- **Coded cell:** different iff the `code` differs. Same code = same coded
  answer, not legal equivalence. The label is the vocabulary's; the words
  are each agreement's.
- **Value cell:** different iff the canonical value differs after the unit is
  reconciled. Show the number and the unit; never compare a percentage with a
  dollar amount. Dates compare as dates, periods as periods.
- **Verbatim cell:** different iff the exact words differ. This is a drafting
  diff, not a semantic one. Do not call one "stronger" or "market".
- **Summary layer:** different if the fact is absent or its headline differs.
  Do not compute a similarity score in v1. Exact identity is the honest
  signal; similarity is a separate deferred feature (precedent tracing).

The comparison must say "as drafted" and "same code", never "same
provision". The prior `delta_severity` vocabulary is useful for highlighting
but must not imply legal materiality.

### 4.4 The screen

```
Compare   [Agreement A ×] [Agreement B ×] [+ Add agreement]   Reference set: across the whole corpus (14) · as of 23 Oct 2026
Provision [Termination Fees ▾]     [x] Differences only     [Published only ▾]

                              Your deal — A (stock)      Compare with — B (cash + CVR)     Reference set
Company termination fee       3.0% of equity value        3.5% of equity value            n=14 · flagged
  Trigger · no-vote           Yes  · 2.3(a)(i)             No                              Yes 9 / 14
  Trigger · superior proposal  Yes                        Yes                             Yes 14 / 14
  Payer                       Company                    Company                         Company 13 / 14
  Sole and exclusive remedy   Yes                        No                              8 / 14
  [summary line per agreement, one line, click to open]
```

- The rail is the existing `ProvisionRail` (sections), not a new navigation.
- The table is the existing table grammar: subject, cells, pills, values,
  "as drafted" words. A comparison is `buildTableView` per agreement, then a
  merge on `row_label`; the merge is the only new pure function.
- Each cell opens `EvidenceSidebar` with **both deals'** facts, components,
  section text and review trail, side by side. The sidebar is already the
  contract; it needs the second deal's words.
- A "differences only" toggle hides rows whose cells agree, with a count
  ("6 of 11 rows differ").
- The summary line under each cell is `headline.summary` (one line, ≤15
  words by instruction, 18 by check). This is what makes it a comparison of
  summaries and not only of codes.

### 4.5 Cell states

Every comparison cell is in one of these states, and the state is shown:

| State | Meaning |
| --- | --- |
| `PRESENT` | The agreement has a valid fact with a readout cell here |
| `ABSENT_CODED` | No cell, but the table defines `absent_code`; the code is the legal answer (e.g. MAE carve-back `NO`) |
| `NOT_APPLICABLE` | The row is a deal feature this agreement does not have (CVR rows in a cash deal; election rows in a stock deal) |
| `NOT_STATED` | The agreement has a fact for the table but says nothing on this column, and no `absent_code` applies |
| `HELD` | The extractor proposed a fact and validation held it; show the reason, never count it as market |
| `UNKNOWN` | The agreement was not examined for this table, or coverage is unconfirmed |
| `NO_READOUT` | A valid fact exists but the run is V8 or the family has no table |

`ABSENT_CODED` is not `NOT_STATED`. The first is a legal answer the table
chose; the second is silence. The market denominator treats them
differently, and the comparison must too.

### 4.6 What Compare will not do

- It will not edit or decide anything. It is read-only.
- It will not rank agreements or call one "better".
- It will not align two differently worded clauses by meaning in v1.
- It will not compare across table-shape versions without a code map.

---

## 5. Feature B: Market position

### 5.1 The question, stated precisely

For one provision's cell — a code or a value — over a stated reference set of
agreements:

> Of the agreements that answer this question, how many give each answer (or
> what is the range of numbers), where does this agreement sit, and is there
> enough data to call it market, off-market or unusual?

The answer is descriptive evidence about the reference set. It is not advice
and not a statement about the whole M&A market.

### 5.2 Unit and denominator

| Metric kind | Unit | Eligible agreement | Denominator |
| --- | --- | --- | --- |
| `prevalence` | table row / fact type | The agreement was examined for the table and either has the row or has a confirmed absence | Answering agreements only |
| `categorical` | `(table_key, row_label, column_id)` | A valid fact with a readout cell, or an `absent_code` | Cells with a code |
| `numeric` | `(table_key, row_label, column_id)` | A valid fact with a parsed canonical value of a compatible unit | Values only |
| `boolean` | `(table_key, row_label, column_id)` | A valid fact with `present` true/false | Present + false |
| `verbatim` | `(table_key, row_label, column_id)` | A valid fact with the cell | Comparison only; no distribution |

The denominator is never "all agreements we happen to have". It is the
agreements that **answer** the question. Every result carries:

- `n` — answering agreements;
- `excluded` — by reason (`not_published`, `no_readout`, `not_applicable`,
  `not_stated`, `unknown`, `held`, `vocabulary_mismatch`, `unit_mismatch`);
- `as_of` — the release dates in the reference set.

This is the discipline the legacy `market-metrics` contract already worked
out (`lib/market-metrics/contract.js`): explicit cohort, eligibility,
`missingState` (`absent` vs `unknown`), and a non-comparable reason code. Its
result states are worth keeping verbatim:

`ready`, `no_occurrences`, `unique`, `insufficient_data`, `not_comparable`,
`unknown`, `error`.

Map them to the product's facts:

| Legacy state | Product meaning |
| --- | --- |
| `ready` | Distribution computed; label shown, with `n` and the sample-size line |
| `no_occurrences` | No agreement has the row/fact; no denominator |
| `unique` | Exactly one agreement answers; show the value, no distribution |
| `insufficient_data` | n is small; show counts, values and the label with `n`; no suppression |
| `not_comparable` | A gate failed: unit, vocabulary version, deal-specific row, ambiguous denominator |
| `unknown` | Agreements not examined, or coverage unconfirmed |
| `error` | A read or validation failure; never a silent zero |

### 5.3 Metric kinds

1. **Prevalence** — "how common is this provision?" Share of answering
   agreements with the row/fact. Show the rate and the count; a label
   (`COMMON`/`UNCOMMON`) only if Ben wants one; flag a small sample.
2. **Categorical** — "which treatment is market?" Frequency of each
   vocabulary code, with labels and share. The `absent_code` counts as a
   code when the table defines it (e.g. MAE carve-back `NO`).
3. **Numeric / period / percentage** — "how long / how much?" `n`, min,
   p10, p25, median, p75, p90, max, mean. The deal's percentile rank and,
   a band label, with `n` and the sample-size line.
4. **Boolean** — a two-code categorical.
5. **Multi-select** — later: codes an agreement uses together (e.g. the acts
   a no-shop prohibits). Count per agreement, not per cell; requires an
   explicit "any of" definition.
6. **Money** — a numeric subtype. Raw dollars are not comparable across deal
   sizes. Show raw only with a warning, or normalise to % of deal value /
   equity value when that denominator is captured. The legacy engine did
   this (`percent_of_deal_value`, `stratify_by_basis`); V2 has no deal value
   yet, so the first version shows raw and says so.

### 5.4 Comparability gates

A metric is `not_comparable` when any of these fails:

- **Same table and row** in the same `table-shapes` version (or a code map).
- **Same value kind and unit** (`{ canonical, unit }`); a percentage is not
  a dollar amount, a 30-day period is not a 30-day look-back.
- **Same semantic basis**: termination fee as % of equity value vs % of deal
  value; per-share vs aggregate; outside date vs extended outside date.
  The column's `value_kind` is coarse; the cell's unit and the row label are
  the check.
- **Deal-type applicability**: a CVR row in a cash deal is
  `NOT_APPLICABLE`, not "No". A tender-offer row in a one-step merger is
  `NOT_APPLICABLE`. Stratify or exclude; never count as a negative.
- **Coverage**: the agreement was actually examined for that table. A
  `coverage_only` family or a V8 run is `NO_READOUT`, not `ABSENT`.
- **Vocabulary version**: a code from table-shapes v3 must not be pooled
  with a code from a later version without a map.

### 5.5 Labels and sample size

The legacy rule was **suppression** at `n >= 12`. Ben's decision of
2026-10-23 is to drop the trigger: show the label, the distribution and `n`
at every sample size, and let the lawyer judge. A lawyer looking for
precedents wants to see what the deals say even when there are only five of
them; a threshold that hides the comparison is worse than a number the lawyer
can see.

Keep the label bands (`lib/query/market-baseline.js` `scoreValue`):

- numeric: `p25 <= value <= p75` → `MARKET`;
  `p10 <= value < p25` or `p75 < value <= p90` → `OFF_MARKET`;
  outside `p10..p90` → `UNUSUAL`;
- categorical: the top two codes → `MARKET`; a code used more than once but
  not top two → `OFF_MARKET`; a singleton → `UNUSUAL`.

Always show the distribution, the label, the percentile, `n` and the
composition. There is no `SMALL SAMPLE` flag and no threshold that suppresses
or marks the label. When `n` is small, the sample-size line says "3 deals" and
the wording says "read the range"; it never says "market standard". The
sample size is part of the result contract, so it survives the export.

### 5.6 Percentile and wording

- Percentile rank: `(count below + 0.5 × count equal) / n`, shown as
  "higher than 3 of 4" and "p75" only when n is large enough for a quartile
  to mean something.
- Wording, with a larger set:
  "Within the middle 50% of 22 released agreements (p25 2.8%, p75 3.6%)."
- Wording, with a small set:
  "3 of 4 released agreements say Yes (3 deals). Read the range."
- Wording for a missing answer:
  "Not stated in 2 of 4 agreements; not counted in the denominator."
- Never: "the market says", "you should", "off-market" without a reference
  set, an `n` and a date.

### 5.7 Reference set and filters

The product calls this the **reference set** (Ben, 2026-10-23: "the lawyer
should pick the comparison set"); the statistics call the same thing the
cohort. Default: **the current published release of every agreement**, one
release per agreement. Filters, only from metadata that exists:

| Filter | Available today? | Note |
| --- | --- | --- |
| Published vs READY draft | Drafts yes, published none | Drafts marked "draft" in every result |
| Signing year | Yes, from `agreement_date` in the source payload | Needs the read to expose it |
| Deal structure (cash / stock / mixed / election / tender) | Derivable from facts later; not a field | Add when the structure table is trusted |
| Sector / size / sponsor | No | Do not invent; add only if captured |
| Same table-shape version | Yes, from the release's run | Default: exclude other versions, or map |

The reference-set line is always visible: "Compared with 4 published
agreements (2 cash, 1 stock, 1 election), signed 2024–2026." If the set is
"all released", say so.

### 5.8 The screen

Two surfaces, one read:

1. **On the provisions page / comparison cell**: a small badge or strip next
   to the coded cell:
   `p50 of 4 · 2 of 4 say Yes` or `MARKET · middle 50% of 14`.
   Click opens the market panel.
2. **Market panel** (drawer or page):
   - the metric (table, row, column, deal's value/code);
   - the reference set (n, filters, exclusions, as-of);
   - the distribution (bars for codes, dot plot / histogram for numbers)
     with the selected agreement marked;
   - the stats and the percentile;
   - the label, `n` and the sample-size line;
   - every point's words and a link to its sidebar;
   - the reasons any agreement is excluded.

```
Market · Company termination fee, amount
Reference set: 4 published agreements · cash and stock · 2025–2026
[3.0%]  ●━━━━●━━━━━━━━━━━━━━━━━━  n=4
        2.5%   3.1% median      3.8%
Your deal: 3.0% · lower than 2 of 4 · n=4, read the range
Excluded: 2 (1 not stated, 1 held)
```

### 5.9 A worked example (illustrative, not real deals)

Suppose three released agreements, all with termination-fee facts:

| Agreement | Amount | Trigger: no-vote | Payer |
| --- | --- | --- | --- |
| A | 3.0% of equity value | Yes | Company |
| B | 3.5% of equity value | No | Company |
| C | 2.8% of equity value | Yes | Company |

- `amount`: n=3, min 2.8, median 3.0, max 3.5. B is p83. The label is
  shown with `n=3`. Wording: "3 of 3 state an amount; the median is 3.0% of
  equity value. 3 deals: read the range."
- `no-vote`: Yes 2 of 3 (67%), No 1 of 3. Show the counts and `n=3`; no
  "market standard" wording.
- `payer`: Company 3 of 3. `ready`; a one-code distribution reads "Company
  in 3 of 3", with `n=3`.

This is a useful answer even at n=3, and it does not overclaim. That is the
test for the design.

### 5.10 What Market will not say

- It will always show `n`, the composition and the raw count; it will not
  hide the distribution or apply a threshold.
- It will not pool across table-shape versions or units.
- It will not treat a missing fact as a negative.
- It will not count held or rejected facts.
- It will not normalise money by deal value until a deal value exists.
- It will not give advice or a recommendation.

---

## 6. Data and read path

### 6.1 Where the data is

| Data | Today | For this feature |
| --- | --- | --- |
| Accepted facts, headline, summary | `product_agreement_releases.summary` (current release head) | Read as is |
| Conclusions cells | `product_fact_conclusions` (run/proposal) and proposal payload; **not** in the release summary | Publish into the summary, or join by `run_id` |
| Section text for evidence | `product_source_spans` by the release's `run_id` | Join by run |
| Agreement identity | `product_source_documents.payload` (`parties`, `agreement_date`, `filing_accession`) | Expose on the read; no new capture |
| Review trail | `product_review_sessions` / revisions | Join by run for the sidebar |
| Table shapes | `contracts/product/table-shapes.v3.json` | Version with the release |

### 6.2 The one upstream decision: conclusions in the release

Two ways, with a recommendation:

1. **Publish conclusions into the release summary** (recommended).
   `compileReviewSummary` adds `conclusions` to each fact, and the
   publication validation accepts it. The release becomes self-contained:
   a market result is reproducible from the release alone, no run table can
   change under it, and the read stays one table. Cost: a few hundred
   kilobytes per agreement; `summary_id` changes for new releases (fine;
   old releases keep their own).
2. **Join the release's run to `product_fact_conclusions`.** No summary
   change, but the read depends on run tables and the release is not
   self-contained. The conclusions rows are already immutable, so this is
   safe, just less clean.

Recommend (1), and add a flattened `product_release_cells` projection at
publication only if the corpus grows past a few dozen agreements. At tens of
agreements, a JSONB read and an in-memory index are cheap.

### 6.3 Proposed reads

**Comparison**

```
GET /api/product/compare
  ?agreements=<source_document_id>,...   (2–5)
  &table=<table_key> | &family=<family_key>&subtype=<subtype_key>
  &published=true|false
```

```json
{
  "schema_version": "PRODUCT_COMPARISON/V1",
  "reference_set": { "agreements": [ { "source_document_id": "...", "label": "...",
    "parties": ["..."], "agreement_date": "...", "run_id": "...",
    "released_at": "...", "published": true } ], "as_of": "..." },
  "table": { "table_key": "...", "section_key": "...", "columns": [ ... ] },
  "rows": [ {
    "row_key": "table_key:row_label",
    "row_label": "...",
    "row_detail": null,
    "cells": [ {
      "source_document_id": "...",
      "state": "PRESENT",
      "code": "YES", "label": "Yes",
      "value": { "canonical": 3.0, "unit": "percent" },
      "summary": "...", "words": "...", "component_ids": [ "..." ],
      "fact_id": "...", "section_reference": "...",
      "market": { "state": "insufficient_data", "n": 3, "label": null,
                  "percentile": 0.5, "distribution": [ ... ] }
    } ]
  } ],
  "differences": { "row_count": 11, "differing_rows": [ ... ] },
  "excluded": [ { "source_document_id": "...", "reason": "no_readout" } ]
}
```

**Market**

```
GET /api/product/market
  ?table=<table_key>&row=<row_label>&column=<column_id>
  &reference_set=published|drafts|all
  &agreements=<id>,...        (optional; the metric's points)
```

```json
{
  "schema_version": "PRODUCT_MARKET_POSITION/V1",
  "metric": { "table_key": "...", "row_label": "...", "column_id": "...",
              "kind": "categorical", "value_kind": null },
  "reference_set": { "definition": "across the whole corpus", "n": 4, "as_of": "...",
              "excluded": [ { "reason": "not_stated", "count": 2 } ] },
  "state": "insufficient_data",
  "n": 4,
  "label": null,
  "sample": { "n": 4, "composition": "8 cash, 5 stock, 1 mixed" },
  "distribution": [ { "code": "YES", "label": "Yes", "count": 3,
                      "share": 0.75 } ],
  "stats": null,
  "points": [ { "source_document_id": "...", "code": "YES",
                "fact_id": "...", "words": "..." } ],
  "wording": "3 of 4 released agreements say Yes. Too few agreements to call this market or off-market.",
  "reasons": []
}
```

Both reads are authenticated (session or internal bearer), read-only, and
same-origin. They never expose credentials, raw bytes or unreleased runs to a
browser without the publish flag.

### 6.4 Draft mode

Before the first release, run the same reads over READY runs:

- `?published=false` selects the latest READY generation per source document.
- Every result is marked `DRAFT` in words and visually.
- The read reuses `previewFactsFromWorkspace` (one run) in a loop, or a new
  multi-run loader with the same shape.
- In draft mode every result is marked `DRAFT`; the sample size is still
  shown, and a label is marked "draft corpus".

This lets Ben see the feature on the READY V9 runs without pretending
they are published.

---

## 7. Build order

**Timing.** The plan puts Query on layered facts first after the internal
release (finding (163)); nothing here asks to pull it forward. The draft mode
is how the feature can be demonstrated before a release exists, if Ben
chooses to spend the time; the default remains after launch. The estimates
below are one implementer familiar with the product code.

The first useful slice is two weeks for one implementer, after the two
prerequisite decisions. It is deliberately behind the launch path; nothing
here changes extraction.

| Step | Work | Effort | Depends on | Demonstrable |
| --- | --- | --- | --- | --- |
| **0. Decisions** | Conclusions in release; draft vs published; reference-set metadata; comparison default (provision) | 1–2 days | Ben | — |
| **1. Read** | Expose conclusions and identity on the published read; a multi-run draft loader; flatten cells into a queryable shape; tests | 3–5 days | Step 0 | `GET /market` returns a real distribution |
| **2. Compare** | Merge `buildTableView` outputs by row; differences; picker; evidence sidebar; page body test | 5–7 days | Step 1 | Two agreements side by side on Termination Fees and No-Shop |
| **3. Market metrics** | Pure functions: prevalence, categorical, numeric, boolean; states; reference set; exclusions; percentile; sample-size line; wording; tests | 4–6 days | Step 1 | A market strip on every coded cell |
| **4. Market UI** | Badge/strip, panel, distribution, reference-set line, exclusions, browser check | 3–4 days | Steps 2–3 | The full compare + market screen |
| **5. As the corpus grows** | Reference-set filters (industry, lawyer, size, year, structure); vocabulary code map; flattened cell table / GIN index | 1–2 weeks | Releases | A reference set the lawyer can refine and save |

The design note's step 1 (the cell query) is a prerequisite for the filter
form but not for Compare/Market: the comparison read can select agreements
and a table directly. Build the cell query in parallel if the filter surface
is wanted at the same time.

**What can be shown early:** with two agreements, Compare is fully useful
and Market shows counts, distributions and percentile ranks. The first
sample size is always shown; there is no threshold that suppresses the label
or the distribution. Be explicit about the n in the UI and the export.

---

## 8. Tests and verification

No code changed for this note, so no checks are due under plan section 9.
When built:

- **Pure metric tests** with fixed fixtures: three agreements, known cells;
  assert `n`, distribution, median/percentile, every state, the sample-size line, the
  exclusion counts. No database, no model.
- **Alignment tests**: a row present in one agreement only; an `absent_code`
  cell; a `NOT_APPLICABLE` CVR row; a held fact; a V8 release with no
  readout.
- **Comparability tests**: unit mismatch, value-kind mismatch, vocabulary
  version mismatch, coverage-only family.
- **Read tests**: a fake store with two releases and their conclusions;
  published vs draft; identity (parties/date); no service credentials in the
  response.
- **Page-body tests** in the style of `tests/product-published-facts-query.test.js`
  (render `CompareBody` / `MarketPanel` without a router).
- **One browser check** of the compare flow and the evidence sidebar, per
  the operating rules.
- **No database change** unless conclusions are published into the release
  or a flattened cell table is added; then one migration test against an
  inactive Postgres and a rollback check.

---

## 9. Risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| A market label on too few deals | "Off-market" on n=2 is false authority | Always show `n`, the composition and the range beside the label; never hide the distribution; no threshold trigger |
| False equivalence | Two different clauses coded the same look "the same" | Say "same code", show both sets of words, never "same provision" |
| Missing treated as negative | Inflates prevalence or creates a false "No" | `ABSENT_CODED` vs `NOT_STATED` vs `NOT_APPLICABLE` vs `UNKNOWN`; denominator is answering agreements only |
| Vocabulary drift | Codes silently merge | Version the table shape on every result; code map or exclude |
| Money without a denominator | A $300m fee means nothing without deal size | Raw only with a warning; capture deal value before % normalisation |
| Draft data read as published | A lawyer relies on an unaccepted fact | Draft flag in every result; published-only is the default once releases exist |
| Release immutability | A release cannot be re-derived if the query changes | Publish conclusions; record the table-shape version; keep the metric definition versioned |
| Performance | JSONB scans at hundreds of deals | Fine at tens; flatten/index when the corpus grows |
| Legal wording | "Market" can read as advice | Descriptive wording, reference set + date, no recommendation, no "should" |
| Scope creep into precedent tracing | Similarity/attribution is a different feature | Keep it out; compare exact codes and words only |

---

## 10. Decisions for Ben

Each with a recommendation, so a one-line answer is enough.

1. **Draft or published first?**
   Recommend: if the feature is built before the first release, run it on
   READY drafts marked DRAFT; once releases exist, published is the default
   and drafts become an explicit toggle. The market label is published-only
   in both cases once at least one release exists.
2. **What is the primary comparison: the table or the summary?**
   Recommend: the table (coded cells) as the backbone, with each cell's
   `headline.summary` and words beneath. The summary-only view is the
   fallback for facts without a table.
3. **Agreements as columns or as stacked groups?**
   Recommend: columns for 2–4 agreements, stacked groups on narrow screens
   and for more than four.
4. **Should the screen show a warning below a particular n?**
   Ben's decision of 2026-10-23 is to drop the trigger. The recommendation is
   to show `n`, the composition and the range always, with no threshold-based
   flag; the lawyer judges the sample.
5. **How should money be compared?**
   Recommend: raw amount first, with a visible warning that it is not
   size-normalised; capture deal value (or equity value) at intake and add
   % of deal value as the primary basis later.
6. **Which reference-set filters matter first?**
   Recommend: published/draft and signing year now (both available); deal
   structure when the structure table is trusted; sector/size only when
   captured. Do not invent metadata.
7. **Should prevalence get a label?**
   Recommend: no label in v1. Show "present in 9 of 14" and the share.
   A `COMMON`/`UNCOMMON` label needs a product definition of "common".
8. **Conclusions in the release, or join the run?**
   Recommend: publish them into the release summary; the release stays
   self-contained and reproducible.
9. **What happens when a vocabulary changes?**
   Recommend: show the table-shape version on every result and answer older
   releases through a code map; do not silently pool codes.
10. **Does the comparison ever include held or rejected facts?**
    Recommend: no for market; a separate "what the extractor held" view can
    exist for review, but it is not a market denominator.
11. **Is a natural-language "what's market?" entry point wanted now?**
    Recommend: later. Build the form/table selection first; the legacy
    intent table is the model for the sentence layer.
12. **Where does this live in the plan?**
    Recommend: add it to the future-feature list as one entry ("Compare and
    market position on layered facts"), not to the Phase 0–6 checklist.
    The manager owns that edit; this note does not make it.

---

## 11. Addendum, 2026-10-23: Ben's answers

The mockup review settled seven points. They refine, and in two cases reverse,
the sections above; the task brief
`COMPARISON-MARKET-BUILD-TASK-2026-10-23.md` carries the build.

1. **Draft intake is in scope, in any form.** Paste, `.docx` or `.pdf`; the
   lawyer can name a specific provision, several provisions, or ask for the
   full document (all provisions). The draft is aligned to the named
   provisions and compared with the reference set. It is stored under the
   user's account with a delete action, and is a `DRAFT_INPUT`: never
   published, never added to the reference set, never counted in a market
   statistic. This adds a draft path beside the processed-agreement path.
2. **The reference set is the lawyer's.** It is a prebuilt set (by industry,
   for example biotech; by lawyer, for example Barshay; by size), refined by
   adjustable size bands, year, industry, lawyer and structure, or replaced
   by a hand-picked set or two deals. The size adjustment follows the PW
   biopharma bundle's pattern: year selects, preset value pills plus a
   custom minimum, small controls and a live summary line.
3. **Reference-set mode shows the deal being looked at plus the visual
   distribution of the other options.** There is no second deal column in
   that mode; the sidebar shows the deal's words, its value and rank, a dot
   strip or stacked bar against the set, the ranked options with counts, and
   an example clause behind each option. The two-deal mode is the side-by-side
   view, and there the sidebar shows both deals' text. This reverses the
   earlier note's assumption that the sidebar always shows both deals.
4. **Export is the table plus the text.** Word carries the comparison table
   as shown and a schedule of the **full section text** for each deal, the
   cited words highlighted. Excel carries the comparison, the provisions and
   the reference set. CSV is the flat data.
5. **The small-sample trigger is dropped.** There is no threshold that
   suppresses the label or triggers a `SMALL SAMPLE` flag. The label, the
   distribution, `n` and the composition are always shown; a thin set says
   "read the range", not "market standard". This reverses §5.5's earlier
   flag-and-threshold design.
6. **The lawyer dimension comes from the notice section.** "By lawyer (e.g.
   Barshay)" means **any deal from that lawyer**. The extractor already
   exists: `lib/parser-v2/notice-advisors.js` reads each party's Notices block,
   captures the "with a copy to:" firm and the "Attention:" lawyers, and the
   legacy path writes `deals.metadata.advisors_v2` (`buyer_firm`,
   `buyer_lawyers`, `seller_firm`, `seller_lawyers`, `buyer_firms`,
   `seller_firms`, `raw`). The product path does not store it today. If the
   shared database carries the legacy row, join `deals.metadata.source_url` to
   `product_source_documents.retrieval_url`; otherwise run the extractor on the
   product's Notices section and store a normalized `product_deal_lawyers`
   table keyed by `source_document_id` and `lawyer_key`. This is a
   prerequisite, not a filter.

7. **The visual source is the PW redesign comp.** The monitor's
   `corpus-pw-compare` comp (23 October) replaces the black-rail compare
   mockup. The build uses its navy/white tokens, masthead, white rail, set
   bar, square table, right market panel, monochrome pills and Source Serif
   reading. The states the comp does not show (draft clause, adjust set,
   export) are in `reports/mockups/corpus-pw/integration/`, with a coordination
   note for the redesign chat.

Two work packages follow: deal metadata for the sets (WP0b) and draft clause
intake (WP2b).

## 12. Out of scope

- **Precedent tracing / source attribution / clause-level markup reuse.**
  Already a separate deferred feature. Similarity is evidence of possible
  drafting history, not proof; it must not be folded into "market".
- **Legal equivalence or advice.** No "this is better", no "you should
  accept", no ranking of agreements.
- **Full-text semantic diff.** Exact words only in v1; a semantic diff is a
  later, separately validated feature.
- **Deal-value normalisation** until a deal value is captured.
- **CVR product.** Separate product, per Ben's 2026-10-18 direction.
- **A whole draft agreement in v1.** Draft clause intake is in scope; a whole
  draft agreement needs its own structure and is a later step.
- **Editing or deciding from the comparison.** Read-only.
- **Cross-release pooling without a code map.**
- **A new programme status document or checklist.** This is a dated design
  note only.

---

## 13. Sources read for this note

- `docs/core/{PLAN,OPERATING-RULES,LEGAL-RULES,CODEBASE-GUIDE}.md`
- `docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`
  (findings (121), (163), the future-feature list)
- `docs/codex-program/notes/QUERY-ON-LAYERED-FACTS-DESIGN-2026-10-18.md`
- `docs/codex-program/notes/Q4-LEGACY-QUERY-COMPARE-EVIDENCE-2026-10-18.md`
- `docs/codex-program/notes/MANAGER-HANDOFF-2026-10-23.md`
- `docs/codex-program/notes/module-reads/header-audit-ab.md` (the old n=12 suppression floor)
- `docs/codex-program/notes/asset-sweep-lib-subdirs.md` (the market engine)
- `/Users/bengoodchild/Downloads/pw-biopharma-market-bundle.zip` (the PW
  biopharma market site; the year/size adjustment pattern in `deckext/deck.js`)
- Code: `lib/product/{review-state,phase-3-store,phase-2-store,table-view,fact-conclusions,provisions-preview}.js`,
  `pages/query/provisions.js`, `components/product/{PublishedSummary,ProvisionRail,EvidenceSidebar}.jsx`,
  `contracts/product/{fact-conclusions.v1,table-shapes.v3}.json`,
  `lib/market-metrics/{contract,adapter}.js`, `lib/row-market-stats/aggregate.js`,
  `lib/query/{market-baseline,whats-market}.js`,
  `lib/query/executors/{deal-compare,market-range,deal-to-market,provision-cross-cut}.js`,
  `lib/feature-compare.js`,
  `supabase/migrations/20260913020000_product_fact_conclusions.sql`,
  `supabase/migrations/20260905070000_product_phase_3_review.sql`.
