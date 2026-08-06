# Old docs sweep, status: COMPLETE

Read-only investigation of pages/admin/, pages/design/, docs/ARCHITECTURE.md,
docs/schema-migration/, docs/schema-shape/ and docs/superpowers/specs+plans/,
hunting for capability the current programme has built and forgotten, per the
brief. All 16 admin pages and all 5 design pages read directly and their
network calls traced against the live code; docs/core/PLAN.md (1266 lines)
and docs/ARCHITECTURE.md (410 lines) read in full as the baseline; two
background sweeps covered docs/schema-migration/+schema-shape/ and
docs/superpowers/specs/+plans/ (53 files) respectively, each independently
verifying its claims against code before reporting, folded in below.

## Executive summary, ordered by value

1. **A whole second, ~200+ team-hour, actively Ben-ruled programme
   ("Process Intelligence", P0-P12, with a named OPEN blocker) is invisible
   to PLAN.md** despite PLAN.md explicitly claiming to supersede the ledger
   that tracks it. See §1.6.
2. **23 API routes are hard-contained (503); PLAN.md's route-to-production
   only accounts for 6 of them.** The other 17 include the entire
   `/api/ingest/*` namespace and two admin pages disabled outright
   (candidates, ingest-runs). Concretely, this breaks the actual "add a new
   deal" page's two main modes today, and separately breaks the current
   review page's Correct tab. See §1.1, §1.5, and the corrections finding
   in §4.
3. **No-shop's "needs an architectural decision" (PLAN Stage 5E) is already
   decided and built**, a registered native producer path already
   resolved 42 real claims, the exact figure PLAN cites. See §1.7.
4. **A near-complete V1 cross-deal identity/reconciliation system, and a
   separate Ben-approved V1-vs-V2 validation system, both exist and are
   essentially absent from PLAN.md/DECISIONS.md/GRAVEYARD.md**, the former
   touched one day before PLAN.md's own snapshot. See §1.3, §1.8.
5. **A CI glob bug means six tests for the live V1 schema/validation layer
   never run**, in either `npm test` or CI. One-line fix. See §1.4.
6. **ARCHITECTURE.md's bug catalogue is stale in the reassuring direction:**
   five of five spot-checked defects (GAP-A, DATA-2, EXT-2, TAX-1, and
   the features/tags drift hazard) are already fixed, several with fixes
   that cite the same defect ID in code comments. See §3.
7. Three families PLAN's Stage 5E treats alike are in different states
   (Capitalisation already registered, contradicting PLAN's prose;
   Misc Boilerplate's missing decisions are already drafted in its own
   spec and just need asking; Merger Structure really is the most blocked
   of the three). See §2, §3.
8. Several admin pages already give Ben live visibility today,
   `/admin/processing-flow`, `/admin/taxonomy`, `/admin/gaps`,
   `/admin/reports`, with a consistent, deliberate pattern of reads
   working and writes gated behind three different containment mechanisms.
   See §4.
9. Nothing found dead in the admin/design set itself; one correction to
   GRAVEYARD.md's own entry 1 (undercounts the F6-F26 chain). See §5.

## Method log
- Baseline check: `lib/canonical-v2/native-producer/section-family-classifier.js`
  exists (28875 bytes, touched Aug 6), has real callers (native-extraction-run.js,
  candidate-resolution.js, 15 test files), and IS now referenced in
  docs/core/PLAN.md, OPERATING-RULES.md, CODEBASE-GUIDE.md. Confirms docs/core/*
  were updated post-failure (Aug 6) and are the CURRENT baseline, not sweep
  targets themselves. Using docs/core/PLAN.md as the reference to diff old docs
  against.
- docs/superpowers/ has two dirs: specs/ (45 files) and plans/ (8 files) = 53
  total, matching the task's "53" count.
- Read docs/core/PLAN.md (1266 lines, full) and docs/ARCHITECTURE.md (410
  lines, full) as baseline. Read docs/core/GRAVEYARD.md (888 lines, full),
  this is itself a very recent (Aug 6), very thorough dead-code archaeology
  exercise, already covering ~15 lib/canonical-v2 dead-code clusters with
  verified grep evidence. IMPORTANT: its own scope note says it did NOT cover
  pages/admin/, pages/design/, docs/schema-migration/, or docs/schema-shape/
  ("outside this exercise's file constraint") and only lightly checked
  docs/superpowers/specs/ (for supersession language only, not capability
  audit). So my sweep is complementary, not duplicate, but I should not
  re-report anything already in GRAVEYARD.md's 15 entries as if new.
- Side-investigation: ARCHITECTURE.md (dated 07-15) flags four V1 defects
  (TAX-1 invented canonical codes unchecked, GAP-A reprocess.js --apply
  silently not writing claims, DATA-2 correction misgraft on reprocess,
  EXT-2 quote-verification 80-char head-fallback hole). Checked all four
  against current code: **all four are already fixed** (GAP-A: rematerialize
  is now ON by default since Ben's 2026-07-23 sign-off, scripts/reprocess.js
  lines 35-42; DATA-2: MIN_MARGIN runner-up guard added,
  lib/parser-v2/reapply-corrections.js lines 25-54; EXT-2: HEAD_TAIL_SLACK
  tightening added, lib/verification.js quoteAppearsIn, comment explicitly
  cites "EXT-2"; TAX-1: registryHasTagCode/taxonomyHasCode flag-only gate
  added, lib/parser-v2/store-claims.js lines 43-51, 200-243). Conclusion:
  ARCHITECTURE.md's bug catalogue (TAX-1..4, EXT-1..5, DATA-1/2, PERF-1/2,
  A11Y-1..4, QRY-1/2/3) is measurably stale on at least these four and needs
  a fresh currency pass before being used as a live punch list, noted below,
  not treated as a live gap. This is the "mirror image" of the classifier
  failure: doc describes a problem that code has since solved, so no wasted
  rediscovery risk, just a documentation-hygiene note.
- Read all 16 pages/admin/ files and all 5 pages/design/ files directly,
  plus their backing pages/api/ handlers and lib/ modules where a page's
  behaviour depended on them. Ran two background sub-sweeps in parallel
  for docs/schema-migration/, docs/schema-shape/ and
  docs/superpowers/specs/+plans/; their verified findings are folded into
  the sections below, each marked where it came from a sub-sweep.

---

## 1. Capability that exists and is not being used

### 1.1 23 API routes are hard-contained (503), PLAN.md's Stage 7C/8 only
account for 4 of them, the whole `/api/ingest/*` pipeline and several
admin corpus-write routes have no disposition anywhere in the plan

`lib/broad-corpus-containment.js` freezes a registry of exactly 23 routes
that unconditionally 503 with `{code: 'ROUTE_CONTAINED'}`
(`createBroadCorpusContainedHandler`, lines 1-25, 65-76). Verified by
reading the file directly. The 23: `/api/admin/candidates`,
`/api/admin/ingest-runs`, `/api/annotations/propagate`,
`/api/admin/reprocess-cond`, `/api/admin/store-agreement`,
`/api/compare/features`, `/api/compare/rep-materiality`,
`/api/comparisons`, `/api/corrections/submit`, `/api/schema-coverage`,
`/api/corpus-stats`, `/api/corpus-stats-batch`, `/api/admin/ingest-batch`,
`/api/corpus-version`, `/api/ingest/agreement`, `/api/ingest/classify`,
`/api/ingest/extract-section`, `/api/ingest/extract-type`,
`/api/ingest/from-url`, `/api/ingest/run-all`, `/api/ingest/segment-v2`,
`/api/ingest/segment`, `/api/users`.

PLAN.md's Stage 7C ("Un-contain the four repaired routes") names only
`users.js`, `ingest/from-url.js`, `admin/reprocess-cond.js`, and
`saved-queries.js` (the last isn't even in this registry, it's contained
by a separate `lib/query/contained-routes/` mechanism per Stage 8C).
Stage 8A separately names `corpus-stats.js` and `corpus-stats-batch.js`
for restoration. That accounts for 6 of the 23. **The other 17, including
the entire `/api/ingest/*` namespace (agreement, classify,
extract-section, extract-type, run-all, segment, segment-v2) plus
candidates, ingest-runs, ingest-batch, store-agreement, annotations,
comparisons, corrections/submit, compare/features, compare/rep-materiality,
schema-coverage, corpus-version, have zero mentions anywhere in
docs/core/PLAN.md, GRAVEYARD.md, OPERATING-RULES.md or CODEBASE-GUIDE.md**
(checked by grep, all four files, zero hits). Confirmed only 4 of the 23
have a repaired handler waiting: `lib/broad-corpus/contained-routes/`
contains exactly `from-url.js`, `from-url-fetch.js`, `reprocess-cond.js`,
`users.js`, nothing for the other 19.

**Why this is probably lower-stakes than it first looks, for the 8
`/api/ingest/*` routes specifically:** `scripts/ingest-local.js` requires
`lib/parser-v2/classify.js`, `lib/parser-v2/extract.js` etc. directly
(confirmed by grep) rather than calling these HTTP routes, the real,
current ingest workflow is a locally-run CLI script that never touches the
contained API surface. So that part of the containment is very likely
inert dead HTTP surface, superseded by the CLI path, not a blocker.

**Why it still matters:** two live ADMIN PAGES are completely disabled
because of this, and PLAN.md's route to production never mentions either
one. `pages/admin/candidates.js` (EDGAR-discovered deal-candidate review,
nav-registry description "Review EDGAR-discovered deal candidates before
promotion into the corpus") and `pages/admin/ingest-runs.js` (ingest run
monitor + job retry) both hardcode `const *_ADMIN_CONTAINED = true;` at
the top of the file and short-circuit before even calling their (also
contained) APIs, showing only "temporarily read-only/unavailable while
authenticated corpus writes are being rebuilt." Git log on
`lib/broad-corpus-containment.js`: `8096bd6c fix(api): contain broad
corpus routes`, `ea714a5d fix(api): close users and zero-import market
stats`, `bc3b6267 fix(api): close service-client route actions`, a
deliberate security sweep, not neglect. But with `middleware.js` auth now
built and enforced (added 5 Aug, per PLAN.md section 3), the stated reason
("authenticated corpus writes are being rebuilt") may already be resolved
for at least the two admin-page-driving routes, nobody has revisited
whether they can now be un-contained. **If Ben currently discovers new
deal candidates via EDGAR as a distinct workflow from re-ingesting
existing corpus deals, that whole discovery-to-promotion pipeline is
invisible right now and the plan never decides its fate either way.**
**Resolved, not just a lead: the current production review page's Correct
tab is broken by this containment.** `pages/review/[id].js`, the live,
primary review page PLAN.md discusses throughout as rendering V1 next to
V2, imports and renders `components/review-v2/ClauseSidebar.jsx` (5
usages, confirmed by grep), which submits corrections to
`/api/corrections/submit`, one of the 23 contained routes. By contrast,
the plain `/api/provisions` PATCH route (not contained) is used only by
older/alternate pages: `pages/review-v1/[id].js`, `pages/frankenstein.js`,
`pages/provisions/[id].js`, `pages/admin/agreements.js`. **So the
correction mechanism on the page Ben actually uses today is currently
non-functional, while an older review UI's correction path still works.**
Nothing in PLAN.md flags this.

### 1.2 GAP-E residual-capture buckets: built, flag OFF, UI already wired
and waiting (confirms and extends the ARCHITECTURE.md GAP-E note)

`pages/admin/schema-loss.js` dimension "C" ("Feature residuals") is
already coded end to end: `FeatureResidualPane` component, a probe fetch
against `/api/admin/schema-loss/queue?dimension=C` that reads
`nextQueue.enabled`, and the tab is conditionally rendered only when that
comes back true (`residualCaptureEnabled` state, lines 22-41 of the page).
`lib/schema-loss/residuals.js` (`isResidualCaptureEnabled`) and
`scripts/schema-loss/audit-feature-residuals.js` both gate on
`RESIDUAL_CAPTURE_ENABLED`, currently unset everywhere (confirmed:
`grep -rn RESIDUAL_CAPTURE_ENABLED` finds only test files and the library
gate, no `.env`/config file setting it true anywhere, and
`pages/api/admin/schema-loss/queue.js:54` hardcodes the off-state note
"Residual capture is disabled"). Dimension C is explicitly read-only by
design (code comment: "P7 scope line: a read path, not a new write
requirement"). This is a fully-built escape hatch for "the model saw this
and nothing fit, flag it for review" sitting one env var away from being
visible, exactly as ARCHITECTURE.md §3 describes. Confirms the doc; adds
the fact that the front-end plumbing is further along than "flag exists",
the whole page/tab/component chain is done and waiting on the flag alone.

### 1.3 A near-complete cross-deal identity/reconciliation system for V1
already exists and was touched the day before PLAN.md's own snapshot date.
PLAN.md and ARCHITECTURE.md both describe this exact problem as open

[From background sub-sweep of docs/schema-migration/ + docs/schema-shape/,
independently verified detail cross-checked against my own reading of the
same admin pages above.] `lib/schema-shape/{normalize-value,parse-canonical,
reconcile-decide,registry-version,resolve-feature-key,similarity}.js` back
a real registry (`docs/schema-shape/canonical-registry-v1.md`,
`normalized-v1.json`, `reconciliation-queue.json`,
`reconciliation-log.jsonl`) with three routable admin pages,
`pages/admin/taxonomy.js`, `pages/admin/processing-flow.js`, and
`pages/admin/registry/reconcile.js` (all three read and described first-
hand in section 4 below), nine-plus merged PRs deep (#151, #156, #158,
#159, #161, #164, #165, #183, plus commit `b448f2b2`). Both PLAN.md and
ARCHITECTURE.md describe V1's cross-deal comparability as keyed on the
fragile `(provisions.type, provisions.category)` string pair with **no
real `concept_key` column and no plan to build one** (ARCHITECTURE.md §2,
"BEN-QUEUE item 8 records three options... none has been built yet").
Neither document mentions that a working canonical-key merge/rename/
promote registry, decision log, and reviewer UI already exists one
directory over. Most tellingly: this code is not stale, last touched by
commit `14c7b8f2` on **2026-08-05** ("feat: per-family V2 serving switch,
V1/V2 side-by-side, parity harness"), one day before PLAN.md's own
"updated today" (2026-08-06) stamp. Whether this V1 mechanism is the right
foundation for Canonical V2's identical, still-unsolved identity problem
is a design call for Ben, not something this sweep can settle, but
PLAN.md cannot make that call while not knowing the mechanism exists.

### 1.4 A CI blind spot: six test files for the load-bearing schema layer
never actually run

[From the background sub-sweep, independently verified.] `package.json`'s
`test` script is `node --test tests/*.test.js "tests/**/*.spec.js"`, the
first glob is non-recursive. Six real test files under `tests/schema/`
(`coverage.test.js`, `formatters.test.js`, `prompt.test.js`,
`registry-reconciliation-sync.test.js`, `registry-shape.test.js`,
`validation.test.js`) are never picked up, and confirmed by reading
`.github/workflows/ci.yml` directly: its only test step is `npm test`, so
CI doesn't run them either. This matters because these six files are the
test suite for `lib/schema/prompt.js` and `lib/schema/validation.js`,
which are confirmed live in the V1 write path (`lib/parser-v2/extract.js`
requires `../schema/prompt`; `lib/parser-v2/store.js` requires
`../schema/validation`, Zod-backed). The team flagged this themselves at
the time (`docs/schema-migration/phase-2-notes.md`: nested schema tests
"are run explicitly" as a manual step in that phase) but nothing since
made it permanent. PLAN.md's own procedural rule, "Before any step:
`CI=true npm test`... never pipe into `tail`, read the exit code", treats
a green run as authoritative; it is silently blind to this slice.
**This is a one-line fix** (`tests/**/*.test.js` instead of
`tests/*.test.js`) worth doing regardless of anything else in this report.

### 1.5 Concrete consequence of 1.1: the actual "add a new deal" page is
broken for its two main modes today

`pages/admin/agreements.js` ("Upload agreements", nav-registry's first
ingest item, 110KB, every one of its 11 network calls traced) is the real,
current UI for adding a deal to the corpus by hand (paste/upload text,
identify deal, extract provisions, preview/edit, commit). Traced every
network call (11 total). Two of its three extraction modes call contained
routes directly, unguarded: `extractionMode === 'segment'` calls
`/api/ingest/segment` (contained); the legacy mode calls
`/api/ingest/agreement` (contained). Both go through `safeFetch`, which
`throw`s on any non-2xx response (verified: reads the body, throws
`data.error` or `HTTP ${status}`), so clicking "Go" in either mode
surfaces a real, visible error once the 503 `ROUTE_CONTAINED` response
comes back. **Only the third mode, "parse-only" (`/api/ingest/parse-only`,
confirmed NOT in the 23-route containment registry), still works.** Separately,
every mode calls `/api/admin/store-agreement` first to persist the raw
text to `agreement_sources`, also contained, but that call is wrapped in
its own try/catch that only `console.warn`s on failure and continues, so
this failure is silent to the user even when the rest of the flow
succeeds; no `agreement_sources` row gets written via this page today
regardless of mode. None of this is mentioned in PLAN.md.

### 1.6 [HEADLINE] A whole second, actively-governed programme, "Process
Intelligence", with a named live blocker and a 200+ team-hour unbuilt
estimate, is invisible to PLAN.md despite PLAN.md explicitly claiming to
supersede the document that tracks it

[From background sub-sweep of docs/superpowers/specs/ + plans/,
independently verified.] PLAN.md line 8 states: "It supersedes
`ROADMAP.md`, `WORK-COMPLETED.md` and `EXECUTION-LEDGER.md`." But
`docs/codex-program/EXECUTION-LEDGER.md` (70,748 bytes, last touched
2026-08-05/06, i.e. actively maintained up to essentially the same
moment as PLAN.md itself) is the live governing ledger for
`docs/superpowers/plans/2026-08-02-process-intelligence-successor-plan.md`
(Status: FINAL, Ben-ruled 2026-08-02), tracking a P0-P12 staged
programme for the "process"/exclusivity domain
(`contracts/canonical-v2/successor/process/`, P1 COMPLETE;
`lib/canonical-v2/process-exclusivity-contract.js`, P3 COMPLETE for
exclusivity; the Metsera pilot, P5/P7 largely complete, this is the same
code GRAVEYARD.md entries 12 and 15 independently found and flagged
entry 15 as needing "a dedicated follow-up audit" since its own trace was
partial). This sub-sweep's finding directly answers that open question:
**the successor contract tree is confirmed in-progress, governed, and
Ben-ruled, not abandoned.** Critically, the ledger names **P8 as "OPEN,
the live blocker"** (a pre-freeze review, Ben approval, and a
`ContractFreezeAttestation` not yet issued) and estimates **P9
certification at 220-380 team hours and 15-22 Ben hours, not started.**
PLAN.md's body engages with none of this beyond one incidental mention of
`scripts/process-intelligence-baseline.mjs` at line 1119. Whatever the
right call is on sequencing this against the Stage 1-9 plan already
written, PLAN.md cannot make that call, and Ben cannot weigh it against
the rest of the roadmap, without knowing a 200+ hour, already-approved,
partly-built second programme exists and has a named blocker.

### 1.7 No-shop's "architectural decision" is already made and built,
PLAN.md's Stage 5E flags it as an open question

[From background sub-sweep, independently verified against
`docs/codex-program/notes/all-families-baseline-20260806.json` and
`lib/canonical-v2/native-producer/producer-prompt-registry.js`.] PLAN.md
Stage 5E: "No-Shop has no projection module and a separate pilot-era
architecture... It needs an architectural decision before the recipe
applies." A working, REGISTERED native-producer path already exists and
has already run successfully on real data, separate from the old F16-F26
certification pilot chain (GRAVEYARD entry 1, which DECISIONS.md item 13
deliberately declined to extend to other families). Verified:
`producer-prompt-registry.js:120` registers `NO_SHOP ->
buildNoShopProducerPrompt`; the 2026-08-06 baseline shows
`modiv-no-shop-20260806` status COMPLETE, resolved 42, the exact figure
PLAN.md's own section 3 cites for no-shop, confirming it already comes
from this new native path, not the old pilot. What remains is the
ordinary Stage 5D mechanical recipe (projection + serving source + switch
+ runtime test), not a fresh decision. Nuance worth keeping: PLAN.md is
still correct that no dedicated `*-product-projection.js` exists for
NOSOL claim types, that part of its description holds.

### 1.8 A separate, Ben-approved V1-vs-V2 cross-validation system exists
and is essentially invisible to PLAN.md, DECISIONS.md and GRAVEYARD.md

[From background sub-sweep, independently verified.]
`lib/canonical-v2/native-producer/v1v2-comparator.js` and
`lexical-disagreement-net.js` (7 test files reference them), plus
`scripts/nets-eligibility-report.mjs` (not in package.json but already
produced a real dated handoff,
`docs/archive/handoffs/NETS-ELIGIBILITY-2026-08-02.md`), implement specs
marked APPROVED/Ben-ruled
(`2026-08-01-v1v2-comparator-net-design.md`,
`2026-08-02-comparator-wiring-design.md`, merged via PRs #471/#472,
`2026-08-02-lexical-disagreement-net-design.md`,
`2026-08-02-v1-reclassification-design.md`). Confirmed
`scripts/review-parity-check.js` (the "equivalence harness" DECISIONS.md
item 13 names as the chosen standard) never references either module,
these are two genuinely independent mechanisms, not two names for one
thing. The v1-reclassification half is also built and live:
`lib/rubric.js` has the new split codes (`REP-T-STOCKAPPROVAL`,
`REP-T-GOVAPPROVAL`, `REP-T-40ACT`, `REP-T-ADVISERSACT`, `REP-T-INSREG`,
`REP-T-CFIUS`) with the five old codes marked `retired: '2026-08-02'` and
`superseded_by`, matching the spec's "Ben's confirmed rulings R1-R3"
exactly. PLAN.md cites `lexical-disagreement-net.js` exactly once (line
138) as a bare file-path pointer with no functional description;
DECISIONS.md and GRAVEYARD.md never mention any of these four specs or
modules at all despite this being real, merged, Ben-directed work.

### 1.9 Two smaller built-and-working mechanisms neither PLAN.md nor
GRAVEYARD.md mentions

- **Inline-decimal-heading sectionizer fix**
  (`2026-08-01-inline-decimal-headings-design.md`, its own words: "the
  highest-blast-radius component in the pipeline"). Verified built at
  `lib/canonical-v2/native-producer/deterministic-sectionizer.js:344`
  onward, citing the spec by filename, with a regression flag matching
  the design's byte-identical-on-QXO pin.
- **Component-rows mechanism** (`2026-08-01-component-rows-design.md`,
  "Approved: Ben"). Verified built at
  `lib/canonical-v2/source-structure.js:377`
  (`buildProvisionComponent`), the named prerequisite that let the
  open-world promotion programme's P1 slice (cap-table numerics) actually
  publish claims (see section 3 below, capitalisation is indeed
  registered and passing `wave_a`, consistent with this having landed).

## 2. Things the current plan does not know about

- **The Process Intelligence programme in full (section 1.6)**, the
  single largest gap found in this whole sweep by cost (200+ team hours,
  a named OPEN blocker) and the clearest case of PLAN.md's own
  superseded-documents claim not matching what a grep of those documents
  shows.
- **The open-world promotion programme, P1-P4, is only one-quarter
  finished and PLAN.md never mentions it at all**
  (`2026-08-02-openworld-promotion-program.md`). P1 (cap-table numerics)
  is complete and merged (section 1.9). P2 (qualifier kinds) is half
  done: `DISCLOSURE_SCHEDULE_CARVEOUT` is registered in
  `contract-bundle.js`, but its sibling `PERFORMANCE_ASSUMPTION` is not
  (grep-verified; the sub-sweep did not read the full 45KB P2 spec to
  confirm whether that gap is itself already acknowledged as deliberate,
  flagged as unverified). P3 (negative-assertion reps) and P4 (REIT/
  UPREIT family, concept `REP-T-OPU`) show no trace anywhere in
  `contract-bundle.js`. **P4 carries an explicit, unexecuted Ben ruling
  sitting in the spec text itself: "Ben ruled: design now."** PLAN.md
  gives no reader any way to know this roadmap or that standing
  instruction exists.
- **PLAN.md's Stage 5E collapses three families (Capitalisation, Misc
  Boilerplate, Merger Structure) into states they are not actually in**,
  see Contradictions below for Capitalisation and Misc Boilerplate
  specifically. Merger Structure, by contrast, really is in a clean
  no-projection-at-all state (`structure-mechanics.config.js` reads pure
  V1 legacy data, zero canonical-v2 import; `contract-bundle.js` has zero
  `STRUCT-` concept keys registered) even though
  `2026-08-03-family-merger-structure-closing-design.md` (76KB) already
  fully designs five of them, materially more blocked than Misc
  Boilerplate, a distinction PLAN's shared sentence for both families
  loses. No-Shop (section 1.7) already renders 7 of 12 parity-register
  surfaces today via the pilot-era path PLAN describes as a blocker,
  meaning a reviewer already sees some no-shop data now, not zero.
- **Misc Boilerplate's spec already drafts the two Ben decisions PLAN.md
  says are needed, and, as far as this sweep could find, nobody has
  actually asked Ben to rule on them.**
  `2026-08-03-family-misc-boilerplate-design.md` lines 284-334 ("Cross-
  family boundaries") documents two explicit pending decisions in detail
  (a REM-JURY/GOVLAW combined-heading dispatch collision with three named
  options, and a MISC-WAIVER standalone-concept flag) that do not appear
  anywhere in `DECISIONS.md`. So most of the "architectural decision"
  PLAN.md Stage 5E asks for is already drafted; what's missing is merging
  the registry additions and getting the specific ruling, not designing
  from scratch.
- Section 1.1 above (17 of 23 contained routes, incl. the whole
  `/api/ingest/*` namespace and two dead admin pages, with no disposition
  in PLAN.md). Additional colour from the background sub-sweep:
  `docs/API-ROUTE-CLASSIFICATION.md:156` already lists `/api/schema-coverage`
  (one of the 17) as "Fully contained", and its apparent consumer,
  `pages/review-v1/[id]/needs-review.js`, is a live, routable product page
  (gated by `useUser`), unconfirmed whether it silently degrades or
  computes client-side instead; flagged as unverified below.
- Section 1.3 above: the V1 canonical-identity reconciliation system.
- V1's extraction prompts and write-time validation now route through a
  `lib/schema/*` registry layer (`lib/schema/prompt.js`,
  `lib/schema/validation.js`, Zod-backed), confirmed live via
  `lib/parser-v2/extract.js` and `lib/parser-v2/store.js` requiring them
  directly. PLAN.md section 4's knowledge-location table lists V1 prompts
  as simply "`lib/parser-v2/extract.js`, 8,429 lines" with no mention of
  this indirection layer, a real gap for anyone reasoning about how V1
  actually builds a prompt or validates a write from PLAN.md alone.
  (ARCHITECTURE.md does partially cover this layer, so it is not unknown
  everywhere, just to PLAN.md.)

## 3. Contradictions with current beliefs

**ARCHITECTURE.md's bug catalogue is measurably stale, not a forgotten
capability, the mirror image of one.** Spot-checked 4 of its named defects
against current code: **all four already fixed**, each fix self-documenting
in code comments that cite the same defect ID ARCHITECTURE.md uses:
- **GAP-A** (reprocess.js `--apply` silently never wrote claims/cards):
  fixed, rematerialize now runs by default on `--apply` since "Ben's
  2026-07-23 sign-off" (`scripts/reprocess.js` lines 35-42, opt-out via
  `--no-rematerialize` now, not opt-in).
- **DATA-2** (correction misgraft risk, Jaccard with no runner-up margin):
  fixed, `MIN_MARGIN` (0.15) runner-up guard added
  (`lib/parser-v2/reapply-corrections.js` lines 25-54, comment names
  "misgraft mode" directly).
- **EXT-2** (quote-verification 80-char head-fallback let a fabricated tail
  through): fixed, `HEAD_TAIL_SLACK` tightening added
  (`lib/verification.js`'s `quoteAppearsIn`, comment explicitly names
  "EXT-2" and cites a 2026-07-15 corpus-wide measurement).
- **TAX-1** (invented/hallucinated canonical codes not checked against the
  taxonomy dictionary): a flag-only gate now exists,
  `registryHasTagCode`/`taxonomyHasCode` tally `invalidCodes`
  (`lib/parser-v2/store-claims.js` lines 43-51, 200-243; `lib/taxonomy.js`
  comments cite "TAX-1 survey 2026-07-18").

None of these four fixes, or the general staleness of ARCHITECTURE.md's
"§405-410 severity-ranked bug list" pointer to
`reports/CODEBASE-REVIEW-2026-07-15.md`, is flagged anywhere as
superseded. **A fifth instance, found by the background sub-sweep and
independently verified there:** ARCHITECTURE.md §3 states (as of
2026-07-15) that `features.generated.js` is missing 5 keys `features.js`
has, and `tags.js` is missing an entire 20-tag `SOLICITATION_ACT` family,
closing with "verify it landed before treating this section as
historical." It has landed: `docs/schema-shape/registry-drift-analysis.md`
diagnoses the same hazard and `tests/registry-generated-drift.test.js`
now guards it permanently, confirmed present at top level so it IS picked
up by `npm test`'s glob (unlike the `tests/schema/` gap in section 1.4).
Recommendation: before anyone treats ARCHITECTURE.md's bug list as a live
punch list, re-run the same spot-check across the rest of it (QRY-1/2/3,
TAX-2/3/4, EXT-1/3/4/5, DATA-1, PERF-1/2, A11Y-1..4), five of five
checked so far were already closed, so the prior is that most of the rest
are too.

**Capitalisation: PLAN.md's prose says the opposite of what its own
prescribed measurement returns, from the specs sub-sweep.** PLAN.md
Stage 5E: "Capitalisation is not in the parity register at all, despite
having the largest extraction prompt in the repository. Add it." At HEAD,
`docs/codex-program/m3-family-parity-register.json` already has
`family_id: "CAPITALISATION"` with `design_path` pointing at
`2026-08-02-p1-captable-numerics-design.md` and `wave_a`
(fixture_proof/lexical_net/producer/registry/resolver) all `PASS`. The
"largest extraction prompt" half is independently confirmed
(`capitalisation-producer-prompt.js` is 30,055 bytes, the largest of all
25, next is termination-fee at 21,418), so PLAN.md is right about the
prompt and wrong, today, about the register. The underlying product gap
PLAN is pointing at does still stand (capitalisation has no
`RENDERED_ROW` surface yet, only a `SIDE_TABLE` stub, so nothing renders
it on the review page), "Add it" was already done at the
family-registration level, just not at the product-surface level PLAN
actually cares about. Code supports "already registered"; PLAN's prose
does not.

**Misc Boilerplate: "cannot currently render anywhere" vs. the register's
own PASS/NATIVE_COMPLETE, from the specs sub-sweep, a concrete, named
instance of a failure mode PLAN.md already distrusts in the abstract.**
PLAN.md section 3 counts 14 Misc Boilerplate claims among "just under a
third of everything the sweep resolved [that] cannot currently render
anywhere." The parity register's own `MISC_BOILERPLATE` entry marks all
three of its product surfaces PASS/NATIVE_COMPLETE. Both are defensible
once separated: `misc-boilerplate.config.js` genuinely already renders
MISC-* data (it always has, since V1) and additionally accepts native V2
`ADMIN-*`/`REM-*` cards when `remedies-misc-product-projection.js` stamps
them, which is what earns the register's PASS. But that projection's own
claim-key vocabulary (`GOVERNING_LAW_STATE`, `FORUM_SELECTION_PROVISION`,
`ENTIRE_AGREEMENT_INTEGRATION`, `NO_THIRD_PARTY_BENEFICIARIES`) does not
exist anywhere in `contract-bundle.js` (grep-confirmed empty), so it can
never actually produce the 14 specific claims PLAN.md is counting as
stuck. This is a live, named instance of exactly what PLAN.md's own
Stage 5C already says about the register in the abstract ("The register
can go green while proving nothing a user would recognise"), not a new
problem, but now with a specific family and specific missing claim keys
attached to it.

**Minor contradiction, from the background sub-sweep:** ARCHITECTURE.md §1
frames `normalized-v1.json` + `reconciliation-log.jsonl` as "a static
one-time export... the live pipeline does not append to it on every
ingest," which is literally true of automatic ingestion. But a live,
human-operated write path (`pages/api/admin/reconcile/decide.js`) actively
mutates both files today, used as recently as commit `14c7b8f2`
(2026-08-05). Not a strict contradiction (automatic vs. deliberate-manual
is a real distinction) but the doc's framing reads as "basically archival"
in a way that undersells the live reconciliation admin UI in section 1.3
above.

## 4. Admin pages that would let the owner see things sooner

All 16 pages/admin/ files were read directly; findings below cover every
one of them.

**Three different containment mechanisms coexist across pages/admin/,
worth knowing which page is which:**
1. `process.env.VERCEL` returns `{notFound:true}` at build time, only
   `pages/admin/registry/audit.js` and `pages/admin/registry/reconcile.js`.
   Root cause (verified): their mutation APIs
   (`/api/admin/registry/{freeze,decision}`,
   `/api/admin/reconcile/{queue,decide}`) write JSON straight back to
   files under `docs/` on local disk via `fs.writeFile`, that only works
   against Ben's own writable checkout, not Vercel's ephemeral filesystem.
   These pages are real, working, and genuinely useful (registry
   merge-board with freeze workflow; reconciliation-queue decision UI with
   similarity-candidate suggestions), but ONLY when Ben runs the app
   locally, never on the deployed site.
2. A shared guard, `lib/admin/repository-artifact-access.js`
   (`blockVercelRepositoryArtifactRoute`), 404s the same class of
   file-writing API routes on Vercel without touching the page itself:
   `reconcile/queue.js`, `reconcile/decide.js`, `schema-loss/decide.js`,
   `schema-loss/rerun.js`, `audit/decision.js`, `registry/decision.js`,
   `registry/freeze.js`, `review-queue/[id]/resolve.js` (8 routes,
   confirmed by grep). So `pages/admin/schema-loss.js` and
   `pages/admin/review-queue.js` themselves load fine on Vercel (their
   read APIs aren't gated) but every decide/rerun/resolve action on them
   will 404 there.
3. The `lib/broad-corpus-containment.js` 503 registry (section 1.1 above),
   which disables `candidates.js` and `ingest-runs.js` outright, including
   on Ben's own machine, this one is unconditional, not Vercel-specific.

**`pages/admin/registry.js`** (not gated), a real merge-board over
`docs/market-registry/generated-v1.deduped.json` (the ~699-field query/
market-stats registry PLAN.md Step 8B says has a 104-field aliasing bug)
with per-field approve/reject decisions persisted to
`docs/market-registry/reviewer-state.json`, a suggestion engine
(`lib/registry-review-suggestions.js`), and a "freeze registry" action.
Worth checking (not yet done) whether this manual review workflow and
Step 8B's "fix it through the generator" instruction are the same effort
or two competing paths to the same registry.

**`pages/admin/processing-flow.js`** (works everywhere, `getStaticProps`,
no gate), renders `docs/schema-shape/provision-processing-flow.md` as a
stage diagram plus `docs/schema-shape/processing-flow-gaps.json` (a
structured, already-catalogued gap list) via a `GapPanel` component. This
already does exactly what task item 4 asks for re: gaps, Ben can see the
ingest-to-Claim flow and its known gaps today, on the deployed site. Self-
declared limitation in the page copy: "Last-run metrics below are static
placeholders, no metrics pipeline has been built yet," and a footer note
that the page cites an external "Master Brief § 2.9" planning document
explicitly **not checked into this repo** ("no link target exists yet"),
worth flagging since it implies a planning document exists outside version
control that this repo's own admin UI expects to eventually link to.

**`pages/admin/taxonomy.js`** (works everywhere, `getServerSideProps`),
renders `docs/schema-shape/provision-taxonomy-triple-model.md` next to
LIVE Supabase counts (real queries, not fixtures) for each of the design
doc's eleven node types (Deal, DealProfile, Section, Provision, Excerpt,
Claim, Attribute, Verbatim, Canonical, Provenance, Normalizer), derived
from `provisions.ai_metadata` at request time. Real, working, V1-only (no
Canonical V2 / claims-table awareness at all).

**`pages/admin/review-queue.js`** (works everywhere for reading; resolve
action is Vercel-gated per above), a genuine Ben decision inbox,
`docs/review-queue/*.json`, four kinds (canonical/destructive/unfreeze/
clarify), resolution appends a machine-readable line to `HANDOFF.md` for
"Codex pollers" to resume blocked PRs. Checked all 8 real entries on disk:
**all 8 are already resolved** (`resolved_by: "ben"`, dated 2026-07-07/08),
so the queue is not sitting on a missed backlog: it's evidence the
mechanism has genuinely been used and works end to end.

**`pages/admin/gaps.js`** (works for reads; `POST`/"Queue for CLI" and any
metrics-refresh are contained per `pages/api/admin/gaps.js` lines 530-537):
a live, per-deal view over real Supabase data (`fetchAllProvisions` etc.)
of uncovered-text gaps, needs-code items and parser-review items, each
with a formatted reference string for citing back into the codebase. Same
read-works/write-contained pattern as review-queue and schema-loss.

**`pages/admin/reports/index.js` + `pages/admin/reports/[kind].js`**
(fully live, API not contained, `pages/api/admin/reports.js` uses
`createReportsHandler()`, not the broad-corpus stub), a genuinely
well-built dashboard over a real DB table (`supabase/schema-06-run-
reports.sql`, created 5 Aug) of persisted CLI-producer runs, with
dedicated renderers for `ingest-qa`, `coverage-audit`, `rematerialize-
claims`, `mint-cards`, `demo-dryrun`, and a raw-JSON fallback for anything
else. Confirmed the write side is real too: `--report-db` is supported by
`scripts/ingest-qa.js`, `scripts/coverage-audit.js`,
`scripts/curation/mint-cards.js`, `scripts/demo-dryrun.js` (grepped
directly). This is exactly what task item 4 is asking for, Ben can watch
ingest-qa/coverage-audit/mint-cards output over time on the live site,
**provided the operator remembers to pass `--report-db`** when running
those scripts; nothing forces it. Unverified: `rematerialize-claims.js`
has a dedicated renderer on this page but did not show up in the
`--report-db` grep, worth a closer look at whether that script's flag
uses a different name or whether the renderer is ahead of the script.

### pages/design/* (5 pages, all gated preview-or-local by
`lib/design/route-guard.js`, per GRAVEYARD.md mechanism 3, none of these
are Ben-visible on production regardless of login)

- **`pages/design/index.js`**, a static design-token/component style
  guide (type scale, colour, spacing, primitive stories). No capability
  signal, cosmetic only.
- **`pages/design/canonical-v2-metsera-exclusivity-p8.js`** and
  **`canonical-v2-no-shop-f26.js`**, both read exactly as GRAVEYARD.md
  entries 1 and 12 already describe them: frozen-fixture "staging-only
  browser acceptance" pages, own page copy states "Inactive candidate. No
  production authority." Confirms GRAVEYARD, nothing new.
- **`pages/design/canonical-v2.js`** (27KB), "One row contract across
  four surfaces": an elaborate, entirely fixture-driven demo showing one
  Canonical V2 row (a Landos/AbbVie capitalisation bring-down, plus IOC
  capex, material contracts, no-shop and termination-fee rows) rendered
  identically through Review, Compare, "Corpus Context" (a market
  drilldown sidebar) and Query surfaces via a "shared row adapter"
  (`lib/canonical-v2/shared-row-adapter.js`) and a canonical query result
  builder (`lib/canonical-v2/query-result.js`). Checked whether this is
  pure design fiction or has live tendrils: **it does**,
  `components/review-v2/MarketColumn.jsx` (the `MarketMetricCell`/
  `MarketDrilldownSidebar` components this page exercises) is imported by
  the live `pages/review/[id].js`, and `query-result.js` is required by
  `lib/canonical-v2/legacy-query-mapper.js`, which GRAVEYARD.md's own
  "checked and ruled out" appendix already confirms is live, required
  directly by the real, navigable `pages/query/[kind]/[id].js`. So this
  design page is a genuine preview of a partially-already-wired
  cross-surface contract, not a hidden new system, but it is a good place
  for anyone picking up Stage 8 (market stats / search / compare) to see
  the intended end state rendered concretely before rebuilding any of it.
- **`pages/design/programme-decisions.js`** (26KB) + its 128KB data module
  `lib/programme-decision-console.js`, a genuinely elaborate interactive
  decision console: cards per decision (title, question, recommendation,
  consequence, evidence, clause examples), click-to-choose options,
  optional notes, persisted to `localStorage`
  (`corpus_programme_decisions_2026_08_03`), plus a "copy ruling markdown"
  export. Distinguishes `VALIDATED_RULING_CHOICES` (already recorded, with
  embedded provenance down to specific Claude message/turn IDs, this
  reads as a captured transcript of a real overnight ratification session)
  from `PENDING_USER_RATIFICATION_RULING_IDS` (recorded rulings with no
  primary provenance yet). Both files are dated 4 Aug, two days before
  PLAN.md's snapshot, and `docs/codex-program/DECISIONS.md` never
  references this console at all (zero grep hits). Read as: a real tool
  built for a specific overnight ratification exercise around 3-4 Aug,
  whose answers most likely fed into DECISIONS.md afterwards, rather than
  a live ongoing tool, but **not fully confirmed**, and worth Ben opening
  once locally (it is preview/local-gated) to check whether it still shows
  any items as genuinely pending; if it does, those are decisions that may
  never have made it into DECISIONS.md.

## 5. Genuinely dead, candidates for archiving

Admin/design pages: nothing confirmed dead in that set. GRAVEYARD.md
already covers the lib/canonical-v2 dead-code population, with one
correction from the specs sub-sweep:

**The F6-F15 QXO no-shop pilot cluster is the same dead pattern as
GRAVEYARD entry 1 (F16-F26) but is not in its list of "eleven modules",
a correction to fold in, not a new entry.** Thirteen modules:
`qxo-no-shop-copy-clock-f15.js`, `qxo-no-shop-exception-source-binding-
f6.js`, `qxo-no-shop-notice-semantic-closure-f6.js`, `qxo-no-shop-notice-
revision-f14.js`, `qxo-no-shop-notice-source-binding-f6.js`, `qxo-no-shop-
clock-parser-bridge.js`, `qxo-no-shop-inline-permission-f9.js`, `qxo-no-
shop-definition-scope-closure-f13.js`, `qxo-no-shop-notice-receipt-
f10.js`, `qxo-no-shop-notice-review-materialisation-f7.js`, `qxo-no-shop-
definition-control-f11.js`, `qxo-no-shop-definition-relationships-f8.js`,
`qxo-no-shop-reviewed-definition-graph-f6.js`, earlier steps (F6-F15) in
the same numbered chain as entry 1's F16-F26. Verified with GRAVEYARD's
own method (`grep -rl <basenames> pages/ components/ lib/queries/`
returns nothing): unreachable from any served path, same dead-but-
deliberate pattern. DECISIONS.md item 13's "not extended to any other
family" ruling plausibly covers these by the same logic as F16-F26, so
this is most useful as a correction appended to GRAVEYARD entry 1 (which
undercounts the chain's true size) rather than a fresh entry.

## Unverified leads

- Whether `pages/admin/registry.js`'s manual freeze/decision workflow and
  PLAN.md Step 8B's "fix through the generator" instruction are the same
  registry or two parallel, possibly conflicting paths.
- Whether `pages/review-v1/[id]/needs-review.js` (imports `lib/schema/
  coverage` directly) actually renders usable data given `/api/schema-
  coverage` is dead, or computes client-side instead, imports traced,
  data flow not fully traced.
- `docs/schema-shape/provision-processing-flow.md` gap G3 ("Normalizer has
  no manifest," proposing `lib/vocab/manifest.js`) is logged `status: open`
  in `processing-flow-gaps.json`, not checked whether it was quietly
  built since.
- A "master brief Section 2.9" is referenced independently in two places
  (`pages/admin/processing-flow.js`'s own footer copy, read directly by me;
  and multiple docs/schema-migration notes, per the sub-sweep) as an
  external planning document governing Phase 0-D, explicitly not checked
  into this repo. Neither I nor the sub-sweep located it or a document by
  that exact name. Worth asking Ben directly whether it still exists
  somewhere.
- The CI workflow has a `schema-parity` job gated on PRs touching
  `lib/schema/`, `lib/rubric.js`, `lib/vocab/`, `components/review/`, or
  `pages/review/`, running against real Supabase secrets, only its first
  ~30 lines were read; what it actually asserts is unconfirmed.
- No-shop's spec (section 1.7) is marked "AUDIT-AMENDED... re-audit of
  amended sections precedes build" but its own status line still says "NO
  recorded native runs exist," which the 2026-08-06 baseline contradicts,
  whether the required re-audit actually happened before that run is
  unconfirmed (a non-exhaustive check of docs/codex-program/notes/ and
  docs/acks/ found nothing either way).
- Whether P4 of the open-world promotion programme (REIT/UPREIT) has been
  designed somewhere outside the 45 catalogued spec files, no matching
  file exists among them despite Ben's "design now" ruling, but the search
  of docs/codex-program/notes/ was not exhaustive.
- The process-intelligence plan (section 1.6) names an external repository
  (`precedent-machine-process-design`) as its true source of record, stated
  in the plan itself as unreachable from this environment, whether a
  2026-08-02 amendment was ever committed there is unconfirmed; only that
  `EXECUTION-LEDGER.md` in this repo appears current.
