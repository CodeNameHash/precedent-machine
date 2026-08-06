# Fixing the dead CompareSectionColumn locator: what actually cleared

Follow-on to `docs/codex-program/notes/family-rollout-mechanics.md` (Part 6), which found
`CompareSectionColumn` dead and named it the highest-leverage fix in the current blocker
backlog. This note is the fix itself: verified per surface against the real, unmodified
register functions, not against the name of the successor component alone.

**Pinned to:** commit `63a1fe3a` on `codex/m3-production-phase1`, 2026-08-05, working tree
clean at the start of this task. `lib/canonical-v2/native-producer/` contains one other
agent's untracked, in-progress file (`bare-citation-trigger-parser.js`), not opened, not
touched.

**Headline: fourteen surfaces were investigated. One clears. Thirteen stay blocked, on the
record, for two different reasons.** The obvious move, repoint all fourteen at
`UnifiedCompareSection` and watch the count drop by fourteen, is wrong, and demonstrably so:
twelve of the fourteen do not move at all under that edit, proven by calling the register's
own exported `liveProductVisibility` against cloned surface objects before touching anything
on disk. A thirteenth (`termination-rights-query-fields`) does move, mechanically, but was
left blocked anyway because moving it would be a hollow pass. Only
`termination-fee-query-fields` was actually repointed.

---

## Part 0: reconfirming the starting claim before building on it

```
grep -rn "CompareSectionColumn" . (excluding node_modules, .git)
```

Still exactly what the prior note found: one hit, `components/review-v2/CompareColumn.jsx:203`,
the symbol's own `export default function CompareSectionColumn({ section, column, onRetry })`
declaration. Confirmed again directly against the current file: `grep -n "canonical-v2\|require("
components/review-v2/CompareColumn.jsx` returns nothing at all, in a 1501-line file. The file
never imports any `lib/canonical-v2/` module and never calls `require` anywhere in its body,
by direct textual proof, not just an inspection of the top-of-file import block. This matters
for Part 2 below.

`UnifiedCompareSection` (same file, line 830) is what `pages/review/[id].js` actually imports
and renders (`pages/review/[id].js:55` imports it; `SectionBlock` calls it for every section
whenever compare or market mode is active, `pages/review/[id].js:147-165`). Its own header
comment states the design intent directly: "rendering the SAME section config through the
SAME ProvisionTable / MaeSection / DefinitionsSection / ElectionCard the primary column uses."

Re-running the register's own count command against the current register (before any edit in
this task):

```
node -e "... listM3ProductParityBlockers(...).length ..." -> 104
```

Matches the prior note's pinned figure exactly, confirming nothing drifted between that
investigation and this fix.

Querying every surface whose `source_locator` is exactly `"CompareSectionColumn"` against the
live register gives **17 surfaces, 17 distinct families or supplemental owners, one each,
no sharing**: 14 currently `state: PASS` / `disposition: NATIVE_COMPLETE` (the fourteen this
task is about), 3 currently `state: OPEN` / `disposition: FOLLOW_ON_REQUIRED`
(`structure-query-compare-fields` / MERGER_STRUCTURE_CLOSING,
`material-contracts-query-compare` / MATERIAL_CONTRACTS,
`general-covenants-query-compare` / GENERAL_COVENANT_ROUTER, not yet reached, evidence gate
first). **Correction to the prior note:** it recorded this as "15 families/owners" for the 17
surfaces. Counted directly off the register rather than repeated, the true figure is 17 for
17, a clean one-to-one map with no family carrying more than one of these surfaces. Does not
change anything substantive, the fourteen this task addresses are the fourteen the prior note
named, but the report should say what was actually counted rather than repeat a figure that
does not hold up.

---

## Part 1: "repoint the locator" is not one fix, it is two different fix shapes

The prior note's Part 6 simulation called `servingPathReachesLocator` directly, with a
hand-supplied hypothetical consumer, for exactly one surface
(`termination-fee-query-fields`), then generalised the result to all fourteen. That
simulation skipped the gate in front of it. `liveProductVisibility` calls
`provingProductConsumers(surface)` first, and only calls `servingPathReachesLocator` at all
if that returns a non-null consumer list. Whether it does depends on `nativeAdapterCandidates`,
which is not the same for all fourteen surfaces:

- `nativeAdapterCandidates` picks every `lib/canonical-v2/` file named anywhere on the surface
  as "the adapter." Only if none is named does it fall back to the surface's own
  `source_path`.
- Twelve of the fourteen name a real `lib/canonical-v2/<family>-product-projection.js` file in
  `evidence_paths`, so that file, not `CompareColumn.jsx`, is the adapter.
  `provingProductConsumers` then requires `CompareColumn.jsx` itself (the only candidate left
  once the adapter and test paths are excluded) to import and execute that exact file. It does
  not, for any of the twelve, ever (Part 0's grep). No value of `source_locator` can fix this:
  the surface never reaches `servingPathReachesLocator` at all, because `provingProductConsumers`
  returns `null` first.
- Two of the fourteen, `termination-fee-query-fields` and `termination-rights-query-fields`,
  name no `lib/canonical-v2/` file at all, only two test paths. `nativeAdapterCandidates` falls
  back to `CompareColumn.jsx` itself as the adapter. `provingProductConsumers` then needs a
  real, non-test, non-self consumer named in `evidence_paths`, and finds none (both test paths
  are excluded by construction), so the consumer-candidate list is empty and the surface fails
  at the same gate, for a different, narrower reason: a naming gap, not a wrong adapter. This
  is exactly the gap the prior note's Part 2 already diagnosed for `termination-fee-query-fields`
  specifically. It turns out `termination-rights-query-fields` has the identical evidence shape
  and the identical gap.

Verified empirically, not asserted, by cloning each of the fourteen real surface objects out
of `CURRENT_M3_FAMILY_PARITY_REGISTER` and calling the real, exported `liveProductVisibility`
(no reimplementation, no mock) under two variants: locator repointed to
`UnifiedCompareSection` alone, and locator repointed plus `pages/review/[id].js` added to
`evidence_paths`:

| surface_id | current | locator repoint only | locator repoint + named consumer |
|---|---|---|---|
| antitrust-query-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| appraisal-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| closing-conditions-query-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| dividends-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| dno-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| employee-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| financing-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| guaranty-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| misc-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| no-shop-query-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| proxy-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| tax-query-compare-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED |
| termination-fee-query-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | **NATIVE_VISIBLE** |
| termination-rights-query-fields | NATIVE_UNVERIFIED | NATIVE_UNVERIFIED | **NATIVE_VISIBLE** |

Twelve of fourteen do not move under either variant. The locator was never their problem, and
a locator-only fix for them would be a silent no-op dressed up as a correction. The remaining
two need both changes together, not just one, matching the naming-gap shape the prior note's
Part 2 already accepted for this family's `*-rendered-rows` surfaces.

---

## Part 2: the twelve that stay blocked, and why that is correct, not merely unfixed

For each of the twelve, `evidence_paths` names a real, correctly-built V2 projection module as
the adapter. Named for the record, each confirmed absent from `CompareColumn.jsx`'s import
list by the same direct grep as Part 0:

| surface_id | family | named adapter (never imported by CompareColumn.jsx) |
|---|---|---|
| antitrust-query-fields | ANTITRUST_REGULATORY_EFFORTS | lib/canonical-v2/antitrust-product-projection.js |
| appraisal-query-compare-fields | APPRAISAL_DISSENTERS_RIGHTS | lib/canonical-v2/tax-dividends-appraisal-product-projection.js |
| closing-conditions-query-fields | CLOSING_CONDITIONS | lib/canonical-v2/closing-conditions-product-projection.js |
| dividends-query-compare-fields | DIVIDENDS | lib/canonical-v2/tax-dividends-appraisal-product-projection.js |
| dno-query-compare-fields | DNO_INDEMNIFICATION | lib/canonical-v2/employee-dno-product-projection.js |
| employee-query-compare-fields | EMPLOYEE_MATTERS | lib/canonical-v2/employee-dno-product-projection.js |
| financing-query-compare-fields | FINANCING_COVENANTS | lib/canonical-v2/financing-guaranty-product-projection.js |
| guaranty-query-compare-fields | GUARANTY_FINANCING_PARTY | lib/canonical-v2/financing-guaranty-product-projection.js |
| misc-query-compare-fields | MISC_BOILERPLATE | lib/canonical-v2/remedies-misc-product-projection.js |
| no-shop-query-fields | NO_SHOP | lib/canonical-v2/native-producer/no-shop-product-parity.js |
| proxy-query-compare-fields | PROXY_MEETING_COVENANTS | lib/canonical-v2/proxy-meeting-product-projection.js |
| tax-query-compare-fields | TAX_MATTERS | lib/canonical-v2/tax-dividends-appraisal-product-projection.js |

Two independent reasons these should stay blocked, not one:

1. **Mechanical.** `provingProductConsumers` fails at the consumer-proof gate, before the
   locator is ever consulted (Part 1). This is a fact about the register's proof chain, true
   regardless of what `source_locator` names.
2. **Factual, checked separately, not merely inferred from (1).** Even setting the register
   mechanics aside and asking the underlying product question directly, does compare mode
   actually show this family's V2 data, the answer for every one of the twelve is still no.
   `grep -rli "CANONICAL_V2_.*_CARDS_FIELD\|isCanonical.*ServingEnabled"
   components/review/table-configs/ lib/canonical-v2/` returns exactly two files in the whole
   repository: `termination-fees.config.js` and `termination-fee-serving-source.js`. No other
   family's V1 config has the client-side switch `ROADMAP.md` describes as the thing that
   actually turns V2 data on for a family (`ROADMAP.md`'s own words: "that switch already
   exists and already works, for one family, termination fees"). `UnifiedCompareSection`
   dispatches through `config.selectRows(reviewDeal)` and `column.renderCell(row, ctx)`,
   exactly the same source-agnostic machinery the primary single-deal page uses, so wherever
   the primary page shows only V1 data today, compare mode shows only V1 data too, for exactly
   the same reason. Repointing these twelve, even if the register's mechanics permitted it,
   would assert "this family's V2 data is visible in compare mode" about data that is not V2
   in either mode, primary or compare, anywhere in the product today. That is the hollow side
   of the line this task asked about, and it is why these twelve are not simply "not yet
   fixed," they are correctly, currently, honestly blocked.

The real fix for these twelve is P9-shaped per-family wiring (a server-side gate plus a
client-side switch in each family's own `.config.js`), the work the prior note's Part 7
already specifies. That is out of scope for a register correction and out of scope for this
task.

---

## Part 3: the two that mechanically clear, and why only one was actually cleared

`termination-fee-query-fields` and `termination-rights-query-fields` share the identical
evidence shape (Part 1) and the identical mechanical result: repoint the locator to
`UnifiedCompareSection` and name `pages/review/[id].js` as the real consumer, and both flip to
`NATIVE_VISIBLE`. They were not treated the same, because the underlying reality behind them
is not the same.

**Termination fee has a real, if statically invisible, V2 serving mechanism.**
`components/review/table-configs/termination-fees.config.js` genuinely branches on
`isCanonicalTerminationFeeServingEnabled(reviewDeal)`, a flag stamped server-side by
`attachCanonicalTerminationFeeServing` (`lib/canonical-v2/termination-fee-serving-source.js`),
which `pages/api/review/[id]/cards.js` genuinely calls on every request, unconditionally
(gated only by its own env check inside the function, not by anything the client can see).
`useComparedDeals` (`components/review-v2/compareData.js`) fetches every compared deal through
this exact same `/api/review/<id>/cards` route, so whatever the primary review page would show
for a given deal's termination fee, compare mode shows the identical thing for that deal's
column, for both the primary deal and every compared deal, by construction, not by luck.

**Termination rights has none of this, anywhere.** `grep -rn "attachCanonical" lib pages`
finds exactly two attach functions in the entire repository:
`attachCanonicalV2Preview` (the ADR-001 dark bridge, gated by
`isDarkBridgeIntegrationEnabled()`) and `attachCanonicalTerminationFeeServing`, fee-specific
by name and by content. Nothing named `attachCanonicalTerminationRightsServing`, or anything
performing the equivalent role, exists. `termination-rights.config.js` carries no
`isCanonical...ServingEnabled`-shaped switch (confirmed by the same repository-wide grep as
Part 2). The only "canonical" signal reaching a termination-rights card at all is
`card.canonical_v2_lineage`, a property set by the projection functions themselves and
attached to cards exclusively through `attachCanonicalV2Preview`, the dark bridge, per
`pages/api/review/[id]/cards.js`'s own comment: "Canonical V2 dark-bridge preview
(pre-production activation phase)... read-time only." Ben's standing ruling, quoted in full in
the prior note, is unambiguous and directly on point: "A dark bridge is unreachable from any
served route, so a surface proved only by a bridge can never report as genuinely visible and
can never clear a blocker." Clearing `termination-rights-query-fields` would therefore assert
that V2 termination-rights data reaches a user in compare mode when, in fact, no V2
termination-rights data reaches a user through any path in the product today, compare or
otherwise, not even through the invisible-to-this-register HTTP-boundary route that makes
termination fee's case real. That is squarely the hollow side of the line. **Left blocked, on
purpose, with this record as the reason**, and pinned by a hostile test
(`tests/programme-gates/m3-family-parity-register.spec.js`) so a future edit cannot silently
repoint it without that test failing first.

**Repointed: `termination-fee-query-fields` only.** `source_locator` changed from
`CompareSectionColumn` to `UnifiedCompareSection`; `pages/review/[id].js` added to
`evidence_paths` alongside the two existing test paths. This is the same naming-gap shape the
prior note's Part 5 already accepted, without objection, for this family's
`termination-fee-rendered-rows` and `tail-fee-rendered-rows` siblings: name the real, already-
served consumer of a locator that was always genuinely reachable, nothing about the underlying
product code changed. `components/review-v2/CompareColumn.jsx` itself was not touched, at all,
in this task. Every existing test that exercises `CompareSectionColumn` or
`UnifiedCompareSection` as React components is unaffected, because their behaviour did not
change, only the register's record of what proves what.

---

## Part 4: the HTTP boundary question, stated explicitly

**Does this fix's proof survive the HTTP boundary the prior note flagged? No, and it was never
going to.** The register's proof for `termination-fee-query-fields`, after this fix, is: a
served page (`pages/review/[id].js`) imports and calls `UnifiedCompareSection`
(`FUNCTION_CALL_PATH`, the strongest of the register's own proof rules). That proof runs
entirely inside one module graph, the client-side one. It does not, and structurally cannot,
touch `isCanonicalTerminationFeeServingEnabled`, `attachCanonicalTerminationFeeServing`, or
`pages/api/review/[id]/cards.js`, the actual mechanism that decides whether a given render
shows V1 or V2 data. That mechanism lives in a separate module graph, reachable only over an
HTTP response, and is joined to the client only by a wire field-name convention no static
import walk, this one or any other, can see. This is not a new gap this fix introduced. It is
the exact gap the prior note's Part 5 already recorded against this family's
`*-rendered-rows`/`*-market-fields` siblings, extended here to one more surface of the same
family by the same register-authoring standard already in force. `NATIVE_VISIBLE` on
`termination-fee-query-fields`, honestly read, means "compare mode's rendering machinery
reaches a live page and would show whatever the primary page shows, V1 or V2." It does not
mean, and after this fix still does not mean, "V2 termination-fee data is confirmed reaching a
user in compare mode." Nothing in this register, for any of TERMINATION_FEE's surfaces, proves
that stronger claim, because nothing in it traces through
`pages/api/review/[id]/cards.js`, the one file that actually decides it.

**A way to make the proof survive the boundary, described, not built.** The register's model
already has one gate custom-built for a comparable break in the graph:
`QUERY_CONTAINED_ROUTE_FILES` names specific route files as excluded entry points because
their real logic runs behind a 503 stub. A serving-side counterpart could work in reverse: a
new, explicit evidence shape, say `server_stamped_field`, naming the wire field an
`attachCanonicalXxxServing`-style function stamps (`lib/queries/review-deal-wire.js`'s own
wire allowlist already enumerates these fields for a different reason) and the exact function
that stamps it. A surface using this shape would be proven only if (a) the named attach
function is itself proven reached from `pages/api/review/[id]/cards.js` by the existing
call-graph rule, exactly as any other consumer is proven today, and (b) the client-side config
genuinely branches on the exact field name the attach function stamps, checked by a new,
narrow AST rule rather than the existing intra-module locator rule (which has no way to follow
a value from a server file, through JSON serialisation, into a differently-named client
binding). This is a real mechanism change to the register itself, not a quick fix, and it is
explicitly not built here, per this task's brief.

---

## Part 5: the two `servedModules()` exclusion gaps, fixed

Both fixed exactly as the prior note specified, in
`lib/canonical-v2/native-producer/m3-family-parity-register.js`, both confirmed zero effect on
the 143 tracked surfaces both before and after, matching the prior note's own finding:

1. **Market-stats containment.** `pages/api/market-stats.js`'s entire body is
   `marketStatsContainedHandler` (`lib/market-stats-containment.js`), an unconditional 503
   `MARKET_STATS_DISABLED` responder, structurally identical to the seven routes
   `QUERY_CONTAINED_ROUTE_FILES` already excludes, but not itself named there. Added a
   `MARKET_STATS_CONTAINED_ROUTE_FILES` list, one entry, folded into the same `contained` set
   `servedModules()` already builds.
2. **Unconditional-redirect page.** `pages/query/whats-market/adhoc.js`'s entire
   `getServerSideProps` is `return { redirect: { destination: '/', permanent: false } }`. No
   request ever renders the component or reaches `lib/query/whats-market.js`, which it
   imports. Added a similarly narrow `UNCONDITIONAL_REDIRECT_ROUTE_FILES` list, one entry, to
   the same set. A general sweep for other `getServerSideProps`/`getStaticProps`
   unconditional-redirect pages is real follow-up work, correctly left undone here, an inline
   AST heuristic invented under this task's time pressure is a worse idea than the narrow,
   explicit, reviewable list this mirrors.

Both additions verified directly, not just by re-running the suite: `servedModules()` no
longer contains either file, `pages/review/[id].js` and `lib/market-metrics/index.js` (the
genuine, uncontained consumer of the real market-metrics code) remain served, and
`listM3ProductParityBlockers(...).length` is identical with and without these two lines,
isolated from the locator fix. Test coverage added directly to the existing
`'contained routes and design-guarded pages stay outside the real served set'` test in
`tests/canonical-v2-parity-serving-path.test.js`, the same test that already covers the
`QUERY_CONTAINED_ROUTE_FILES`/design-guard exclusions, rather than a new, separate test file.

---

## Part 6: should `CompareSectionColumn` be deleted

**No. Not in this task, and not safely yet at all.** Checked before recommending, per the
brief: after this fix, the register JSON still names `"CompareSectionColumn"` as
`source_locator` on **16** surfaces (17 minus the one repointed here). Each one is checked at
register-validation time by `exactLocatorResolves`, a literal regex test that the named symbol
still exists, textually, in `source_path`. Deleting the function would make every one of those
16 throw `PARITY_LOCATOR_NOT_FOUND` the moment `validateM3FamilyParityRegister` runs, which is
inside the main test suite, not an edge case. It is also named in
`docs/superpowers/specs/2026-08-03-family-representations-design.md:22` (the material-contracts
compare side table's design spec), and, unavoidably, throughout
`docs/codex-program/notes/family-rollout-mechanics.md`. Deletion is a real option once the
remaining 16 surfaces are individually resolved (repointed, retired, or otherwise dispositioned),
not before, and not as a side effect of this task.

---

## Part 7: blocker count, before and after, attributed

**Before this task: 104.** (`listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length`,
reconfirmed in Part 0 before any edit.)

**After: 103.** The entire movement is one surface: `termination-fee-query-fields`,
`NATIVE_UNVERIFIED` to `NATIVE_VISIBLE`, for the reasons in Part 3. No other surface's
recorded `state`, `disposition`, `source_locator`, or `evidence_paths` was changed. In
particular, `termination-rights-query-fields` was left exactly as it was, still
`NATIVE_UNVERIFIED`, still a blocker, on purpose (Part 3). The twelve in Part 2 were left
exactly as they were. The three pending surfaces (`structure-query-compare-fields`,
`material-contracts-query-compare`, `general-covenants-query-compare`) were not touched; they
are gated on their families' evidence reaching `state: PASS` first, unrelated to this fix, and
outside this task.

---

## Files changed

- `docs/codex-program/m3-family-parity-register.json`: `termination-fee-query-fields`'s
  `source_locator` and `evidence_paths` only, one surface.
- `lib/canonical-v2/native-producer/m3-family-parity-register.js`: `servedModules()`'s
  `contained` set now folds in `MARKET_STATS_CONTAINED_ROUTE_FILES` and
  `UNCONDITIONAL_REDIRECT_ROUTE_FILES`. No other function touched. No file outside this one
  register module was touched under `lib/canonical-v2/native-producer/`.
- `docs/codex-program/specification-manifest.json`: regenerated by its own script
  (`node scripts/verify-codex-program-spec.mjs --write`), not hand-edited. It hash-pins
  `m3-family-parity-register.json`'s exact bytes as one of six governance files; the diff is
  exactly that one file's new `byte_length` and `sha256`, nothing else moved.
- `tests/programme-gates/m3-family-parity-register.spec.js`: removed
  `termination-fee-query-fields` from the hostile "omits a real consumer" list (it no longer
  does), added an explanatory note for why `termination-rights-query-fields` deliberately
  stays in that list, added one new test pinning the corrected surface's proof, and widened
  the adversarial "attacked >= 100" bound to "attacked >= 99" (a real, attributed reduction of
  one, not a loosened check).
- `tests/canonical-v2-parity-serving-path.test.js`: the exhaustive
  `NATIVE_VISIBLE`/`DERIVED_VISIBLE` list now includes `termination-fee-query-fields`; the
  pinned blocker count is 103, with the movement explained inline; added assertions for the
  two new `servedModules()` exclusions to the existing containment test.
- `tests/canonical-v2-m3-certification-control.test.js` and
  `tests/canonical-v2-m3-certification-control-v2.test.js`: pinned blocker count updated to
  103, comments updated to record the new movement alongside the existing one.
- `components/review-v2/CompareColumn.jsx`: **not touched.** No product code changed in this
  task.

## Verification

```
CI=true npm test > /tmp/locator2.log 2>&1; echo "EXIT=$?"
-> EXIT=0
tests 7495, pass 7453, fail 0, cancelled 0, skipped 42, todo 0
```

7495 is 7494 (the pinned baseline at the start of this task) plus the one new test added in
Part 3. `node scripts/verify-codex-program-spec.mjs` (no `--write`) passes standalone. The
register's own validation (`validateM3FamilyParityRegister(CURRENT_M3_FAMILY_PARITY_REGISTER)`)
passes, exercised both directly and inside the full suite.

**Not this task's failure, identified, not assumed.** Two later re-runs of the exact same
command, taken to reconfirm this note's own figures before closing it out, came back
`EXIT=1`, both times on the identical pair of tests in
`tests/canonical-v2-phase1-authority-boundary.test.js` ("every production source changed from
the fixed Phase 1 base is classified exactly once" and "modified pre-existing production
sources do not add authority capabilities"), both times with the identical error:
`UNCLASSIFIED_CHANGED_SOURCE: lib/canonical-v2/native-producer/bare-citation-trigger-parser.js`.
Traced, not assumed: that test computes its changed-file set as
`git diff --name-only --diff-filter=ACMR <PHASE1_BASE_COMMIT> -- lib scripts pages components`
unioned with `git ls-files --others --exclude-standard -- lib scripts pages components`
(`tests/canonical-v2-phase1-authority-boundary.test.js:284-288`), and a changed file only
clears the gate if it either pre-existed at `PHASE1_BASE_COMMIT` (auto-classified
`MODIFIED_PREEXISTING`) or is named on an explicit new-source allowlist
(`lib/canonical-v2/phase1-authority-boundary-inventory.js`'s `EXPLICIT_NEW_SOURCE_CLASSES`).
`git status --porcelain` at both failing runs showed exactly two untracked files, both new,
both under `lib/canonical-v2/native-producer/`, neither created by this task:
`bare-citation-trigger-parser.js` and `native-extraction-run-citation-followup.js`. Neither is
on the allowlist yet (presumably still mid-edit, per this task's own file-safety constraint,
the same directory another agent owns and this task was told to stay out of). `git cat-file -e
<PHASE1_BASE_COMMIT>:lib/canonical-v2/native-producer/m3-family-parity-register.js` confirms
the one production-root file this task touched pre-existed at that base commit, so it
auto-classifies `MODIFIED_PREEXISTING` and cannot be the cause; every other file this task
changed is under `docs/` or `tests/`, outside the `lib/scripts/pages/components` roots this
gate scans at all. Left exactly as found, per the same file-safety constraint that applies
throughout this note: not this task's file, not this task's fix, flagged here rather than
patched. Re-run `CI=true npm test` after that agent's files are classified or committed to
confirm the suite returns to the clean state this note's own verification run recorded above.
