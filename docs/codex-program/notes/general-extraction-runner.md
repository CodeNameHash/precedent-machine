# General extraction runner

`scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs` is now
a general live-extraction runner. Same file, same name (renaming it was not
required and would have meant extra governance-inventory bookkeeping for no
benefit). It still defaults to exactly the Modiv/Global Net Lease
TERMINATION_FEE run it has always done. It can now also run any of the 25
registered section families against any deal that has a committed, pinned
source in the script's own `DEAL_PINS` table.

## How to run it, in plain terms

Two things decide what a run does: **which deal** (whose document are we
reading) and **which family** (what kind of provision are we asking the
model to find). Both have to be things this script already knows about, or
it refuses to start.

**Deals it knows about today:**

- `modiv` (the default). Modiv, Inc. / Global Net Lease, Inc. Its
  TERMINATION_FEE run also has a pinned default section list (7.1, 7.3,
  8.12), so the plain command below still needs nothing beyond an output
  folder.
- `topbuild`. QXO, Inc. / TopBuild Corp. No default section list is pinned
  for any family yet, so a TopBuild run must be told which sections to read
  (see below).

A deal not on this list is refused outright, with a message telling you
which deals are available. Adding a new deal is a deliberate step (someone
has to fetch the document, hash it, and add a pin), never something this
script infers on its own.

**Families it knows about today:** all 25 registered in the extraction
engine, including TERMINATION_FEE, MAE_DEFINITION, NO_SHOP,
CLOSING_CONDITIONS, MATERIAL_CONTRACTS, REPRESENTATIONS, CONSIDERATION and
the rest. Naming a family the engine has never heard of is refused outright,
with the full list of valid names in the error.

**The plain, unchanged command** (identical to every prior Modiv run
tonight):

```
node scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs \
  --out-dir evidence/canonical-v2/<some-new-folder>
```

**Running a different family on a different deal.** Two extra things are
required: which family, and which sections of the document that family
should read. Section numbers are not guessed, because which sections carry
a given topic differs from agreement to agreement. Example, reading
TopBuild's MAE definition:

```
node scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs \
  --deal topbuild \
  --family MAE_DEFINITION \
  --section-refs "3.1(d)(iii)" \
  --out-dir evidence/canonical-v2/<some-new-folder>
```

**Before spending any model calls, run it with `--dry-run` added.** This
reads the document, checks it against the pinned hash, finds the sections
you named, and reports exactly what a live run would do (how many model
calls, which family's prompt version, whether every section was actually
found) without calling a model at all. It costs nothing and takes a couple
of seconds. Tonight's three live Modiv runs each needed to be run for real
partly to learn things a dry run would have shown for free (a wrong section
number, or a section that doesn't carry the shape expected of it) -- use it
first.

**`--follow-citations`** is unchanged and still off by default. It makes the
script chase a bare cross-reference ("...pursuant to Section 7.1(c)(i)") one
hop further, at extra cost (roughly five times as many model calls on the
Modiv filing). It only ever does anything for TERMINATION_FEE fee-trigger
language; naming it for any other family is accepted but has no effect,
reported as such rather than silently doing something unexpected.

## The safety property this did not lose

The script never trusts a source file just because it is sitting at a
path. It re-derives the file's own hash and a second hash of the cleaned-up
text extracted from it, and compares both against a value that was pinned
in advance for that specific deal. If either does not match, the run stops
before doing anything else. This did not change. What changed is that the
pinned values now live in one table (`DEAL_PINS`) keyed by deal, instead of
being the only deal a run could ever be reading. A deal with no entry in
that table cannot be run, full stop -- the same way an unpinned deal always
could not be run, there is just room for more than one deal now.

Modiv's two pinned hashes are copied verbatim from the values this script
has used all along. TopBuild's two hashes were produced the same way this
script has always produced Modiv's: read the committed file, hash it,
convert it, hash the converted text, and independently checked against
`tests/fixtures/canonical-v2/mae-definition-family/topbuild-intake-pin.json`,
a pin file already committed to this repo from earlier work. Both hashes
and both byte lengths match that file exactly. Nothing was invented.

## What happens when something is wrong

Three separate mistakes are each refused with their own distinct message,
before any file is touched beyond the pin table itself where possible:

- **A deal nobody has pinned** (`--deal some-typo`): refused with
  `UNPINNED_DEAL`, listing the deals that are available.
- **A family the engine does not know** (`--family NOT_A_REAL_FAMILY`):
  refused with `UNREGISTERED_FAMILY`, listing all 25 valid names.
- **A source file that does not match its deal's pin** (wrong file, edited
  file, or a --raw-html pointed at the wrong deal's document): refused with
  `RAW_BYTES_HASH_MISMATCH` or `CANONICAL_TEXT_HASH_MISMATCH`, naming both
  the expected and the actual hash.

A fourth case is also handled: naming a deal and family that has no pinned
default section list, without naming `--section-refs` yourself, is refused
with a message asking for the sections explicitly, before the source file
is even read.

## What is still Modiv-shaped, on purpose

- The plain command's output files (`source-reference.json`,
  `section-location-scan.json`, `run-manifest.json`, and so on) keep the
  same file names and the same important fields (document hash, section
  bounds, model call count, prompt version). Two narrative fields that only
  ever described one specific historical Modiv run were dropped from
  `run-manifest.json` (they are preserved in this script's own header
  comment instead); nothing that any existing test reads was touched --
  confirmed by search before making the change.
- `--follow-citations`'s underlying mechanism
  (`native-extraction-run-citation-followup.js`) is still written only for
  TERMINATION_FEE fee triggers. Generalising that mechanism itself was not
  part of this task; it already reports itself as a no-op for every other
  family rather than doing something silently family-specific.

## Verification

Ran offline only. No live model call, no `claude` CLI subprocess, anywhere
in this work -- proved structurally (dry run returns before the one place
this script ever spawns a model call) and mechanically (the tests below
assert that a dry run never writes a recorded-response/telemetry/receipt
file, which only Step 3 -- the live-call step -- ever writes).

New test file: `tests/canonical-v2-general-extraction-runner.test.js`, 31
tests, all passing:

- Bare `--out-dir` resolves to the unchanged Modiv/TERMINATION_FEE defaults
  (deal, family, section list, source path, agreement date), both as a pure
  config-resolution check and as a real `--dry-run` subprocess run, which
  reproduces the exact section byte-offsets already pinned by the sibling
  replay test (`tests/canonical-v2-modiv-termination-fee-scope-correction-
  replay.test.js`'s own `EXPECTED_SECTION_BOUNDS`).
- TopBuild + MAE_DEFINITION + its real section reference (`3.1(d)(iii)`,
  the same fixture this repo already committed for the MAE-definition
  family) reaches the point of dispatch in a real `--dry-run` subprocess
  run: correct prompt id/version resolved, correct section found (a
  SUBSECTION, not a SECTION -- proving the generic path does not force
  Modiv's stricter shape onto an unfamiliar deal/family pair), zero files
  written that only a live call would write.
- All three refusal modes (unpinned deal, unregistered family, mismatched
  digest) fail with distinct, greppable messages, exercised both as pure
  function calls and as real CLI subprocess runs checking the exit code and
  stderr.
- TopBuild's pin is cross-checked directly against the committed
  `topbuild-intake-pin.json` fixture in the test itself, not just asserted.
- Every one of the 25 registered families resolves a real `prompt_id`/
  `prompt_version` with zero model calls (the mechanism that replaced the
  old hard-coded termination-fee-only import).

Existing regression coverage re-run and confirmed unaffected: both
pre-existing Modiv replay tests (`...-scope-correction-replay.test.js`,
17 tests; `...-citation-following-replay.test.js`, 9 tests) and the
governance capability-boundary suite (`tests/canonical-v2-phase1-authority-
boundary.test.js`, 19 tests) all pass unchanged. The modified script keeps
its existing `LIVE_EXTRACTION_RUN` classification in
`lib/canonical-v2/phase1-authority-boundary-inventory.js` -- same file path,
so no new governance-inventory entry was needed; its capability boundary
(provider, external_process, filesystem_write, nothing else) is unchanged
and still asserted by that suite. The new test file lives under `tests/`,
not one of the governance gate's production roots, so it needed no
classification of its own.

Full suite, `CI=true npm test > /tmp/runner.log 2>&1; echo "EXIT=$?"`, run
twice. First run: **EXIT=1**, 7591 tests, 7543 pass, 6 fail, 42 skipped. All
6 failures were pre-existing and unrelated to this work: 4 in
`tests/codex-program-specification.test.js` (a "Specification drift
manifest is stale" check against `docs/codex-program/specification-
manifest.json`) and 2 in `tests/programme-gates/m3-family-parity-
register.spec.js` (against `lib/canonical-v2/native-producer/m3-family-
parity-register.js` and its own `.json` register). Confirmed unrelated
three ways before moving on: neither failing test file mentions this
script, this task's new test file, or `DEAL_PINS`, by direct grep; every
file either failure touches (`specification-manifest.json`,
`canonical-contract-bundle-pre-review-package-assembler.js`,
`m3-family-parity-register.js` and `.json`) was already showing as
modified, uncommitted, in `git status` before this task started -- another
agent's concurrent in-progress work on this shared branch, per this
branch's own working convention (see e.g. this directory's
`family-rollout-mechanics.md` header for the same acknowledgement); and
`git diff --stat` against every one of those paths showed zero lines
changed by this task.

Second run, after that concurrent work settled: **EXIT=0**, 7622 tests,
7580 pass, 0 fail, 42 skipped. Re-confirmed with a targeted re-run of just
the four directly relevant files (this task's new test file, the
governance capability-boundary suite, and both pre-existing Modiv replay
tests): 67 tests, 67 pass, 0 fail.

This task touched exactly two files:
`scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs`
(generalised) and `tests/canonical-v2-general-extraction-runner.test.js`
(new).
