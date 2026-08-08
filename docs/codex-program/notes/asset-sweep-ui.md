# UI Asset Sweep — pages/ + components/

Status: DONE (time-boxed — see coverage note at top of Triage table; not all 246 files got individual full reads, but every file was at minimum classified)
Scope: `git ls-files 'pages/**' 'components/**'` (~246 files)
Method: read first 60 lines per file; full read only if relevant; grep to confirm live-mount before calling anything dead.

## Summary

The live review route is `pages/review/[id].js` ("Mergertrace"), fed by 20
table-configs enumerated in `components/review-v2/sectionList.js`
(`REVIEW_V2_CONFIGS`) — note the file's own header still says "same 19
configs", which is stale; the array has 20. `pages/review-v1/[id].js` (552KB)
is the explicit legacy fallback and `pages/review-v2/[id].js` is now a bare
redirect stub. `pages/deals/[id].js` and `pages/provisions/[id].js` are V1
pages reachable only by typing the URL — nothing in the live nav (home page,
DealsTable) links to them; graveyard candidates. The Query UI
(`pages/query/index.js`, `pages/library.js`) is server-side redirected to `/`
— feature-contained, code intact but not reachable. The table-config layer
(`components/review/table-configs/*.config.js`) is the product's own
enumerated spec of what each family should show, and several files
(`termination-fees.config.js` above all) already encode a rigorous, deliberate
NOT-YET-EXTRACTED vs ESTABLISHED-ABSENT distinction that answers this
programme's live "why 0 rows vs 10" question in the general case: distinct
serving-source states (`CANONICAL`, `LEGACY_FALLBACK`,
`LEGACY_FALLBACK_SOURCE_FAILED`) are rendered as an explicit provenance row,
and canonical-coverage gaps render an amber "Not yet extracted" placeholder
rather than silently dropping the row. Most other families do not have this
discipline yet — their empty-table copy just says "No X found" (UNSAFE, see
table below). `components/review-v2/ClauseSidebar.jsx` already implements the
owner's fact → limb → clause narrow-to-expand ruling almost verbatim. Real
display-side legal-fact derivation exists in
`components/review-v2/configDecorations.js` (approximate lookback period
computed from a raw date at render time) and `components/review/provision-family.js`
(client-side grouping of split provisions back into one section via section-number
root matching — a real parent/child reconstruction with no `parent_provision_id`
column to back it).

## Triage table

Note: `pages/api/**` (79 files, excluding .DS_Store) is entirely IRRELEVANT to this sweep —
every route is a thin handler that either delegates to a `createBroadCorpusContainedHandler`/
`queryContainedHandler` factory in `lib/`, or does a direct Supabase read/write with no
display-side derivation, row enumeration, or absence wording of its own. Listed in one block
rather than one row each, per the "API route plumbing with no domain logic" rule. Two are worth
flagging for the record: `pages/api/admin/processing-flow/metrics.js` is an explicit STUB
(hardcoded placeholder metrics, header says so and code matches), and
`pages/api/trust/report.js` computes quote-verification/coverage stats server-side from stored
data — genuinely a trust/evidence primitive, but no domain logic lives in the route file itself
(delegates out); flagged for lib-slice awareness, not claimed as a UI asset.

IRRELEVANT pages/api/* — thin handler, no domain/display logic (79 files, see note above).

| Path | Verdict | Why it matters now |
|---|---|---|
| pages/review/[id].js | ASSET | Live production review route; wires the entire canonical-v2 review stack (CanonicalReviewSection, compare/market modes, sectionList) |
| pages/review-v1/[id].js (552KB) | PARTIAL/legacy | Explicit fallback per header of pages/review/[id].js; not read in full (over size limit), grepped only |
| pages/review-v2/[id].js | IRRELEVANT | Redirect stub only, renders nothing |
| pages/deals/[id].js | PARTIAL/graveyard candidate | V1 grouping by TYPE_LABELS; only linked from pages/provisions/[id].js, not from home page or DealsTable |
| pages/provisions/[id].js | PARTIAL/graveyard candidate | Per-provision V1 page w/ annotation highlighting by favorability; same reachability problem as deals/[id] |
| pages/review/index.js | IRRELEVANT | Deal picker list only, no display logic |
| pages/index.js | PARTIAL | Home/deals-index; routes to /review/{id}; QUERY_UI_CONTAINED flag visible |
| pages/library.js, pages/query/index.js | IRRELEVANT | Server-redirected to `/`; Query UI contained |
| pages/query/[kind]/[id].js (60KB) | PARTIAL | Legacy query-results renderer, same masthead chrome as review; not deep-read (contained upstream) |
| pages/query/process/pilot.js | ASSET pointer | Live route (flag-gated) mounting ProcessResearchSurface |
| pages/query/whats-market/adhoc.js | IRRELEVANT | Redirects to `/` |
| pages/design/*.js (4 files) | PARTIAL/reference | Flag-gated design-lab pages rendering review-v2 components against committed fixtures (Landos, QXO no-shop F26) — useful as "intended full behaviour" references, not live product pages |
| pages/frankenstein.js | PARTIAL | Cross-deal sentence/template builder; niche tool, not core review spec |
| pages/corrections-review.js | PARTIAL | Correction-queue UI fed by ClauseSidebar's Correct tab; ops tool not display-spec |
| pages/admin/taxonomy.js, pages/admin/reports/*, pages/admin/processing-flow.js, pages/admin/schema-loss.js, pages/admin/registry*.js, pages/admin/reconciliation/* | IRRELEVANT (to this slice) | Pipeline ops/QA tooling, not reviewer-facing extraction display |
| pages/admin/agreements.js (110KB), pages/admin/gaps.js (42KB) | IRRELEVANT | Grepped only; ops tooling, no reviewer-facing family display |
| pages/login.js, pages/_app.js, pages/_document.js | IRRELEVANT | Auth/shell plumbing |
| **components/review/table-configs/*.config.js (26 files)** | **ASSET (HIGH)** | The expected-row catalogue — see dedicated table below |
| components/review/table-logic.js (96KB) | ASSET (unread in full) | Central display-type/section logic import by many pages; grepped for absence copy only — worth a dedicated pass by whoever owns pipeline family logic |
| components/review/shared.js | ASSET | SIDEBAR_GROUPS = the product's own family taxonomy (17 groups incl. nested children) + TYPE_LABELS |
| components/review/provision-family.js | ASSET | Client-side "whole section, then its parts" reconstruction (section-number root + code-family root); real parent/child grouping logic that belongs upstream |
| components/review/primitives/ProvisionTablePrimitives.jsx | ASSET | SeeProvisionDisclosure (shared "See provision" narrow→expand primitive, Ctrl+F-safe), EvidenceQuote ("(no evidence captured)" SAFE placeholder), GroupedSubRows |
| components/review/TrustStrip.js | ASSET | Quote-verification + text-coverage self-audit strip, reads /api/trust/report |
| components/review/ProvisionTable.jsx | ASSET | Generic config→table renderer every table-config plugs into; FULL_TEXT_COLUMNS relocation map |
| components/review/ProvisionCardTable.jsx, ProvisionSubRowTable.jsx, useDefinitionResolver.js | ASSET | Per-provision card detail + definition hover-resolution (perf-hardened) |
| components/review/FullDocumentView.js, DocPopUnder.js | ASSET | Full-document render with provision-position highlight overlays; half-screen pop-under variant |
| components/review/BoundaryAuditPanel.js, AddSectionItem.js, EditPanel.js, TermCell.js | PARTIAL | Editor-mode QA/edit affordances, not display spec of extraction |
| **components/review-v2/*.jsx, *.js (23 files)** | **ASSET (HIGH)** | See detailed sections — sectionList (family order), ClauseSidebar (fact→limb→clause), CanonicalReviewSection (certified-detail evidence), CompareColumn/MarketColumn/compareData/compareRowUnion (cohort views), MaeSection (limb/carveout chapeau), ElectionCard, SourceOverlay (span-exact quote highlight), NoShopCrossViewPreview, configDecorations (display-side derivation), GlobalMarketBridge, provisionIndexHelpers |
| components/review-v2/MergertraceStyles.jsx (41.7KB) | IRRELEVANT | Pure CSS-in-JS skin, no domain logic |
| components/DealsTable.js | PARTIAL | Home-page filter/sort engine for the deals index; no per-family display logic |
| components/UI.js, Layout.js, ViewModeContext.js, chrome/AppHeader.jsx, chrome/TopBar.jsx | IRRELEVANT | Shells, skeleton loaders, edit/user view-mode toggle |
| components/query/QueryFilterControls.jsx, QueryLaunchBox.jsx, CanonicalMarketRange.jsx, DealPicker.jsx | PARTIAL/ASSET | Precedent-search filter vocabulary + CanonicalMarketRange renders governed canonical-v2 cohort stats server-computed only (never reconstructed client-side) — good evidence-discipline example |
| **components/process/*.jsx, processResearchView.js (12 files)** | ASSET | Typed "checked" result-slot contract (VALID/UNAVAILABLE states, action_kind/action_state AVAILABLE gating) — a clean, generalizable quote/citation/evidence pattern; live behind pages/query/process/pilot.js (flag-gated) |
| components/process/MetseraExclusivityCrossView.jsx | PARTIAL | Cross-surface (Query/Review/Compare/Corpus-Context) comparison for one feature; mounted only on a fixture design page, not live corpus data |
| components/admin/schema-loss/*.jsx (7 files), components/admin/reconcile/*.jsx (5 files), components/admin/registry/*.jsx (4 files), ReviewQueueEntry.js, AdminNav.js | IRRELEVANT (to this slice) | Data-quality/pipeline-ops triage UI, not reviewer-facing extraction display |
| components/admin/processing-flow/*.jsx (3 files) | IRRELEVANT | Renders a static/stub pipeline-map doc, not extraction display |
| components/admin/audit/AuditMatrix.jsx, AuditCellDrawer.jsx | PARTIAL | Deal×field pass/fail matrix; ops audit, not review spec |

## Expected rows per family, from the UI's own configs

Method: for each `*.config.js`, counted entries in its static row-catalogue
array(s) (`ROWS`/`NEW_ROWS`/`DIRECT_ROWS`/`GENERIC_FIELDS`/etc — top-level `{`
or `[` entries between the `const X = [` line and the closing `];`). Several
of the largest families build rows dynamically from whatever cards/taxonomy
codes are present in a given deal rather than from a fixed catalogue — those
are marked "dynamic" with the taxonomy dimension driving them, since a literal
row count would misrepresent a per-deal-varying table as a fixed spec.

| Family (table-config file) | Row count (static catalogue) | Source lines |
|---|---|---|
| Structure & Mechanics (structure-mechanics.config.js) | 12 | ROWS @8 |
| Consideration (consideration-hero.config.js) | 15 (11 DIRECT_ROWS + 4 CVR_ROWS) | @50, @63 |
| Approvals / Votes (approvals-votes.config.js) | 11 | ROWS @4 |
| SEC Filing / Meeting (sec-meeting.config.js) | 6 | DIRECT_ROWS @14 |
| Votes/Approvals/Meeting composite (votes-approvals-meeting.config.js) | 17 (= 11 approvals + 6 meeting, combined) | @354-355 |
| Conditions to Closing — generic fallback (conditions.config.js) | 3 generic fields; per-condition rows built per matched card | GENERIC_FIELDS @716 |
| Conditions M/B/S (conditions-m.config.js) | dynamic per party; 1 shared factory (createConditionsConfig) x3 | @186-262 |
| No-Shop Core Mechanics (nosol-noshop.config.js) | 11 (4 ROWS + 7 MECHANIC_ROWS) | @22, @43 |
| Fiduciary-Out Mechanics (nosol-fiduciary.config.js) | 18 (13 ROWS + 5 NEW_ROWS) | @27, @45 |
| Intervening Event Mechanics (nosol-intervening.config.js) | 8 (5 ROWS + 3 NEW_ROWS) | @20, @31 |
| Superior Proposal (nosol-superior.config.js) | 7 (5 ROWS + 2 NEW_ROWS) | @24, @34 |
| No-Solicitation / No-Shop chapeau (nosol-section.config.js) | 7 GROUP_DEFS (chapeau assembling the 4 sub-families above as limbs) | GROUP_DEFS @88 |
| Termination Rights (termination-rights.config.js) | 4 static cross-cutting (3 CROSS_CUTTING_ROWS + 1 FIDUCIARY_OUT); main per-right rows built dynamically | @634, @662 |
| Termination Fees (termination-fees.config.js) | 5 static SCALAR_ROWS + 8-surface CANONICAL_COVERAGE_SURFACES gap list + dynamic legacy/canonical rows | SCALAR_ROWS @46, CANONICAL_COVERAGE_SURFACES @680 |
| Tail Fee Mechanics (tail-fee.config.js) | dynamic, up to 4 rows (window/threshold/arming/trigger-scope) per deal | selectRows |
| Employee Benefits (employee-benefits.config.js) | 14 (5 FALLBACK_ITEMS + 5 ERISA_ITEMS + 1 CONTINUATION_ITEMS + 3 PROTECTION_ITEMS) | @16-47 |
| Other Covenants (general-covenants.config.js) | 4 | ROWS @25 |
| Miscellaneous / Boilerplate (misc-boilerplate.config.js) | 4 static GOVERNED_CONCEPT_ROWS + dynamic fee/expense fold-in | @169 |
| Advisers / Fees / Expenses (advisers-fees-expenses.config.js) | 1 static + 1 dynamic expense-exceptions row | ROWS @26 |
| MAE Definitions (mae-definitions.config.js) | 3 | ROWS @24 |
| No Other Reps / Fraud (Abry) (no-other-reps-fraud.config.js) | 4 QUESTIONS + fixed ABRY_CODES/FEATURE_KEYS vocab | @58-72 |
| Material Contracts (material-contracts.config.js) | dynamic — driven by MATERIAL_CONTRACT_BUCKET_CODES taxonomy, not a fixed row list | selectRows @440 |
| Antitrust / Regulatory (antitrust-regulatory.config.js) | dynamic — ROW_BUILDERS is an array of builder functions, not static rows | ROW_BUILDERS @866 |
| Equity Awards (equity-awards.config.js) | dynamic — driven by INSTRUMENT_KEY_META / TREATMENT_CODE_TO_META taxonomy | selectRows @706 |
| Interim Operating Covenants exceptions (ioc-exceptions.config.js) | dynamic — driven by IOC_CATEGORY_CODES/EXCEPTION_CODES taxonomy (largest config, 1272 lines) | not enumerated as fixed rows |
| Representations & Qualifiers (representations-qualifiers.config.js) | dynamic — one row per rep card actually present in the deal, no fixed rep catalogue (reps vary by deal's own numbering) | selectRows @1432 |

Files without their own row catalogue (conditions-m, material-contracts,
antitrust-regulatory, equity-awards, ioc-exceptions, representations-
qualifiers) are exactly the ones where "0 rows vs 10 rows" is most likely to
be legitimately deal-driven rather than an extraction bug — there is no
static list to compare a sparse deal against, only the corpus taxonomy size.
That taxonomy-driven design is itself worth checking against V2's family
list, since it is the UI's implicit definition of "what this family could
ever show."

## Absence / empty-state wordings

| Wording | File | SAFE/UNSAFE | Note |
|---|---|---|---|
| "Not found (may not be present, or not yet extracted)" | lib/canonical-conditions.js | SAFE | The reference pattern this sweep was told to look for (out-of-slice file, cited for comparison) |
| "Present, detail not extracted" | conditions-m.config.js, employee-benefits.config.js, nosol-noshop.config.js, termination-rights.config.js (x2) | SAFE | Asserts presence (extractor found something) but withholds the unknown detail — correct discipline |
| "Not yet extracted" (NOT_YET_EXTRACTED_DETAIL, amber pill) | termination-fees.config.js | SAFE | Explicit two-state design: "established absent" (grey "No" pill) vs "not yet extracted" (amber), documented at length; gap list is DERIVED from missing canonical row ids, never hardcoded |
| "Served from: Legacy extraction — Canonical V2 has no termination-fee data for this deal" / "...has termination-fee data for this deal but could not load or verify its source" | termination-fees.config.js (servingSourceRow) | SAFE | Distinguishes "no canonical entry" from "canonical entry exists but failed to load/verify" — built after a real 2026-08-05 production incident where these were conflated |
| "(no evidence captured)" | components/review/primitives/ProvisionTablePrimitives.jsx (EvidenceQuote) | SAFE | About evidence capture, not the underlying legal fact |
| "we have not extracted this yet" (contrasted against "the agreement is silent") | termination-fees.config.js header comment | SAFE | Named explicitly in a design-rationale comment as the distinction the whole BOTH_SOURCES mode exists to preserve |
| "silence is a data gap, not evidence the letter doesn't exist" | representations-qualifiers.config.js:743 (comment only) | SAFE (stated intent) | Correct philosophy in a comment; verify the code path actually renders that softly rather than dropping the row silently |
| "No fiduciary-out mechanics found." | nosol-fiduciary.config.js | UNSAFE | Table-level empty copy reads as "this agreement has none"; no distinction from "none extracted yet" |
| "No Intervening Event mechanics found." | nosol-intervening.config.js | UNSAFE | Same pattern |
| "No no-shop core mechanics found." | nosol-noshop.config.js | UNSAFE | Same pattern |
| "No no-solicitation provisions found." | nosol-section.config.js (x2: empty copy + emptyCopy) | UNSAFE | Same pattern, at the chapeau level |
| "No Superior Proposal mechanics found." | nosol-superior.config.js | UNSAFE | Same pattern |
| "No tail-fee mechanics found." | tail-fee.config.js | UNSAFE | Same pattern |
| "No material-contract rows found." | material-contracts.config.js | UNSAFE | Same pattern |
| "No mutual/buyer/seller closing-condition cards found." (3 variants) | conditions-m.config.js | UNSAFE | Same pattern, x3 |
| "No closing conditions found." | conditions.config.js | UNSAFE | Same pattern |
| "No interim operating covenants found." | ioc-exceptions.config.js | UNSAFE | Same pattern |
| "No termination rights found." | termination-rights.config.js | UNSAFE | Same pattern |
| "Party not captured" / "Trigger not captured" | components/review-v2/NoShopCrossViewPreview.jsx | Borderline SAFE | Names the missing field explicitly rather than dropping the row — better than a bare dash, but still worth checking it never substitutes for a genuine "not applicable" |
| "Not applicable" | components/review-v2/NoShopCrossViewPreview.jsx (formatCode(null)) | UNSAFE-leaning | `formatCode` returns "Not applicable" for any null/undefined value — conflates "field literally doesn't apply" with "value not captured"; the two other functions in the same file (formatParty/formatTrigger) correctly use "...not captured" instead, so this one function is the outlier |
| "No data extracted" / "Limbs not extracted (re-ingest to populate)" | pages/review-v1/[id].js | SAFE-ish | V1 legacy page already distinguishes "not extracted" from silence; grepped only, not confirmed in context |
| "No Excerpt available." | components/admin/schema-loss/ProvisionViewer.jsx | SAFE | Ops tool, about evidence display not legal fact |

**Count: 11 distinct UNSAFE empty-table wordings** (all of the shape "No X
found."), across 10 files, plus 1 borderline (`formatCode`'s "Not applicable"
default). All 11 sit in table-configs whose sibling families
(termination-fees.config.js) already solved this correctly — the fix is a
copy/mechanism port, not new design work.

## Detailed asset sections

### 1. termination-fees.config.js — NOT-YET-EXTRACTED vs ESTABLISHED-ABSENT (HIGHEST priority)
`components/review/table-configs/termination-fees.config.js` (67.7KB, largest
substantive config). Directly answers the programme's live "why 0 rows here,
10 there" question for this family: it distinguishes canonical-source state
(`CANONICAL` / `LEGACY_FALLBACK` / `LEGACY_FALLBACK_SOURCE_FAILED` /
`BOTH_SOURCES`) and renders it as an explicit "Served from" provenance row
(`servingSourceRow`, lines ~605-644), never silently. Separately, a per-surface
gap list (`CANONICAL_COVERAGE_SURFACES`, 8 named fields) drives an amber
"Not yet extracted" placeholder row for any surface canonical hasn't produced
yet (lines ~646-693) — comment block explicitly named "NOT-YET-EXTRACTED vs
ESTABLISHED-ABSENT" with the reasoning written out. This is the reference
implementation the other 10 UNSAFE-empty-copy families should be ported to.

### 2. ClauseSidebar.jsx — fact → limb → clause, already built
`components/review-v2/ClauseSidebar.jsx` implements the owner's narrow-to-expand
ruling near-verbatim: row identity → corpus context (value distribution across
peer set, this deal highlighted) → refine peer set (collapsed) → view clause
(collapsed verbatim, on demand). List-type row values drill further: clicking
an item narrows to that item's own corpus frequency + its own "View clause",
with a back affordance — literally row → item → clause. Reuse this component's
structure/pattern before building anything new for canonical-v2's own
drill-down.

### 3. nosol-section.config.js — the chapeau in production
`GROUP_DEFS` (7 entries, line 88) assembles `nosol-fiduciary.config.js`,
`nosol-intervening.config.js`, `nosol-noshop.config.js`, and
`nosol-superior.config.js` as limbs under one No-Solicitation/No-Shop chapeau
— confirmed by `sectionList.js`'s `REVIEW_V2_CONFIGS`, which lists
`nosolSectionConfig` but NOT the four sub-configs individually. This is the
concrete chapeau/limb pattern requested in the brief, live today.

### 4. CanonicalReviewSection.jsx — certified evidence, fails loud
`components/review-v2/CanonicalReviewSection.jsx` fetches
`/api/canonical-v2/exact-detail` and `/review-context`, and validates the
response's `schema_version` + shape before rendering — `terminationFeeTriggerView`
throws `'Certified trigger detail is incomplete.'` if `trigger_count`,
`triggers.length`, and `excerpts` don't all agree. This is quote/citation
discipline enforced at the render boundary, not just a convention in a
comment.

### 5. configDecorations.js — display-side legal-fact derivation caught red-handed
`components/review-v2/configDecorations.js` computes an "approximate lookback
period" (e.g. "(≈8 mos)") from a raw ISO date at render time, purely for v2
presentation, layered on top of v1's unmodified `selectRows()`. This is
exactly the "derivation that should be pipeline logic" the brief asked to
find — a legal-adjacent computed fact (how long ago is "Since Jan 30, 2025"
relative to signing) living in a component instead of the extraction layer.
Also folds `deriveClosingTimingRows`/`deriveElectionSummary` in from
`sectionList.js` for the same reason.

### 6. provision-family.js — client-side "whole section, then its parts"
`components/review/provision-family.js`: there is no `parent_provision_id`
column, so this module reconstructs section membership from
`section_number` root-matching (`5.3(b)` and `5.3(a)` share root `5.3`) and
code-family root-stripping (`NOSOL-EXCEPTION-2` → `NOSOL-EXCEPTION`) to
answer "who are this provision's siblings, and in what order do they read."
A real parent/child reconstruction algorithm implemented entirely client-side
because the schema doesn't carry the relationship — a strong candidate for
promoting into the pipeline/schema.

### 7. CompareColumn.jsx / MarketColumn.jsx / compareData.js / compareRowUnion.js — the cohort view
Multi-deal compare (`?compare=<id>[,<id2>]`) and market mode (`?market=1`)
render as extra columns on the SAME review page, through the SAME
ProvisionTable/MaeSection/ElectionCard/DefinitionsSection every primary deal
uses — not a separate UI. `compareRowUnion.js`'s `ROW_FAMILY_GROUPS`
canonicalizes rows that the SAME real clause classifies under two different
provision codes across deals (documented example: `REP-T-CONTRACTS` vs
`REP-T-MATERIAL-CONTRACTS`), so comparison isn't defeated by a taxonomy split.
This IS the precedent-search comparability spec the brief asked for (category
7) — it names, concretely, which fields must line up across deals.

### 8. sectionList.js — the v2 family order (and a stale header)
`REVIEW_V2_CONFIGS` lists 20 configs in display order (structure-mechanics →
consideration → equity-awards → representations x2 → material-contracts →
mae-definitions → ioc-exceptions x2 → nosol-section → antitrust →
votes-approvals-meeting → conditions → termination-rights → termination-fees
→ tail-fee → employee-benefits → misc-boilerplate → no-other-reps-fraud →
general-covenants). Header comment says "same 19 configs" — false, there are
20 (confirmed by direct count, not by header). Compare against `shared.js`'s
`SIDEBAR_GROUPS` (17 top-level groups, some with nested children) — the two
taxonomies are related but not identical in shape (SIDEBAR_GROUPS nests
buyer/target/mutual per family; sectionList flattens some of that into
paired configs like `iocExceptionsConfig`/`parentIocExceptionsConfig`).

### 9. process/* — typed, gated evidence contract
`components/process/*` (12 files) implement a clean typed contract for
"checked" results: `slot_state` (VALID/UNAVAILABLE), `action_targets` gated
by `action_kind`/`action_state === 'AVAILABLE'`, `coverage_certification_state
=== 'CERTIFIED_COMPLETE'` messaging (ProcessCoverageState.jsx). Live behind
`pages/query/process/pilot.js` (flag `isCanonicalV2ProcessPilotUiEnabled`).
This is a more rigorous, generalizable version of "how does a quote tie back
to its source, and what happens when it can't" than most of the review-side
ad hoc string checks — worth reusing the contract shape even outside Process.

### 10. canonical-v2-preview-lane.js — the V1/V2 dark-bridge mechanism
`components/review/table-configs/canonical-v2-preview-lane.js` replaces four
bespoke "append a dark row inline" implementations (material-contracts,
general-covenants, no-other-reps-fraud, representations-qualifiers) with one
shared, server-gated, read-only, default-collapsed lane that shows Canonical
V2 preview rows beside the legacy table without touching `selectRows()`'s
data contract. Server-authoritative gate (`canonical_v2_preview_enabled` on
the payload, never a client env var) — worth knowing about for any V1↔V2
side-by-side comparison work.
