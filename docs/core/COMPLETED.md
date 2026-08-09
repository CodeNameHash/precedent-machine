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

## Steps 4A2 and 4A3. The headline number reaches the database

**Closed 2026-08-07.** Ben's decision 3: `conditional_termination_fee_values`
gets a table, because two of the ten cards a termination-fee run projects come
from that kind — **including the Modiv headline number**, the figure a user
looks at first.

**4A2, the database side.** The table exists, shaped to the JS kind, with
`DEAL_SCOPE_RUN` shape-checking it, recomputing its identity in the database
and writing it. Six real Modiv values written durably; `count(*)` returned 6
from a fresh connection after the writer exited; JS and SQL receipt identities
matched. Four hostile probes: a well-formed control accepted; extra-key,
missing-key and wrong-enum rows refused naming the **shape** rather than the
lineage; a duplicate id refused separately.

**The headline round trip nearly produced a false alarm**, and that is the
part worth keeping. A naive `JSON.stringify` comparison first reported a
mismatch, because **Postgres `jsonb` reorders object keys on output**. The
real comparison uses this codebase's own `canonicalJson`, the same sorted-key
form `content_id` hashes. Documented so a future session does not read it as
corruption.

**4A3, the pipeline side, which 4A2 disclosed was missing.** The adapter and
the write-set validator contained **zero** references to the kind — checked by
grep. The resolver produced the values and the projection read them, and the
write-set never carried them. So 4A2 alone meant "the database *can hold* the
headline number", not "the headline number *reaches* the database".

Closed by carrying the kind through the adapter and both validators. A real
run's own write-set — re-derived through `buildNativeWriteSet`, **with no
manual splicing** — put six values in the table, and the `$10,000,000` row
round-tripped byte-identical with a digest matching 4A2's hand-built harness.
The harness proved the SQL; this proved the pipeline; the two agree.

**The wiring pin was verified to fail, not merely to exist.** Reverting the
adapter change alone takes the test from 10 passing to 5 passing and 5
failing; restoring returns 10.

**A third shape gate had to be widened, and that is the finding.**
`canonical-writer.js`'s `assertDealScopeWriteSetShape` runs its own
independent closed-key check **before** the validator runs at all, and
rejected the new key until widened. Had it been missed, **the real bridge
would have stayed silently blocked while every targeted test passed.** So an
optional write-set key needs updating in **three** places, and nothing keeps
them in sync but tests — the same shape as the three digest guards over a
schema edit, found the same day.

**Adversarial review: merge**, having re-derived two families on its own fresh
container and failed to find an extra-key hole. Its one condition — a staging
script pinning the old error message, which **no CI test exercises because it
needs a live database** — was fixed at `02ebc588`.

## Step 2F-BREAK-5/6. Two families that wrote claims and could not serve one

**What it was.** `MAE_DEFINITION` resolved 38 claims on TopBuild, wrote all of
them durably, and **threw on every attempt to render them**. `NO_OTHER_REPS_FRAUD`
threw on all three committed runs of the family, across both documents.

**MAE was a validator encoding one drafter's style as a rule.** The projection
required every clause label to appear inside the claim quote. That is true of a
`TRAILING_LIST` proviso, which recites the clauses it reaches — the recitation is
the only evidence of its scope — and false of a `PER_LIMB` enumeration marker,
which precedes the clause body, so a correctly narrowed quote can never contain
it.

**The resolver had already been corrected for exactly this, on 2026-08-07, and
the projection was never updated.** `handleMaeDisproportionalityCandidate` had
carried the identical rule; `mae-clause-label.md` replaced it with a three-tier
check for `PER_LIMB` only, deliberately leaving `TRAILING_LIST` alone, for
BREAK 5's reason. That change is what turned the 0806 run's 2 resolved claims
into the 0807 replay's 19. The projection kept the old rule for another day.

**Replacement, not deletion.** Tier 1 is the original substring check, so every
existing fixture takes a byte-identical path. Tier 2 is `PER_LIMB` only and
requires the label to appear in the entry's `governing_context_quote`, that
context to contain the quote verbatim, and the label to sit at or before where
the quote starts. New typed code `CARVEBACK_CLAUSE_LABEL_UNGROUNDED`.

**Evidence.**

| Family | Run | Before | After |
|---|---|---|---|
| `MAE_DEFINITION` | TopBuild rung 4 | **THROWS** | 38 records, 2 rollups, 2 cards |
| `MAE_DEFINITION` | TopBuild 0807 replay | **THROWS** | 19 records, 1 rollup, 1 card |
| `MAE_DEFINITION` | Modiv 0807 live | 8 records, 2 rollups, 2 cards | **unchanged** |
| `KEY_DEFINED_TERMS` (same module) | TopBuild / Modiv | 21 / 10 | **unchanged** |
| `NO_OTHER_REPS_FRAUD` | all three runs | **THROWS x3** | 3 facts x 4 surfaces on all three |

All 10 guards were proved to fire by neutering each in turn and watching the new
test fail, then restoring. That exercise caught two real problems: two guards
shared one error code, so neutering the first changed nothing; and a hostile test
using a nonsense label never reached the guard at all, because the rollup builder
quarantines it first.

**Also found, not fixed.** Modiv's MAE disproportionality relationship is
**entirely unestablished and always has been** — 0 covered limbs, 6
`UNRESOLVED_CARVEOUT_LIMB_NO_OPEN_WORLD_EVIDENCE` per rollup. The document where
this check appeared to pass was never producing a relationship at all. TopBuild
now produces 10.

**Verification.** `tests/canonical-v2-step-2f-breaks-5-6.test.js` 11/11 exit 0;
19 consumer files 315/315 exit 0; authority-boundary and readiness 24/24 exit 0;
`forbidden-patterns.sh` exit 0. Commit `e967df5f`.

## Step 2F-BREAK-2/3. Two families that returned three empty arrays on text containing their content

**What it was.** `GUARANTY_FINANCING_PARTY` returned
`{"guaranty_assertions":[],"financing_mechanics":[],"open_world_candidates":[]}`
on TopBuild §7.16 "Waiver of Claims Against Financing Sources" — a textbook
non-recourse clause on a $600,000,000 debt-financed acquisition. `DIVIDENDS`
returned the same three empty arrays on §4.1 and §4.2, which plainly contain
"declare, set aside or pay any dividend".

**Step 2F's falsifiable prediction is resolved: the guaranty family was broken,
not correctly quiet.** Its instruction opened "Extract quoted positive guaranty
facts only", which scoped the entire response including
`FINANCING_PARTY_PROTECTION` — the surface that exists to carry exactly this
content. The model followed that scope and said so verbatim in the recording:
"it's a lender-liability waiver, a distinct mechanism". v2 scopes "positive facts
only" to `guaranty_assertions`. The "never infer" list is unchanged: a guaranty
family that invents a cap is worse than one that finds nothing.

**BREAK 3's recorded diagnosis was wrong and is corrected.** Step 2F said the
family "does not find its own content when the content is a limb rather than a
section". In fact v1 already excluded IOC restrictions by design, TopBuild's
dividend language **is** one — limb (vi)(A) of a thirty-limb covenant — and
`INTERIM_OPERATING` resolved 29 claims from the same two sections. The governed
emptiness was correct. The real defect was the empty third array, which lost the
Series B / Convertible Perpetual Preferred carve-out that v1's own text says
"remain open world".

**Evidence — verified by live extraction on both documents, not by reasoning.**

| Family | Document | v1 claims / excerpts / open-world | v2 |
|---|---|---|---|
| `GUARANTY_FINANCING_PARTY` | TopBuild §7.16 | 0 / 0 / 0 | 0 / **4** / **4** |
| `DIVIDENDS` | TopBuild §4.1, §4.2 | 0 / 0 / 0 | 0 / **6** / **6** |
| `DIVIDENDS` | Modiv §5.10 | 0 / 0 / 0 | 0 / **4** / **4** |
| `GUARANTY_FINANCING_PARTY` | Modiv §5.11 | 0 / 0 / 0 | 0 / 0 / 0 — correct |

**14 rows recovered across two deals, and nothing invented where zero is right.**
That last row is the regression test that mattered: Modiv is unfinanced, and a
prompt change that pushes a model to fill an empty list is how "a family
returning zero can be correct" gets violated. It held. Modiv's §5.10 was losing
content too — the false zero was never TopBuild-specific.

**Still open, recorded as Steps 2F2 and 2F3:** all four TopBuild rows resolved to
open world rather than governed claims, because the taxonomy has no governed home
for a standalone financing-source protection; and Modiv's guaranty family is
pinned to a section headed "Other Transactions". Commit `e967df5f`,
`docs/codex-program/notes/step-2f-breaks-2-3.md`.

## Step 2F-CLOSURE-ID. Replay reported itself as the model, so claim identity depended on a filesystem path

**What it was.** `model_id` under replay was the string `replay(<path>)`. It
feeds `producer_receipt_id`, which feeds `closure_id`. So the same recorded
evidence replayed from two directories minted two different identities for
identical claims. This was already shipped, not hypothetical: committed evidence
carried `replay(evidence/canonical-v2/modiv-antitrust-20260806)` for most runs and
a `/tmp/.../scratchpad/replay-src-consideration` path for two others.

**Replay is a transport, not a producer.** The text it serves was produced by the
live model, so it now reports that model's identity, read from the replayed run's
own `run-receipt.json`. `resolveOriginalProviderModelId` is the single place that
question is answered, and it throws rather than guess:
`REPLAY_MODEL_IDENTITY_UNKNOWN` for a receipt-less run,
`REPLAY_MODEL_IDENTITY_AMBIGUOUS` for a run produced by two models,
`REPLAY_MODEL_IDENTITY_CONFLICT` when an operator contradicts the record.

**Evidence.** One run replayed from two different directories: 33 `closure_id`s,
1 `producer_receipt_id`, 21 `excerpt_id`s, 1 `input_scope_digest` — **identical
across both**. Against the original live run, `model_id` and `prompt_digest` now
match; the residual `input_scope_digest` difference is real content drift in the
contract bundle since 6 August, which is what `closure_id` exists to detect.

Recordings gain `provider_model_id` (schema V2; V1 stays readable — 24 exist and
re-recording costs real model calls, and every one of them has a sibling receipt
carrying the true identity). `--replay-model-id` lets an operator state the
identity of a hand-assembled fixture set, checked against the record rather than
trusted over it. 19/19 tests, `forbidden-patterns.sh` exit 0. Commit `e967df5f`.

## Step 2F-OVERFLOW. A response over the output ceiling parsed and presented as complete

**What it was.** Four calls produced what looked like multiple top-level JSON
objects and were refused as malformed. They were tail fragments of **one** answer
whose head the transport destroyed: all four exceeded the CLI's 64,000-token
output ceiling (71,907 / 71,430 / 65,210 / 74,080), and each recorded response's
length matched the final `usage.iterations` entry exactly, because the runner
takes only the CLI's last message. The counted "objects" were heterogeneous array
*elements* — 18 qualifiers, 17 quote/target pairs, 16 share counts — not
candidate answers, so neither accumulating nor superseding them has a valid
reading. The parser's refusal was correct under a wrong diagnosis.

**The fifth data point closed it.** Modiv NO_SHOP §5.6 used 65,008 tokens and
**succeeded**, because its truncation boundary fell inside thinking rather than
inside JSON. Over-ceiling success is a coin flip.

**Change.** Overflow is a typed, non-retryable failure
(`RESPONSE_TRUNCATED_BY_OUTPUT_CEILING`), checked **before** parsing and before
the response-size check, from the predicate `output_tokens >= maxOutputTokens`
that telemetry already recorded and nothing read. It is arithmetic only — content
is never inspected, because a family returning zero can be correct — and it fires
even when the last message parses cleanly, which is the whole point.

**Verification.** 11 hostile tests including: fires on a cleanly-parseable
response; never retried, by call count; wins over `MALFORMED_RESPONSE` on garbage
text, proving it precedes parsing; an empty-but-well-formed response under the
ceiling still succeeds, proving content-independence; exact `>=` boundary at
63999/64000; an under-ceiling ambiguous response still refuses as `AMBIGUOUS`,
untouched. 44/44 and 178/178 exit 0. Commit `e967df5f`.

**The ruling's other half — raising the ceiling — works, and was nearly recorded
here as impossible.** A static read of the installed CLI's minified per-model
resolver says `upperLimit` is 64,000 on every branch including the fallback the
runner takes. Two independent readings agreed, and it was written up as
established. The experiment refuted it: TopBuild NO_SHOP §4.3 under
`CLAUDE_CODE_MAX_OUTPUT_TOKENS=128000` returned **69,576 output tokens** and
**67 publishable claims**, on a family that had never extracted anything on that
document. `CLI_MAX_OUTPUT_TOKENS = 128000` now ships in `childEnv()`.

**The guard could not fire, which is why none of this was caught by it.** The
overflow check reads `response.provider_usage ?? response.usage`; the runner's
measured CLI client returned content with no `usage`, recording it to telemetry
only. So the check read `null` on every real run — including the 69,576-token one
— and the 11 tests that prove it works all inject usage the production path never
supplied. Fixed by carrying `usage` on the response and setting the provider's
`maxOutputTokens` to the same figure the CLI is asked for.

Two lessons, both already in CLAUDE.md and both re-learnt the hard way: a
minified table is not the behaviour, and a guard proven by tests is not a guard
proven in production. Remaining questions are Step 2F1.

---

## Step 2X-PRE. Four resolver fixes, a segmenter adopted, and absence copy made honest

**Closed 2026-08-08.** Gates, run on a clean machine with nothing else on it,
exit codes captured to files and read back rather than piped:
`CI=true npm test` exit 0 — 8,300 tests, 8,255 pass, 0 fail, 45 skipped;
`npm run build` exit 0; `scripts/lint/forbidden-patterns.sh` exit 0,
INVARIANT-4 PASS.

**What landed.**

*Termination.* Two new limb grammars, a third grant tier for section-chapeau
mutual grants, and party-scope derived when the model emits null — limb
direction, then section either-grant, then `PARTY_ROLE_ALIASES` from
`lib/vocab/party-role-aliases.js`. Trigger corroboration now consumes
`TERMF_TRIGGER_META` through an explicit V2→V1 code map with the AND and
exclusion gates preserved. `TERMINATING_PARTY_REF_NOT_IN_QUOTE` fell from 60 to
about 3 corpus-wide. Modiv held at 12 → 12 as the regression pin.

*IOC.* `ioc-corroboration.js` consumes `ioc-categories.js` as a fail-closed
second chance, tried only when the primary test matches nothing, refusing on
cross-vocabulary ambiguity and carrying typed provenance.
`CATEGORY_UNCORROBORATED` fell from 105 to 33; Concho went 20 → 34, which is
card 04 and both its siblings — "Organizational Documents" now reaches
IOC-CHARTER.

*MAE carve-out scoping.* Scoped to the candidate's own definition record before
adjacency verification, plus a structural containment tier over
`segmentSubClauses`. SkyWater 18 → 28, Modiv 10 → 24, TopBuild unchanged at 19
as required.

*Qualifier host-composition.* The lexicon now consumes `MATERIALITY_CODES` from
`lib/taxonomy.js` with a load-time membership assertion. Red Hat 13 → 32,
Metsera 6 → 13, TopBuild 0 → 7.

*Sub-clause segmentation.* `segmentSubClauses` gained a third CHILD-OPEN
condition: a colon-introduced inline enumeration opens a child when the colon is
the immediate lead-up, whitespace aside. The decisive check was whether Redfin
§2.10's pinned un-split runs are colon-introduced — they are not, both are plain
prose lead-ins, verified against the fixture, so the pinned expectation did not
have to be weakened. **Guard proof:** neutering the predicate fails the Metsera
colon-introduced (A)-(J) carve-out test; restoring it returns 8/8.

*Absence copy.* 14 unsafe wordings across 11 config files now reuse
`CONDITION_ABSENT_COPY`. The count was re-derived rather than trusted; the
earlier sweep's "11 across 10 files" missed a per-cell string in
`termination-rights.config.js` `keyTermsNode()` that a table-level grep could
not see.

**Acceptance evidence.** The blind 96-card sample re-scored: 21 now resolve,
concentrated entirely in the four staged reason codes —
`TERMINATING_PARTY_REF_NOT_IN_QUOTE` 7/8, `CLAUSE_LABEL_NOT_IN_QUOTE` 6/8,
`QUALIFIER_KIND_UNCLASSIFIED` 4/8, `CATEGORY_UNCORROBORATED` 4/8 — and every one
of the eight untouched strata at 0/8. The eight zeros are the result that
matters: nothing moved by accident. Re-derived by joining the re-score to the
blind key on card id rather than accepting the reported table.

**Two errors corrected in the record.** `review_queue` is the full attempted
claim set, not a reject pile alongside `resolved`; adding the two together
produced a reported 34.6% corpus rate and 18.3% for representations, both wrong.
The correct figures are 52.8% and 22.4%, using `resolved / review_queue`. And
process liveness was twice reported from `pgrep -fc`, which matches the checking
shell's own argv — the same self-match that produced false "still running"
reports overnight. Counting via `/proc` with the checking shell excluded gives
the real answer.

---

## Steps 2X-D, 2X-L and 2X-E. The first limb tree, and the MAE split reverted

**Closed 2026-08-08**, later the same day as Step 2X-PRE.

**2X-D — the MAE materiality split reverted.** `MAT_MAE_AGGREGATE` no longer
emitted; the duplicate key in `lib/taxonomy.js` documented rather than deleted,
since deleting either entry would break stored V1 claims. The proof is a replay
at zero model calls against post-revert code: **resolved count unchanged at 32,
all 13 affected claims reclassify to `MAT_MAE_QUALIFIED`, zero residuals, zero
quarantines, validation accepted.** Nothing was lost by collapsing the two
codes, which is exactly what Ben's ruling predicted — the two drafting variants
are one legal standard.

Two corrections belong in the record. The affected figure is **13 claims, not
26**; the larger number counted raw string occurrences across three files rather
than distinct claims. And the change arrived with a stale premise: its own
comment justified narrowing the allowed-value set on the grounds that no
committed evidence carried the retired code. True on the branch that authored
it, false here, because 2X-L's replay evidence landed first. Re-validating that
evidence produces `INVALID_CANONICAL_VALUE` residuals and quarantines rather
than silent acceptance — the loud failure, which is the one we want.

**2X-L — the limb tree minted, for the first time in 202 runs.** The Red Hat
replay carries 2 `limb_component_trees` with 7 path nodes and 6 assertion nodes.
Path nodes carry the outline skeleton and no span of their own; assertion nodes
carry the byte-verified facts. So a fact knows its limb and the limb knows its
lineage.

**It is not accepted yet, and Step 2X-L1 exists to hold it to account.** The
model emitted **69 limbs** across those two sections; six assertion nodes were
minted; `residuals` is zero. A shortfall with zero residuals is indistinguishable
from a silent drop — the same signature as the open-world defect fixed earlier
the same day. Many of the 69 may be genuine cross-references correctly declined,
which the receipt's `limb_enumeration_scan` could show, but "correctly declined"
and "silently dropped" look identical from outside when nothing is recorded.

**Step 2X-L1 closed the account** — see the section below. All 69 limbs traced;
replay evidence refreshed without `MAT_MAE_AGGREGATE`.

**2X-E — absence copy.** 14 unsafe wordings across 11 config files now use
`CONDITION_ABSENT_COPY`, verified as zero remaining. The termination-fees
provenance pill was deliberately **not** ported: no other family has a genuine
second extraction source, and inventing one would fabricate a signal.

**Segmenter improvements**, both measured against a 538-section corpus harness
rather than assumed. `(x)/(y)/(z)` list opening: **zero** added mis-nests, 19
markers newly captured. `MAX_DEPTH` 3 → 5: **+0.186 percentage points** of
mis-nest rate against **+62** markers newly captured across 7 sections. The
first is free; the second is a real trade, taken because a flagged marker is
visible rather than wrong.

---

## The merge. 207 commits to `main`, 2026-08-08

**Merged as `c40b7bb1`.** Gates on a quiet machine, exit codes captured to files
and read back rather than piped: `CI=true npm test` exit 0 — 8,319 tests, 8,274
pass, **0 fail**, 45 skipped; `npm run build` exit 0;
`scripts/lint/forbidden-patterns.sh` exit 0, INVARIANT-4 PASS.

**Re-verified after the merge, not only before it.** `main` had moved — it
carried commits from PR #480 that were not on the branch — so the merged tree
was code neither gate run had seen. Post-merge suite exit 0, post-merge build
exit 0. A pre-merge green on a branch is not evidence about the merge result,
and this is the second time today that a gate run measured a tree which had
changed underneath it.

**The three blockers, and how each closed.**

1. The MAE materiality split, decided wrong and still in the code. Closed by
   integrating 2X-D and replaying the affected run at zero model calls:
   resolved count unchanged at 32, all 13 claims reclassify to
   `MAT_MAE_QUALIFIED`, zero residuals, zero quarantines.
2. Eleven commits tagged UNREVIEWED or wip — not the seven first recorded.
   Closed by two reviewers on separate slices. One real defect: two
   termination-limb unit tests built a minimal `admittedSourceContext` missing
   `canonical_text_id`, which this branch's code path asserts as a full SHA-256.
   Fixed by computing the real digest of the fixture's own text, since a
   placeholder would pass the format check while lying about what it
   identifies. Both reviewers independently confirmed **no test was weakened to
   make a change pass**, and the Redfin §2.10 expectation — the cheapest one to
   soften — is untouched.
3. Nothing user-facing live-verified. Closed as far as this environment allows:
   the app builds and serves, but every route redirects to `/login` and no
   credentials exist here, so the changed surface was verified at
   component-input level — zero unsafe absence strings across 11 configs, and
   the rendered string resolves to "Not found (may not be present, or not yet
   extracted)". Stronger than a green build, weaker than a screenshot, and
   recorded as such.

**Three red herrings, all chased down rather than waved off.** Failures in the
qxo normaliser tests, the auth-route tests, and the appraisal/attribute pair all
passed in isolation — contention against a tree that kept changing under the
runner, including a dev server left running from the live-verification attempt.
The pattern cost real time and is now in the handoff's trap list: a gate run is
only evidence if nothing else is touching the tree.

**Carried forward, all in the plan.** The placement pass across all 22 flat
families, which is the step that actually moves the top of the resolution table.

---

## Step 2X-L1. Account for every limb — disposition table and replay refresh

**Closed 2026-08-08**, same branch session as the merge follow-up.

**Disposition table published.** All **69** model-emitted limbs on Red Hat
REPRESENTATIONS §3.01+§3.02 traced to exactly one disposition; **unaccounted=0**.
Computed from evidence via `scripts/canonical-v2-redhat-reps-limb-disposition.mjs`,
not asserted by hand:

| disposition | count | reason_code |
|---|---:|---|
| `RESIDUAL_QUOTE_UNVERIFIED` | 1 | `LIMB_ASSERTION_QUOTE_UNVERIFIED` |
| `OPEN_WORLD_ONLY` | 62 | `UNMAPPED_GENERIC_CLAIM_KEY` |
| `OPEN_WORLD_AND_ASSERTION_NODE` | 6 | `UNMAPPED_GENERIC_CLAIM_KEY` |

Path hygiene on all 69 inputs: MARKER 66, DESCRIPTIVE 3, MIXED 0. The six
assertion-node feeders are §3.01 `(a)/(i–iii)` and §3.02's three descriptive
headings — a subset of the 68 open-world limb candidates, not a separate channel.

**2X-L replay evidence regenerated** in place at zero model calls
(`redhat-representations-20260808-2xl-replay`). `MAT_MAE_AGGREGATE` count in
`resolution.json`: **0** (was 26 on the stale artefact captured while V41 briefly
included the retired code). Post-regeneration counts unchanged: 2 trees, 7 path
nodes, 6 assertion nodes, `resolved=32`, `open_world=100`, 1 adapter residual.

Evidence and commands: `docs/codex-program/notes/step-2x-l1-limb-disposition.md`.

---

## Step 2X-G. The open-world promotion loop

**Closed 2026-08-08** for the gate and the first landed promotion. Further
shapes still need taxonomy or pattern work; the loop is the mechanism, not a
one-shot empty of the open-world table.

**Gate.** `lib/canonical-v2/open-world-promotion-gate.js`, re-exported from
`lib/expected-sets.js`. Ben's ruling (DECISIONS.md §14): promote at **three or
four deals**, with confidence and fail-closed collision — never a percentage.
Refuses 2X-B HOLD scaffolds and new names that collide with 2X-J CONSUME.

**Corpus scan.** `scripts/audit/step-2x-g-open-world-promotion-scan.js` over
169 newest evidence resolutions: **27** shapes with ≥3 deals, **27** gate PASS.
Only one PASS row names an ungate target today:
`REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION` (6 deals). The rest are
`NEEDS_REVIEW` / `NEEDS_CLAIM_DEFINITION_TAXONOMY` / `PRIMARY_PATTERN_WIDEN`.

**First promotion proved on replay.** Skywater no-shop committed evidence
(`skywater-no-shop-20260808-r1`): open_world **11 → 10**,
`NO_SHOP_RUBRIC_OPEN_WORLD` **1 → 0**, one resolved claim under `NOSOL-CEASE` /
`NO_SHOP_CEASE_ACTION`. Test:
`tests/canonical-v2-open-world-promotion-gate.test.js` (7/7).

Evidence and commands: `docs/codex-program/notes/step-2x-g-open-world-promotion.md`.

---

## Step 2X-H. Record input tokens

**Closed 2026-08-08.** The Claude Code CLI reports `usage.input_tokens` as only
the non-cached prompt tail (often ~2 on a warm cache). Live telemetry was
writing that figure unchanged, so fifteen REPRESENTATIONS chunks showed
**426 input tokens across 172 calls** while output was recorded correctly.

**Fix.** `normalizeProviderUsage` in
`lib/canonical-v2/native-producer/anthropic-provider.js` sums
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens` when
cache fields are present, keeps the CLI tail as `input_tokens_non_cache`, and
leaves SDK-shaped usage (no cache fields) unchanged. Applied before telemetry
write and on `provider_usage`.

**Proof.** `CI=true node --test tests/canonical-v2-input-token-telemetry.test.js`
exit 0. Note: `docs/codex-program/notes/step-2x-h-input-tokens.md`.

---

## Step 2X-I. One prompt bump, not four

**Closed 2026-08-09.** Producer-side changes batched into one digest-invalidation
window (live re-extract is 2X-K, not required to close this step):

| Piece | What landed |
|---|---|
| IOC V1×25 | Producer enum + corroboration V1-keyed; `IOC_PROMPT_VERSION` 6; `DATA_PRIVACY_CYBER` → `IOC-REGAUTH` |
| MAE limbs | Prompt v3 emits `limbs[]`; `shapeMaeDefinitionLimbAssertionProposals` |
| 2F2 open-world schema | Bare `[]` → object schema on remaining deferred families (merger-structure among them) |
| Mutual rights (Ruling 2) | `EITHER_PARTY` mints TARGET+BUYER rows via `resolveMutualPrincipalParties`; product still projects `PARTY_MUTUAL` |
| Model `transaction_steps` | Merger-structure prompt v3; shaper + `handleMergerTransactionStepCandidate`; `MERGER_TRANSACTION_STEP` V42; `mergeDealTopology` with model-wins precedence |

**Precedence (model vs detector).** Model-extracted steps win
(`MODEL_EXTRACTED`); detector is fallback always `topology_needs_review`;
disagreement keeps model topology and forces review. Neither → `UNDETERMINED`.

**Proof.** Focused suites exit 0:
`tests/canonical-v2-ioc-*.test.js`, MAE/2F2 prompt contracts,
`tests/canonical-v2-termination-rights-resolution.test.js` (+ limb/product/real-fixture),
`tests/canonical-v2-deal-topology-from-claims.test.js`,
`tests/canonical-v2-transaction-topology-detector.test.js` (7/7 detector unchanged).

Notes: `docs/codex-program/notes/step-2x-i-ioc-mae-2f2.md`,
`step-2x-i-mutual-rights.md`, `step-2x-i-transaction-steps.md`.

**Not claimed.** Live Modiv / family re-extract (2X-K); product UI topology badge;
Postgres `deal_topology` writer hookup.

---

## Step 2X-F. Topology, with an undetermined state

**Closed 2026-08-09** for the detector half. Model-extracted `transaction_steps`
closed under 2X-I (`mergeDealTopology`). Product UI wiring remains later.

**Taxonomy.** `UNDETERMINED` (no silent `SINGLE_MERGER`); `PARALLEL_MERGERS`
(simultaneous dual mergers); `REVERSE_TRIANGULAR_THEN_LLC` (sequential two-step
without HoldCo). `DOUBLE_DUMMY` kept for HoldCo structures.
`FORWARD_TRIANGULAR` / `REVERSE_TRIANGULAR` documented as
`opts.singleStepTopology`-only.

**Detector.** Tender signal tightened to `Acceptance Time` / `251(h)`; named
mergers from quoted defined terms / `X Merger Effective Time`; merger-scoped
simultaneity; unconditional single-step default removed.

**Proof.** Seven hash-verified deals via
`tests/canonical-v2-transaction-topology-detector.test.js`: 4× `SINGLE_MERGER`,
skywater+topbuild `REVERSE_TRIANGULAR_THEN_LLC` (0 chaining warnings), modiv
`PARALLEL_MERGERS`. Was 4/7; now 7/7 on the detector half.

Evidence and commands: `docs/codex-program/notes/step-2x-f-topology.md`.
