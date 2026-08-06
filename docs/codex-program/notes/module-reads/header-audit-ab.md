# Header audit: batch ab (39 modules)

Scope: every path in `hdr-batch-ab`. Method per module: read the header, then
read enough of the body to test each claim; grep for real callers of the
module's exports across `lib/ scripts/ pages/ components/ tests/` before
calling anything unused (per coordinator steering, evaluated on the merits
and adopted: this project has wrongly called things "unused" before).

Per the coordinator's mid-task steering (legitimate, evaluated on the merits,
adopted), each module below also gets: what it actually does in my own
words, any capability that is built and wired-for but has no live caller,
any defect/trap found while reading, and anything that looks like a gap in
the production-readiness plan. Findings are prioritised over coverage:
most modules get a short entry; the few with something real get the space
that costs.

Verification commands (to run once all batches are in, per module spec):
`CI=true npm test`, `bash scripts/lint/forbidden-patterns.sh`.

---

## Ranked findings (highest consequence first)

All 39 modules read; headers fixed in place where wrong. Ranked by
whether believing the header would send someone to a wrong conclusion,
per the brief.

1. **lib/parser-v2/classify.js (module 17): the same failure as the
   incident that opened this audit, in the same subsystem.** Header said
   "two-pass... only ~10 patterns that never misfire." The classifier
   actually runs three independent deterministic rule tables (32 + 33 + 15
   = 80 rules, counted directly), a prior-classification cache, AI
   fallback, and four MORE deterministic passes that run after
   classification and can override it. This module is live and central
   (`scripts/ingest-local.js` calls it directly). Anyone deciding "how much
   of classification is automatic" from this header alone would undercount
   the deterministic coverage by roughly 8x: structurally the same
   mistake that produced the false "twenty-five families need hand-mapping"
   claim to the repo owner. Fixed.

2. **lib/parser-v2/store.js and validate.js (modules 29, 31): scope
   understatement in the two other core pipeline phases on this list.**
   store.js's header described "3 simple steps" and omitted transaction-
   topology/election/proration/consideration-equity persistence entirely
   (three more major, independently-tested sub-systems, each touching
   2-3 Supabase tables with its own graceful-degradation path). validate.js
   similarly omitted citable-value auto-wrapping, 100%-coverage orphan
   backfill, and the Part 3 span-residual report from its 4-bullet
   description. Both fixed.

3. **lib/parser-v2/extract.js (module 18): the Strategy A/B/C/D table is
   wrong for two provision families.** Header put TERMF under Strategy C
   and DEF under Strategy A; the code (STRATEGY_A/B/C_TYPES, and an
   explicit inline comment reading "NOT TERMR (→ Strategy A) or TERMF
   (→ B)") says otherwise. Consequential because termination fees are one
   of the most legally load-bearing provision types in the schema, and a
   reader debugging TERMF extraction would be sent to the wrong ~300-line
   block in an 8429-line file. Fixed.

4. **The "ingestion is contained" pattern: found stale in five different
   module headers (8, 18, 25, 29, 31), all pointing at the same underlying
   fact.** Every `pages/api/ingest/*` route (`from-url.js`, `classify.js`,
   `extract-type.js`) is currently a `createBroadCorpusContainedHandler`
   503 stub, not the live handler these headers describe. The architecture
   these headers describe (shared lib module, callable from a script or an
   API route) is real and each module's non-route caller is genuinely
   live. The containment itself is a known, deliberate decision (tied to
   a security-review finding, "ingestion stays off" in the roadmap), but
   five headers on this one list hadn't caught up to it. All five fixed to
   name the dormancy plainly.

5. **The "span accounting spec" initiative: three parts, mostly unused,
   confirmed from four independent angles (modules 18, 27, 28, 30, 31).**
   Part 1 (`subclauses.js`) is live, load-bearing infrastructure. Part 2
   (`span-claims.js`, wired through `extract.js`) is fully built and
   tested but gated on an `opts.spanClaims === true` flag that nothing in
   the real pipeline ever sets. Part 3 (`span-residual.js`/`validate.js`)
   is stuck at "report-only gate 1," itself dependent on Part 2 being live
   to say anything useful, with enforcement gates 2-3 explicitly not built,
   and its one real run is a single named historical baseline, not a
   recurring check. Every individual header is honestly disclosed as inert
   (none needed a correctness fix), but three real phases of engineering
   sit almost entirely unused. Worth a plan line: finish the rollout, or
   decide not to and say so.

6. **lib/canonical-v2/verified-pin-sweep.js (module 1): a spec
   requirement's executor, built and tested, never wired into the pipeline
   it exists for.** The module implements a named, audited spec rule
   ("every VERIFIED answer whose pin no longer matches routes back to
   review") and its header accurately calls it "the executor." But grepped
   every plausible call site and found none outside its own test: the two
   files that looked like callers only mention it in prose comments. The
   spec-5 guarantee this closes does not actually hold in the live
   candidate-resolution/write-set pipeline today.

7. **lib/rep-materiality.js and lib/feature-compare.js (modules 37, 7):
   confirmed, not just inferred, API containment.** `lib/broad-corpus-
   containment.js` explicitly lists `/api/compare/rep-materiality` and
   `/api/compare/features` as contained routes; both resolve to `GET` 503
   stubs today. The general comparison engine and its materiality wrapper
   have no live path to a user.

8. **Smaller, real fixes, lower individual consequence:**
   `lib/edit-schema.js`'s header named the wrong parameter
   (`features` vs. the actual `category`); `lib/ingest/deal-metadata-
   prompt.js` undercounted its value-derivation ladder by omitting the
   highest-priority `stated_in_agreement` tier and named a now-dormant
   consumer; `lib/instrument-negation.js` pointed at a component
   (`ConsiderationTables.js`) deleted in a named commit
   (`c0ba2c4d`, "delete legacy review renderer") well before this header was
   last touched; `lib/model.js`'s
   "single model id" premise is bypassed by six sibling
   `live-extraction-run.mjs` scripts that hardcode `'claude-sonnet-4-6'`
   instead of importing it; `lib/parser-v2/reapply-corrections.js` had a
   self-contradicting arithmetic claim in its own tuning-constant
   justification (0.15 described as "half" a gap it actually equals in
   full, after the gap shrank and the prose wasn't re-derived);
   `lib/parser-v2/format-renderer.js` undercounted its own export list by
   one (a `parseInline` export with zero external callers). All fixed.

9. **Positive examples, worth naming rather than skipping past:**
   `lib/parse-money.js` (module 14) and `lib/query/relative-periods.js`
   (module 36) each make a precise, falsifiable, multi-item claim (six
   named call sites now delegating; six named, hand-audited registry keys)
   and both check out exactly. `lib/doc-match.js` (module 4) and
   `lib/parser-v2/resolve-source-span.js` (module 24) both correctly
   self-report a discrepancy between an actual behaviour and what an
   external plan document says, rather than perpetuating it. This audit
   found real problems, but the codebase's header discipline is not
   uniformly bad: when a header is this specific, it is usually right,
   which is exactly why the ones that were wrong (classify.js's "~10
   patterns" above all) are dangerous: a precise-sounding claim reads as
   checked even when it silently wasn't.

Everything else on the list (roughly two-thirds of the 39 modules) had
accurate headers with no fix needed; those get a short entry below and no
further discussion here.

---

## Per-module notes

### 1. lib/canonical-v2/verified-pin-sweep.js

**Header:** Accurate on what the code does and how it does it (pure
function, two inputs, no I/O). One claim needed checking rather than taking
on faith: "the SOURCE_SUPERSEDED executor" for spec section 5. That claim
is where the real finding is.

**What it actually does:** `sweepVerifiedPins()` takes a list of stored
answers and a re-admitted source's canonical-text hash, and for every
answer whose `answer_provenance.tag === 'VERIFIED'` compares the pinned
hash to the new one. Mismatch routes the answer back to review tagged
`SOURCE_SUPERSEDED`; match passes it through unaffected; anything not
VERIFIED or missing its pin becomes a typed residual instead of silently
passing or silently dropping. Well-written, defensively coded, matches its
own header exactly.

**Finding (capability built, wired nowhere):** grepped every plausible call
site. `sweepVerifiedPins` and the `SOURCE_SUPERSEDED` reason string appear
in exactly two files: this module and its own test
(`tests/canonical-v2-verified-pin-sweep.test.js`). Two other files turned up
in a `require`-pattern grep:
`lib/canonical-v2/validate-write-set.js:235` and
`lib/canonical-v2/native-producer/candidate-resolution.js:3386`, but both
hits are prose *comments* referencing the module by name, not `require()`
calls; neither file actually imports it. So the module the header calls
"the executor" for the source-re-admission transition rule (written because
a round-2 audit found the rule had no executor) is itself never invoked
outside its own test. The spec-5 rule this closes: "every VERIFIED answer
whose pin no longer matches routes back to review": is therefore still not
enforced anywhere a real re-admission would go through
`candidate-resolution.js` or `validate-write-set.js`. This is the same
shape as the section-family-classifier problem: complete, tested in
isolation, not wired into the pipeline that needs it. Worth a line in the
production-readiness plan: either wire this into the source-re-admission
path, or the spec-5 guarantee does not actually hold today regardless of
what the header (accurately) says the module does.

**Header fix:** none needed, left as-is. The finding is about wiring, not
prose.

---

### 2. lib/canonical-v2/zero-width-normalise.js

**Header:** Accurate. Checked the one falsifiable claim: that
`reviewed-qxo-admitted-no-shop-actions-slice.js`'s anchor string contains a
literal U+200E between "Article" and "VI": directly against the file:
confirmed at the string `'...termination of this Agreement in accordance
with Article ‎VI, not, directly...'`. The two-layer design
(faithful storage vs. tolerant matching) matches the four exported
functions exactly.

**What it actually does:** Strips a fixed set of zero-width/bidi Unicode
marks (ZWSP, ZWNJ, ZWJ, LRM, RLM, BOM, soft hyphen) for comparison-only
purposes, and provides an index-mapping search (`indexOfIgnoringZeroWidth`)
that finds a needle in normalised text but returns an offset valid against
the *original* untouched string, so callers can still slice real byte spans.

**Findings:** None of note. Small, correct, all four exports have live
callers (grep confirms use beyond the test file). No defects spotted.

---

### 3. lib/citable.js

**Header:** Accurate. The four value shapes and the quote-resolution
precedence it documents (citable quotes → tagged `.text` → provision
`full_text` fallback) match `resolveEvidence` exactly.

**What it actually does:** The shared discriminator/accessor layer for the
four shapes parser output can take (bare scalar, citable wrapper, tagged
taxonomy item, provision object), plus `resolveEvidence`/`evidenceHover`,
which pick the best supporting quote for a value and (the more interesting
half) decide whether to show that quote alone or the *whole* provision
text with the quote bolded inline, when the quote is a genuine substring of
the fuller text.

**Findings:** None of note. This is a well-used, central module (`getCitableQuotes`, `resolveEvidence`, `evidenceHover` all have call sites beyond tests). No defects spotted in the two fallback/precedence chains.

---

### 4. lib/doc-match.js

**Header:** Accurate. The five-strategy cascade the header describes
(exact case-insensitive → whitespace-normalised → first-200-char signature
→ first-60-char signature → "SECTION X.XX" header) matches
`locateQuoteInText` strategy-for-strategy, including the exact order.
Confirmed `components/review/FullDocumentView.js` exists and independently
implements the same cascade (see its own comment at line ~387: "exact
case-insensitive → whitespace-normalized → first 200 chars (signature) →
first 60 chars → 'SECTION X.XX' header"). So the "intentionally NOT
imported from FullDocumentView, kept as a duplicate-by-design sibling"
claim is real and current, not aspirational.

**What it actually does:** Given plain document text and a quote, finds the
best-effort character offset span for that quote using the cascade above,
then `buildWindow` carves a padded, paragraph-boundary-snapped slice around
it for the document pop-under to render instead of mounting the whole
agreement.

**Findings:** None of note. Both exports (`locateQuoteInText`,
`buildWindow`) are live: used by `components/review/DocPopUnder.js`, not
just tests.

---

### 5. lib/edit-schema.js

**Header:** Mostly accurate; one small drift. The header's usage line reads
"`getEditFields(type, code, features)` returns the ordered, resolved
control specs for the panel", but the actual function signature is
`getEditFields(type, code, category)` (confirmed against both the function
declaration and its own JSDoc immediately above it, which correctly say
`category`). `features` is the parameter name of a *different* function in
the same file, `fallbackEditFields(type, code, features)`. This looks like
the header line was drafted by eye rather than copied from the signature:
harmless in practice (nobody calls `getEditFields` positionally by reading
the top-of-file header), but it is exactly the kind of "name that's drifted"
the audit is for, so fixed it.

**What it actually does:** Allowlist-based schema of which fields a lawyer
can edit per provision type/code, layered as an overlay over the
protected, never-editable extracted clause text. Falls back to
`fallbackEditFields`, which surfaces whatever populated rubric fields exist
for types with no curated schema, so nothing is silently uneditable.

**Findings:** Both `getEditFields`/`resolveEditFields` are live: used by
`components/review/EditPanel.js` and `pages/review-v1/[id].js`, confirming
the header's "the panel" reference is real, not aspirational. No defects
spotted. One thing worth a plan note, not a header fix: `resolveEditFields`
is wired into `pages/review-v1/[id].js` (the *old* review page), and the
`components/review/EditPanel.js` caller needs checking against whichever
review surface is actually live (`review-v2` per the current git diff at
the top of this session). If `review-v2` has its own edit panel that does
NOT go through this schema, the allowlist protection this module exists
for could be silently bypassed on the surface reviewers actually use. Flagging
for the plan; did not chase further since `components/review-v2/*` is
outside my file list and editing it is not my job here.

---

### 6. lib/expected-sets.js

**Header:** Accurate, with one framing note. "Today the ... checklist
exists only for reps (the old EXPECTED_REPS map hardcoded in the review
page)" is written as present-tense motivation for building this module.
`EXPECTED_REPS` still exists, but only in `pages/review-v1/[id].js`: the
old review page, per the same review-v1/v2 split noted in module 5. The
motivating problem this header describes is still real in the sense that
`EXPECTED_REPS` was never deleted, but whether it's still "the" checklist a
reviewer sees depends on whether `review-v2` uses this module or grew its
own equivalent. Not a false claim (the map really is still there,
hardcoded, reps-only), so left it alone rather than guess.

**What it actually does:** Builds a corpus-derived "expected canonical set"
per provision type (core/common/rare) from real appearance frequency
across deals, with a small hand-curated override set for codes that should
count as core even in a thin corpus. Given one deal's provisions plus that
registry, reports what's present, what core/common thing is missing, and
which provisions carry a non-canonical ("extra") code as taxonomy-growth
candidates.

**Findings:** Live: consumed by `scripts/taxonomy-report.js`,
`scripts/audit/legacy-vocab-references.js`, `lib/feature-compare.js`,
`lib/gap-review.js`, `lib/query/types.js`, and `pages/api/trust/report.js`.
Not dead code. No defects spotted in the threshold/curation logic.

---

### 7. lib/feature-compare.js

**Header:** Accurate. Both structural claims check out: the kind mapping
(enum/coded/set/boolean/numeric/skip) in the header matches `featureKind()`
exactly, and the two trust guardrails (every point cited or dropped;
`offMarket` gated on cohort n ≥ `DEFAULT_MIN_N` = 12) match the code
precisely, including the constant value.

**What it actually does:** The general cross-deal comparison engine:
given a provision `type` and a `FEATURES` schema key, computes a
distribution (categorical/numeric/set/boolean) over exactly a selected
cohort of deals (explicit `dealIds`, or sector/size/year filters), with
every datapoint carrying a quote + provision id. `featureOutliers` then
flags where one deal's value differs from the cohort's mode/median, with
the "off-market" label suppressed below the n=12 floor.

**Findings:** Live, not dead: `compareFeature`/`cohortFeatureStats`/
`featureOutliers`/`comparableFeatures` are all called from
`scripts/compare-report.js` (a demo/report script; see its own header:
"prove the general comparison engine on live data... the corpus is thin
today... the point is the machinery is correct and lights up as deals
accumulate") and from `lib/rep-materiality.js`. Worth flagging for the plan
rather than as a defect: `scripts/compare-report.js` is CLI-only: grepped
for any `pages/api` or component consumer of `compare-report` and found
none. So this "differentiator nobody else has" (the header's own words) is
provably correct machinery that currently only prints to a terminal; there
is no live UI/API surface surfacing cross-deal outliers or comparisons to
a user. That is a capability-vs-wiring gap worth a plan line, in the same
family as the classifier and pin-sweep findings above, though lower
consequence since nobody was told a false scaling story about it.

**Addendum, confirmed directly while auditing module 37
(lib/rep-materiality.js) below:** this isn't just an absence of a live
caller, it is a confirmed, deliberate containment. `lib/broad-corpus-
containment.js`: the same mechanism behind the dormant ingest routes in
modules 8/18/25: explicitly lists `/api/compare/rep-materiality` and
`/api/compare/features` as contained routes, mapped to
`pages/api/compare/rep-materiality.js` and `pages/api/compare/features.js`;
both are confirmed `createBroadCorpusContainedHandler('GET')` stubs. So
this engine's live-data API surface was built and then deliberately
switched off along with the rest of the broad-corpus containment sweep,
not merely never built. Strengthens this finding; doesn't change it.

---

### 8. lib/ingest/deal-metadata-prompt.js

**Header:** Two real inaccuracies, one more consequential than the other.

1. **Stale consumer claim.** Header: "SHARED deal-metadata extraction used
   by BOTH `scripts/ingest-local.js` and `pages/api/ingest/from-url.js`."
   Checked `pages/api/ingest/from-url.js` directly: it is now a two-line
   containment stub (`createBroadCorpusContainedHandler('POST')`, returns
   503) with a comment explaining the real, SSRF-repaired implementation
   was moved to `lib/broad-corpus/contained-routes/from-url.js` and is "NOT
   wired in... ingestion stays off." That file is the one that actually
   calls `extractDealMetadata` from this module
   (`lib/broad-corpus/contained-routes/from-url.js:59`). So the header's
   second named consumer does not call this module at all today; the real
   second consumer is a dormant sibling one hop away. This is a genuine
   drift (the route got contained after this header was written) but low
   consequence in isolation: the dormancy is already self-documented in
   `lib/broad-corpus/contained-routes/from-url.js`'s own header and tied to
   a known, deliberate ROADMAP decision ("ingestion stays off"), so nobody
   reading only *this* file's header would be misled into thinking
   ingestion is live; they would just be wrong about which file does the
   calling. Fixed by naming the real current consumer and its dormant
   status.

2. **Undercounted value-derivation ladder.** Header describes the
   value-derivation step as three outcomes: (a) `derived_per_share`, (b)
   `press_release`, (c) otherwise `no_stated_value`. Reading `deriveValue()`
   directly: there are four outcomes, and the header's list omits the
   *first and highest-priority* one: when `meta.value_usd` already came
   back as a positive number from the base extraction pass (the agreement
   states a total transaction value directly), it returns immediately with
   `value_provenance.kind = 'stated_in_agreement'`, before any per-share
   math is attempted. In practice this is likely the single most common
   path (most agreements state a headline deal value), and the header
   describes the module as if value is always *derived* (per-share × share
   count) or fetched from a press release, when directly-stated value is
   checked first and wins outright. Fixed.

**What it actually does:** Shared metadata-extraction prompt/parse/derive
logic for both ingest pipelines: base LLM extraction of
acquirer/target/dates/value/etc., a shell-vs-real-entity piercing decision
gated on affirmative recital language (never on name pattern alone), a
conditional sponsor-identification second LLM pass, deterministic law-firm
extraction reusing `notice-advisors.js`'s party-block segmenter, and the
four-tier value-derivation ladder above.

**Findings:** No dead exports: everything here (including
`shouldPierceShell`, `buildNoticesExcerpt`) has direct callers in
`scripts/ingest-local.js`, `scripts/backfill-law-firms.js`,
`scripts/backfill-deal-display.js`, `lib/query/types.js`, and
`lib/broad-corpus/contained-routes/from-url.js`: beyond just tests. One
thing worth a plan note: `deriveValue`'s `stated_in_agreement` tier trusts
the base LLM pass's `value_usd` field outright with no sanity bound (e.g.
no check that it's a plausible deal size, no cross-check against
`per_share_value_usd × fully_diluted_shares` when both are also present):
if the base extraction pass hallucinates a value, nothing downstream in
this module catches it before it's persisted with `stated_in_agreement`
provenance, which reads as the *most* trustworthy tier. Not a bug in what's
written, just an unguarded trust boundary worth naming for the plan.

---

### 9. lib/instrument-negation.js

**Header:** One real, well-evidenced inaccuracy. Header: "Shared by
lib/parser-v2/extract.js (backfillMissingInstrumentMentions, server-side
ingestion backstop) and components/review/ConsiderationTables.js
(buildEquityRows, client-side raw-text augment)." The server-side half is
confirmed live (`extract.js:87` requires this module;
`backfillMissingInstrumentMentions` at `extract.js:7836` calls it). The
client-side half does not exist: `components/review/ConsiderationTables.js`
is gone and `buildEquityRows` appears nowhere in the codebase except inside
this header. `git log --all` confirms why: commit `c0ba2c4d` ("WP-M2-05:
delete legacy review renderer (#209)") deleted `ConsiderationTables.js`
outright. The header's closing sentence compounds this: it justifies
CommonJS by "via Next's CJS/ESM interop, a browser-bundled component": but
there is no browser-bundled consumer left; the two live callers
(`extract.js` and `lib/parser-v2/consideration-equity.js`, both server-side
CommonJS) don't need that interop at all. Fixed: named the real second
consumer (`consideration-equity.js`), recorded the deletion with its commit
hash, and corrected the CJS justification. This is a real instance of the
pattern the coordinator flagged: a stale pointer to code that no longer
exists, sitting beside code that's read as authoritative.

**What it actually does:** Guards raw-text instrument-mention scanners
against false positives from boilerplate that NAMES an instrument only to
say none is outstanding ("there have been no issuances of... restricted
shares..."). Scopes the check to the sentence containing the match and
tests a deliberately narrow set of negation-of-existence phrasings, so
idiomatic "no" usage (e.g. "no later than") doesn't wrongly suppress a
real, outstanding instrument.

**Findings:** Header fixed (above). No dead exports: all three functions
have live callers beyond tests.

---

### 10. lib/llm-cli-client.js

**Header:** Accurate. `createClaudeCliClient`/`createCodexCliClient` match
the described `claude -p` / `codex exec` subprocess backends exactly; the
`ANTHROPIC_API_KEY` deletion is confirmed at `childEnv()`. Checked the
"never used from Vercel" claim directly: grepped every `pages/api/**` file
for this module and found zero hits: confirmed, its only callers are
`scripts/*` runners and a handful of `lib/` pipeline modules that those
scripts drive.

**What it actually does:** Wraps the local `claude`/`codex` CLI
subprocesses in the same `{ messages: { create() } }` shape the Anthropic
SDK client exposes, so the whole extraction pipeline can run on flat-rate
CLI subscriptions instead of metered API tokens, with a 2-way concurrency
semaphore and JSON-only system-prompt injection to stop `claude -p` from
trailing prose after the JSON.

**Findings:** None of note. Genuinely the single implementation of this
backend; heavily used across the ingestion/backfill script family.

---

### 11. lib/model.js

**Header:** Accurate on what it claims (CJS chosen so both ESM and CJS
call sites can consume one model id; `lib/anthropic.js:19` really does
`import { MODEL as _MODEL } from './model'` and re-export it).

**What it actually does:** A 13-line constant module: `MODEL =
'claude-sonnet-4-6'`: that exists purely so the model id has one home
importable from both module systems.

**Finding (hardcoding that bypasses the single source of truth):** not a
header defect, but directly relevant to the header's own premise ("the
single Anthropic model id"). `scripts/canonical-v2-f28-live-extraction-run.mjs`
does not import `lib/model.js` at all; instead it hardcodes
`let providerOptions = { model: 'claude-sonnet-4-6' }` at line 227 as the
default used whenever `--api-key-mode` is passed (i.e. the path that makes
a real, metered Anthropic API call rather than going through the CLI). The
same hardcoded literal recurs across its sibling scripts
(`canonical-v2-modiv-first-live-extraction-run.mjs`,
`canonical-v2-f28-second-live-extraction-run.mjs`,
`canonical-v2-f28-third-live-extraction-run.mjs`,
`canonical-v2-skechers-first-live-extraction-run.mjs`,
`canonical-v2-live-extraction-run.mjs`). If `lib/model.js`'s `MODEL` is
ever bumped, every one of these live-extraction runner scripts keeps
calling the OLD model id under `--api-key-mode` until each is separately
edited: silently, since nothing would fail, it would just extract on a
stale model. Worth a plan line: either import `MODEL` in these scripts or
document why the live-extraction runners are deliberately pinned
independently of the pipeline default.

---

### 12. lib/negation-boundary-guard.js

**Header:** Accurate. Cross-checked the two live pointers it depends on:
`lib/canonical-v2/representations-dark-bridge.js` exists and does define
`groundedInSource` (line 352) as described; `docs/codex-program/notes/
negation-reversal.md` exists (not verified further: docs are out of scope
to edit and the pointer only needs to resolve). The validated-corpus
numbers in the header (36/36 flagged, ~10% stride-sample fire rate) are
exactly the kind of claim that could go stale silently, but both
`tests/canonical-v2-representations-dark-bridge.test.js` and
`tests/negation-boundary-guard.test.js` reference this same validation, so
it is a real, test-backed number rather than a narrative-only claim. Did
not re-derive the exact percentage by hand (would mean re-running the
stride sample against live fixtures, which is what `CI=true npm test`
already exercises).

**What it actually does:** A second, complementary defence against a
different failure than `instrument-negation.js`: instead of guarding
"is this instrument mentioned only to be denied," it guards "does this
extracted QUOTE start just after a negation the quote itself omits": e.g.
trimming "have a Company Material Adverse Effect" out of "...would not
have a Company Material Adverse Effect...", which is a true substring but
asserts the opposite of the source sentence. Explicitly a text heuristic,
not a parse: the header itself documents its own known blind spot
(negations further than ~240 chars or past a clause boundary) and requires
callers to fail closed on a positive result.

**Findings:** Live: used by `lib/verification.js`,
`lib/canonical-v2/representations-dark-bridge.js`, and
`lib/canonical-v2/phase1-authority-boundary-inventory.js`, not just tests.
No defects spotted beyond what the header already discloses about itself.

---

### 13. lib/normalize-numeric.js

**Header:** Accurate but incomplete on consumers, low consequence. Header:
"Used by scripts/backfill/normalize-numeric-claims.js" (confirmed). Grep
turned up two more real callers the header doesn't mention:
`lib/queries/corpus-duration.js` (imports `parseDuration`,
`wordsToNumber`) and `lib/row-market-stats/observations.js` (imports
`parseNumeric`). Neither claim in the header is false: it just isn't
exhaustive, and reads as if the backfill script is the only consumer worth
knowing about. Left the header alone rather than turn a one-line "used by"
into a maintenance-prone consumer list; noting it here since the shape of
the drift (new callers accumulate, header doesn't) is the same pattern
this whole audit is hunting, just at low stakes since nothing about the
module's own behaviour is misrepresented.

**What it actually does:** A closed-vocabulary numeric normalizer (USD,
percent, elapsed_hours, calendar_days, business_days, months, years,
shares: 8 units, matches `CLOSED_UNITS` exactly) that parses BOTH digit
and fully-spelled-out number phrases, and deliberately returns `null`
rather than guess whenever the text is ambiguous (a range, two conflicting
figures, a number with no recognizable unit).

**Findings:** All four exports have live, non-test callers. No defects
spotted; the catastrophic-backtracking avoidance (word-splitting instead of
a repeated-optional-group regex, called out explicitly in two separate
comments) reads as a lesson actually learned rather than a decorative
comment.

---

### 14. lib/parse-money.js

**Header:** Fully accurate, and the strongest-evidenced header in this
batch: worth recording as a positive example, not just "fine, moving on."
The header names six specific pre-existing duplicate functions in six
named files and claims all six are now thin adapters over
`parseMoneyAmount`. Checked every one directly:
- `components/review/table-configs/termination-fees.config.js`'s
  `parseFeeAmountUsd`: `return parseMoneyAmount(amount, { scale: true });`
- `lib/feature-compare.js`'s `numericValue`: `return
  parseMoneyAmount(inner);`
- `lib/query/derived-fields.js`'s `parseUsdAmount`: `return
  parseMoneyAmount(String(value));`
- `pages/review-v1/[id].js`'s `parseDollarAmount`: `return
  parseMoneyAmount(v, { scale: true });`
- `components/review/table-configs/consideration-hero.config.js`'s
  `parseDollarNumber`: `return parseMoneyAmount(inner);`
- `components/review/table-configs/ioc-exceptions.config.js`'s
  `dollarFromText`: the wrapper function was actually deleted outright and
  replaced with a direct `parseMoneyAmount()` call at its one use site
  (thinner than even the header implies).

All six confirmed. Every call site also carries its own comment pointing
back at this module's header for the backstory, so the consolidation reads
as deliberate and complete, not accidental.

**What it actually does:** The one shared "resolve exactly one dollar
figure out of a string, or null" primitive, with a dollar-sign-aware
ambiguity rule (a lone `$`-figure beats a coincidental nearby citation
number like "(§7.3(c))") and opt-in scale-word handling
(million/bn/k/etc., only when adjacent to the resolved figure).

**Findings:** None. This is what a correct, currently-true header looks
like: a specific, falsifiable, multi-file claim that checks out exactly
as written.

---

### 15. lib/parser-v2/advisors.js

**Header:** Accurate on what the module itself does. Worth a note, not a
header fix: this is an older, regex/proximity-based advisor extractor
(`extractAdvisors`, matching a hardcoded `FIRMS` list by pattern and
inferring `party` from nearby anchor phrases) that coexists with a newer,
deterministic system in `lib/parser-v2/notice-advisors.js`
(`buildAdvisorsV2`, used by `lib/ingest/deal-metadata-prompt.js` for
`metadata.law_firms`: see module 8 above). `extractAdvisors` is still
genuinely live (`scripts/ingest-local.js` and
`lib/broad-corpus/contained-routes/from-url.js` both call it), so this is
not a dead-code finding, but it means the codebase currently runs TWO
independently-maintained advisor-identification systems side by side (a
hardcoded firm list with proximity matching here, vs. deterministic
notice-block party-segmentation in `notice-advisors.js`), writing to what
appear to be two different metadata keys. Did not chase which key(s)
`extractAdvisors`'s output lands in beyond confirming both are wired to
real callers: flagging the overlap for the plan rather than asserting
which one is redundant, since that is a product decision (which firm list
is more trustworthy), not a code-reading one.

**What it actually does:** Scans a merger agreement's preamble, signature
block, and Notices section for ~50 hardcoded BigLaw/investment-bank firm
name patterns, and for each hit conservatively infers `{firm, party,
partner, role}` only when a confident nearby party-anchor phrase ("counsel
to the Company", "if to Parent:", etc.) is also found: emits nothing
rather than guess the side.

**Findings:** See overlap note above. No defects spotted in the module
itself.

---

### 16. lib/parser-v2/attribute-provision-section.js

**Header:** Accurate, and a good example of "history kept as history": the
specific "470 of 952 sections" statistic is explicitly tied to a named,
dated baseline run (`reports/span-residual-baseline.json`, 2026-07-18):
read as a citation of a past measurement, not a present-tense fact, so it
does not go stale the way an un-dated count would. Confirmed
`scripts/span-residual-baseline.js`'s `groupProvisionsBySection` now
really does delegate to this module's `attributeProvisionsToSections`
(line 81), matching the header's "the same shape... returned before this
module existed" framing exactly.

**What it actually does:** Re-attributes a deal's already-extracted
provisions to their CURRENT classified section by searching for each
provision's own verbatim text inside each candidate section's current
text, rather than trusting the provision's stored (and potentially stale)
character offset: because `classified_sections` gets overwritten wholesale
on every reclassification run, so a stored offset can silently point at
the wrong section, or none, after any later re-ingest. Falls back to the
old numeric-containment check only when content matching finds nothing
anywhere.

**Findings:** Live, not dead: sole real-world caller
(`scripts/span-residual-baseline.js`) confirmed. No defects spotted; the
tie-break logic (prefer the content-match closest to the stale offset) and
the fallback ordering both match what the header claims.

---

### 17. lib/parser-v2/classify.js: HIGH CONSEQUENCE FINDING

**Header:** Inaccurate in the same family as the classifier finding that
started this whole audit, in the same subsystem category (automatic
section/provision classification), and in a file that is unambiguously
LIVE and central (not dormant). Fixed.

Header claimed: "Uses a two-pass approach: 1. Deterministic pre-
classification (regex) for high-confidence patterns only 2. AI
classification (Claude) for everything else." A section banner four lines
into the body reinforced this: "Only ~10 patterns that NEVER misfire.
Everything else goes to AI."

Read the actual code. `DETERMINISTIC_RULES` (section-type rules) has **32**
entries, counted directly off the array, not estimated: more than 3x the
claimed "~10." That is only one of *three* independent deterministic rule
tables in this file: `SUBCODE_REFINEMENT_RULES` (33 entries, stamping a
more specific canonical code after type resolution) and `ARTICLE_TYPE_MAP`
(15 entries, article-level type inference) are two more, neither mentioned
in the header at all. Beyond the rule tables, the real pipeline the
function `classifySections` runs is (by its own inline pass banners):
Pass 0 (article classification) → Pass 1 (the 32 section rules) → Pass 1.5
(a prior-snapshot CACHE that reuses a section's last classification when
its text hash is unchanged: an entire resolution path with no AI call
and no regex match, absent from the header entirely) → Pass 2 (AI, batched
30 sections at a time) → Pass 2.5 (REP article-ordering fixup, by document
position) → Pass 2.6 (REP section-ordering fixup) → Pass 2.7 (codename
conduct-section fixup, e.g. "Conduct of Maverick" positional inference) →
Pass 2.8 (NOSOL content-based fallback, explicitly verified against all 40
deals before being widened in scope) → Pass 3 (sub-code refinement) →
final 100%-coverage safety net → complexity estimation. Four of these
stages (2.5-2.8) run AFTER classification and can OVERRIDE an AI or
deterministic result, entirely deterministically, using document ordering
or body-content signals: a mechanism the "two-pass" framing gives no hint
of at all.

**Why this is high-consequence, not just imprecise:** this is the same
shape of error as the section-family-classifier finding that opened this
whole audit: a classification module's own header undercounting how much
real, working, corpus-verified deterministic machinery already exists,
in a way that reads as "thin, AI does most of the work." Confirmed via
`grep` that `classifySections` is genuinely live and central:
`scripts/ingest-local.js` (the real ingest path) and `scripts/reprocess.js`
call it directly, and `lib/parser-v2/snapshot.js`, `structural.js`, and
`validate.js` all depend on its output shape. Anyone deciding "how much of
classification is automatic vs. needs a human/AI pass" from this header
alone would undercount the deterministic coverage by roughly 8x (32 vs.
~10, before even counting the other two rule tables and the four
positional fixup passes): structurally the same mistake that produced the
false "twenty-five families need hand-mapping" claim to the repo owner.

**Header fix:** rewrote both the top docblock and the "1. DETERMINISTIC
PRE-CLASSIFICATION" section banner to describe the real multi-stage shape
(three independently-sized rule tables, a cache layer, AI fallback, four
post-classification fixup passes) and deliberately did NOT hardcode a new
count: instead told the reader to count the arrays in the code, since a
fresh number would just go stale again the next time a deal needs one more
rule (per this task's own "prefer shapes to counts" guidance, and per how
this exact file's rules keep growing one deal-specific pattern at a time).

**What it actually does:** Classifies every segmented section of a merger
agreement into a rubric provision type (REP-T, COND-B, IOC-T, NOSOL, TERMF,
etc.) via the layered pipeline above, then estimates a complexity tier per
section. It is the live gatekeeper for what downstream extraction even
attempts on a section: a wrong classification here is not cosmetic, it
determines which extractor prompt runs (or doesn't) against that text.

**Findings:** No dead exports: `tryDeterministic`/`refineSubCode`/
`classifyArticle` all have real callers beyond tests
(`scripts/safety-check-nosol-rule.js`, `scripts/safety-check-reclass-rules.js`,
`lib/parser-v2/canonical-proposals.js`), confirming the corpus-wide
"safety-check" scripts referenced throughout the inline comments are real,
not aspirational. One small, low-stakes internal inconsistency spotted but
NOT fixed (it is a body comment, not a header, and out of my edit scope):
two separate stages are both labelled "Pass 3" in the function body
(sub-code refinement, then complexity estimation): cosmetic only, does
not affect behaviour, flagging in case whoever owns non-header comments
wants to renumber one of them.

---

### 18. lib/parser-v2/extract.js (8429 lines, 134 functions: read in
structural pieces: header, both strategy-type Sets, all four strategy
banners, the full export list, plus targeted greps; not read start-to-end)

**Header:** One real, cleanly-verified inaccuracy in the four-strategy
table itself: the part of the header most likely to be relied on to find
your way around an 8429-line file. Fixed.

Header's "Strategies" table claimed:
- A handles "DEF, IOC, COND-M/B/S, TERMR types"
- C handles "REP, STRUCT, CONSID, COV, TERMF, MISC"

The code disagrees on both counts, and says so explicitly in its own
banners, not just in the type-Sets:
- `STRATEGY_A_TYPES` (line 147) is `IOC, IOC-T, IOC-B, COND-M, COND-B,
  COND-S, COND, TERMR, TERMR-M, TERMR-B, TERMR-T`: no `DEF`. Strategy A's
  own banner at line 3289 lists its routed types and DEF is absent there
  too. DEF has always belonged to Strategy D alone (its own dedicated
  banner, "Strategy D: Definition splitting (DEF)").
- `STRATEGY_C_TYPES` (line 162) is `REP-T, REP-B, STRUCT, CONSID, COV,
  MISC, OTHER`: no `TERMF`. `TERMF` is in `STRATEGY_B_TYPES` (line 159)
  instead, and Strategy C's own banner spells this out in so many words:
  "Routed types (STRATEGY_C_TYPES): REP-T, REP-B, STRUCT, CONSID, COV,
  MISC, OTHER (and any unknown type). **NOT TERMR (→ Strategy A) or TERMF
  (→ B).**" (line 4352-4353, verbatim). The code is not just silently
  different from the header, it contains an explicit correction note as if
  written by someone who had already been bitten by this exact confusion:
  the top header just never got the same fix.

This one is worth flagging for consequence, not just correctness:
termination fees (TERMF) are one of the most legally load-bearing,
frequently-litigated provision types in the whole schema (see module 14's
`parse-money.js` writeup for how much weight this codebase already puts on
getting TERMF amounts right), and the header sends a reader looking for
"how does TERMF extraction work" to Strategy C's one-provision-per-section
logic when the real mechanism is Strategy B's overlapping-span, multi-code
extraction: a materially different code path with different assumptions
(chunked multi-section prompts, not one-section-one-call). Fixed the table
to match `STRATEGY_A_TYPES`/`STRATEGY_B_TYPES`/`STRATEGY_C_TYPES` exactly,
and added a one-line warning that a type's strategy has moved before (this
is presumably exactly how TERMF ended up on the wrong side of the header)
so a future reader checks the Sets rather than trusting the prose again.

**What it actually does:** The core Phase-3 extraction engine: takes
classified sections and, per type, runs one of four strategies (regex-
split-then-AI-classify for IOC/COND/TERMR; AI multi-code overlapping-span
extraction for NOSOL/ANTI/TERMF; one-call-per-section AI extraction for
REP/STRUCT/CONSID/COV/MISC/OTHER; regex-split-plus-alias-lookup for DEF),
then runs a long tail of deterministic post-passes (boundary repair,
citation resolution, cross-linking reps to definitions, material-contract
bucket stamping, outside-date month math, and more: roughly 90 functions
are exported, most explicitly "for testing," giving a sense of how much of
this file is granular, independently-tested post-processing rather than
one monolithic pass).

**Finding (capability built, wired, deliberately not turned on anywhere):**
The "span accounting spec Part 2" machinery threaded through this file
(`resolveSpanClaimsOpts`, `attachStrategySpanClaims`,
`attachSpanClaimsToProvisions`) is, unusually, HONEST about its own
dormancy in its own comment: "INERT unless a caller passes
`opts.spanClaims === true`... No default call site enables it; wiring
exists so it can be turned on for a controlled rollout without touching
extract.js again." Checked whether that rollout has happened: grepped for
`PM_SPAN_CLAIMS` (the operator env-var switch) and `spanClaims: true`
across every script, API route, CI config, and `.env*` file in the repo.
Zero hits outside this feature's own five files
(`extract.js`, `span-claims.js`, `store-claims.js`, `store-cards.js`,
`validate.js`) and its own dedicated wiring test
(`tests/span-claims-wiring.test.js`). So this is a complete, cross-file,
tested feature: full span-level provenance tracking through extraction,
storage, and validation: that has never been switched on in any real
ingest run. Unlike the classifier/pin-sweep findings, the header here does
NOT misrepresent this (it says outright that it's inert by design), so
this is not a header fix. It IS exactly the kind of built-and-bypassed
capability the coordinator asked me to surface: worth a plan line on
whether "span accounting Part 2" rollout is scheduled, abandoned, or
waiting on something, since right now it is fully-built inventory nobody
benefits from.

**Minor, not fixed:** the header's closing line ("CommonJS: consumed by
Next.js API routes") has the same soft staleness as module 8's finding:
`extractProvisions`'s only LIVE caller today is `scripts/ingest-local.js`;
the actual API-route caller (`lib/broad-corpus/contained-routes/from-url.js`)
is the same dormant from-url handler discussed under module 8, sitting
behind the `pages/api/ingest/from-url.js` containment stub. Left this
alone: it is a one-line design-rationale note (why CommonJS), not a
load-bearing usage claim, and the underlying reason (API-route
compatibility) remains architecturally correct even while that specific
route is contained.

**Findings:** No further defects spotted in the portions read. Given the
file's size, this was a structural read (header, both type-Sets, all four
strategy banners, full export list, targeted greps) rather than line-by-
line: flagging that explicitly per the brief's instruction to say so when
coverage is partial, rather than implying a page-by-page review of all
8429 lines.

---

### 19. lib/parser-v2/extraction-checkpoint.js

**Header:** Accurate. `save()`/`load()`/`clear()` semantics match exactly
(load gated on `resume` then on `inputHash` equality; save wrapped so a
disk error can't fail the ingest; clear best-effort). The historical
motivation ("Bioverativ Phase-3 canary, 2026-07-16") is properly past-
tense.

**What it actually does:** Per-stage disk checkpointing for the expensive
LLM phases of a full ingest, keyed by a content hash of the input text, so
a `--resume` rerun after a mid-pipeline failure reloads completed stages
instead of re-paying for hours of already-done LLM work.

**Findings:** Live: `scripts/ingest-local.js` constructs it,
`lib/parser-v2/extract.js` consumes the interface. Not dead code.

---

### 20. lib/parser-v2/format-renderer.js

**Header:** One tiny, low-stakes inaccuracy, fixed. Header said "Two
helpers are exported"; `module.exports` actually has three
(`parseFormattedDocument`, `stripFormattingMarkers`, `parseInline`).
Checked whether `parseInline` has any caller beyond this file, grepped
every `.js`/`.jsx` file including tests, and found none. So this is a
small instance of the coordinator's "capability nobody appears to be
using" pattern: a function exported (presumably so it COULD be unit-tested
or reused directly) that nothing outside this file ever imports. Fixed the
header to name it explicitly as exported-but-internal rather than silently
undercount the export list.

**What it actually does:** Converts the `[[MARKER]]...[[/MARKER]]`-laden
`full_text` the DB stores into a block/inline token tree (or, via
`stripFormattingMarkers`, back to clean plain text): the shared parser
behind however the review UI renders the source document.

**Findings:** See above. `parseFormattedDocument`/`stripFormattingMarkers`
are both genuinely live (used well beyond this file). No defects spotted.

---

### 21. lib/parser-v2/notice-advisors.js

**Header:** Accurate, and unusually precisely so. The four-step
side-attribution priority chain the header describes ((a) designation vs.
known party names, (b) block body's first lines vs. party names, (c)
generic buyer/seller keywords, (d) two-blocks-one-resolved fallback) maps
onto `resolveSides()` in the same order, almost clause-for-clause.

**What it actually does:** Pure, deterministic (no LLM) extraction of
outside counsel (firm name plus attorney names, per side) from a deal's
Notices provision, by splitting the text into "if to X, ...:" party
blocks, working out which side each block belongs to, then locating law-
firm-shaped lines and the "Attention:" names that follow them.

**Findings:** This is the "v2"/deterministic advisor pipeline referenced
under module 15's overlap note (`lib/parser-v2/advisors.js`'s older,
proximity-based `extractAdvisors` coexists with this module's
`buildAdvisorsV2`): not repeating that finding here, see module 15. No
defects spotted in this file itself.

---

### 22. lib/parser-v2/parse-json.js

**Header:** Accurate. The four claimed tolerances (clean JSON, trailing
prose, prose preamble, markdown fences, truncation repair: the header
numbers these (a)-(d)) map one-to-one onto `parseJSON`'s four numbered
steps in the function body.

**What it actually does:** A prose-tolerant JSON extractor for LLM
responses: handles the subscription-CLI backend's tendency to wrap JSON
in reasoning prose or cut it off mid-object, while leaving the clean-JSON
path byte-identical to `JSON.parse`. Never throws; returns `null` on
unrecoverable input.

**Findings:** None of note.

---

### 23. lib/parser-v2/reapply-corrections.js: worth a header fix, low
consequence (constants unaffected, only their justification prose)

**Header:** One genuine, self-contained arithmetic error in the "DATA-2
hardening" reasoning comment, fixed. It claimed: "`MIN_MARGIN` (0.15)...
is roughly half of the gap between the two similarity floors (0.45 vs
0.6)." The gap between 0.45 and 0.6 is 0.15, so 0.15 is the WHOLE gap,
not half of it; the sentence contradicts its own arithmetic as written.
Reading the surrounding comment explains how this happened: the same
paragraph says `MIN_SIM_WITH_CATEGORY` was "raised 0.3 -> 0.45." Under the
ORIGINAL 0.3, the gap to 0.6 was 0.3, and half of THAT is 0.15, so "half
the gap" was true when first written. When `MIN_SIM_WITH_CATEGORY` was
later raised to 0.45, the parenthetical was updated to show the new
number, but the "roughly half" claim was never re-derived against it:
exactly the "a number moved, the argument wasn't re-checked" pattern this
whole audit exists to catch, just inside a reasoning comment rather than a
top-of-file header. Fixed the prose to state the true current relationship
(0.15 is now the full gap, not half) while keeping the underlying
justification (why 0.15 still works) intact, per this task's "keep the
reasoning" instruction. The constant itself (`MIN_MARGIN = 0.15`) was not
touched: this is a comment-only fix, and the value is presumably still
correct behaviourally (test-covered), just no longer explainable the way
the comment claimed.

**What it actually does:** Lets a human correction made through the review
UI survive a full re-ingest: computes exactly which fields the user
changed, re-matches each correction to its freshly-extracted provision by
category + Jaccard token-overlap similarity (with three independent
guards: a raised similarity floor, a minimum win-margin over the runner-
up, and a contiguous-fragment re-check: against grafting a correction
onto the wrong sibling provision), then re-applies the user's delta on top
of the fresh extraction.

**Findings:** Live: `lib/parser-v2/run-extract.js` calls
`reapplyCorrections` after every store. No other defects spotted; the
three-guard design reads as a genuine response to a specific observed
failure mode (two similar sibling provisions, e.g. two termination-fee
provisions with different triggers), not decorative caution.

---

### 24. lib/parser-v2/resolve-source-span.js

**Header:** Accurate, and worth noting as another strong example (like
module 14's `parse-money.js`). The four-step resolution order it documents
(validated explicit offsets → exact-quote find → region_full_text fallback
→ unresolved, "never guess") matches `resolveSourceSpan`'s numbered
comments and returned `status` values exactly. Its more surprising claim:
that `card.primary_quote_start`/`primary_quote_end` are computed relative
to `region_full_text`, NOT as absolute offsets into the deal's full text,
"despite the M4-M5 reconciled plan's description": reads exactly like
the kind of thing this whole audit is hunting (a plan/spec saying one
thing, the code doing another) but here the header is the one correctly
flagging the discrepancy rather than perpetuating it, and explicitly cites
having "verified against live data." Also checked the narrower claim that
this module's step 1 "does not read" the `primary_quote_span_verified`
flag: confirmed the function never references that field.

**What it actually does:** Locates a provision card's quote inside the
marker-STRIPPED version of a deal's raw document text (not the raw text
itself, because inline `[[REF]]`/`[[DEFINED]]` tags would otherwise throw
off the character span), so the source-document overlay can highlight
exactly the right span. Deliberately never falls back to a guess: an
unresolved span opens unscrolled with a notice instead of risking a wrong
highlight.

**Findings:** None of note.

---

### 25. lib/parser-v2/run-extract.js: same "ingestion is contained" drift
as modules 8 and 18, fixed

**Header:** Claimed this module's orchestration "runs from two entry
points: the API route (Vercel...) and scripts/extract-local.js (local...)."
Checked `pages/api/ingest/extract-type.js` directly: like
`pages/api/ingest/from-url.js` (module 8) and `pages/api/ingest/
classify.js` (also checked, same result), it is now a two-line containment
stub (`createBroadCorpusContainedHandler('POST')`, 503), not a caller of
this module. This is the THIRD module on my list where a header describes
an API route as a live consumer when the entire `pages/api/ingest/*`
surface has since been converted to containment stubs (see modules 8 and
18 for the other two). Fixed by naming the dormancy explicitly and citing
module 8's writeup for the fuller story, and noted that today's only live
callers are scripts (`extract-local.js`, `ingest-worker.js`,
`reprocess.js`: confirmed by grep).

**What it actually does:** Runs one type group's classify-output → extract
→ validate → store pipeline end to end for a single deal, including
re-applying human corrections afterward and writing a run record for
diffing later. Both the Supabase client and the model client are injected,
never constructed here.

**Findings:** This is the third instance of the same systemic pattern
(module 8, 18, 25): worth stating once, plainly, for the plan rather than
as three unrelated findings: **every header on my list that describes a
`pages/api/ingest/*` route as a live consumer is describing a route that
is currently a containment stub.** The underlying architecture (script and
API route sharing one lib implementation) is real and sound, and each
shared module's non-route caller is genuinely live. But anyone reading
only these headers, without checking `pages/api/ingest/` directly, would
believe the web-triggered ingest path is live when it is deliberately
switched off. That containment is clearly a known, deliberate decision
(cited in-repo as "ingestion stays off," tied to a security review
finding): the point here is only that the headers describing the shared
modules hadn't caught up to it.

---

### 26. lib/parser-v2/snapshot.js

**Header:** Accurate, mostly-complete. Names four of the module's seven
exports as the interface ("Everything snapshot-shaped now goes through
here: toCompactSections / sectionsForExtractFromSnapshot /
buildPriorLookup / diffClassifications"); the other three
(`normalizeSectionText`, `sectionTextHash`, `classifyBreakdown`) are
lower-level primitives the four main functions are built from, or a small
reporting helper: omitting them from the headline list reads as a
reasonable editorial choice, not an inaccuracy, so left alone. The "before
this module" motivation (compact shape duplicated inline in two places,
`scripts/ingest-local.js` never wrote it at all) is properly past tense.

**What it actually does:** The one shape/serialization layer for
`deals.metadata.classified_sections`: converts classify.js's live output
to the persisted compact shape and back, builds the text-hash cache
`classify.js`'s Pass 1.5 uses to skip AI re-classification of unchanged
sections (see module 17), and diffs two snapshots section-by-section
(paired by section number first, then by text hash) for before/after
reclassification reporting.

**Findings:** Live: confirmed as a dependency of `classify.js`'s cache
layer (module 17) and `run-extract.js` (module 25). No defects spotted.

---

### 27. lib/parser-v2/span-claims.js

**Header:** Accurate. The three-pass location strategy (exact `indexOf` →
whitespace-tolerant regex → same regex against a ~160-char head) matches
`locateInSection` exactly, including the constant (`HEAD_CHARS = 160`).
The "three different span coordinate spaces this repo carries" list inside
the file (section-relative here; `region_full_text`-relative in
`store-cards.js`'s cards; marker-stripped-full-text-relative in
`resolve-source-span.js`) cross-checks cleanly against modules 24's
independent read of `resolve-source-span.js`: both files describe the
same three spaces consistently.

**What it actually does:** For each extracted item, works out which Part-1
sub-clause leaves (see module 30, `subclauses.js`) its located text
overlaps (`claimedSpans`, for coverage accounting) and where the item's own
text sits (`textSpan`, for a downstream verifier to compare against the
source directly instead of re-searching). This is the producer half of the
capability flagged as dormant under module 18: confirmed again here:
`attachSpanClaimsToProvisions` is "INERT by default" per its own comment,
gated on the same `opts.spanClaims === true` already shown (module 18) to
have no real caller anywhere in the repo.

**Findings:** No new finding: corroborates module 18's dormant-capability
finding from the producer side rather than adding a new one.

---

### 28. lib/parser-v2/span-residual.js

**Header:** Accurate. Thresholds match code exactly
(`RESIDUAL_RATIO_THRESHOLD = 0.25`, `SINGLE_LEAF_THRESHOLD = 1500`,
`MIN_RESIDUAL_LEAF_CHARS = 200`), and the header is explicit that this is
Part 3 "REPORT-ONLY rollout gate 1" with gates 2 (enforcement) and 3
(ingest-qa gate) "deliberately NOT implemented here."

**What it actually does:** Given a section's structural leaves and the
union of spans extraction actually claimed, computes what's left over
un-claimed, ignoring leaves too short to matter and benign transitional
chapeau text, and flags the section `EXTRACTION_INCOMPLETE` past a
size/ratio threshold. Pure report: never mutates or blocks anything.

**Finding, ties modules 18/27/28/31 together:** Checked whether this
"rollout gate 1" report actually runs routinely. It does not: grepped
`package.json` and `scripts/ingest-qa.js` for `span-residual-baseline` and
found nothing: the only place it runs is
`scripts/span-residual-baseline.js` itself, invoked by hand (module 16's
header already frames its one known run as "the 2026-07-18 baseline run,"
a specific historical event, not a recurring job). Putting modules 18, 27,
28, and 31 together: the "span accounting spec" is a three-part initiative
where **Part 1** (`subclauses.js`, module 30) is live, load-bearing
infrastructure reused by multiple modules; **Part 2** (`span-claims.js`,
module 27, wired through `extract.js`, module 18) is fully built and
tested but never enabled outside its own test; and **Part 3** is stuck at
"gate 1": a report-only check that itself depends on Part 2 being enabled
to say anything useful (this module's docstring says as much:
`computeSpanResidualReport` "conservatively flags the WHOLE section as
residual" when Part 2 wiring wasn't enabled, i.e. currently, always): with
gates 2 and 3 explicitly not built. Every header describing each piece
individually is honest about its own inertness, so this isn't a header
defect anywhere. It IS a clear plan item: either finish and turn on the
span-accounting rollout, or decide it's not worth finishing and say so,
because right now three phases of real engineering work sit almost
entirely unused.

---

### 29. lib/parser-v2/store.js (1045 lines: read in full; header rewritten)

**Header:** Understated the module's real scope, fixed. Original header:
"Atomic storage of extracted provisions into Supabase: 1. Store raw
agreement text 2. Delete existing provisions + annotations 3. Batch-insert
new provisions." That describes only the CORE-provisions path. The
`module.exports` list (12 names) and the body show at least three more
substantial, independent concerns the header never mentions: **deal
topology + transaction-step materialization** for multi-step mergers
(`materializeTransactionSteps`, `fetchTransactionContext`,
`transactionStepForProvision`: tender-offer-into-back-end-merger and
double-merger structures get their own topology row and ordered step
rows); **election mechanisms + proration rules**
(`writeElectionMechanism`, with its own proration-rule sub-insert and
cleanup-on-failure); and **consideration-equity provisions + treatments**
(`writeConsiderationEquity`/`materializeConsiderationEquity`, archiving
prior rows via `provisions_archive_20260706` before replacing them). Each
of these three touches its own 2-3 Supabase tables and has its own
graceful-degradation path (`isMissingSchema02Error`, `archiveUnavailable`)
for environments where that optional migration hasn't run: none of which
the "3 simple steps" framing gives any hint of. Fixed the header to name
all four concerns (core provisions, topology, elections, consideration
equity) and their graceful-degradation behaviour, per "prefer shapes to
counts" rather than trying to enumerate every table. Also fixed the
closing "consumed by Next.js API routes" line to match modules 8/18/25's
finding: `storeProvisionsForType` is reached today only via
`run-extract.js`, whose own header now explains the current containment
status.

**What it actually does:** The full write side of the v2 pipeline:
persists not just the extracted provisions themselves but every structured
sub-model extraction can produce for a deal's transaction mechanics
(topology, elections, consideration treatment), with type/code-aware
deduplication and archive-before-replace semantics throughout.

**Findings:** `storeProvisions`/`storeProvisionsForType` are live
(confirmed via `run-extract.js`, module 25). No correctness defects
spotted in the ~650 lines read closely; the graceful-degradation pattern
(catch a specific missing-table signature, return null rather than throw)
is applied consistently across all three optional sub-systems, which
reads as deliberate design rather than copy-paste.

---

### 30. lib/parser-v2/subclauses.js

**Header:** Accurate, and cross-checks cleanly against two other files.
The three-heuristic precedence (SIBLING → CHILD-OPEN → DEDENT) the header
describes in prose matches `findStructuralMarkers`'s own numbered
in-function comments exactly, including the specific worked examples (QXO
§5.2(a)(ii) inline bring-down tiers; Redfin §2.10(d)/(h) staying unsplit;
QXO's real top-level "(b)" dedenting past nested children). The claim that
this module's marker primitives were "lifted from consideration-equity.js
... re-exported so there is one source of truth" is independently
corroborated by `consideration-equity.js`'s own header (seen while reading
module 9's context), which says the same thing from the other side.

**What it actually does:** Part 1 of the span-accounting spec: walks a
section's text and partitions it into ordered leaf spans by outline
position (depth + dotted path like "a.ii.B"), distinguishing a genuine
new sub-clause marker from a parenthetical cross-reference or back-
reference using position-eligibility rules (what can precede a
marker-candidate "(") plus the three-heuristic precedence above.

**Findings:** Live and foundational: `span-claims.js` (module 27) and
`span-residual.js` (module 28) both build directly on `segmentSubClauses`,
and `extract.js`'s Strategy A splitter shares its roman-numeral whitelist.
No defects spotted.

---

### 31. lib/parser-v2/validate.js (601 lines: read in full; header
rewritten)

**Header:** Same understatement pattern as module 29 (store.js), fixed.
Original header listed 4 bullets (valid codes, duplicates, missing
universal codes, proposed codes) plus "generates a validation report." The
code does all of that, but also: **auto-wraps bare citable-feature values**
into the `{ value, quotes }` shape the UI needs (`wrapCitableFeatures`,
labelled "Stage 5" in its own section banner: the "5" implies stages
elsewhere in the pipeline, not stages 1-4 hiding in this file, but it is
one more undocumented concern regardless of the numbering's origin);
**backfills a synthetic OTHER provision for every orphaned classified
section** to guarantee 100% section coverage in the stored output
(`backfillOrphanSections`, one of only 3 names in `module.exports`: i.e.
a first-class exported capability, not an incidental helper); and
**optionally computes the Part 3 span-residual report**
(`computeSpanResidualReport`, module 28's consumer). Fixed the header to
name all of these. Also fixed the closing "consumed by Next.js API routes"
line the same way as modules 29/25/18/8.

**What it actually does:** The shape-correctness and coverage gate between
extraction and storage: rejects nothing outright (this module never
throws to block a save) but reports code validity/duplication/coverage
issues, normalizes citable feature values to one shape, and guarantees
every section the classifier saw ends up represented in the stored output
even when no extractor claimed it.

**Findings:** `validateProvisions` is live (module 25's `run-extract.js`
calls it directly). `computeSpanResidualReport`'s own inline comment
independently confirms module 27/28's dormancy finding from a third angle:
it says Part 2 span-claims data is "empty if Part 2 wiring wasn't
enabled," and conservatively treats an unclaimed section as fully
residual in that case: which, per modules 18/27, is the situation
today, always. No correctness defects spotted.

---

### 32. lib/percent-of-deal.js

**Header:** Accurate. The claimed dual consumer set: "the review page"
and "the query engine's market-range executor": checks out precisely:
`components/review-v2/*`, `components/query/CanonicalMarketRange.jsx`, and
`lib/query/executors/market-range.js` all import this module. The claim
that `lib/query/derived-fields.js#parseUsdAmount` "is now a thin wrapper"
over `lib/parse-money.js#parseMoneyAmount`, not its own implementation, is
independently confirmed by module 33's direct read of that file.

**What it actually does:** The one shared "% of deal value" calculation
(and matching one-decimal / two-decimal-under-1% formatting rule) so a fee
or dollar figure can be compared apples-to-apples across deals of very
different size, with strict null-over-guessing semantics (a zero deal
value is "no basis," never "0% of nothing").

**Findings:** None of note. Small, correct, genuinely shared by both
surfaces it claims.

---

### 33. lib/query/derived-fields.js

**Header:** Accurate, and its account of the `parseUsdAmount` consolidation
(now a thin wrapper over `lib/parse-money.js`, replacing a first-number-
wins rule that would have silently mis-computed the real Modiv conditional-
fee headline) is independently corroborated by module 14's direct read of
`parse-money.js` and module 23's cross-reference from that side too: three
files' headers telling the same, consistent, verified story about the same
2026-08-05 change. The "G-C... turned out to already be satisfied by
`outsideDateMonthsPostSigning`... see `lib/parser-v2/extract.js`
`computeOutsideDateMonths`" pointer is also confirmed: that exact function
exists and does exactly that (seen directly in module 18's export list).

**What it actually does:** Query-time-only computed fields (currently:
termination fee and reverse termination fee as % of deal value):
deliberately NOT written back to `ai_metadata.features`, kept structurally
separate from real extracted/canonical fields so "how do we compute this
from what we already have" stays a different kind of decision from "add a
new extracted field."

**Findings:** None of note beyond the cross-references above.

---

### 34. lib/query/fixtures/demo-set-check.js

**Header:** Accurate. All three named pointers resolve:
`scripts/query-demo-check.js`, `tests/query/demo-set.test.js`, and
`lib/query/fixtures/demo-set.json` all exist. The five query kinds the
header implies (one per `checkResult` branch): `FILTER_THEN_LIST`,
`MARKET_RANGE`, `PROVISION_CROSS_CUT`, `DEAL_COMPARE`, `DEAL_TO_MARKET`:
are all implemented with a matching `check*`/`compute*` pair.

**What it actually does:** Pure comparison logic checking a live query
result against a pinned "expected" fixture, per query kind, always
matching deals by the raw `acquirer`/`target` columns rather than a
computed display name (explicitly to dodge a display-name/raw-data
divergence trap the header names explicitly).

**Findings:** None of note.

---

### 35. lib/query/fixtures/resolve-demo-payload.js

**Header:** Accurate. `@deal:X` / `@all_deals` resolution matches
`resolveDealId`/`resolveDemoPayload` exactly, including both thrown error
shapes (`BLOCKED_DEAL_MISSING`, `BLOCKED_DEAL_AMBIGUOUS`).

**What it actually does:** Resolves a fixture's name-substring deal
references against a live `deals` array at test/check run time, recursively
over arrays and objects.

**Findings:** None of note. Tiny, correct.

---

### 36. lib/query/relative-periods.js

**Header:** Accurate, including its most falsifiable claim: a hand-
audited registry of exactly 6 field keys, each named. Counted
`RELATIVE_PERIOD_FIELDS` directly: `absenceOfChangesStartDate`,
`aocNoMaeSinceDate`, `lookbackDateISO`, `secFilingsExceptionLookbackDate`,
`secFilingsExceptionLookback`, `lookbackPeriod`: six keys, same six names,
same order as the header's registry list. Worth recording as a second
positive example (alongside module 14's `parse-money.js`) of a header that
makes a precise, checkable count claim and gets it exactly right.

**What it actually does:** Converts a stored look-back reference: a
literal date, a defined-term anchor, or a duration: into a deal-relative
"months before signing" figure, so look-backs become comparable across
deals the same way fees are compared as % of deal value rather than raw
dollars (the header credits `lib/percent-of-deal.js`, module 32, as the
pattern this deliberately mirrors, and the resemblance: shared
computation, null over guessing, additive wiring: is real). Never guesses:
ambiguous or multi-anchor prose, anchors after signing, and undeclared bare
numbers all resolve to null.

**Findings:** None of note.

---

### 37. lib/rep-materiality.js

**Header:** Accurate on what the code does (a genuinely thin wrapper:
every exported function is a one-line pin-and-delegate onto
`lib/feature-compare.js`, confirmed in module 7's read of that file too).

**What it actually does:** Pins `(type, featureKey='materialityQualifier',
absentCode='MAT_NO_QUALIFIER')` so a caller can ask the materiality
question directly (per rep code, per cohort) without knowing
`feature-compare.js`'s general API: a worked example of "any other
qualitative term is one call away," per its own header.

**Finding:** See the addendum on module 7 above: confirmed directly (not
just inferred) that this engine's dedicated API route,
`pages/api/compare/rep-materiality.js`, is a
`createBroadCorpusContainedHandler('GET')` stub, alongside
`pages/api/compare/features.js`. Both routes are named explicitly in
`lib/broad-corpus-containment.js`'s route table, so this was a deliberate,
tracked containment decision, not an oversight, but it means neither this
module nor the general engine it wraps has a live path to a user today.

---

### 38. lib/reports/persist-report.js

**Header:** Accurate. `VALID_KINDS` (7 entries: ingest-qa, coverage-audit,
rematerialize-claims, mint-cards, span-residual, demo-dryrun,
v1-reclass-apply) matches `render-helpers.js`'s `REPORT_KINDS` (module 39)
exactly, in the same order: confirming the "kept in sync" claim the other
file makes about this one. The one forward-looking note in the header:
"and later scripts/demo-dryrun.js," phrased as not-yet-existing at time of
writing: has since come true (`scripts/demo-dryrun.js` exists today); not
a defect, just a note that the "later" framing could be tidied up whenever
someone next touches this header. Left alone as not worth a standalone
edit.

**What it actually does:** The one durable sink (`run_reports` table) for
every producer script's JSON report, so `/admin/reports` can show history
without repo/Vercel filesystem access: fails soft on a missing table
(the migration is Ben-run by hand and may not exist in every environment)
without ever crashing the calling producer, and caps oversized payloads by
progressively trimming `payload.deals` rather than dropping the whole
report.

**Findings:** None of note.

---

### 39. lib/reports/render-helpers.js

**Header:** Accurate. Both claimed reasons for existing (JSX page files
can't be `require()`d by the plain `node --test` runner; needs to be
fixture-testable) are corroborated by the existence of
`tests/admin/reports-kind-renderers.spec.js` and
`pages/admin/reports/index.js` / `pages/admin/reports/[kind].js`. Its own
internal cross-reference claim, that it is kept in sync with
`persist-report.js`'s `VALID_KINDS`, is independently confirmed from the
other side under module 38.

**What it actually does:** Pure, DB-free shaping of a producer's raw JSON
`payload` into render-ready rows/views for the admin reports UI, one
builder per report kind, each degrading to empty arrays/nulls on an
unrecognized shape so a malformed payload never blanks the page (it falls
back to a raw-JSON `<details>` instead).

**Findings:** None of note.

---

---

## Verification

Comment-only edits, checked against the two required gates after all fixes
were made:

- `CI=true npm test > /tmp/hdr-ab.log 2>&1; echo "EXIT=$?"`: **EXIT=0**.
  7724 tests: 7682 pass, 0 fail, 42 skipped, 0 cancelled. Exit code read
  from the command's own `$?`, not from a piped `tail`/`head`, per the
  brief. The suite did not move.
- `bash scripts/lint/forbidden-patterns.sh`: **PASS** (`INVARIANT-4: PASS`,
  exit 0).

## Files touched (all comment-only, header text)

- lib/canonical-v2/verified-pin-sweep.js: none (finding is about wiring,
  header was already accurate).
- lib/edit-schema.js: fixed a wrong parameter name in the header prose.
- lib/ingest/deal-metadata-prompt.js: fixed a stale consumer claim and an
  undercounted value-derivation ladder.
- lib/instrument-negation.js: fixed a pointer to a deleted component.
- lib/parser-v2/classify.js: fixed the "two-pass, ~10 patterns" claim in
  both the top docblock and the DETERMINISTIC_RULES section banner.
- lib/parser-v2/extract.js: fixed the Strategy A/B/C/D type table.
- lib/parser-v2/reapply-corrections.js: fixed a self-contradicting
  arithmetic justification for MIN_MARGIN.
- lib/parser-v2/run-extract.js: fixed a stale "two live entry points"
  claim.
- lib/parser-v2/format-renderer.js: fixed an undercounted export list.
- lib/parser-v2/store.js: rewrote the header to cover its full scope
  (topology, elections, consideration equity, not just core provisions).
- lib/parser-v2/validate.js: rewrote the header to cover its full scope
  (citable auto-wrap, orphan backfill, span-residual report).

No file outside this list was edited. Nothing under `docs/` or `archive/`
was touched. All edits are comment-only; no logic, exports, or behaviour
changed anywhere.

*(PROGRESS: 39/39 modules done. Ranked summary, verification, and file
list complete.)*
