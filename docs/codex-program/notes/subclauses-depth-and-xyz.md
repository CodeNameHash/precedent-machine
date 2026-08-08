# subclauses.js — MAX_DEPTH raise and (x)/(y)/(z) corroborated CHILD-OPEN

Working notes for the two changes to `lib/parser-v2/subclauses.js` requested
2026-08-08. Written incrementally; this is a skeleton, filled in as each
step completes.

## Status

- [x] Harness rebuilt, baseline reproduced (Change 3, part 1)
- [x] Change 1 — raise MAX_DEPTH (to 5)
- [x] Change 2 — (x)/(y)/(z) corroborated CHILD-OPEN
- [x] Re-measure after each change separately and both together
- [x] New tests written (18 total in tests/subclauses.test.js, up from 8)
- [x] Guard proof for each change
- [x] Full verification (existing tests, V1 consumers, npm test, npm run build)
- [x] Coordinator addendum: limb-marker back-reference shapes (3 tests + corpus scan)

## 1. Harness

Original scratchpad script (`segmenter-survey.js`) referenced in
`docs/codex-program/notes/fable-review-step-2x.md` §5.4 no longer exists on
disk (ephemeral scratchpad from an earlier session). Rebuilt independently at
`/tmp/.../scratchpad/measure.js` (this session's scratchpad — not committed).

Method: for every `evidence/canonical-v2/*` run directory with a usable
`source-reference.json` (deal known, `admitted_source_capture_inputs
.retrieved_at` recorded — i.e. made on/after 2026-08-07) and a
`section-location-scan.json`, rebuild the deal's canonical text ONCE per deal
via `rebuildAdmittedSourcePrimitives` (verified: exactly one
`raw_bytes_sha256` / `canonical_text_sha256` per deal across all its run
directories, so any one run directory's rebuild gives the deal's whole
canonical text). Read each run's `section-location-scan.json` top-level
`resolved` entries (the requested section's own node, byte offsets into the
canonical text), slice with `utf8Slice` (byte offsets, per CLAUDE.md's
byte-slicing rule — NOT string `.slice`), dedupe to unique
`(deal, section_reference, start, end)`, and run `segmentSubClauses` /
`findStructuralMarkers` over each unique section.

Mis-nest signature: a marker whose path is `<parent>.<label>` where the
STYLE of the parent frame's own label equals the style of `<label>` itself
(same-style parent-child link).

Directory-count note: 225 run directories carry `source-reference.json`; 27
of those have no recorded `retrieved_at` (pre-2026-08-07, correctly refused,
consistent with the fable note's "Modiv...pre-08-07...correctly refuse");
198 remain. The fable note recorded 213 runs / 538 sections. This session's
independent rebuild found a different run count (see §2) — reported as-is,
not tuned to match.

## 2. Baseline measurement (unmodified subclauses.js, MAX_DEPTH=3, xyz off)

198 run directories (deal known + `retrieved_at` recorded), covering all 7
deals, gave **539 unique `(deal, section_reference, start, end)` sections**
(171 markerless, 368 with markers, 2,366 markers total; depth1/2/3 =
262/75/31).

Mis-nest signature computed PRECISELY from the algorithm's own state (a
CHILD-OPEN whose new frame's style equals its immediate parent frame's
style at push time — not guessed from label text after the fact, which
over-fires on ambiguous roman/alpha tokens; verified this by first trying
the label-guess approach, which gave a nonsensical 18% "mis-nest rate" and
was discarded). Cross-checked the instrumented replica against the real
`findStructuralMarkers` export across all 539 sections at every
configuration used below — **zero path/depth mismatches**, so the
mis-nest counts below are counts of what the shipped algorithm actually
does, not an approximation.

**Baseline: 8 sections / 53 markers mis-nested = 1.48% of sections (8/539).**
Six of those eight are an EXACT match, marker-for-marker (45 of 53 markers,
matching precisely), for the fable review's six named sections and its 45/6
figure: concho Annex-A, modiv 8.12, modiv 8.3, redhat 3.01, skywater 3.21,
topbuild 2.1. The other two (skechers 4.15 — 1 marker, topbuild 3.2 — 7
markers) are not in the fable list; the corpus has grown by one section
since that review (539 vs 538), most plausibly explaining the difference.
**Manually inspected the leaf text of every one of the baseline 8 sections'
tainted markers — all are substantial, genuine second-list content
(disclosure-letter items, notice addresses, tax reps), never short
back-reference fragments — so the baseline count is not itself contaminated
by the back-reference hazard addressed in §9.** This is treated as a
faithful reproduction of the fable baseline, not a fresh number tuned to
match it.

## 3. Change 1 — MAX_DEPTH: raised 3 -> 5

Measured MAX_DEPTH at 4, 5 and 6 before choosing:

| MAX_DEPTH | new depth reached | mis-nest sections | mis-nest markers |
|---|---|---|---|
| 3 (baseline) | — | 8 | 53 |
| 4 | 7 sections gain depth4 | 9 (+1) | 75 |
| 5 | 4 more sections gain depth5 | 9 (+0) | 88 |
| 6 | 4 sections gain depth6 | 10 (+1) | 130 |

Per-section inspection (not just the totals) is what decided it:
- At depth4, of the 7 sections gaining new depth, **3 are genuinely clean**
  (modiv 7.3, skechers 5.3, and TopBuild 3.1's first 7 depth-4 items — all
  untainted) and **4 are purely extending an already-broken chain** deeper
  (concho Annex-A, redhat 3.01, skywater Annex-A, skywater 3.21 — every
  depth-4 marker in these four is already tainted). Going to depth4 costs
  exactly one NEW mis-nested section (skywater Annex-A, 1 marker — a stray
  same-style roman restart that was safely folded into its parent at
  depth3).
- At depth5, the only section reaching it is **TopBuild 3.1**, and its 18
  depth-5 markers (`...vii.F.f.vii.E.A` through `.R`, an alphaUpper
  carve-out list) are **entirely untainted** — a genuine, real five-level
  outline, exactly the "five occurs" case flagged in the task brief. No
  section becomes newly mis-nested going from depth4 to depth5.
- At depth6, TopBuild 3.1's own depth-6 markers appear — and now ALL 18 are
  tainted: depth6 adds a spurious same-style child layer under the clean
  depth-5 list, corrupting it. No section in the corpus has a genuine depth6
  structure.

**Conclusion: MAX_DEPTH=5.** It captures the real four-level pattern from
the brief `(a) -> (i) -> (A) -> (1)` and the real five-level pattern that
exists in this corpus, at a cost (one small mis-nested section) that is
already fully incurred by depth4 alone — depth5 is free on top of that.
MAX_DEPTH=6 was measured and rejected: zero genuine new structure, and it
actively corrupts the one clean depth-5 list in the corpus.

## 4. Change 2 — (x)/(y)/(z) corroborated CHILD-OPEN

Implementation (`lib/parser-v2/subclauses.js`):
- `candidateStyles` gains a fourth style, `xyz` (`x`=0, `y`=1, `z`=2).
- CHILD-OPEN for the xyz style ADDITIONALLY requires `xyzCorroborated`: a
  bounded forward scan (stops at the next paragraph break) for a literal
  `(y)` after the `(x)`. No corroboration, no open — a lone `(x)` never
  opens anything (tested).
- Precedence, per the brief: SIBLING first (unchanged for every style
  except one narrow, deliberate exemption below), then corroborated xyz
  CHILD-OPEN, then ordinary CHILD-OPEN. This falls out structurally: "x" is
  the only token that is ever value-0 under the xyz style, so ordinary
  CHILD-OPEN's `value === 0` search can never collide with it.
- **One exemption to the existing ambiguous+weak-position SIBLING guard**:
  continuing an ALREADY-OPEN xyz frame (`y` after `x`, `z` after `y`) is
  exempt from the strong-position requirement that single-char roman/alpha
  tokens need. Without this, `y`/`z` — newly ambiguous once xyz is added
  (they gain a second candidate style) — would be blocked from continuing
  at the mid-paragraph positions the real drafting always uses, which would
  silently neuter the whole feature. The guard's purpose (stop a stray
  token hijacking an unrelated ACTIVE frame at a weak position) does not
  apply here: an xyz frame can only exist because its `(x)` was already
  corroborated. Confirmed this doesn't weaken protection elsewhere: the
  exemption only fires when `hit.style === 'xyz'`, so every other style's
  guard is byte-for-byte unchanged (re-verified: 0 path/depth mismatches
  against the unmodified real module at MAX_DEPTH=3/xyz-off across all 539
  sections after adding the exemption).
- `(x) -> (z)` skipping `(y)`: **not accepted.** `z`'s xyz value is 2, and
  SIBLING requires exactly `top.value + 1`; a bare `z` after `x` needs
  value 1, so it fails the SIBLING test and `z` can never itself CHILD-OPEN
  (its xyz value is never 0). Stays conservatively unsplit, same as any
  other un-opened enumeration.
- `(z)` closing without `(y)`, or a lone `(y)`/`(z)` with no prior `(x)`:
  **not accepted, by construction**, for the same reason — only `x` is ever
  value 0 for the xyz style, so it is structurally the only entry point.

**Newly recognised: 24 markers across 10 sections in 6 of the 7 deals**
(concho, metsera, modiv, redhat, skywater, topbuild — skechers has none in
the resolved-section sample) at MAX_DEPTH=3. Manually inspected the text
around every one of the 24 — all are genuine inline enumerations (notice
provisions, tax-guidance letters, definitional cross-references, ordinary-
course carve-outs), none are back-reference contamination. This is lower
than the brief's "28 occurrences" figure; that count most plausibly came
from a raw grep over the corpus text rather than from what the segmenter
actually recognises as CHILD-OPEN-eligible (i.e., it likely includes
occurrences the module correctly leaves alone, e.g. `(x)` used purely as
prose inside a citation). **Mis-nest impact: zero — 8 sections / 53
markers, identical to baseline** — the xyz change does not raise the
mis-nest rate at MAX_DEPTH=3.

## 5. Re-measurement: the four numbers required

| Configuration | mis-nest sections | mis-nest markers | rate (of 539 sections) |
|---|---|---|---|
| Baseline (MAX_DEPTH=3, xyz off) | 8 | 53 | **1.484%** |
| Change 1 only (MAX_DEPTH=5, xyz off) | 9 | 88 | **1.670%** (+0.186pp) |
| Change 2 only (MAX_DEPTH=3, xyz on) | 8 | 53 | **1.484%** (+0) |
| Both changes (MAX_DEPTH=5, xyz on) | 9 | 88 | **1.670%** (+0.186pp) |

Change 1 raises the mis-nest rate by 0.186 percentage points (one section,
Skywater Annex-A — see §3 for why this is an accepted, bounded cost).
Change 2 raises it by nothing. Combined, the rate equals Change 1 alone —
the two changes do not compound.

Markers/sections newly captured (not mis-nested — genuine new coverage):
- Change 1: +62 markers (2,366 -> 2,428); 7 sections gain new depth4-5
  structure, 3 of those (modiv 7.3, skechers 5.3, TopBuild 3.1) entirely
  clean, TopBuild 3.1 alone contributing 18 clean depth-5 markers.
- Change 2: +19 markers (2,366 -> 2,385); depth1 sections 262 -> 263,
  depth2 75 -> 77; 10 sections across 6 deals gain xyz structure.

## 6. New tests (10 added to `tests/subclauses.test.js`, 8 -> 18)

1. Four-level outline nest resolves to depth 4.
2. Five-level outline nest resolves to depth 5 (the "five occurs" case).
3. Real corpus `(x)/(y)` fragment ("...other than (x) Permitted Encumbrances
   or (y) as would not...") splits into two depth-1 items.
4. Uncorroborated lone `(x)` (no `(y)` anywhere) does not open.
5. Genuine alpha list `(a)...(w)->(x)` (24 items, start-of-line) continues
   as alpha, not stolen by the xyz rule.
6. Hostile: mid-paragraph `clauses (x), (y) and (z) above` does not split
   even though `xyzCorroborated` genuinely returns true (a real `(y)`
   follows) — proves corroboration narrows an ambiguous token but does not
   bypass the pre-existing CHILD-OPEN adjacency/colon/first-marker gate.
7. Hostile: `Section 5.2(x)` cross-reference, glued to a digit, does not
   split.
8-9. The two ORIGINAL hostile tests (`Section 3.1(b)`, `clauses (A), (B),
   (C) and (D) above`) — already present, re-run unchanged, still pass
   (tests 7 and 15 in the file) — not duplicated as new tests since MAX_DEPTH
   and xyz do not touch their code paths.

### Coordinator addendum: limb markers as back-references (added mid-task)

Three more tests, addressing Ben's point that limb markers appear as
back-references inside a clause's own text (e.g. a `(C)` limb saying "as
described in (A) and (B) above"):

10. **Protected shape 1** — mid-paragraph `as described in (A) and (B)
    above` (inside an open `(C)` frame) stays inside `C`'s leaf. Verified
    unchanged by both this session's changes: protected by the pre-existing
    CHILD-OPEN "first marker overall" / adjacency gate (the earlier `(A)`
    and `(B)` already consumed those slots, so the back-reference's `(A)`
    is not first-marker-overall and is not colon-introduced or adjacent).
11. **Protected shape 2** — `Section 3.1(b) and Section 4.2(a)` cross-
    references, both glued to a digit, are rejected by `isEligiblePosition`
    exactly as any other cross-reference is.
12. **Real, pre-existing hole (not fixed by this task, not introduced by
    it)** — a colon-introduced back-reference, `"...comply with the
    following: (A) and (B) above."`, DOES get nested under `C` by the
    colon rule (`C.A`, `C.B`), because the colon rule has no sense of
    "citing" vs. "introducing" a list — this predates both of this
    session's changes and reproduces identically on `main`. Verified,
    per Ben's instruction, that the consequence is DETECTABLE: `C.A`/`C.B`
    are a same-style parent-child link (`alphaUpper` under `alphaUpper`),
    the exact signature real mis-nests carry, because real outlining never
    nests a style under itself. The test asserts this detectable signature
    rather than asserting a specific split (which is a known, pre-existing,
    out-of-scope hole, not something this task's two changes should be
    graded against).

## 7. Guard proof

Both required, each done by editing `lib/parser-v2/subclauses.js` in place,
running `tests/subclauses.test.js`, then reverting (verified byte-identical
to the pre-neuter file via `diff`).

**Change 1 (MAX_DEPTH).** Neutered `const MAX_DEPTH = 5` back to `3`. Result:
`not ok 8` and `not ok 9` (the four-level and five-level nest tests) —
exactly the two tests this change exists for, nothing else. `# tests 18,
# pass 16, # fail 2, exit=1`. Restored to `5`: `# tests 18, # pass 18, #
fail 0, exit=0`.

**Change 2 (xyz corroboration).** Neutered `xyzCorroborated` to
`return true` unconditionally (bypassing the "(y)" lookahead entirely).
Result: `not ok 11` (the uncorroborated-lone-"(x)"-does-NOT-open test) —
exactly the one test this specific mechanism exists for. `# tests 18, #
pass 17, # fail 1, exit=1`. Restored the real scan-and-match body: `# tests
18, # pass 18, # fail 0, exit=0`.

`diff` against a pre-edit backup of the file confirmed each restore was
byte-identical, both times.

## 8. Final verification

All commands run with output redirected to a file and the exit code
captured separately (never piped into `head`/`tail`), per the standing
convention.

- `CI=true node --test tests/subclauses.test.js` — **18/18 pass, exit 0**
  (8 original + 10 new: 4-level nest, 5-level nest, real xyz split,
  uncorroborated-x refusal, alpha-w-to-x-not-stolen, xyz-back-reference
  hostile, digit-glued-x hostile, plus the 3 coordinator-addendum
  back-reference-shape tests).
- `CI=true node --test tests/bring-down-recovery.test.js tests/span-claims.test.js
  tests/canonical-conditions.test.js tests/feature-compare.test.js` —
  **56/56 pass, exit 0. No consumer output moved.** Checked why: these
  fixtures' segmented text never exceeds depth 3 and never contains an
  `(x)/(y)/(z)` run, so neither change's code path is exercised by them —
  not "nothing to explain" by omission, but confirmed by inspection that
  their inputs don't reach the changed branches.
- `CI=true node --test tests/canonical-v2-mae-clause-label-parse.test.js`
  (a fifth, not-explicitly-required V1/native-producer consumer of
  `segmentSubClauses`, run as an extra check since it's in the same call
  graph) — **26/26 pass, exit 0.**
- `CI=true npm test` (full suite, `tests/**/*.test.js` + `*.spec.js`) —
  **8,272 pass / 3 fail / 44 skip of 8,319 total, exit 1.** All three
  failures confirmed UNRELATED to this change:
  - `canonical-v2-termination-limb-grant-context.test.js`: 2 failures,
    both `TypeError: canonical_text_id must be a full SHA-256 hex digest`
    inside `lib/canonical-v2/source-structure.js` via
    `lib/canonical-v2/native-producer/candidate-resolution.js`. That
    module does not import `subclauses.js` (checked: zero references) and
    the failure is a digest-format assertion in an unrelated fixture, not
    a segmentation output.
  - `codex-program-generated-docs.test.js`: 1 failure, `docs/codex-
    program/generated/system-inventory.json is stale`. This is a whole-
    repo mechanical inventory scan; the branch carried other, unrelated
    commits during this session (see the note on the shared branch,
    below), which is the far more likely cause than this task's two-file
    change — the inventory contains no reference to `subclauses` at all.
    Not fixed here, per the instruction to stop and report rather than
    touch a file outside `lib/parser-v2/subclauses.js`.
- `npm run build` — **succeeded** (`✓ Compiled successfully`, full route
  table printed, no error markers).

## 9. Note on the shared branch (observed during this session, not caused
   by any explicit action of this session)

`git status` shows a clean working tree — HEAD already contains this
session's complete final state, byte-for-byte. That is because this
container auto-checkpoints the working tree into WIP-tagged commits
(`wip(parser-v2): depth raised to 5, xyz lists in progress (UNREVIEWED)`,
then `wip(tests): back-reference cases from Ben's wrinkle (UNREVIEWED,
agent working)`) — this session never ran `git commit` itself. Confirmed
no commit after the second checkpoint touches `lib/parser-v2/subclauses.js`
or `tests/subclauses.test.js`, so the committed state matches the verified,
fully-restored, guard-proofed file exactly.

The branch also carried several commits on unrelated topics (2X-L limb
assertions, a MAE materiality-split revert, Fable review findings) that
land interleaved, by timestamp, with this session's two checkpoints —
consistent with another process also committing to this same branch during
this session's run. This session made no changes outside
`lib/parser-v2/subclauses.js`, `tests/subclauses.test.js`, and this notes
file, and verified (via `git log -- <path>`) that none of the unrelated
commits touch either of the first two.

## 9. Back-reference contamination: corpus check, and the lexical-guard question

**The mechanism is real** (reproduced above, §6 item 12) and **predates
both of this session's changes** — the colon rule already had this
property for `(A)/(B)/(C)` before today. Three checks against the actual
539-section corpus, all read-only, none changing behaviour:

1. **General colon-rule back-reference scan** (any style): searched every
   colon-opened CHILD-OPEN frame's own resulting LEAF text (excluding
   parent-chapeau frames, whose own text is legitimately empty before
   their first child — that is normal, documented behaviour, not a defect)
   for either (a) suspiciously short text (<25 chars) or (b) a tell word
   (`above`/`below`/`hereof`/`thereof`/`herein`) in its first 50 characters.
   **216 colon-opened leaf frames checked corpus-wide; 1 flagged, and that
   one is a false positive** (672 characters of genuine Consideration
   prose that happens to contain "thereof" once). **Zero genuine
   back-reference contamination found.**
2. **Direct regex scan** for `colon ... (X) ... (Y) ... {above,below,
   hereof,thereof,herein}` across all 539 sections: **zero hits.**
3. **All 24 real xyz-corroborated markers found by Change 2 (§4), manually
   read in context**: every one is a genuine enumeration (notice
   provisions, tax letters, ordinary-course carve-outs, definitional
   cross-references), none are back-references.

**On Ben's point 4 — does the xyz style specifically break the same-style
detector?** Confirmed rather than assumed: constructed
`'(a) do one; (b) do a second; (c) comply with the following provisions:
(x) and (y) above.'` with xyz enabled. The colon rule opens `c.x`/`c.y`
exactly as it opens `C.A`/`C.B` for the alpha case — but because the
parent `c` is `alphaLower` and the child is `xyz`, a DIFFERENT style, the
same-style detector does **NOT** flag it. This is a genuine, confirmed
blind spot: an xyz back-reference nested under a non-xyz parent (or with
no parent at all) is invisible to the same-style signature, because xyz is
definitionally a different style from everything else. It did not manifest
in any of the 24 real xyz opens found in the corpus (check 3 above), but
that is a fact about this corpus today, not a structural guarantee.

**Is a same-style flag separable into "two genuine lists" vs.
"back-reference"?** No — **not by the signature alone.** The signature
answers "does the same style repeat where it structurally shouldn't", and
both a genuine restart and a back-reference produce exactly that shape.
Today, empirically, every flagged instance in this corpus (the baseline 8
sections, manually read in §2) is a genuine restart, so the flag's
practical meaning here IS "genuine mis-nest" — but that is a fact about
this corpus, not a guarantee the mechanism itself provides. The right way
to describe the flag is Ben's own framing: it means "structure is
uncertain here," not "this specific cause occurred."

**Recommendation: do not add a lexical guard.** Reasoning:
- Zero real corpus instances of the hazard exist to calibrate against, in
  either the general (any-style) or xyz-specific form — there is nothing
  for a lexical rule to be validated against, and no discriminating power
  can be demonstrated from zero positive examples.
- The codebase has just been burned by exactly this failure mode
  (`in any case` — 299 corpus uses, dominated by a sense the filter didn't
  intend) baking in a plausible-sounding phrase without checking whether it
  actually discriminates in THIS corpus's real usage. `above`/`below`/
  `hereof`/`thereof`/`herein` are common in ordinary substantive drafting
  too (e.g. "the matters set forth above shall survive"), so the same risk
  applies without corpus positives to check it against.
- The same-style detector already catches every real instance this session
  found, including the coordinator's synthetic alpha/alpha case. "The
  detector is sufficient" is the honest answer for what the corpus
  currently shows.
- The confirmed xyz blind spot (different-style parent) is a real residual
  gap, but it is unobserved, narrow (only reachable via the colon rule
  specifically, not adjacency/first-marker), and the two proxy checks above
  are cheap enough to re-run as the corpus grows — recommend re-running
  them as a periodic check rather than shipping an uncalibrated filter now.
