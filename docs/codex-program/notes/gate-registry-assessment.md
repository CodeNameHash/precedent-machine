# Gate registry and adversarial-test assessment

Investigation only. No code, test, or fixture changed by this note.

**Pinned to:** commit `9edc0ea7` on `codex/m3-production-phase1`, 2026-08-05
~21:20 ET. At that moment another agent had uncommitted work in progress on
`lib/canonical-v2/native-producer/candidate-resolution.js`,
`termination-fee-parse.js` and `tests/canonical-v2-termination-fee-resolution.test.js`
(untouched by this note). The repo is live; re-run the commands below before
trusting a figure past this snapshot. Every count in this document was
produced by a command shown inline, not estimated.

---

## Recommendation

**Most of the right fix is already built and merged. Ratify it, then keep a
small named subset of the adversarial catalogue and stop scoring the rest —
don't delete it, relabel it.**

In order:

1. **Ratify, in the tracking docs, work that already landed.** Commit
   `2396bf50` (2026-08-05, same day, before this investigation started)
   already did most of what `DECISIONS.md` item 10 asked for: it deleted the
   self-verifying `p9-acceptance-*` layer (confirmed gone, see §1), built a
   real live-evidence closure mechanism for the two gates that were actually
   done (confirmed working, 30/30 tests pass, see §1), and corrected the
   adversarial-test-implemented count from a false 8 down to an honest 7 by
   un-registering a decorative binding (confirmed, see §2). `ROADMAP.md` §3.4
   and the D3 section still describe this in present tense as an open
   problem. That's a paperwork gap, not an engineering one. Fix costs under
   an hour: mark D3 done in `ROADMAP.md`/`EXECUTION-LEDGER.md`, note the
   7/282 correction, and archive `P9-ACCEPTANCE-DEFINITIONS.md` as
   superseded (it already marks itself `WITHDRAWN_NON_AUTHORITY`, but nothing
   downstream says what superseded it).
2. **Do not implement the other 282 adversarial tests, and do not delete
   `adversarial-tests.md`.** My sampling (§2.1: 48 of 289 entries read in
   full, quoted) found zero generic filler. Every entry is a specific,
   falsifiable, mechanism-level behavioural contract — this is real design
   work, not padding. But my cross-check against five real defects fixed in
   the last two days (§3) found that **none of them would have been caught
   by any of the 289 specs, implemented or not** — the catalogue targets a
   different architectural layer (canonical-v2's formal identity/claims/
   release/import invariants) than where real bugs are currently surfacing
   (legacy V1 rendering glue, prompt/regex coverage, deterministic parsing,
   security-tooling correctness). Building out the other 282 now would be
   real effort spent on a layer that isn't yet where the programme's actual
   defect rate lives, largely because — as `P9-ACCEPTANCE-DEFINITIONS.md`
   independently found — most of what those tests need (a real multi-deal
   canonical-v2 corpus, production import machinery, a live cutover
   controller) doesn't exist yet and isn't supposed to yet.
3. **Reclassify, don't score.** `GATE-01` itself — one of the 7 real,
   implemented tests — specifies that the full 289-member catalogue binds
   only `PreCutoverCertification` (M4, the final pre-go-live gate), not any
   milestone the programme has reached (`EXECUTION-LEDGER.md` has
   `P9-CORPUS-CERTIFICATION` at `BLOCKED`, before M3, well before M4). So the
   289 "not implemented" today is not, by the spec's own terms, a current
   failure — it becomes one only if a status report cites the catalogue's
   existence as if it were current coverage. Make that impossible by
   construction: keep the catalogue as a specification (it's good one), stop
   presenting the 289 figure next to a pass count in any document that
   isn't about M4 readiness.
4. **For the 23 still-open gates**, use `P9-ACCEPTANCE-DEFINITIONS.md` as a
   graded starting draft, not a rebuild — it's a rigorous, well-sourced piece
   of prior work that reached materially the same conclusions this note did,
   independently. Its own summary table is a reasonable prioritised backlog.
   Don't formalise all 22 at once. Start with the two it flags as having
   "the strongest existing prose" (`P9_PREIMPORT_TRACEABILITY`,
   `P9_TRACEABILITY`) plus the ones `DECISIONS.md` item 10 already named as
   worth keeping (backup/restore, render parity, structured claims, security,
   import parity, cutover). Leave the corpus-dependent gates
   (`P9_MKT_WORK`, `P9_NUMERIC`, `P9_STRUCTURED_CLAIMS`, `P9_PARTY_LINT`,
   `P9_SHADOW_REEXTRACTION`, `P9_IDENTITY_AND_DRIFT`) and the one gate that
   would require the exact production-scale load test the programme's own
   Tier-A controls forbid pre-cutover (`P9_DATABASE_SOAK`) explicitly marked
   "blocked on a prerequisite that doesn't exist yet," not "neglected."

**Size estimate for this path:** under a day of documentation/reclassification
work (item 1 and 3); no new verifier code required immediately beyond what
already exists (items 2 and 4 are "don't build yet, and here's why," not new
scope). The 21 gates and 282 tests that remain genuinely open get built as a
*consequence* of M3/M4 engineering (the corpus, the importer, the cutover
controller), not as a standalone backlog-clearing project running ahead of
that work.

What I did **not** find: any evidence that "implement the registry properly"
(build all 25 verifiers and 282 tests now) is achievable without first
building the corpus/import/cutover machinery the programme's own phase plan
already says comes later. So that option is not just expensive, it's
sequenced wrong.

---

## 1. The 25 gates: verified count, and why each can't close

### Counting method

```
node -e "
const YAML = require('yaml');
const fs = require('fs');
const doc = YAML.parse(fs.readFileSync('docs/codex-program/programme-gates.yaml','utf8'));
const gates = doc.programme_gate_registry.preproduction_gates;
console.log(gates.length, gates.every(g => g.state === 'OPEN'));
"
```
Result: **25**, all `state: OPEN`. This matches the claim exactly. The 25 are
2 `P1_*` gates and 23 `P9_*` gates (a 24th and 25th P9-shaped slot,
`P9_SECURITY_AUTH` and `P9_PROGRAMME_COMPLETION_ATTESTATION`, are folded into
the same list programmatically — see `governing-registry.js:172-197`).

There is a second registry file, `docs/certification/programme-gate-status.json`
(schema `v1-status`, generation 4, dated 2026-07-24 — an older, parallel
tracking document, not the one `programme-gates.yaml` points to as its
status source). It records `P1_CONTRACT_FREEZE_ATTESTED` and
`P1_VERTICAL_SLICE_PASS` as `PASS`, `mode: OWNER_APPROVED_FABLE_VERIFIED`,
with evidence paths. That's the origin of the ROADMAP claim "two gates have
their substantive work finished and recorded as passed elsewhere."

### The claim, checked against the code that enforces it

`lib/programme-gates/governing-registry.js:399-424` (`validateCurrentRegistry`)
throws unless the loaded YAML deep-equals a hardcoded `CURRENT_V2_REGISTRY_CONTRACT`
object, and that object's own `preproduction_gates` list hardcodes `state:
'OPEN'` for all 25 (line 407: `if (sourceRegistry.preproduction_gates.some((gate)
=> gate.state !== 'OPEN')) throw new Error(...)`). So the literal claim —
**the declared `state:` field can never read anything but OPEN, and the
loader enforces that** — is true today, by design, and is not a bug: the
comment at line 26-36 explains it's deliberate, because the frozen v2
contract must stay byte-identical to what was reviewed.

### But: a second, computed channel now exists (as of commit `2396bf50`, already on HEAD)

The same file adds `computePreproductionGateStatus()` (lines 134-156), which
re-derives evidence **live, from primary sources, every time the registry
loads** — never trusting a stored assertion — for exactly two gates:

```
node -e "
const { createGoverningRegistryAuthority } = require('./lib/programme-gates/governing-registry.js');
const a = createGoverningRegistryAuthority();
console.log(JSON.stringify(a.preproduction_gate_status, null, 2));
" | grep -A4 computed_state
```
Confirmed live: `P1_CONTRACT_BUNDLE_COMPLETE` and `P1_VERTICAL_SLICE_PASS`
both compute `PASS` right now — the first by recompiling the frozen M1
contract bundle twice uncached and checking both the byte-identical
fingerprint and a hash-pinned acknowledgement file's exact wording
(`verifyContractBundleFreezeEvidence`, lines 71-99); the second by
re-validating the committed `VerticalSliceAttestation` against its real,
tested predicate (`verifyVerticalSliceEvidence`, lines 107-118). Every other
gate has no verifier in `CLOSEABLE_GATE_VERIFIERS` and therefore can only
ever report `computed_state: 'OPEN'`, reason
`NO_MECHANICAL_VERIFIER_IMPLEMENTED` — structurally, not as an oversight.

This is consumed downstream (`lib/canonical-v2/successor-m1-readiness-packet.js:281`
reads `preproduction_gate_status[gateId].computed_state === 'PASS'`), and it
is tested, including hostile/adversarial cases (`tests/programme-gates/governing-registry.spec.js`,
run directly: **30/30 pass**, including "gate closure is fail-closed: no
verifier can ever launder an unverified PASS claim" and "gate closure falls
back to OPEN, not a thrown error, when a verifier disagrees with pinned
evidence"). The declared `state: OPEN` in the YAML document is untouched —
that's intentional, not a loophole; the computed overlay is additive.

**So: the "cannot be closed by design" claim is true for 23 of 25 gates and
stale for 2.** It was true for all 25 when `ROADMAP.md`/`DECISIONS.md` were
written; a same-day commit fixed it for the two that had real evidence.
Neither tracking document has been updated to say so.

### The self-verifying layer: confirmed deleted

`DECISIONS.md` item 10 named `lib/programme-gates/p9-acceptance-*` (1,001
lines across 5 modules) as "the self-verifying layer... whose validator
compares its own output to itself and catches nothing," to be deleted.

```
git log --diff-filter=D --oneline -- lib/programme-gates/p9-acceptance-definition-authority.js
→ 2396bf50
for f in lib/programme-gates/p9-acceptance-*.js scripts/write-p9-proposal-only-acceptance-evidence.js \
         tests/programme-gates/p9-acceptance-*.spec.js tests/programme-gates/bootstrap-acceptance-source.spec.js; do
  [ -f "$f" ] && echo EXISTS || echo gone
done
→ gone (all 9 files)
```
Confirmed: all 9 files (4 lib modules, 1 script, 4 test specs) were deleted
in `2396bf50`, the same commit that added the real overlay above. Done, not
proposed.

### Why each of the other 23 can't close: four distinct causes, not one

I did not re-derive this from scratch. `docs/codex-program/P9-ACCEPTANCE-DEFINITIONS.md`
(dated 2026-08-01, status `WITHDRAWN_NON_AUTHORITY` — a proposal that was
never adopted into the YAML) already ran a rigorous, grep-sourced,
gate-by-gate audit of all 22 `P9_*` gates against `canonical-contracts.md`
(14,608 lines), `adversarial-tests.md`, `docs/CODEX-PROGRAM.md`, and the
handoff notes, and reached materially the same conclusion this
investigation reached independently. I spot-checked three of its "no
definition found anywhere" claims myself:

```
grep -c "P9_SCOPE_EXACT"    docs/codex-program/canonical-contracts.md docs/codex-program/adversarial-tests.md docs/CODEX-PROGRAM.md  → 0, 0, 0
grep -c "P9_PARTY_LINT"     (same three files)                                                                                        → 0, 0, 0
grep -c "P9_BACKUP_RESTORE" (same three files)                                                                                        → 0, 0, 0
grep -c "P9_DATABASE_SOAK"  (same three files)                                                                                        → 3, 0, 0  (referenced, not defined)
```
All four spot-checks matched the withdrawn proposal's own findings.

**Grouping (25 total):**

| Group | Cause | Count | Gate IDs |
| --- | --- | --- | --- |
| 1 | Already true; a mechanism to record it now exists and works | 2 | `P1_CONTRACT_BUNDLE_COMPLETE`, `P1_VERTICAL_SLICE_PASS` |
| 2 | Closing condition never written anywhere — the ID appears only in the registry itself | ~12 | `P9_SCOPE_EXACT`, `P9_REGISTRY_DISPOSITIONS`, `P9_BEN_RUNBOOK`, `P9_RENDER_PARITY`, `P9_STRUCTURED_CLAIMS`, `P9_PARTY_LINT`, `P9_IDENTITY_AND_DRIFT`, `P9_STAGING_SMOKE_AND_ROLLBACK`, `P9_BACKUP_RESTORE`, `P9_POSTCUTOVER_SMOKE`, `P9_MKT_WORK`, `P9_NUMERIC` |
| 3 | Defined in prose elsewhere, but the prerequisite infrastructure genuinely doesn't exist yet (corpus, importer, cutover controller) — one case would require a load test the programme's own pre-cutover controls forbid | 8 | `P9_SHADOW_REEXTRACTION`, `P9_BROWSER_A11Y_PERFORMANCE`, `P9_DATABASE_SOAK`, `P9_PREIMPORT_TRACEABILITY`, `P9_IMPORT_PARITY`, `P9_PROMOTION_ELIGIBILITY`, `P9_TRACEABILITY`, `P9_PROGRAMME_COMPLETION_ATTESTATION` |
| 4 | Already has real `acceptance:` criteria written in the live YAML, but the test IDs it names are themselves mostly unimplemented | 1 | `P9_DEPLOYMENT_PARITY` |
| 5 | Needs one specific human act (a signed security review, Ben's one-use authorisation, a written runbook) as much as it needs code | 2 | `P9_SECURITY_AUTH`, `P9_CUTOVER_AUTHORISATION` |

Notes on borderline placements: `P9_MKT_WORK` and `P9_NUMERIC` are in Group 2
by "no exact-ID definition found," but `P9-ACCEPTANCE-DEFINITIONS.md` Flag #2
makes a sharper point that applies to six gates at once (these two plus
`P9_STRUCTURED_CLAIMS`, `P9_PARTY_LINT`, `P9_SHADOW_REEXTRACTION`,
`P9_IDENTITY_AND_DRIFT`): they "presuppose a canonical-v2 corpus that does
not exist and cannot run even in principle" until the native extractor
produces a real multi-deal candidate set — which is itself a real (Group 3)
blocker layered on top of a missing definition (Group 2). I've placed each
under its dominant cause rather than double-counting.

`P9_SECURITY_AUTH` moved groups since the withdrawn proposal was written: at
that time it was duplicated and out of sync between `preproduction_gates`
and `phase_12_security_gates` (its flag #1, a real defect it found). The
current registry has fixed that split — `P9_SECURITY_AUTH` is now a single,
clean preproduction gate with three real acceptance items
(`SECURITY_REVIEW_PASS`, `ZERO_UNRESOLVED_CRITICAL_OR_HIGH_FINDINGS`,
`PRODUCTION_ACCESS_PRECONDITION_VERIFIED`), separate from the Phase 12
deferred list. Substantial engineering against it already shipped in
`2396bf50` (session-cookie auth, the four critical routes repaired not just
contained, an AST-based capability scan — defect 4 in §3 below) — what's missing
is the formal signed review event and the mechanical wiring to record it,
which is why I've placed it in Group 5, not Group 2.

**`P9_RENDER_PARITY` carries a live trap.** `reports/PARITY-GATE-2026-07-15.md`
still exists in the repo, still titled "M2 Parity Gate," and a 2026-07-23
audit already warned it "is the legacy M2 parity gate, not `P9_RENDER_PARITY`
evidence." Nothing currently stops a future status report from citing it by
mistake. Confirmed the file is still there, unflagged, unrenamed.

**`P9_DEPLOYMENT_PARITY` (Group 4) is the one gate that looks most done and
is the best illustration of why "has an acceptance block" isn't the same as
"closeable."** Its YAML entry names `governing_test: DEPLOYMENT-PARITY-FRESHNESS-01`
and `required_adversarial_tests: [POST-ACTIVATION-CONTROLLER-01,
DEPLOY-CUTOVER-01]`. Of those three IDs, only `DEPLOY-CUTOVER-01` is in the
7 implemented (§2). The other two are unimplemented prose specs.

---

## 2. The 289 adversarial tests: verified count, and what "implemented" means

### Counting method

```
grep -cE "^- \`[A-Z0-9_-]+\`:" docs/codex-program/adversarial-tests.md   → 289
```
`lib/programme-gates/test-executable-registry.js` derives the same 289
programmatically (same regex, `matchAll(/^- \`([^\`]+)\`/gm)`), then hashes
the ordered ID list and hard-fails at module load if it doesn't match a
pinned digest — so the 289 count is enforced, not just descriptive.

### The 8-vs-7 correction

```
node -e "
const { MANDATORY_ADVERSARIAL_TEST_IDS, testExecutableState } = require('./lib/programme-gates/test-executable-registry.js');
const impl = MANDATORY_ADVERSARIAL_TEST_IDS.filter(id => testExecutableState(id) === 'IMPLEMENTED');
console.log(impl.length, impl);
"
→ 7  [ 'GATE-01', 'GATE-BOOTSTRAP-01', 'REVIEW-CONTEXT-01', 'VERTICAL-SLICE-01', 'CONTRACT-01', 'P0-ROUTE-01', 'DEPLOY-CUTOVER-01' ]
```
**Current, live count: 7 implemented, 282 unimplemented — not 8/281.** The
gap is deliberate and explained in a code comment
(`test-executable-registry.js:53-62`): `PREVIEW-AUTH-01` was previously
bound to `tests/canonical-v2-staging-preview-access.test.js`, which "asserts
regular expressions against the source text of
`scripts/canonical-v2-staging-preview-access.mjs` — a database
credential-provisioning script — and never issues an HTTP request or
exercises a page." Someone (in the same `2396bf50` commit) deliberately
un-registered it rather than leave a false "IMPLEMENTED" label — the exact
critique this investigation was asked to test for, already self-applied,
one day before this note. `ROADMAP.md`'s "8 are implemented... the one
covering authentication is regular expressions over a script's source text"
is describing the state this fix corrected; it's now stale by exactly one.

### What the 7 real ones actually test

- **`GATE-01`** — the legal-semantic review controller (signing, reviewer
  independence, digest binding). Real tests across 10 files
  (`tests/programme-gates/*.spec.js`), unit-level against the controller
  code, not end-to-end.
- **`GATE-BOOTSTRAP-01`** — the one-time G0 bootstrap nonce/predecessor
  logic. One spec file, unit-level.
- **`REVIEW-CONTEXT-01`** — controller input isolation (fresh session, no
  prior context). 4 spec files, unit-level.
- **`VERTICAL-SLICE-01`** and **`CONTRACT-01`** — the M1/M2 fixture and
  contract-freeze predicates. These are the closest to end-to-end: they run
  the real fixture through the real compiler.
- **`P0-ROUTE-01`** — route containment. Mixed: partly source-text regex
  (checking which handler a route imports), partly real dynamic invocation
  — e.g. `await handler({ method, headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 401)` against the actual handler function
  with a mocked client. Ran it directly: **11/11 pass**. More real than
  `PREVIEW-AUTH-01` was (it executes actual handler code, not just its
  source text), less real than a full HTTP integration test.
- **`DEPLOY-CUTOVER-01`** — staging preview/runtime access, 3 files. Bound
  to real tests, but `P9-ACCEPTANCE-DEFINITIONS.md` separately notes that
  the *string* `DEPLOY-CUTOVER-01` also appears in
  `tests/programme-gates/query-release-contract-closure.spec.js`, which
  only checks that the ID exists in the markdown — a documentation-integrity
  check, not the mechanism test. Both things are true at once; I did not
  fully verify how much of the 2,948-character formal spec for
  `DEPLOY-CUTOVER-01` the three bound files actually exercise versus assert
  by name only.

None of the 7 are decorative in the `PREVIEW-AUTH-01` sense (regex over
unrelated source, no execution). All either compile/validate real objects or
invoke real handler code. The strongest ("does it start a server and make a
live HTTP request the way the new auth enforcement test does") is not met by
any of the 7 — that pattern exists in the codebase (`tests/auth-route-enforcement.test.js`,
101/101 passing, verified directly) but isn't bound to any adversarial-test
ID.

### 2.1 Are the 282 stubs a real backlog or generic filler?

Sampled 48 of 289 entries (16.6%) in full: the 15 shortest by character count
(a plausible place to find filler, if any existed), a systematic spread
sample (every 17th entry, 17 entries, across the whole file), and 16 more
selected for topical relevance to the cross-check in §3. **Zero generic or
placeholder entries found** — no "handles edge cases," no "TBD," no
"miscellaneous." A whole-document scan for filler language
(`edge case|miscellaneous|TBD|TODO|placeholder|to be determined`) returned
zero hits.

Even the shortest entries in the document (138-200 characters) encode a full
falsifiable contract — precondition, mechanism, and expected outcome:

> `ID-SOURCE-01`: distinct receipts or converters producing identical text
> keep distinct source actions and cannot cross-serve evidence.

> `EXACT-DETAIL-FORGED-ID-01`: bare, random, bit-flipped and
> payload-substituted evidence, excerpt, revision, source, blob, payload and
> reference IDs return zero detail bytes.

> `WRITER-SOURCE-MEMBERSHIP-RACE-01`: concurrent scope runs assigning one
> cutoff-selected source to different deals cannot both commit; the loser
> writes no canonical rows.

> `ARCHIVE-ZIP-BOMB-01`: aggregate and per-member expansion limits abort
> streaming before excess allocation, retain bounded proof and consume no
> more than the fleet admission budget.

And from the spread sample, showing the same density holds at the median and
above:

> `REL-CONSTRAINT-FEE-01` (286 chars): seller-side and buyer-side fee,
> payor, payee or right holder, trigger, tail, remedy, denominator basis and
> party are independent fields. Swapping any one or retaining only the
> dollar amount fails constraint, lineage, observation and query
> certification.

> `LOCK-PAIRWISE-CREATION-SLOT-01` (745 chars): GeneratedLockPlanRegistry
> contains every authority key, every declared pairwise-exclusion key and
> every governed creation-slot key with one total order. Race two
> source-to-deal assignments, two correction GENESIS_TARGET creations for
> one slot, creation against supersession, candidate freeze against
> correction, bundle finalise against abandonment and activation against
> revocation. Exactly one complete transaction wins or both write nothing.

> `CROSS-VIEW-SURFACE-01` (1,457 chars, one of the longest): browser
> goldens cover QXO Review and Compare, the query builder and Eli Lilly
> definitions. Compare retains visible left provision navigation... Every
> authorised row is keyboard and pointer actionable, while a non-actionable
> row shows its typed reason... A mixed deal containing canonical,
> reviewed-source-specific and incomplete rows preserves every sibling and
> left-navigation action when the unfamiliar row or its lazy detail renderer
> throws; only that boundary displays the typed failure envelope.

**Ratio: 48/48 specific, 0/48 generic.** Length distribution across all 289
(median 518 characters, p25 343, p75 863, max 11,704) is consistent with
this being uniformly-invested specification prose, not a few detailed
entries padded out with filler to hit 289. This is a real, honestly-written
backlog. The problem is not the specification; it's that almost none of it
has been built, and — per §3 — building it wouldn't have caught what's
actually gone wrong recently.

---

## 3. Cross-check: would the registry have caught the last two days' defects?

Five defect classes, identified from commit messages and diffs:

| # | Defect | Commit | Where it lived |
| - | --- | --- | --- |
| 1 | Card-selection leaks across six review tables (unguarded text-search fallback pulled foreign-family cards into a table) | `f8009ef2`, `70420856` | `components/review/table-configs/*.config.js` (legacy V1 rendering) |
| 2 | Money parser taking the first number in a string (three independent instances) | `70420856`, `2396bf50` | fee parser, comparison layer, `lib/query/derived-fields.js` — now consolidated onto `lib/parse-money.js` |
| 3 | Section overlaps: an article chapeau swallowed the numbered sections after it | `7a67e1a8` | `lib/canonical-v2/native-producer/deterministic-sectionizer.js` |
| 4 | Capability scanner missed HMAC signing because it matched text, not parsed | `7a67e1a8` | `lib/canonical-v2/phase1-authority-boundary-inventory.js` |
| 5 | Quote offsets: substring containment could match the wrong span (inverted an MAE qualifier by dropping "would not") | `61d7280c` | `lib/canonical-v2/representations-dark-bridge.js` and sibling dark-bridge files |

For each, I searched `adversarial-tests.md` for the defect's own vocabulary
and read the closest-sounding entries in full.

**1. Card-selection leaks.** Searched for `card`, `family`, `leak`. The word
"family" appears often in the catalogue, but as `canonical-contracts.md` /
`m3-family-parity-register.json` confirm, it means the same thing there as
in the review tables — a provision-type grouping like
`ANTITRUST_REGULATORY_EFFORTS`. `APPLICABILITY-PRODUCER-EXCLUSIVITY-01` and
`APPLICABILITY-FAMILY-PRODUCER-01` assert that only one designated producer
may write entries for a given family, and a "shared producer, mixed-producer
slice... fails." That is the *same problem in spirit* — is this row/entry
actually scoped to the family it claims — enforced at a different layer
(extraction-time producer exclusivity, via locks and CAS) than where the
actual bug lived (render-time: `components/review/table-configs/termination-fees.config.js`'s
`isClaimedByAnotherFamily()` fallback, matching quote text with no
family guard, entirely legacy V1 code outside `canonical-v2/native-producer`).
**Verdict: architecturally adjacent, not a catch.** If V1's card rendering
is ever migrated onto the V2 producer/resolver model, this class of bug
becomes structurally prevented by that invariant; today, implementing
`APPLICABILITY-PRODUCER-EXCLUSIVITY-01` would not have touched the file
where the bug actually was.

**2. Money parser.** Searched for `dollar figure`, `first number`, `money
parser`, `parse.{0,15}amount`, `termination fee`, `Base Amount`, `REIT`,
`qualifying income`. **Zero hits.** The catalogue never discusses numeric
parsing, currency extraction, or the specific "which figure is the fee"
disambiguation problem. **Verdict: no catch, not even adjacent.**

**3. Section overlaps / chapeau.** Searched for `chapeau`, `article`,
`section overlap`, `sectioniz`, `straddling`, `decimal heading`. "Chapeau"
appears twice, in an unrelated context (which structural element is the
"only qualifying chapeau" for a materiality carve-out, not section-boundary
parsing). **Verdict: no catch.** The sectionizer's own correctness — does
this deterministic text parser draw section boundaries right — is not
covered by any of the 289 specs, even though the sectionizer itself lives
inside `canonical-v2/native-producer`, squarely in the catalogue's stated
territory. This is the sharpest negative finding: the actual root cause of
"37 of 39 candidates disagreed on citations" in a live run sat in code the
formal spec should plausibly have reached, and didn't.

**4. Capability scanner.** Searched for `HMAC`, `capability scan`,
`authority boundary`, `AST`, `abstract syntax`. `AST` appears five times,
always meaning a query/predicate abstract syntax tree (`cohort AST`,
`applicability AST`) — a completely different sense of the term. **Verdict:
no catch.** The tool that scans source files for which capabilities
(network, filesystem, crypto) they exercise is itself pure tooling — a
meta-level correctness question (does our own security-classification script
work) that the product-behaviour-focused adversarial catalogue doesn't
address at all.

**5. Quote offsets.** Searched for `verbatim`, `grounding`, `anchored
contain`, `substring`, `quote text`. Zero direct hits. The closest entry,
`SOURCE-FIDELITY-01`, is about whether primary document conversion (PDF/HTML
→ text) drops or reorders content — a different, upstream layer from
whether a downstream legacy-bridge module correctly grounds a claim's quote
in that text via offset-vs-substring-vs-anchored matching.
`EXACT-DETAIL-MULTISPAN-01` and neighbours are about the *identity and
reference-stability* of evidence spans across releases, not about whether a
given match is the *correct* span. **Verdict: adjacent at best, not a
catch.**

### Conclusion

**None of the five real defect classes found and fixed in the last two days
would have been caught by any of the 289 adversarial tests, implemented or
not.** Two (card-selection family scoping, quote grounding) have
conceptual cousins in the formal catalogue that operate at a different layer
of the stack; three (money parsing, section-boundary parsing, capability-scan
correctness) have no presence in the catalogue at all. This matches
`ROADMAP.md`'s own line exactly: "Every defect actually caught in this
codebase was caught by ordinary engineering... adversarial probing with the
gate off." I can confirm that from the other direction too — I checked the
tests that actually caught these five defects
(`tests/parse-money.test.js`, ran directly: 16/16 pass, including "a
genuinely two-figure headline (real Modiv company fee) returns null, never
the first branch"; `tests/canonical-v2-skechers-replay.test.js` per the
`7a67e1a8` message, now asserting the *absence* of the straddling node it
used to assert the presence of) — these are ordinary, co-located unit tests
against the specific module that broke, not anything in the adversarial
catalogue or gate registry. The registry and the catalogue were not what
caught any of this.

---

## 4. What I could not determine, and why

- **I did not read all 289 adversarial-test bodies.** 48 (16.6%) were read
  in full, chosen to cover the shortest entries, a systematic spread across
  the whole document, and everything topically relevant to the five
  cross-check defects. I'm confident in the "no generic filler" finding
  (the sampling method was designed to find filler if it existed, by
  targeting the shortest entries first) and reasonably confident in the "no
  catch" cross-check findings, but I have not verified that no *other* one
  of the remaining 241 entries touches money parsing, the sectionizer, or
  the capability scanner under vocabulary I didn't search for.
- **I did not open `canonical-contracts.md` (1,013,733 bytes) directly** —
  over the 500KB read limit in the brief. I used targeted `grep` against it
  instead (as `P9-ACCEPTANCE-DEFINITIONS.md`'s own method did) and treated
  that document's gate-by-gate findings as corroborated prior art rather
  than re-deriving all 22 gates' evidence from scratch myself. I
  independently re-checked 4 of its claims by grep (§1) and they held.
- **The "family" vocabulary is genuinely overloaded** in this codebase (a
  provision-type grouping in the review UI and design specs; possibly also
  used for deal-batch cohorts elsewhere in the M3 pilot vocabulary — e.g.
  "the 12-family M3 pilot run," "21 families"). I resolved this specific
  usage via `m3-family-parity-register.json`'s schema, which uses
  `family_id: ANTITRUST_REGULATORY_EFFORTS` etc. matching the review-table
  names exactly, but I would not extend that resolution to every occurrence
  of "family" in the 3,182-line adversarial catalogue without checking each
  one.
- **`DEPLOY-CUTOVER-01`'s real depth is unverified.** It's bound to three
  real test files and I confirmed one (`P0-ROUTE-01`'s sibling behaviour)
  executes real code, but I did not verify how much of its own
  2,948-character formal spec those three files actually exercise versus
  the separate documentation-integrity check
  (`query-release-contract-closure.spec.js`) that only confirms the ID
  string exists in the markdown.
- **This snapshot will drift.** Another agent had uncommitted changes to
  `candidate-resolution.js` and a termination-fee test in progress at the
  time of writing, unrelated to gates or adversarial tests as far as I could
  tell, but I did not wait for that work to land before finishing this note,
  per the brief's instruction not to depend on other agents' in-flight work.
