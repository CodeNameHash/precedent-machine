# Nested lettering collision: investigation, fix, and impact

Owner of this note: the agent assigned to
`lib/canonical-v2/native-producer/deterministic-sectionizer.js`. Scope: the
defect tracked as SEC2 in `docs/codex-program/P1-PLAN.md`, where
`findSectionByReference(tree, '8.12(gg)')` and `'8.12(vv)'` return null on
the Modiv agreement even though both subsections genuinely exist and are
cited by the agreement's own text. Everything below is either **measured**
(a number or a diff produced and reproducible) or **judged** (a call made,
with the reasoning for it). They are kept separate on purpose, matching the
convention `docs/codex-program/notes/swallowed-headings.md` established for
this same file earlier the same session.

## 0. Verification command

```
CI=true npm test > /tmp/sec2.log 2>&1; echo "EXIT=$?"
```

Final state: `EXIT=1`, `tests 7560`, `pass 7516`, `fail 2`, `skipped 42`
(pre-existing, identical count before and after this fix, unrelated to it).
Both failures are
pre-existing tests in files this task does not own, both fail because they
pinned the old, buggy tree shape as their expected value. Full accounting in
section 9. Nothing in `tests/canonical-v2-native-sectionizer.test.js` (35
tests, the file this task owns: the pre-existing 30 plus 5 added this
session) fails.

---

## 1. MEASURED: the mechanism, verified directly rather than trusted

### 1.1 What the existing documents claim, and what direct inspection shows

Three places in this repository describe the mechanism the same way:
`docs/codex-program/P1-PLAN.md` (SEC2), `docs/codex-program/notes/
citation-scope-design.md` (Part 2), and the header comment of
`scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs`. All
three say, in substance: Section 8.12 defines "Intellectual Property" at
printed label "(z)", whose own internal sub-clauses happen to be lettered
(a) through (f), and the outer list's next item, "(aa)", gets matched as a
continuation of that inner (a)-(f) run instead of as "(z)"'s own sibling.

Checked directly, not assumed. Ran the real pipeline
(`buildSecEdgarIntakeCapture` then `convertSecHtmlToCanonicalText` then
`sectionizeAdmittedSource`) against the committed Modiv fixture and sliced
the clean text of node "8.12(z)" from its own start to where "(aa)" begins,
byte range [382575, 383931), 1356 bytes:

```
(z) "Intellectual Property" means all intellectual property rights in any
jurisdiction throughout the world, whether registered or unregistered,
including (a) patents, provisional patent applications, ... (b) trademarks,
service marks, ... (c) copyrightable works, ... (d) trade secrets and
confidential ideas, ... (e) rights in software, ... and (f) all rights in
the foregoing and in other similar intangible assets.
```

Ran the exact same line-start marker pattern the sectionizer itself uses
(`MARKER_PATTERN`, requires `(?:^|\n)[ \t]*\(...\)`) against this slice.
**Zero matches other than "(z)"'s own opening marker.** The (a) through (f)
sub-references are real, but every one of them sits mid-sentence, on the
same line as surrounding prose ("...including (a) patents..."), never at the
start of a line. This is exactly the shape `MARKER_PATTERN`'s own header
comment says a genuine cross-reference always takes ("mid-sentence
cross-references... never appear at a line start"), and the sectionizer
correctly does not treat them as markers. **There is no inner, tree-visible
list inside Modiv's own "(z)" at all.**

**Correction, evidence-based, to the mechanism as described in the three
documents above (none of which this task edits, per its own scope):** for
Modiv specifically, the outer list's collision is not caused by an inner
list absorbing "(aa)" as a child. It is caused by something simpler and more
general, found by reading `buildMarkerTree`/`expectedNext` directly (see
1.2). The "inner list interacts with the collision" framing is real
elsewhere in the corpus, just not what happens on Modiv's own "(z)" (see
1.3, Skechers).

### 1.2 The real, corpus-verified mechanism

`buildMarkerTree` (`deterministic-sectionizer.js`) walks a flat, in-order
stream of line-start markers, keeping a stack of open sequences. A new
marker either continues the deepest open sequence whose `expectedNext(kind,
value)` equals the new label, or, if none matches, opens a brand-new child
directly under whatever sequence is currently deepest.

Pre-fix, `expectedNext` for `LOWER_LETTER`/`UPPER_LETTER`:

```js
case 'LOWER_LETTER': {
  if (/^[a-z]$/.test(value)) {
    return value === 'z' ? null : String.fromCharCode(value.charCodeAt(0) + 1);
  }
  const m = value.match(/^([a-z])\1+$/);
  return m ? m[1].repeat(value.length + 1) : null;
}
```

Two separate, compounding bugs in this one function, both confirmed by
direct trace against the real Modiv tree dump (every `8.12(*)` node, in
document order, before any fix):

1. **A single letter "z" has no defined successor at all** (`value === 'z'
   ? null`). When "(aa)" arrives, the still-open "(z)" frame's
   `expectedNext` is `null`, which can never equal "aa", so "(z)" is never
   recognised as continuing anything, and it is never popped. "(aa)"
   therefore falls through to the "open a brand-new child" path, attaching
   under whatever is currently deepest, which is "(z)" itself.
2. **A repeated-letter value's own successor is wrong.** For a value like
   "aa", the code returns one more repetition of the same letter ("aaa"),
   not the next letter at the same length ("bb"). So even after "(aa)"
   opens (wrongly, per bug 1) as a new child, "(bb)" does not match it
   either, and falls through the same way, one level deeper again. This
   repeats for every subsequent doubled letter, producing an ever-deepening
   chain: `8.12(z)(aa)(bb)(cc)...(zz)`, 27 levels deep, then restarting as
   `8.12(z)(aaa)(bbb)(ccc)...` for the next 24.

Neither bug requires an inner list to be present. Bug 1 alone is sufficient
to misparent "(aa)" under "(z)"; bug 2 alone is sufficient to keep
misparenting every subsequent doubled letter under its immediate
predecessor rather than as a sibling. Both were fixed together (section 2).

### 1.3 Corpus-wide extent, before any fix

**Preliminary, fast signal.** Scanned every real document's own clean text
(Modiv, TopBuild, Skechers real SEC-HTML; Landos already plain text) for
every line-start marker candidate, independent of the tree, and flagged any
single "z"/"Z" candidate whose immediate next candidate in the flat stream
is a doubled/repeated-letter marker:

| Deal | Total line-start marker candidates | Collision sites found |
|---|---:|---:|
| Modiv | 369 | 1 ("z" at char 380188, immediately followed by "aa" at char 381535, both in clean-text char offsets) |
| TopBuild | 328 | 0 |
| Skechers | 408 | 1 ("z" at char 22784, immediately followed by "aa" at char 23352) |
| Landos | 361 | 0 |
| foundation | 5 | 0 |

This heuristic only catches a collision when the doubled letter is the
*literal next* candidate after "z" in the flat stream, so it is a lower
bound, not a proof of completeness (a genuine, tree-visible inner list
between "z" and "aa" would hide from it). The authoritative measurement is
the full before/after tree diff in section 3, which agrees with this
heuristic exactly: 2 deals affected (Modiv, Skechers), 0 elsewhere, checked
by a different method.

---

## 2. JUDGED: the fix

**Recommendation evaluated and applied:** replace the single-letter and
repeated-letter branches of `expectedNext` with one function,
`nextLetterSequence`, implementing the real convention this corpus's own
filings print: `a, b, ..., z, aa, bb, ..., zz, aaa, bbb, ...`.

```js
function nextLetterSequence(value) {
  const isUpper = value[0] === value[0].toUpperCase();
  const wrap = isUpper ? 'Z' : 'z';
  const first = isUpper ? 'A' : 'a';
  if (value.length === 1) {
    return value === wrap ? first + first : String.fromCharCode(value.charCodeAt(0) + 1);
  }
  const letter = value[0];
  return letter === wrap
    ? first.repeat(value.length + 1)
    : String.fromCharCode(letter.charCodeAt(0) + 1).repeat(value.length);
}
```

`expectedNext('LOWER_LETTER', ...)` and `expectedNext('UPPER_LETTER', ...)`
both delegate to this one function, so the fix is symmetric by
construction, not by separately duplicating the logic for each case (a
synthetic test proves the upper-case path independently, see section 8,
since no real filing in this corpus exercises it).

**Why this fix, and not the two alternatives `P1-PLAN.md`'s own "Technical"
section names** ("preferring a shallower match when a candidate matches more
than one open frame, or resetting an inner run more aggressively when a
large structural gap intervenes"): both of those change the *matching or
reset policy* of `buildMarkerTree` itself, which is the part of this module
every kind of nested list, letters, romans, digits, relies on identically.
A shallower-match preference risks changing behaviour for genuinely nested,
unrelated lists that happen to share a kind at two open depths (a real,
if rare, shape: Skechers's own "(vv)" roman sub-list sits directly below a
doubled-letter frame, and preferring "shallower" indiscriminately would
right the outer list at the cost of wrongly attaching the inner one, or
require its own carve-out to avoid doing so). A gap-based reset introduces a
new, second heuristic (what counts as "a large structural gap") with its own
false-positive/false-negative risk to measure across the corpus.

The fix actually applied touches only what `expectedNext` computes for one
specific value, a pure function with no dependency on stack depth, search
order, or gap size. The **existing** "deepest match wins, but only among
frames whose `expectedNext` truly equals this label" rule is untouched and,
once the value it was consulting is corrected, does exactly the right thing
on its own, including in Skechers's harder case (section 5). This is a
smaller change with a narrower blast radius, verified corpus-wide in section
3 to be exactly that: 2 deals touched, both in precisely the collision
region, nothing else.

Acceptance criterion 5 (say so if the heuristic cannot be repaired without a
larger rewrite): it did not need one. The change is 52 lines including
comments, entirely inside `expectedNext`'s own two case branches, with zero
changes to `buildMarkerTree`'s matching, popping, or fallback logic.

---

## 3. MEASURED: fix verification, full tree diff per deal

Captured full node dumps (`kind`, `reference`, `depth`, `start`, `end`,
`heading`) for all 5 corpus members before editing the file, then again
after, using the identical pipeline
`tests/canonical-v2-native-sectionizer.test.js`'s own `sectionizeRealFiling`
helper uses (Modiv/TopBuild/Skechers: real SEC-HTML through
`buildSecEdgarIntakeCapture`/`convertSecHtmlToCanonicalText`; Landos:
already plain text; foundation: `tests/fixtures/canonical-v2/
foundation-source.txt`). Diffed on `(kind, reference, start, end)`, matching
`swallowed-headings.md`'s own convention, not `section_id` (expected to
change whenever `reference`/parent does).

Node totals sanity-checked against `swallowed-headings.md`'s own committed
post-fix numbers before trusting this session's probe: Modiv 472, TopBuild
408, Skechers 539, Landos 400, foundation 7, all matched exactly.

| Deal | Nodes before | Nodes after | Added | Removed | Source byte length | Document hash |
|---|---:|---:|---:|---:|---|---|
| Modiv | 472 | 472 | 48 | 48 | 428768, unchanged | unchanged |
| TopBuild | 408 | 408 | 0 | 0 | 412860, unchanged | unchanged |
| Skechers | 539 | 539 | 66 | 66 | 380704, unchanged | unchanged |
| Landos | 400 | 400 | 0 | 0 | 394336, unchanged | unchanged |
| foundation | 7 | 7 | 0 | 0 | 3149, unchanged | unchanged |

TopBuild, Landos, foundation: **byte-identical trees**, confirmed at the
full node level, zero added, zero removed. Source bytes and document hashes
are unchanged everywhere (expected: this fix only changes tree shape, never
touches source admission), confirming the fix is a verified no-op on 3 of
the 5 corpus members.

Modiv's 48 removed / 48 added and Skechers's 66 removed / 66 added are each
**net zero**, meaning the fix reshapes, it does not add or drop, real
content. Every removed node is one of two kinds, both accounted for:

- The old, wrongly-oversized "(z)" node itself (1 per deal), replaced by a
  correctly narrow "(z)" ending exactly where "(aa)" begins.
- A phantom, ever-deeper-chained reference
  (`8.12(z)(aa)`, `8.12(z)(aa)(bb)`, ... down to `8.12(z)(aaa...uuu)` for
  Modiv; the Skechers equivalent) that never matched anything the agreement
  itself prints, replaced by the correctly flat reference at the same depth
  as its siblings.

No removed node is unaccounted for, and no added node introduces a
reference, byte range, or heading that is not the same underlying,
pre-existing defined term, just correctly bounded and parented. Full
removed/added lists per deal (74 lines total) were generated and inspected
directly; representative excerpts appear in sections 5 and 6 below rather
than reproduced in full here.

---

## 4. MEASURED: parentage, verified beyond what sibling tiling can show

The brief's own warning: sibling tiling (`assertSiblingsTileExactly`) is
structurally blind to misparenting, exactly as it was blind to swallowed
headings before the earlier fix this session builds on. A node moved to the
wrong parent, with its own span untouched, produces neither an overlap nor
a gap under that check. Three independent methods were used, not one:

1. **`assertParentageIsConsistent`** (already in the test file this task
   owns): every node's parent exists in the tree, has strictly lower depth,
   and spans strictly contain the child's span. Ran corpus-wide via the
   existing test suite (`tests/canonical-v2-native-sectionizer.test.js`'s
   `corpus-wide boundary regression check` loop) against modiv/topbuild/
   skechers: pass. This proves internal non-contradiction, not correctness
   against the pre-fix baseline, which is why methods 2 and 3 exist.
2. **Direct `parent_section_id` identity checks** against the specific
   repaired nodes: `8.12(gg).parent_section_id === 8.12.section_id`,
   `8.12(vv).parent_section_id === 8.12.section_id`, both true, and
   `8.12(gg).depth === 8.12(f).depth`, true (same depth as every
   never-broken sibling). Skechers: `1.1(vv)(i).parent_section_id ===
   1.1(vv).section_id` (the genuine inner list, still correctly nested) and
   `1.1(ww).parent_section_id === 1.1.section_id` (the outer list, correctly
   NOT nested under the inner list), both true.
3. **Whole-corpus parent-stability check, built specifically to close this
   blind spot.** For every node present in both the before and after trees
   whose own `(kind, reference, start, end)` tuple is unchanged (i.e. every
   node the added/removed diff in section 3 does not already cover),
   resolved its parent in each tree by `section_id` and compared the
   parent's own `(kind, reference, start, end)` tuple before vs after. A
   node changing parent while keeping its own span identical would show up
   here and nowhere else.

   | Deal | Unchanged-key nodes checked | Parent mismatches |
   |---|---:|---:|
   | Modiv | 424 | 0 |
   | TopBuild | 408 | 0 |
   | Skechers | 473 | 0 |
   | Landos | 400 | 0 |
   | foundation | 7 | 0 |
   | **Total** | **1712** | **0** |

   Zero silent reparenting anywhere in the corpus, including well outside
   the two known collision regions, not assumed from the added/removed diff
   alone.

**Reference-collision safety** (acceptance criterion: an ambiguous reference
must stay unresolvable, never silently resolve to the first match). Scanned
every node's `reference` string for duplicates, whole-tree, post-fix, all 5
deals: **zero collisions everywhere.** `findSectionByReference` itself
(`nodes.find(...)`, a plain first match, no ambiguity detection) was not
touched by this fix; the letter-track progression this fix corrects is, by
construction, strictly monotonic and unique within any one continuing
sequence, so no scenario in which two sibling markers under the same parent
could ever compute the same label. This property was also encoded as a
standing regression test, not just a one-off check (section 8).

---

## 5. MEASURED: resolution correctness, verified against the agreement's own text

### 5.1 Modiv, the two references this task named

```
findSectionByReference(tree, '8.12(gg)') -> [386544, 386596)
findSectionByReference(tree, '8.12(vv)') -> [399710, 402133)
```

Full text of the resolved "8.12(gg)" span, read directly from the real
document bytes at that exact offset, not chosen to match an expectation:

```
(gg) "Parent Base Amount" means $15,000,000.00.
```

The entire definition, nothing more, nothing less: the span starts exactly
on the marker and ends exactly at the end of the sentence, immediately
before "(hh)" begins. Matches `lib/canonical-v2/native-producer/
modiv-termination-fee-source-parser.js`'s own independent, purely
text-regex-based extraction of the same figure ($15,000,000.00), confirming
the tree-derived span agrees with a completely separate extraction method
that never looked at the tree at all.

"8.12(vv)" begins `(vv) "Parent Termination Fee" means an amount equal to
the lesser of (i) the Parent Base Amount and (ii) the maximum amount...`
and ends immediately before "(ww)" begins. Both `(gg)` and `(vv)` are direct
children of the "8.12" SECTION node, at the same depth as `8.12(a)` through
`8.12(y)`, which were never affected by the defect.

Every one of the old, wrongly-nested references
(`8.12(z)(aa)`, `8.12(z)(aa)(bb)(cc)(dd)(ee)(ff)(gg)`, `8.12(z)(aaa)`, and
so on) now resolves to `null`, confirmed directly, never silently keeps
resolving to the node it used to reach under the wrong name.

### 5.2 Skechers, the harder case: a genuine inner list sitting inside the collision

Section 1.1's entry "(vv)", "Material Contract", has its own real,
line-start, roman-numeral sub-list, (i) through (xiii), genuinely nested
inside it (this is not a defect; a definitions section's own entry having a
real internal enumeration is ordinary drafting). Pre-fix, this sub-list's
last member, "(xiii)", was the deepest open frame by the time "(ww)"
("Maximum Equity Election Cap") appeared, so "(ww)" attached as ITS child,
28 levels deep, rather than resuming as "(vv)"'s own sibling.

Verified post-fix:

- `1.1(vv)` resolves to `[36010, 39783)`, text beginning `(vv) "Material
  Contract" means any of the following...`.
- `1.1(vv)(i)` through `1.1(vv)(xiii)` all resolve, all direct children of
  `1.1(vv)`, fully contained inside its span (`vv.start <= vvI.start &&
  vvXiii.end <= vv.end`), exactly as they were pre-fix. **The fix does not
  disturb a genuine nested list even when that list sits directly inside
  the collision region.**
- `1.1(ww)` resolves to `[39783, 39871)`, text beginning `(ww) "Maximum
  Equity Election Cap" means...`, a **direct child of "1.1" itself**, a
  sibling of `1.1(vv)`, not a descendant of `1.1(vv)(xiii)`. `1.1(vv).end
  === 1.1(ww).start` exactly.

This is the one real corpus filing that proves the fix handles the harder,
compound case (collision plus a genuine nested list sitting inside it), not
just the simpler Modiv shape (collision with no tree-visible nesting at
all).

---

## 6. MEASURED: corpus-wide extent repaired

Computed precisely by comparing the set of `reference` strings resolvable
in the before tree against the after tree, per deal (not just node counts,
the exact strings):

| Deal | Newly resolvable (null before, resolves now) | Re-spanned (resolvable both before and after, but to a different, now-correct span) | Vanished (resolved to a wrong node before, resolves to null now) |
|---|---:|---:|---:|
| Modiv | 47 | 1 (`8.12(z)` itself) | 47 |
| Skechers | 65 | 1 (`1.1(z)` itself) | 65 |
| TopBuild, Landos, foundation | 0 | 0 | 0 |

**112 reference strings, across 2 deals, move from unresolvable to
resolving to their correct, real span.** This includes the two references
this task named (`8.12(gg)`, `8.12(vv)`) as 2 of the 47 on Modiv.

**Separately, and easy to miss:** `8.12(z)` and `1.1(z)` themselves were
never null pre-fix, they resolved, silently, to a hugely oversized span.
`8.12(z)` went from `[382575, 414712)` (32,137 bytes, silently claiming the
entire remainder of Section 8.12) to `[382575, 383931)` (1,356 bytes, its
real span). `1.1(z)` went from `[23381, 59414)` (36,033 bytes) to `[23381,
23957)` (576 bytes). A null-based tripwire (like `swallowed_heading_
residuals`, built earlier this session for a different defect) would never
have caught this specific part of the defect, because it never returned
null. This is the same class of danger the earlier heading-cap fix's own
note flagged: a wrong-but-plausible answer is worse than an absent one,
because it reads as correct.

The 47/65 "vanished" phantom references (the old
`8.12(z)(aa)(bb)(cc)...`-style chains) were never printed anywhere in either
agreement and never should have resolved; their disappearance is the fix
working, not a regression, confirmed by the fact that no test anywhere in
this repository's suite ever cited one of these phantom strings as an
expected resolvable reference (checked by grep across `tests/`, `lib/`,
`scripts/`, `evidence/` for both `8.12(z)(aa` and `1.1(z)(aa`; zero hits
outside this task's own new tests and this note).

---

## 7. MEASURED: a concrete downstream consequence, found while diagnosing test impact

`tests/canonical-v2-prompt-budget-split-preflight.test.js` (not owned by
this task, not edited, see section 9) has a test that dispatches Section
8.12 through `buildPromptBudgetSplitPreflight` and checks "MAE anchor
coverage": every real occurrence of a "material adverse effect... means"
pattern anywhere in the section's text must fall inside some produced work
item's byte range. Re-ran this exact scenario against the post-fix tree to
understand why it now fails, rather than assuming:

```
MAE_DEFINITION work items (section_reference list):
  pre-fix (test's hardcoded expectation): ["8.12(g)", "8.12(z)"]
  post-fix (actual):                      ["8.12(g)", "8.12(ll)"]
```

Section 8.12 has exactly two real MAE-relevant definitions: "Company
Material Adverse Effect" at printed label "(g)", and "Parent Material
Adverse Effect" at printed label "(ll)" (confirmed directly: the anchor
pattern matches at absolute byte offsets 367819 and 387682, and 387682 is
owned by `8.12(ll)` post-fix). Pre-fix, "(ll)" did not exist as its own
node; it was buried inside the misnested chain, and the split algorithm's
choice of "8.12(z)" as its second work item was coincidental scale (the
33KB phantom "(z)" blob happened to be large enough to warrant its own
split, and happened to contain byte offset 387682 somewhere inside its
wrongly-oversized span), not identification of the actual clause.
Post-fix, the same algorithm correctly names "8.12(ll)", the real, precise,
correctly labelled "Parent Material Adverse Effect" definition, 4,831
bytes, not a 33KB blob titled "Intellectual Property" that happens to
contain the real text somewhere inside it.

**Judged:** this is a strictly better downstream result, not a neutral
side effect. If this preflight's chosen work item were ever dispatched to a
model as its own governed scope under the old tree, the model would be
shown a blob spanning roughly twenty unrelated defined terms, keyed under a
`section_reference` of `8.12(z)` bearing no resemblance to "Parent Material
Adverse Effect" at all. The fix makes this precise. The test's own hardcoded
expectation (`["8.12(g)", "8.12(z)"]`) encoded the old defect's shape as
correct; it needs updating by whoever owns that file, matching the exact
precedent already set in the same file, 2026-08-05, when a different
sectionizer fix retargeted a different test in this same file (see that
test file's own comment at its "III-INTRO" to "3.1" retargeting, "for a
reason that is the point of the test rather than an accident of it").

---

## 8. BUILT: new tests

All in `tests/canonical-v2-native-sectionizer.test.js` (owned by this
task). 35 tests total post-fix (30 pre-existing, unchanged, plus 5 new):

- **Two synthetic, hand-built fixtures isolating the pure mechanism**,
  independent of any real filing: (a) a lettered list running from "(x)"
  through "(cc)", proving "(z)" is followed by "(aa)" as a sibling, not
  swallowed as a parent, and that a real definition's own inline
  parenthetical sub-references (mid-sentence, never at a line start) mint
  no children at all, mirroring the real Modiv "(z)" shape directly; (b) a
  fixture opening directly on a doubled-letter marker ("(yy)"), isolating
  the doubled-letter tier's own continuation and proving the wrap boundary
  "(zz)" -> "(aaa)", not "(zz)" -> "(zzz)".
- **One symmetry test** for `UPPER_LETTER` markers ("(Y)" -> "(Z)" -> "(AA)"
  -> "(BB)"), since no real filing in this corpus exercises the upper-case
  path; the fix is symmetric by construction (both cases delegate to the
  same `nextLetterSequence`), but nothing previously proved that in a real
  test.
- **A full Modiv regression test**, pinning `8.12(gg)`/`8.12(vv)` by exact
  byte-anchored text content (regex-matched, avoiding literal curly-quote
  characters in the source file per this file's own existing convention),
  parentage, depth, and the old phantom references' continued
  non-resolution.
- **A full Skechers regression test**, pinning the harder compound case: a
  genuine nested roman sub-list surviving correctly inside the collision
  region, and the outer list correctly resuming afterward.
- **A standing `assertNoReferenceCollisions` helper**, wired into the
  existing `REAL_FILINGS` corpus-wide loop and the separate Landos test,
  so the "zero collisions" property measured once in section 4 is checked
  on every future run, not just this session.

`docs/codex-program/P1-PLAN.md`'s own "Done when" criterion for SEC2 names
exactly this shape of coverage: "A regression test pins this specific
collision shape... because the current algorithm's deepest-match-wins rule
is a general ambiguity, not a Modiv-only quirk." The synthetic tests target
the general mechanism directly; the two real-filing tests pin it on both
corpus members actually affected.

---

## 9. MEASURED: impact on already-committed tests outside this file's ownership

Per instruction: **neither file below was edited.** This is a report for
whoever owns them to act on, not a fix. Both were found already present in
the working tree, not modified by this task. Checked `ls -la` for each
before relying on either: `native-extraction-run-citation-followup.js` and
its test (9.1) carry mtimes of 2026-08-06 00:11 and 00:13, after this task's
own starting point, consistent with the brief's warning that another agent
might be working elsewhere under `lib/canonical-v2/` concurrently.
`prompt-budget-split-preflight.js` (9.2) is an older, already-settled file
(2026-08-04 19:42); only its test file was touched recently (2026-08-05
23:19), during the same session as the earlier heading-cap fix, per that
test file's own "Retargeted on 2026-08-05" comment (section 7). Neither is
inside this task's own ownership (`deterministic-sectionizer.js` and its own
test file only), regardless of when each was last touched.

### 9.1 `tests/canonical-v2-native-extraction-run-citation-followup.test.js:111`

`lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js`
and its test file implement the citation-following design
`citation-scope-design.md` specifies. Both were already present, already
built around the not-yet-fixed SEC2 defect, exactly as
`citation-scope-design.md` Part 6.5 case 2 anticipated: "record a typed
`CITATION_REFERENCE_UNRESOLVED` entry... so it becomes concrete pressure to
fix SEC2... without making that fix a hard prerequisite." The test's own
title says so explicitly: "...8.12(gg)/8.12(vv) still do not [resolve]...",
and its body asserts `findSectionByReference(tree, ref)` is `null` for both,
with the comment "(SEC2, unfixed, confirmed not on this feature's path)".

This assertion now fails, correctly, because SEC2 is fixed. This was
anticipated, not accidental, by the design this test belongs to.

### 9.2 `tests/canonical-v2-prompt-budget-split-preflight.test.js:170`

Diagnosed precisely in section 7. The test's hardcoded expectation
(`["8.12(g)", "8.12(z)"]`) encoded the pre-fix tree's accidental shape (a
33KB phantom node happening to be large enough to need its own split, and
happening to contain the real "Parent Material Adverse Effect" clause
somewhere inside it) rather than the real underlying legal structure. The
sibling test one function above it in the same file (`Modiv 8.12 keeps the
under-ceiling Key Defined Terms parent call and splits only MAE`, line 153)
does not hardcode "(z)" anywhere and continues to pass unchanged.

### 9.3 No other file in the suite is affected

Grepped `tests/`, `lib/`, `scripts/`, `evidence/` for `8.12(gg)`, `8.12(vv)`,
`8.12(z)`, and `1.1(z)` directly. Every hit outside this task's own new
test/note is accounted for by 9.1 and 9.2, or is prose/evidence-archive
content that references these strings descriptively without asserting a
resolution outcome (`lib/canonical-v2/native-producer/
modiv-termination-fee-source-parser.js`'s own citation list, which is pure
text-regex extraction, never touches the tree, and is unaffected;
`evidence/canonical-v2/.../resolution.json` archival run snapshots, not
read by any test, matching `swallowed-headings.md`'s own finding about a
different archival directory in section 5.3 of that note).

### 9.4 Full-suite accounting

`CI=true npm test`: `tests 7560` (7555 baseline + 5 new), `pass 7516`,
`fail 2`, `skipped 42`, both named above, both explained, both outside this
task's ownership. This session's own first full-suite run, after the fix
but before adding the 5 new tests, independently measured `tests 7555, pass
7511, fail 2, skipped 42` (the same two failures, `skipped` identical to the
final run). "7555, green" is the figure the task's own brief states as the
starting point; this session did not itself re-run the suite against the
unmodified, pre-fix file (a `git stash` of just the two owned files, to get
a directly-measured pre-fix baseline without touching any other agent's
work, was attempted and blocked by the permission system, and no workaround
was used, matching the instruction to explain and stop rather than route
around a denial). The pre-fix baseline is therefore taken on the brief's
word, not independently re-verified here, but the arithmetic is at least
internally consistent with it: `7511 pass + 2 fail + 42 skipped = 7555`
matches the brief's own total exactly, and a "green, 7555" pre-fix state
would be `7513 pass + 0 fail + 42 skipped`, i.e. exactly the same 2 tests
this note already names moving from pass to fail, nothing else.

---

## 10. Final verification

`tests/canonical-v2-native-sectionizer.test.js` (owned by this task):
**35/35 pass** (30 pre-existing, unchanged, plus 5 new, listed in section
8).

Full suite: `CI=true npm test` gives `EXIT=1`, `fail 2`, both accounted for
in section 9, both pre-existing test files outside this task's ownership
(`deterministic-sectionizer.js` and its own test file), neither touched, per
the brief's own instruction to leave alone and report anything found
already modified by another agent. `native-extraction-run-citation-followup.js`
and its test, and `prompt-budget-split-preflight.js` and its test, were read
for diagnosis only, never written. No fixture was edited to make anything
pass.

## 11. Files changed

- `lib/canonical-v2/native-producer/deterministic-sectionizer.js`:
  replaced the `LOWER_LETTER`/`UPPER_LETTER` branches of `expectedNext`
  with a single `nextLetterSequence` helper implementing the real
  `a...z, aa...zz, aaa...` drafting convention. No other function touched.
- `tests/canonical-v2-native-sectionizer.test.js`: 5 new tests (section 8),
  plus a new `assertNoReferenceCollisions` helper wired into the existing
  corpus-wide loop and the Landos test.
- `docs/codex-program/notes/nested-lettering-collision.md`, this file.
