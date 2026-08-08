# Cross-family consistency sweep — absence wording + generalizable mechanisms

Status: IN PROGRESS (writing incrementally; see git log / mtime if this looks stale)
Branch: claude/codex-handoff-plan-status-77wn7n. Not committing per instructions.

## 1. Absence-wording fix (Task 1)

### Re-derived count (do not trust the prior note's "11 across 10 files")

Ground truth via `grep -rn "found\.'" components/review/table-configs/*.config.js`
plus a broader sweep for other absence idioms ("not present in", "none found",
etc.):

- **14 total occurrences** of the `'No X found.'` shape, across **11 files**
  (not 10 — the prior note undercounted by one file).
- **13 distinct wording strings** (two occurrences share identical text:
  `nosol-section.config.js` has the same `'No no-solicitation provisions
  found.'` string twice — once as a sub-row `emptyCopy`, once as the
  chapeau-level `empty.copy`).
- **Plus one additional UNSAFE site the prior sweep did not catch**, because
  it scanned table-level empty-copy only:
  `components/review/table-configs/termination-rights.config.js:289`,
  `keyTermsNode()` — a **per-cell** absence string, `'Not present in this
  agreement'`, rendered whenever a specific termination-right's key-term card
  is `null`. Same UNSAFE class (extractor-found-nothing dressed as
  agreement-fact), different granularity (cell, not table). Re-derivation
  matters: the two are found by different search patterns and a naive
  re-grep of just `found\.` would have missed it.
- The borderline `formatCode(null) -> 'Not applicable'` in
  `components/review-v2/NoShopCrossViewPreview.jsx` — confirmed still present,
  not yet touched (v2 file, out of scope per the note below).

**True total: 14 UNSAFE occurrences (13 distinct table-level strings + 1
distinct per-cell string) across 11 config files, plus 1 borderline.**

### Files (11), in fix order

1. `conditions-m.config.js` (3 occurrences: mutual/buyer/seller)
2. `conditions.config.js` (1)
3. `ioc-exceptions.config.js` (1)
4. `material-contracts.config.js` (1)
5. `nosol-fiduciary.config.js` (1)
6. `nosol-intervening.config.js` (1)
7. `nosol-noshop.config.js` (1)
8. `nosol-section.config.js` (2, identical string)
9. `nosol-superior.config.js` (1)
10. `tail-fee.config.js` (1)
11. `termination-rights.config.js` (1 table-level `emptyCopy` + 1 per-cell `keyTermsNode` string)

### What the termination-fees mechanism actually is

Two independent things, not one:

1. **NOT-YET-EXTRACTED vs ESTABLISHED-ABSENT**: a row that Canonical V2
   simply never produced renders an explicit amber "Not yet extracted" pill
   (`coverageState: 'NOT_YET_EXTRACTED'`, `present: false`, tone `warning`),
   computed by DERIVING the gap from `CANONICAL_COVERAGE_SURFACES` minus the
   row ids canonical actually produced — never hardcoded per deal. Genuinely
   absent terms get the ordinary grey "No" pill instead.
2. **Serving-source provenance row**: a first table row stating which
   extraction produced the table at all (`CANONICAL` / `LEGACY_FALLBACK` /
   `LEGACY_FALLBACK_SOURCE_FAILED` / `BOTH_SOURCES`), because a v1/v2 dual
   extraction system exists for this one family and a reader must not guess
   which one they are looking at.

Both halves depend on termination-fees having a genuine two-source system
(legacy extraction AND a separate Canonical V2 write path with its own
coverage surfaces) to distinguish "haven't looked yet" from "looked, found
nothing."

### Checked: does any of the 11 families have that same two-source signal?

No. Grepped each file for `isCanonicalV2Card`/`canonical_v2`/`servingSource`/
`canonicalCards`/`legacyCards`. Three files reference `canonical_v2_lineage`
(`material-contracts.config.js`, `tail-fee.config.js`,
`termination-rights.config.js`), but only as consumers of
`canonical-v2-preview-lane.js` — the read-only, feature-flagged, "extra dark
row alongside the real table" bridge (asset-sweep item #10), not a primary
serving-source split with its own coverage-surface list. There is no
`CANONICAL_COVERAGE_SURFACES`-equivalent gap list for any of these 11
families, and no second write path whose absence vs non-arrival can be told
apart. Building one would mean inventing a coverage-surface catalogue and a
source-state machine that does not exist for these families today — that is
new pipeline design, not a copy of an existing mechanism, and out of scope
here per instruction #3 (do not fake a signal that is not there).

**Conclusion: for all 11 files, port only the honestly-uncertain WORDING
half of the mechanism (the "we don't know which, so say so" principle),
reusing `CONDITION_ABSENT_COPY` from `lib/canonical-conditions.js`. Do not
add a fabricated provenance row or an amber not-yet-extracted pill to any of
these 11 — none of them has a second source to be provenant about.** This
applies to every file in the list above; no family gets the full two-pill
treatment because none has the underlying two-source data.

`conditions-m.config.js` already imports `CONDITION_ABSENT_COPY` and uses it
correctly for **per-row** absence (line 73, "no matches -> return
CONDITION_ABSENT_COPY"). Only its **table-level** empty copy (used when zero
condition cards exist at all) was still the unsafe string — same constant,
different call site.

### Edits (logged as made)

All 11 files: import `CONDITION_ABSENT_COPY` from `../../../lib/canonical-conditions.js` (or reuse the existing import), then replace the unsafe literal with the constant at each call site. No new string minted anywhere; every site now renders the exact same wording as `lib/canonical-conditions.js`'s own per-row absence case. `node --check` (Node 22, auto ESM-detect) run clean on all 11 after edit.

| File | Site(s) fixed |
|---|---|
| `conditions-m.config.js` | 3 table-level `empty:` params (mutual/buyer/seller) — constant already imported, only the 3 call sites changed |
| `conditions.config.js` | 1 `emptyCopy:` (added import) |
| `ioc-exceptions.config.js` | 1 `emptyCopy:` (added import) |
| `material-contracts.config.js` | 1 `empty: { copy: ... }` (added import) |
| `nosol-fiduciary.config.js` | 1 `empty: { copy: ... }` (added import) |
| `nosol-intervening.config.js` | 1 `empty: { copy: ... }` (added import) |
| `nosol-noshop.config.js` | 1 `empty: { copy: ... }` (added import) |
| `nosol-section.config.js` | 2 sites (`emptyCopy:` sub-row + `empty: { copy: ... }` chapeau), 1 `replace_all` edit (added import) |
| `nosol-superior.config.js` | 1 `empty: { copy: ... }` (added import) |
| `tail-fee.config.js` | 1 `empty: { copy: ... }` (added import) |
| `termination-rights.config.js` | 2 sites: table-level `emptyCopy:` AND the newly-found per-cell `keyTermsNode()` "Not present in this agreement" string (added import; left an inline comment at the per-cell site explaining why it's the same class of fix) |

### Files/sites NOT changed, and why

- No family among the 11 got a fabricated serving-source row or NOT_YET_EXTRACTED
  pill — see "Checked" section above. Doing so would have meant inventing a
  coverage-surface catalogue with no real second data source behind it, i.e.
  exactly the "faking a signal that isn't there" instruction #3 forbids.
- `components/review-v2/NoShopCrossViewPreview.jsx`'s `formatCode(null) ->
  'Not applicable'` (the borderline case) was **left alone**. It sits in
  `components/review-v2/`, explicitly excluded from this task's target list
  (Task 1 scope is the `components/review/table-configs/*.config.js` layer
  the prior sweep identified), and its fix is different in kind: the other two
  functions in the same file (`formatParty`/`formatTrigger`) already use
  "...not captured" correctly, so the right fix is making `formatCode`
  consistent with its siblings in the same file, not a `CONDITION_ABSENT_COPY`
  swap — a same-file consistency fix, not a cross-family port. Flagged here so
  it isn't lost, not fixed, to keep this change scoped to the 11 named files
  plus the one adjacent per-cell finding in the same file as a table-level fix.
- Did not touch `lib/parser-v2/subclauses.js` or `tests/subclauses.test.js`
  per explicit instruction (separate change landing there).
- Did not touch `components/review/table-logic.js` (96KB, unread in full per
  the prior sweep) — grepped it for the same `found\.'` pattern; no hits, so
  nothing to port there.

## 2. Ranked table of other mechanisms to push across families (Task 2)

Excluded as already-known per the brief: termination-fees absence discipline
(Task 1 above), `nosol-section.config.js` GROUP_DEFS limb assembly,
`ClauseSidebar.jsx` fact→limb→clause expansion, `CanonicalReviewSection.jsx`
refusing incomplete certified evidence.

| # | Mechanism | Lives in (source family) | Missing from (targets) | Port difficulty | Re-mints stored identities? |
|---|---|---|---|---|---|
| 1 | **Second-chance corroboration through a legacy vocabulary, with typed provenance** — when the primary regex-based category test matches nothing, retry against V1's broader heading vocabulary; a hit is tagged `corroboration_provenance: 'V1_IOC_CATEGORY_VOCABULARY'` so a reviewer can always tell primary vs fallback resolution. Same "fail closed on ambiguity" discipline applied to the fallback pass, not relaxed. | `lib/canonical-v2/native-producer/ioc-corroboration.js` (`corroborateRestrictionCategory`, lines 93-174) | `general-covenant-corroboration.js`, `guaranty-corroboration.js`, `tax-cooperation-corroboration.js` — each is a single-shot pattern test with no retry; a primary-pattern miss goes straight to `REVIEW`/`OPEN_WORLD`, permanently, even when a broader legacy vocabulary would have resolved it unambiguously (the exact "IOC used to fail everything until Stage 4" bug, still live in the other three) | Guaranty/tax-cooperation: MEDIUM — small code sets, a hand-built fallback list is feasible. General-covenants: HARDER — IOC's fallback works because `lib/vocab/ioc-categories.js` already existed as a ready-made V1 vocabulary artifact to reuse; **no equivalent exists in `lib/vocab/` for general-covenants, guaranty, or tax-cooperation**, so this is new vocabulary curation, not a straight port | **Partial.** Candidates that flip from `REVIEW`/`OPEN_WORLD` to `RESOLVED` mint brand-new claim identities where none existed before (additive — new resolved claims appear). Already-`RESOLVED` candidates are untouched (IOC's own design note: enriching the primary-hit path "would re-mint every already-resolved IOC claim... for zero information gain," so it deliberately doesn't touch that path) — the same discipline should be copied, not just the fallback logic. |
| 2 | **Cross-code ambiguity guard at corroboration time** — check a quote against every code's pattern (not just the one asserted), and refuse (`REVIEW`) if more than one matches, instead of trusting that the patterns are disjoint by construction. | `guaranty-corroboration.js` (`AMBIGUOUS_GUARANTY_OBJECT`) and `ioc-corroboration.js` (`AMBIGUOUS_CATEGORY_CORROBORATION`, checked against the full category set both on the primary AND fallback pass) | `general-covenant-corroboration.js` and `tax-cooperation-corroboration.js` — both explicitly rely on "patterns are written to avoid cross-code collision" as a **design-time claim in a comment**, never checked at **run time** against the quote. This is the exact "read the code, not the comment" trap the header of this task warns about, one level down: the comment asserts safety the code doesn't verify. | LOW-MEDIUM mechanically (run all codes' patterns, count hits) but needs re-running against the current corpus before shipping — turning a silent assumption into an enforced check can flip some currently-RESOLVED candidates to REVIEW if the "disjoint by construction" claim turns out false anywhere in the live corpus | **Yes, this is the one with real stakes.** Any candidate whose outcome flips from `RESOLVED` to `REVIEW` **removes/regresses an already-materialized claim identity** — the opposite direction from #1. Must be validated deal-by-deal (diff old vs new resolution set) before landing, not shipped as a pure additive change. |
| 3 | **Explicit `derived`-style provenance flag on a display-computed value**, so a reviewer can tell "this cell came from a structured extraction field" from "this cell was computed at render/resolve time from raw text." | `lib/employee-benefits.js` (`bundled: true` — a row synthesized from keyword-matching another element's own text, never a direct extraction) | `components/review-v2/configDecorations.js` — `deriveElectionSummary`/`deriveProrationCaps`/`deriveFixedMixedSplit`/`deriveClosingTimingRows` compute consideration-mechanics and closing-timing facts client-side at render time (regex-mined proration caps, fixed-mixed cash/stock split reconstruction) with **no flag distinguishing them from directly-extracted card fields** — same class of gap the prior asset-sweep already named for the lookback-period derivation in the same file (item #5 there), extended here to the two proration/split helpers that sweep didn't name individually | LOW — additive UI marker (a small badge/tooltip), same shape as `bundled`; no pipeline change | No — display-only, computed from already-stored card data at render time, nothing written back |
| 4 | **Deal-specific extraction sidecar wired into a general resolver, gated fail-closed** — worth generalizing the *pattern*, not the content: a parser built for one deal's idiosyncratic drafting, invoked from the shared resolver behind a try/catch that no-ops to empty on any other deal ("Most agreements will not carry the exact ... definitions... A partial match emits nothing.") | `lib/canonical-v2/native-producer/modiv-termination-fee-source-parser.js` + `modiv-termination-fee-payment-timing-parser.js`, invoked from `candidate-resolution.js:11048-11059` | N/A — this one is not missing anywhere, it's the reference example. Flagged here because it is the **one live instance today** of the exact failure shape the brief's examples (`findTerminationLimbGrantContext`, V1 topology detector) eventually became: a deal-specific grammar (four regexes matching Modiv's literal contract sentences, including exact section numbers 7.3(b)(i)-(v)) sitting inside code every deal's extraction run passes through. Today it is SAFE (fail-closed to empty, not silently wrong) — but it is the shape to watch: if a second deal arrives with a similar-but-not-byte-identical REIT-style conditional fee formula, this parser will silently emit nothing for it too, same as it does for every non-Modiv deal today, and nobody will notice unless someone checks | N/A (not a port — a watch item) | N/A |

Checked and ruled out (evidence, not just absence of a hit):
- **Quote/evidence byte-verification consistency** — `citation_validation` is
  computed once, centrally, in `native-extraction-run.js` /
  `citation-constructibility.js`, and threaded through every family's
  candidates uniformly (confirmed by grep: every family-specific file that
  reads `citation_validation` only ever reads it, never computes its own
  version). No inconsistency found here — flagging as checked so this isn't
  re-investigated from scratch next time.

## 3. Hardcoded deal references in library code

### Method and the count that matters

`grep -rliE "qxo|topbuild|modiv|skywater|metsera|concho|redhat|skechers" lib/
--include="*.js"` hits **200 files**. That raw count is close to meaningless
on its own — re-deriving what it actually contains:

- **79 of the 200** are files whose own FILENAME contains the deal word
  (`qxo-capitalisation-f28-*.js`, `metsera-exclusivity-*.js`,
  `topbuild-legal-text-delta.js`, `modiv-termination-fee-*.js`,
  `reviewed-*-slice.js` with `DEAL_KEY = 'deal:landos-abbvie'`, etc.) — these
  are **self-declared single-deal pilot/feature slices**, mostly under
  `lib/canonical-v2/`, numbered by feature (F6 through F28+). They are not
  hidden — the filename says exactly what they are — so they are not "latent"
  over-fits in the sense the brief means (a general-purpose module secretly
  keyed to one deal). They are still worth naming as a standing risk class:
  the volume of these (79 files) is itself evidence of how often this
  programme reaches for a one-deal pilot slice, which is exactly the
  substrate the brief's failure mode grows out of if one of them is ever
  quietly promoted to "the general path" without anyone checking. Not
  enumerated file-by-file here (self-evident from the name); available via
  the grep command above.
- **121 of the 200** are generically-named files that merely *mention* a deal
  word. Sampled and categorized all of `lib/`'s non-`canonical-v2/native-
  producer` generic core (`taxonomy.js`, `verification.js`,
  `agreement-revision-classifier.js`, `sec-meeting.js`, `parse-money.js`,
  `negation-boundary-guard.js`, `termf.js`, `sidebar-groups.js`, `abry.js`,
  `rubric.js`, `unelide-quote.js`, `query/*`, `queries/*`,
  `ingest/deal-metadata-prompt.js`) plus `lib/parser-v2/{structural,extract,
  elections,classify}.js` by hand:
  - The overwhelming majority are **comment-only calibration citations**
    ("Metsera 8.01(b) bundles TWO distinct termination triggers", "Skechers
    §3.28(a)") — these name the real clause a regex was built and tested
    against, which is documented practice in this codebase, not hidden
    over-fitting. Grepping for the deal word without checking whether the hit
    is a `//` comment would over-count wildly; this is exactly the "distinguish
    a real dependency from a mention" trap named at the top of this task.
  - The remainder inside `lib/canonical-v2/` (the ~19 files identified via a
    second, narrower grep for the word used inside an actual comparison —
    `===`, `.includes(`, `!==`) are **content-addressed schema/domain-tag
    constants** for the same F6-F28 pilot feature releases (e.g.
    `QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER`,
    `TOPBUILD_SECOND_OCCURRENCE_ID`) used by identity/audit validators
    checking internal consistency of that pilot's OWN data — not general
    matching logic that runs against every deal's text and could silently
    misfire on a different one. `TOPBUILD_SECOND_OCCURRENCE_ID` specifically
    guards a known one-off SEC-filing quirk (TopBuild's agreement was filed
    twice) — a regression guard for a fixed historical bug, not a live
    grammar.
  - `lib/programme-decision-console.js` and
    `lib/programme-gates/governing-registry.js` reference deal names inside
    **decision-record prose** (`evidence`/`why`/`recommendation` text
    fields) — these are meant to record deal-specific rulings and gate
    provenance, not general logic; expected by design.
  - `lib/four-deal-local-demo-preview.js` branches explicitly on
    `target === 'topbuild' / 'skechers'` — but it is a **named demo/preview
    fixture switcher** (own filename says so), not part of the live
    extraction or review path.

### The one real, live instance of the dangerous pattern

`lib/canonical-v2/native-producer/modiv-termination-fee-source-parser.js`
(+ its `modiv-termination-fee-payment-timing-parser.js` sibling): four regexes
matching Modiv's literal contract sentences (exact section numbers
`7.3(b)(i)`-`(v)`, exact defined-term phrasing) invoked from
`candidate-resolution.js`, a file every deal's extraction run passes through.
This is architecturally identical to the already-fixed
`findTerminationLimbGrantContext` (Modiv grammar, generalized after failing
4 newer deals) and the V1 topology detector the brief cites — **except this
one is already gated fail-closed**: wrapped in try/catch, and the calling
comment says outright "Most agreements will not carry the exact Modiv
definitions. They remain on the ordinary resolver path. A partial match emits
nothing." Checked and confirmed safe today. Flagged as item 4 in the Task 2
table above as the pattern to watch, not a bug to fix now — the two historical
examples the brief cites (`findTerminationLimbGrantContext`, `parse-money.js`'s
six-functions-disagreeing bug, both now fixed per `docs/core/COMPLETED.md`
and this module's own header) show this project has shipped the unsafe
(silent) version of exactly this shape before; this file shows it has also
learned to ship the safe (fail-closed) version. Both lessons are worth
recording.

### Count, for the report

**200 files total mention a deal name in `lib/`; 79 are self-declared
pilot-slice modules (safe by naming, standing risk by volume); of the
remaining 121, the large majority are comment-only calibration citations
(not hardcoding) or content-addressed pilot-schema tags (not general
matching logic); exactly ONE live instance of "deal-specific grammar wired
into a path every deal runs through" was found, and it is already gated
fail-closed.** Zero un-gated, silently-misfiring instances found in the
current generic (non-pilot-slice) core of `lib/` — both historical examples
of that failure mode cited in the brief are already fixed and documented in
`docs/core/COMPLETED.md`.
