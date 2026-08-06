# Resolver reference fixes: MEETING_REF, TERMINATING_PARTY_REF, CONTROL_PARTY_REF

Scope: `lib/canonical-v2/native-producer/candidate-resolution.js` only, per the
file-ownership constraint for this task. Three named fixes from the brief,
against the Modiv evidence at `evidence/canonical-v2/modiv-proxy-meeting-20260806/`
and `evidence/canonical-v2/modiv-termination-20260806/`.

## Method

All three fixes were verified by building a faithful replay harness
(`/tmp/resolverfix/replay-termination.mjs`, not committed) that runs the real
recorded model response for section 7.1 (`native-producer-recorded-response-
7.1.json` and `-7.2.json`) through the real, unmodified `runNativeExtraction`
+ `resolveCandidates` pipeline, against the real Modiv document converted from
the committed raw HTML fixture (`tests/fixtures/canonical-v2/mae-definition-
family/modiv-raw-fetched.htm`, via `convertSecHtmlToCanonicalText`, the exact
function the real runner uses). Before any patch, this harness reproduces the
committed evidence exactly: `resolved: 1, review_queue: 16, open_world: 13,
residuals: 0`, matching `evidence/canonical-v2/modiv-termination-20260806/
resolution.json`'s own `resolution_receipt.counts` byte for byte, and every
individual review_queue reason/citation matches too. This is the proof the
harness is faithful, not a separate synthetic shape. The same document
conversion was independently checked against `tests/fixtures/canonical-v2/
mae-definition-family/modiv-raw-fetched.htm`'s own `source-reference.json`:
`canonical_text_sha256` matches exactly (`0ce6bc29...`); the resolution.json
`document_hash` field is the RAW HTML bytes' sha256, not the canonical text's,
confirmed by cross-reading `source-reference.json`'s own `raw_bytes_sha256`
field, which is the same value -- this cost some time to work out and is worth
recording so the next person does not re-derive it.

A UTF-8/UTF-16 offset bug was avoided throughout by using the file's own
`byteOffset(text, characterOffset)` helper (candidate-resolution.js:1329,
converts a JS string char-index from `.indexOf`/regex `.exec().index` into a
UTF-8 byte offset via `Buffer.byteLength(text.slice(0, characterOffset),
'utf8')`) wherever a JS-string search position needed to combine with a
`section.start`/`section.end` byte offset. No probe in this task compared a
raw string index against a byte offset directly.

## Fix 1: MEETING_REF_NOT_IN_QUOTE (PROXY_MEETING, section 5.4)

**Correction to the brief and the aggregate review before fixing anything.**
Both say "all four references appear verbatim in the real section 5.4 text,"
i.e. all four are the pre-fix MAE shape (present, just narrowed out of the
quote). Checked directly against the real recorded response
(`evidence/canonical-v2/modiv-proxy-meeting-20260806/native-producer-recorded-
response-5.4.json`), matching each flagged candidate's exact `raw_value` to
its source assertion object programmatically (script output below, not
eyeballed): **two of the four have `meeting_ref: null` in the model's own
output, not a narrowed-but-present reference.**

```
raw_value: "commence a broker search (and any additional broker searches...)"
  assertion_kind: BROKER_SEARCH_OBLIGATION | meeting_ref: null
raw_value: "for the absence of a quorum"
  assertion_kind: ADJOURNMENT_REASON | meeting_ref: "the Company Common Stockholders' Meeting"
raw_value: "if required by Law"
  assertion_kind: ADJOURNMENT_REASON | meeting_ref: "the Company Common Stockholders' Meeting"
raw_value: "establish a record date for and give notice of a meeting of its stockholders"
  assertion_kind: RECORD_DATE_ESTABLISHMENT | meeting_ref: null
```

So only 2 of the 4 are the MAE shape (quorum, required-by-law). The other 2
are the *same* null-vs-absent conflation the brief separately names for
`CONTROL_PARTY_REF_NOT_IN_QUOTE` (fix 3) -- `handleProxyMeetingCandidate`'s
`refField` gate at the old line 4469 (`!refValue || !quote.includes(refValue)`)
folds "no reference proposed" and "reference proposed but narrowed out" into
one reason code, the identical bug shape, one gate earlier in the same
function. This is a finding beyond what the brief asked me to check, reported
because the brief's own instruction is "verify diagnoses before building on
them," and this one only partly held.

**Design.** Not a copy of MAE's three-tier machinery: `meeting_ref` is a
single constant, repeated defined term ("the Company Common Stockholders'
Meeting" -- confirmed the only non-null value across all 21 compiled
candidates in this run), not a positionally unique clause label the way
`clause_label` is. MAE's tier 2 (adjacency to a uniquely-located quote) has
nothing to bite on here: the term legitimately repeats 10+ times through
section 5.4. Checked the real section 5.4 text directly
(`tests/fixtures/.../modiv-raw-fetched.htm` converted, sliced 229977-246111):
there is exactly one meeting concept in this whole section (only the Company's
stockholders vote; Parent's own shareholders never need to under this
agreement's structure), so "does the reference appear anywhere in the real
governing section text" cannot be confused with a different, wrong meeting
the way it might on a dual-sided-vote deal -- checked, not assumed.

Two separate, independently-justified changes to `handleProxyMeetingCandidate`:

1. Split the absent case out first: `refField && !refValue` now pushes
   `${refField.toUpperCase()}_ABSENT` (a new reason) and returns, before the
   substring check ever runs. This changes reason codes for both meeting_ref
   and (never-observed-in-this-run) document_ref absence cases, but does not
   change resolution status for either -- both still queue, exactly as
   before, just under an honest reason.
2. For `refField === 'meeting_ref'` only, when the narrow-quote substring
   check fails, a second check verifies `refValue` is a real substring of the
   governing section's own admitted text
   (`proxyMeetingReferenceVerifiedInSection`, new pure function). Passing this
   lets the candidate continue processing (not push to review) exactly the
   way passing the original check always did. `document_ref` is untouched --
   no committed candidate has ever exercised a narrowed document_ref, so no
   widened check is written for it; extending to a field with zero evidence
   would violate the task's own "regression test from real recorded bytes"
   rule.

**Result, measured by replay** (`node --test` against the new fixture-based
regression test, see Verification): of the 4 originally-flagged candidates,
the 2 genuine MAE-shape ones (quorum, required-by-law) now resolve fully --
both pass their downstream `ADJOURNMENT_REASON_PATTERNS` corroboration too
(`QUORUM_ABSENT`/`LEGAL_REQUIREMENT` patterns both match the narrow quotes
directly, checked, not assumed). The 2 null-meeting_ref candidates (broker
search, record date) now queue under `MEETING_REF_ABSENT` instead of
`MEETING_REF_NOT_IN_QUOTE` -- still queued, not resolved; no decision made
about whether a null meeting_ref should ever resolve.

## Fix 3: CONTROL_PARTY_REF_NOT_IN_QUOTE (PROXY_MEETING, section 5.4)

Confirmed exactly as the brief states, programmatically matched against the
recorded response: the one flagged candidate (`"in no event shall the Company
Common Stockholders' Meeting be (I) postponed more than a total of three (3)
times"`, ADJOURNMENT_COUNT_CAP) has `control_party: null` in the model's own
output. This is a passive-voice clause with no actor named -- there is
genuinely no reference for any check to verify.

**Fix.** Same shape as fix 1's absent-split: `handleProxyMeetingCandidate`'s
`ADJOURNMENT_COUNT_CAP`/`ADJOURNMENT_DURATION_CAP` branch now checks
`!controlParty` first, pushing a new `CONTROL_PARTY_REF_ABSENT` reason and
returning before the substring check runs. `!quote.includes(controlParty)`
keeps the original `CONTROL_PARTY_REF_NOT_IN_QUOTE` reason, now reachable only
when a control party was genuinely proposed and genuinely absent from the
quote.

**Not decided, per the brief.** Whether a null control party should ever
resolve, queue under this distinct reason (current behaviour), or be refused
outright is a schema/legal-meaning question left to the family owner.
Recommendation, not a decision: a passive "shall not be postponed more than
three times" clause has an implicit actor (the party controlling the
adjournment, contextually the Company per the surrounding (c) covenant), but
inferring that actor from surrounding structure is exactly the kind of
judgment call this task was told not to make silently. Queuing under a
distinct, honest reason (as implemented) seems like the safe default until
that decision is made -- it does not fabricate a party, and it does not
conflate this candidate's failure mode with the four genuinely-narrowed-quote
cases.

## Fix 2: TERMINATING_PARTY_REF_NOT_IN_QUOTE (TERMINATION, section 7.1)

**The review's diagnosis was verified, not just trusted, before building on
it.** Read the real section 7.1 text directly (converted from the committed
raw HTML via the real `convertSecHtmlToCanonicalText`, cross-checked against
`section-reference.json`'s own `canonical_text_sha256`). Confirmed: the
section chapeau names no party; the grants live in the lettered limb heads --
"(b) by either the Company, on the one hand, or Parent, on the other hand, by
written notice to the other, if:", "(c) by written notice from the Company to
Parent, if:", "(d) by written notice from Parent to the Company, if:". Also
confirmed directly: `findTerminationGrantContext` (the existing rescue) does
not match anywhere in this section for any of the 12 flagged candidates --
its first pattern wants active voice ("PARTY may terminate this Agreement")
that is absent; its second wants the party adjacent to "by" within 400
characters of the section chapeau, while the limbs sit thousands of bytes in.
Also confirmed: the sectionizer's own tree resolves 7.1(b), 7.1(c), 7.1(d),
and their own numbered children as real nodes (not just 7.1 itself) --
`citation_validation.derived_citation` on each compiled candidate is already
the deep citation ("7.1(d)(ii)"), sourced from `native-extraction-run.js`'s
own tree-based `deriveCitationForSpan`, not from anything this fix adds.

**Design: anchor on the candidate's own limb citation, never a document-wide
search.** Three new pure functions plus one composing function, all in
`candidate-resolution.js`:

- `terminationLimbLetter(sectionReference, citationReference)`: string-only,
  no text search -- "7.1(d)(ii)" under section "7.1" gives "d".
- `findTerminationLimbChapeau`: locates that ONE lettered limb's own marker
  in the real section text, paragraph-initial only (preceded by start-of-
  text or a newline). This is what tells a real limb marker apart from an
  inline cross-reference like "Section 6.3(a)" or "Section 6.2(b)" -- both
  genuinely present inside 7.1(c)(ii)/(d)(i)'s own quotes, confirmed by
  reading the real text, and exactly the kind of false positive a bare
  `\(x\)` scan (the same shape `sourceCitationContext`'s own pre-existing
  marker walk already uses for a different purpose, `child_clause_quote`/
  `parent_chapeau_quote` display strings) would not exclude. Fails closed
  (null) on zero or more than one paragraph-initial occurrence of the
  letter, and on no colon found to bound the chapeau -- never guesses a
  boundary. The chapeau ends at the colon that opens its own numbered
  sub-list, the same "chapeau ends at the next colon" convention
  `findIocChapeau`/`findTerminationGrantContext` already use one level up.
- `parseTerminationLimbDirection`: structural parse of the limb's own
  chapeau text only. Two recognised forms -- "by written notice from X to Y"
  (grants to X, the notice-giver) and "by either X ... or Y" (grants to
  both). Anything else is `UNRECOGNISED`, never guessed.
- `findTerminationLimbGrantContext`: composes the three above, and is the
  REAL gate against the trap. Every real Modiv limb chapeau names BOTH
  parties, so a naive "does the widened text contain terminating_party"
  substring check would corroborate the wrong party on half of them (proven
  directly: `"the Company"` is a genuine substring of `"(d) by written
  notice from Parent to the Company, if:"`). This function never relies on
  that substring check to do the real work: it resolves the chapeau's
  GRANTED party's capacity (TARGET/BUYER/..., via the existing
  `resolvePartyCapacity`, the same vocabulary `resolveParty` itself uses)
  and compares it against `terminating_party`'s own resolved capacity,
  returning null on any mismatch, any unrecognised direction, or any
  scope mismatch (ONE_PARTY claimed against an EITHER_PARTY chapeau or vice
  versa).

Wired in as a second-try fallback: `findTerminationGrantContext(...) ||
findTerminationLimbGrantContext(...)`. The old function still runs first,
unchanged, so a deal whose drafting matches its shape (confirmed still
working: `tests/canonical-v2-m3-live-checkpoint-replay.test.js`'s own M3
fixture, `resolved: 5` unchanged) never reaches the new one.

**The diagnosis needed one more layer than the review had time for, found
only by actually replaying the real candidates through the real resolver.**
Fixing the named gate alone does not unblock these candidates end to end: two
FURTHER checks, downstream of the named gate, also test a text shape that
does not exist in Modiv's drafting --

- `TERMINATION_EITHER_PARTY_PATTERN` (`/\bby either\b|\bmutual written
  (?:consent|agreement)\b/i`) was tested only against the candidate's own
  narrow trigger quote, never the widened grant-context text, so an
  EITHER_PARTY-scoped Modiv candidate (whose own quote never repeats "by
  either") would clear the named gate and immediately fail
  `PARTY_SCOPE_UNCORROBORATED` instead.
- `terminatingPartyPositionCorroborated` requires `by PARTY` or `PARTY may
  terminate` word-adjacency (its own header: this is what stops a producer
  swapping terminator and breaching party -- a real, load-bearing protection,
  confirmed still enforced, see Hostile below). Modiv's own chapeau text
  reads "by written notice from PARTY to OTHER", which satisfies neither
  existing form.

Both were widened, not bypassed:

1. `eitherMatch` now also tests `partySupportQuote` (`TERMINATION_EITHER_
   PARTY_PATTERN.test(quote) || TERMINATION_EITHER_PARTY_PATTERN.test
   (partySupportQuote)`). Strictly additive: `partySupportQuote === quote`
   whenever no grant context was found, unchanged for every candidate this
   fix does not touch.
2. `terminatingPartyPositionCorroborated` gained a third recognised form,
   `from\s+PARTY\s+to\b`, anchored specifically on the FROM slot. This does
   not reopen the swap hole the two existing forms already close: a
   candidate claiming the TO-slot party ("the Company" for a chapeau reading
   "from Parent to the Company") does not match, because the pattern
   requires the escaped party name immediately followed by "to", not
   preceded by it -- proven directly (Hostile test, below), not just
   reasoned about.

**Regression safety, proven, not assumed.** All 8 files under `tests/
canonical-v2-termination-*` and `tests/canonical-v2-m3-live-checkpoint-
replay.test.js` pass unchanged (`node --test`, exact counts re-verified
after every edit, including the M3 checkpoint's own byte-exact `resolved: 5,
review_queue: 6, open_world: 3` and its `grant_quote` regex match). The
inverted-label regression test in `canonical-v2-termination-rights-
resolution.test.js` ("the SAME breach quote with terminating_party set to
the BREACHING party... queues TERMINATING_PARTY_REF_UNCORROBORATED, never
resolves an inverted right") and "by either Parent or the Company" labelled
ONE_PARTY queues PARTY_SCOPE_UNCORROBORATED" both still pass, proving the
two widenings did not weaken either existing protection.

**Result, measured by replay of the real committed evidence** (`evidence/
canonical-v2/modiv-termination-20260806/run-receipt.json`, loaded and run
through the real `resolveCandidates` directly, no reconstruction):

| | Before (committed resolution.json) | After (this fix) |
|---|---|---|
| resolved | 1 | 8 |
| review_queue (total, including resolved echoes) | 16 | 16 |
| open_world | 13 | 13 |
| TERMINATING_PARTY_REF_NOT_IN_QUOTE candidates | 12 | 0 |
| TERMINATING_PARTY_REF_UNCORROBORATED candidates | 2 | 0 |

Of the 12 named candidates: 6 now resolve outright (7.1(b)(i), both
7.1(b)(ii) OUTSIDE_DATE variants, 7.1(c)(ii)'s BREACH ground, 7.1(d)(i)'s
BREACH ground, 7.1(d)(ii)'s Adverse Recommendation Change ground). The other
6 (7.1(b)(iii), 7.1(c)(iii), three more 7.1(d)(ii) grounds, 7.1(d)(iii)) now
queue under `TRIGGER_KIND_UNCORROBORATED` instead -- a different,
pre-existing, unrelated gate (`terminationTriggerKindCorroborated` /
`TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE`) that is now reachable
because the party gate no longer blocks them earlier, checked precisely
against the model's own recorded `trigger_kind` per candidate, not
generalised:

| Citation | Quote (start) | trigger_kind | Why the table's pattern misses it |
|---|---|---|---|
| 7.1(b)(iii) | "the Company Requisite Vote shall not..." | VOTE_FAILURE | table wants literal `(?:stock\|share)holder approval`; Modiv says "Company Requisite Vote" throughout, never "stockholder/shareholder approval" |
| 7.1(c)(iii) | "Parent, Company Merger Sub... fails to consummate" | `null` | the model itself asserted no trigger_kind for this ground |
| 7.1(d)(ii) | "...failed to publicly reaffirm the Company Recommendation" | RECOMMENDATION_CHANGE | table wants literal "Company **Board** Recommendation"; Modiv's own text omits "Board" here |
| 7.1(d)(ii) | "...failed to publicly recommend against any tender offer..." | RECOMMENDATION_CHANGE | matches none of the table's five listed phrases at all |
| 7.1(d)(ii) | "the Company enters into an Alternative Acquisition Agreement..." | NO_SOLICITATION_BREACH | table wants literal "materially breaches its obligations under Section 4.4"; Modiv's own no-shop section is 5.6, and this ground's actual trigger text is structurally different (entering into an agreement, not breaching an obligation) |
| 7.1(d)(iii) | "the Company and the Partnership fail to consummate" | `null` | the model itself asserted no trigger_kind for this ground |

Four different, independent vocabulary/phrasing gaps and two null-
trigger_kind cases, not one shared cause -- worth recording precisely rather
than as a single generalisation, since a future fix to any one of the four
table patterns would need to know exactly which phrasing it is missing.
**This is a genuine,
separate finding, not a decision this task makes**: it is the same
defect shape (a check written against one drafting's vocabulary refusing a
legitimate variant) but a different gate, different reason code, and outside
this task's three named fixes -- reported for the family owner's triage, not
fixed here.

Also newly exposed: `7.1(d)(i)`'s CURE_PERIOD candidate ("forty-five (45)
days following notice to the Company from Parent...") now reaches
`parseCurePeriod` (`lib/canonical-v2/native-producer/cure-period-parse.js`,
a file this task does not own) and queues `SPELLED_DIGIT_MISMATCH`. Read
enough of that parser to report, not fix: `SPELLED_NUMBER_VALUES` has no
entry for the hyphenated compound "forty-five" (only single words up to
"ninety"), so the digit-vs-spelled cross-check appears to compare 45 against
whatever its own tokeniser extracts from the compound, and gets a mismatch
on a period that is written correctly. Flagged for the owner; not
investigated further, not fixed -- a different file, a different gate,
outside this task's scope.

**Hostile proof the trap did not get built into the fix.** A cloned
run_receipt with `7.1(d)(ii)`'s real Adverse-Recommendation-Change candidate
relabelled `terminating_party: "the Company"` (the wrong party for this
limb -- the real grant is to Parent) still queues, never resolves, proven by
replaying it through the real resolver
(`tests/canonical-v2-termination-limb-grant-context.test.js`, "HOSTILE").
Also proven at the pure-function level: `findTerminationLimbGrantContext`
returns null for this exact swap, and for a scope mismatch (ONE_PARTY
claimed against the (b) limb's EITHER_PARTY chapeau), and for a null
`terminating_party`.

**Proven to fail without the fix, not merely asserted.** Two independent
proofs: (1) `evidence/canonical-v2/modiv-termination-20260806/resolution.json`
was produced by the pipeline before this fix existed, and its committed
reason codes are the "before" column above by construction -- the grounding
test in the committed test file reads this file directly and asserts it
still shows the pre-fix shape. (2) Manually, during this task:
`candidate-resolution.js` was temporarily reverted to its pre-fix `git show
HEAD:...` revision (a read-only git operation; the working copy was saved
first and restored after, verified byte-identical by diff both times), and
both `node --test tests/canonical-v2-termination-limb-grant-context.test.js`
and the ad hoc replay harness were re-run against it: the replay reproduces
`resolved: 1` exactly, and 7 of the 10 committed tests in that file fail
(the two REPLAY tests on their assertions, the five unit tests on
`... is not a function`, since the exported names do not exist pre-fix).
The one committed test that still passes pre-fix (HOSTILE) is expected to:
refusing a wrong party is the safe default in both the old and new code, so
that test proves nothing about which version is running -- it is included
for its own sake, not as a before/after discriminator.

## Fixture provenance

Two new committed fixtures, both exact `utf8Slice` extractions from the same
already-committed, already-pinned raw HTML
(`tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm`,
`canonical_text_sha256` `0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e`,
re-verified in this task, not assumed):

- `tests/fixtures/canonical-v2/termination-rights-family/modiv-section-7.1.txt`
  -- bytes 321761-331500, matching `section-location-scan.json`'s own
  reported span for this section exactly (9739 bytes). Added to the existing
  `termination-rights-family` fixture directory (whose pre-existing files
  have a different, spec-derived provenance, documented in that directory's
  own `PROVENANCE.json` -- not extended here, to avoid conflating two
  different chains of custody; this file's own provenance is instead proven
  live, in-test, by `canonical-v2-termination-limb-grant-context.test.js`'s
  own "unit: SECTION_7_1_TEXT fixture is byte-identical to the real section
  span..." test, which re-derives the same slice from the raw HTML at test
  time and asserts byte equality).
- `tests/fixtures/canonical-v2/proxy-meeting-family/modiv-section-5.4.txt` --
  bytes 229977-246111 (16134 bytes), same convention, same live-verified
  provenance test in `canonical-v2-proxy-meeting-reference-fixes.test.js`.

## Verification

Committed test files: `tests/canonical-v2-termination-limb-grant-context.
test.js` (10 tests) and `tests/canonical-v2-proxy-meeting-reference-fixes.
test.js` (5 tests), both passing, both proven to fail without the fix (see
above).

Regression sweep, all passing, exact counts unchanged from before this task:
every file under `tests/canonical-v2-termination-*`, `tests/canonical-v2-
proxy-meeting*`, `tests/canonical-v2-m3-live-checkpoint-replay.test.js`, and
every one of the 62 test files in this repository that imports `candidate-
resolution.js` (609 tests, `CI=true node --test <62 files>`, `pass 595 fail
0 skipped 14`).

Full suite:

```
CI=true npm test > /tmp/resolverfix.log 2>&1; echo "EXIT=$?"
EXIT=1
```

`tests 7718, pass 7674, fail 2, skipped 42`. Both failures are
`UNCLASSIFIED_CHANGED_SOURCE: lib/negation-boundary-guard.js` in `tests/
canonical-v2-phase1-authority-boundary.test.js` -- an untracked file this
task never created or touched (confirmed: `git status --short` shows it `??`,
owned by a different, concurrently-running agent per this repo's own
multi-agent working state). Proven unrelated to this task's changes, not
just assumed: this exact same test, run against `candidate-resolution.js`
temporarily reverted to its pre-fix `git show HEAD:...` revision, fails with
the identical error and identical file name. Every other test in the suite
passes; the 42 skipped count matches the pre-existing baseline (unchanged,
no new skip introduced by this task).
