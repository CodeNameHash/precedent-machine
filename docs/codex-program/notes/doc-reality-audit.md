# Doc-reality audit

Requested by the owner after a run of confirmed cases where a governed document
stated something false about the system, caught only by testing the running
system rather than by reading. This note is the reconciliation: what is
actually true right now, checked against code, tests and git history, plus a
plan for catching this mechanically instead of by chance.

Scope: every document under `docs/codex-program/` and `docs/certification/`,
plus `docs/CODEX-PROGRAM.md` (the "spine" document these are digest-pinned
against) and `docs/ARCHITECTURE.md` and `docs/API-ROUTE-CLASSIFICATION.md`.
Not in scope, by instruction: editing `ROADMAP.md` or `OPERATING-RULES.md`
(both were corrected in the hour before this audit started; findings about
them are reported here, not fixed there), and three files other agents were
actively using while this audit ran (`docs/codex-program/notes/
all-families-aggregate.md`, `docs/codex-program/notes/extraction-crashes.md`,
`scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs`, the
last of which was mid-rename the entire time this audit ran).

**A live-repo caveat, stated once rather than repeated on every finding
below.** This branch had eleven files under active, uncommitted edit by other
agents at the moment this audit started, several of them the exact files
several findings below turn on (`components/review/table-configs/
antitrust-regulatory.config.js`, `representations-qualifiers.config.js`, and
others). Every finding below reflects the working tree as read at the time it
was checked, which in a couple of cases was minutes before this document was
written. That is not a weakness peculiar to this audit; it is the strongest
argument in Part 3 for why so many of these documents drift: a fact that was
true when someone typed it can stop being true before they finish the
sentence.

**Verdict legend.** RIGHT: true now, checked directly. STALE: was true, isn't
now. WRONG: false when written, or contradicted by something that existed
already. HISTORICAL-OK: an old number or state, correctly framed as a dated
record rather than a claim about now. UNVERIFIABLE: no mechanical way to
check it from this repository.

## Verification

```
CI=true npm test > /tmp/audit.log 2>&1; echo "EXIT=$?"
```

`EXIT=0`. 7676 tests, 7634 pass, 0 fail, 42 skipped, in 284.2 seconds,
against the working tree as it stood during this audit (several other
agents' uncommitted changes included). This document only adds a new file
under `docs/codex-program/notes/`, which nothing in the test suite enumerates
or digest-pins, so it cannot have caused or masked a failure; there were none
to attribute. Nothing else in the repository was edited to produce this
audit.

---

## Executive summary

Ordered by consequence, worst first. Each finding is numbered F1 to F28 in
the order it was found, not the order below; the number is a label, not a
ranking, use it to jump to the full write-up in Part 1.

| # | Finding | Consequence | Verdict |
|---|---|---|---|
| F27 | `WORK-COMPLETED.md` says a legally dangerous quote-trimming bug (reversing a negation like "would not") is "tracked in the roadmap... as step 1b"; no such tracking exists anywhere in `ROADMAP.md` | **Highest in this audit**: a real, legal-correctness-grade defect that nothing is actually scheduled to fix | WRONG, live now |
| F26 | `MERGE-PLAN.md` and `DECISIONS.md` item 12 both present "merge this branch to `main`" as a pending, undecided future action | **Highest in this audit**: would cause someone to redo, or wait on, work already done three times over | WRONG, live now |
| F1 | `docs/certification/programme-gate-status.json` contradicts itself: its own prose says all P1/P9 gates are open, its own data says two of them PASS | Would change a decision: this file is cited as gate evidence | WRONG, live now |
| F2 | Three separate places track the same gate's state (`programme-gates.yaml`, `governing-registry.js`, `programme-gate-status.json`); for `P1_VERTICAL_SLICE_PASS` two of them disagree, OPEN vs PASS | Would change a decision | WRONG, live now |
| F3 | The parity register's own call-graph checker says 7 surfaces marked `NATIVE_COMPLETE` are `NATIVE_UNVERIFIED`; the stored field never gets corrected against it | Would change a decision about what's actually built | WRONG, live now |
| F4 | `canonical-contracts.md` names `lib/schema/canonical/contract-v2/manifest.json` as "the sole editable authority" for the contract bundle; that file does not exist, the code uses a hardcoded fixture instead | Would change a decision for anyone editing the contract | WRONG (see nuance below), live now |
| F6 | The adversarial-test registry names backing files for its 7 "implemented" tests; a single commit deleted most of them 6 days before this correction, and nothing checks file existence | Would change a decision about test coverage | WRONG, live now, but **already accurately narrated in ROADMAP.md** |
| F18 | `programme-gate-status.json`'s gate ID `P1_CONTRACT_FREEZE_ATTESTED` does not exist anywhere in the code that actually computes gate state; a repo note already found and named this exact problem and it is still unfixed | Would change a decision about which document to trust | WRONG, live now, and already self-diagnosed |
| F20 | `lib/canonical-v2/native-producer/p0-product-surface-ownership.js` is imported by nothing but itself; the real routing work is done by a separately-named file the ownership JSON also cites as if it were the same thing | Would change a decision about what's built | WRONG, live now |
| F28 | `EXECUTION-LEDGER.md`'s "Current state" section is stale by the same order of magnitude as F26 (written before the merges in F26 and before PR #478's own account of what shipped); the same document also contradicts itself on the P9 gate count (22 vs 23) between two dated entries | Medium-high; the single document most likely to be read for "where are we" | WRONG/STALE, live now |
| F11 | Owner item: sectionizer "swallowed by inner list" mechanism | Would mislead anyone fixing it | **STILL WRONG in 2 of 3 documents** |
| F25 | `citation-scope-design.md` has a **second**, independent stale premise beyond the sectionizer one (F11): it designs around `TRIGGER_NOT_ASSERTED` as the fallback a bare citation hits; the real, earlier-checked gate is `TRIGGER_UNCORROBORATED` | Medium; misleads anyone building the next step of this design | WRONG, live now |
| F12 | Owner item: `_label` fix concluded family-specific | Would understate exposure | **STILL WRONG, uncorrected** |
| F23 | `OPERATING-RULES.md` states its own tracked blocker count "must be 104", with a runnable command attached; running that exact command now gives 102, and two documented fixes in between were never folded back in | Medium; about one of the two "just corrected" documents | WRONG, live now |
| F21 | A pinned test-file hash inside `P1-VERTICAL-SLICE-ATTESTATION.json` (an evidence file the "trustworthy" live gate computation itself reads) no longer matches the real file; nothing checks this specific field | Medium; a leaf inside an otherwise-good mechanism | WRONG, live now |
| F5 | One archiving commit (`51f91a2c`) moved `docs/handoffs/` and `docs/PLAN.md`; at least 4 governed documents still cite the pre-move paths as current | Low-to-medium; mostly evidence trails, one live spec cross-reference | WRONG, live now |
| F19 | `docs/certification/evidence/G0-OWNER-DEEMED-2026-07-23.md` says all ten G0 gates live "in `programme-gates.yaml`"; that file now has zero G0 references | Low-medium; evidence trail only | WRONG, live now |
| F22 | `docs/certification/PM-PROCESS-CONCURRENCY-RULE.md` says the M1 acknowledgement is "the only pre-production approval artefact"; at least 4 more exist, one from the same day | Low-medium | WRONG, live now |
| F16 | Owner item: 14 parity-register surfaces with an orphaned symbol | Folds into F3 | Independently reproduced at **13**, not 14 |
| F17 | `docs/certification/programme-gate-status.json`'s "OWNER_DEEMED" G0 gates cite `docs/handoffs/AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md` | Low; evidence trail only | WRONG (folds into F5) |
| F24 | `docs/codex-program/notes/import-plan.md`'s "open question" about whether import is authorised was already answered, in the same commit, by the `OPERATING-RULES.md` edit sitting next to it | Low; no cross-link, easy to miss | WRONG framing, live now |
| F15 | Owner item: roadmap appendix "current state, verified" test count | Low; illustrates the general problem | STALE by 121 tests, measured minutes apart |
| F7 | Owner item: "next thing to start" already done | n/a | Confirmed FIXED |
| F8 | Owner item: 281/289 vs 282/289 | n/a | Confirmed FIXED |
| F9 | Owner item: import path "still prohibited" | n/a | Confirmed FIXED |
| F10 | Owner item: 1,450-byte UTF-16/UTF-8 finding | n/a | Confirmed FIXED, and well |
| F13 | Owner item: "no general extraction runner" | n/a | Confirmed FALSE-then, TRUE-now (25 families, verified by execution) |
| F14 | Owner item: "no path into product's database" | n/a | Confirmed: exists, heavily tested, genuinely unexecuted |

Full evidence for each below. Part 2 turns the recurring shapes into
mechanical checks. Part 3 answers the owner's question about a source of
truth.

---

## Part 1: The audit

### 1.1 New findings, not on the owner's original list, that would change a decision

#### F26. The merge this branch has been planning for already happened, three times

**In plain terms.** `docs/codex-program/MERGE-PLAN.md` is written throughout
as an assessment of an as-yet-undecided future action: "This is an
assessment and a plan, not a merge... Nothing here grants authority to
merge; that is a decision for a person." It proposes exactly two pull
requests as the mechanism (`wp/m3-canonical-v2-foundation` and `wp/m3-
tonight-integration-and-live-fixes`). `docs/core/DECISIONS.md`,
item 12 ("Go live"), independently repeats the same premise: going live "is
not reachable until step D2 is, which in turn is not reachable until this
branch is merged to `main`: 287 commits and 910 files that have never been
tested as a merged unit."

**Checked directly against GitHub, not against another document:**

```
gh pr list --state merged --json number,title,mergedAt,baseRefName,headRefName
```

PR #476, `wp/m3-canonical-v2-foundation` → `main`, merged 2026-08-05T21:55:41Z.
PR #477, `wp/m3-tonight-integration-and-live-fixes` → `main`, merged
2026-08-06T00:30:37Z. Both branch names match `MERGE-PLAN.md`'s proposal
exactly. A third PR, #478, "M3 production phase 1: prove one family end to
end, and fix what that exposed", then merged the whole `codex/m3-
production-phase1` branch head into `main` directly, merged
**2026-08-06T09:51:01Z**, hours before this audit began. `origin/main` is
now at `016288cb`, "Merge pull request #478 from CodeNameHash/codex/m3-
production-phase1". The plan was executed, using its own recommended
mechanism, within a day of being written.

**One precision worth keeping, not just "it's all done":** this branch's
current `HEAD` is not an ancestor of `origin/main` (`git merge-base
--is-ancestor HEAD origin/main` fails). That is expected and not itself a
problem: PR #478 merged a snapshot of this branch, and work on `codex/m3-
production-phase1` has continued since, including by other agents during
this very audit. What is stale is narrower and still consequential: the
specific plan `MERGE-PLAN.md` describes, and the specific precondition
`DECISIONS.md` item 12 names ("this branch merged to main"), are both
already satisfied. A reader of either document today would not know that,
and would not know that a *fresh* merge plan (for whatever has landed since
PR #478) is the actually-open question now, not the one these documents
describe.

**Consequence.** The highest-severity finding in this audit by the task's
own test ("would this change a decision"). Someone could spend real time
re-running a slicing and PR-preparation exercise for a merge that already
happened, or, worse, treat "go live" as blocked on a precondition that has
in fact cleared.

#### F27. A legal-correctness bug is claimed as "tracked", and is not tracked anywhere

**In plain terms.** `docs/codex-program/WORK-COMPLETED.md` describes a real,
serious bug: code that trims a quote can cut off a leading negation, so "the
company represents that the transaction **would not** have a Material
Adverse Effect" can be stored or displayed as if the "would not" were never
there, reversing the legal meaning of the sentence. The document says this
specific case is still open, but reassures the reader it is handled:
"Crude trimming is now blocked everywhere; the negation case specifically
remains open and is tracked in the roadmap's known risks, with its fix
designed as **step 1b**."

**Checked directly:** searched the complete text of `docs/codex-program/
ROADMAP.md` (83,181 bytes, read in full for this specific check) for
"negation", "would not have a Material Adverse", "known risks" as a
heading, and "step 1b" as a labelled step. **Zero matches for any of them.**
The only place the phrase "step 1b" appears anywhere under `docs/codex-
program/` is inside `WORK-COMPLETED.md`'s own sentence claiming it exists
elsewhere.

**Consequence.** This is exactly the failure mode the owner opened this
audit worried about, in its most consequential possible form: a document
says a legal-correctness defect is "tracked" and scheduled, which is
reassuring enough that a reasonable reader would not go looking for it
again, and the tracking it points to does not exist. Nothing in this
repository's governed documents currently schedules a fix for this bug.

#### F28. The document most likely to be read for "where are we" is the most out of date

**In plain terms.** `EXECUTION-LEDGER.md`'s own "Current state" section
(its first heading) is pinned to commit `484c40a9` and describes the
programme as being in "P8 Stage 5" with a pilot in progress. That basis
commit is now **109 commits behind** `origin/main` (which, per F26, has
since absorbed this branch three times over). The section's own cited test
count and production build numbers predate PR #478's description of "7674
tests, 0 failures" and a working end-to-end family run. `EXECUTION-LEDGER.md`
never mentions that any of the three merges in F26 happened.

**A second, smaller but self-contained problem in the same document:** its
"P9 registry correction (2026-07-31)" entry states "`programme-gates.yaml`
contains 22 P9 gates, not 25." Its own later "D3" entry (2026-08-05) states
"23 still-open `P9_\*` gates." Checked directly: `grep -c "id: P9_"
docs/codex-program/programme-gates.yaml` returns **23**, right now, agreeing
with the later entry. The earlier "22" entry is superseded by the later one
inside the same document, but nothing marks it as such, so a reader who
stops at the earlier entry gets a number that was already overtaken by the
time the later entry was written.

**Worth stating plainly, because it is the more useful finding than either
number on its own:** the D3 entry (2026-08-05) in this same document is, by
contrast, unusually well verified. Every checkable sub-claim in it was
independently re-confirmed for this audit, including the exact file-by-file
adversarial-test backing-file counts this audit found independently in F6
(0/1, 0/4, 4/10, 1/4, 1/2, 3/3, 3/3). One document can be simultaneously the
most current, most rigorous entry in this whole audit (its most recent
section) and the most stale (its first section, and the thing a time-
pressed reader opens the file to see). Where in the document a claim sits
matters as much as which document it's in.

#### F1 and F2. The gate-status document contradicts itself, and disagrees with the code that is supposed to compute the same fact

**In plain terms.** There are three places in this repository that each try to
say whether a "gate" (a pre-production checkpoint, like "is the contract
frozen" or "did the vertical slice pass") is open or closed. They do not
agree with each other, and one of them does not even agree with itself.

**Where.** `docs/certification/programme-gate-status.json`, field
`authority_note`:

> "All P1_\*/P9_\* gates remain OPEN."

Two entries later, in the same file, the same document's own `gates` object:

```
"P1_CONTRACT_FREEZE_ATTESTED": { "state": "PASS", ... }
"P1_VERTICAL_SLICE_PASS":      { "state": "PASS", ... }
```

Both keys start with `P1_`. The prose and the data in the same JSON file
disagree about the same two gates, in the same document, generated
2026-07-24, generation 4.

**It gets worse across documents.** `docs/codex-program/programme-gates.yaml`
(the byte-frozen "declared" registry) lists:

```
- id: P1_VERTICAL_SLICE_PASS
  state: OPEN
```

The exact same gate ID. `programme-gates.yaml` says OPEN. `programme-gate-
status.json` says PASS. Both are current documents; neither is marked
superseded; nothing anywhere reconciles them.

**Why this isn't simple carelessness, and also why it still matters.**
`lib/programme-gates/governing-registry.js` explains the design (comment at
line 26, dated D3, 2026-08-05): `programme-gates.yaml` is deliberately frozen
and can never show anything but `OPEN`, on purpose, so the reviewed contract
stays byte-identical. A second mechanism, in the same file, computes a live
overlay for exactly two gates
(`CLOSEABLE_PREPRODUCTION_GATE_IDS = ['P1_CONTRACT_BUNDLE_COMPLETE',
'P1_VERTICAL_SLICE_PASS']`) by re-deriving their evidence fresh every time
from primary sources: it recompiles the contract bundle twice and hashes it,
and it checks a pinned SHA-256 of `docs/acks/M1-CONTRACT-FREEZE-2026-07-31-
AMENDED.md` and of `docs/certification/evidence/P1-VERTICAL-SLICE-
ATTESTATION.json`. That part is good engineering: a real, live, re-derived
answer, not a stored claim.

The problem is `docs/certification/programme-gate-status.json`. It is a
**third**, independent, hand-written representation of the same fact. It is
not read by `governing-registry.js` at all (confirmed: the only paths that
module reads are the ack file and the attestation JSON, never `programme-
gate-status.json`). Nothing generates it from the live computation and
nothing checks it against that computation. It exists purely as a document a
human wrote by hand to record the same conclusion the code already computes
independently, under a different gate ID for the first one
(`P1_CONTRACT_FREEZE_ATTESTED` here vs `P1_CONTRACT_BUNDLE_COMPLETE` in the
governing registry), and its own internal prose was never updated when the
`gates` object below it was.

**Verified:** read all three files directly; ran
`node -e "require('./lib/programme-gates/governing-registry.js')"`-style
tracing of what paths it opens; confirmed `programme-gate-status.json` is
not referenced anywhere else in `lib/`, `scripts/`, or `tests/` as an input,
only as prose evidence cited by other documents.

**Consequence.** Anyone reading `programme-gate-status.json` to answer "is
the vertical slice done" gets a different answer depending on whether they
read the prose or the data two lines below it, and a third answer again if
they read `programme-gates.yaml` instead. That is a decision-grade
disagreement about the single most consequential fact this whole programme
tracks: what is actually allowed to happen next.

#### F3. The parity register's own verifier already disagrees with 7 of its "NATIVE_COMPLETE" claims, and nothing surfaces that

**In plain terms.** `docs/codex-program/m3-family-parity-register.json`
records, for each family, a list of "product surfaces" (places the review
page is supposed to show V2-extracted data) and a `disposition` for each:
whether it's fully built (`NATIVE_COMPLETE`), evidence-only, retired, still
needed, and so on. This repository *also* has real, working code
(`lib/canonical-v2/native-producer/m3-family-parity-register.js`) that
independently re-derives, by parsing the actual source files and tracing a
real AST call graph, whether a surface is genuinely reachable from a page a
user could load. That function is called `liveProductVisibility()`. It is
sophisticated: per a dated ruling in its own header comment ("Ruling 3, Ben,
2026-08-05"), it insists on proving "served entry point → transitive imports
→ proving consumer → exact adapter import → intra-module call graph → the
exact symbol named by `source_locator`", specifically because "reaching the
module is not reaching the symbol."

That function is exactly the kind of live, re-derived check Part 3 argues
for. The problem: the `disposition` field stored in the JSON is never
checked against it.

**Verified directly, using the project's own function, not an approximation:**

```js
const { CURRENT_M3_FAMILY_PARITY_REGISTER, liveProductVisibility } =
  require('./lib/canonical-v2/native-producer/m3-family-parity-register');
```

Ran `liveProductVisibility()` against every surface this audit flagged (see
F16 below for how they were found). Result, right now:

| Family | Surface | Stored `disposition` | `liveProductVisibility()` says |
|---|---|---|---|
| ANTITRUST_REGULATORY_EFFORTS | antitrust-render-derived-withdrawal | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| APPRAISAL_DISSENTERS_RIGHTS | appraisal-governed-market | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| DIVIDENDS | dividends-governed-market | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| KEY_DEFINED_TERMS | key-terms-market-fields | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| MAE_DEFINITION | mae-display-maps | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| NO_SHOP | no-shop-render-fallbacks | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |
| TAX_MATTERS | tax-governed-market | NATIVE_COMPLETE | **NATIVE_UNVERIFIED** |

`isNativeSemanticCompletion()`, the function that decides whether a surface
counts as a "blocker" for parity purposes, only treats `NATIVE_VISIBLE`,
`DERIVED_VISIBLE` or `RETIRED_NOT_RENDERED` as complete. `NATIVE_UNVERIFIED`
is none of those, so **the live blocker count is not actually corrupted** by
this (it recomputes visibility fresh every time regardless of the stored
`disposition` string; confirmed the current blocker count via
`listM3ProductParityBlockers()` is 102). What *is* corrupted is the
`disposition` field itself: it is a stored, hand-written claim that
disagrees with what this repository's own tooling would tell you if you ran
it, and nobody runs it against this field. A reader who opens the JSON
directly, or a document that quotes from it (several do), sees
"NATIVE_COMPLETE", a strong and specific claim, for something the same
repository's own AST-based verifier calls unverified.

**Why this is worth taking seriously rather than dismissing as noise.** One
of the surfaces above (`withdrawalProvisoLabel`, antitrust) was traced by
hand for this audit: it is not dead code, it is a legacy fallback that only
fires for pre-native (V1) cards
(`components/review/table-configs/antitrust-regulatory.config.js:661-669`,
the ternary that prefers `features.pullRefileProviso` and only calls
`withdrawalProvisoSignal` when a card is not a native projection). So
`NATIVE_UNVERIFIED` does not necessarily mean "broken"; it means "this
repository's own strict verifier cannot currently prove it", which for a
document whose whole purpose is proving things, is still worth a name that
isn't `NATIVE_COMPLETE`.

#### F4. `canonical-contracts.md` names a "sole authority" file that does not exist

**Where.** `docs/codex-program/canonical-contracts.md`, line 1-9, under the
heading "0. One authoritative contract source":

> "`lib/schema/canonical/contract-v2/manifest.json` and its closed,
> digest-listed file set form `CanonicalContractBundle`, the sole editable
> authority for legal concepts..."

**Checked directly.** `lib/schema/canonical/` does not exist anywhere in this
repository (`find lib/schema/canonical` errors, no such directory). The code
that actually builds and validates the contract bundle,
`lib/canonical-v2/contract-bundle.js`, does not read a manifest file at all:
it defines `FIXTURE_CONTRACT_INPUT_V1` as a hardcoded, frozen JavaScript
object literal at line 10, and that object, not a JSON manifest on disk, is
what `governing-registry.js` recompiles and hashes for the P1 gate evidence
described in F1/F2 above.

**The nuance, stated fairly.** `canonical-contracts.md`'s own section
heading two lines above is "Binding target architecture: detailed
contracts", which is explicitly forward-looking language, and this document
elsewhere reads as a specification of intended shape rather than a
state report. That framing is legitimate for most of a 1 MB document written
in the present tense throughout. But its very first substantive sentence,
naming the "sole authoritative contract source", gives no signal to a reader
that this is aspirational rather than actual, and a reader who goes looking
for that manifest file to make an edit will not find it. This is the kind of
sentence Part 3 argues should either say "not yet built" plainly, or point
at `contract-bundle.js` as what currently stands in for it.

#### F5 / F17. One archiving commit's fallout is still live in at least 4 documents

**What happened.** Commit `51f91a2c`, "docs: archive superseded material,
correct the roadmap", moved `docs/handoffs/` to `docs/archive/handoffs/`
(43 files) and `docs/PLAN.md` to `docs/archive/PLAN.md` (confirmed by
`git log --diff-filter=R`, a tracked rename in both cases).

**Confirmed still citing the old, dead path, in the present tense (not a
pinned `git show`, not "no longer exists" framing):**

- `docs/certification/programme-gate-status.json`: `authority_note` says
  "See ... and `docs/handoffs/AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md`";
  `option_a_runbook_record` says "Governing spec:
  `docs/handoffs/SPEC-QXO-TERMF-F2-CANDIDATE-OPTION-A-2026-07-24.md`".
- `docs/certification/evidence/G0-OWNER-DEEMED-2026-07-23.md`, twice:
  "following review of `docs/handoffs/AUDIT-GATE-REGISTRY-STATUS-2026-07-
  23.md`" and "the discrepancy, options, and recommendation are in
  `docs/handoffs/AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md` item 2".
- `docs/CODEX-PROGRAM.md`, three times (lines 41, 136, 2203): "`docs/PLAN.md`
  work packages WP-R1 through WP-R10 fold into the phases", "carries the
  repo primer from `docs/PLAN.md`", "the existing WP-R punchlist in
  `docs/PLAN.md` maps...". All present tense, describing a file that is no
  longer at that path.

**Checked and correctly excluded.** The same string also appears in
`docs/core/OPERATING-RULES.md` (twice), `docs/codex-program/
WORK-COMPLETED.md` (once) and `docs/codex-program/MERGE-PLAN.md` (once). All
four of those are fine: two are pinned `git show 59568f92:docs/handoffs/...`
commands (correct and reproducible, since `git show` resolves a path as it
existed at that historical commit, regardless of later moves), one
explicitly calls the two paths "superseded pointers", and one is itself the
narrative describing the archiving diff. Read in context before counting a
match; see 1.3 for why this matters mechanically.

**Consequence.** Low for the certification evidence trail (nobody is likely
to follow those links today expecting new information), but `docs/CODEX-
PROGRAM.md` calling `docs/PLAN.md` "the repo primer" in the present tense,
when the file has been in `docs/archive/` since before this audit started,
is exactly the shape of thing that costs someone ten confused minutes.

Fuller count, from a second, independent path-resolution pass over the
certification documents specifically: the `docs/handoffs/` break recurs in
**5 distinct files** (`programme-gate-status.json`, `G0-OWNER-DEEMED-2026-07-
23.md`, `P9-ACCEPTANCE-DEFINITIONS.md`, and, outside this section's original
scope but confirmed by the same sweep, `docs/codex-program/bootstrap-
acceptance-source.json` and `WORK-COMPLETED.md`, the last of which is one of
the clean, pinned-`git-show` cases from 1.3). `P9-ACCEPTANCE-DEFINITIONS.md`
carries it three times (`AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md` twice,
`ANALYSIS-D2-ADVISER-LAWYER-ENTITY-CLASSES-2026-07-23.md` once), but that
whole document is self-labelled `WITHDRAWN_NON_AUTHORITY` in its own first
line, which is why it is not counted among the higher-consequence findings
here. One archiving commit, done once, correctly, for the files it moved;
the documents that pointed at the old location were simply never
re-swept, and still have not been.

#### F18. A repo note already found the gate-status file's core problem, by name, and it is still not fixed

`docs/codex-program/notes/gate-registry-assessment.md` (an independent,
earlier pass over this exact area) states plainly, at lines 113-119:
`docs/certification/programme-gate-status.json` is "an older, parallel
tracking document, not the one `programme-gates.yaml` points to as its
status source." Checked directly: the gate ID that file uses,
`P1_CONTRACT_FREEZE_ATTESTED`, does not exist anywhere in `lib/programme-
gates/governing-registry.js`, the code that actually computes P1 gate
state; that code uses `P1_CONTRACT_BUNDLE_COMPLETE` instead. Re-ran the live
verifier directly: both gates it actually tracks do still compute `PASS`
today, so the underlying *substance* behind F1/F2 is not in dispute, only
the fact that a second, differently-named, hand-written file exists
claiming to report the same thing and nothing connects the two. Worth
naming as its own finding rather than folding quietly into F1/F2, because a
note already diagnosed this precisely, over a week before this audit, and
diagnosis alone did not fix it. See Part 3.

#### F19. An "owner-deemed" evidence file cites a location that no longer holds what it says it holds

`docs/certification/evidence/G0-OWNER-DEEMED-2026-07-23.md`: "Effect: all
ten `G0_*` gates in `docs/codex-program/programme-gates.yaml`..." Checked:
`grep -c "G0_" docs/codex-program/programme-gates.yaml` returns **0**. The
G0 gates were migrated out of that YAML at some point after 2026-07-23 into
a hardcoded array inside `governing-registry.js`
(`STATUS_COMPATIBILITY_G0_GATE_IDS`), whose own comment explains why: "This
bridge exists only because the active G0 status compiler still needs the
frozen G0 evidence descriptors. It never promotes a P1 or P9 gate." The
underlying fact Ben deemed complete on 2026-07-23 is still credible; the
specific claim about where that shows up in the registry is not.

#### F20. An "ownership" file for one product surface is wired to nothing; a differently-named file next to it does the real work

`docs/codex-program/m3-p0-product-surface-ownership.json` names `lib/
canonical-v2/native-producer/p0-product-surface-ownership.js` as evidence
for the `GENERAL_COVENANT_ROUTER` owner's `first_slice.state: IMPLEMENTED`.
Checked: a repo-wide search for anything importing that file finds nothing
but the file itself. The actual routing logic lives in a separately named
file, `lib/canonical-v2/p0-product-surface-routing.js`, imported in 6 other
places and genuinely doing the work. The ownership file is real, internally
consistent, and covered by its own passing test (which only checks that the
named symbol is textually present in the named file, not that anything
calls it, see Part 2), but it is not part of any live code path. This is
the same shape as F3 (a stored completion claim with nothing wiring it into
the product), in a different registry.

#### F21. A pinned hash, inside the one file the "live", trustworthy gate computation actually reads, has gone stale

F1/F2 credit `governing-registry.js`'s live overlay as the right shape: it
re-derives evidence fresh rather than trusting a stored claim, by pinning a
SHA-256 of `docs/certification/evidence/P1-VERTICAL-SLICE-ATTESTATION.json`
itself. That file, in turn, stores its own pinned hash of a test file:
`test_file_sha256: be0e936e...` for `tests/canonical-v2-p1-vertical-slice.
test.js`. Checked: the test file's actual current hash is `7f05732f...`. It
was edited twice after the attestation recorded that pin (commits
`ff2954b2`, 2026-07-24, and `c3245dd3`, 2026-07-31). The live verifier does
not read or check this specific field, so nothing catches the drift; the
gate still reports PASS. Worth stating plainly: even the mechanism this
audit holds up as the model for "re-derive, don't trust a stored claim" has
one more layer underneath it that is, itself, a stored claim, unchecked.
Turtles do not go all the way down on their own; something has to check
every layer, not just the outermost one.

#### F22. A procedural rule states a false thing about how many approvals exist

`docs/certification/PM-PROCESS-CONCURRENCY-RULE.md`: "The M1 Markdown
acknowledgement is the only pre-production approval artefact..." Checked
`docs/acks/`: `M2-VERTICAL-SLICE-2026-07-31.md` is a same-kind milestone
acknowledgement (`milestone_id: M2_VERTICAL_SLICE`, `result: PASS`,
controller-signed), dated the same day the M1 amendment F1/F2 rely on was
made. Three further Ben-decision records exist after it
(`CLAIM-IDENTITY-APPROVALS-2026-08-01.md`, `FAMILY-MAPPING-RULINGS-2026-08-
02.md`, `OPEN-WORLD-ADJUDICATION-2026-08-02.md`). This was false even on the
day it describes itself as current.

#### F23. `OPERATING-RULES.md`'s own tracked number is stale, despite doing everything right

`OPERATING-RULES.md` has a section headed "Verifying where things stand",
opening: "None of these change anything. Run them before believing a claim
about state, including a claim in these documents." Immediately below:
"**The outstanding count.** The single number that measures distance from
release. It must be **104** unless real work moved it," followed by a
complete, runnable `node` command against the live parity register.

**Checked by running the exact command the document gives**, not a
different one: right now it returns **102**. Traced why: `docs/codex-
program/notes/family-rollout-mechanics.md` pinned 104 and cited this exact
`OPERATING-RULES.md` line as its source. `compare-locator-fix.md` then
documented moving it to 103. `serving-path-proof.md` then documented moving
it to 102. `OPERATING-RULES.md` was edited after both of those corrections
landed (its most recent edit is a descendant of both fixing commits) but its
own stated figure was never brought forward to match.

**Why this one is worth separating from F15's "numbers go stale"
generality.** This document does not just state a number, it explicitly
warns the reader the number might be wrong and hands them the exact command
to check, which is precisely the convention Part 3 argues for. It still
went stale, because a convention that says "here is how to check" only
protects a reader who actually runs the command; it does nothing for the
document itself, sitting on disk, telling anyone who does not.

#### F24. A note's "open question" was already answered by the document sitting next to it

`docs/codex-program/notes/import-plan.md`, "Open questions for the owner":
"Whether D5 is already authorised, or needs to be... This note does not
resolve that tension on its own authority; D5 is written as gated on an
explicit answer." Checked: this note and the `OPERATING-RULES.md` edit that
answers the question ("Since 2026-08-06, **importing canonical data is
permitted in principle**... 'I have NOT kept the import path prohibited.'",
see F9) were written in the **same commit**, `5fe14de7`. A reader of the
note alone, today, is told the question is open; the document committed
alongside it already contains the answer. Low stakes, since the two files
sit two clicks apart and the same commit message ("docs: plan the import,
and record that it is no longer prohibited") names both halves, but a clean
example of a cross-reference that should have been one line and was not.

#### F25. `citation-scope-design.md` has a second, independent wrong premise, beyond the one already found in F11

F11 covers this document's wrong account of the sectionizer defect. Checked
separately, and it turns out to have a second problem in the same document,
about a different mechanism entirely. The design's central proposal (Part
6.5, restated in Parts 2 and 8) is built on: "Today, the `if (!triggerCode)`
branch... falls straight to `TRIGGER_NOT_ASSERTED`", and proposes a new
`TRIGGER_NOT_ASSERTED_AFTER_CITATION` reason code on top of that fallback.

**Checked directly against the resolver code**
(`lib/canonical-v2/native-producer/candidate-resolution.js`): a bare
citation does not fall straight to `TRIGGER_NOT_ASSERTED`. A different,
earlier check, `TRIGGER_UNCORROBORATED` (present at line 6887, and
confirmed by `docs/codex-program/notes/citation-following-implementation.md`,
which traced this by direct code reading: "`=== 0` (typed
`TRIGGER_UNCORROBORATED`) is checked, and returns, **before**" the branch
`citation-scope-design.md` treats as the starting point), is what actually
fires first for the case this design is built around. The later note built
something structurally different as a result: a run-receipt-level
`citation_followup_residuals` array, with no new reason code threaded
through `review_queue.reasons` at all.

**Consequence.** `citation-scope-design.md` now carries two separate,
independently-confirmed wrong premises (this one and F11's), both
superseded by later, more carefully verified notes, neither correction
folded back in. Anyone extending this design from the document as written
would be extending the wrong starting point twice over, not once.

### 1.2 The owner's original items, checked one by one

**F7. "The roadmap described proving one family end to end as the next
thing to start. It was already done."**
Checked `docs/codex-program/ROADMAP.md`, "Lane P: product", "P1. Prove one
family end to end on real data". Current text: **"Done, for termination
fees."**, followed by a detailed, dated account of both halves (amount
resolution and citation-following) with commit hashes (`6d8d453e`,
`d501cee2`, `8bd4cb32`, `643cacc0`, `84518eef`) for each claim. **FIXED.**
Confirmed corroborating commits exist in git log (`f7fec2fb feat: prove a V2
value actually crosses the wire, and a second family runs end to end`,
`85bda8a2 docs: the roadmap now says P1 is done, because it is`).

**F8. "The roadmap said 281 of 289 adversarial tests were unimplemented.
The number was 282."**
Current `ROADMAP.md` (lines 275-276, 967-990) states 282, explicitly
labelled as a correction from the prior 281/8 figures, with the exact
mechanism explained (a test that had been wrongly counted as covering
authentication, `PREVIEW-AUTH-01`, was a regex over source text and never
made a request; it was un-registered in commit `2396bf50`). Independently
verified by loading `lib/programme-gates/test-executable-registry.js`,
counting `IMPLEMENTED_TEST_EXECUTABLE_FILES` (7 keys) against
`MANDATORY_ADVERSARIAL_TEST_IDS.length` (289, hash-pinned so the set itself
cannot silently change): 289 - 7 = 282. **FIXED**, and the correction itself
is right.

**The registry drift underneath this number, however, is not fixed: see F6
below.**

**F9. "The operating rules listed importing candidate data as prohibited
after the owner had ruled it permitted."**
Current `OPERATING-RULES.md`, lines 13-26: "Since 2026-08-06, **importing
canonical data is permitted in principle**. Ben ruled directly, in response
to being told the import path was still prohibited: 'I have NOT kept the
import path prohibited.'" Precisely dated, quotes the ruling directly,
states exactly what it does and does not authorise. **FIXED**, and unusually
well: it explains the correction rather than silently replacing the old
text.

**F10. "A plan's headline finding, that a section started 1,450 bytes late,
was a units error."**
Current `docs/codex-program/P1-PLAN.md`, lines 489-538, headed **"Retraction:
Section 7.1's boundary was never wrong"**. States the original claim, states
the correct measurement (`charToByteOffset`, `Buffer.byteLength(...)`),
explains the UTF-16-vs-UTF-8 mechanism precisely, cites the exact corrected
byte offset (321761) and a regression test that pins the correction. Ends
with: "Do not delete this section... This programme has already had one
confidently wrong claim reinstated after an earlier quiet deletion." **FIXED,
and the retraction-in-place pattern is worth generalising (see Part 3).**

**F11. "Three separate documents described a sectionizer defect's mechanism
as an inner lettered list swallowing its successor. The real mechanism was
that the letter after 'z' has no successor at all." Still wrong in 2 of 3.**
`docs/codex-program/notes/nested-lettering-collision.md` (the dedicated
investigation) found, by direct trace against the real Modiv tree, that the
true cause has nothing to do with an inner list: "**A single letter 'z' has
no defined successor at all**... Neither bug requires an inner list to be
present" (section 1.2). It names the three documents that had the wrong
account: `P1-PLAN.md` (SEC2), `docs/codex-program/notes/citation-scope-
design.md` (Part 2), and the header comment of `scripts/canonical-v2-modiv-
termination-fee-scope-correction-run.mjs`.

Checked whether the correction propagated. It did not, for two of the three:

- `P1-PLAN.md`, "SEC2. Fix Section 8.12's nested-lettering collision" (lines
  603-646), **still current text**: "Section 8.12 defines a term...at
  printed label '(z)', whose own internal sub-clauses happen to be lettered
  (a) through (f)... the outer list's next item, '(aa)', gets matched as a
  continuation of (z)'s own inner (a)-(f) run instead of as (z)'s sibling."
  This is the mechanism `nested-lettering-collision.md` proved wrong.
- `docs/codex-program/notes/citation-scope-design.md`, Part 2 (around line
  251-265) and again in Parts 6.5 and 8 (lines 775, 908, 997-998): same
  wrong account, repeated three more times in the same document.
- The third location (the script header) could not be checked: that script
  was mid-rename by another agent for the entire duration of this audit.

**Consequence if acted on:** low technical risk (the code fix, per git log
commit `991330ee fix: teach the sectionizer that the letter after z is aa,
not nothing`, appears to already be correct regardless of what the docs
say), but anyone who reads `P1-PLAN.md` or `citation-scope-design.md` to
understand *why* this class of bug happens, in order to look for it
elsewhere, will look for the wrong pattern (an inner list) instead of the
right one (a single unhandled boundary letter), and will not find other
instances of the real bug.

**F12. "A fix report concluded its defect was family-specific by
enumerating fields ending in `_label`. Reason codes ending in `_ref` show the
same shape." Still wrong, uncorrected.**
`docs/codex-program/notes/mae-clause-label.md`, section 7: "Investigated
directly, not guessed: no, this specific defect is unique to MAE_DEFINITION
among the 25 registered families... Grepped every `*-producer-prompt.js`
file... for every field ending in `_label`. Exactly two exist." The exact
same conclusion, in the same words, is in the landing commit message,
`8df63845`: "Every field ending in '_label' across all twenty-seven producer
prompts was enumerated: only two exist... the answer is a well-evidenced
no."

Checked independently whether the same *shape* of defect (a scalar field
required to be a verbatim substring of its own narrowed quote) recurs under
a different suffix. It does: `lib/canonical-v2/native-producer/candidate-
resolution.js:6299`, comment: "`fee_term_ref`: REQUIRED, verbatim substring
of the quote". `fee_term_ref` is a `_ref`-suffixed field in the
TERMINATION_FEE family, not MAE_DEFINITION, and it carries the identical
verification shape the MAE fix addressed. The commit message even
acknowledges `fee_term_ref` by name ("the reason code rhymed with the
termination-fee defect fixed yesterday") but dismisses it as already-fixed
and unrelated without checking whether the *general shape* (not the specific
already-fixed bug) recurs. `_ref`-suffixed fields exist across at least 8
producer-prompt files (tax-matters, guaranty, proxy-meeting, antitrust-
regulatory, defined-terms, appraisal, dividends, termination-fee); none of
these were checked for this specific verification shape. The search was for
the wrong suffix, and the "no" conclusion still stands, uncorrected, in both
the note and the commit message.

**F13. "I told the owner no general extraction runner existed for other
families. Twenty-five families were registered and dispatchable the whole
time." Confirmed false when said, true now.**
Verified by executing the actual registry rather than reading prose:

```js
require('./lib/canonical-v2/native-producer/producer-prompt-registry.js')
  .listRegisteredSectionFamilies().length   // => 25
```

`docs/codex-program/notes/general-extraction-runner.md` describes the same
25 and documents that the existing Modiv-only script now dispatches any of
them against any pinned deal. Confirmed the claim is currently true by
direct execution, independent of the note's prose.

**F14. "I told the owner no path existed from extraction into the product's
database. A complete 8,686-line schema and writer exists, unexecuted."
Confirmed.**
`supabase/canonical-v2-foundation.sql` is exactly 8,686 lines
(`wc -l`, confirmed). Paired with `lib/canonical-v2/canonical-writer.js`
(the JS writer) and `supabase/canonical-v2-product-candidate-result-
writer.sql`. Both are extensively unit-tested (over 20 test files parse and
validate this exact SQL file, digest-pinned in `scripts/canonical-v2-
staging-schema.mjs`), but "tested" is not "executed against a database":
`OPERATING-RULES.md`'s current authority boundary (see F9) still prohibits
"using real credentials or a real production database client", and
`programme-gates.yaml`'s Tier A controls still list
`NO_EXTRACTION_REPLAY_BACKFILL_OR_LOAD_TEST_AGAINST_PRODUCTION`. No evidence
was found of this schema ever having been applied to a live database,
staging or production. Confirmed accurate; not found stated anywhere as
false in a current document (this appears to have been a verbal claim in an
earlier session, not a standing document error to correct).

**F15. "The roadmap's appendix, headed 'current state, verified', reported a
test suite roughly 490 tests out of date." Confirmed stale, and freshly
so.**
`ROADMAP.md`'s appendix, headed **"Appendix: current state, verified
2026-08-06"** (today), states: "Test suite: **7555 tests, 7513 pass, 0 fail,
42 skipped**... measured at commit `84518eef`." This audit's own
`CI=true npm test` run, minutes before this document was written, measured
**7676 tests, 7634 pass, 0 fail, 42 skipped**, 121 more tests than the
appendix claims, because commits landed and other agents made uncommitted
changes between the appendix's measurement and now. Also in the same
appendix: "Parity: 103 blockers"; this audit's live recomputation via
`listM3ProductParityBlockers()` returns **102** right now. Neither drift is
large or surprising given the pace of concurrent work; both are offered as
the cleanest possible demonstration of the general problem: a number
labelled "verified today" was already wrong by the time it was checked
today. See Part 3.

**F16. "Fourteen parity-register surfaces named a component symbol that
exists only in its own definition." Independently reproduced at 13, not
14.**
Method: for every `product_surfaces[]` entry across all 22 families plus 3
supplemental owners in `m3-family-parity-register.json` (116 total, 109 with
a JavaScript-style `source_locator` rather than a JSON-pointer one), checked
whether the named symbol string is referenced by any file other than the one
that defines it. 13 are referenced nowhere else:

`antitrust-regulatory.config.js:withdrawalProvisoLabel`,
`tax-dividends-appraisal-product-projection.js:APPRAISAL_GOVERNED_CLAIM_PRESENCE`,
`consideration-hero.config.js:considerationMarketMetadata`,
`equity-awards.config.js:equityMarketSubterms`,
`tax-dividends-appraisal-product-projection.js:DIVIDEND_COORDINATION_COVENANT_PRESENCE`,
`key-terms-mae-product-projection.js:KEY_DEFINED_TERM_GOVERNED_VALUE_BY_CLAIM`,
`key-terms-mae-product-projection.js:maeDimensions`,
`nosol-fiduciary.config.js:firstFallback`,
`votes-approvals-meeting.config.js:parentApprovalNode`,
`votes-approvals-meeting.config.js:adjournmentGroupedNode`,
`representations-qualifiers.config.js:repMarketSubterms`,
`representations-qualifiers.config.js:resolveDateLookback`,
`tax-dividends-appraisal-product-projection.js:TAX_GOVERNED_CLAIM_PRESENCE`.

This was then re-run through the project's own `liveProductVisibility()`
rather than left as a grep result (grep cannot tell reachable-but-private
from genuinely dead; see F3 above and 1.3 below for why that distinction
matters). Of the 13: 7 carry `disposition: NATIVE_COMPLETE` and all 7 come
back `NATIVE_UNVERIFIED` (these are F3, the serious subset); 4 carry
`disposition: EVIDENCE_ONLY` (a hedge the register itself already signals as
weaker, `liveProductVisibility` returns `EVIDENCE_VISIBLE` for these, which
is consistent, not a contradiction); 1 is `APPROVED_RETIRED` (correctly
unreferenced, retirement is supposed to look like this); 1 is
`FOLLOW_ON_REQUIRED` (already admits incompleteness, not a false claim).

13, not 14: possibly the owner's count included a case since fixed (several
of the exact files these symbols live in were under active, uncommitted edit
during this audit), possibly a marginally different definition of "own
definition". Reported as measured rather than adjusted to match.

### 1.3 Checked and found correct: methodology notes, kept because they
matter for Part 2

A blind "does this path exist" sweep across every governed document found
34 candidate dead references. Most were real (F5 above). Several were not,
and are worth recording because they show exactly where a naive mechanical
check would cry wolf:

- `pages/compare.js` and `pages/api/compare.js`: flagged as missing by the
  sweep. Both `OPERATING-RULES.md` ("`pages/compare.js` no longer exists")
  and `MERGE-PLAN.md` ("Tier D: dead code removed... deleted") are
  correctly, deliberately saying these files are gone. Not a defect.
- `docs/handoffs/...` inside `git show 59568f92:docs/handoffs/...` commands
  in `OPERATING-RULES.md` and `WORK-COMPLETED.md`: these resolve correctly
  because `git show` reads a path as it existed at the pinned commit,
  regardless of later moves. Not a defect, and a genuinely good pattern (see
  Part 3).
- `withdrawalProvisoLabel` (antitrust config): looked dead by a same-file-
  only reference count, traced by hand, turned out to be a live legacy-
  fallback branch (F3 above). A symbol used only within its own file is
  extremely normal, good practice for a private helper; it only becomes a
  finding when nothing calls it *at all*, or when the register's own
  verifier already disagrees with the stored claim about it, which is why
  F3 is framed around `liveProductVisibility()` rather than around raw
  reference-counting.

### 1.4 Genre note: decision logs and dated investigation notes

`docs/core/DECISIONS.md` and the ~18 files under `docs/codex-
program/notes/` are, almost without exception, dated, append-only records of
a specific investigation or ruling ("DECIDED 2026-08-05...", "Verification
command: ..."). An old number preserved as part of that record is not a
defect; two of the best examples of self-correcting, rigorous writing found
anywhere in this repository are in that folder
(`nested-lettering-collision.md` and `mae-clause-label.md`, both of which
explicitly separate "measured" from "judged" and both of which are the
source of the corrections recorded in F10/F11 above). The defect, where it
exists, is never the old note itself; it is a *different*, still-current
document that keeps citing the old note's superseded conclusion without
ever reading the newer one. F11 is exactly that shape. `docs/CODEX-
PROGRAM.md`'s own "Verification results (what we confirmed, corrected, or
sharpened)" section (lines 44-126) is the same genre and was not indepth
re-verified line by line for this audit (no date stamp is visible on the
section itself, and its numbers, e.g. "/admin/registry counts verified
EXACTLY: 704 total", were not independently re-checked against a live
database as part of this pass); flagged here as a gap in this audit's own
coverage rather than as a finding either way.

### 1.5 What else the parallel reviews found, and what they found clean

Three further passes covered the ground this audit could not reach alone:
`EXECUTION-LEDGER.md` / `WORK-COMPLETED.md` / `MERGE-PLAN.md` /
`DECISIONS.md`; `P9-ACCEPTANCE-DEFINITIONS.md`, the ownership and coverage
JSON files, and `docs/certification`; and the remaining fourteen files
under `docs/codex-program/notes/`. F18 through F28 above are their highest-
consequence findings, folded into the main list and independently spot-
checked before inclusion (the merge claim in F26 and the tracking claim in
F27 were both re-verified first-hand for this document, against GitHub and
against a full-text search of `ROADMAP.md`, not taken on trust). What
remains is lower-stakes, but worth recording, both for completeness and
because the ratio of clean to broken is itself informative.

**Further confirmed, footnote-level drift**, none of it changing a
decision: `MERGE-PLAN.md` states "18 commits without a `type(scope):`
prefix" where direct enumeration finds 82 (the doc's own scope-breakdown
table sums correctly to the true total once this is corrected, so this
looks like a one-off miscount rather than a stale figure); the same
document's "roughly 300 files under `.github/phase-allowlists/`" was wrong
even the day it was written (436 at the pinned commit, 438 now, a 45% gap
too large for reasonable rounding); `DECISIONS.md`'s pinned "287 commits and
910 files" is off by 2 and 2 against the commit that actually created the
file (289/912), suggesting it was measured slightly before that commit
rather than at it.

**Confirmed clean, and worth citing as the positive baseline for Part 3:**
`docs/codex-program/specification-manifest.json`'s byte-length and SHA-256
for all six of its pinned files were independently recomputed and matched
exactly, meaning the tamper-evidence mechanism discussed in Part 2.1(4) is
currently doing its job correctly, it simply answers a different question
than this audit is asking. `DECISIONS.md`'s items 4, 8, 9, 10, and its
no-shop and materiality rulings were all independently re-verified against
the current code, exactly, including a byte-for-byte reconstruction of "
1,001 lines across 5 modules" by summing the deleted files at the commit
that removed them. Ten of the fourteen `docs/codex-program/notes/*.md`
files reviewed in the third pass came back clean (RIGHT or HISTORICAL-OK on
every checked claim), reinforcing 1.4's point: the dated, self-verifying
investigation-note genre is, on the whole, the most trustworthy class of
document in this repository. Two items in `DECISIONS.md` (its items 6 and
7) are explicitly self-flagged by the document itself as unconfirmed
pending database access; that is the document behaving exactly as Part 3
recommends, and is recorded here as a model, not a finding against it.

---

## Part 2: Can this be caught mechanically

### 2.1 What this repository already has, and what each one actually proves

Four existing mechanisms are worth studying, because they are different
shapes of the same idea and only some of them fit this problem:

1. **`lib/programme-gates/governing-registry.js`'s live overlay (F1/F2's
   good half).** Never trusts a stored assertion; re-derives two gates'
   state fresh, every load, from primary sources (recompiling a bundle,
   hashing a pinned file). This is the right shape for "is X true right
   now", and its own comment states the principle plainly: "never by
   trusting a stored assertion." It only covers 2 of 25 gates. The other 23,
   and the entire separate `programme-gate-status.json` file, have no
   equivalent.

2. **`lib/service-client-route-actions.js:200-237`, a module-load-time
   throw.** Validates that every declared route/action entry is internally
   consistent (sorted, well-formed, and that anything public and mutating
   is hard-contained) the instant the module loads, so a bad entry cannot
   ship silently. Good model for *consistency* of a hand-maintained list,
   but does not check that list against what is actually on disk in
   `pages/api/`.

3. **`tests/auth-route-enforcement.test.js`** (per its description in
   `docs/API-ROUTE-CLASSIFICATION.md`): walks the real `pages/api/`
   directory at test time and asserts every route it finds requires
   authentication unless explicitly exempted. This is the completeness half
   the previous item lacks: it discovers reality first, then checks the
   declared list against it, rather than checking only the declared list's
   own internal shape. This is the closest existing model in this
   repository to what F6 and F5 need.

4. **`docs/codex-program/specification-manifest.json` +
   `scripts/verify-codex-program-spec.mjs`.** Computes a SHA-256 "
   specification root" over six governed files and checks it against a
   pinned value, explicitly labelled `'DRIFT_DETECTION_ONLY_NOT_EXECUTION_
   AUTHORITY'`. Worth naming because it is easy to mistake for solving this
   audit's problem and does not: it proves a file's *bytes* have not
   changed since someone last blessed them. It says nothing about whether
   the content was ever true, and every wrong document this audit found
   (including F4, inside one of the six pinned files) was pinned, correctly,
   at the moment it became wrong. Tamper-evidence and fact-correctness are
   different problems; this repository already has good tooling for the
   first and none for the second.

### 2.2 Automatable, specified precisely

**(a) Adversarial-test backing-file existence and content pin (fixes F6).**
Reads: `lib/programme-gates/test-executable-registry.js`'s
`IMPLEMENTED_TEST_EXECUTABLE_FILES`. Asserts: every listed path
`fs.existsSync`s, and (going further than existence) that
`sha256(fs.readFileSync(file))` for the concatenated set matches
`IMPLEMENTED_TEST_EXECUTABLE_DIGESTS[testId]` the same way
`programmeGateValidatorExecutableDigest` in `validator-executable.js`
already does it for a different file set, that function is a ready-made
template, it just is not pointed at this registry. On disagreement: fail
the suite with the test ID and the missing/changed file, not a warning.
This one test, run every `npm test`, would have caught the exact damage
from commit `afbf1a43` the day it happened, five of seven implemented
tests, in one assertion.

**(b) Governed-document path resolver (fixes F5, generalises F17).** Reads:
every `docs/codex-program/**/*.md`, `docs/certification/**/*.{md,json}`,
`docs/CODEX-PROGRAM.md`. Extracts path-looking tokens (a workable regex is
in this audit's own working notes: `\b(?:lib|scripts|tests|components|docs|
pages|supabase|evidence|reports)/[A-Za-z0-9_.\-/]+\.(?:js|mjs|jsx|json|
yaml|yml|md|sql|txt)\b`). Asserts each resolves with `fs.existsSync`.
**Required, not optional, to avoid false positives (see 1.3):** skip a match
if it appears inside a fenced `git show <sha>:...` command (the path is
correctly historical), or within one sentence of "no longer exists",
"deleted", "superseded", "archived", or similar past-tense/negation
language. On disagreement: for a path git recognises as a rename target
(`git log --follow` or `--diff-filter=R` finds it), fail with the suggested
new path; otherwise fail with "path not found, and not a known rename."
This is the single highest-yield check in this audit: it would have caught
F5's four documents, F17, and the `manifest.json` half of F4, all with one
generic mechanism, no family-specific logic required.

**(c) Parity-register disposition-vs-liveness cross-check (fixes F3).**
Reads: `CURRENT_M3_FAMILY_PARITY_REGISTER` (already exported, already
loaded from the one JSON file that is the actual data, so this needs no new
data plumbing). Asserts: for every surface where `disposition` is
`NATIVE_COMPLETE` or `APPROVED_DERIVED`, `liveProductVisibility(surface)` is
in `['NATIVE_VISIBLE', 'DERIVED_VISIBLE']` (the values `isNativeSemantic
Completion` already treats as done). On disagreement: fail with the
surface ID and the actual visibility value, e.g. exactly the 7-row table in
F3. This is a small addition to `tests/canonical-v2-parity-serving-path.
test.js`, which already imports everything this check needs and already
proves the underlying function is trustworthy for hand-picked examples; it
is not yet run exhaustively over the whole register.

**(d) Gate-identity cross-check (sharpens F1/F2).** Reads: the gate IDs in
`programme-gates.yaml`'s `preproduction_gates`, the IDs
`governing-registry.js` computes a live overlay for, and the IDs in
`programme-gate-status.json`'s `gates` object. Asserts: no ID present in
more than one of these three carries a different state without an explicit,
tested reconciliation rule (today there is none). This is a smaller, more
targeted version of a recommendation Part 3 makes structurally: this check
is a stopgap; the real fix is removing the third representation, not
reconciling three.

**(e) Numeric snapshot claims (F15, and its like).** Not worth a bespoke
test per number. See Part 3: the recommendation is not to check these
values, but to stop storing them as prose at all.

**(f) Branch/PR merge-state claims (fixes F26, the highest-severity finding
in this audit).** Reads: any sentence in a governed document asserting a
named branch or PR "has not merged", "is not yet merged", or is a
precondition still pending, alongside the branch name it means (`MERGE-
PLAN.md` and `DECISIONS.md` both name `codex/m3-production-phase1`
explicitly). Asserts, via `gh pr list --state merged --json
headRefName,baseRefName,mergedAt` and `git merge-base --is-ancestor`: the
named branch is genuinely not an ancestor of the named base. On
disagreement: fail with the PR number and merge timestamp that contradicts
the document. This does not need to parse prose in general, only to know
which documents make this specific, high-stakes class of claim, which is a
short, hand-maintained list (currently `MERGE-PLAN.md`, `DECISIONS.md`);
adding a document to that list is a one-line change, cheap insurance
against exactly what happened here.

**(g) Cross-document claim resolution (fixes F27).** Reads: any sentence of
the shape "X is tracked/described/handled in `<document>`" (a short, greppable
set of verbs next to a Markdown path or heading reference).
`WORK-COMPLETED.md`'s "tracked in the roadmap's known risks, with its fix
designed as step 1b" is the motivating case. Asserts: the referenced
document contains a heading or line matching the claimed label ("step 1b",
"known risks") via a straightforward text search. On disagreement: fail
with the claiming document, the claimed location, and confirmation the
search came back empty. This is a strictly easier version of check (b), the
same shape applied to a claim about content rather than a claim about a
path, and would have caught F27 exactly.

### 2.3 Not automatable, and what helps instead

**Whether a negative claim's search was wide enough (F12).** No mechanical
check can know that `_ref` is "the same shape" as `_label` unless someone
teaches it the shape, and if someone can specify the shape precisely enough
to check it mechanically, they have usually already found the bug by
thinking about it, which is what should have happened the first time. What
helps: a convention, not a tool. Any document making an enumeration-based
negative claim ("only two exist", "unique to this family") should state the
search term it used, in the same sentence as the conclusion, the way
`mae-clause-label.md` already does ("every field ending in `_label`"). That
single habit is what let this audit re-run the search with a different
suffix in ten minutes and find the gap; without the quoted search term, the
claim would have been unfalsifiable rather than merely narrow.

**Whether a later, correcting document's finding actually propagated to an
earlier one (F11).** Grep can find every document that mentions the same
symbol or defect name, which narrows the search, but cannot judge whether
two prose descriptions of a mechanism agree or contradict. What helps: when
a note supersedes a specific claim in a specific other document (as `nested-
lettering-collision.md` explicitly does, naming `P1-PLAN.md` and `citation-
scope-design.md` by name), that should be a two-way link: a one-line
"superseded by `docs/codex-program/notes/X.md`, see section Y" left at the
original claim, not just a forward citation from the new note. A grep for
documents that name a given file, combined with a grep for whether that
named file links back, is a cheap, mechanical way to catch a *missing*
back-link even though it can't judge correctness; worth building as a
weaker, second-order version of check (b) above.

**Whether a "current state" section (`docs/CODEX-PROGRAM.md`'s "Verification
results", DECISIONS.md entries) is still accurate.** Not automatable in
general, and not the right bar for a dated log (see 1.4). What helps: every
such entry should carry, in one line, whether it was ever acted on
("landed", "not yet", "superseded by commit X"), the way `DECISIONS.md`'s
own items mostly already state a ruling but do not consistently say whether
the technical change described alongside it actually shipped. A reader
should not have to cross-reference the codebase to know whether a recorded
decision is still just a decision or is now also a fact. F28 is the sharp
version of this problem: two dated entries in the same document
(`EXECUTION-LEDGER.md`'s "22 P9 gates" and, later, "23 P9 gates") disagree,
and nothing marks the earlier one superseded. A mechanical check cannot
know which of two prose numbers is newer-and-therefore-right without being
told, but it *can* flag the disagreement for a human to resolve, the same
way check (d) flags a gate-ID collision across files rather than silently
picking one: search each governed document for its own repeated numeric
claims about the same named quantity, and fail loudly on any two that
disagree without an explicit "supersedes the above" between them, even
though it cannot say by itself which one is current.

---

## Part 3: What the source of truth should be

The owner's own view, to respond to directly: the code and the tests are the
only real source of truth, and a document's job is to explain what cannot be
read from them, intent, reasoning, decisions and their history.

**Largely right, and this audit's evidence supports it more precisely than
the general form suggests.** The clearest demonstration is an accidental
natural experiment sitting in this repository already. `docs/codex-program/
m3-family-parity-register.json` is not a description of data that lives
somewhere else; `lib/canonical-v2/native-producer/m3-family-parity-
register.js` line 1806 loads that exact file (`require(REGISTER_PATH)`) as
its only source. There is no second copy for it to disagree with. Compare
that to the gates in F1/F2, where the same fact (is the vertical slice done)
is asserted independently in three places under two different names. The
parity register cannot suffer that particular disease, by construction, and
it shows: every finding in this audit that touches the parity register (F3)
is about a field *inside* that one file disagreeing with a *computation*
also inside this codebase, never about two files disagreeing with each
other. Single-sourcing the data file eliminated one whole category of drift.
The gates prove what happens without it.

**One sharpening, worth making explicit rather than leaving implied.** "The
code" is not, by itself, a reliable source of truth; F6 is the proof.
`lib/programme-gates/test-executable-registry.js` is code, not prose, and it
still went stale, because it is a hardcoded list (data sitting inside a
JavaScript file), and nothing exercises the specific fact that would reveal
it was wrong (that the listed files still exist). A hardcoded array of
file paths inside a `.js` file has exactly the drift risk of the same array
written in a `.md` file, until something runs and checks it. What actually
earns trust is narrower than "code": it is specifically **a test that runs
every `CI=true npm test`, reads primary sources fresh, and fails loudly on
disagreement** (`governing-registry.js`'s live overlay, `auth-route-
enforcement.test.js`'s directory walk). Static data is static data,
regardless of which file extension it sits in; the reliable thing is the
habit of re-deriving rather than storing.

**The recommendation that follows, concretely.** Where a governed document
states a fact a script could compute (a count, a file's existence, a pass
state, a digest), stop storing the number. Two ways to do this well, both
already modelled somewhere in this repository:

1. **Point at the command, not the number**, exactly as the owner's own
   instinct suggests, and exactly as `nested-lettering-collision.md` and
   `mae-clause-label.md` already do as their opening section ("0.
   Verification command"), and as `P1-PLAN.md`'s retraction (F10) does by
   keeping the measurement method in the text rather than only the
   conclusion. Extend this from "good practice in the best-written notes"
   to "required in every governed document under `docs/codex-program/` and
   `docs/certification/`."
2. **Where a number needs to be readable at a glance** (this audit's own
   executive summary is an example, and so is `ROADMAP.md`'s appendix,
   which exists precisely because scrolling through the whole plan to find
   the current test count is bad UX), generate it, don't type it. A short
   script that regenerates the appendix's numbers and is run as part of the
   same commit that touches the roadmap would have made F15 impossible
   rather than merely quick to catch. The failure in F15 was never that a
   number appeared in prose; it was that the number was hand-typed once and
   never touched again while the codebase kept moving under it.

**The two most severe findings in this audit are both this exact failure,
at its highest stakes.** F26 (a merge plan describing a merge that had
already happened, hours earlier) and F27 (a safety-relevant bug claimed
"tracked" in a location that does not mention it) are not edge cases; they
are what "storing a fact as prose instead of re-deriving it" costs when the
fact happens to matter most. Neither required an adversarial reading to
catch, both are one command away from being unable to go stale ("is this
branch merged", "does ROADMAP.md contain the words 'step 1b'"), and both
sat, wrong, in a document written by a careful process, because nothing
forced either sentence to be re-checked once the world moved under it. This
is the strongest evidence in the whole audit for the owner's instinct: not
that these documents are carelessly written, several of them are the
opposite, but that carefully written prose is still prose, and prose does
not know when it stops being true.

**Where this needs pushback on the owner's framing, not just refinement.**
Not every synthesised claim in these documents reduces to a script. "Would
the other 282 adversarial tests have caught anything" (`ROADMAP.md`,
verified accurate in F8's context) required judgement, checking five real
defects against the catalogue's conceptual coverage, not just its file
list, and concluding two had a "conceptual relative... at a different
layer". No test suite emits that sentence. Reasoning, prioritisation, and
"why we chose this over that" are not just the *residue* left over once the
facts are automated; they are a genuinely separate kind of content this
audit found done well in several places (`DECISIONS.md`'s dated rulings,
`ROADMAP.md`'s own self-audit of the adversarial catalogue). The owner's
formulation already carves out exactly this space ("intent, reasoning,
decisions and their history"); the finding here is only that it should stay
prose *and* should say, in one line, whether the reasoning's conclusion was
ever acted on, because reasoning can go stale too, just on a slower clock
than a test count.

**Conclusion.** Adopt the owner's framing, with the sharpening above stated
plainly: the source of truth is not "the code", it is *whatever gets
exercised on every run and fails loudly when it disagrees with reality*,
which today is the test suite plus a small number of live-computed
overlays, and almost nothing else in `docs/codex-program/` or
`docs/certification/` currently qualifies. Concretely, in priority order:
build check (f) first, today, cheaply, it would have prevented the single
worst finding in this audit; build check (b) next, it is generic and would
have caught the largest cluster of lower-severity findings; delete or
radically narrow `docs/certification/programme-gate-status.json` so it only
ever states what genuinely cannot be computed (the `OWNER_DEEMED` judgement
calls), rather than duplicating what `governing-registry.js` already
computes better; add checks (c) and (g) as small extensions to tests and
conventions that already exist and are already trustworthy; and require
every governed document to carry its measurement command inline, not as an
aspiration, as a condition of the claim being allowed to stand at all.
