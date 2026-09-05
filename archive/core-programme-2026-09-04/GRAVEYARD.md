# The graveyard

Code and SQL that was built, works (or worked, or is deliberately built to
refuse), and is not part of what a lawyer sees on the review page today.
This document exists because a reader cannot tell, just by finding a file,
whether it is abandoned-and-kept-on-purpose, abandoned-and-safe-to-delete,
or still live but obscure, and guessing wrong has already cost real,
duplicated work on this programme. For each entry below: what it is, when
and why it was built, why it stopped being used, whether anything still
references it (checked, not guessed, with the exact command), and a
recommendation.

Read `docs/core/CODEBASE-GUIDE.md` first if you have not; this
document assumes its vocabulary (claim, provision, occurrence identity,
write set, open world, dark bridge, serving) without redefining it.

## 0. How to read this, and the mechanism behind most of it

**"Still referenced" was checked by search, not assumed**, using `grep -rl`
across tracked source files, `git log` / `git show` for anything claimed
deleted, and, where the generated inventory already computes the same fact
by tracing the real import graph
(`docs/codex-program/generated/system-inventory.json`), that. Every command
used is quoted in place. This branch had other agents committing to it
while this document was being written; every count below is what the
command returned at the time it was run, not a carried-forward figure.

**Three independent mechanisms, plus a fourth, older one, explain why a
large amount of Canonical V2 code is reachable in the sense of "something
imports it" and still never executes for a real user in production.**
Holding these in mind before reading the entries below will save you from
mistaking "gated" for "dead", and mistaking a permanent design decision for
neglect:

1. `lib/canonical-v2/feature-flags.js`'s `isPermittedCanonicalV2Runtime`
   denies by default and only permits a Vercel preview deployment or local
   development; it governs the Canonical V2 review API, the query UI and
   the process-pilot UI.
2. `lib/canonical-v2/dark-bridge-gate.js` additionally requires an explicit
   environment variable set to one exact value, and separately refuses in
   CI; it governs the four dark bridges (section 1 below).
3. `lib/design/route-guard.js` governs `pages/design/*`, on the same
   preview-or-local principle.
4. Layered on top of all three, as of commit `2396bf50`, `middleware.js`
   now requires a valid session cookie for essentially the whole
   application, page and API route alike, superseding any page's own,
   older assumption that it was reachable without login. Where an entry
   below says a page has no gate of its own, that statement is about the
   page's own code, not about whether it is reachable today; check
   `middleware.js`'s matcher for the current, whole-app answer.

None of the four is a graveyard candidate in itself; each is live,
deliberate, tested, load-bearing code. They are the reason so many of the
entries below are "wired in" and simultaneously "never seen by a real
user".

---

## 1. The metric-scoped serving-admission chain (F16 to F26)

**What it is.** Eleven modules implementing a rigorous, per-fact
certification pipeline for deciding when a Canonical V2 fact is trustworthy
enough to serve: `lib/canonical-v2/qxo-no-shop-copy-delivery-metric-f16.js`,
`lib/canonical-v2/qxo-no-shop-copy-delivery-claim-f17.js`,
`lib/canonical-v2/qxo-no-shop-copy-delivery-serving-f18.js`,
`lib/canonical-v2/qxo-no-shop-copy-delivery-canonical-f19.js`,
`lib/canonical-v2/qxo-no-shop-copy-delivery-query-f20.js`,
`lib/canonical-v2/v12-serving-admission-readiness-f21.js`,
`lib/canonical-v2/metric-serving-admission.js` (F22; the one member of the
set without an "f22" in its filename, identified by its own dedicated test,
`tests/canonical-v2-metric-serving-admission-f22.test.js`),
`lib/canonical-v2/metric-scoped-candidate-release-f23.js`,
`lib/canonical-v2/no-shop-timing-certification-f24.js`,
`lib/canonical-v2/no-shop-actions-certification-f25.js`, and
`lib/canonical-v2/no-shop-cross-view-release-f26.js`.

**When and why it was built.** Designed against
`docs/superpowers/specs/2026-07-27-metric-scoped-serving-admission-f22-design.md`
for one family, NO_SHOP, as the rigorous alternative for deciding when a
family is ready to serve: certify each fact against its own reviewed
evidence before admitting it, rather than eyeballing agreement with the
older system. It is real, tested, and passing.

**Why it stopped being used.** `docs/core/DECISIONS.md` item 13
records the ruling directly: a second, cheaper mechanism (a per-family
`*-serving-source.js` switch plus the equivalence harness,
`scripts/review-parity-check.js`, comparing Canonical V2 against the older
pipeline on real corpus data) was chosen as the standard for all twenty
remaining families instead, on cost grounds. Ben's own reasoning, quoted
there: certifying against hand-authored fixtures "tests it against whoever
wrote the fixture's belief about what the agreement says", where the
equivalence harness "tests V2 against the extraction the programme has
actually been relying on for real deal work, which is a higher bar and a
more honest one", and one converter fix under the certification approach
had already forced roughly 20 modules and 71 files to be re-pinned, a tax
DECISIONS.md item 13 says is "not affordable" paid twenty more times.
DECISIONS.md item 13 also states plainly that this chain "stays in the
repository, real and passing, and is not being deleted" and "is not
extended to any other family": this is a decision, recorded once, not an
oversight repeated eleven times.

**Whether anything still references it.** Each of the eleven has its own
dedicated test file (confirmed by name: `tests/canonical-v2-no-shop-cross-
view-release-f26.test.js`, `tests/canonical-v2-no-shop-timing-
certification-f24.test.js`, `tests/canonical-v2-metric-serving-admission-
f22.test.js`, `tests/canonical-v2-copy-delivery-release-f23.test.js`, and
so on), all of which run and pass under `npm test`. Checked whether
anything outside this cluster's own tests and its own internal cross-wiring
imports any of the eleven:
`grep -rl "no-shop-cross-view-release-f26\|no-shop-actions-certification-
f25\|no-shop-timing-certification-f24\|metric-scoped-candidate-release-
f23\|metric-serving-admission\|v12-serving-admission-readiness-f21\|qxo-no-
shop-copy-delivery" --include="*.js" pages/ components/ lib/queries/` finds
nothing. It is not wired into `pages/api/review/[id]/cards.js` or any other
served route, and is not one of the modules
`docs/codex-program/generated/system-inventory.json`'s `serving_sources`
block lists as a per-family serving source.

**Recommendation: keep, as designed.** DECISIONS.md item 13 already ruled
on this explicitly and recently; there is no open question to re-decide.
The eleven modules are a real, tested, higher-rigour alternative that the
programme chose not to pay for at scale. Deleting it would burn work that
might become the right answer again if a specific family later needs
certification-grade proof rather than corpus-equivalence proof (a
regulator-facing family, for instance); extending it to more families
without a fresh ruling would contradict a decision Ben already made once.

---

## 2. The Modiv termination-fee pilot sidecar

**What it is.** `lib/canonical-v2/native-producer/modiv-termination-fee-
source-parser.js` and `lib/canonical-v2/native-producer/conditional-
termination-fee-value.js`. The parser's `parseModivConditionalFees`
function contains regular expressions matching the literal, word-for-word
defined-term language of one specific agreement, for example
(`modiv-termination-fee-source-parser.js`, verified directly):

```
/"Company Base Amount" means \(x\) if payable pursuant to Section
7\.3\(b\)\(i\), Section 7\.3\(b\)\(ii\) or Section 7\.3\(b\)\(iii\),
\$([\d,]+), or \(y\) if payable pursuant to Section 7\.3\(b\)\(iv\) or
Section 7\.3\(b\)\(v\), \$([\d,]+(?:\.\d+)?)\./g
```

with a hardcoded map of exact section citations to which side of the deal
pays (`EXPECTED_BRANCH_SIDES`, keyed literally on `'7.3(b)(i)'` through
`'7.3(c)'`). This is not a general termination-fee parser narrowly scoped;
it is a parser for one agreement's exact wording, and it will simply fail
to match (not silently misfire) on any other deal's different phrasing.

**When and why it was built.** A pilot for a real deal (Modiv) whose
termination fee is conditional on a REIT qualification test rather than a
flat number, a structure the general termination-fee producer prompt was
not built to handle. Building the general case first was judged riskier
than proving the specific one worked, so this sidecar exists to unblock
that one deal's extraction while the general shape (if it recurs) is
decided later.

**Why it stopped being used, or rather, why it stayed this narrow.** It has
not been generalised because, as far as this repository's evidence shows,
no second deal in the current 40-deal corpus needs it; there is no second
set of regexes for a different REIT-conditional structure anywhere in the
tree.

**Whether anything still references it.** Genuinely wired into the live
extraction chain, not orphaned:
`grep -rl "modiv-termination-fee-source-parser" --include="*.js"` finds
`lib/canonical-v2/termination-product-projection.js` and
`lib/canonical-v2/native-producer/candidate-resolution.js`, both real
production modules, alongside its own test,
`tests/canonical-v2-modiv-termination-fee-source-parser.test.js`. Likewise
`conditional-termination-fee-value.js` is required by
`termination-product-projection.js` and by the Modiv parser itself.

**Recommendation: keep, and treat as a documented exception, not a
template.** It is doing real, correct work for the one deal it covers,
narrowly and safely (it fails to match rather than mis-extracting on other
deals' text). The risk is not that it runs, it is that a future author sees
a working, deal-specific parser wired into a shared production file
(`termination-product-projection.js`) and copies the pattern for a
different one-off instead of asking whether the general producer prompt
should be extended. If a second conditional-fee structure appears, that is
the trigger to generalise rather than to add a second hardcoded sidecar.

---

## 3. `CompareSectionColumn`

**What it is.** One exported symbol,
`export default function CompareSectionColumn({ section, column, onRetry })`,
at `components/review-v2/CompareColumn.jsx:203`. The file it lives in is
very much alive: the same file also exports `UnifiedCompareSection`,
`UnifiedDefinitionsSection`, `CompareMasthead` and `collectOffMarketEntries`,
all genuinely imported by `pages/review/[id].js`, the production review
page's compare mode. `CompareSectionColumn` specifically is the dead part,
not the file.

**When and why it was built.** An earlier per-section compare column
component, superseded when the compare/market rendering was unified into
one shared table shape (`UnifiedCompareSection`) rather than one column
component per section.

**Why it stopped being used.** `docs/codex-program/notes/compare-locator-
fix.md` records the supersession directly: the parity register's
`termination-fee-query-fields` surface pointed at `CompareSectionColumn` as
its locator, found to be dead code, and was repointed at the surviving
mechanism.

**Whether anything still references it.** Checked directly:
`grep -rn "CompareSectionColumn" --include="*.js" --include="*.jsx"
--include="*.json" .` returns exactly one non-comment, non-JSON hit, the
export itself at `components/review-v2/CompareColumn.jsx:203`. Every other
hit is either a comment recording that it is dead
(`tests/canonical-v2-parity-serving-path.test.js`,
`tests/canonical-v2-m3-certification-control.test.js`,
`tests/canonical-v2-m3-certification-control-v2.test.js`,
`tests/programme-gates/m3-family-parity-register.spec.js`) or a
`source_locator` field inside
`docs/codex-program/m3-family-parity-register.json`, naming this symbol as
the (unreachable) evidence path for exactly **sixteen** product-surface
entries, confirmed by counting `"source_locator": "CompareSectionColumn"`
occurrences in that file directly.

**Recommendation: delete the symbol, and separately, fix the sixteen
parity-register entries that still cite it as evidence.** The component
itself is a one-function, self-contained deletion with no other code
depending on it. The sixteen `source_locator` entries pointing at a symbol
that resolves to nothing but its own definition are a live accuracy problem
in a document this whole M3 program uses to decide what still needs work;
each should be repointed at whatever mechanism actually serves that
surface today (the same fix `compare-locator-fix.md` already made once for
`termination-fee-query-fields`), or the surface's disposition corrected if
nothing currently does.

---

## 4. `supabase/canonical-v2-foundation.sql`

**What it is.** An 8,686-line SQL schema (`wc -l supabase/canonical-v2-
foundation.sql`, confirmed) defining every table Canonical V2's write set
needs: `canonical_v2_staging.immutable_source_documents`,
`.provision_components`, `.open_world_candidates`,
`.reviewed_source_specific_rows`, and the rest of the collections named in
`lib/canonical-v2/canonical-writer.js`'s `WRITE_ORDER`, plus the
`public.canonical_v2_write` stored function the writer calls.

**When and why it was built.** To give Canonical V2's write set an
executable destination, the schema-equivalent of everything
`docs/core/CODEBASE-GUIDE.md` section 4.7 describes: excerpts, provisions,
components, claims, relationships, open-world objects.

**Why it stopped being used, or rather, why it has never yet been used.**
It has not been applied to any database, staging or production. Checked
directly:

```
grep -rln "canonical-v2-foundation.sql" tests/ scripts/ lib/ --include="*.js" --include="*.mjs"
```

finds 22 files. Every test among them reads the file as **text** and
pattern-matches against it, for example
`tests/canonical-v2-canonical-writer.test.js:1056-1068`:

```js
const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.immutable_source_documents/);
```

never a live connection to a Postgres instance. `docs/core/
OPERATING-RULES.md`'s current authority boundary still prohibits using real
credentials or a real production database client, and
`programme-gates.yaml`'s Tier A controls list
`NO_EXTRACTION_REPLAY_BACKFILL_OR_LOAD_TEST_AGAINST_PRODUCTION`.

**A real execution path exists, though, and it is worth naming precisely
rather than only saying "never executed".** `scripts/canonical-v2-staging-
schema.mjs` is a genuine apply mechanism: it pins this file's SHA-256
digest, refuses to run unless a real, linked Supabase CLI session names the
exact staging project `deal-corpus-canonical-v2-staging`
(`ref: 'sjumbznveyyiizhwvixj'`), then shells out to
`spawnSync('supabase', ['--workdir', workdir, 'db', 'query', '--linked',
'--file', file], ...)`, wrapping the SQL in `BEGIN;` / `COMMIT;` (or
`ROLLBACK;` in its default dry-run mode) and, after an apply, runs a live
verification probe (a `DO` block that calls `public.canonical_v2_write`
with a forged input digest and checks it is correctly rejected). This is
not pattern matching; it is a real apply-and-verify script. It requires a
live, authenticated Supabase CLI session this repository's own operating
rules bar an agent from establishing, and no receipt, log, or evidence file
recording a completed run was found anywhere in the tree.

**Recommendation: keep, and treat "apply it once, deliberately, to a real
staging database" as the actual next milestone, not further test-writing.**
Over twenty test files already prove the SQL is internally consistent and
matches what the writer expects of it; that return has diminished. The
schema and the apply script both exist and appear ready; what is missing is
a deliberately authorised run against the named staging project, which is a
decision for Ben (it requires the credentials this repository's agents are
currently barred from using), not further engineering.

---

## 5. `condition_groups`' capitalisation-only freeze

**What it is.** `condition_groups` is one of the general collections in
`lib/canonical-v2/canonical-writer.js`'s `WRITE_ORDER`, meant to hold any
family's grouped conditions. `lib/canonical-v2/validate-write-set.js`'s
validator for it, however, hardcodes one schema value throughout: it
requires `semantic.condition_group_component_schema ===
'CAPITALISATION_CONDITION_GROUP/V1'` (`validate-write-set.js:955`), rejects
any row whose own `schema_version` differs from that same literal
(`:982`), and mints identity types named
`CAPITALISATION_CONDITION_GROUP_OCCURRENCE/V1` and
`CAPITALISATION_CONDITION_GROUP_REVISION/V1` (`:1047`, `:1055`) regardless
of which family the caller is actually writing for.

**When and why it was built.** Built for the CAPITALISATION family's own
pilot, where "condition groups" first became a real, needed shape (grouped
share-count and pricing conditions that must close together as one
immutable set).

**Why it stopped being used, or rather, why it never widened.** No second
family has needed grouped conditions yet, so nobody has had to decide what
a general (non-capitalisation) `condition_groups` validator should require.

**Whether anything still references it.** Genuinely live: producers of
`condition_groups` rows are `lib/canonical-v2/native-producer/native-write-
set-adapter.js`, `lib/canonical-v2/canonical-writer.js`,
`lib/canonical-v2/m3-staging-candidate-preflight.js`,
`lib/canonical-v2/persisted-canonical-object-resolution.js`,
`lib/canonical-v2/qxo-capitalisation-f28-writer-link.js`, and
`lib/canonical-v2/qxo-no-shop-inline-permission-f9.js`, confirmed by
`grep -rl "condition_groups" lib/canonical-v2/native-producer/*.js
lib/canonical-v2/*.js`. This is not dead code; it is a general-shaped
collection with a validator that is, today, only actually general in name.

**Recommendation: keep, and flag as a blocker for any second family that
needs grouped conditions, not a silent trap.** A future family attempting
to write a `condition_groups` row will hit a hard, typed rejection
(`CanonicalValidationError`) rather than a silent misclassification, which
is the safe failure mode; the risk this entry exists to name is only that
someone spends time debugging that rejection before realising the fix is
"generalise the validator to accept more than one
`condition_group_component_schema`", not "something is broken with my
family's data".

---

## 6. `candidate-release-import.js`

**What it is.** `lib/canonical-v2/candidate-release-import.js`, a real,
substantial import mechanism: it validates a candidate release bundle and
manifest, checks correction-discharge and input-authority seals, and
imports into a serving directory record, with its own timeout handling
(`DEFAULT_IMPORT_TIMEOUT_MS`, `DEFAULT_ROLLBACK_TIMEOUT_MS`) and a typed
`CandidateReleaseImportError`.

**Why it is here rather than under "still live".** It is real and used,
but not for the thing its name suggests to a reader who has just read
section 4 of `docs/core/CODEBASE-GUIDE.md` about serving. Checked
directly: `grep -rl "candidate-release-import" pages/ lib/canonical-v2/
termination-fee-serving-source.js lib/queries/` returns nothing. It is not
reachable from any served page, and not reachable from the one mechanism
that actually serves live data today (`lib/canonical-v2/termination-fee-
serving-source.js`). Its real callers are entirely the offline QXO staging
pipeline: `lib/canonical-v2/qxo-reverse-f4-candidate.js` (see entry 8
below) and a family of `scripts/canonical-v2-staging-*.mjs` runners
(`canonical-v2-staging-qxo-capitalisation-candidate.mjs`,
`canonical-v2-staging-qxo-f5-candidate.mjs`,
`canonical-v2-staging-product-query-cache-p8.mjs`,
`canonical-v2-staging-product-release-partition-p8.mjs`,
`canonical-v2-staging-qxo-combined-candidate.mjs`,
`canonical-v2-staging-candidate.mjs`,
`canonical-v2-staging-metsera-exclusivity-p8.mjs`,
`canonical-v2-staging-qxo-termination-optionA.mjs`, confirmed by the same
grep), each a Ben-run, one-off local script, none in `package.json`. Its
own `DATA_SOURCE_NOT_CONFIGURED` error expects a "canonical writer RPC
client" that is not configured in this environment.

**Recommendation: keep, correctly labelled.** This is real offline import
tooling for the QXO staging exercises described in entry 8 and in `sql/
optionA/`, not a second, redundant path into the live termination-fee
serving surface. No action needed beyond making sure nobody assumes, from
the name alone, that it is part of the one path that actually serves a
lawyer data today.

---

## 7. `sql/optionA/`, `sql/qxo-reverse-f3/`, `sql/qxo-reverse-f4/`

**What it is.** Three directories of generated, numbered SQL runbooks
(`00-read-lineage.sql`, dry-run and apply pairs, rollback pairs, an
`ATTESTATION.json` or `AUTHORITY-ATTESTATION.json` receipt per directory).
`sql/optionA/README.md` states its own subject directly: "Option A runbook,
QXO termination candidate under F2 (Ben-run, iPad)", governed by
`docs/archive/handoffs/SPEC-QXO-TERMF-F2-CANDIDATE-OPTION-A-2026-07-24.md`.
`sql/qxo-reverse-f3/` and `sql/qxo-reverse-f4/` are structurally parallel
runbook trees for the F3 and F4 steps described in entry 8.

**When and why it was built.** A deliberately manual, human-run pattern
for a small number of high-stakes, one-off data corrections against a real
database: generate the exact SQL, dry-run it, have a person (Ben) apply it
by hand, keep the generated SQL and its attestation as a permanent record
of exactly what ran.

**Why it stopped being used.** Each directory is a record of one completed
(or, for F3, deliberately abandoned, see entry 8) exercise, not a
recurring pipeline. `sql/optionA/`'s own generating scripts
(`scripts/canonical-v2-optiona-authority-partition.mjs` and similar) exist
to produce exactly this directory once for a given run, not to be re-run on
a schedule.

**Whether anything still references it.** The generated SQL itself is read
back by tests: `tests/canonical-v2-optiona-authority-partition.test.js`
reads `sql/optionA/generated/`, and `tests/canonical-v2-qxo-reverse-f3-
candidate.test.js` reads `sql/qxo-reverse-f3/generated/` (confirmed by
`grep -rl` for each directory path under `tests/`). The scripts that
originally produced these directories are a different matter:
`scripts/canonical-v2-generate-qxo-reverse-f3-authority.mjs` and
`scripts/canonical-v2-generate-qxo-reverse-f4-authority.mjs` are plain,
top-level-executing CLI scripts (no `export`, no `module.exports`) with, as
far as a repository-wide search for either basename can find, no requirer
anywhere at all, not even a test: `grep -rl` for each script's basename
across `tests/`, `scripts/`, `lib/`, `pages/` and `components/` returns
nothing. The generated output they produced is still checked; the scripts
that produced it are not run again by anything in the suite.

**Recommendation: keep, as records.** Deleting a signed, dated attestation
of a real database change (or a real, deliberate refusal to make one, in
F3's case) destroys the one thing this kind of directory exists to
preserve: proof of exactly what happened. If disk space or clutter ever
becomes a real concern, archive rather than delete, the same way `docs/
archive/handoffs/` already holds superseded material elsewhere in this
repository.

---

## 8. The QXO reverse F3/F4 candidate-identity code

**What it is.** `lib/canonical-v2/qxo-reverse-candidate-identity.js`,
`lib/canonical-v2/qxo-reverse-f3-authority.js`,
`lib/canonical-v2/qxo-reverse-f3-candidate.js`,
`lib/canonical-v2/qxo-reverse-f4-authority.js`, and
`lib/canonical-v2/qxo-reverse-f4-candidate.js`. Not on the original
candidate list for this document; found while searching for more.

**The F3 half is the notable finding.** `qxo-reverse-f3-candidate.js` is,
in full, six lines (confirmed by reading the whole file):

```js
function buildQxoReverseF3Candidate() {
  throw new Error('F3 failed adversarial legal review and cannot be regenerated or published.');
}

module.exports = {
  buildQxoReverseF3Candidate,
};
```

This is deliberate, not a stub awaiting implementation: its own test,
`tests/canonical-v2-qxo-reverse-f3-candidate.test.js`, contains tests named
`'F3 can never be regenerated or published after failed legal review'` and
`'rejected F3 identity remains deterministic historical evidence'`, neither
skipped. `lib/canonical-v2/qxo-reverse-candidate-identity.js` preserves the
rejection as a permanent lineage marker,
`QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID`, which
`lib/canonical-v2/qxo-buyer-termination-fee-admitted-slice.js` sets as a
`predecessorSemanticClosureId` on real, live data. No document elsewhere in
this repository was found explaining what the failed legal review actually
found; the rejection's substance exists only as this code, this identifier,
and the two SQL runbooks in `sql/qxo-reverse-f3/` (entry 7). If that reason
is not written down somewhere Ben can find it outside this code, it should
be, since the code only proves a rejection happened, not why.

**The F4 half is live, working, offline tooling**, not superseded: `buildQxo
ReverseF4Candidate` is called from `scripts/canonical-v2-staging-qxo-
reverse-f4.mjs` and required by `scripts/canonical-v2-staging-qxo-f5-
candidate.mjs`, both one-off, Ben-run staging scripts (confirmed present in
neither `package.json` nor called by any other script).

**Recommendation: keep both, unchanged.** F3's permanent refusal is
correct, tested, load-bearing behaviour, exactly the shape section 6 of
`docs/core/CODEBASE-GUIDE.md` argues for (a system that can say
"this does not resolve" rather than force a wrong answer); deleting it
would delete a legal safety mechanism, not clean up dead code. F4 is real
offline tooling with real callers. The one action worth taking is
documentary, not code: record, once, in a location a future reader will
find (a `docs/codex-program/notes/` entry would fit the existing
convention), what the F3 legal review actually found, so "failed
adversarial legal review" is not the only trace of it that survives.

---

## 9. The adversarial test catalogue

**What it is.** `docs/codex-program/adversarial-tests.md` names 289
mandatory test IDs (`lib/programme-gates/test-executable-registry.js`'s
`MANDATORY_ADVERSARIAL_TEST_IDS`, derived by reading that file and matching
every `` - `ID` `` line, hash-pinned so the set itself cannot silently
change).

**Measured directly** (parsed the registry's source rather than trusting
either its exported merged view or a prior document's count, see the note
below on why): of the 289, **7** are registered as genuinely implemented,
in `test-executable-registry.js`'s internal, unexported `IMPLEMENTED_TEST_
EXECUTABLE_FILES` object: `P0-ROUTE-01`, `GATE-01`, `GATE-BOOTSTRAP-01`,
`DEPLOY-CUTOVER-01`, `REVIEW-CONTEXT-01`, `CONTRACT-01`, `VERTICAL-
SLICE-01`. The other 282 resolve, via the exported `TEST_EXECUTABLE_FILES`
and `testExecutableState()`, to a single shared file,
`scripts/run-unimplemented-adversarial-test.mjs`, whose entire content is a
function that unconditionally throws `'the frozen adversarial test handler
is not implemented; gate remains OPEN'`.

**Of the 7 implemented tests' own listed backing files, several no longer
exist.** Checked by reading each backing file path in `IMPLEMENTED_TEST_
EXECUTABLE_FILES` and testing existence directly: `P0-ROUTE-01` (3 of 3
exist), `GATE-01` (4 of 10), `GATE-BOOTSTRAP-01` (0 of 1),
`DEPLOY-CUTOVER-01` (3 of 3), `REVIEW-CONTEXT-01` (0 of 4), `CONTRACT-01`
(1 of 4), `VERTICAL-SLICE-01` (1 of 2): 12 of 27 listed files exist. This
matches `docs/codex-program/notes/doc-reality-audit.md`'s F6 finding
(independently reproduced here, not merely copied from it) that a commit
deleted most of these backing files six days before that audit; that
deletion is still unrepaired as of this writing.

**A methodological note worth recording, because the mistake is instructive
in its own right.** A first pass at this measurement, in this same session,
read the exported `TEST_EXECUTABLE_FILES` (which has all 289 keys, because
every unimplemented ID is filled in with the shared throwing stub) and
concluded, wrongly, that all 289 were implemented. The correct figure
required reading `test-executable-registry.js`'s own internal, unexported
constant rather than trusting the first plausible-looking exported value.
This is offered as a small, live demonstration of exactly the failure mode
`doc-reality-audit.md` is about: the wrong number was not a typo or
laziness, it came from a real measurement against a real export that simply
answered a different question than the one being asked.

**Recommendation: this is a gate-registry integrity problem, not a graveyard
entry to delete anything from.** Nothing here should be deleted; the
catalogue and the fail-closed stub are both working as designed (see
DECISIONS.md item 10: "Delete the self-verifying layer, whose validator
compares its own output to itself and catches nothing" was the ruling for a
related but different registry, not this one). What should happen is
repair: the 15 missing backing files for the 7 tests already claimed
implemented should either be restored or those tests should be honestly
re-marked unimplemented until they are, and `doc-reality-audit.md`'s
proposed check (2.2(a), digest-pinning each implemented test's backing
files the way `programmeGateValidatorExecutableDigest` already does for a
different file set) would catch this class of drift automatically going
forward. That is outside this document's file-constraint scope to build
(it touches `lib/programme-gates/`, not the three documents this exercise
owns); recorded here so it is not lost.

---

## 10. `archive/P9-ACCEPTANCE-DEFINITIONS.md`

**What it is.** A 53,059-byte proposal for acceptance definitions covering
the 22 `P9_*` gates in `programme-gates.yaml`.

**Why it is here.** Its own first lines say so: "Status:
`WITHDRAWN_NON_AUTHORITY`... This proposal is retained only as audit
history. It is not a reliable gate inventory or acceptance-definition
source... No text below can issue a definition or `PASS`." It documents its
own reason for withdrawal: an adversarial recovery pass found a missing
terminal candidate leaf (`P9_PROGRAMME_COMPLETION_ATTESTATION`) and found
the nine "missing Ben decisions" it had been built to solve for were
already governed elsewhere.

**Whether anything still references it.** `grep -rl "P9-ACCEPTANCE-
DEFINITIONS" docs/codex-program/*.md lib/ scripts/ tests/` finds it cited
from `docs/parked/process-intelligence/EXECUTION-LEDGER.md` and `docs/codex-program/
ROADMAP.md`, both outside this exercise's file constraint to check or
correct; no code anywhere reads or depends on it.

**Recommendation: keep, exactly as it is.** A withdrawn proposal that
correctly labels itself withdrawn, in its own first line, is the document
behaving exactly as it should; this is closer to a positive example than a
graveyard entry (see `doc-reality-audit.md` part 1.4 for the same point
about the `docs/codex-program/notes/` genre generally). No action needed.

---

## 11. The V1 trusted-capture and replay subsystem

**What it is.** Four modules proposing a way to cryptographically capture
and later replay the older review page's rendered output as trust
evidence: `lib/canonical-v2/v1-capture-evidence-proposal.js`,
`lib/canonical-v2/v1-replay-evidence-proposal.js`,
`lib/canonical-v2/v1-trusted-capture-control-contracts.js`, and
`lib/canonical-v2/v1-trusted-capture-readiness-descriptor.js`. Every schema
name in the set ends `_PROPOSAL/V1`; `v1-capture-evidence-proposal.js`
defines its own not-yet-issued status as literally
`'NOT_ISSUED_PREVIEW_ONLY_NOT_AUTHORITY'`.

**When and why it was built.** A proposed mechanism for proving, later,
that Canonical V2's answers match what the older pipeline actually rendered
for real users, with cryptographic rather than eyeballed proof.

**Why it stopped being used.** It fails closed by construction, not by
accident. `v1-trusted-capture-readiness-descriptor.js` hardcodes
`STATUS = 'BLOCKED_NOT_EXECUTABLE'` and a list of eight missing
requirements (`MISSING_REQUIREMENTS`, quoted in full since each is a real,
unbuilt precondition, not filler): `TRUST_REGISTRY_AMENDMENT_FOR_
CONTROLLER_AND_WORKER_SIGNATURES`, `EXTERNAL_CONTROLLER_AND_WORKER_
REGISTRATIONS`, `APPROVED_READ_ONLY_DATABASE_AUTHORITY`, `CONTROLLED_
CAPTURE_WORKER_EXECUTION`, `COMPLETE_40_BY_19_RENDER_SURFACE_CAPTURE`,
`TWO_INDEPENDENT_REPLAY_EXECUTIONS`, `FINAL_SIGNATURE_VERIFICATION`, and
`PASS_ISSUANCE_CONTROLLER`. Its own validator refuses any input that is not
this exact permanently-blocked shape. None of the eight missing pieces
(controller and worker registration, signature verification, a read-only
production database credential) exists anywhere else in this codebase
either.

**Whether anything still references it.** Each of the four is required by
its own test, by each other (`v1-trusted-capture-readiness-descriptor.js`
requires the other three), and by two further files:
`lib/canonical-v2/successor-m1-readiness-packet.js` and `lib/canonical-v2/
phase1-authority-boundary-inventory.js` (confirmed by `grep -rn` for each
of the four basenames across the tree). Neither of those two is itself
reachable from `pages/` or from any `package.json` script (`grep -rln
"successor-m1-readiness-packet\|phase1-authority-boundary-inventory"
pages/` is empty). The whole six-file cluster is reachable only from its
own tests and from itself.

**Recommendation: keep as a proposal, do not build toward it without a
fresh ruling.** It is honestly labelled as a proposal throughout, correctly
fails closed, and documents a real, coherent design for a genuinely harder
problem (cryptographic parity proof) than the equivalence harness solves
today. Building any of its eight missing requirements would be a
significant undertaking (key custody, signature verification, a new
read-only production credential) that DECISIONS.md's "Source trust is a
human review state, not a cryptographic one" ruling (`docs/core/
OPERATING-RULES.md`, dated 2026-08-05) already argued against for a
closely related problem (proving a document set is complete); the same
reasoning likely applies here and should be revisited explicitly, not
assumed, before anyone starts building toward it.

---

## 12. The Metsera exclusivity pilot

**What it is.** Fifteen modules under `lib/canonical-v2/` implementing an
end-to-end pilot of the "process" (exclusivity and antitrust-covenant)
extraction domain against one real deal, Metsera:
`metsera-comprehensive-selection-review.js`,
`metsera-comprehensive-selection-review-writer.js`,
`metsera-exclusivity-cohort-executor.js`,
`metsera-exclusivity-process-phrasebook-admission.js`,
`metsera-exclusivity-process-phrasebook-admission-adapter-contract-input-
validator.js`, `metsera-exclusivity-product-admission.js`,
`metsera-exclusivity-product-presentation.js`,
`metsera-exclusivity-product-result-set.js`,
`metsera-exclusivity-product-row.js`,
`metsera-exclusivity-product-source-reader.js`,
`metsera-exclusivity-product-surfaces.js`,
`metsera-exclusivity-staging-pilot.js`, `metsera-gold-evidence.js`
(pinned to nine real EDGAR accession numbers), `metsera-pilot-extension-
proposal.js`, and `metsera-pilot-extension-readiness.js`. Not on the
original candidate list; found while searching for more.

**When and why it was built.** To prove the process/exclusivity domain
against one real, sealed set of SEC evidence before generalising it, the
same "prove it on one deal first" pattern as the Modiv termination-fee
sidecar (entry 2) and the metric-scoped serving-admission chain's own
single-family pilot (entry 1).

**Why it stopped being used.** Self-declared, in its own code, not
inferred: `metsera-pilot-extension-proposal.js` builds a manifest whose
body sets `status: SUPERSEDED_STATUS` (the constant `SUPERSEDED_STATUS =
'SUPERSEDED_INCOMPLETE_SCOPE'`) and `superseded_by:
'M3_METSERA_COMPREHENSIVE_SELECTION_REVIEW/V1'`, naming its own successor
schema.

**Whether anything still references it.** Checked each of the fourteen
distinctive module basenames individually (excluding
`metsera-comprehensive-selection-review-writer.js`'s own name, checked
separately) with `grep -rl "<basename>" --include="*.js" --include="*.jsx"
--include="*.mjs" .` for each, then excluded matches under `lib/
canonical-v2/`, `scripts/`, and `tests/`: **zero** matches remain outside
that set for every one of the fourteen. The pilot's own code is reachable
only from its own tests and scripts, exactly like entry 11.

**A frozen snapshot of its output, not the pilot code itself, is what
actually still renders.** A one-time capture of what this pilot produced
was saved as a static fixture, `__fixtures__/canonical-v2/metsera-
exclusivity-p8.json`, and two pages render that fixture directly rather
than calling any of the fourteen live modules above (confirmed by reading
each page's own imports): `pages/design/canonical-v2-metsera-exclusivity-
p8.js` (gated by `lib/design/route-guard.js`, `getServerSideProps` returns
`{ notFound: true }` outside preview or local development, and its own page
copy states "P8 staging-only browser acceptance... Inactive candidate. No
production authority") and `pages/demo/four-deal.js` (via `lib/four-deal-
local-demo-preview.js`'s `require('../__fixtures__/canonical-v2/metsera-
exclusivity-p8.json')`). `pages/demo/four-deal.js` has no page-level gate of
its own, unlike the design page; as of commit `2396bf50`, however,
`middleware.js`'s whole-application session-cookie requirement (section 0
above) covers it too, so this is not, today, an unauthenticated route
despite having no gate written into the page itself.

**Recommendation: keep the pilot code as historical proof-of-concept,
consider whether the frozen fixture still needs its own demo route.** The
fourteen live modules cost nothing to leave in place and are a genuine
record of how the process domain's design was validated. The fixture and
its two consuming pages are a separate question: they are demo/design
tooling, not product surfaces, and both are gated (one by its own code, one
by the newer global session requirement), so there is no live-exposure risk
today; whether `pages/demo/four-deal.js` in particular is still a useful
internal tool or should itself gain the same explicit page-level guard
`pages/design/*` uses is a product decision, not a mechanical finding this
document can settle.

---

## 13. M3 rerun, attempt and pilot scaffolding

**What it is.** A cluster of thirteen modules under `lib/canonical-v2/`
and `lib/canonical-v2/native-producer/` built across successive internal
reruns and audits of the M3 pilot: `m3-attempt-3-package-verifier.js`,
`m3-attempt-3-postrun-assessor.js`, `m3-defined-term-only-adjudication.js`,
`m3-final-pilot-independent-review.js`, `m3-final-pilot-synthesis.js`,
`m3-iteration-2-adversarial-audit.js`, `m3-iteration-2-attempt-3-
materialiser.js`, `m3-iteration-2-independent-review-package.js`,
`m3-iteration-2-rerun-planner.js`, `m3-pilot-adjudication.js`,
`m3-12-call-pilot-prompt-budget-preflight.js`, `m3-12-call-pilot-quality-
gate.js`, and `m3-12-call-pilot-review-packet.js`, plus a closely related
pair, `lib/canonical-v2/m3-preview-source-bundle.js` and `lib/canonical-v2/
native-producer/m3-source-scope-certification.js`. Not on the original
candidate list; found while searching for more.

**When and why it was built.** Each module supported one specific,
dated pass at assessing or re-running the M3 pilot: verifying an attempt's
package, planning a rerun, auditing an iteration, synthesising a final
review. This is process tooling for getting the pilot right, not product
code.

**Why it stopped being used.** The passes it supported are finished; the
tooling that ran them was never deleted afterwards. Two crisp, individually
verified examples of how self-contained a stopping point this cluster
reached: `m3-certification-control-v2.js` (a sibling module in the same
family, `lib/canonical-v2/native-producer/`) hardcodes
`const CERTIFICATION_ADMISSIBLE = false;`, returned unconditionally by
`certificationAdmissible()` and embedded in every response this module
builds, with no code path anywhere that sets it true; and `m3-12-call-
pilot-prompt-budget-preflight.js` and `m3-iteration-2-independent-review-
package.js` each have, confirmed directly, no requirer anywhere in the
tree except their own single test file.

**Whether anything still references it.** Internally cross-wired (for
example `m3-12-call-pilot-quality-gate.js` is required by five siblings in
this same list, including `durable-12-item-pilot-readiness.js`, which in
turn feeds `successor-m1-readiness-packet.js`, entry 11's file), and each
reachable from at most one narrow, one-off `scripts/canonical-v2-*.mjs`
runner (`canonical-v2-verify-m3-attempt-3.mjs`,
`canonical-v2-assess-m3-attempt-3-live.mjs`,
`canonical-v2-prepare-m3-final-pilot-independent-review.mjs`,
`canonical-v2-run-m3-final-pilot-synthesis.mjs`,
`canonical-v2-native-unified-runner.mjs`). None of those scripts appears in
`package.json`'s `scripts` block (checked directly: the file lists only
`dev`, `build`, `generate:home-snapshots`, `generate:query-registry`,
`generate:codebase-inventory`, `start`, `test`, `verify:codex-program`,
`ingest-qa`, `eval`). `m3-defined-term-only-adjudication.js`'s only
requirer anywhere is `tests/canonical-v2-m3-live-modiv-reviewer-pass-
repair.test.js`, a test named for the Modiv cluster (entry 2), not for
itself, suggesting it may be a further, uncatalogued extension of that same
narrow pilot rather than independent scaffolding; this was not traced
further.

**Recommendation: keep the cluster, but treat it as closed history rather
than active tooling, and do not add a fourteenth module to it without
asking whether the next pilot pass needs new tooling or could reuse
`scripts/canonical-v2-live-extraction-run.mjs` (the now-generalised,
25-family live-run script; see `docs/codex-program/generated/system-
inventory.json`'s `live_run_scripts` block).** Nothing here is broken or
misleading; it is dated process tooling for finished passes, genuinely
cheap to leave in place, and a real record of how confidence in the pilot
was actually built. The one loose thread worth someone's attention is
`m3-defined-term-only-adjudication.js`'s odd single test-file connection to
the Modiv cluster, noted above but not resolved here.

---

## 14. pages/compare.js and pages/api/compare.js (deleted)

**What it was.** A standalone deal-comparison page and its API route,
reading directly from the raw `provisions` table rather than the curated
card data every other surface uses.

**Confirmed deleted, not merely unused.** `git show --stat 61d7280c`:

```
commit 61d7280c4e9ce15fdc906b98665377ffd2e845c1
Author: Ben Goodchild <bengoodchild@gmail.com>
Date:   Wed Aug 5 13:24:45 2026 -0400

    feat: retire duplicate compare surfaces, harden quote grounding, consolidate plan

    Retirement (owner-approved)
    - Delete pages/compare.js and pages/api/compare.js, orphaned and reading the
      raw provisions table rather than curated cards.
    - Remove the DEAL_COMPARE and DEAL_TO_MARKET query kinds. The results page
      already only redirected to the review page's own compare mode.
```

Neither file exists in the working tree today. This entry exists only so a
reader who finds a stale reference to either path elsewhere (`docs/
codex-program/notes/doc-reality-audit.md` section 1.3 already flags this
exact pair as a case where a "file not found" sweep would correctly find
them missing, not a defect) has a citable record of when and why, rather
than having to reconstruct it from `git log`.

**Recommendation: nothing to do.** Recorded for completeness, per this
document's own brief: knowing a thing was tried and removed is as useful as
knowing it exists.

---

## 15. `contracts/canonical-v2/successor/`

**What it is.** A large contract-definition tree, 180 files (`find
contracts/canonical-v2/successor -type f | wc -l`, confirmed), covering a
next-generation "process" domain: agreements, events, narration, passages,
relationships, and query compilers, under `contracts/canonical-v2/
successor/agreement/`, `/shared/`, `/product/`, `/governance/` and
`/process/`. Not on the original candidate list; found while searching for
more.

**What was checked, and what was not.** Roughly 35 files under `lib/
canonical-v2/` import from this tree, and roughly 90 test files exercise
it (`grep -rl "contracts/canonical-v2/successor"`, counted). Two, and only
two, user-facing entry points into this domain were traced to a page:
`pages/design/canonical-v2-metsera-exclusivity-p8.js` (entry 12,
route-guarded, synthetic fixture data only) and `pages/query/process/
pilot.js`, linked from `pages/index.js`'s navigation but gated by its own,
stricter check,
`isCanonicalV2ProcessPilotUiEnabled()` (`lib/canonical-v2/feature-
flags.js:55-58`, confirmed directly: `isEnabled(env.CANONICAL_V2_PROCESS_
PILOT_UI_ENABLED) && env.VERCEL_ENV === 'preview'`, a truthy flag alone is
not enough), redirecting to `/` otherwise, and even when open, serving only
`__fixtures__/canonical-v2/process-research-pilot`, never real corpus data.
**What was not done**: a file-by-file reachability trace of all 180 files,
which this pass's time budget did not allow. It is entirely possible some
part of this tree is reachable from somewhere this pass did not check.

**Recommendation: needs a dedicated follow-up audit before any keep, delete
or revive call is made.** Given the size (180 files, roughly 35 live
consumers, roughly 90 tests) and that both known entry points are gated to
preview-or-local and synthetic data only, this reads as a large,
in-progress "successor" contract layer for the process domain rather than
abandoned code, but that is a hypothesis from a partial trace, not a
verified conclusion the way the other fourteen entries in this document
are. Treat this entry as a pointer to where the next graveyard pass should
start, not as a finished assessment.

---

## 16. `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3`, `FIXTURE_CONTRACT_INPUT_V39` -- built, validated, and deliberately not registered to serve

**What it is.** `lib/canonical-v2/contract-bundle.js`'s `TERMINATION_FEE_
TRIGGER_PATH_SCHEMA_V3` (the payment-timing split: `payment_trigger_event` +
`payment_delay` in place of the frozen V2's single `payment_timing`),
`FIXTURE_CONTRACT_INPUT_V39` (the fixture-contract version that carries V2
and V3 side by side), `compileFixtureContractV39()`, and
`lib/canonical-v2/termination-fee-trigger-path.js`'s schema-version-aware
`validateTerminationFeeTriggerEffect` / `EFFECT_KEYS_V3`. Built PLAN.md Step
3J (DECISIONS.md decision 5, "RULED 2026-08-07: split the field. Option B"),
touched again by Step 3J1.

**When and why it was built.** Two of QXO's `payment_timing` values could
not express Modiv's real §7.3(b) drafting (decision 5's own account, and
`docs/codex-program/notes/step-3j-payment-timing.md`). Splitting the field
required a new schema version rather than editing the frozen V2 in place,
because three files this step does not own (`shared-serving-row.js`,
`canonical-contract-technical-relationship-validator.js`,
`qxo-buyer-termination-fee-trigger-detail.js`) import `EFFECT_KEYS` and
`TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2` directly, unmodified, and editing
either in place would have broken all three.

**Why it does not serve anything today, and why that is deliberate, not an
oversight.** Three things are required for Canonical V2 to actually serve a
V3-shaped trigger effect to a reviewer, and none of the three exists:

1. **A metric-operation binding declaring `trigger_path_schema_version: 3`.**
   Every binding in `V4_METRIC_OPERATION_BINDINGS` -- the set every fixture
   version from V4 through V39 inherits unchanged -- pins
   `trigger_path_schema_version: 2`. This is a `contract-bundle.js` edit
   (owned by this step), but it is pointless on its own: nothing downstream
   of it would ever construct an effect matching the new binding.
2. **Registration in `FIXTURE_CONTRACT_FINGERPRINTS`,
   `FIXTURE_SERVING_CONTRACT_FINGERPRINTS` and
   `FIXTURE_CONTRACTS_BY_FINGERPRINT`.** Also a `contract-bundle.js` edit
   (owned by this step). **Tried once, reverted once**: the first attempt at
   Step 3J added `FIXTURE_CONTRACT_FINGERPRINT_V39` to these structures and
   broke `tests/canonical-v2-contract-bundle-versions.test.js`'s exhaustive
   equality check against the fingerprint list -- a test this step does not
   own. Reverted rather than edited, because registering a fingerprint
   nothing produces is a production-wiring decision (should Canonical V2
   serve the new schema to a reviewer), not a bug in that test.
3. **A producer that actually emits a V3-shaped effect** --
   `payment_trigger_event` / `payment_delay` instead of `payment_timing`,
   for a real deal. This is `lib/canonical-v2/native-producer/candidate-
   resolution.js` (or `native-write-set-adapter.js`) territory, neither
   owned by this step, and as of Step 3J1 neither has been changed to
   produce one. `classifyPaymentTimingQuote` and
   `migrateLegacyPaymentTiming` (`termination-product-projection.js`) exist
   and are tested against real Modiv and QXO patterns, but nothing calls
   them from inside the resolution/write-set pipeline; they are reachable
   only from this file's own projection code (Step 3J1's guard wiring, see
   `feeFeatures`) and from tests.

Steps 1 and 2 are both inside this step's owned file and could be done
today; step 3 is not, and doing 1-2 without 3 would register a fingerprint
that still serves nothing real -- exactly the state the first attempt
produced before it was reverted. **The correct order is 3 before 1-2**,
which is why neither has been redone since the revert.

**Whether anything still references it.** Fully wired into this file's own
tests (`tests/canonical-v2-contract-bundle-v39.test.js`,
`tests/canonical-v2-termination-fee-trigger-path-v3.test.js`,
`tests/canonical-v2-payment-timing-split.test.js`,
`tests/canonical-v2-payment-timing-guard-wiring.test.js`) and compiles,
validates and round-trips correctly. `grep -rl
"TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3\|FIXTURE_CONTRACT_INPUT_V39" lib/
pages/ scripts/ --include="*.js"` outside `contract-bundle.js` and
`termination-fee-trigger-path.js` themselves returns nothing -- no serving
code, no producer, no route.

**Recommendation: keep, and treat step 3 above as the actual blocker.**
This is not dead code in the sense of "built and abandoned" -- it is a
correct, tested, additive schema version one committed step (2026-08-07)
past its own production wiring, waiting on a producer change outside this
step's ownership boundary. The risk this entry exists to head off is the
one `CLAUDE.md` opens with: a future pass reading "V3 exists and is
tested" and concluding it already serves, or concluding the split needs to
be rebuilt because nothing appears to consume it. Once a producer emits a
V3-shaped effect for a real deal, steps 1 and 2 above are the entire
remaining path to serving it.

**Update, Step 3J2, same day.** A second, one-version-further instance of
the identical pattern was added: `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4`
(the CONSUMMATION trigger event and the structured, measured `payment_delay`
-- `{count, unit, bound_type}` in place of V3's two-value enum) and
`FIXTURE_CONTRACT_INPUT_V40`. Same three requirements, same status: a
metric-operation binding declaring `trigger_path_schema_version: 4` and
registration in the three fingerprint structures are both inside
`contract-bundle.js` (owned) but deliberately not done, for the same reason
-- no producer emits a V4-shaped effect (Skechers' real CONSUMMATION pattern
and structured delays are classified by `lib/canonical-v2/termination-product-projection.js`'s
`classifyPaymentTimingQuoteV4` / `parsePaymentDelayQuote`, proven against the
real, filed Skechers text in `tests/canonical-v2-skechers-payment-timing-v4
.test.js`, but nothing calls that classifier from inside the resolution/
write-set pipeline either). `FIXTURE_CONTRACT_FINGERPRINT_V40` is compiled
and exported, not registered in `FIXTURE_CONTRACT_FINGERPRINTS` /
`FIXTURE_CONTRACTS_BY_FINGERPRINT` -- `grep -rl
"TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4\|FIXTURE_CONTRACT_INPUT_V40" lib/
pages/ scripts/ --include="*.js"` outside `contract-bundle.js` and
`termination-fee-trigger-path.js` returns nothing. Same recommendation:
keep, treat "a producer that emits a V4-shaped effect" as the actual
blocker, and do not register the fingerprint ahead of one.

---

## 17. The synthetic-fixture Termination Rights review preview (quarantined, 2026-09-04)

**What it is.** `lib/canonical-v2/termination-rights-review-serving-source.js`'s
default registry (`CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES`,
`buildRedHatTerminationRightsReviewSource`), registered for five real
production deal ids -- `RED_HAT_DEAL_ID` (`2b9a6571-6fe7-4aac-931d-
a96ab227ea43`), `METSERA_DEAL_ID`, `SKECHERS_DEAL_ID`, `SKYWATER_DEAL_ID`,
`CONCHO_DEAL_ID` -- all pointing at the same builder. It runs
`generateAnalysisV2` on `__fixtures__/canonical-v2/red-hat-termination-
rights-serving.generated.js`'s `GENERATOR_INPUT`, whose `source_binding.
canonical_text` is exactly 49 UTF-8 bytes: `"shall Company and Parent
familytermination all_of"`. `pages/api/review/[id]/cards.js` calls
`attachCanonicalTerminationRightsReview`, which reaches this registry, on
every request for one of the five deals above.

**When and why it was built.** A preview-only path for demonstrating the
Termination Rights V2 review UI (rows, groups, Stage B disclosure notes)
against the five deals slated to carry real Termination Rights data, ahead
of the M7 V2 repair actually producing that data. Registered
`docs/codex-program/notes/TERMINATION-PREVIEW-SERVING-REGISTRATION-2026-08-24.md`.

**Why it is quarantined now, not deleted.** The external verify-finding
delivery `13-SYNTHETIC-SERVING-PATH.md` (branch `ext/m7-verify-finding`)
identified that nothing distinguished this synthetic, 49-byte-compiled
output from a real agreement analysis once it passed `validateAnalysisV2`
-- that validator only checks a bundle's own internal self-consistency,
never that it traces to a real, admitted corpus record. Concretely: the
fixture's `agreement_id` (`06ec3016…`) IS a member of the sealed M7 V2 Work
3 corpus (`evidence/canonical-v2/stage-2y-structure-migration/control/
m7-v2-repair-work3-agreement-analysis-set.json`), so agreement_id
membership alone cannot catch it; and its `governance.
candidate_registration_id` (`8b8b7f70…`) is a THIRD id that matches no
candidate registration file anywhere in this repository -- not the one
real, currently-registered candidate (`9a3ccbf7…`, stopped by
`docs/codex-program/notes/WORK5-BLOCKED-CANDIDATE-NOT-EXECUTABLE-ON-REAL-
TEXT-2026-09-03.md` for being unable to compile real agreement text at all)
and not the superseded one before it (`0e46052b…`). Ben's instruction
(product code, outside the M7 repair authority in `docs/core/OPERATING-
RULES.md`'s authority boundary): no request path may serve V2 output
compiled from synthetic fixture text. The registry, the fixture, and the
UI it feeds are real, tested, working code with a legitimate future use
(demonstrating the review surface once real Termination Rights data
exists) -- not abandoned code, so deletion would destroy work with no
reason to. `isAdmittedRealAgreementAnalysis()` (added to the same serving-
source module) is the gate: an analysis is served only when its
`agreement_id` is a sealed Work 3 corpus member AND its governance names a
candidate registration this repository actually admits -- today, an empty
allowlist, because no registration has yet compiled real agreement text. A
refusal is a `SyntheticV2AnalysisRefusedError`, thrown rather than
swallowed into the existing FAILED-status-inside-a-200 degrade path, so
`pages/api/review/[id]/cards.js` turns it into an HTTP 410. This closes the
path everywhere it is reachable (`isPermittedCanonicalV2Runtime` already
keeps it off in production; the gate now also refuses it on preview and
local, where the serving sentinel can be turned on) without touching the
fixture, the registry shape, or the UI components that would render real
data the moment the allowlist admits a registration.

**Whether anything still references it.** `grep -rln
"buildRedHatTerminationRightsReviewSource" lib/ pages/ scripts/ tests/
__fixtures__/` returns the registry itself
(`lib/canonical-v2/termination-rights-review-serving-source.js`) and
`tests/canonical-v2-termination-rights-preview-registration.test.js`.
Separately, `grep -rl "attachCanonicalTerminationRightsReview" pages/`
confirms the one served route that reaches the registry:
`pages/api/review/[id]/cards.js`, importing the function by name, not
mentioning the builder or the fixture path directly. The fixture module's
own header names its generator,
`scripts/generate-red-hat-termination-rights-serving-module.mjs`, which
regenerates it from `tests/stage-2y-structure-m7-v2-repair-contract.test.js`'s
`buildGovernedCompilerPreviewBundle`. The new gate itself is exercised by
`tests/canonical-v2-termination-rights-review-synthetic-quarantine.test.js`
(added with this quarantine) and the six tests in
`tests/canonical-v2-termination-rights-preview-registration.test.js` that
used to assert successful synthetic-row rendering for the five deals and
now assert the refusal instead.

**Recommendation: keep, gated to empty, until Work 5 produces an admitted
registration.** Nothing here is dead -- it is a real, tested preview
mechanism, deliberately closed by an explicit, provable, and currently-
empty allowlist rather than by deletion, exactly the "quarantine over
delete" instruction it was built to satisfy. Once a future M7 V2 candidate
registration actually compiles real agreement text for one of the five
deals and is added to `ADMITTED_M7_V2_CANDIDATE_REGISTRATION_IDS`, this
same registry starts serving real rows for that deal with no further code
change.

---

## What was checked and ruled out

Recorded so nobody re-investigates the same dead ends. Each of these was a
real, followed lead that turned out not to be a graveyard candidate:

- **`lib/canonical-v2/candidate-release.js`** (not `-import`, entry 6):
  over 70 requirers across fixtures, tests, staging scripts and seven other
  `lib/canonical-v2/` production modules. Core, live infrastructure.
- **`lib/canonical-v2/legacy-query-mapper.js`**: required directly by `pages/query/
  [kind]/[id].js`, a real, navigable route. Its own header describes itself
  as "the single interception point between the legacy ad hoc query
  builders... and the frozen canonical Query contract", and it is exactly
  that.
- **`supabase/canonical-v2-serving.sql`** and **`supabase/canonical-v2-
  product-candidate-result-writer.sql`**: both additive, staging-schema-only
  files, both actively exercised by the staging harness and referenced by
  over a dozen tests each. Not comparable to entry 4's foundation schema.
- **`supabase/wp-review-strict-v1.sql`**: a real, applied migration
  supporting a shipped feature (`ProvisionSubRowTable.jsx` and its
  acceptance tests), documented in `WP-REVIEW-STRICT-V1-REPORT.md` at the
  repository root.
- **`docs/superpowers/specs/`** (47 files): searched every file for
  supersession language; every hit found was an internal correction within
  the same living document (for example a design's own "this correction
  supersedes any earlier 'unused' characterisation"), not one whole spec
  file replaced by a different, later one.
- **`docs/codex-program/notes/`**: searched for a rejected proposal whose
  code still sits live in the tree (the shape this document's other
  entries are made of). The rejections found in this pass were all ideas
  considered and never built in the first place, not code that outlived
  its own rejection. This search sampled roughly half the directory rather
  than reading every file in full; a genuine instance of the pattern may
  still exist in the unsampled half.
