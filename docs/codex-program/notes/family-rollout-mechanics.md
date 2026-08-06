# What actually unblocks a product surface

Investigation only. No register, code, or fixture changed by this note. All
figures below were produced by running the real, unmodified
`m3-family-parity-register.js` against the live register, commands are
inline, not estimated.

**Pinned to:** commit `0d17ad00` on `codex/m3-production-phase1`,
2026-08-05. The working tree carries other agents' in-progress,
uncommitted edits to `candidate-resolution.js`,
`termination-fee-parse.js`, `anthropic-provider.js`,
`termination-fee-producer-prompt.js` and their tests (per-limb fee amount
and trigger-override work, both documented in sibling notes in this
directory). None of those files are read by the parity register or by
this investigation. `lib/canonical-v2/native-producer/deterministic-sectionizer.js`,
`docs/codex-program/notes/citation-scope-design.md`, and a new
recorded-response-replay test file were out of bounds per this task's
brief and were not opened. Re-run the commands below before trusting a
figure past this snapshot.

---

## Headline answer

**It is structural, not repetitive, but "structural" does not mean "one
fix." There are five distinct interventions behind the 104 blockers, and
the largest one (49 surfaces) genuinely is "repeat the same wiring step
per family," already named and planned as `ROADMAP.md`'s **P9**. The
second-largest correctable bucket (14 surfaces) is not a wiring problem at
all: it is a single dead symbol named as the proof target across 15
families, fixable once, everywhere, without touching a single
`lib/canonical-v2/` file.**

| # | What actually blocks the surface | Count | Fix shape |
|---|---|---:|---|
| 1 | Evidence/extraction hasn't reached `state: PASS` yet, a wave-a/review problem, not a serving problem | 32 | Family-specific analysis work, unrelated to this register's serving mechanics |
| 2 | Not yet assigned to any family or owner | 3 | Triage decision, prior to any serving work |
| 3 | Real, provable consumer sits behind a deliberately contained/sandboxed route | 1 | Governed by a standing ruling; not a normal fix, see Part 3 |
| 4 | **Registered locator is dead code** (`CompareSectionColumn`, superseded and unreferenced anywhere) | **14** | **One register correction, touches 15 families at once**, see "The second-highest-leverage finding" |
| 5 | Adapter is correctly a V1 file; its real, already-served consumer just isn't named in the surface's `evidence_paths` | 5 | Registry metadata edit, but see the caveat in Part 5, it proves less than it looks like |
| 6 | V2 projection module built and correctly named as adapter; **zero product code imports it** | 49 | Real wiring work, one recipe repeated per family, this is P9 |

32 + 3 + 1 + 14 + 5 + 49 = **104**.

The obvious plan Ben suspected was wrong, build 20 more
`termination-fee-serving-source.js`-style modules, is wrong for a
sharper reason than "some families aren't ready yet." **Sixteen of the
seventeen families in row 6 already have their V2 projection module
built and correctly cited as the adapter.** The missing ingredient in
every single one of those 49 surfaces, checked directly, is not a missing
V2 module, it's that no V1 file has ever been given a line of code that
imports it. That's a smaller, more mechanical, and more parallelisable
job than "build a serving source," and it is already named: `ROADMAP.md`
`### P9. Roll the remaining families`, currently unscoped pending exactly
this kind of pre-analysis ("This step gets its own plan once P1 proves
the mechanism... specifying it now would be guesswork").

---

## Part 0: verifying the shape of the problem, not trusting it

```
node -e "
const reg = require('./lib/canonical-v2/native-producer/m3-family-parity-register.js');
const { CURRENT_M3_FAMILY_PARITY_REGISTER: R, listM3ProductParityBlockers } = reg;
const blockers = listM3ProductParityBlockers(R);
const byVis = {};
for (const b of blockers) byVis[b.live_product_visibility] = (byVis[b.live_product_visibility]||0)+1;
console.log(blockers.length, JSON.stringify(byVis));
"
```

Result: **104**, `{"NATIVE_UNVERIFIED":68,"NOT_VISIBLE":32,"UNASSIGNED":3,"DERIVED_INTEGRATED_NOT_SERVED":1}`.
This matches `OPERATING-RULES.md`'s own pinned verification command exactly
(the file states "It must be 104 unless real work moved it", confirmed
unmoved).

Cross-tabbing `disposition` against `live_product_visibility` across all
104 shows a **perfect 1:1 correspondence**, every `NATIVE_COMPLETE`
blocker reads `NATIVE_UNVERIFIED`, every `FOLLOW_ON_REQUIRED` blocker
reads `NOT_VISIBLE`, the one `APPROVED_DERIVED` blocker reads
`DERIVED_INTEGRATED_NOT_SERVED`, all three `UNASSIGNED` surfaces read
`UNASSIGNED`. Nothing is bucketed unexpectedly.

143 total tracked surfaces = 138 across 22 families + 3 supplemental
owners, plus 5 in `unassigned_product_surfaces` (2 of which are
non-semantic review holds, filtered out of the blocker count, hence 3,
not 5, unassigned blockers).

---

## Part 1: what `servedModules()` actually treats as "served"

`servedModules()` (`m3-family-parity-register.js:712-740`) builds one set,
cached for the process lifetime:

1. **Universe.** Every `.js`/`.jsx`/`.mjs` file under `pages/`, `lib/`,
   `components/` (`productSourceFiles()`, `listProductSourceFiles()`,
   line 600-618).
2. **Entry points.** Files starting with `pages/`, this includes
   `pages/api/*`, Next.js API routes count as pages, **excluding**:
   - any file listed as a value in `QUERY_CONTAINED_ROUTE_FILES`
     (imported from `lib/query-containment.js`; 7 routes:
     `/api/query/run`, `/api/query/interpret`, `/api/query/field-options`,
     `/api/query/demo-set`, `/api/query/kinds`, `/api/saved-queries`,
     `/api/canonical-v2/query`);
   - any file whose raw text matches `/design\/route-guard|designPreviewEnabled/`
     (`designGuarded()`, line 720-728), a page gated by the design
     route guard 404s in production, so nothing it imports gets serving
     credit.
3. **Walk.** From those entry points, a real AST-based transitive closure
   (`servedModuleClosure`, line 688-708): parse each file with acorn
   (JSX lowered via sucrase first when acorn rejects it), extract every
   `import`/`require`/dynamic-`import()`/re-export specifier via a real
   parse (`moduleImportSpecifiers`, line 644-668, not text matching),
   resolve relative (`.`-prefixed) specifiers against the file universe,
   and recurse. Non-relative specifiers (`node_modules`, absolute) are not
   resolved and don't extend the set.
4. **Fail-closed by construction.** An unparseable file contributes no
   edges and does not join the reachable set (`unparseable`, tracked
   separately, see `unparseableServedCandidates()`). The design comment
   at line 674-687 states this is deliberately monotone toward
   *under*-serving: a module the parser can't read can never manufacture
   visibility.

This is a same-repository, same-process static import graph. It has no
way to observe two things that are structurally invisible to it, and both
turned out to matter for this investigation (Part 6).

**Two gaps found in this walk, both already documented once each, one by
this programme, one newly found here:**

- **Already known, independently reconfirmed with a concrete example.**
  `ROADMAP.md` §2.5: *"a second [over-report channel] remains, because the
  walk models only query containment and so counts the market routes as
  served despite being stubs."* Confirmed the asymmetry exists exactly as
  described: `lib/market-stats-containment.js` defines
  `marketStatsContainedHandler`, an unconditional `503
  MARKET_STATS_DISABLED` responder, and `pages/api/market-stats.js`'s
  entire body is `export default marketStatsContainedHandler`, a live
  stub route. `servedModules()` only excludes `QUERY_CONTAINED_ROUTE_FILES`
  members; there is no equivalent `MARKET_STATS_CONTAINED_ROUTE_FILES`
  exclusion, so `pages/api/market-stats.js` is currently a valid,
  unexcluded entry point. **Traced whether this currently corrupts any of
  the 143 tracked surfaces: it does not.** `pages/api/market-stats.js`'s
  only import edge is to its own containment stub, it does not import
  `lib/market-metrics/*`. The real market-metrics code
  (`lib/market-metrics/adapter.js`, `registry.js`) is legitimately served
  via `lib/market-metrics/index.js` ← `pages/review/[id].js`, a genuine,
  uncontained page, independent of the stub. So the asymmetry is real and
  the walk should still be fixed (a future surface named against a module
  reachable *only* through `market-stats.js` would be wrongly counted),
  but it is not live today. Fix, not applied here per this task's
  file-safety constraint (see "What I did not change"): add a
  `MARKET_STATS_CONTAINED_ROUTE_FILES`-equivalent set to the `contained`
  union at line 715.
- **New, not previously flagged anywhere I found.** `pages/query/whats-market/adhoc.js`
  is a live page whose entire `getServerSideProps` is an unconditional
  redirect:
  ```js
  export function getServerSideProps() {
    return { redirect: { destination: '/', permanent: false } };
  }
  ```
  No real user request ever renders this component, every hit
  redirects to `/` server-side before the component body runs. It is not
  in `QUERY_CONTAINED_ROUTE_FILES`, and it doesn't match the
  `designGuarded` text pattern (no route-guard import, just a bare inline
  redirect), so `servedModules()` currently treats it as a completely
  normal, live entry point, and everything it imports,   `lib/query/whats-market.js` (`resolveWhatsMarketIntent`), reads as
  served. **Checked whether this currently corrupts anything: it does
  not.** The one registered surface naming `lib/query/whats-market.js`
  (`appraisal-query-intent`) carries `disposition: APPROVED_RETIRED`,
  which short-circuits to `RETIRED_NOT_RENDERED` before the
  consumer/serving checks ever run (`liveProductVisibility`,
  line 1354). So again: real gap in the walk, demonstrated with a live
  file, zero current impact on the 143 tracked surfaces. Worth a
  dedicated sweep for other `getServerSideProps`/`getStaticProps`
  unconditional-redirect pages before relying on `servedModules()` for a
  family whose only real consumer turns out to be one.

---

## Part 2: TERMINATION_FEE's four `NATIVE_UNVERIFIED` surfaces, individually

All eight `TERMINATION_FEE` surfaces, current computed state:

| surface_id | source_path | source_locator | disposition | `liveProductVisibility` |
|---|---|---|---|---|
| `termination-fee-rendered-rows` | `components/review/table-configs/termination-fees.config.js` | `terminationFeesConfig` | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| `tail-fee-rendered-rows` | `components/review/table-configs/tail-fee.config.js` | `tailFeeConfig` | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| `termination-fee-market-fields` | `components/review/table-configs/tail-fee.config.js` | `marketSubterms` | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| `termination-fee-query-fields` | `components/review-v2/CompareColumn.jsx` | `CompareSectionColumn` | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| `termination-fee-render-derived-values` | `lib/termf.js` | `percentage_of_equity` | APPROVED_DERIVED | DERIVED_VISIBLE (passing) |
| `termination-fee-query-derived-values` | `lib/query/derived-fields.js` | `feePctOfDealValue` | APPROVED_DERIVED | **DERIVED_INTEGRATED_NOT_SERVED** |
| `termination-fee-wave-b-query-mechanics` | `lib/query/serving-registry-v1.json` | `/entries/345/key` | EVIDENCE_ONLY | EVIDENCE_VISIBLE (passing, lower bar) |
| `termination-fee-wave-b-market-mechanics` | `components/review-v2/CompareColumn.jsx` | `collectOffMarketEntries` | EVIDENCE_ONLY | EVIDENCE_VISIBLE (passing, lower bar) |

All four blocked surfaces fail at the **same gate, for the same root
cause**: `provingProductConsumers()` returns `null`, no candidate
consumer at all, not a weak or ambiguous one. Traced precisely, not
inferred, using a local re-implementation of the unexported
`provingProductConsumers`/`nativeAdapterCandidates` helpers (verbatim
copies of the source, calling the real exported `consumerExecutesAdapter`)
against the real register:

- **None of the four names a `lib/canonical-v2/` file anywhere in
  `source_path` or `evidence_paths`.** Because
  `nativeAdapterCandidates()` only treats a `lib/canonical-v2/` file as
  the "adapter", and falls back to the surface's own `source_path`
  otherwise, the adapter for all four defaults to the surface's own V1
  file (`termination-fees.config.js`, `tail-fee.config.js` twice,
  `CompareColumn.jsx`).
- **Each surface's `evidence_paths` names only two test files**
  (`tests/canonical-v2-termination-product-parity.test.js`,
  `tests/canonical-v2-termination-real-fixture-replay.test.js`). Test
  paths are excluded from consumer candidacy by construction
  (`isGovernanceOrTestPath`). Once the surface's own file is excluded
  (it's the adapter, can't prove itself) and the two test paths are
  excluded, the consumer-candidate list is **empty**, `provingProductConsumers`
  returns `null` before any AST proof even runs. This is a naming gap in
  the register entry, not an AST failure.

**The real consumers exist and are already served, they're just not
named:**

- `terminationFeesConfig` and `tailFeeConfig` are both imported and used
  (referenced beyond the import line, inside a top-level array literal)
  by **`components/review-v2/sectionList.js`** (`REVIEW_V2_CONFIGS`,
  lines 22-23 import, 46-47 usage) and separately by
  **`pages/review-v1/[id].js`** (lines 155-156, 195-196). Both files are
  confirmed members of `servedModules()`.
- `CompareSectionColumn` is a different story, see "The
  second-highest-leverage finding" below. Naming a real consumer for it
  will not fix it, because the locator itself is dead code.

**Simulated the "obvious fix" (name the real consumer) directly against
the real, unmodified `servingPathReachesLocator`, without editing
anything, to see whether naming evidence alone is sufficient:**

```
termination-fee-rendered-rows,  consumer=sectionList.js  → proven:true  (MODULE_BINDING_PATH)
tail-fee-rendered-rows,         consumer=sectionList.js  → proven:true  (MODULE_BINDING_PATH)
termination-fee-market-fields,  consumer=sectionList.js  → proven:false (LOCATOR_NOT_EVALUATED_ON_A_REACHABLE_PATH)
termination-fee-query-fields,   consumer=pages/review/[id].js → proven:false (LOCATOR_BINDING_UNREACHABLE)
```

So of TERMINATION_FEE's four blockers, **two** (`termination-fee-rendered-rows`,
`tail-fee-rendered-rows`) are pure evidence-naming gaps, adding the real
consumer to `evidence_paths` is sufficient, mechanically, today. The
other two need more:

- `termination-fee-market-fields`'s locator, `marketSubterms`, is not the
  `tailFeeConfig` binding itself, it's a local variable computed inside
  a helper (`tail-fee.config.js:228`, `tailMarketSubterms(id)`) that
  feeds a property of the config object, and that property
  (`selectRows`, `tail-fee.config.js:247`) is only ever invoked as
  `config.selectRows(reviewDeal)` through a **generic, computed member
  call** in `ProvisionTable.jsx:158` and `CompareColumn.jsx:194,276`.
  `sectionList.js` never calls `tailFeeConfig.selectRows(...)` by that
  literal name, it just puts the object in an array. The register's
  intra-module call-graph rule (`locatorServingProof`,
  `m3-family-parity-register.js:1227-1264`) can prove a *binding* is
  referenced; it cannot see through "this object flows through a generic
  prop, and a method on it gets called via `config.selectRows(...)`
  later, elsewhere." That is not a wiring gap and not a naming gap, it
  is a structural limit of the locator rule against this (extremely
  common, shared by every `*.config.js` in the app) dispatch pattern.
- `termination-fee-query-fields`'s locator, `CompareSectionColumn`, fails
  for a third, unrelated reason, see next section.

---

## Part 3: is `termination-fee-query-derived-values` the same problem?

**No, different gate, different mechanism, and already governed by a
standing ruling that forbids the obvious-looking fix.**

`termination-fee-query-derived-values` (`lib/query/derived-fields.js`,
locator `feePctOfDealValue`) is `DERIVED_INTEGRATED_NOT_SERVED`, which
means `provingProductConsumers()` **succeeded**, its named consumer,
`lib/query/natural-language.js` (named in `evidence_paths`), genuinely
imports and executes `derived-fields.js`'s export. The AST proof is real
and passes. It fails one gate later:
`consumers.every((c) => servedModules().has(c))` is false, `lib/query/natural-language.js` is not in `servedModules()`.

Traced why: `lib/query/natural-language.js`'s only importer in the
product tree is `lib/query/contained-routes/interpret.js`, which is the
real logic behind the route entry `pages/api/query/interpret.js`, **one of the seven entries in `QUERY_CONTAINED_ROUTE_FILES`.** That entry
route is deliberately excluded from `servedModules()`'s entry points, so
nothing reachable only through it, including `natural-language.js` and,
transitively, `derived-fields.js`'s consumer, can ever read as served.
This is not an oversight; `m3-family-parity-register.js:670-682`'s own
comment names this exact case: *"A route file listed in
`QUERY_CONTAINED_ROUTE_FILES` answers ROUTE_CONTAINED, so code only
reachable through it is integrated but unserved."*

Two standing rulings in `OPERATING-RULES.md` already settle this
surface specifically, cite them rather than re-derive:

> **`termination-fee-query-derived-values` stays unserved until Query
> actually serves (2026-08-05).** This one row stays at "integrated but
> not served" until the roadmap's search-activation step is genuinely
> active in preview. It is not to be reclassified early merely because a
> consumer technically imports the underlying module.

> The seven-route search containment must not be quietly narrowed to
> make a blocker count improve; any change to which routes count as
> contained is a decision in its own right. Note that the containment is
> not merely bookkeeping: the contained route calls a full-corpus fetch
> behind a concurrency cap and a circuit breaker, so lifting it is a
> capacity question as well as a parity one.

So: same register (`m3-family-parity-register.js`), same author intent
("served" means "a live, non-contained route reaches it"), but a
categorically different fix. TERMINATION_FEE's other four surfaces need
evidence/wiring/locator corrections that live entirely inside this
register's authoring. This one needs a **product feature** (Query search
activation) to ship first, and is explicitly off-limits to "fix" any
other way. Do not put it in the same work order as the other four.

---

## Part 4: MATERIAL_CONTRACTS as the second worked example, a different failure mode entirely

All eight `MATERIAL_CONTRACTS` surfaces are `state: OPEN`,
`disposition: FOLLOW_ON_REQUIRED`, computed visibility `NOT_VISIBLE`
across the board. This family has not reached the point where
`provingProductConsumers`/`servingPathReachesLocator` run at all, `liveProductVisibility`'s very first check, `surface.state !== 'PASS'`,
already returns `NOT_VISIBLE` before the serving-mechanics gates are ever
evaluated (`m3-family-parity-register.js:1350`).

This is the cleanest possible contrast with TERMINATION_FEE: three of
MATERIAL_CONTRACTS's eight surfaces already correctly name
`lib/canonical-v2/material-contracts-product-projection.js` as evidence
(`assigned-material-contracts`, `material-contracts-query-compare`,
`material-contracts-market-fields`), so once they clear the evidence gate
they will very likely land in the same "V2 module built, zero consumer
wires it in" bucket (row 6 of the headline table), but they cannot be
worked on for serving purposes *yet*, because the underlying evidence
record for the surface itself hasn't been approved to `PASS`. `ROADMAP.md`
names MATERIAL_CONTRACTS as one of four families (with
GENERAL_COVENANT_ROUTER, NO_OTHER_REPS_FRAUD, REPRESENTATIONS) whose
*analysis*, not serving, is the actual gap, these four together account
for 27 of the current 32 `NOT_VISIBLE` blockers (the other 5, `CAPITALISATION` (1) and `MERGER_STRUCTURE_CLOSING` (4), appear to be
recent register additions not yet reflected in that specific `ROADMAP.md`
paragraph; the discrepancy is small and doesn't change the structural
picture).

These same four families are `ADR-001`'s "four dark bridges"
(`general-covenants-dark-bridge.js`, `no-other-reps-fraud-dark-bridge.js`,
`representations-dark-bridge.js`, plus material-contracts sharing the
same construction pattern via `review-preview-assembly.js`). Ben's own
ruling on them is unambiguous and directly on point for anyone tempted to
route MATERIAL_CONTRACTS through that bridge to make its count move
faster:

> Flattening into the legacy card shape is a preview and equivalence
> scaffold. It is never a serving path and never a persistence path...
> Native serving must consume the new system's projections directly, not
> bridged legacy cards. This is what actually clears a blocker.
>
> A dark bridge is unreachable from any served route, so a surface proved
> only by a bridge can never report as genuinely visible and can never
> clear a blocker; it is structurally incapable of becoming the serving
> path.

**So the recipe for MATERIAL_CONTRACTS is not "build a serving source
sooner."** It is: (1) finish the legal/extraction analysis that gets each
surface's evidence to `state: PASS` (a review-and-approval workflow, nothing
to do with this register's serving mechanics); (2) only then does it
become eligible for exactly the same recipe as TERMINATION_FEE's row-6
surfaces (Part 6). Commissioning "wire the projection module in" work for
MATERIAL_CONTRACTS today would be wasted, there's nothing to wire into a
surface that isn't even state-`PASS` yet, and the dark bridge that
already exists for it is explicitly, permanently disqualified from
counting.

---

## Part 5: the metadata-gap bucket (row 5, 5 surfaces), what it proves, and what it doesn't

`termination-fee-rendered-rows`, `tail-fee-rendered-rows`,
`termination-fee-market-fields`, `termination-rights-rendered-rows`,
`termination-rights-market-fields`: adapter defaults to the surface's own
V1 file (no `lib/canonical-v2/` adapter named), real consumer exists and
is served, just isn't named. Two of the five (the `*-rendered-rows` pair)
are simulated-confirmed to flip cleanly to visible if `evidence_paths`
is corrected (Part 2). The other three (`*-market-fields`) additionally
need the generic-dispatch locator problem addressed (Part 2's third
bullet), the same underlying limitation likely recurs for other
families' `*-market-fields` surfaces whose locator is a token computed
inside a `selectRows()`-style method rather than a directly-referenced
top-level binding; this was verified concretely for two surfaces
(`tail-fee.config.js`, `termination-rights.config.js`'s
`marketSubterms`), not swept across all families.

**The caveat that matters most for anyone about to commission this as
"quick fixes":** even where this gate cleanly passes, it proves only that
the V1 rendering machinery executes on a served page, not that V2 data
is what a user sees. Read `termination-fees.config.js:491-573` directly:
`terminationFeesConfig`'s row builders are **explicitly, deliberately
source-agnostic** ("the row builders below... stay completely unaware of
which source fed them"). The actual V1-vs-V2 switch,
`isCanonicalTerminationFeeServingEnabled(reviewDeal)`, reads a flag
stamped server-side, in a **completely separate module graph**
(`pages/api/review/[id]/cards.js` → `lib/canonical-v2/termination-fee-serving-source.js`
→ `attachCanonicalTerminationFeeServing`), joined to the client config
only by an HTTP response payload and a shared field-name convention
(`lib/queries/review-deal-wire.js`'s wire allowlist). No AST import-graph
walk, this one or any other, can trace across that boundary. None of
TERMINATION_FEE's eight registered surfaces, even at full health, tests
whether `pages/api/review/[id]/cards.js` (the one file that actually
imports the real V2 projection and could feed it to a user) is on a
reached path, the two surfaces that name a canonical-v2 file at all
(`termination-fee-wave-b-*`) are `EVIDENCE_ONLY`, which bypasses consumer
proof entirely by design. This isn't a bug in the mechanism so much as a
gap in what TERMINATION_FEE's own surface catalogue chose to test, flagged
in full under "Watch for this," below, since it's the sharpest form of
the fooling question this task asked me to chase.

Separately and explicitly: Ben has already ruled that the runtime
activation flag itself is not, and must never be treated as, a
precondition for "served" in this register's sense (`OPERATING-RULES.md`,
*"A gate is not a precondition"*), so the fact that
`isPermittedCanonicalV2Runtime()` currently excludes all production
environments is **not** a defect in these surfaces' path to
`NATIVE_VISIBLE`/`DERIVED_VISIBLE`; that's an intentional, separate,
later-stage control (production cutover), and this register was never
meant to track it. I raise it only to close the loop for whoever
reads "NATIVE_VISIBLE" and assumes it means "live for a real deal in
production today", it doesn't, and was never meant to.

---

## Part 6: the second-highest-leverage finding, a dead locator behind 15 families

Cross-checked every occurrence of `source_locator: "CompareSectionColumn"`
across the whole register:

```
node -e "... filter all surfaces where source_locator === 'CompareSectionColumn' ..."
→ 17 surfaces total, 15 families/owners, 13 currently NATIVE_UNVERIFIED,
  4 currently NOT_VISIBLE (not yet reached)
```

`CompareSectionColumn` is `components/review-v2/CompareColumn.jsx`'s
**default export** (line 203), a real, substantial, well-written
component. It is referenced **exactly once in the entire repository**:
its own `export default function CompareSectionColumn(...)` declaration.
Not from any page, any component, any test, anywhere else, 
```
grep -rn "CompareSectionColumn" . (excluding node_modules)
→ one hit: components/review-v2/CompareColumn.jsx:203 (the definition itself)
```

The file's own comment at line 228 explains why: *"r14: unified compare
table, Ben: 'Use the same left column rows from the table and don't
repeat them!'"*, `CompareSectionColumn` was the pre-redesign,
one-column-per-deal renderer. It was superseded by `UnifiedCompareSection`
(the component `pages/review/[id].js` actually imports and renders,
confirmed at line 55 of that file) and never deleted.

**Consequence: 14 of the current 104 blockers, spanning ANTITRUST,
APPRAISAL, CLOSING_CONDITIONS, DIVIDENDS, DNO, EMPLOYEE_MATTERS,
FINANCING, GUARANTY, MISC_BOILERPLATE, NO_SHOP, PROXY_MEETING, TAX,
TERMINATION_FEE and TERMINATION_RIGHTS, cannot ever reach `NATIVE_VISIBLE`
no matter how completely their V2 projection module gets wired in,
because the specific symbol the register checks for reachability is
dead code, unrelated to whether V2 data is served.** No per-family wiring
work touches this. It needs exactly one correction, made once: repoint
these surfaces' `source_locator` (and likely `source_path`, confirm the
right symbol lives in `CompareColumn.jsx` still, probably
`UnifiedCompareSection` itself or something it directly, statically
calls) at the component that is actually rendered today. Simulated the
replacement directly against the real `servingPathReachesLocator`
(non-mutating call, no register edited): a locator of
`UnifiedCompareSection` itself, once a real consumer is named, resolves
`MODULE_BINDING_PATH`/`FUNCTION_CALL_PATH` cleanly, the same shape that
already works for every `*-rendered-rows` surface pointed at its own
config's top-level binding. I did not verify that the *specific*
`market`/`compare` data displayed by `UnifiedCompareSection` is
family-correct for all 15, that's a product-correctness question for
whoever owns the fix, not a register-mechanics one.

This single correction is higher leverage than any per-family wiring
effort in this backlog: it unblocks the *path* to visibility for 17
surfaces (14 blocked today, 3 more once their families clear the evidence
gate) with one change, to one file, checked once, compared to 49
separate per-family wiring efforts for row 6. It should be commissioned
first, ahead of P9's per-family work, because 12 of the 49 row-6
surfaces are *also* on this dead locator, wiring their V2 projection in
before fixing the locator would leave them still blocked, for a reason
the wiring work can't see or fix.

---

## Part 7: the P9 recipe, what a new family actually needs

`ROADMAP.md` already names this workstream (**P9: roll the remaining
families**) and already documents the one family where it's been done in
full, in almost exactly this language:

> What actually decides whether a family shows up is a small switch,
> built once per family: extraction produces the facts, projection turns
> them into rows, and the switch turns that family on for the review
> page, next to the old system's version of the same row. That switch
> already exists and already works, for one family, termination fees.
> Building the same switch for each remaining family is P9's job.

Confirmed by reading the real, working implementation end to end. The
recipe, concretely, with the exact files:

1. **Projection** (already exists for 16 of 20 non-dark-bridge families,    not part of this recipe, just the prerequisite). A
   `lib/canonical-v2/<family>-product-projection.js` module that turns
   resolved claims into row-shaped data. `lib/canonical-v2/termination-product-projection.js`
   is TERMINATION_FEE's.
2. **Server-side per-family gate and card source** (the missing piece for
   49 of the 68 `NATIVE_UNVERIFIED` blockers). A module, one per family,
   that:
   - reads a family-specific env var through the **shared**
     `isPermittedCanonicalV2Runtime()` gate (`lib/canonical-v2/feature-flags.js`)
, never a bespoke check, this is what keeps every family off in
     production on the same two independent signals;
   - for each deal it has real pinned/extracted data for, reconstructs
     canonical cards by calling the family's own real projection
     function (never a hand-rolled shortcut);
   - is called from a real, live, non-contained API route
     (`pages/api/review/[id]/cards.js` is termination fee's; check
     whether the same route can carry a new family or a family-specific
     equivalent is needed) via an `attachCanonicalXxxServing(reviewDeal, ...)`-shaped
     function, stamping the result onto the wire payload under clearly
     own-property-checked field names (never inherited/prototype-chain
     readable, `Object.prototype.hasOwnProperty` checks throughout
     `termination-fee-serving-source.js`, copy the idiom).
   - `lib/canonical-v2/termination-fee-serving-source.js` is the worked
     example, 26KB, heavily commented, including a real production
     incident writeup (Vercel file tracing dropping a `fs.readFileSync`
     at request time, the fix was to `require()` a generated JS module
     instead of reading a file at runtime; a new family's serving source
     should follow that pattern from the start, not rediscover it).
3. **Client-side switch, side-by-side render** (the wiring half of the
   same 49-surface gap, this is the part that must be *added to*, not
   built new, since the V1 config file already exists for every family).
   `termination-fees.config.js:491-573`'s `selectRows()` is the worked
   example: check the own-property boolean flag on `reviewDeal`, branch
   between `CANONICAL_V2_<FAMILY>_CARDS_FIELD` and the legacy card set,
   **never merge the two** (the file's own `PARTITION, NEVER MERGE`
   comment, combining a canonical and legacy card in one row silently
   produces an order-dependent hybrid of correct and stale figures), and
   pass whichever set won to the existing, source-agnostic row builders
   unchanged.
4. **Register the surfaces correctly**, this is the step row 5/6 of the
   headline table show is currently skipped or done incompletely even for
   TERMINATION_FEE itself: name the **real** V2 dependency (the serving
   source module, or the API route that calls it) as evidence on at
   least one surface per family, not just the V1 config file in
   isolation. Today, *no* TERMINATION_FEE surface actually proves
   `termination-fee-serving-source.js` is on a reached path, see Part 5.
   A new family's rollout should not repeat that gap: either accept
   explicitly that the `*-rendered-rows`/`*-market-fields`/`*-query-fields`
   surfaces only ever prove "V1 plumbing reaches a page" (and say so), or
   add a surface that actually chains through the server-side gate.
5. **Equivalence harness before retiring anything.** `scripts/review-parity-check.js`
   is termination fee's. Ben's ruling: the old system's display for a
   family is never removed until this proves the new one agrees or is
   demonstrably better, on real data, not a version-limit check, an
   actual side-by-side diff a human reads.

**What this recipe is not**: it is not "build a serving source from
scratch" for most of the 17 families in row 6, step 1 is already done.
It is steps 2-4, and step 2 is genuinely new code per family (the
`attachCanonicalXxxServing` wrapper + wiring it into a route); step 3 is
a small, mechanical, well-precedented edit to a file that already exists
for every family (`*.config.js`'s `selectRows`); step 4 is a register
correction that's easy to get wrong exactly the way TERMINATION_FEE's own
authoring got it wrong.

---

## Part 8: intervention type × surface count (the table Ben asked for)

| Intervention | Surfaces | Families/owners affected | Parallelisable across agents? |
|---|---:|---|---|
| Approve underlying evidence to `state: PASS` (not a serving problem) | 32 | MATERIAL_CONTRACTS(8), GENERAL_COVENANT_ROUTER(7), NO_OTHER_REPS_FRAUD(7), REPRESENTATIONS(5), MERGER_STRUCTURE_CLOSING(4), CAPITALISATION(1) | Yes, but it's legal-taxonomy/extraction-review work, not register-mechanics work, different skill, different routing |
| Triage into a family/owner | 3 | indirect-advisers-fees-expenses-config, indirect-approvals-votes-config, indirect-conditions-m-config | Trivially, one small task |
| Fix the dead `CompareSectionColumn` locator | 14 (+3 pending) | 15 families/owners at once | **No**, one change, one file, do it once, first |
| Name the real, already-served V1 consumer in `evidence_paths` | 5 | TERMINATION_FEE(3), TERMINATION_RIGHTS(2) | Yes, small, mechanical, but see Part 5's caveat on what it actually proves; 3 of 5 additionally need the generic-dispatch locator problem addressed |
| Wire the built V2 projection module into its intended V1 consumer (P9) | 49 | 17 families, ~3 surfaces each, sharing 2 consumer files per family typically (`<family>.config.js` + `CompareColumn.jsx`) | **Yes**, this is the genuinely repeatable, parallelisable recipe (Part 7), ~30 distinct wiring edits behind the 49 surfaces, not 49 independent ones |
| Behind a contained route, governed by standing ruling | 1 | TERMINATION_FEE | No, blocked on Query search activation shipping, explicitly not to be worked around |

**Answer to "is it structural or repetitive": both, cleanly separated.**
Fix the dead locator once (highest leverage, touches 15 families,
correctly a single small task, do it before anything else). Then run P9
(49 surfaces, genuinely one recipe, safely parallel across agents, one
agent per family is reasonable once the recipe above is handed to them
verbatim). The 32-surface evidence backlog and the 3 unassigned surfaces
are separate work entirely, don't route them to the same agents doing
P9, they need different judgement (legal/extraction review, not
register-mechanics wiring). Leave the 1 contained-route surface alone.

---

## Watch for this: how the register could be fooled

Three distinct mechanisms, in descending order of how directly they bear
on the register's own proof logic (as opposed to being scope
clarifications that are already settled elsewhere):

**1. A surface can prove "V1 rendering machinery reaches a page" while
proving nothing about whether V2 data is what's shown, and nothing
forces a surface's author to name the real V2 dependency.** This is not
hypothetical or narrowly about termination fee. `nativeAdapterCandidates()`
falls back to a surface's own `source_path` as "the adapter" whenever no
`lib/canonical-v2/` file is named anywhere in its evidence. That fallback
is explicitly designed for `DERIVED_VALUE` surfaces ("there is no
separate V2 projector to point to, so the derivation function itself is
what must have a real consumer", a reasonable, narrower claim for a pure
computation). But the code applies the same fallback to `RENDERED_ROW`,
`MARKET_FIELD` and `QUERY_FIELD` surfaces too, and for a family whose real
serving mechanism is a source-agnostic client dispatcher fed by a
server-stamped wire payload (confirmed to be TERMINATION_FEE's actual
architecture, and per `ROADMAP.md`/`ADR-001` language, the intended shape
for every family under P9), **no evidence-completeness fix inside that
fallback can ever close the gap**, because the true dependency (the
serving-source module, reached only via a separate server-side API-route
module graph, joined to the client only by an HTTP payload and a field-name
convention) is structurally invisible to a same-process static import
walk. Concretely: today, *zero* of TERMINATION_FEE's four blocked
surfaces name `termination-fee-serving-source.js` or
`pages/api/review/[id]/cards.js` as evidence, and even fixing all four the
"obvious" way (Part 2/5) would leave that true, a fully green
TERMINATION_FEE family would still not have a single surface that traces
end-to-end through its actual V2 serving path. **If P9 is executed
per this recipe for 17 more families without fixing this, the register
will accumulate dozens of `NATIVE_VISIBLE` surfaces whose proof is
genuinely real (a served page really does execute that code) but whose
connection to V2 data is entirely unverified by anything in this
register.** That's not a hypothetical fooling, it's the predictable
result of applying the existing recipe at scale. Recommend: either (a)
require at least one surface per family to name the server-side gate
module as evidence and prove it's reached (probably impossible under the
current mechanism without a second, HTTP/wire-aware proof type, a real
mechanism change, not a quick fix), or (b) explicitly document, next to
the register, that `RENDERED_ROW`/`MARKET_FIELD`/`QUERY_FIELD`
`NATIVE_VISIBLE` means "the rendering plumbing is live," not "V2 data is
confirmed reaching a user," so nobody downstream over-reads the count.

**2. `servedModules()`'s entry-point exclusion list is incomplete in two
concrete, demonstrated ways** (Part 1): the market-stats containment
route isn't modelled (already flagged in `ROADMAP.md`, reconfirmed here
with the exact file and line, and confirmed to have zero current impact),
and unconditional-redirect pages like `pages/query/whats-market/adhoc.js`
aren't excluded by any existing filter (newly found here, also zero
current impact, but the mechanism is real and undefended). Neither
currently corrupts any of the 143 tracked surfaces' status, verified,
not assumed, but both are live, demonstrated ways a future surface's
`evidence_paths` could name a consumer that reads as served while no real
user ever reaches it.

**3. Already correctly self-defended, cited for completeness rather than
as a new finding.** `OPERATING-RULES.md` records that Ben has already
ruled the runtime activation flag (`isPermittedCanonicalV2Runtime`) is
*not* a serving precondition in either direction, toggling it doesn't
manufacture visibility, and its being off in production doesn't
undermine a genuinely-proven serving path. The register's own gate-3
rule (locator must sit on the *executed* path, not merely an *imported*
module) is the one gate the code's own comments say "exists specifically
to withdraw over-claimed visibility", traced its use across all 104
blockers (Part 0's classification): it currently accounts for **zero**
of them (all 68 `NATIVE_UNVERIFIED` blockers fail at the earlier
no-consumer gate, not this one), meaning it hasn't yet had to do its
job on this dataset, not that it doesn't work. The dead-locator finding
(Part 6) is a different kind of gap, not the gate failing to withdraw a
false claim, but 15 families' worth of surfaces never having had a
correct claim to test in the first place.

**What I deliberately did not do:** change any surface's recorded state,
disposition, or evidence to test these findings against the live
register. Every simulation above (Part 2, Part 6) calls the real,
exported `servingPathReachesLocator`/`liveProductVisibility` functions
directly with hypothetical consumer arrays, a pure function call,
nothing written to disk, the actual register JSON untouched throughout.

---

## What I did not change, and why

`m3-family-parity-register.js` was not edited, despite finding two
concrete, small, well-evidenced fixes to `servedModules()`'s exclusion
list (market-stats containment, unconditional-redirect pages) that would
have zero effect on the current 104 count. Reasons: (1) this file
computes `CURRENT_M3_FAMILY_PARITY_REGISTER`/`CURRENT_M3_FAMILY_PARITY_STATUS`
at module load and is required across the entire test suite, any change
needs the full suite run against it, and other agents are mid-edit in
the same directory (`native-producer/`) this session; (2) per this
task's brief, this is exactly the class of "matcher/verification change"
the project's own routing guidance says should be spec'd and reviewed
before it's produced, not patched inline during an investigation; (3) a
change with zero measured effect on the current count is safe to defer
without cost. Both fixes are specified precisely enough above (exact
file, exact line, exact missing exclusion) for a follow-up task to apply
and test them directly.

The register JSON (`docs/codex-program/m3-family-parity-register.json`)
was not edited. No surface's `state`, `disposition`, `source_locator`,
`source_path`, or `evidence_paths` was changed, including the
`CompareSectionColumn` finding, which would have been the single highest-value
one-line-per-surface fix available, deferred because 17 surfaces across
15 families is exactly the kind of change that should be reviewed once,
carefully, rather than made mid-investigation, and because I did not
independently verify the *correct* replacement symbol for all 15 families
(only that `UnifiedCompareSection` is what's actually live and that the
locator-proof shape would work against a top-level binding like it).

---

## Verification

```
CI=true npm test > /tmp/rollout.log 2>&1; echo "EXIT=$?"
→ EXIT=1
ℹ tests 7479, pass 7434, fail 3, cancelled 0, skipped 42, todo 0
```

**Not this task's failure, identified, not assumed.** All 3 failures are
in `tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js`
(`resolution: exactly 3 claims resolve`, `resolution: review_queue is 16
items...`, `validation: all 3 resolved claims publish clean...`), all
asserting on `NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE` resolution counts
and reason-code composition. `git status --porcelain` at the time of this
run:

```
 M lib/canonical-v2/native-producer/candidate-resolution.js
 M tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js
?? docs/codex-program/notes/family-rollout-mechanics.md
```

`candidate-resolution.js` is the exact file `docs/codex-program/notes/trigger-override-fix.md`
(this directory, same session) records editing, `handleFeeTriggerCandidate`, adding `TRIGGER_NOT_ASSERTED`/`TRIGGER_CORROBORATION_DISAGREES`
reason codes, and that note's own verification section confirms it
re-ran only a targeted set of test files (its own family's resolution
test, the live-Modiv-repair test, the candidate-resolution test), not
this specific replay-pinning test. The diff in the failure output shows
exactly the shape that change produces (new `TRIGGER_NOT_ASSERTED`
reason-code bucket appearing, trigger counts redistributed across
`TRIGGER_UNCORROBORATED` buckets) against a test file that is itself
mid-edit and uncommitted, not yet reconciled to the new behaviour. This
task's own change is one new, untracked markdown file, not a code or test
file, and cannot affect test execution or these assertions. Flagging this
collision here rather than in the file the other agent owns, per this
task's file-safety constraint.
