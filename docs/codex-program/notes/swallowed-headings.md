# Swallowed headings: investigation, fix, and impact

Owner of this note: the agent assigned to
`lib/canonical-v2/native-producer/deterministic-sectionizer.js`. Scope: the
78-character title cap that silently drops whole sections from real merger
agreements, and the tripwire built so this class of failure can never be
silent again. Everything below is either **measured** (a number or a diff I
produced and can reproduce) or **judged** (a call I made and why). They are
kept separate on purpose.

## 0. Verification command

```
CI=true npm test > /tmp/sect.log 2>&1; echo "EXIT=$?"
```

Final state: `EXIT=1`, `fail 5`. All 5 failures are pre-existing fixtures
that hardcoded the *old, buggy* tree shape as their expected value, see
section 5. Nothing in `tests/canonical-v2-native-sectionizer.test.js` (30
tests, the file I own) fails. Full accounting in section 6.

---

## 1. MEASURED, true extent, before any fix

### 1.1 Probe methodology

Built a standalone probe (not committed; lived in `/tmp` for this
investigation) that runs the *real* pipeline for every committed full
agreement, `buildSecEdgarIntakeCapture` → `convertSecHtmlToCanonicalText` →
`buildImmutableSource` → `sectionizeAdmittedSource({ source_text,
document_hash })`, matching `tests/canonical-v2-native-sectionizer.test.js`'s
own `sectionizeRealFiling` helper, not a shortcut.

Corpus: Modiv, TopBuild, Skechers (all real SEC EDGAR HTML), Landos (already
plain text, no HTML conversion), and the foundation fixture
(`tests/fixtures/canonical-v2/foundation-source.txt`, deal key
`qxo-foundation`, confirmed by grep against
`tests/canonical-v2-p1-vertical-slice.test.js`, a 12-line isolated Section
5.2 excerpt with no ARTICLE/TOC structure at all, not a full agreement; its
own content is already exhaustively covered by
`tests/canonical-v2-native-sectionizer.test.js`'s existing `QXO_5_2_TEXT`
tests, byte-identical modulo a trailing newline).

**Oracle, and why it's trustworthy.** Used each document's own "TABLE OF
CONTENTS" block as the independent oracle, per the brief. Concretely: find
`TABLE OF CONTENTS` (first occurrence), find the exact token `ARTICLE I`
(word-bounded, so `ARTICLE II`/`ARTICLE III` never match), every document in
this corpus has *exactly two* occurrences, the ToC's own listing and the real
body heading, confirmed by direct inspection before trusting it. The ToC
region is `[tocStart, secondArticleIIndex)`. Inside that region, a flat scan
for `\b(\d{1,2})\.(\d{1,3})\b` collects every section number the document's
own ToC lists.

**Noise found and removed, so the number can be trusted:** exactly one false
positive in the whole corpus, TopBuild's ToC region contains "par value
$0.01 per share" inside surrounding prose, which matches the bare-decimal
shape. Added a `(?<!\$)` / not-followed-by-`%` guard (checked, not assumed:
swept all 4 ToC regions for any other `$`- or `%`-adjacent decimal and found
none). Also found and excluded: `parseStructure`'s own `ARTICLE`-kind nodes
for back-matter (`ANNEX C` in TopBuild, `EXHIBIT A`, `H`? no, just `EXHIBIT
A` in Landos) are tagged `kind: 'ARTICLE'` with a letter "number", which a
naive reference-only diff flags as a spurious article; checked each one's own
source bytes directly and confirmed they are legitimate back-matter nodes
literally headed `ANNEX C` / `EXHIBIT A`, not `ARTICLE C`/`ARTICLE A`, a
probe limitation, not a sectionizer defect. Excluded from the diff by
checking which keyword (`ARTICLE` vs `ANNEX`/`EXHIBIT`) appears first in the
node's own leading bytes.

Sanity check on the probe itself, per the brief's warning that a probe is
easy to get wrong: totals before trusting them, 
| Deal | Tree decimal sections (before fix) | ToC-claimed sections | Missing | Spurious |
|---|---:|---:|---|---|
| Modiv | 99 | 99 | none | none |
| TopBuild | 58 | 63 | **1.8, 3.1, 3.2, 4.5, 5.2** | none |
| Skechers | 112 | 112 | none | none |
| Landos | 89 | 89 | none | none |

Modiv/Skechers/Landos matching their own ToC counts exactly, with zero
spurious articles once the annex/exhibit false positive above is accounted
for, is what gives confidence the oracle itself is sound (it isn't just
finding zero everywhere by being broken), it correctly finds a real, precise
5-section gap on TopBuild and a real zero-gap everywhere else.

### 1.2 Mechanism, verified rather than assumed

`INLINE_DECIMAL_HEADING_RE` (deterministic-sectionizer.js) required a title
of `{1,78}?` characters before its terminal period. TopBuild's real body
headings for the five missing sections, measured directly from the real
document text (not the ToC, which sometimes shortens titles):

| Reference | Title length | Title |
|---|---:|---|
| 1.8 | 90 | "Officers and Directors of the Titanium Surviving Corporation and Forward Surviving Company" |
| 3.1 | 47 | "Representations and Warranties of the Company" (fits, see below for why it was lost anyway) |
| 3.2 | 84 | "Representations and Warranties of Parent, Titanium Merger Sub and Forward Merger Sub" |
| 4.5 | 105 | "Company Stockholder Meeting and Parent Stockholder Meeting; Form S-4 and Joint Proxy Statement/Prospectus" |
| 5.2 | 94 | "Additional Conditions to the Obligations of Parent, Titanium Merger Sub and Forward Merger Sub" |

Two distinct failure shapes, both confirmed against real output, not
inferred:

- **Collateral loss (Article III):** 3.2's title (84 chars) never matched the
  regex, so it never became a raw candidate at all, not even a recorded
  rejection (see 1.3). That left exactly one candidate for the whole article,
  3.1 (whose own 47-char title fits fine), and
  `applySequenceGate`'s `accepted.length < 2` rule rejects a lone candidate
  as `LONE_CANDIDATE`, the *only* one of the five that is recorded anywhere:
  `rejected_inline_heading_candidates: [{ article: 'III', reference: '3.1',
  reason: 'LONE_CANDIDATE' }]`. With zero accepted candidates,
  `reconcileStaleArticleChildren` never runs, and `parseStructure`'s own
  `III-INTRO` chapeau node, minted for "no interior section boundary found"
, is left owning the entire article: **bytes 47712, 179129, 131417 bytes**,
  with a deep tree of phantom lettered/roman subsection children
  misattributed to `III-INTRO` instead of `3.1`/`3.2` (144 phantom
  descendant nodes, confirmed by full tree diff in section 3).
- **Single-section absorption (Articles I, IV, V):** each of these articles
  has enough *other* valid-length candidates that the sequence gate still
  passes, so the pass still runs, it just silently extends the preceding
  accepted candidate's span past the missing one, all the way to the next
  accepted candidate's start. 1.7 (ends where 1.8 should start) absorbed all
  of 1.8; 4.4 absorbed all of 4.5; 5.1 absorbed all of 5.2.

### 1.3 The silent part, precisely

Checked directly (see `/tmp` instrumentation, reproducible by adding a debug
export temporarily): a title that never matches
`INLINE_DECIMAL_HEADING_RE` at all produces **no trace whatsoever**, it
never enters `rawCandidates`, so `applySequenceGate` never sees it, so
nothing is pushed to either `accepted` or `rejected`. Only 3.1, whose *own*
title happened to fit, generated a rejection record (as collateral damage of
3.2's absence). 3.2, 4.5, 5.2, and 1.8, the sections whose own titles were
actually too long, left zero record anywhere pre-fix. This is a stronger,
more precise version of "the tests missed it" than the sibling-tiling
blindness alone: even the *rejection log*, which exists specifically so
gate-driven exclusions aren't silent, cannot see a candidate that never
formed in the first place. This is exactly the gap section 4's tripwire
closes.

---

## 2. JUDGED, the fix

**Recommendation evaluated, not applied blindly:** raise the cap, based on
measuring what actually bounds `INLINE_DECIMAL_HEADING_RE`'s false-positive
risk.

The `{1,78}?` quantifier is *lazy* (`?` after the count) and the character
class `[A-Za-z0-9 ,;:'&()/-]` excludes `.`, `!`, and `?` entirely, so the
match already stops at the very *first* period-then-whitespace/end it finds,
regardless of the cap's numeric value. A longer cap cannot make this regex
run on into unrelated body prose; the real false-positive gates are the
line-start anchor (cross-reference prose is never drafted to open a line on
a bare "N.M"), the required uppercase start, and the terminal-period shape, none of which are the character-count cap. The cap is a defensive bound on
regex-engine work per attempt, not a false-positive gate. (Also confirmed,
separately: the same-shaped multi-sentence guard, `if (/[.!?]\s+[A-Z]/.test(title)) ...`, that appears both here and in
`captureMarkerHeading` is unreachable dead code for both regexes, since the
character class already excludes `.`/`!`/`?` from ever appearing inside the
captured group. Not fixed, out of scope, noted for whoever next reads this
regex and wonders what it's for.)

**Measured, not assumed, that raising it is safe:** the true corpus maximum
(scanned every document at cap=500, unfiltered by article ownership) is 105
characters, TopBuild's real 4.5. Raising the cap to 200, comfortable
headroom above the observed maximum, while still a bounded, defensive limit
rather than fully unbounded, was verified to add **zero** new candidates
anywhere in Modiv, Skechers, or Landos (candidate sets byte-identical at cap
78 vs cap 500, i.e. moot for those three regardless of where in that range
the line is drawn), and in TopBuild adds exactly the four titles the old cap
silently dropped (1.8, 3.2, 4.5, 5.2, 3.1 then recovers too, once 3.2
rejoins it and the sequence gate has two members again). Applied: **78 →
200** in `INLINE_DECIMAL_HEADING_RE`.

**The second cap (line ~307, `captureMarkerHeading`), evaluated separately, found NOT to be part of this failure class, and left alone.** This cap
governs only whether a `SUBSECTION` node's `heading` *label* gets populated;
the node itself is created by `buildMarkerTree` unconditionally, independent
of whether a heading string is captured. Raising or removing it cannot
recover a lost *section*, there is no section-loss here to fix. Its own
risk profile also differs: a longer cap there would start mistaking a
subsection's genuine *first substantive sentence* for a short title label
(a real, different false-positive risk this note didn't measure, because the
acceptance criteria for this fix are entirely about section existence, not
heading-label completeness). Left untouched; flagging as a separate,
smaller, lower-priority follow-up if heading-label completeness on long
marker titles ever matters enough to spend a corpus measurement on it.

---

## 3. MEASURED, fix verification, full tree diff per deal

Built a before/after diff using `git show HEAD:...` for the pre-fix module
content (never touched the working tree to get this, rewrote its three
`require(...)` calls to absolute paths pointing at the real, unmodified
`canonical-bytes.js`/`structural.js`/`text-layers.js`, so both versions ran
side by side from `/tmp` with zero risk to files other agents might be
reading concurrently). Diffed on `(kind, reference, start, end)`, not
`section_id`, which is expected to change whenever `reference`/parent does.

| Deal | Nodes before | Nodes after | Added | Removed |
|---|---:|---:|---:|---:|
| Modiv | 472 | 472 | 0 | 0 |
| TopBuild | 403 | 408 | 170 | 165 |
| Skechers | 539 | 539 | 0 | 0 |
| Landos | 400 | 400 | 0 | 0 |
| foundation | 7 | 7 | 0 | 0 |

Modiv, Skechers, Landos, foundation: **byte-identical trees**, confirmed at
the full node level (every kind, every depth), not just top-level decimal
sections. The fix is a verified no-op everywhere it isn't needed.

TopBuild's 170 added / 165 removed, fully categorized by top-level parent, **zero unexplained entries in either direction**:

| Bucket | Removed | Added |
|---|---:|---:|
| `III-INTRO*` (the phantom subtree / its correctly-clipped replacement) | 145 | 1 |
| `1.7*` (boundary correction) | 3 | 1 |
| `1.8*` (recovered, brand new) | 0 | 3 |
| `3.1*` (recovered, brand new) | 0 | 93 |
| `3.2*` (recovered, brand new) | 0 | 53 |
| `4.4*` (boundary correction) | 10 | 2 |
| `4.5*` (recovered, brand new) | 0 | 9 |
| `5.1*` (boundary correction) | 7 | 2 |
| `5.2*` (recovered, brand new) | 0 | 6 |

Every removed node is either a phantom `III-INTRO(...)` descendant (never
real) or a stale, over-wide boundary on 1.7/4.4/5.1 whose corrected,
narrower replacement appears in `added` at the same reference. `III-INTRO`
itself: was `[47712, 179129)`, 131417 bytes, matching the brief's "roughly
131 KB", now `[47712, 47755)`, 43 bytes, the real chapeau text ahead of
"3.1". No node disappears without either being phantom or being replaced by
a corrected version of itself.

---

## 4. BUILT, the swallowed-heading tripwire

New field on the tree: `swallowed_heading_residuals` (parallel to the
existing `rejected_inline_heading_candidates`). For every real, textually
observed `ARTICLE` span, scans that article's own text for **any** bare
line-start `N.M` whose `N` matches the article's own number, deliberately
looser than `INLINE_DECIMAL_HEADING_RE` itself (no title-shape requirement
at all), because the point is to catch headings that fail shape checks for
reasons this fix didn't anticipate, not just the one already found and
fixed. A hit is reported only when it's neither a node anywhere in the final
tree nor already present in `rejected_inline_heading_candidates` (an
already-recorded rejection is, by design, not silent, so it is deliberately
not re-reported).

**Noise-tested before committing to the loose pattern, not assumed safe:**
ran this exact loosest-possible regex against all four real filings'
`ARTICLE` spans (post-fix). Zero false positives anywhere. On the pre-fix
tree it correctly recovers exactly the four *invisible* TopBuild casualties
(1.8, 3.2, 4.5, 5.2), and correctly does **not** also flag 3.1, since 3.1's
`LONE_CANDIDATE` rejection is already recorded and visible. This 4-vs-1
split (4 residuals + 1 pre-existing rejection = the 5 known losses,
non-overlapping) is itself a clean proof that the tripwire's "already
recorded" carve-out does exactly what it's supposed to.

**Tests added** (`tests/canonical-v2-native-sectionizer.test.js`, all
passing):

- Corpus-wide: `swallowed_heading_residuals` must be `[]` on Modiv, TopBuild,
  Skechers (extends the existing `REAL_FILINGS` loop) and Landos (new,
  separate test, Landos isn't SEC-HTML so isn't part of that loop).
- A full TopBuild regression test pinning all five recovered sections by
  reference, heading text, and exact byte-anchoring, plus the three
  corrected sibling boundaries and the clipped `III-INTRO`, plus an explicit
  assertion that `III-INTRO(a)`/`III-INTRO(b)` (the phantom reference an
  already-committed fixture cited, see section 5) no longer resolve at all.
- **The specific test the brief asked for:** a synthetic ARTICLE IV with a
  271-character title (exceeds even the new 200 cap) on "4.2", between two
  ordinary-length siblings "4.1"/"4.3". Proves "4.2" doesn't resolve, proves
  "4.1" silently runs all the way to "4.3" without the tripwire, and proves
  `swallowed_heading_residuals` reports exactly one entry:
  `{ article: 'IV', reference: '4.2', reason: 'UNACCOUNTED_LINE_START_DECIMAL' }`,
  with a byte offset landing exactly on "4.2"'s real position.
- A no-double-report test (a genuine `LONE_CANDIDATE` case must not also
  appear as a residual).
- A per-article-scoping test (a bare line-start decimal belonging to a
  *different* article's numbering, inside the current article's body, must
  not fire).
- Two straightforward "stays silent when healthy" tests (a normal document,
  and the empty-source-text path).

**A construction pitfall worth recording**, since it cost real iteration and
would bite anyone else writing a fixture against this module: a synthetic
fixture with blank lines between sections routes through
`parseStructure`'s own, *separately uncapped*, blank-line-anchored heading
detector instead of this module's inline pass, the QXO Section 5.2 test
already in this file passes for exactly this reason (its 94-character title
never touches this module's cap at all). Less obviously,
`structural.js`'s `parseSections()` has its *own* bare `"N.M Title"`
fallback, but only tries it when the whole document has fewer than 5
`"Section X.XX"`-formatted matches anywhere, real filings' own prose
cross-reference density keeps that fallback permanently off, but a short
hand-written fixture with zero cross-references trivially triggers it,
silently testing the wrong code path. Fixtures in the new tests pad in five
`"Section X.XX"` cross-reference mentions specifically to suppress this and
force the fixture through this module's own pass, confirmed by direct
instrumentation of `parseStructure` before and after adding the padding, not
assumed.

---

## 5. MEASURED, impact on already-committed fixtures

Per instruction: **nothing below was edited.** This is a report for the
owner to act on, not a fix.

### 5.1 `tests/fixtures/canonical-v2/f28-third-live-run/resolution.json`

Every single entry in this file, **40 of 40**, cites
`section_reference: "III-INTRO(b)"`: all 3 of `resolved`, all 4 of
`review_queue`, all 33 of `open_world`. This isn't 40 unrelated claims; the
whole file is the CAPITALISATION family's resolution run for one work item
(`topbuild-capitalisation-3-1-b`, one provision instance, the capital
structure text at bytes 57763, 62446), so every claim/candidate derived from
that one instance carries the same stale label. The 3 `resolved` entries
(the ones the brief specifically flagged, `concept_key: 'REP-T-CAP'`,
`resolved_claim_definition_key: 'REPRESENTATION_MEASUREMENT_DATE'`) are the
highest-severity ones, resolved is this pipeline's "published" state.

**What did *not* break:** the underlying byte span (57763, 62446) and its
`text_sha256` are identical before and after the fix, confirmed directly.
The exact same bytes now resolve under the reference `3.1(b)` instead of the
phantom `III-INTRO(b)`. Notably, the claim's own *extracted attribute*
already says the right thing, `claim.attributes.section_reference: "3.1(b)"` is baked into
`resolved[0].claim.attributes` today, independent of the sectionizer's own
top-level label, so the underlying extraction was never corrupted, only the
sectionizer-derived citation attached to it was wrong. No evidence was lost;
a citation pointed at a name that doesn't exist in the agreement.

### 5.2 `tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json`

One work item, `topbuild-capitalisation-3-1-b`, pins
`section_pin.section_reference: "III-INTRO(b)"` (plus a `section_id` and
`section_text_sha256` that are keyed off it). Checked all 5 TopBuild work
items in this manifest against the post-fix tree: this is the **only** one
affected, 
| work_item_id | pinned reference | resolves post-fix? | pin still exact-matches? |
|---|---|---|---|
| topbuild-capitalisation-3-1-b | III-INTRO(b) | no |, |
| topbuild-ioc-company-4-1 | 4.1 | yes | yes |
| topbuild-no-shop-company-4-3 | 4.3 | yes | yes |
| topbuild-remedies-specific-performance-7-6 | 7.6 | yes | yes |
| topbuild-termination-company-6-3 | 6.3 | yes | yes |

`tests/fixtures/canonical-v2/m3-12-call-pilot-controls.json` also mentions
`topbuild-capitalisation-3-1-b` but only as a work-item-id key for a
processing profile (`TERRA_MEDIUM`), no embedded section reference, not
itself broken.

### 5.3 The 5 failing tests in the full suite, all traced to the above

`CI=true npm test`, `fail 5`, all pre-existing, all TopBuild:

1. `tests/canonical-v2-m3-12-call-pilot-manifest.test.js:27`, "M3 12-call
   pilot manifest validates locally with exact source and section pins"
2. `tests/canonical-v2-m3-12-call-pilot-manifest.test.js:59`, "M3 12-call
   pilot admits recorded TopBuild context with explicit identity and section
   pins"
3. `tests/canonical-v2-m3-12-call-pilot-manifest.test.js:123`, "M3 TopBuild
   capitalisation pin is the exact Capital Structure subsection, not Article
   III", this test's own name shows its author already suspected something
   about this citation was worth pinning down; it hardcodes the
   `III-INTRO(b)` byte span/hash inline and asserts on it directly.
4. `tests/canonical-v2-m3-final-pilot-synthesis.test.js:21`, "the pilot
   fixture retains a byte-pinned diagnostic cohort without executable
   authority"

Tests 1, 2, 4 fail identically: `unified-runner-validate.js`'s
`verifyNodePin` calls `findSectionByReference(tree, 'III-INTRO(b)')`, gets
`null` post-fix, and throws `SECTION_PIN_MISMATCH` (`node.section_id`/
`node.kind`/`node.text_sha256` are checked against the pin, but the `!node`
guard fires first since the reference no longer resolves at all, not a
partial mismatch, a total non-resolution). Test 3 fails on its own
`assert.ok(capital)` for the same reason. All four are one root cause: the
one stale pin in section 5.2.

5. `tests/canonical-v2-prompt-budget-split-preflight.test.js:58`, "TopBuild
   III-INTRO splits MAE work at existing child boundaries", a **different**
   mechanism: this test resolves `III-INTRO` (not `III-INTRO(b)`) and asserts
   `buildPromptBudgetSplitPreflight` returns `status: 'SPLIT'` against a
   64KB ceiling, because the old, 131KB `III-INTRO` genuinely needed
   splitting. Post-fix, `III-INTRO` is 43 bytes and trivially fits, so the
   preflight correctly returns `WITHIN_POLICY` instead, the test's premise
   (that this node is large) is gone, not broken logic. **Worth noting**:
   the test immediately below it in the same file,
   "Skechers 1.1 resolves the real Certain Definitions section and covers
   MAE_DEFINITION directly" (lines 76+), is the already-fixed sibling of
   this exact situation for Skechers's own INTRO-swallowing defect (fixed in
   an earlier commit, per its own regression comment), it shows the shape a
   TopBuild-side fix would likely take, but I did not apply it; not my file,
   not my call.

No committed fixture other than the two named above (`resolution.json`,
`m3-12-call-pilot-manifest.json`) and the 5 tests that assert against them
was found to break. Swept `evidence/canonical-v2/m3-pilot-20260804-fresh/`
(also contains `III-INTRO` references, in `execution-result.json` and one
checkpoint file), confirmed these are archival run snapshots, not read by
any test in the suite (grepped for the directory name across
`tests/`/`lib/`/`scripts/`; the only hits are two unrelated Modiv
termination-fee tests that don't touch the TopBuild content), so they don't
block anything, but the same stale reference is preserved in them for
whoever eventually looks.

---

## 6. Final verification

`tests/canonical-v2-native-sectionizer.test.js` (mine): **30/30 pass**
(23 pre-existing + 7 new: landos residual check, the 5-section TopBuild
regression pin, and 5 tripwire-specific tests).

Full suite: `CI=true npm test` → `EXIT=1`, `fail 5`, all 5 accounted for
above, all pre-existing fixtures encoding the old buggy tree shape, all
outside this file's ownership. Nothing else regressed; the other 3 files
this task named as off-limits (`candidate-resolution.js`, and the two design
notes) were not touched, and no fixture was edited to make anything pass.

## 7. Files changed

- `lib/canonical-v2/native-producer/deterministic-sectionizer.js`, cap
  78→200 on `INLINE_DECIMAL_HEADING_RE`; added
  `detectSwallowedHeadingResiduals` + `SWALLOWED_HEADING_TRIPWIRE_RE`; added
  `swallowed_heading_residuals` to the returned tree (both the empty-input
  and main return paths).
- `tests/canonical-v2-native-sectionizer.test.js`, 7 new tests (listed in
  section 4/6 above).
- `docs/codex-program/notes/swallowed-headings.md`, this file.
