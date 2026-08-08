# Asset sweep — `lib/` top level

Status: COMPLETE. Scope: every tracked file directly in `lib/` (top level only,
not subdirectories) — 65 files (`git ls-files 'lib/*.js' 'lib/*.mjs' | awk -F/
'NF==2'`).

Summary: this slice already contains most of the "found nothing / found
something wrong" trust machinery canonical-V2 extraction quality work needs,
and it is not dormant — every ASSET below has a live production caller and a
passing test suite (`CI=true node --test <file>`, all green at time of
writing). The strongest cluster is verification/evidence: `verification.js`
(quote verification + document coverage, offsets in *normalized-source*
character space), `gap-review.js` (classifies uncovered text as a genuine
gap vs. frontmatter/backmatter, already distinguishing "nothing extracted
here" from "nothing to extract"), and `deal-quality-metrics.js` (persists
coverage/canonical-rate/gap counts per deal to `deal_quality_metrics` —
this is the existing answer to "why does one deal yield 0 and another 10").
`expected-sets.js` is the existing corpus-derived "expected canonical set per
family" engine (core/common/rare by corpus frequency, with a human-curated
override list) — this is item 9's already-built answer, not a gap.
`feature-compare.js` is the general cross-deal comparison/outlier engine
(already confirmed HIGH priority). `negation-boundary-guard.js` and
`instrument-negation.js` are both narrow, deliberately-conservative negation
guards, already wired deep into canonical-v2 (`lib/canonical-v2/*-dark-bridge.js`,
`lib/canonical-v2/native-producer/candidate-resolution.js`) — extending them
is the move, not rebuilding. `unelide-quote.js` and `doc-match.js` round out
quote/citation handling: reconstructing an elided quote from full_text, and
locating a quote inside raw document text via a matching cascade. All offset
math in this slice operates in **JS string (UTF-16 code unit) space**
throughout — self-consistent internally, but every one of these modules would
misalign silently if fed a UTF-8 byte offset from elsewhere in the V2
pipeline; flagged per-module below.

## Table

| Path | Verdict | Why it matters now (one line) |
|---|---|---|
| lib/verification.js | **ASSET — HIGH** | quote verification + document coverage; the trust layer other modules below build on |
| lib/gap-review.js | **ASSET — HIGH** | classifies uncovered text as genuine gap vs. frontmatter/backmatter/exhibit — the absence-vs-zero engine |
| lib/deal-quality-metrics.js | **ASSET — HIGH** | persists per-deal coverage/canonical-rate/gap-count — the existing "why 0 vs 10" answer |
| lib/expected-sets.js | **ASSET — HIGH** | corpus-derived expected-canonical-set per family, core/common/rare — item 9, already built |
| lib/feature-compare.js | **ASSET — HIGH (confirmed known)** | general cross-deal comparison/outlier engine, trust guardrails on citation + min-n |
| lib/negation-boundary-guard.js | **ASSET — HIGH (confirmed known)** | detects a quote whose governing negation was trimmed off; already wired into canonical-v2 dark-bridges |
| lib/instrument-negation.js | **ASSET — HIGH (confirmed known)** | negation-of-existence guard for equity-instrument mentions; same discipline as the boundary guard |
| lib/citable.js | **ASSET — HIGH (confirmed known)** | the four-shape value model (bare/citable/tagged/provision) + one evidence-resolution path |
| lib/unelide-quote.js | **ASSET** | reconstructs a mid-string-elided quote from full_text via anchored, never-guessing whitespace-normalized match |
| lib/doc-match.js | **ASSET** | quote-to-source-offset locator cascade (exact→normalized→signature→section-header), mirrors the DOM highlighter's algorithm |
| lib/section-ref.js | **ASSET** | parses "Section 8.01(b)(i)"/"Article VIII" refs into structured parts; already used by 3 canonical-v2 native-producer modules |
| lib/run-history.js | **ASSET (smaller)** | per-run provision snapshots + diff, so a prompt regression is one diff line instead of a forensic DB query |
| lib/parse-money.js | **ASSET (smaller)** | the one shared "exactly one dollar figure or null" parser — null vs. 0 always distinguishable, never concatenates two figures |
| lib/normalize-numeric.js | **ASSET (smaller)** | closed-unit-vocabulary numeric normalizer (USD/percent/hours/days/months/years/shares); ambiguous input → null, never guessed |
| lib/abry.js | PARTIAL | dual-segment clause splitter + party→question mapping for one synthetic table; narrow, tied to one review section |
| lib/employee-benefits.js | PARTIAL | per-element row synthesis from one bundled clause ("each element gets its own row"); narrow, tied to one review section |
| lib/rep-materiality.js | PARTIAL | thin (by its own header) demo wrapper over feature-compare.js's absentCode pattern; nothing structural of its own |
| lib/edit-schema.js | PARTIAL | per-type allowlist of correctable qualifier fields, ordered MATERIALITY_STANDARD_OPTIONS tiers; correction-overlay UI schema, not extraction |
| lib/termf.js | PARTIAL | nested-to-flat feature bridge, additive-only; single-family (TERMF), pattern is instructive but not directly reusable |
| lib/deal-value-basis.js | PARTIAL | small alias map + text-inference cascade for equity/enterprise/headline value basis; narrow |
| lib/deal-facts.js | PARTIAL | builds provenance-carrying (quote/source/locked) fact objects for deal-level (non-provision) values |
| lib/search.js | PARTIAL | FAVORABILITY_GROUPS: canonical bucket ← stored-spelling synonym map (~10 spellings → 3 buckets) |
| lib/registry-review-suggestions.js | PARTIAL | static merge/reject table for legacy registry field duplicates; field-hygiene, not extraction logic |
| lib/percent-of-deal.js | LOW | tiny null-vs-zero discipline example (0 deal value ≠ "0% of nothing" → null) |
| lib/flag-item.js | LOW | discriminator for the {concern,text} "flags" shape (novelty escape valve), mirrors citable.js's discriminator pattern |
| lib/agreement-revision-classifier.js | IRRELEVANT | classifies SEC exhibit revision type |
| lib/anthropic.js | IRRELEVANT | Anthropic client singleton wrapper |
| lib/broad-corpus-containment.js | IRRELEVANT | route allowlist/containment config |
| lib/coding-tasks.js | IRRELEVANT | admin coding-task API input validation |
| lib/deal-display.js | IRRELEVANT | UI display-name fallback chains |
| lib/deals-index-columns.js | IRRELEVANT | deals-index table column registry (UI) |
| lib/edgar-catalog.js | IRRELEVANT | SEC EDGAR fetch/discovery, not extraction |
| lib/edgar-cleanup.js | IRRELEVANT | raw text cleanup regexes for EDGAR artifacts |
| lib/feature-validation.js | IRRELEVANT | thin delegate to lib/schema/validation (subdir) |
| lib/four-deal-local-demo-preview.js | IRRELEVANT | demo fixture assembly for a sales preview |
| lib/four-deal-local-demo.js | IRRELEVANT | demo fixture (4 fixed deal ids) |
| lib/home-data.js | IRRELEVANT | deals-index data shaping/select lists |
| lib/home-search.js | IRRELEVANT | client-side search snapshot loader |
| lib/home-snapshot.js | IRRELEVANT | static deal-directory snapshot validator |
| lib/home-static-props.js | IRRELEVANT | getStaticProps wrapper for home page |
| lib/html-entities.js | IRRELEVANT | cp1252-aware HTML entity decoder |
| lib/ingest-job-plan.js | IRRELEVANT | ingest batch job scheduling/manifest |
| lib/llm-cli-client.js | IRRELEVANT | CLI-subprocess LLM client plumbing |
| lib/market-stats-containment.js | IRRELEVANT | route containment stub (503 body) |
| lib/model.js | IRRELEVANT | single model-id constant |
| lib/programme-decision-console.js | IRRELEVANT | 128KB programme decision/ruling log, not extraction logic (size-capped, headed only) |
| lib/provision-metadata-locks.js | IRRELEVANT | locks definitionText on correction merge |
| lib/query-containment.js | IRRELEVANT | route allowlist/containment config |
| lib/review-route.js | IRRELEVANT | review page URL query (de)serialization |
| lib/sec-meeting.js | IRRELEVANT | SEC filing/meeting deadlines synthetic table (dup pattern of citable.js unwrap, not new) |
| lib/service-client-route-actions.js | IRRELEVANT | route/auth/service-client action matrix |
| lib/sidebar-groups.js | IRRELEVANT | UI sidebar grouping mirror (test-only) |
| lib/supabase.js | IRRELEVANT | Supabase client singletons |
| lib/useLazyAgreementSource.js | IRRELEVANT | React hook, lazy full-text fetch |
| lib/useRealtime.js | IRRELEVANT | React hook, Supabase realtime subscriptions |
| lib/useSupabaseData.js | IRRELEVANT | React hooks, generic data fetching |
| lib/useToast.js | IRRELEVANT | React toast context/provider |
| lib/useUser.js | IRRELEVANT | React user context (no real auth) |
| lib/bring-down-tiers.js | CONFIRMED KNOWN | pre-identified; in slice, uses parser-v2/subclauses chapeau split — not re-analysed |
| lib/canonical-advisors.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/canonical-conditions.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/category-summary-features.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/party-scope.js | SKIP (known) | pre-identified party/scope derivation, per brief |
| lib/rubric.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/taxonomy.js | SKIP (known) | pre-identified canonical vocab, per brief |

65 files total (9 SKIP/CONFIRMED-known + 33 IRRELEVANT + 12 PARTIAL/LOW + 11 ASSET/HIGH — table sums to 65).

## Detailed ASSET writeups

### lib/verification.js — the trust layer (48,164 bytes)

**What it does.** Two jobs. (1) `verifyDealQuotes(provisions, sourceText)`
walks every provision's feature bag, pulls every citable/tagged quote, and
fuzzy-matches it against the deal's reconstructed source text — a match
against the provision's OWN `full_text` (not the source) is recorded as a
weaker `in_provision_text` triage signal, never counted as verified, because
that usually means the source drifted. Its mutating sibling
`sanitizeFeatureQuotes()` is deliberately looser (accepts source OR provision
text) and strips unverifiable quotes at ingest. (2) `computeCoverage(provisions,
sourceText, opts)` locates every provision's `full_text` inside the
normalized source, merges the matched intervals, and reports covered % (both
a `pct` that excludes ancillary/exhibit regions from the denominator, and a
`rawPct` over the whole filing) plus the largest uncovered gaps with previews.

**Contract.** All matching happens in `normalizeForMatch(s)` space: pipeline
markers (`[[SECTION]]`, `«»`), smart quotes/dashes, and possessive apostrophes
are stripped/normalized on both sides so a model paraphrase of punctuation
still matches. **Offsets returned by `locateProvisionInSource` and
`computeCoverage`'s gaps are indices into `normalizeForMatch(sourceText)` — a
transformed string — not the raw source, and not UTF-8 bytes.** They are JS
string (UTF-16 code unit) indices throughout; internally consistent, but
mixing them with the V2 pipeline's UTF-8 byte offsets, or with raw
(un-normalized) source offsets, will silently misalign spans.
`negation-boundary-guard.js`'s `hasUnclosedNegationBeforeSpan` is imported and
used inside the quote-verification path.

**Callers.** `scripts/eval.js`, `scripts/coverage-audit.js`,
`scripts/repair-quotes.js`, `scripts/ingest-qa.js`, `lib/gap-review.js`,
`lib/deal-quality-metrics.js` — i.e. it's the shared foundation under the
admin gaps page and the persisted quality metrics, not a standalone tool.

**Tests.** `tests/verification.test.js` — 49/49 pass under `CI=true node
--test`.

**Hazard for V2 adoption.** Byte-vs-UTF-16 offset mixing (see above) is the
main one. Secondarily: `computeCoverage`'s ancillary-region detection
(`detectHeadMatter`/`detectAncillaryRegions`) is heuristic pattern-matching
tuned to the current corpus's cover-page/exhibit conventions — a V2 document
with an unfamiliar exhibit layout could either over- or under-exclude.

### lib/gap-review.js — absence-vs-zero engine (23,658 bytes)

**What it does.** Takes `computeCoverage`'s raw gaps and turns each into a
typed, reviewable-or-not verdict: `classifyGapRegion`/
`classifyGapRegionWithContext` look at the gap's own text plus up to 2500
chars before / 5000 after to decide whether it's a genuine unclassified body
section (`BODY_SECTION_UNASSIGNED`/`_PARTIAL`, reviewable) or typed
frontmatter/backmatter (table of contents, recitals, signature block, exhibit,
annex, schedule, defined-terms index — all non-reviewable, with a stated
`ignored_reason`). `suggestGapType` then anchors the reviewable ones against
family-specific keyword lists (NOSOL/COV/MISC/ANCILLARY) to suggest where the
gap probably belongs. `buildUncodedSummary`/`buildUncodedDetails` do the
parallel job for provisions that WERE extracted but carry a non-canonical
code (proposed or drifted) — the "extracted but not yet canonical" bucket,
distinct from "never extracted." `buildBoundaryAudit` additionally flags
provision-interval overlaps and containment (`containsInterval`/
`allowsNestedOverlap`, which explicitly permits nesting within the same
family or `DEF` types — the closest thing in this slice to a chapeau/subclause
containment check, though it's a QA audit over already-extracted intervals,
not an extraction-time splitter).

**Contract.** Consumes `computeCoverage()`'s gap list and
`normalizeForMatch`/`locateProvisionInSource` from `lib/verification.js`, plus
`REGION_TYPES` from `lib/parser-v2/regions` and `familyType`/`isCanonicalCode`/
`provisionCode` from `lib/expected-sets.js`. Same offset space as
`verification.js` (JS-string indices into `normalizeForGapDisplay`'d text) —
same UTF-8/UTF-16 hazard applies.

**Callers.** `lib/deal-quality-metrics.js`, and directly `pages/api/admin/gaps.js`.

**Tests.** `tests/gap-review.test.js` — 15/15 pass.

**Hazard.** Region classification is regex/anchor-based (e.g. "WHEREAS" for
recitals, "IN WITNESS WHEREOF" for signatures) — tuned to the pinned corpus's
drafting conventions; an agreement using different section-boundary language
could misclassify a genuine gap as backmatter (silently dropping it from
review) or vice versa.

### lib/deal-quality-metrics.js — persisted per-deal quality (12,590 bytes)

**What it does.** `summariseDealQuality(deal, provisions, latestIngest)` is
the single function that answers "how good is this deal's extraction, right
now": calls `computeCoverage` (verification.js), `verifyDealQuotes`
(verification.js), `computeCanonicalRate` (scripts/ingest-qa.js),
`buildUncodedSummary` and per-gap `classifyGapRegionWithContext` (gap-review.js)
and `buildParserReview` (parser-v2/structural.js), then folds all of it into
one row: `coverage_pct` (reviewable-only, excludes typed frontmatter/backmatter
from BOTH numerator and denominator), `raw_coverage_pct`, `canonical_rate`,
`unverified_quotes`, `gap_count`/`ignored_gap_count`, `needs_code_count` (+
proposed subset + per-type breakdown), and a `provisions_fingerprint` (sha256
over every provision's id/timestamp/text-hash/type/category/ai_metadata) so a
stored row can be checked for staleness against the live provisions.
`upsertDealQualityMetrics` persists this to the `deal_quality_metrics` table;
`summaryFromStoredQualityMetrics` reads it back without recomputing.

**Contract.** This IS the existing, wired-up answer to "why does one deal
yield 0 and another 10 in the same family" — `needs_code_type_counts` and
`uncoded_type_counts` give a per-family breakdown of what got extracted but
isn't canonical, and `gap_count` (reviewable only) gives what never got
extracted at all, per deal, already separated from ancillary/frontmatter
noise.

**Callers.** `pages/api/admin/gaps.js`, `pages/api/deals.js`,
`lib/queries/review-deal.js`, `scripts/demo-dryrun.js`.

**Tests.** `tests/deal-quality-metrics.test.js` — 5/5 pass.

**Hazard.** Inherits every hazard of `verification.js` + `gap-review.js`
above (offset space, region-classification heuristics) since it's a thin
orchestration layer over both.

### lib/expected-sets.js — corpus-derived expected canonical set (9,347 bytes)

**What it does.** `computeExpectedSets(provisions)` builds, for every
provision type in `rubric.js`'s `PROVISION_TYPES`, the ranked list of
canonical codes that SHOULD appear, each tagged `core`/`common`/`rare` by
`dealsWithCode[code] / dealCount` against two thresholds (≥66% → core, ≥33% →
common) — a hand-authored `CURATED_CORE` set (34 codes spanning REP-T/REP-B/
IOC/COND/TERMR/NOSOL/TERMF) overrides the frequency computation so a small
corpus still gives sensible expectations before corpus signal is strong
enough on its own. `analyzeDealCoverage(dealProvisions, registry)` then scores
ONE deal against that registry: `present` (expected codes found), `missing`
(core/common codes absent — the actual checklist gap), `extra` (provisions
whose code is not a canonical rubric code at all — the taxonomy-growth queue).
`analyzeCorpusTaxonomy` aggregates `extra` categories by frequency across the
whole corpus as promotion candidates.

**Contract.** This is exactly "expected yield per family" (asset-sweep item
9) — already built, corpus-driven, human-gated via `CURATED_CORE`, and
already the shared engine `feature-compare.js` and `gap-review.js` both
import `familyType`/`isCanonicalCode`/`provisionCode` from.

**Callers.** `scripts/taxonomy-report.js`, `lib/gap-review.js`,
`lib/feature-compare.js`.

**Tests.** `tests/expected-sets.test.js` — 5/5 pass.

**Hazard.** None offset-related (this module never touches raw text, only
`ai_metadata.features.canonicalCode`). The real caveat is corpus-size
sensitivity: `CORE_THRESHOLD`/`COMMON_THRESHOLD` are fractions of the CURRENT
corpus, so importance classifications will shift as more deals are ingested —
by design, but worth knowing before treating a `rare` label as permanent.

### lib/feature-compare.js — cross-deal comparison/outlier engine (26,622 bytes) — confirmed known

Already pre-identified as HIGH priority; confirmed by full read. `compareFeature`
computes a cohort-relative distribution for one feature on one provision type,
dispatching on the feature's declared `type` in `rubric.js`'s `FEATURES` (enum→
distribution over declared options, object/tagged→canonical-code distribution,
list/list-tagged→set membership, boolean→yes/no rate, numeric→median/IQR).
`cohortFeatureStats` computes the lean baseline for every comparable feature
over a selected cohort; `featureOutliers` judges one deal's provisions against
that baseline and marks `offMarket: true` ONLY when the cohort `n >= minN`
(default 12) — below that, divergence is reported as information only, never
an assertion. Every surfaced datapoint carries a quote + `provision_id`; a
datapoint with no resolvable citation is silently dropped (never surfaced
uncited). Delegates dollar-figure parsing to `lib/parse-money.js`. Callers:
`scripts/compare-report.js`, `lib/home-data.js`, `lib/rep-materiality.js` (thin
wrapper). Tests: `tests/feature-compare.test.js` — 20/20 pass. No offset
hazard (operates on already-extracted `ai_metadata.features`, not raw text).

### lib/negation-boundary-guard.js — quote-reversal detector (6,891 bytes) — confirmed known, HIGH

Detects when a candidate quote's start sits just past a negation the quote
itself doesn't include — e.g. a trimmed quote reading "have a Company Material
Adverse Effect" when the source actually says "...would NOT have a Company
Material Adverse Effect...". Plain containment (does this string occur
verbatim in the source) passes that quote; this module is the additional
check that catches the sign flip. Deliberately narrow negation lead-in list
(modal/auxiliary + "not", "in no event", "under no circumstances", "none of",
a closed "no <noun>" set, "never") plus a coordinating-conjunction reset so a
quote that opens its OWN independently-joined clause isn't falsely flagged by
a negation governing a different, parallel clause. Validated against the real
TopBuild/Modiv MAE corpus: 36/36 real negated MAE qualifiers flagged,
~10% false-fire rate on a stride sample across the full TopBuild filing, every
inspected fire a genuine catch. **`spanStart` is a JS-string (UTF-16) index
used with `haystack.slice`/`.charAt`-style access — the module's own header
explicitly flags that no stage of the pipeline currently carries an
independently-captured pre-trim offset forward, which is exactly the
byte-vs-UTF-16 hazard class this sweep was told to watch for.** Already wired
into `lib/verification.js`, `lib/canonical-v2/no-other-reps-fraud-dark-bridge.js`,
`lib/canonical-v2/representations-dark-bridge.js`,
`lib/canonical-v2/native-producer/candidate-resolution.js`,
`lib/canonical-v2/phase1-authority-boundary-inventory.js` — this is not a
rediscovery, it's already load-bearing in canonical-v2 today. Tests:
`tests/negation-boundary-guard.test.js` (13/13), plus 3 more canonical-v2
test files exercise it. All pass.

### lib/instrument-negation.js — negation-of-existence guard (5,542 bytes) — confirmed known, HIGH

Sibling discipline to the boundary guard, but for a different problem: an
equity instrument NAMED in a capitalization rep purely to say it doesn't
exist ("there have been no issuances of ... stock appreciation rights...")
must not become a false "this instrument is outstanding" row. Scopes the
check to the sentence containing the mention (`sentenceAround`, period-
delimited, capped at 800 chars) and tests a deliberately narrow negation list
— same "no <security noun>" discipline the boundary guard reuses. Exposes
`firstAffirmativeMention`/`hasAffirmativeMention` to scan past negated
occurrences to a genuine one (an ESPP wind-down paragraph can be full of "no
new..." sentences while still carrying real affirmative treatment terms
elsewhere). Same UTF-16 `matchIndex` hazard as the boundary guard —
self-consistent, but not byte-safe if fed a byte offset. Callers:
`lib/parser-v2/extract.js` (`backfillMissingInstrumentMentions`),
`lib/parser-v2/consideration-equity.js`, `scripts/backfill-consideration.js`.
Tests: `tests/instrument-negation.test.js` — 6/6 pass.

### lib/citable.js — the value-shape model (11,359 bytes) — confirmed known, HIGH

Central discriminators for the four value shapes the parser emits: bare
scalar, citable wrapper (`{value, quotes}` current / `{value, text}` legacy),
tagged item (`{code, label, text}`), and a raw provision object. `resolveEvidence`
is the ONE quote-resolution path (precedence: citable quotes → tagged `.text`
→ provision `full_text` fallback, narrowed to the sentence containing a
`focusOn` needle via `focusSnippet` rather than dumping the whole provision).
`getTaggedItemQuote` refuses to return an "echo" — `.text` that's just the
code or label repeated back — since that carries no evidentiary value.
`evidenceHover` renders the full provision text with the resolved excerpt
bolded inside it when the excerpt is a genuine substring, so a hover shows
context instead of an undifferentiated blob. All offset work
(`focusSnippet`'s `indexOf`/`slice`) is self-contained JS-string space, never
mixed with an external offset source — no hazard by itself. Callers extend
beyond legacy review-v1: `lib/canonical-v2/no-other-reps-fraud-dark-bridge.js`,
`lib/canonical-v2/no-other-reps-fraud-product-projection.js`,
`lib/canonical-v2/reviewed-slice-harness.js`, `lib/parser-v2/store-claims.js`,
`lib/abry.js` (inlines the discriminators rather than importing, by design —
see that file's header). Tests: `tests/citable-tagged-item-quote.test.js` —
8/8 pass.

### lib/unelide-quote.js — elided-quote reconstruction (5,318 bytes)

`unelideQuote(quote, fullText)` reconstructs the complete span of a quote the
extractor elided mid-string (literal `"..."`, `". . ."`, or `"…"` with real
text on both sides) by anchoring the ~80-char head segment (before the first
elision) and ~80-char tail segment (after the last elision) against a
whitespace/curly-quote-normalized copy of `full_text`, via an index map back
to the original string — never guesses or stitches; any anchor miss,
out-of-order match, or span over 8000 chars returns `null` and the caller
keeps the original (elided) quote. Motivated by a real case where the elided
middle was exactly the operative payment formula. Offset math is entirely
self-contained (own `normalizeWithMap` + index map), no external offset
mixing. Caller: `lib/queries/review-deal.js` (production query path). Tests:
`tests/unelide-quote.test.js` — 16/16 pass.

### lib/doc-match.js — quote-to-source offset locator (6,572 bytes)

`locateQuoteInText(plainText, needle)` finds a quote inside raw document text
via a matching cascade — exact case-insensitive → whitespace-normalized (with
an index map back to original offsets) → first-200-char signature → first-60-
char signature → `"SECTION X.XX"` header fallback — deliberately mirroring
`components/review/FullDocumentView.js`'s DOM highlighter algorithm shape (but
kept independent/DOM-free/testable). `buildWindow` then carves a bounded
slice around a match, preferring to snap to paragraph breaks. All offsets are
plain JS-string indices into `plainText`, self-consistent, no external mixing.
Caller: `components/review/DocPopUnder.js`. Tests: `tests/doc-match.test.js` —
8/8 pass.

### lib/section-ref.js — cross-reference resolver (4,719 bytes)

`parseSectionReference(ref)` parses `"Section 8.01(b)(i)"` / `"§8.01"` /
`"Article VIII"` style strings into `{ kind, sectionNumber, subclauses[], raw
}`. Not itself a chapeau/subclause text-splitter (that's
`lib/parser-v2/subclauses.js`, out of this slice) — this is the reference-
STRING parser used when resolving a cross-reference mention to the provision
it points at. Already used well beyond legacy review: 3 canonical-v2
native-producer modules (`share-count-parse.js`, `candidate-resolution.js`,
`closing-conditions-producer-prompt.js`) plus `lib/parser-v2/structural.js`
and `lib/query/types.js`. No dedicated test file; exercised indirectly by
several canonical-v2 test files (`canonical-v2-family-section-ref-generator.test.js`
etc.) which were not independently re-run in this sweep — flag for the
consuming team if section-ref itself needs isolated regression coverage.

### lib/run-history.js — extraction run diff (6,374 bytes)

Every non-dry extraction phase appends a run record
(`buildRunRecord`/`appendRunRecord`) to `deals.metadata.extraction_runs`: who
ran what, backend/model, and a lightweight per-provision snapshot
(type/category/code/text-hash/feature-key-list). `diffSnapshots` (not shown
in the first 60 lines but present per the module's stated purpose) turns two
runs into a one-line "what changed" instead of a forensic DB query — directly
useful for telling "this family regressed to 0" apart from "this deal
genuinely has 0" across a prompt change. Capped at `MAX_RUNS_PER_DEAL = 40`.
Callers: `scripts/diff-runs.js`, `scripts/extract-local.js`,
`scripts/reprocess.js`, `lib/parser-v2/run-extract.js`. Tests:
`tests/run-history.test.js` — 5/5 pass.

### lib/parse-money.js — the one money parser (9,358 bytes)

`parseMoneyAmount(raw, {scale})` is the consolidation of six previously-
independent dollar-figure parsers (one of which literally concatenated two
figures into a 10-digit fabrication). Contract: exactly one figure resolves;
zero or more than one → `null`. **`0` is a valid resolved value distinct from
`null`** — `parseMoneyAmount(0) === 0`, `parseMoneyAmount('nonsense') ===
null` — the exact absence-vs-zero discipline item 6 asks about, already
codified here. Dollar-sign-aware ambiguity: when at least one `$`-marked
figure exists, only `$`-marked figures compete for the "exactly one" count (a
bare section-citation numeral next to a single dollar figure doesn't
manufacture a false ambiguity). Scale words (million/bn/k etc.) are opt-in and
only applied when immediately adjacent to the resolved figure — a scale word
elsewhere in the string with no adjacency triggers `null`, never a guess.
Caller: `lib/feature-compare.js`. Tests: `tests/parse-money.test.js` — 16/16
pass.

### lib/normalize-numeric.js — closed-unit numeric normalizer (11,028 bytes)

Broader sibling to `parse-money.js`: turns a verbatim extraction string into
`{value, unit}` over a CLOSED unit vocabulary (USD, percent, elapsed_hours,
calendar_days, business_days, months, years, shares — kept distinct so an
hour-deadline is never pooled with a day-deadline) or `null`. Same "never
guess" discipline: ranges, conflicting numbers, or an unrecognized unit all
resolve to `null` rather than an invented answer. Includes a spelled-number
parser (`wordsToNumber`, "twenty-four" → 24). Callers:
`scripts/backfill/normalize-numeric-claims.js`, `lib/row-market-stats/observations.js`,
`lib/queries/corpus-duration.js`. Tests: `tests/normalize-numeric.test.js` —
57/57 pass.

## Notes on PARTIAL entries (brief, not full write-ups)

- **lib/abry.js / lib/employee-benefits.js** — both are pure, JSX-free
  derivation modules for one synthetic review-page table each (No Other
  Reps/Fraud; Employee Benefits). Both demonstrate a real pattern relevant to
  item 1/2 (splitting one drafted clause into multiple comparable rows, each
  keeping the SAME source quote rather than inventing one) but are hard-coded
  to their one section's field names — not a general splitter to lift as-is.
  `abry.js` has no non-test callers found by direct import search but IS
  imported by `components/review/table-configs/no-other-reps-fraud.config.js`
  (confirmed via broader grep); `employee-benefits.js` is used by
  `lib/market-metrics/section-rows.js` and `pages/review-v1/[id].js`.
- **lib/rep-materiality.js** — by its own header, "adds nothing structural";
  confirmed by full read. It just pins `(type=REP-T/REP-B, featureKey=
  materialityQualifier, absentCode=MAT_NO_QUALIFIER)` onto `feature-compare.js`.
  The useful pattern (absence resolves to an explicit "no qualifier" code
  rather than being dropped) lives in `feature-compare.js`/`codeForFeature`,
  not here.
- **lib/edit-schema.js** — the correction-panel's per-type allowlist of
  editable qualifier fields, including an ordered `MATERIALITY_STANDARD_OPTIONS`
  (strongest→weakest tier list, drawn from taxonomy.js). Useful as a
  reference for which qualifier tiers are considered a closed set, but it's
  UI/correction-overlay schema, not extraction logic.
- **lib/termf.js** — bridges TERMF's rich nested feature shapes
  (`companyTerminationFee: {amount, triggers, ...}`) to flat keys the UI
  reads, additive-only (never overwrites a genuinely-extracted flat value).
  Instructive shape for "nested extraction, flat consumption" but scoped to
  one family.
- **lib/deal-value-basis.js** — small alias map (equity/enterprise/headline
  transaction value) plus a text-inference cascade with an explicit-conflict
  → `UNKNOWN` rule. Minor.
- **lib/deal-facts.js** — builds deal-level (not provision-level) fact
  objects carrying `{value, source_url, source_label, quote, method,
  updated_at, locked}` provenance — same evidence-carrying instinct as
  `citable.js` but for the deals table, not provisions.
- **lib/search.js** — `FAVORABILITY_GROUPS` maps ~10 stored spellings of
  `ai_favorability` down to 3 canonical buckets (buyer/seller/neutral) with a
  synonym-expansion + collapse pair. Small canonical-vocabulary example, not
  provision-level.
- **lib/registry-review-suggestions.js** — a static, hand-authored table of
  legacy registry-field merge/reject decisions (e.g. `nakedNoVoteFeeAmount` →
  merge into `terminationFees`). Field-deduplication hygiene for a UI
  registry, not extraction logic; not counted as a reusable asset for V2
  extraction quality.
- **lib/percent-of-deal.js / lib/flag-item.js** — both small, single-purpose
  utilities already doing the right thing (null-vs-zero discipline; a
  {concern,text} shape discriminator matching citable.js's pattern) but too
  small/narrow to warrant their own section.

## UTF-8-vs-UTF-16 offset hazard — summary across this slice

Every offset-bearing module in this slice (`verification.js`, `gap-review.js`,
`doc-match.js`, `unelide-quote.js`, `instrument-negation.js`,
`negation-boundary-guard.js`) is internally self-consistent: all offsets are
JS string (UTF-16 code unit) indices produced and consumed by the SAME
module's own `indexOf`/`slice`/regex `.exec().index` calls, never fed an
external byte offset. **The hazard is entirely at the boundary with the V2
pipeline**, which slices by UTF-8 bytes: if a V2 caller passes a UTF-8 byte
offset into `hasUnclosedNegationBeforeSpan(haystack, spanStart)`,
`locateQuoteInText`, or any `gap.start`/`gap.length` consumer in this slice,
non-ASCII characters upstream of that offset (curly quotes, em-dashes, §
signs — all common in these documents, see `lib/html-entities.js`'s cp1252
handling) will silently shift the effective position. None of these modules
detect or guard against that mismatch themselves; it is the caller's
responsibility to convert.
