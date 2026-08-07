# Completed

The other half of `PLAN.md`. Together they are the whole picture and nothing is
in both. A step arrives here when it closes, carrying the evidence that closed
it and the commit that did it.

This is not a narrative. Do not read it to learn where things stand; read
`PLAN.md` for that. Read this to find out whether a thing was done, and how
anyone knows.

**Stage 0 is everything completed before this plan existed.** It has been
reconstructed from the commit log and the evidence directories, which are the
most reliable records in this repository. Where a claim could not be verified
from a primary source it says so rather than asserting it.

---

## Step 0A. One family proven end to end on live model output

**What it was.** Take termination fees, run V2 extraction against a real filed
agreement, and prove the extracted facts are correct, not argued from a design
document.

**Two problems were in the way, both now solved.**

The amount half: one defined term paid $10,000,000 under three termination
grounds and $15,000,000 under two others, and it resolved to whichever figure
the model happened to quote first. A per-limb field now lets each side of that
condition carry its own verbatim proof of its own figure, checked against the
source before the resolver trusts it.

The trigger half: a fee trigger stated only as a cross-reference to another
section could never be named, because each section is shown to the model in its
own isolated call. The cited section is now dispatched as its own call and
joined back afterwards.

**Evidence.** Three claims resolved where the earlier run resolved one. The
citation-following run recovered two termination grounds nothing had ever named,
including one earlier analysis had recorded as a genuine miss. That same run
also published one fact three times and minted a link to a fact never published;
both are fixed, and replayed against the same run, nine resolved claims
correctly become six with the false link gone.

Both live runs are pinned as committed evidence and replayed with no network
call and no model call, so the proof does not depend on repeating a paid run:

```
CI=true node --test tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js \
  tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js
```

**Commits.** `6d8d453e`, `d501cee2` (per-limb amount), `8bd4cb32`, `643cacc0`
(citation following), `84518eef` (claim identity reconciliation).

**What it did not do.** It did not connect a second deal to the screen. QXO and
TopBuild's serving file is hand-typed. That is `PLAN.md` Step 5B.

**Technical detail.** The per-limb amount lives in
`lib/canonical-v2/native-producer/termination-fee-parse.js`, in the functions
`parseFeeAmount` and `resolveFeeAmount`. Citation following lives in two new
files, `lib/canonical-v2/native-producer/bare-citation-trigger-parser.js` and
`lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js`,
with supporting changes in `anthropic-provider.js`, `candidate-resolution.js`
and `termination-fee-producer-prompt.js` (all in the same `native-producer`
folder). Commit subjects: `6d8d453e` "feat: let a conditional termination fee
resolve to both its amounts", `d501cee2` "evidence: fresh Modiv run proves the
conditional fee now resolves to both amounts", `8bd4cb32` "feat: let the model
read the section a fee trigger cites", `643cacc0` "evidence: citation-following
works, costs five times as much, and duplicates facts", `84518eef` "fix: one
fact, one row, and no link to a claim that was never published". The command
above was re-run for this audit: 18 of 18 pass. A pass establishes both fixes
replay correctly against the two committed live runs; it does not establish
that a third deal's drafting exercises the same code paths.

---

## Step 0B. All 25 registered families dispatched at real data, once

**What it was.** Every registered section family run against a real agreement in
one sweep, rather than one family at a time.

**Evidence.** 25 run directories:
`ls -d evidence/canonical-v2/*20260806* | wc -l` gives 25. Measured totals in
`docs/codex-program/notes/all-families-baseline-20260806.json`: 108 claims
resolved, 203 queued for human review, 193 candidates with no governed slot at
all, 4 runs that did not finish. 58 model calls, $20.30.

**Three corrections this record makes to how the sweep has been described.**

1. It was **24 families against Modiv and one against TopBuild**, not 25 against
   Modiv. MAE_DEFINITION ran only against TopBuild and has no Modiv baseline.
   ```
   node -e "const b=require('./docs/codex-program/notes/all-families-baseline-20260806.json');
   console.log('modiv',b.per_family.filter(f=>f.dir.startsWith('modiv')).length,
   'topbuild',b.per_family.filter(f=>f.dir.startsWith('topbuild')).length)"
   ```
2. Two of the 25 rows were **reused from earlier runs**, not fresh members of the
   batch: TERMINATION_FEE from
   `modiv-termination-fee-citation-following-20260806`, run hours earlier, and
   MAE_DEFINITION from `topbuild-mae-definition-20260806`. So 23 families were
   freshly dispatched.
3. **34 of the 108 resolved claims belong to families whose projection modules
   are dead code**: Merger Structure resolved 20 and Miscellaneous Boilerplate
   14. Just under a third of everything the sweep resolved cannot render
   anywhere. `PLAN.md` Step 5E owns the decision.

**Commits.** `4788860b` (the run), `d07303c1` (the pinned baseline), `ce981c36`
(the aggregate and a correction to its own baseline), `bc29d332` (the
adversarial review of that aggregate).

**What it did not prove.** One agreement. Almost every fix since was tuned on
that agreement's drafting. `PLAN.md` Stage 2 is the test of whether any of it
generalises.

**Technical detail.** No production code changed in this step; it is a data
run plus measurement. Its output is the 25 directories under
`evidence/canonical-v2/*20260806*` and
`docs/codex-program/notes/all-families-baseline-20260806.json`. Commit
subjects: `4788860b` "evidence: run all 25 families, and re-derive the phantom
citations", `d07303c1` "docs: pin the pre-fix baseline for all 25 families",
`ce981c36` "docs: the aggregate across all 25 families, and a correction to my
own baseline", `bc29d332` "docs: adversarial review kills one fix and finds
119 candidates with no owner". Both commands above were re-run for this audit
and gave the same output shown: 25, and modiv 24 / topbuild 1.

---

## Step 0C. Three extraction crashes fixed, each reproduced offline first

**What it was.** Four of the 25 runs did not finish. Three causes were found,
each reproduced from the real recorded evidence before anything was touched.

- A shared helper handed back its caller's own in-progress list by reference
  instead of a copy, then froze that list as part of building an unrelated
  result. Every family's run had been doing this silently for as long as the
  code existed; it only crashed the one family, interim operating covenants,
  whose own code writes into that list again afterwards. Fixed by copying, not
  aliasing.
- A resolver rebuilt a claim's data wholesale rather than merging into it, and
  dropped a required provenance tag every other resolver in the same file keeps.
  The family produced three good answers, then crashed two steps later in a
  check that a governed answer must say where it came from.
- A run received over a thousand characters of ordinary prose narrating that a
  file had been written, rather than the data, consistent with the model going
  agentic under the command-line transport. The old behaviour discarded the
  whole batch including earlier sections already succeeded and paid for. Fixed
  by keeping what already succeeded.

**Commit.** `d261df30`.

**Evidence, and its limit.** Each was reproduced offline from committed evidence
before the fix and replayed after. **None has been confirmed by a fresh live
run**: the baseline was pinned at `bff5cd28`, before these fixes. `PLAN.md` Step
2B is the confirmation, and its first acceptance condition is that `incomplete`
falls from 4 to 0.

Note also that closing conditions crashed for a reason this commit did not fix:
it lost the partial receipt, which is now kept, but the underlying unparseable
response on call 2 of 4 persists, and sections 6.3 and 6.4 were never attempted.

**Technical detail.** The aliasing fix touches
`lib/canonical-v2/native-producer/ioc-mechanic-resolution.js` (function
`resolveIocMechanics`, the family that actually crashed) and, per the commit
message's "two resolution modules" sharing the same defect,
`lib/canonical-v2/native-producer/sole-remedy-resolution.js` (function
`resolveSoleRemedyOpenWorld`). The dropped-provenance-tag fix touches
`lib/canonical-v2/native-producer/candidate-resolution.js` (function
`resolveCandidates`). The partial-receipt fix touches
`lib/canonical-v2/native-producer/native-extraction-run.js` (function
`runNativeExtraction`, plus a new helper `buildPartialRunReceipt`). Commit
`d261df30` "fix: three crashes that stopped four families dead". The commit
message describes three regression tests proven to fail pre-fix by reverting
and restoring; the commit's own diff touches no test files, so these are
existing tests in the suite exercised against the reverted code, not new
dedicated test files added alongside the fix. No narrow replay command is
committed for this step; it is covered only by the full suite run at the end
of this document's verification.

---

## Step 0D. A quote may no longer drop the negation that governs it

**What it was.** Adversarial testing found that the live production
quote-acceptance gate would accept a quote with its governing negation cut from
the front: storing "have a Company Material Adverse Effect" when the source
reads "would **not** have a Company Material Adverse Effect". A stored quote
reading as genuine verbatim evidence for the opposite of what the agreement
says.

**Why it mattered more than its size.** It is the worst class of error this
product can produce: confidently wrong, with no visible signal to a reader. It
was live in production with no boundary check of any kind, and two committed
tests literally named "KNOWN LIMITATION" pinned the unsafe behaviour as
expected.

**Change.** Closed at the live production quote-acceptance path,
`lib/verification.js`, which is the function `lib/parser-v2/store.js` actually
calls at ingestion, and at one preview bridge,
`lib/canonical-v2/representations-dark-bridge.js`. Proven open by construction
first, against real filed merger-agreement text, then closed at both.

**Commit.** `c93b8eaf`. Full account: `docs/codex-program/notes/negation-reversal.md`.

**Still open, and tracked.** The principled form, capturing a quote's position
before any trim rather than re-deriving it after, is specified and not built:
`PLAN.md` Step 3D. The same gap in `no-other-reps-fraud-dark-bridge.js` was
attempted, found to need a more careful fix, and deliberately reverted rather
than shipped half-right: `PLAN.md` Step 3E.

**A correction that belongs here.** `WORK-COMPLETED.md` previously said this open
case was "tracked in the roadmap's known risks, with its fix designed as step
1b". No step 1b and no such roadmap entry ever existed. Confirmed twice
independently, by full-text search of `ROADMAP.md`, and recorded as finding F27
of the documentation audit.

**Technical detail.** The boundary check itself is `hasUnclosedNegationBeforeSpan`
in `lib/negation-boundary-guard.js`, along with the pattern list
`NEGATION_LEAD_IN_RES` in the same file. `lib/verification.js` calls it from
inside `sanitizeFeatureQuotes`, which is the function `lib/parser-v2/store.js`
reaches at ingestion. Commit `c93b8eaf` "fix: a quote may no longer drop the
negation that governs it". Verify:
```
CI=true node --test tests/negation-boundary-guard.test.js \
  tests/canonical-v2-representations-dark-bridge.test.js
```
Re-run for this audit: 38 of 38 pass. A pass establishes the guard rejects a
quote whose governing negation was cut, on both the production ingestion path
and the preview bridge; it does not build the principled, position-before-trim
version, which is `PLAN.md` Step 3D as already noted above.

---

## Step 0E. Termination rights corroborated against the limb that grants the right

**What it was.** The termination family, meaning which party may exercise a
given termination right, was refusing nearly every candidate because the right's
own chapeau names no party. That describes most of Modiv's rights: the party is
named only down in each lettered limb's grant language, "by written notice from
Parent to the Company", and every limb names both parties, so a naive text match
would have attributed a right to the wrong side on roughly half of them. An
answer worse than refusing, because it reads as correct.

**Change.** Corroboration now anchors on the specific limb a candidate cites,
reads that limb's own grant direction ("from X to Y" grants to X), and fails
closed whenever the direction cannot be determined.

**Evidence.** Measured by replaying
`evidence/canonical-v2/modiv-termination-20260806/run-receipt.json` through the
real `resolveCandidates`, no reconstruction: resolved rises from 1 to 8, and
`TERMINATING_PARTY_REF_NOT_IN_QUOTE` falls from 12 to 0.

Proven to fail without the fix, two ways: the committed `resolution.json`
predates the fix and shows the pre-fix shape by construction, and
`candidate-resolution.js` was temporarily reverted to its pre-fix revision, on
which the replay reproduces `resolved: 1` exactly and 7 of the 10 committed
tests fail.

A hostile test proves the trap was not built into the fix: a cloned receipt with
the wrong party for that limb still queues and never resolves
(`tests/canonical-v2-termination-limb-grant-context.test.js`, "HOSTILE").

**Commit.** `fb7f1c64`.

**What it exposed.** Six of the twelve unblocked candidates now stop at a
different, pre-existing gate on four precisely identified vocabulary gaps.
Named, measured, left alone: `PLAN.md` Step 3A. A seventh reaches
`parseCurePeriod` and fails on a hyphenated spelled number: `PLAN.md` Step 3B.

**Technical detail.** The fix is two functions in
`lib/canonical-v2/native-producer/candidate-resolution.js`:
`parseTerminationLimbDirection`, which reads a limb's own "from X to Y" grant
language, and `findTerminationLimbGrantContext`, which anchors on the specific
limb a candidate cites and fails closed when the direction cannot be
determined. `resolveCandidates`, in the same file, is where corroboration
calls them. `parseCurePeriod` (Step 3B, above) lives in
`lib/canonical-v2/native-producer/cure-period-parse.js`. Commit `fb7f1c64`
"fix: corroborate a termination right against the limb that grants it". The
command above was re-run for this audit: 10 of 10 pass, including the HOSTILE
case. A pass establishes the corroboration logic is sound against constructed
cases; the 1-to-8 resolved-count jump is separately evidenced by replaying the
real recorded run, not by this test file alone.

---

## Step 0F. All 193 open-world candidates classified, 21 given a governed home

**What it was.** An open-world candidate is a fact the model found and the
taxonomy has no governed slot for, kept as evidence rather than discarded. The
sweep produced 193. Every one was traced to one of fifteen mechanisms.

**Three fixes landed, each verified by replaying the real recorded run.**

- **Antitrust's eleven were not a vocabulary gap at all.** The extraction runner
  was compiling contract version 34 while the resolver's own dispatch logic for
  those exact three obligation types had already shipped, built and tested, in
  version 38. The runner now compiles 38. All 11 get a governed home, 2
  resolving and 9 queueing honestly, with nothing that already resolved
  changing.
- **Material contracts was a genuine vocabulary gap**, now widened: seven
  synonym lists in `lib/taxonomy.js` (`MATERIAL_CONTRACT_BUCKET_META`), each
  hostile-tested, moving 10 of 26 open-world items to resolved with no
  regressions. Four are deliberately left alone because their text carries no
  lexical anchor at all, and widening for them would mean judging legal effect
  rather than adding words.
- **Representations needed one word in two places.** An UPREIT structure gives
  the target its own operating partnership, which makes representations
  alongside it, and nothing treated "the Partnership" as belonging to either
  side. Fixed in `anthropic-provider.js`'s `representationSideFor()` and in
  `PARTY_CAPACITY_LEXICON`.

**The trap in that last fix, recorded because it is the important part.** The
capacity list is scanned in order and first match wins, and Modiv also has a
buyer-side Parent OpCo which is itself a partnership. The new entry therefore
sits **after** the buyer patterns. Moving it earlier would silently attribute
the buyer's representations to the target. Verified both ways.

**Commit.** `34059a2f`. Per-item accounting:
`docs/codex-program/notes/open-world-ownership.md`.

**Evidence, and its limit.** None of the three is confirmed by a fresh paid model
call against the corrected code. What confirms them is replaying the
already-recorded run through the corrected resolver and vocabulary, which is
real evidence of a different kind. Suite green at 7,718 tests, 0 failures.

**A discrepancy worth knowing.** The note's own "net measured impact" section
says the representations half was specified and not applied. The commit
contradicts its own note: `git show 34059a2f -- lib/canonical-v2/native-producer/candidate-resolution.js`
shows the `PARTY_CAPACITY_LEXICON` entry present, with the ordering comment.
Trust the commit.

**Two findings recorded rather than fixed.** The capacity list assumes one party
per string and the corpus contains joint obligations naming five at once
(`PLAN.md` Step 3F). A merger sub named after the target matches the target
pattern first, wrong in principle though not currently reached.

**Technical detail.** Antitrust dispatch: `scripts/canonical-v2-live-extraction-run.mjs`
now calls `compileFixtureContractV38`, confirmed at the require and at both
call sites; `compileFixtureContractV34` is the prior, now-unused compile
target. Both are defined in `lib/canonical-v2/contract-bundle.js`. Material
contracts: `MATERIAL_CONTRACT_BUCKET_META` in `lib/taxonomy.js`.
Representations: `representationSideFor` and `PARTY_CAPACITY_LEXICON`, both in
`lib/canonical-v2/native-producer/anthropic-provider.js`. Commit `34059a2f`
"fix: give the open-world candidates a governed home". No single narrow replay
command is committed for this step; confirmation is the full suite (see the
verification run at the end of this document) plus
`docs/codex-program/notes/open-world-ownership.md`. As the step already says,
none of the three fixes is confirmed by a fresh paid model call.

---

## Step 0G. Proof that a V2 value crosses the wire, and its honest limits

**What it was.** The register that measures whether V2 data reaches a user works
by walking the import graph: which file imports which. V2 data reaches the
browser across an HTTP response, which no import graph can see. A new evidence
shape, `server_stamped_field`, names the exact JSON field a server function
stamps, the route that reaches it, and the client function that reads it, and
proves both halves independently against the real repository files.

**Evidence.** 30 new tests in `tests/canonical-v2-parity-serving-boundary.test.js`,
all against real files, never a synthetic string. Including the required hostile
case where two individually true facts about opposite ends do not correspond:
`attachCanonicalTerminationFeeServing` really does stamp
`canonical_v2_termination_fee_serving_enabled`, and
`partitionTerminationFeeCards` really does not read it, so the combined proof
correctly fails.

```
CI=true node --test tests/canonical-v2-parity-serving-boundary.test.js \
  tests/canonical-v2-parity-serving-path.test.js \
  tests/programme-gates/m3-family-parity-register.spec.js \
  tests/canonical-v2-m3-certification-control.test.js \
  tests/canonical-v2-m3-certification-control-v2.test.js
```
gave tests 95, pass 95, fail 0. Blockers fell 103 to 102.

**Commit.** `f7fec2fb`. Note pinned at `85bda8a2`:
`docs/codex-program/notes/serving-path-proof.md`.

**The most important finding in it is a negative.** The one surface that was
already marked visible, `termination-fee-query-fields` in `CompareColumn.jsx`,
**cannot honestly carry this evidence at all.** Checked exhaustively, not
sampled: all 26 of that file's top-level functions and every top-level constant
string, against all four termination-fee wire fields. Zero matches either way.
Its "visible" answer has only ever meant "compare mode's rendering machinery is
reached", never "V2 data crosses the HTTP boundary".

**What this mechanism still cannot prove, stated by its own author.** It cannot
execute an HTTP request or observe a real render. Proving a field name is
stamped and read proves the channel exists; it does not prove any value crossed
it, that the array is non-empty for any deal, or that the serving gate is true
in any environment a user reaches. The client half's reachability bar is
deliberately weaker than the server half's, and that weakness is demonstrated
rather than theorised: a `client_function` called only by dead code would pass.

That gap is why `PLAN.md` replaces the `P9_RENDER_PARITY` gate with a runtime
test rather than keeping it. `PLAN.md` Step 5C.

**Technical detail.** The server half is `attachCanonicalTerminationFeeServing`
in `lib/canonical-v2/termination-fee-serving-source.js`. The client half that
was checked and found not to read it is `partitionTerminationFeeCards` in
`components/review/table-configs/termination-fees.config.js`. The
`server_stamped_field` shape and its validator live in
`lib/canonical-v2/native-producer/m3-family-parity-register.js`. Commit
`f7fec2fb` "feat: prove a V2 value actually crosses the wire, and a second
family runs end to end". The command above was re-run for this audit: 95 of
95 pass, matching the count already given.

---

## Step 0H. Two sectionizer defects fixed, one with a tripwire

**What it was.** Two independent defects in the tool that cuts an agreement into
sections, both of which silently produced wrong data downstream.

- A fixed cap on section-title length meant a title longer than the cap was
  never recognised, so on one deal five whole sections including an entire
  article were folded into the section before them, and the wrong reference was
  stamped on what was kept. Commit `63a1fe3a`.
- A single letter "z" had no defined successor, so 112 references broke. The
  letter after z is aa, not nothing. Commit `991330ee`.

**Evidence.** The first is now checked by a tripwire that raises an alarm the
moment it recurs on any future filing.

**A correction recorded with it.** Three documents described the second defect as
an inner lettered list swallowing its successor. That is not the mechanism, and
neither defect requires an inner list at all. Two of the three documents still
carry the wrong description, which is finding F11 of the documentation audit.

**Known residue.** One already-committed live run,
`tests/fixtures/canonical-v2/f28-third-live-run/`, a Capitalisation item on
TopBuild, was produced before the fix. Forty of its entries cite a section
reference that does not exist in the agreement. The underlying bytes and the
model's own extracted reference were always correct; only the label a downstream
tool attached is wrong. This is mislabelling to regenerate, not lost data, and
regenerating committed evidence is Ben's call.

**Technical detail.** Both defects are in
`lib/canonical-v2/native-producer/deterministic-sectionizer.js`. The
title-length cap is the constant `INLINE_DECIMAL_HEADING_RE`, whose title
capture is now bounded at `{1,200}`, raised from `{1,78}`. The lettering
successor fix is the function `nextLetterSequence`. Commit subjects:
`63a1fe3a` "fix: stop the sectionizer silently losing whole sections of an
agreement", `991330ee` "fix: teach the sectionizer that the letter after z is
aa, not nothing". No single narrow command is committed for this step; both
are covered by `tests/canonical-v2-native-sectionizer.test.js`, re-run for
this audit at 35 of 35 pass.

---

## Step 0I. Session-cookie authentication, built and enforced

**What it was.** A login in front of the application. Edge middleware gating
every page and every `/api/**` route, not only the API surface, because two
pages fetch data through `getServerSideProps` calling `lib/` directly and never
pass through `pages/api/**`. An API-only gate would have left them open.

**Change.** `middleware.js` as the thin wrapper; all decision logic in
`lib/auth/gate.js` so it is unit-testable outside the Edge runtime; plus
`lib/auth/session.js`, `cookies.js`, `credentials.js`, `route-scan.js`,
`safe-next-path.js`, `pages/login.js`, and
`pages/api/auth/{login,logout,session}.js`. It fails closed: no `SESSION_SECRET`
means every request is refused.

**Evidence, and this is the point.** The test starts a real Next server through
`http.createServer` and makes real `fetch` requests. It is not a scan of source
text.

```
CI=true node --test tests/auth-route-enforcement.test.js
```
gives tests 101, pass 101, fail 0.

**Commit.** `2396bf50`.

**This corrects the record.** `ROADMAP.md` step S2 says "No `middleware.js` at
HEAD, no auth dependency in `package.json`", and its risk list says "There is no
authentication". Both are wrong, and were wrong on the day they were last
edited. Verify with `ls middleware.js` and
`git log -1 --format='%h %ad %s' --date=short -- middleware.js`.

**What remains.** Whether the deployed site has `AUTH_PASSWORD` and
`SESSION_SECRET` set, which is what makes the gate real rather than dormant:
`PLAN.md` Step 7A and 7B. And the four routes graded critical in July are still
503 stubs, with their repaired handlers dormant at
`lib/broad-corpus/contained-routes/`: `PLAN.md` Step 7C.

**Technical detail.** The fail-closed check reads `env.SESSION_SECRET` in
`lib/auth/gate.js`; the same absence surfaces to a request in `middleware.js`
("Session auth is not configured (SESSION_SECRET missing)"). Commit `2396bf50`
"feat: session-cookie authentication; fix a CI-only test divergence class",
a single 105-file commit that also carries Step 0K below (confirmed by `git
show --stat`, both `lib/auth/*` and `lib/programme-gates/governing-registry.js`
land in it together). The command above was re-run for this audit: 101 of 101
pass, matching the count already given.

---

## Step 0J. The merge to main

**What it was.** The branch was 287 commits and 910 files ahead of `main`, with
314,632 lines inserted, none of it ever tested as a merged unit. Production
tracks `main`.

**Evidence.** Three pull requests, checked directly against GitHub rather than
against another document:
`gh pr list --state merged --json number,title,mergedAt,baseRefName,headRefName`.
PR #476 merged 2026-08-05T21:55:41Z, #477 at 2026-08-06T00:30:37Z, #478, the
whole branch head, at 2026-08-06T09:51:01Z. `origin/main` is at `016288cb`. Each
landing commit's message records the suite green as CI runs it.

**Not verified.** Live-site verification after PR #478 was not independently
re-checked. `PLAN.md` Step 7B does it as a side effect.

**Still open in miniature.** Work continued on the branch after #478. Run
`git log --oneline origin/main..HEAD` for the current count rather than trusting
a figure; it moves while documentation-only commits land.

**Technical detail.** No `lib/` code to cite; this step is merge history. Both
claims re-checked for this audit and confirmed exactly: `gh pr view 476/477/478
--json number,title,mergedAt,baseRefName,headRefName` returns all three as
`MERGED` with the stated `headRefName` and `mergedAt` values, and
`git rev-parse --short origin/main` gives `016288cb`.

---

## Step 0K. The gate registry ratified, and the layer that checked nothing deleted

**What it was.** The 25 pre-production gates cannot be closed by design: the
loader throws if any gate's declared state is not `OPEN`, deliberately, so the
frozen contract stays byte-identical to what was reviewed. On top of that sat a
self-verifying acceptance layer that verified nothing. Ben ruled: keep the gates
that map to real engineering, delete the layer.

**Change, the deletion.** `lib/programme-gates/p9-acceptance-*` plus
`p9-definition-proposal-layer.js`, 1,001 lines across 5 modules, their 4 test
specs and the one script that wrote their evidence. Confirmed gone.

**Change, the live channel.** `computePreproductionGateStatus()` from line 134 of
`lib/programme-gates/governing-registry.js` re-derives evidence from primary
sources on every load, for exactly two gates.
`P1_CONTRACT_BUNDLE_COMPLETE` is proven by recompiling the frozen M1 contract
bundle twice uncached and checking both the byte-identical fingerprint and a
hash-pinned acknowledgement file's exact wording. `P1_VERTICAL_SLICE_PASS` is
proven by re-validating the committed attestation against its own tested
predicate.

**Evidence.**
```
node -e "const {createGoverningRegistryAuthority}=require('./lib/programme-gates/governing-registry.js');
const s=createGoverningRegistryAuthority().preproduction_gate_status;
console.log(Object.entries(s).filter(([,v])=>v.computed_state==='PASS').map(([k])=>k).join(','))"
```
gives `P1_CONTRACT_BUNDLE_COMPLETE,P1_VERTICAL_SLICE_PASS`. Every other gate
reports `OPEN` with reason `NO_MECHANICAL_VERIFIER_IMPLEMENTED`, structurally
rather than by oversight.

`CI=true node --test tests/programme-gates/governing-registry.spec.js` passes 30
of 30, including "gate closure is fail-closed: no verifier can ever launder an
unverified PASS claim" and "gate closure falls back to OPEN, not a thrown error,
when a verifier disagrees with pinned evidence".

**Commit.** `2396bf50`.

**Why this is the model.** These two gates are the only ones in the programme
that re-derive their answer from primary sources and fail loudly. Every
acceptance criterion in `PLAN.md` is written to that standard. The other 23
gates are disposed of in `PLAN.md` section 5.

**A correction that came with it.** Of 289 mandatory adversarial tests, 7 are
implemented and 282 throw "not implemented", not 8 and 281. The eighth,
`PREVIEW-AUTH-01`, was un-registered in the same commit because it matched
regular expressions against a script's source text and never issued a request.
That is a point in the catalogue's favour: someone found a decorative label and
removed it.

**Technical detail.** `computePreproductionGateStatus` is at line 134 of
`lib/programme-gates/governing-registry.js`; `createGoverningRegistryAuthority`
is at line 435. The deletion is confirmed current: searching the repository for
`p9-acceptance` now returns only the markdown doc
`docs/codex-program/P9-ACCEPTANCE-DEFINITIONS.md`, no code, and
`p9-definition-proposal-layer.js` returns nothing at all. Commit `2396bf50`
(the same commit as Step 0I above). Both commands above were re-run for this
audit and gave exactly the output shown. `DECISIONS.md` item 10 cites the
throw-unless-`OPEN` loader clause at line 267 of this same file; that line has
since moved to line 407 (`if (sourceRegistry.preproduction_gates.some((gate)
=> gate.state !== 'OPEN')) throw ...`), because this commit inserted the
`computePreproductionGateStatus` re-derivation logic above it. The clause
itself is unchanged, only its position.

---

## Step 0L. The documentation audited against the running system

**What it was.** Twenty-eight ways the documents and the system had drifted
apart, each checked against a primary source rather than against another
document.

**Commit.** `cb2a7ce0`. `docs/codex-program/notes/doc-reality-audit.md`.

**Why it belongs in a completed record.** It established the standard the rest of
this programme now works to: an acceptance criterion should be re-derived from
primary sources and fail loudly, not asserted by a person. Several of its
findings were confident numbers that came from plausible reasoning, including a
headline finding that a section started 1,450 bytes late, which was a units
error: a JavaScript string index counts UTF-16 code units and this pipeline
slices by UTF-8 bytes. That single error class has produced three separate
confident false findings in this project. A conversion helper exists.

**Still outstanding from it.** Most findings are corrections to documents that
`PLAN.md` and this file supersede, so they close by replacement. The ones that
are not document drift are carried as steps: F6, the test-executable registry
does not check whether its own listed files still exist, and F12, the same
verbatim-substring defect shape recurs under `_ref`-suffixed fields across at
least eight producer prompts and none has been checked.

**Technical detail.** No `lib/` code changed. Commit `cb2a7ce0` "docs: audit
the documentation against the running system, 28 findings", one file,
`docs/codex-program/notes/doc-reality-audit.md`, 1,167 lines added.

---

## What none of the above amounts to

Read this before quoting any of it.

Extraction is proven across 25 families on essentially one agreement, and four
of those 25 runs did not complete. **Nothing has been imported durably into the
product's database.** The schema for it is 8,686 lines; it has been executed
against isolated staging and rolled back (`docs/parked/process-intelligence/EXECUTION-LEDGER.md`,
P8), never durably. A previous version of this paragraph said it had "never been
executed", which was false — see `CODEBASE-GUIDE.md` section 9. **Nothing V2
renders on the live site**, and that is by construction: production is denied
outright by `isPermittedCanonicalV2Runtime`. One family serves V2 data on a
preview deployment, from a hand-typed fixture file.

The volume of work here is real and it has not reached a user.

---

## Step 6A. Tables no longer steal each other's cards

**Closed 2026-08-07 by moving it here, not by implementing it.** The work was
already done on 2026-08-05 in commit `7042085`, which added
`isClaimedByAnotherFamily` guards to all four review-table configs Step 6A
listed as "Remaining" — `misc-boilerplate`, `antitrust-regulatory`,
`termination-rights`, `mae-definitions` — plus `advisers-fees-expenses`, a
sixth the step never named.

**What it was for.** Five review tables decided which cards belonged to them
partly by searching the card's text for a phrase, which pulled other families'
cards into the wrong table. One real corpus card leaked: a buyer financing
representation appearing as the evidence behind a termination-fee row. The
worse reachable case was a sole-remedy card landing in the fee table and
flipping "Sole and exclusive remedy" from No to Yes depending on card order.

**Evidence.** Commit `7042085`, plus the per-table tests that already assert
the criteria: `tests/misc-boilerplate-card-selection.test.js`,
`tests/termination-fee-card-selection.test.js` and siblings. Each asserts both
halves — a card another family owns is refused, and a genuine subtype-less
card is still caught.

**Why it is worth recording rather than quietly deleting.** The step was
written into a plan dated 2026-08-06 describing the state of 2026-08-05, and
would have "gone green" with zero work done. That is this project's documented
failure mode occurring inside the document that warns about it.

## Step 8B. The search field registry was already correct

**Closed 2026-08-07 by moving it here, not by implementing it.** Same commit,
`7042085`.

**What it was for.** The step asserted 104 of the search registry's entries
were shadowed — that `resolveKey(entry.key)` did not return `entry.key`.
**Measured at HEAD: 0 of 699 shadowed, not 104.** The test passes, 8
assertions.

**The constraint that outlived the step**, carried into
`CODEBASE-GUIDE.md` rather than lost with it: the registry must be fixed
through its generator. Hand-editing `lib/query/serving-registry-v1.json`
passes a naive test and the next regeneration reinstates every error. That is
a live constraint on anyone touching it, not a fact about a closed step.

---

# Stage 1, the Stage 2 prerequisite, Stage 3 and the first of Stage 4

All closed on 2026-08-07. Each moved here when its own proof passed, per this
document's rule. Steps 4A2 and 4A3 are closed too but stay in `PLAN.md` until
their adversarial review returns.

## Step 1A. Every gate is bound to a step, mechanically

`tests/programme-gates/gates-bound-to-plan.test.js` reads
`programme-gates.yaml` and fails unless each gate identifier appears next to a
step label or "Retired" in `PLAN.md` or `COMPLETED.md`, on one line. The YAML
stays frozen and is bound from outside, because `governing-registry.js:422`
throws unless it deep-equals a hardcoded contract and 14 files read it.

**Evidence.** Exit 0, and **deleting any one disposition row makes it fail** —
run, not reasoned about, then restored.

**It found something.** The first implementation bound 25 of 32 identifiers and
disclosed the gap. The seven omitted were `phase_12_security_gates`: bare ids
with a state, no acceptance criteria, mentioned nowhere in either document.
Step 7D dispositions them; the test now binds all 32 with its matching rule
unchanged, because loosening it to admit a bare "Deferred" would have reopened
the hole from the other side.

## Prerequisite. Both M3 auto-pass conditions are wired

`lexical_disagreement` evaluates. `v1v2_comparison` is wired and cannot be
evaluated — all three committed V1 snapshot fixtures lack
`snapshot_identity_evidence`, which `v1v2-comparator.js:557` requires — so
**Ben released it explicitly on 2026-08-07** (`DECISIONS.md` decision 4). Every
run records `m3_auto_pass_conditions` naming each condition `EVALUATED` or
`NOT_EVALUATED`; a rung whose evidence lacks that record is incomplete.

**What wiring it proved.** Replaying `modiv-no-shop` left the counts unchanged
at 42 resolved and replaced `LEXICAL_DISAGREEMENT_NET_ABSENT` on **all 42**
claims with real outcomes. **The gate had been green on 42 claims it had never
examined.**

`PLAN.md` named both modules at paths that do not exist, missing
`native-producer/`. Corrected.

## Steps 3A and 3A1. Termination trigger vocabulary, widened then made safe

Four real Modiv phrasings matched nothing, so six legitimate grounds queued.
Replay through the real resolver: **resolved 8 to 12**, the step's exact
target, with the two null-`trigger_kind` candidates still queuing rather than
forced.

**3A opened a wrong-answer path, and 3A1 closed it.** `enters?` also matches
"enter", so `NO_SOLICITATION_BREACH` corroborated the Company's own
fiduciary-out — the adjacent ground in every Article VII. A mislabel that used
to queue *resolved* as a no-shop breach by the target. **Not hypothetical: the
same false positive was found live in Skechers' filed agreement, §5.3(d).**
Closed by excluding quotes carrying "Superior Proposal", which is always the
fiduciary-out ground. Replay still resolves 12.

**The transferable lesson.** All eight original hostile tests were
*quote-fixed, kind-varied* against vocabulary disjoint across kinds, so they
passed by construction. **A hostile test that varies the label rather than the
text tests the wrong axis.**

## Step 3B. The number parser reads hyphenated compounds

The preceding-word scan stopped at hyphens, so "forty-five (45)" read back
"five" and compared 5 against 45. `SPELLED_DIGIT_MISMATCH` on the Modiv replay
goes 1 to 0.

**Not a pure widening, and the header says so.** "twenty-five (5) days" used to
resolve and now abstains — the genuine contradiction the table exists to
detect, which reading only the last component was hiding. Checked by running
both strings, not by reading the code. No compound above one hundred exists in
the corpus; searched, not assumed, so none was invented.

## Step 3C. Specific Performance's grant is no longer discarded

`isIncompleteSpecificPerformanceGrant` tested the quote for the operative
premise with a stricter regex than the source-side check twelve lines above
tested the source for the same premise. Modiv §8.8 splits the clause and writes
"monetary" for "money", so a verbatim grant was discarded. Replay: **0
proposals and 1 residual before, 1 proposal and 0 residuals after.**

**Adversarial review: merge**, having found the old predicate failed **two of
the three real premise drafts in the corpus** — it was testing house style, not
the premise.

## Step 3D. A trimmed governing negation is refused at the resolver

`claimGoverningNegationTrimmed` uses a claim's byte-verified evidence span plus
its section's absolute start to locate it in the filed document, then checks
the negation guard against a bounded byte window before it. Wired into
`BRING_DOWN_TIER_CLAIM_KEY`, the one path with no check tying `raw_value` to
`canonical_value`.

Measured against the pre-fix resolver on real TopBuild text: the attack
resolved clean with no review flag, and is now refused.

**Deliberately partial.** Not wired into the other ACCURACY path, because
Modiv's "(y) that are not qualified by materiality" legitimately trips the
guard on the only quote shape that path resolves. Recorded at the function.

## Step 3E. Stopped, deliberately, and found more than it fixed

Re-running the rejected negation fix reproduced the known false positive **and
found a second one the design note did not have**. The blocker is broader than
recorded, so nothing shipped half-right and the measurements are pinned as
runnable tests. The step's own escape hatch, used as written.

## Steps 3F and 3F1. Joint obligations, and the trap that escaped quarantine

`resolvePartyCapacity` took the first match on a string naming five parties. It
now segments on the string's own conjunctions and returns
`JOINT_MULTI_PARTY_CAPACITY` when segments span more than one **side**. Keying
on side rather than capacity is load-bearing: a capacity-keyed version wrongly
flagged "Each of Parent and Merger Sub".

**The step's own named safety net did not exist.** Before this change **no test
file referenced `resolvePartyCapacity` at all** — checked with `git grep`
against the parent commit. The Parent OpCo ordering trap lived in a commit
message and in prose, enforced by nothing, so any reordering would have
silently attributed the buyer's representations to the target.

**3F1 closed what 3F opened.** Per-segment scanning sent "Company Merger Sub"
to TARGET, so **Modiv's real buyer group read as spanning both sides**. The
merger-sub trap's quarantine — "not currently reached by any single-party
candidate" — was true when written and stopped being true the moment 3F built
a path reaching it on every multi-party string. Also gave
`JOINT_MULTI_PARTY_CAPACITY` a downstream contract: projections refuse it
explicitly rather than dropping or leaking it to a page.

## Step 3G. Four located resolver defects

Open-world across the four families **67 to 32, a fall of 35** against a bar of
30, by replaying committed evidence through the real resolver.

**Adversarial review re-derived all four counts independently and returned
merge with four conditions, all closed.** The conditions mattered more than the
counts: the Material Contracts contradiction gate caught only digits, so "ten
largest customers" and "two hundred fifty thousand dollars" slipped through; a
Transaction Litigation quote corroborated as **both** `COV-NOTIFY` and
`COV-LITNOTIFY`, which route to different owners, with nothing detecting the
double fire; the transfer-tax gate had silently dropped its mandatory
cooperation conjunction, so a unilateral filing clause read as a cooperation
covenant; and a comment stated the classifier's contract wrongly.

**None of the four moved a count.** The shapes do not appear in this evidence
pack, so no measurement could have surfaced them. That is why the review
checked predicates rather than numbers.

## Step 3I. Payment timing and grounds naming

**The grounds-naming half was already built** — committed 6 August in
`c42ceae7`, the day before, while the plan listed it as open. Verified by
replaying real Modiv evidence.

Payment timing needed real work, and the coded form needed a codebook decision
reserved to Ben. A Modiv-only sidecar emits each of the six fee-trigger
branches' payment-timing text verbatim and cited. Ben later ruled the coded
form (`DECISIONS.md` decision 5); that is Steps 3J, 3J1 and 3J2.

## Step 4A. The schema executes durably, and the two writers disagreed

`foundation.sql` applied to `postgres:16-alpine` with **no errors**. A real
bridge-composed write-set went through `canonical_v2_write` **committed, never
rolled back**: 3 claims in, 3 rows in `claim_revisions`, JS and SQL receipt
identities identical, reproduced on a second fresh container.

**The finding it existed to produce:** `STRUCTURAL_PROVISION_INSTANCE/V1`
appeared **zero times** in all 8,686 lines of schema while four `lib/` files
build it. Six of fifteen claim-publishing families could not be imported at
all. That is Step 4A1.

Also learned: a `DEAL_SCOPE_RUN` call needs its source chain persisted by three
prior writes. The JS bridge never needed this because it rebuilds in memory.

## Step 4A1. The SQL writer learned that a provision can have no party

Two strict branches keyed on `schema_version`, not one relaxed branch. An
unrecognised version falls to the party-bearing branch and fails, so the split
is fail-closed. All six previously rejected families import durably with
matching JS and SQL receipt identities: `CONSIDERATION` 1, `PROXY_MEETING` 2,
`DNO_INDEMNIFICATION` 4, `TERMINATION_FEE` 4, `MISC_BOILERPLATE` 14,
`MERGER_STRUCTURE_CLOSING` 20. **Fifteen of fifteen now importable, up from
nine.**

**Adversarial review: merge with one condition**, having stood up its own
container, re-derived two families, and failed to find an extra-key hole. The
condition was a real miss — a staging script pinned the *old* error message for
two probes that now hit the new shape check, and **no CI test exercises it
because it needs a live database.**
