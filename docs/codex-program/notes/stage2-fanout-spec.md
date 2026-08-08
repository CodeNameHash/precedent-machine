# Spec: correct the record, unblock onboarding, rebuild Stage 2 as a fan-out ladder

**STATUS as of 2026-08-06: partly implemented and partly superseded. Read this
box before anything below it.**

| | |
|---|---|
| **Part D (the ladder)** | **Superseded — do not implement from it.** Landed in `docs/core/PLAN.md` Stage 2, in a different and better shape. The Part D text far below still describes the old extraction-only ladder under its old step letters (2A–2E), and those letters no longer match PLAN.md's 2A–2H. It is kept as the reasoning that produced the design, not as an instruction. PLAN.md is authoritative. |
| **Part B (false claims)** | Partly done. The four claims Stage 2 rested on are corrected in PLAN.md. The broader sweep of PLAN.md's remaining claims is not done. |
| **Parts A, C, E, F** | Not started. Consolidation, the ~110 findings, onboarding, and the capability rulings are all still outstanding, and this document remains the plan for them. |
| **B-zero (test glob)** | **Not done.** `package.json`'s `.test.js` glob is still non-recursive and 29 test files still do not run. Every "proves it is done" in PLAN.md Stage 2 is checked by that instrument. |

**How Part D changed when it landed, and why.** This document specified an
extraction-only ladder: prove extraction across families, then across
documents. That was wrong in the same way the plan it replaced was wrong, one
layer down. Proving extraction generalises across 15 documents while the write
path is proven on two hand-built per-deal slices (QXO F28, Metsera) is a sample
of one, twice — the exact error the ladder exists to prevent.

So Stage 2 as implemented is **vertical**: every rung runs
`extract -> validate -> write -> serve -> confirm it renders`. It gained a new
Step 2B that builds the bridge in both directions, because a run's output was
terminal — nothing functional read it — and no serving source read from the
database at all. Steps 4B and 5A were rescoped from construction to hardening
as a result.

Four systems traces since this document was written also changed its factual
basis. See `docs/core/CODEBASE-GUIDE.md` section 12, which is now the record of
how the system actually works, and section 9, which corrects the claim that the
schema had never been executed.

---

Status: draft for adversarial audit, not yet approved.
Scope: all six parts (A–F). C and F were originally deferred; they are
folded in here because several of their findings change what gets built,
not just what gets written down. That judgement is defended in
"Findings that change the build" below — it is the reason this document is
long.

Source evidence, all produced this session against commit `8d2d992`:
`core-docs-audit.md`, `plan-vs-roadmap.md`, `stage2-draft-v1.md`,
`findings-hdr-ab.md`, `coverage-matrix.md`, `aa-ad-register.md`,
`ac-olddocs-register.md`, `classifier-questions-closed.md`. These live in a
session scratchpad that does not survive the session, so anything relied on
is restated here. Findings are cited by their register IDs (`F-AA-01`,
`F-OLD-07`, …) so the originals can be traced if the scratchpad is
recovered.

**Several register findings were re-checked and are wrong as written; so
were three claims in this spec's own earlier drafts.** Both sets of
corrections are in the build-impact section, marked as such. The spec's own
errors are left visible rather than quietly fixed, because the failure mode
this whole exercise exists to correct is confident false claims being
believed on the strength of who stated them — and this document produced
three of its own inside two days, including one presented as a direct
verification that was a 3× undercount, and one that ordered an implementer
to "fix" a header that was already correct.

The audit that caught them was adversarial and ran against the code, not
against this text. Nothing here should be trusted further than that: the
spec is a set of claims to check, not a record of what is true.

---

## Standing rulings (Ben, this session)

These four answers are decisions, not suggestions. Everything below is
written to them.

1. **Process Intelligence is parked, not subsumed and not parallel.**
   "We'll rebuild process intelligence at some point — just stick all of
   that stuff in a folder for later." So `EXECUTION-LEDGER.md` and the
   P0–P12 material move to a dedicated parked folder with an intent-to-
   rebuild note. It does not get PLAN.md steps, and it is not archived as
   dead. PLAN.md's supersession claim is still wrong and still gets
   deleted — parked is not superseded.
2. **Ben's two M3 auto-pass conditions get wired before the ladder runs.**
   Part F rules on `v1v2-comparator.js`, the conditions go into the runner,
   `nets-eligibility-report.mjs` gets fixed. Part D does not start until
   they do.
3. **Nothing old or arbitrary is binding unless it does better.** Given
   against the contained-routes question, and applied as a general
   principle throughout: an existing constraint has to justify itself on
   present merit. Containment, pin conventions, step numbering, and the
   shape of any inherited process are all in scope. Where this spec keeps
   an old thing, it says why.
4. **The document ladder targets 10–15 documents, then hands off to
   corpus certification.** Not all 40 in the ladder — the per-round re-run
   cost grows quadratically, and 10–15 drafters is enough to make a
   generalisation claim credible. Part A move 2's certification step covers
   the remainder.

---

## Findings that change the build

Most of the ~110 findings are documentation staleness. These are not. Each
one below changes a part's design, scope, or ordering, which is why C and F
could not stay deferred.

**1. The test suite does not run 29 of its test files, and the number in
the register is wrong.** `package.json:12` is
`node --test tests/*.test.js "tests/**/*.spec.js"`. The `.test.js` glob is
non-recursive; only the `.spec.js` glob is recursive. `F-OLD-05` reports
this as 6 missed files under `tests/schema/`. Re-checked directly: **29**
`.test.js` files are missed, across eight directories — `tests/queries` (3),
`tests/query` (9), `tests/review` (1), `tests/schema` (6),
`tests/schema/card-model` (3), `tests/schema/consideration` (4),
`tests/schema/elections` (1), `tests/schema/transaction-steps` (2) —
against 803 top-level files that do run. The finding is real and roughly
five times larger than reported.

This is not a documentation defect. `CI=true npm test` is the mechanical
gate every other part of this spec proves itself with, and it has a silent
hole in it. **This gets fixed before anything else in this spec is
verified**, because otherwise every "proves it is done" below is being
checked by an instrument with a known blind spot. Expect the fix to surface
failures: 29 files have been unrun for an unknown period, and some of them
will not pass. That is the point of fixing it, and the cost belongs at the
start of this work rather than discovered midway.

**2. A freshly ingested agreement renders an empty review page**
(`F-AD-12`, `F-AD-23`). A merger agreement ingested through the real
production path — CLI or API route — shows an empty review page until
someone manually runs one of three backfill scripts. `PLAN.md` was grepped
for `mint`, `materializ`, `provision_cards`, "renders empty": zero hits.
The register's own framing is that this reads as a launch blocker, not
background noise. It lands squarely in Part E: onboarding a document is not
"pins plus a run", it includes a materialisation step nobody has written
down.

**3. The "add a new deal" UI is broken for two of its three modes**
(`F-OLD-06`), because most of the 23 hard-contained (503) API routes have
no disposition anywhere in the core docs (`F-OLD-01`). A consequence of the
same containment: the production review page's Correct tab is
non-functional (`F-OLD-02`). Part E cannot write an onboarding runbook
around a UI that is two-thirds broken without saying so.

**Correction to an earlier draft:** it said "17 of 23… including all of
`/api/ingest/*`". The route count is 23, verified. But
`pages/api/ingest/from-url.js` **is** dispositioned — `PLAN.md:1053` names
it as contained for unauthenticated SSRF, and `CODEBASE-GUIDE.md:186`
mentions it too. So "all of `/api/ingest/*` is undispositioned" was false,
and it contradicted Part E's own "none has a disposition anywhere". Both
could not hold; the disposition is real. Establish the exact undispositioned
count as the first act of the routes pass rather than inheriting a number
from this document — and note that SSRF is a *good* reason for containment,
which is what standing ruling 3 asks for. It is evidence the ruling works,
not an obstacle to it.

**4. There is a second live governing document, and PLAN.md wrongly claims
to supersede it** (`F-OLD-07`, the registers' headline). PLAN.md line 8
says it supersedes `EXECUTION-LEDGER.md`. That ledger is live, was touched
2026-08-05/06, and governs a separate ~200+ team-hour "Process
Intelligence" programme (P0–P12, Ben-ruled) with a named OPEN blocker (P8).
PLAN.md engages with none of it beyond one bare file-path mention.

**Ruled (standing ruling 1):** parked. The ledger and its programme move to
a folder to be rebuilt later. But the supersession claim is still false and
still gets deleted — a parked programme is not a superseded one, and
leaving the line in means the next reader concludes the work was absorbed
somewhere when it was set aside. Separately, open-world promotion P1–P4
(`F-OLD-11`) is a *different* programme, a quarter finished, carrying an
unexecuted "Ben ruled: design now" in its own spec text, which PLAN.md
never mentions. That one is **not** covered by the parking ruling — it
holds a live ruling of Ben's — so it keeps a named PLAN.md entry. If it
should be parked alongside Process Intelligence, say so; this spec does not
assume it.

**5. The runner the ladder depends on does not apply Ben's two M3 auto-pass
conditions** (`F-AA-02`). PLAN.md line 142 names
`scripts/canonical-v2-live-extraction-run.mjs` as the runner that
dispatches a family at a deal, but its `resolveCandidates(...)` call
supplies neither `v1v2_comparison` nor `lexical_disagreement` — grepped,
zero occurrences of either string. PLAN.md does not say which script does
apply them. And `scripts/nets-eligibility-report.mjs`, the reporting side
of that question, is completely broken as of commit `0d17ad00` (2026-08-04,
`F-AD-27`). Part D's ladder runs through this runner, so its per-round
gates cannot claim to be checking Ben's conditions. Either the ladder wires
them in, or it states plainly that it does not check them and something
else must.

**6. Step 2A's composition needs three specific pieces of logic, and a
working precedent already exists** (`classifier-questions-closed.md` Q3).
This closes the largest open question in the previous draft, and it changes
the step:

- A working precedent exists: `buildAuditFromCaptureRecords` in
  `full-corpus-routing-prompt-cost-audit.js` (function starts 278; the
  sectionize/classify loop is 303-347) already does
  "sectionize a document, label every relevant node with a family",
  producing a `family_id -> work_item_ids` matrix. It is not exported
  (`module.exports`, 484–500) and is scoped to a fixed 41-receipt cohort
  shape, so it is not directly callable — but it is a reviewed template.
- **Title inheritance is required, not optional.** Most nodes in a real
  section tree carry no `heading` (`deterministic-sectionizer.js:327`).
  Passing `node.heading` straight to the classifier yields no
  classification for the majority of the tree. The fix — walk up
  `parent_section_id` to the nearest non-empty heading — is implemented
  three separate times independently: `deriveSectionTitle`
  (`native-extraction-run.js:330-340`), `inheritedTitle`
  (`prompt-budget-split-preflight.js:156-165`), and a local
  `deriveSectionTitle` (`full-corpus-routing-prompt-cost-audit.js:60`).
  Three independent copies is strong evidence it is required.
- **A dispatchable-node filter is required.** Because heading-less children
  inherit an ancestor's title, classifying every node drags a matching
  section's entire subtree into the same family. The precedent names this
  in its own comment (255–257) and fixes it with `dispatchableNodes(tree)`
  (258–276): `kind === 'SECTION'`, or `ARTICLE` with no `SECTION`
  descendant, falling back to `SUBSECTION` only if neither exists.
- **`article_context` is a dead field today.** Both existing call sites
  pass `node.article_context || null`, and `deterministic-sectionizer.js`
  never sets it. Always `null` in every live path. Not a blocker — the
  classifier guards on null — but do not assume it carries signal.
- **Byte offsets.** All three precedents slice with `utf8Slice`/`Buffer`.
  A script using `.slice()`/`indexOf` misaligns on any non-ASCII byte.

Skip the title walk and the output silently under-classifies; skip the node
filter and it wildly over-reports. Neither throws.

**7. Modiv has one *pinned* family — but the other lists exist, committed,
in the run manifests.** The pin facts are true and verified at
`scripts/canonical-v2-live-extraction-run.mjs`:
`DEAL_PINS.modiv.default_section_refs_by_family` is exactly
`TERMINATION_FEE: ['7.1','7.3','8.12']` (237–238), TopBuild's is
`Object.freeze({})` (269), and an unpinned pair with no `--section-refs`
throws at `resolveRunConfig` (~357–363).

**But the conclusion drawn from them was wrong.** An earlier draft said the
generator is "the only thing that makes 24 of 25 families runnable" and
that its review would be "the first time those 24 lists will ever have been
read". Both are false. `evidence/canonical-v2/modiv-*-20260806/` holds 24
run-manifest directories, and 20 of them record the hand-chosen
`section_references` used for the committed baseline — `ANTITRUST` 5.5,
`CONSIDERATION` 2.1–2.3, `MERGER_STRUCTURE` 1.1/1.4/1.5/1.6,
`MISC_BOILERPLATE` six sections, and so on. Including
**`modiv-appraisal-20260806` → `["2.6"]`**
(family `APPRAISAL_DISSENTERS_RIGHTS`) — the exact human discovery this spec twice
offered as proof that only a person reading the document could produce
these lists. It was produced, by a person, and committed.

This restores the old Step 2A's method. Mining the manifests was not
archaeology for something that might not exist; the artefacts are in the
tree, and they carry the human judgement already spent. The generator's
real job is narrower and still necessary: TopBuild has no manifests at all,
and neither will any of the 10–15 new documents. See the rewritten Step 2A.

**One consequence to chase, not to assert.** The committed baseline used
`KEY_DEFINED_TERMS: ["8.5"]`, while this spec twice claims Modiv's defined
terms sit at 8.12 and calls that a correction to be applied. Only one can
be right, and the only committed artefact says 8.5. Re-argue it against the
document text before writing anything into the pins.

**8. `family-detection-profiles.js` is not a competing classifier**
(`classifier-questions-closed.md` Q2). A prior audit framed it and
`section-family-classifier.js` as two competing, redundant systems. It has
no classification function at all — two lookups over a static
`PROFILE_TERMS` table (9–35), never inspects document text. It is a
versioned term-list contract, consumed only by
`full-corpus-execution-manifest-planner.js` to check a caller declared the
current profile version. This matters for Part F: it is exactly the kind of
module a disposal pass would delete as redundant, and it is not.

**9. The `lib/search.js` finding overstates itself — and this spec's own
correction of it was wrong too** (`F-AC-01`). The register says a complete
corpus-wide provision search backend sits "with zero live callers", its two
API routes and UI page deleted 2026-07-07 (`0811c979`), with a prior
implementation recoverable from `35e74353`.

`lib/search.js` has **three** real non-test importers, all pulling
`canonicalFavorability`: `lib/parser-v2/store.js:25`,
`lib/feature-validation.js:1`, and `scripts/deal-context.js:24`. The first
two sit on live paths — `scripts/ingest-local.js`, `scripts/eval.js`,
several backfills, and `lib/broad-corpus/contained-routes/from-url.js`.

An earlier draft of this spec said "one importer" and said it had verified
that directly. It had not. The grep behind it required the literal string
`lib/search`, which misses the relative `require('./search')` and
`require('../search')` that two of the three use. That is a 3× undercount,
in the document whose stated purpose is stopping confident false counts,
presented as a correction of somebody else's confident false count. A Part
F ruling scoped to "one importer, one context script" could have broken the
V1 store path. "Reconnect, don't rebuild" stands and is strengthened
further — more of this module is in live use than either the register or
this spec first said.

Also unmentioned by the register, and worth knowing before anyone
reconciles "the search routes were deleted" against the tree: a live
`pages/api/search.js` exists. It is an AI-query route and does not use
`lib/search.js`.

**10. Real, tested capabilities exist that the plan does not credit.** In
Part F's scope, and each one is a build-or-reconnect decision rather than a
documentation edit: a Ben-approved V1-vs-V2 cross-validation system
(`v1v2-comparator.js`, `lexical-disagreement-net.js`), merged as PRs
#471/#472 with 7 test files, essentially absent from PLAN/DECISIONS/
GRAVEYARD (`F-OLD-09`); a near-complete V1 cross-deal
identity/reconciliation system, 9+ merged PRs, last touched 2026-08-05,
which PLAN.md and ARCHITECTURE.md both still describe as unsolved
(`F-OLD-04`); No-Shop's native-producer path, already registered and
already resolving 42 real claims — the exact figure PLAN.md's own section 3
cites — against Stage 5E's claim that it "needs an architectural decision"
(`F-OLD-08`); a complete, tested spec-5 rule executor
(`verified-pin-sweep.js`) called only from its own test (`F-AB-07`); a
complete span-level provenance feature never switched on in any real ingest
run (`F-AB-06`); GAP-E residual-capture buckets coded end to end and gated
only by an unset `RESIDUAL_CAPTURE_ENABLED` (`F-OLD-03`).

**11. WITHDRAWN — and the withdrawal is the finding.** This item previously
said `lib/parser-v2/classify.js` carries a header claiming "~10 patterns"
against 80 actual rule entries (`F-AB-01`), a twin of the PLAN.md:145
trigger case. **That is false.** The header was already fixed in `d9cca0f`,
an ancestor of `8d2d992`, the very commit this spec's evidence is pinned
to. It now reads, in part: "do not assume 'two passes' describes this
file… Count the arrays in the code for today's total; a number here would
just go stale again the next time a deal needs a new rule." It is a model
header. The earlier draft of this spec ordered an implementer to correct a
defect that did not exist, and to write "80 rule entries" into a header
that deliberately refuses hardcoded counts — which would have made it
worse.

The rule count itself (80 = 32+33+15) is right. The premise was a stale
register finding, laundered into a spec whose entire purpose is to stop
stale claims being believed. It survived because it was read in a report
rather than checked against the tree.

**Consequence for Part C, which is larger than this one item.** The
registers were written against reports produced before `d9cca0f` landed.
At least one finding was already fixed by the time it was recorded. **Every
register finding must be re-checked against HEAD before it is acted on**,
not just transcribed. Part C's disposition pass therefore includes a
verified-at-HEAD stamp per finding, and any finding that no longer
reproduces is recorded as already-fixed with the commit that fixed it —
not silently dropped, because the pattern of which findings went stale is
itself information.

---

## Execution order

Not the alphabetical order. Each stage's output is the next one's input.

1. **B-zero: fix the test glob** (build-impact 1). Everything else is
   verified with this instrument.
2. **B: correct the false claims** in PLAN.md and in live module headers.
3. **A: consolidate** ROADMAP.md into PLAN.md, park Process Intelligence,
   re-anchor DECISIONS.md's cross-references, then archive ROADMAP.md.
4. **C: fold in the remaining findings**, now that the documents they land
   in have been corrected and consolidated — doing C before A/B would mean
   editing the same passages twice.
5. **F: dispose of the found capabilities**, which needs C's register to
   decide keep/delete/revive per item. `v1v2-comparator.js` is on F's
   critical path, because D cannot start until it is ruled on and wired.
6. **E: unblock onboarding**, which needs F's rulings (the search backend,
   the comparator) and A's amendment-detection step.
7. **D: run the ladder**, which needs all of the above *plus* the auto-pass
   conditions wired and `nets-eligibility-report.mjs` fixed.

D is what was asked for. It is last because it is the only part that spends
real money on model calls, and every part before it is a reason a round
would have to be re-run.

---

## Part B-zero. Fix the mechanical gate first

**Change.** `package.json:12` becomes a glob that matches `.test.js`
recursively, matching the `.spec.js` treatment already there. Run the
suite. Triage every failure among the 29 newly-included files: fix, or
delete as dead with a reason, or explicitly quarantine with a named owner
and a date. No file goes back to silently unrun.

**Proves it is done.** The suite's own reported test count rises by the
number of tests in those 29 files, and a test asserts the glob matches
every `*.test.js` under `tests/` — so this cannot silently regress.

**Cautions.** Never pipe `npm test` into `tail` or `head`; a pipeline
returns the last command's exit code and will report success on a failing
suite. Redirect to a file, echo `$?`, grep the file. Use `CI=true`. And
note that this session's full run reported 7724 tests, 1 failure —
`tests/safety-check-reclass-rules.test.js`, which shells out to
`git show 1ce030c^:lib/parser-v2/classify.js` and fails only because this
sandbox clone is shallow and `1ce030c` is not in its history. That is an
environment artefact. Do not "fix" it. Do also not repeat COMPLETED.md's
"7,718 tests, 0 failures" as if it reproduces exactly today.

---

## Part B. Re-verify the claims, starting with the false ones

**The known-false claim.** `docs/core/PLAN.md:145`, of
`lib/canonical-v2/native-producer/section-family-classifier.js`:

> Exists, deliberately not wired in: anything it classifies carries a
> blocking unverified flag.

Both halves are false (`F-AA-01`, re-verified directly):

- It **is** wired in, as the opt-in `section_family_classifier` parameter
  to `runNativeExtraction` (`native-extraction-run.js:576`), exercised by
  dozens of tests.
- The blocking `SECTION_FAMILY_AI_UNVERIFIED` flag fires **only** for
  stage-2 model-assisted matches (`SECTION_FAMILY_AI_CLASSIFIED`
  provenance). Stage-1 deterministic title-rule matches
  (`SECTION_FAMILY_RULE_CLASSIFIED`) and defined-term-anchored matches
  carry no blocking flag — `sectionFamilyUnverifiedReason` in
  `candidate-resolution.js:3928-3932`.
- Stage 1 costs zero model calls: 26 family labels across 27 rules, 25 with
  a registered producer.

This is the programme's signature failure mode, in the governing document,
about the exact component Stage 2 depends on — and it is why the old Step
2A proposed hand-mining 25 run manifests.

**Change.**

1. Correct line 145 to state what is true: wired in as an opt-in parameter;
   stage 1 deterministic, unflagged, free; stage 2 model-assisted and
   blocking-flagged. Update the module's own header in the same change — a
   stale header is how this survived.
2. Correct line 142 per build-impact 5: state which script, if any, applies
   Ben's two M3 auto-pass conditions, and record that
   `nets-eligibility-report.mjs` is broken as of `0d17ad00`.
3. **Do not touch `lib/parser-v2/classify.js`'s header.** An earlier draft
   ordered it corrected. It is already correct — fixed in `d9cca0f` — and
   it deliberately refuses to state a rule count, for the reason this
   programme keeps rediscovering. Writing a number into it would be a
   regression. See build-impact 11.
   Instead: **re-check every register finding against HEAD before acting on
   it.** The registers predate `d9cca0f` and at least one of their findings
   was already fixed when it was written down.
4. Sweep the rest of PLAN.md's capability table and step preambles the way
   `core-docs-audit.md` swept the other four documents — every claim naming
   a file, function, line number, count or command, checked against the
   tree, recorded VERIFIED-TRUE / VERIFIED-FALSE. PLAN.md is the one core
   document that audit did not cover.
5. For each VERIFIED-FALSE, state whether any step's *method* was chosen
   because of it. That check is the point. Step 2A is the known instance;
   the sweep exists to find the others.

**Proves it is done.** A committed claim-by-claim register for PLAN.md in
`core-docs-audit.md`'s format, plus a one-line method-dependency verdict
per VERIFIED-FALSE.

---

## Part A. Consolidate the governing documents, then archive

**The problem.** `CLAUDE.md` names six current documents. At least two live
documents outside that set still govern real work, and the decisions
document points at one of them.

- `DECISIONS.md`'s entire cross-reference apparatus — the "Blocks:" field
  saying what each decision gates — uses ROADMAP.md's labels (`S2`, `P2`,
  `P3`, `P6`, `P7`, `D1`, `D2`, `D3`) at least 24 times. PLAN.md uses
  Stage-based labels (`1A` … `9E`) and uses none of them as its own step
  identifiers — though it does cite a few (`S2`, `D3`, `P5`) when quoting
  ROADMAP, so "contains zero instances" is literally false and an earlier
  draft's phrasing overstated it. The substance holds: there is no PLAN.md
  step a reader can navigate to from a `Blocks:` field. DECISIONS.md
  never names PLAN.md. A reader of "Blocks: step P2" cannot find that step
  in the plan that is current.
- `EXECUTION-LEDGER.md` is live and governs a second programme, while
  PLAN.md line 8 claims to supersede it (build-impact 4).

**Change — ROADMAP.md.** Six moves, then archive.

1. **Amendment/restatement detection: scope the RESIDUE, do not build it.**
   An earlier draft of this spec said the product "can ingest an
   amended-and-restated agreement and silently present it as the original",
   that `chooseAgreementExhibit` has no ambiguity guard, and that this was
   the highest-priority move. **All of that is stale.** Verified at HEAD:
   `lib/agreement-revision-classifier.js` (15KB) classifies `ORIGINAL` /
   `AMENDED_AND_RESTATED` / `AMENDMENT` / `AMBIGUOUS`, with a restatement
   regex at line 68 and the stated design "what it cannot place is
   AMBIGUOUS for a human, never a guess" (line 7). It is imported by
   `lib/edgar-catalog.js:6-8` and called inside `selectAgreementExhibit` at
   334 and 514, which excludes amendments and stops on ambiguity (336).
   The scoring comment the earlier draft paraphrased is immediately
   followed by the code that resolves it.

   **This is the third capability this document asserted into or out of
   existence** — after the classifier (asserted absent, exists) and the
   `classify.js` header (asserted broken, already fixed). Same mechanism
   every time: a claim read in a report, not checked against the tree.

   What the step actually covers is the residue, and it must be established
   by reading before it is written: whether the **visible warning**
   DECISIONS.md requires actually reaches the user, and whether any ingest
   path **bypasses** `selectAgreementExhibit` and so never reaches the
   classifier at all. That may be a real gap or may be nothing. It is no
   longer the highest-priority move, and no step should be written until
   someone has looked.
2. **Corpus-wide certification gets a step** (ROADMAP P6's second half):
   25 families × 40 deals, against the ingest-QA gates, quote verification
   at zero flags, and the golden evaluation harness. Record the stale
   18/40-clean baseline as the before-picture, marked stale with its date
   (13 July). Without it, PLAN.md's scope stops at "prove the mechanism
   twice". Note the boundary with Part D: D's ladder is the route to corpus
   scale, this is the certification at the end. Do not merge them.
3. **Risk 8 (no monitoring)** gets named in PLAN.md, even if unscheduled.
4. **The P2 remainder** — payment-timing extraction, the grounds-naming
   field — gets a step or an explicit deferral with a reason. DECISIONS.md
   items 4–6 all cite "step P2".
5. **D1's residual merge state** (branch again ahead of `origin/main`) gets
   recorded, as a PLAN.md line or a COMPLETED.md addendum to Step 0J.
6. **The unanchored OPERATING-RULES.md cross-references** get fixed. Two
   distinct targets, **four occurrences**: "amendment-detection step" at
   lines 142 and 392, "roadmap's step 10" at 279 and 420. An earlier draft
   said "the two", which would leave an implementer fixing half the lines.
   Both targets already point at content absent from the current ROADMAP.md,
   so archiving does not worsen them; they need restoring from git history
   or rewriting to stand alone. The other six OPERATING-RULES references
   resolve cleanly to a PLAN.md or GRAVEYARD.md step and are safe to
   redirect once the prose names the new destination.

**Change — EXECUTION-LEDGER.md and Process Intelligence.** Park, per
standing ruling 1. Create `docs/parked/process-intelligence/`, move
`EXECUTION-LEDGER.md` and the P0–P12 material into it, and write a README
there stating: this is a real ~200-hour programme, intentionally set aside
on 2026-08-06 to be rebuilt later, not abandoned and not superseded;
P8 was OPEN when it was parked; here is what a reviver needs to read first.

Deliberately **not** `archive/`, whose stated meaning in `CLAUDE.md` is
"historical and none of it is current". Parked work is neither current nor
historical, and collapsing the two is how a live programme becomes
invisible. If `docs/parked/` proves to be one folder too many, the
alternative is an `archive/` subfolder with an explicit intent-to-rebuild
note — but the distinction must survive somewhere.

Then delete PLAN.md line 8's supersession claim about the ledger. The claim
is false in both directions now: it did not supersede the ledger, and the
ledger is no longer live. Replace it with a pointer to the parked folder.

**Change — open-world promotion (P1–P4).** Keeps a named PLAN.md entry,
including P4's unexecuted "Ben ruled: design now" (`F-OLD-11`). Not parked
with Process Intelligence: it carries a live ruling, and a
ruled-and-unexecuted decision sitting only in spec prose is the same
failure shape as amendment detection. Flag it for Ben rather than deciding
it here.

**Change — DECISIONS.md.** Rewrite the header and every "Blocks:" field to
cite PLAN.md stages. The mapping is in `plan-vs-roadmap.md` (e.g. P9 →
Stage 5 / Steps 5A–5E, which preserves P9's substance including the 49+12
wiring bucket and the register-can-be-fooled finding that is Step 5C's
stated reason for existing). Where a label has no destination, that is
moves 1–4. No "Blocks:" field may point at an archived document.

**Proves it is done.** `grep -rni "roadmap" docs/core/` — case-insensitive;
the case-sensitive form misses ~20 lowercase prose references in
OPERATING-RULES.md alone, which is most of the work — returns nothing but
explicit historical mentions in GRAVEYARD.md or COMPLETED.md. No `Blocks:`
field names a label absent from PLAN.md — assert this with a lint script,
since this class of rot is precisely what recurs here. PLAN.md contains no
supersession claim about a document that is still live.

---

## Part C. Fold in the remaining findings

Everything in the registers not already consumed by A, B, E, F or D. The
bulk is documentation staleness, and it is genuinely lower-stakes than the
eleven items above — but it is the long tail that regenerates the
programme's core failure mode if left.

**Change.** Working from `findings-hdr-ab.md`, `aa-ad-register.md`,
`ac-olddocs-register.md` and `core-docs-audit.md`, land each finding in the
document that owns it, with a disposition per finding: applied, rejected
with a reason, or deferred with an owner. Specifically including:

- The four headline defects in `core-docs-audit.md`: DECISIONS.md's
  cross-reference apparatus (handled in A); COMPLETED.md Steps 0C and 0F
  both citing "the full suite run at the end of this document", which does
  not exist; Step 0E citing "the command above", where no command appears
  in that section; Step 0F misplacing `PARTY_CAPACITY_LEXICON` in
  `anthropic-provider.js` when it is at `candidate-resolution.js:1032`.
- COMPLETED.md Step 0K's "no code" claim about `p9-acceptance`, where three
  code files do match — all comments narrating the deletion, so the
  substance holds and the literal phrasing does not.
- PLAN.md Stage 5E's misdescription of Capitalisation (already in the
  parity register with `wave_a` PASS, `F-OLD-18`) and Misc Boilerplate
  (three product surfaces PASS/NATIVE_COMPLETE, `F-OLD-19`), which Stage 5E
  treats as equivalently blocked with Merger Structure when the three are
  in materially different states (`F-OLD-12`).
- Misc Boilerplate's spec already drafting the two decisions Stage 5E says
  are needed, apparently never put to Ben, absent from DECISIONS.md
  (`F-OLD-13`).
- PLAN.md section 4 omitting the `lib/schema/*` registry indirection layer
  from its V1 prompt description (`F-OLD-15`).
- GRAVEYARD.md entry 1 undercounting its own cluster by omitting the 13-
  module F6–F15 chain (`F-OLD-30`).
- `pages/design/programme-decisions.js` (4 Aug) recording a
  decision-ratification session with some choices still
  `PENDING_USER_RATIFICATION_RULING_IDS`, with zero DECISIONS.md grep hits
  — a possible source of decisions never transcribed. The register flags
  this as **not fully confirmed**; confirm before acting (`F-OLD-29`).
- The `LAYER_LOCATIONS` string in `scripts/generate-codebase-inventory.js`
  claiming `canonical-writer.js` is "unexecuted against a real database",
  which the register explicitly did not verify (`F-AA-25`). Verify it. A
  false "unexecuted" is exactly the failure mode this audit exists to catch.
- The undispatched follow-ups in `aa-ad-register.md`'s Priority Index 2,
  including the orphan-drift question on `claims.source_provision_id` that
  was deferred to a module 29 writeup that was never written.
- The unread list in `coverage-matrix.md`: 28 paths (14 from batch ac, 14
  from batch ad) that no report covered. Read them or record explicitly
  that they are unread — an audit with a silent hole in its coverage is the
  same defect as a test glob with one.

**Proves it is done.** Every register finding carries a disposition. The
count of findings with no disposition is zero, and that count is stated,
not implied.

---

## Part F. Rule on the capabilities that exist and are not used

Each item gets one of three rulings, recorded in GRAVEYARD.md with the
reasoning: **keep** (in use, or deliberately dormant with a named trigger),
**delete**, or **revive** (with the step that revives it). "Needs more
analysis" is not a ruling.

The inventory, from build-impact 9 and 10:

- `lib/search.js` — complete corpus-wide provision search backend; **three**
  live importers (`lib/parser-v2/store.js:25`, `lib/feature-validation.js:1`,
  `scripts/deal-context.js:24`, all `canonicalFavorability`), two of them on
  live ingest/eval paths; routes and UI page deleted 2026-07-07
  (`0811c979`), prior implementation recoverable at `35e74353`. Register
  recommends reconnect, don't rebuild. **Any disposal ruling must account
  for all three importers** — see build-impact 9 for why this count has
  already been got wrong twice.
- `v1v2-comparator.js` / `lexical-disagreement-net.js` — Ben-approved
  cross-validation, merged (#471/#472), 7 test files, near-invisible in the
  core docs. Interacts with build-impact 5: this is plausibly the answer to
  "which script applies Ben's auto-pass conditions".
- The V1 cross-deal identity/reconciliation system — schema-shape registry
  plus 3 admin pages, 9+ merged PRs, last touched 2026-08-05, described as
  unsolved by both PLAN.md and ARCHITECTURE.md.
- `verified-pin-sweep.js` — complete, tested spec-5 executor, called only
  from its own test. Same shape as the classifier: built, tested, unwired.
- Span-accounting (`span-claims.js`, `span-residual.js`, `subclauses.js`,
  wired through `extract.js`/`validate.js`) — complete cross-file provenance
  feature, never switched on; its enabling flag greps to zero hits outside
  its own five files and test.
- `lib/feature-compare.js` / `lib/rep-materiality.js` — working cross-deal
  comparison engine, deliberately contained behind
  `createBroadCorpusContainedHandler('GET')` stubs.
- GAP-E residual-capture buckets — coded end to end, gated on an unset
  `RESIDUAL_CAPTURE_ENABLED`.
- No-Shop's native-producer path — registered, resolving 42 real claims,
  against Stage 5E's "needs an architectural decision".
- `pages/admin/processing-flow.js` and `pages/admin/reports/*` — already
  live on the deployed site, delivering ingest-flow and CLI-run visibility
  the programme may not be crediting as delivered.

**Explicitly not a disposal candidate:** `family-detection-profiles.js`
(build-impact 8). It looks redundant against the classifier and is not.

**Proves it is done.** Every item above has a ruling and a reason in
GRAVEYARD.md. Every "revive" names the step that does it. Every "delete"
is a commit, not an intention.

---

## Part E. Unblock deal onboarding

Part D's document fan-out needs 10–20 more agreements. Five things
currently stop that being routine, not the two the first draft named.

1. **Section refs are hand-pinned, and only one family is pinned.**
   `scripts/canonical-v2-live-extraction-run.mjs` resolves refs from
   `DEAL_PINS.<deal>.default_section_refs_by_family` (pins at line 226) and
   never calls the classifier (grepped: zero hits). Modiv has exactly one
   family pinned; TopBuild has none; an unpinned pair with no
   `--section-refs` throws at `resolveRunConfig` (357–363). Fixed by Step
   2A's generator.
2. **An A&R agreement ingests silently as the original.** Fixed by Part A
   move 1 — detection and a visible warning, before any document beyond
   Modiv and TopBuild is onboarded. Full amendment *parsing* stays deferred
   per DECISIONS.md. Onboarding documents that may be the wrong text and
   then treating their output as evidence about generalisation contaminates
   D's entire result.
3. **The review page renders empty after ingest** until one of three
   backfill scripts is run by hand (build-impact 2). The runbook must name
   which script and when, and PLAN.md must carry it as a tracked gap.
4. **The add-a-deal admin UI is broken for two of its three modes**
   (build-impact 3), because of route containment nobody has dispositioned.
   Either fix the containment for `/api/ingest/*` or document the working
   third mode as the only supported onboarding path — but do not write a
   runbook that silently routes around a broken UI.
5. **The Correct tab on the production review page is non-functional**
   (`F-OLD-02`). Not strictly an onboarding blocker; listed because it is
   the same containment root cause and will be discovered by anyone
   following the runbook.

**Change.** Fix 1 via Step 2A. Fix 2 via Part A move 1 — noting that per
the correction there, most of that capability already exists and only the
residue is in scope.

For 3, 4 and 5: disposition the undocumented contained routes — one
decision that resolves three symptoms. There are **23** contained routes;
how many lack a disposition is to be established as the first act of this
pass, not inherited from this document. At least one is dispositioned
(`/api/ingest/from-url`, `PLAN.md:1053`, unauthenticated SSRF), so the
earlier draft's "all 17… none has a disposition anywhere" was wrong on
both halves and contradicted build-impact 3.

Per standing ruling 3, containment does not get to persist because it is
already there. Each undocumented route is uncontained unless its
containment is defended on present merit, in writing, in the same pass.
Defensible cases are real — the SSRF one above is exactly that, and is
evidence the ruling works rather than an obstacle to it — but "it was
contained in July and nobody revisited it" is not a defence.

Apply the same test to the rest of the inherited process this part touches:
the three-mode add-a-deal UI, the hand-pinned `DEAL_PINS` convention, and
the manual backfill step all predate the current plan and none was designed
for onboarding 10–15 documents. Keep what earns its place; replace what
does not; say which in the runbook.

Then write the onboarding runbook into `docs/core/CODEBASE-GUIDE.md`:
fetch the exhibit, run the ambiguity guard, generate section refs,
human-review them, commit the pins, materialise the cards, run the family
ladder.

**Proves it is done.** A third document is onboarded end to end using only
the runbook, by someone who did not write it, with no manual section
mapping, no undetected restatement, and a review page that renders. That
third document is Part D's Doc round B; this proof and that round are the
same event.

---

## Part D. Rebuild Stage 2 as a fan-out ladder

Replaces PLAN.md Stage 2 (2A–2E). 2A changes method, 2B and 2D become
explicit fan-out ladders, 2C adopts 2A's method, 2E gains a confidence
column. Kept: 2E's table, the falsifiable `GUARANTY_FINANCING_PARTY`
prediction, and the "incomplete is 0 / no resolved count falls" gates,
re-anchored to the new rounds.

The objection this answers: 2B and 2D each dispatched all 25 families at a
whole document in one batch with no intermediate checkpoint. A wiring bug
in family 14 of 25 is not discovered until all 25 have run and someone
reads 25 output directories. 2D then repeated that shape on a second,
differently drafted document, so a family that worked on Modiv and breaks
on TopBuild was caught only by manual comparison after the fact. Nothing
enforced "still works on what came before".

**Prerequisite, not a caveat.** Per build-impact 5 and standing ruling 2,
the runner does not supply `v1v2_comparison` or `lexical_disagreement`, so
its rounds cannot check Ben's two M3 auto-pass conditions. **The ladder
does not start until they are wired.** Concretely, all three of these land
first: Part F rules on `v1v2-comparator.js` / `lexical-disagreement-net.js`
(built, merged as #471/#472, 7 test files, near-invisible in the core
docs — the likely existing answer); the conditions are supplied at the
`resolveCandidates(...)` call in
`scripts/canonical-v2-live-extraction-run.mjs`; and
`scripts/nets-eligibility-report.mjs`, broken since `0d17ad00`, is fixed
so the reporting side works. A test asserts both condition names appear in
the runner's resolve call, so this cannot silently regress back to the
state that made the caveat necessary.

Rationale for making this blocking rather than a recorded gap: a green
round that did not evaluate the conditions looks identical, in the
evidence directory, to one that did. This programme's expensive failure
mode is exactly that — a claim that reads stronger than what was checked.

### Step 2A. Generate the per-family section lists

**What it is.** `scripts/canonical-v2-generate-family-section-refs.mjs`:
sectionize a pinned deal's admitted source with `sectionizeAdmittedSource`,
label each node with `classifyDeterministicSectionFamilies`
(`section-family-classifier.js:410`, stage 1 only — no provider, no model
call, no cost), invert into `family -> [section_references]`. Run for Modiv.

**Required by construction** (build-impact 6 — skipping any of these
produces wrong output that does not throw):

- Walk `parent_section_id` up to the nearest non-empty heading for the
  title. Copy `deriveSectionTitle` (`native-extraction-run.js:330-340`) or
  `inheritedTitle` (`prompt-budget-split-preflight.js:156-165`).
- Filter to dispatchable nodes before classifying. Copy
  `dispatchableNodes` (`full-corpus-routing-prompt-cost-audit.js:258-276`):
  `SECTION`, or `ARTICLE` with no `SECTION` descendant, falling back to
  `SUBSECTION` only if neither exists.
- Slice with `utf8Slice`/`Buffer`, never `.slice()`/`indexOf`.
- Do not rely on `article_context`; it is `null` in every live path today.
- Read `buildAuditFromCaptureRecords`
  (`full-corpus-routing-prompt-cost-audit.js`, function at 278, loop at
  303-347) first. It is not
  exported and is scoped to a fixed cohort shape, so it cannot be called —
  but it is a reviewed, working template for this exact composition.

**What this is not.** Not a claim the classifier is correct, and not a
reason to skip review. Stage 1 is title and heading pattern matching; it
cannot know that Modiv's appraisal-availability sentence sits in section
2.6, whose title gives no hint. That one was found by a human reading the
document, and the generated list gets read the same way wherever it
disagrees with the harvest.

Where the defined-terms section sits is **not** settled — this spec has
said 8.12, the committed baseline manifest says 8.5, and open question 11
holds it until someone adjudicates it against the document. Do not carry
8.12 forward as established.

**Change — harvest first, generate as cross-check.** Per build-impact 7,
the old plan's manifest-mining method was sound and its artefacts exist.
Order of operations:

1. **Harvest** `section_references` from the 24 committed run directories
   under `evidence/canonical-v2/modiv-*-20260806/`. Twenty carry them in
   `run-manifest.json`. The other four (`CAPITALISATION`,
   `CLOSING_CONDITIONS`, `INTERIM_OPERATING`, `NO_OTHER_REPS_FRAUD`) have
   **no `run-manifest.json` at all** — an earlier draft said to read them
   "out of their manifest shape by hand", which is impossible. Their refs
   are in `section-location-scan.json` under
   `requested_section_references`, and are mechanically recoverable:
   verified for capitalisation, which yields `["3.2","4.2"]`. So the
   harvest is fully automatable across all 24, in two shapes rather than
   one. This is human judgement already spent, and it is free to recover.

   **`MAE_DEFINITION` has no Modiv harvest side.** The only 2026-08-06 MAE
   run is `topbuild-mae-definition-20260806`. So for that family the
   generator is the sole source on Modiv, and "review only the
   disagreements" would review it not at all. It gets a full human read
   regardless of whether anything disagrees — it is the one family where
   the harvest cannot cross-check the generator.
2. **Generate** with the script and **diff against the harvest.** The
   generator is now a cross-check on 25 families rather than the sole
   source for 24 — a much stronger position, because two independent
   derivations disagreeing is a signal, whereas one unreviewed derivation
   is just an assertion.
3. **Human-review every disagreement**, and only those, against the
   document text. That is where `CONSIDERATION`/2.6 belongs. The
   `KEY_DEFINED_TERMS` question — spec says 8.12, committed baseline says
   8.5 — is a disagreement to adjudicate here, not a correction to apply.
   Do not assume the spec is right against the artefact.
4. **Write the reviewed result** into `default_section_refs_by_family` for
   all 25 families.

The generator still gets written, and is still required: TopBuild has no
manifests, and neither will the 10–15 new documents. Step 2C and every
document round depend on it. What changes is that Modiv stops being its
proving ground of last resort and becomes its validation set.

**Proves it is done.** A test asserting every registered family has a
pinned section list for Modiv (unchanged from the old 2A — note it passes
1/25 today). Plus the script and its raw, pre-correction output committed,
the latter as
`docs/codex-program/notes/family-section-refs-modiv-<date>-generated.json`,
so a reader sees what the classifier proposed against what a human
corrected, and why.

### Step 2B. Fan out families against Modiv

Four rounds, each strictly larger, each re-checking every family proven
earlier. Same runner
(`scripts/canonical-v2-live-extraction-run.mjs --deal modiv --family <NAME>`),
same evidence-directory convention.

- **Round 1 — one family.** `TERMINATION_FEE`: the one family with a real
  baseline and a known-correct section list. Diff against
  `all-families-baseline-20260806.json`'s entry. Must match or the round
  does not proceed.
- **Round 2 — four families.** Add `CONSIDERATION` and `KEY_DEFINED_TERMS`
  (both adjudicated in 2A — first real test of that adjudication) and
  `APPRAISAL_DISSENTERS_RIGHTS` (whose zero output was reclassified as
  correct-by-design; confirm still zero for the *same* reason, not because
  it silently broke). Re-run `TERMINATION_FEE` alongside, not instead.
- **Round 3 — twelve families.** Add eight covering the families the plan
  names as having known issues (`TERMINATION`,
  `SPECIFIC_PERFORMANCE_REMEDIES`, `MATERIAL_CONTRACTS`,
  `GENERAL_COVENANTS`, `REPRESENTATIONS`, `TAX_MATTERS`,
  `CLOSING_CONDITIONS`, `INTERIM_OPERATING`). Re-run Round 2's four.

Family names above are the registered identifiers, verified against
`listRegisteredSectionFamilies()`. The runner rejects anything else with
`UNREGISTERED_FAMILY`. An earlier draft wrote `APPRAISAL` and
`SPECIFIC_PERFORMANCE_AND_REMEDIES`; neither exists.
- **Round 4 — all 25.** Add the remaining 13, including `MAE_DEFINITION`
  (never run against Modiv — this creates its first baseline, it is not a
  regression check) and `CAPITALISATION` (needs the raised
  `--call-timeout-ms`). Re-run Round 3's twelve.

"Re-run" means dispatching the runner again, not re-reading earlier output.
A family can only regress if it is actually re-executed.

**Proves it is done.** Checked after **every** round: `incomplete` is 0
among families run so far, and no family's `resolved` count has fallen
against its own most recent prior round. A failed gate is a stop, not a
note to fix later — find and fix the cause before the next round adds
families, or the next round repeats the defect 8–13 more times for nothing.
Final output is the regenerated `all-families-baseline-<date>.json`, diffed
against `all-families-baseline-20260806.json`.

**Three holes in that gate, which must be closed before the ladder runs.**
Each one produces a green result indistinguishable from a skipped check —
the exact criticism this spec makes of the plan it replaces.

*The gate assumes deterministic re-runs; the runner is not deterministic.*
Every re-run is a fresh live model call. `canonical-v2-live-extraction-run.mjs`
has no `--replay` flag and no temperature pin, so two runs of the same
family on the same document can differ with zero code change. Mandating
hard stops on a noisy signal gives one of two outcomes, both bad: ladder
deadlock on a flaky family, or ad-hoc "re-run until green", which is
precisely the silent gate-erosion this ladder exists to prevent. **Required
before Round 1:** either a replay path that re-scores recorded responses
without new calls, or a written tolerance policy — what magnitude of
`resolved` delta counts as noise, how many confirmations a red gate needs
before it is believed, and who decides. Silence here means the first flaky
round gets resolved by whoever is at the keyboard.

*A zero-resolving family passes the gate vacuously.* Eleven of the 20
COMPLETE Modiv rows resolve zero (of 24 Modiv baseline rows; the 25th row
in the baseline is TopBuild's MAE run, not Modiv). "No resolved count
falls" is trivially satisfied by 0 → 0, so for ten of those eleven the gate
checks nothing at all. Only
`APPRAISAL_DISSENTERS_RIGHTS` gets the still-zero-for-the-same-reason
check. **Required:** extend that check to every zero-resolving family, or
state per family why zero is correct and what would make it wrong. A family
returning zero can be correct — but "correct" and "silently broken" look
identical under this gate.

*A correct-empty family collides with 2A's own test and with the runner.*
2A's "proves it is done" demands every registered family have a pinned
Modiv list, while `resolveRunConfig` throws on an empty list. On Modiv this
was papered over by pinning `5.11` for guaranty (resolved 0, COMPLETE). On
a new document there may be no section to pin at all. **Required:** decide
what a correct-empty pin looks like — a sentinel value, an explicit
`expected_empty` flag, or a runner escape hatch — and reconcile it with the
25/25 test, before Doc round B rather than during it.

### Step 2C. Map the families to TopBuild, same method as 2A

Unchanged in intent — TopBuild's section list without calling a model — by
2A's generate-then-review method. TopBuild has no historical manifest to
mine and no pins at all (`default_section_refs_by_family` is empty), so the
old 2C already required hand-mapping from scratch; generation is a strict
improvement with no method to compare against.

**Change.** Run the generator with `--deal topbuild`. Human-review every
family's list against the actual text — unskippable, since TopBuild's
article numbering does not match Modiv's (the plan's own note: Modiv's
termination at 7.1, TopBuild's boilerplate running to 7.16). Confirm per
family with `--dry-run`: `DRY RUN complete: projected_model_call_count=N`,
zero model calls.

**Proves it is done.** A committed mapping file, 25 entries, resolved
references and projected call counts, zero model calls. Any family
resolving to zero sections is recorded as a finding — and specifically,
`GUARANTY_FINANCING_PARTY` resolving to zero here, given TopBuild's two
dedicated financing sections, is evidence the *mapping* is wrong, before 2D
runs. Check it by name: 2D's falsifiable prediction depends on the mapping
being right, not only on the extraction.

### Step 2D. Fan out across families on TopBuild, then across documents

*Family fan-out on TopBuild:* the same four-round ladder as 2B, gated
identically, checked after every round. Confirm the
`GUARANTY_FINANCING_PARTY` prediction — non-zero expected, given two
dedicated financing sections — at whichever round includes it.

*Document fan-out, once TopBuild is 25/25 clean:*

- **Doc round A — the base pair.** Modiv and TopBuild, all 25, both already
  proven. The baseline later rounds diff against, not new work.
- **Doc round B — one more document.** A different drafter from both, and
  ideally a deal shape neither covers — a financed non-REIT deal, or one
  with a go-shop. All 25 families against it alone first; only once clean,
  re-run Modiv and TopBuild's full 25 alongside. A regression there means a
  fix for document 3 changed behaviour on 1–2, which should be structurally
  impossible and must therefore be checked rather than assumed. This round
  is also Part E's proof.
- **Doc round C — five to ten more.** All 25 against each new document
  individually first, to catch a document-specific crash before it is
  buried in an eight-document batch. Then the full family set against every
  document proven so far, together, as the regression check. Record every
  issue and fix or explicitly defer each — no "needs more analysis", same
  discipline as Step 3H.
- **Doc round D — the remainder, to 10–15 total.** Same shape as C. Per
  standing ruling 4, the ladder stops at 10–15 documents, not 40. Beyond
  that the per-round re-run cost grows quadratically for diminishing
  evidence: the point of the ladder is to catch a fix that was tuned to one
  drafter's vocabulary, and 10–15 drafters establishes that as well as 40
  does at a fraction of the model spend. Part A move 2's certification step
  covers the remaining deals — the ladder proves the mechanism generalises,
  certification proves the corpus is clean. They are different claims and
  this is the boundary between them.

  Record the target as a decision in DECISIONS.md when it lands: it is
  currently recorded nowhere (grepped DECISIONS.md and PLAN.md for
  "40 deal", "all 40", "corpus size" — zero hits), which is why it was an
  open question at all.

**Re-run policy: change-triggered, not blanket.** An earlier draft
mandated re-executing every prior family against every prior document at
every round. Costed from the tree — model calls per family-run equals the
number of pinned sections (`projected_model_call_count`), averaging ~2.3 on
Modiv, so ~55–60 calls per full 25-family document pass — the full ladder
at 15 documents is roughly 3,000–6,000 calls. Affordable in money. Not
affordable in wall-clock: `CAPITALISATION` already needs a raised
`--call-timeout-ms` after timing out at 600s, and thousands of serial long
calls is days, with every red gate — including flaky ones — stopping the
line.

Worse, most of that spend buys nothing. Given live-model nondeterminism, a
re-run whose inputs are unchanged is sampling noise, not a regression
check. So: **re-run a (deal, family) pair only when something it depends on
has changed since its last green receipt.**

**This requires a runner change first — it is not implementable today.**
An earlier draft said the invalidation keys are "all already recorded in
`run-manifest.json`". They are not. The manifest records
`contract_bundle_version`, `prompt_version`, `prompt_id` and
`section_references` — but **no commit hash and no code-version field of
any kind**, so "has the code changed" cannot be answered from a receipt at
all. And the only model field is `model_cli_alias`, a CLI shorthand, not a
resolved model identity — so swapping the underlying model triggers zero
re-runs, which is the single most dangerous silent invalidation miss
available.

Required before the ladder runs: the runner records (a) the commit hash at
run time and (b) the resolved model ID, and someone writes down what counts
as the **code footprint** of a family run — which paths, changing, should
invalidate it. That definition is a judgement call and it should be made
deliberately rather than defaulted to "any commit", which would degrade
this straight back to blanket re-running.

**Accepted loss, stated rather than hidden:** blanket re-running does buy
one real thing this policy gives up — repeated sampling of a
nondeterministic runner surfaces flakiness that a single receipt hides. We
are trading that for tractable cost, which makes the tolerance policy in
2B's gate section more important, not less. The two decisions are coupled
and should be made together.

With those in place the policy gives the guarantee the ladder actually
wants ("a pair can only regress if something changed") at a fraction of the
cost, and it is what this spec's own Doc round B reasoning implies when it
calls a cross-document regression "structurally impossible".

Round 1 of each ladder is exempt: it establishes the receipt everything
else is compared against.

On both axes, every round: the gate must pass — or be understood and
explicitly fixed or recorded — before the next round starts. No round
proceeds past a red gate to keep momentum. That is the shortcut that lets
one defect repeat across every subsequent round instead of being caught
once.

**Proves it is done.** Run receipts under
`evidence/canonical-v2/<deal>-<family>-<date>` for every deal × family pair
executed — every round's receipts kept, not just the last, so the ladder is
auditable after the fact. The `GUARANTY_FINANCING_PARTY` prediction
resolved in writing. A regression table per round: which families, which
documents, incomplete count, resolved-count deltas against the previous
round for that pair. And, per the gate caveat, an explicit statement of
whether Ben's two auto-pass conditions were evaluated.

### Step 2E. Say which fixes generalised

Unchanged in shape — one table, a row per fix, evidence-cited — now
spanning however many documents 2D reached.

**Change.** `docs/codex-program/notes/generalisation-<date>.md`, with a
column for which document round first exercised each fix and which later
rounds re-confirmed it, so a fix proven on 2 documents against one proven
on 15 is visibly different confidence rather than flattened to pass/fail.

**Proves it is done.** Every row cites an evidence directory and a
reason-code count, not a recollection. Undetermined is recorded as
undetermined, not as a pass.

---

## Open questions

Each is a place this spec could be wrong.

1. ~~Is `EXECUTION-LEDGER.md` live or subsumed?~~ **Closed by standing
   ruling 1: parked.** Residual risk worth naming — nobody in this session
   read P8, the blocker that was open when it was parked. If P8 turns out
   to block something in Stages 2–9 rather than only Process Intelligence,
   parking it hides that. The parked README should record what P8 was, not
   just that it existed.
2. **Does fixing the test glob surface a large number of failures?** 29
   files, unrun for an unknown period. If many fail, B-zero stops being a
   one-line package.json change and becomes the largest part of this spec.
   Nobody has run them.
3. **Is the 2A generator correct in practice?** Build-impact 6 closes the
   design question — the composition works and the three required pieces
   are identified from a working precedent — but nobody has written or run
   the script. The failure modes are silent in both directions.
4. **Is the ladder concrete enough for a Sonnet implementer?** Round 3's
   twelve families are named. Doc round B's "different drafter" criterion is
   not operationalised, and the third document is not chosen.
5. ~~Is there a cheaper fan-out shape with the same guarantee?~~ **Closed
   by the adversarial audit: change-triggered invalidation**, which is
   better than the sampling this question floated — it re-runs only pairs
   whose inputs changed, which is a stronger guarantee than sampling *and*
   cheaper. See Step 2D's re-run policy. What remains open is the tolerance
   policy for nondeterministic re-runs, which is question 9.
6. ~~Does Part D's ladder mean anything without Ben's auto-pass
   conditions?~~ **Closed by standing ruling 2: wire them first.** The new
   risk this creates is schedule, not correctness — D now depends on
   F ruling correctly on `v1v2-comparator.js` and on a broken script being
   fixed. If wiring the conditions turns out to be a large piece of work
   rather than a call-site change, that discovery lands on D's critical
   path. Nobody has scoped it.
7. **Does this silently drop or weaken anything in the original 2A–2E?**
   Checked against the original text once, by the author of the draft — the
   weakest kind of check, and the one most likely to err toward
   self-flattery.
8. **28 paths were never read** (`coverage-matrix.md`). The registers this
   spec is built on have a known coverage hole. Part C schedules reading
   them; until then, "the findings" is not the same as "the defects".
9. **What is the tolerance policy for a nondeterministic gate?** The runner
   makes live model calls with no replay path and no temperature pin, so
   the ladder's core gate is measuring a noisy signal while mandating hard
   stops. Either a replay path gets built or a tolerance policy gets
   written, and nobody has scoped which is cheaper. This is the single
   likeliest cause of the ladder stalling in practice.
10. **How many register findings are already fixed?** At least one
    (`F-AB-01`) was fixed before it was written down, and this spec
    propagated it anyway. The registers were produced against
    pre-`d9cca0f` reads. Until Part C's verified-at-HEAD pass runs, the
    finding count is an upper bound on real defects, not a measure of them.
11. **Is `KEY_DEFINED_TERMS` at 8.5 or 8.12?** This spec says 8.12 twice
    and calls it a correction. The only committed artefact — the baseline
    run manifest — says 8.5. Unadjudicated, and it must be settled against
    the document text before anything is written to the pins.
