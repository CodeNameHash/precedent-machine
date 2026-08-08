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

(filled in below as each file is edited)
