# Diagnostic: qualifier cluster (675) + proxy meeting cluster (65)

Status: COMPLETE — investigated on branch origin/cursor/step-2x-free-phase-b641
Read-only task, no code edits, no commits.

Branch head: 7535782acf525f3171117336bc5b8345fc3c3a04 "feat(canonical-v2): filter corpus review claims"

## Scope
Part 1: REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED (485), QUALIFIER_KIND_UNCLASSIFIED (102),
REPRESENTATION_QUALIFIER_KIND_NOT_EXACT (62), ACCURACY_STANDARD_OUT_OF_VOCABULARY (26)

Part 2: PROXY_MEETING_KIND_UNCORROBORATED (31), PROXY_MEETING_ASSERTION_KIND_NOT_GOVERNED (24),
AMBIGUOUS_PROXY_MEETING_KIND (10)

## Method

Fetched `origin/cursor/step-2x-free-phase-b641` (HEAD `7535782a`), extracted a
full worktree via `git archive | tar -x` into the scratchpad
(`.../scratchpad/repo-snapshot`) so grep/node could run freely without
mutating the real checkout. All file references below are paths in that
branch (readable via `git show origin/cursor/step-2x-free-phase-b641:<path>`).

For population counts I did NOT trust the corpus-review HTML alone (it has
no `qualifier_kind`/`assertion_kind` attributes in its cards — text only). I
aggregated directly from `evidence/canonical-v2/<deal>-<family>-20260809-2xk-final/resolution.json`
(`open_world` + `review_queue` arrays, which carry full `attributes`) across
all 133 "2xk-final" run directories. My totals run a bit under the owner's
stated 485/102/62/26 and 31/24/10 (see below) — likely because the owner's
counts include additional non-"2xk-final"-tagged run directories (e.g. the
`*-20260808-r1` predecessors) that I did not fold in. The *shape* of each
population (which kinds, in what proportion) is unaffected by this gap; I
flag the raw delta as uncertain rather than papering over it.

---

## PART 1 — qualifier cluster

### 1a. REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED (owner: 485; measured: 463)

**Raised**: `lib/canonical-v2/native-producer/candidate-resolution.js`,
function `handleRepresentationQualifierCarrier` (~line 9686-9856), final line:

```js
pushOpenWorld({ entry, claimRow: claim, reason: 'REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED' });
```

This is the fallthrough of a 3-way dispatch on `attrs.qualifier_kind`:
`if (qualifierKind === 'ACCURACY') {...}`, `if (qualifierKind === 'KNOWLEDGE') {...}`,
else → NOT_GOVERNED. There is no branch for any other kind.

**The prompt itself supplies the other kinds.**
`lib/canonical-v2/native-producer/representations-producer-prompt.js` line 39:
`"kind": "ACCURACY | KNOWLEDGE | THRESHOLD | TEMPORAL"`, and the instructions
(line 57) explicitly tell the model: *"Do not code a substantive use of
'material' that limits the subject matter. Put that in a THRESHOLD qualifier
with code null."* So the model is doing exactly what it is told, and the
resolver has no home for two of the four kinds it is told to emit.

**Measured breakdown of the 463** (from `attributes.qualifier_kind` on each
NOT_GOVERNED open-world row, `resolution.json` across all deals):
- `THRESHOLD`: 306 (e.g. "material Tax Returns", "...would not reasonably be
  expected to have...a Material Adverse Effect" used as a subject-matter
  scope limiter, not an accuracy tolerance)
- `TEMPORAL`: 157 (e.g. "Since December 31, 2018 (the "Applicable Date"),")
- No other kind value ever appears. 306 + 157 = 463 = 100% of the population.

**Lost or never had?** Checked `lib/taxonomy.js` `MATERIALITY_CODES` (the
governing vocabulary): it has `MAT_ALL_RESPECTS`, `MAT_ALL_RESPECTS_DE_MINIMIS`,
`MAT_ALL_MATERIAL`, `MAT_MATERIAL_TO_COMPANY`, `MAT_MATERIAL_INLINE`,
`MAT_MAE_QUALIFIED`, `MAT_MAE_AGGREGATE` (retired for V2), `MAT_DE_MINIMIS`,
`MAT_MATERIALITY_SCRAPE`, `MAT_KNOWLEDGE`, `MAT_WILLFUL_BREACH`,
`MAT_INTENTIONAL_BREACH`, `MAT_NO_QUALIFIER`. None of these is a "subject
matter materiality scope" code or a temporal-qualifier code — THRESHOLD and
TEMPORAL, as the prompt defines them, are not accuracy-tolerance concepts at
all, so they were never eligible for a MATERIALITY_CODES slot. Confirmed via
`git log -p` on `qualifier-kind-lexicon.js`: across all 4 commits touching
that file, no THRESHOLD/TEMPORAL *accuracy* code was ever defined and later
removed — the "THRESHOLD/TEMPORAL" language there refers to the deterministic
classifier's four *marker families* (used only to disambiguate the model's
unstable `kind` tag for identity purposes), never to governed representation-
qualifier claim definitions. **Verdict: these 463 were never governed — not a
regression, not something the v2/v3/v4 lexicon lost.**

**Contrast with the general (non-representation) path.** The concept-
resolution table comment at candidate-resolution.js line 679-719 documents
that for the *generic* `QUALIFIER_CLAIM_KEY` (not representation-specific),
KNOWLEDGE/THRESHOLD/TEMPORAL are *deliberately* absent and route to
open-world with reason `UNMAPPED_GENERIC_CLAIM_KEY` — and that comment calls
this "the *correct* outcome, not a defect." The representation-specific
carrier function reaches the same behavioural outcome (open-world) but with
no equivalent comment justifying it, and with a reason string
("_NOT_GOVERNED") that reads as a defect rather than a documented scope
decision. Checked `contracts/canonical-v2/successor/agreement/claim-definitions/`:
no `THRESHOLD_QUALIFIER` or `TEMPORAL_QUALIFIER` definition exists.
`GENERAL_MATERIALITY_QUALIFIER` exists but is wired only into the unrelated
QXO capitalisation bring-down (F27/F28) feature — `grep` for it in
`candidate-resolution.js`'s representation path returns nothing. It is not a
home for these 463.

**Diagnosis**: genuine gap, but not the "lexicon regression" the brief asked
me to rule in/out — ruled OUT. It is a missing product decision: whether
"material Tax Returns"-style subject-scope quals and "Since [date]"-style
temporal quals on representations should ever become governed claims. Given
306 THRESHOLD is by far the largest single kind in this entire audit, it is
the actionable one.

**Fix — resolver-side, free, replay-validatable.** No prompt text changes
(the prompt already asks for THRESHOLD/TEMPORAL exactly as observed), so
`prompt_digest` is untouched and every one of the 463 can be re-resolved from
already-recorded model responses without a new LLM call. Two options, both
resolver + contract-bundle only:
  1. Register new claim definitions (e.g. `REPRESENTATION_THRESHOLD_QUALIFIER`,
     `REPRESENTATION_TEMPORAL_QUALIFIER`) in
     `contracts/canonical-v2/successor/agreement/claim-definitions/` and add
     branches in `handleRepresentationQualifierCarrier` (candidate-resolution.js
     ~9825) mirroring the existing ACCURACY/KNOWLEDGE branches.
  2. Or, if the product decision is "no, these stay open-world by design,"
     rename the reason to something that says so (e.g.
     `REPRESENTATION_QUALIFIER_KIND_OUT_OF_SCOPE`) and add the same
     documenting comment the general table already has, so 463 rows stop
     reading as an open defect in every future audit.
Either way this is a governance/product call (which is why I have not
recommended one over the other), but the *investigation* is closed: not a
lost lexicon entry, a known and total 2-kind population, zero prompt risk to
fix.

### 1b. QUALIFIER_KIND_UNCLASSIFIED (owner: 102; measured: 99)

**Raised**: same file, inside the `qualifierKind === 'ACCURACY'` branch
(~9735-9791), when `classifyQualifierQuote(...)` (from
`qualifier-kind-lexicon.js`) returns `outcome: 'REVIEW'`. Per the block
comment at 9737-9779 (itself a correction of an earlier, false comment — the
kind of stale-header trap CLAUDE.md warns about): for ACCURACY input,
`OPEN_WORLD` is structurally unreachable from the lexicon; every case of
"doubt" (including "no marker recognised at all") upgrades to `REVIEW`, which
routes here to `review_queue`, not open-world. **Distinct mechanism from
1a** — this is not the resolver's kind-dispatch failing, it's the lexicon's
own ACCURACY-family whitelist/front-door matcher failing to recognise a real
drafting variant.

**Diagnosis, from samples** (`qualifier-kind-lexicon.js`):
  - `ACCURACY_CODE_WHITELIST` (line 251) matches only a fixed set of *exact*,
    whole-quote phrases (e.g. `'true and correct in all material respects'`).
    Sample: `"complete and accurate in all material respects"` — a real
    drafting synonym for "true and correct" that is not in the whitelist and
    never will match, by design (whole-string match, "zero matches → code
    null, never nearest-fit," per the file's own header).
  - `MAE_QUALIFIER_IDIOM_PATTERN` (line 306) and
    `MAE_TOLERANCE_FAILURE_IDIOM_PATTERN` (line 319) are front doors meant to
    catch the recurring "(except that) the failure ... would not reasonably
    be expected to have a MAE" idiom, but both are tightly anchored
    (`^...$`) to specific connective phrasings ("other than where the
    failure to...", "except for such failures to..."). Samples that miss
    both: `"except where the failure to so comply would not reasonably be
    expected to have...a Company Material Adverse Effect"` (uses "except
    where" + "the failure to so comply", not covered), and `"except for such
    pending actions, suits, claims or Proceedings that would not reasonably
    be expected to have...a Company Materia[l Adverse Effect]"` (the
    optional-word slot in `MAE_QUALIFIER_IDIOM_PATTERN` only allows one word
    after "except for", not a multi-word noun phrase like "such pending
    actions, suits, claims or Proceedings").

**Fix — resolver-side, free, replay-validatable**, but governance-gated: the
module header states whitelist/pattern edits are "identity-semantics
changes: Fable-tier, Ben-reviewed, versioned" — not a prompt change (no
prompt digest impact), but not a change to make casually either. Concretely:
add "complete and accurate in all material respects" to
`ACCURACY_CODE_WHITELIST`, and widen the MAE front-door patterns' optional-
clause groups to accept short noun phrases and the "except where"
connective, in `lib/canonical-v2/native-producer/qualifier-kind-lexicon.js`.

### 1c. REPRESENTATION_QUALIFIER_KIND_NOT_EXACT (owner: 62; measured: 61)

**Raised**: candidate-resolution.js, both inside the `ACCURACY` branch when
`classification.outcome !== 'CLASSIFIED'` (line 9795, but per 1b's analysis
this is now unreachable for pure "unrecognised" cases — REVIEW intercepts
those first) and inside the `KNOWLEDGE` branch (line 9828):

```js
if (qualifierKind === 'KNOWLEDGE') {
  const knowledge = exactRepresentationKnowledgeQualifier(claim.raw_value);
  if (!knowledge) {
    pushOpenWorld({ entry, claimRow: claim, reason: 'REPRESENTATION_QUALIFIER_KIND_NOT_EXACT' });
```

`exactRepresentationKnowledgeQualifier` (line 9590-9595):

```js
const isExact = /^(?:to\s+(?:the\s+)?(?:(?:actual|constructive)\s+)?knowledge\s+of\s+(?:the\s+)?[a-z][a-z0-9 .&'-]*|known\s+to\s+(?:the\s+)?[a-z][a-z0-9 .&'-]*|after\s+(?:due|reasonable)\s+inquiry(?:\s+of\s+(?:the\s+)?[a-z][a-z0-9 .&'-]*)?)$/i.test(text);
```

**Diagnosis**: measured samples are all `qualifier_kind: 'KNOWLEDGE'`.
Dominant miss: `"to the Company's knowledge"` (occurs twice in the sample of
4) — a *possessive* knowledge form ("X's knowledge"). The regex only accepts
`"knowledge of [the] X"`, never `"X's knowledge"`, despite the latter being
at least as common in real drafting. Also seen: `"does not have knowledge"`
and `"is aware of the existence of any fact"` — negation/paraphrase forms
that are arguably correctly rejected (they are not one of the three governed
knowledge standards) rather than a gap.

**Fix — resolver-side, free, replay-validatable.** Extend the regex in
`exactRepresentationKnowledgeQualifier` (candidate-resolution.js line 9592)
to add a possessive alternative:
`[a-z][a-z0-9 .&'-]*'s\s+(?:(?:actual|constructive)\s+)?knowledge`. No prompt
change, no digest invalidation — same recorded raw_value text, different
regex.

### 1d. ACCURACY_STANDARD_OUT_OF_VOCABULARY (owner: 26; measured: 22)

**Different family entirely — NOT a representations-qualifier issue.**
Raised in `handleClosingConditionCandidate`, candidate-resolution.js line
5172, for `kind === 'BRING_DOWN_TIER'` (closing-condition rep bring-downs,
`claim_definition_key: NATIVE_CLOSING_CONDITION_CANDIDATE`), when
`canonicalValueAllowed(claimDefinition, canonicalValue)` fails for
`REPRESENTATION_ACCURACY_STANDARD` (`allowed_canonical_values:
["MAT_ALL_RESPECTS","MAT_ALL_RESPECTS_DE_MINIMIS","MAT_ALL_MATERIAL",
"MAT_MAE_QUALIFIED"]`, `canonical_value_required_when_present: true`, per
`contracts/.../claim-definitions/representation-accuracy-standard.v1.json`).

**Two distinct sub-causes**, measured from `attributes.accuracy_standard` on
the 22:
  - **Naming mismatch (7/22)**: values `TRUE_AND_CORRECT`,
    `IN_ALL_MATERIAL_RESPECTS`, `ALL_MATERIAL_RESPECTS`,
    `ALL_RESPECTS_DE_MINIMIS`, `COMPANY_MATERIAL_ADVERSE_EFFECT` (x2),
    `TRUE_AND_CORRECT_EXCEPT_NO_PREVENT_OR_MATERIAL_DELAY` — none of these
    spellings match the governed `MAT_*` codes even though several are
    plainly the same standard (`IN_ALL_MATERIAL_RESPECTS` ≈ `MAT_ALL_MATERIAL`).
    Root cause: `lib/canonical-v2/native-producer/closing-conditions-producer-prompt.js`
    line 10 says `"accuracy_standard": "<BRING_DOWN_TIER only, controlled
    code or null>"` but **the prompt never states what the controlled codes
    are** — no `CONTROLLED_VOCABULARIES` block, unlike
    `representations-producer-prompt.js`. The model invents self-consistent
    but unregistered names.
  - **Null-required-but-disallowed (15/22)**: `accuracy_standard: null`. The
    prompt's own contract is "controlled code **or null**", but the claim
    definition sets `canonical_value_required_when_present: true`, so a
    correct, honest "no controlled code applies" answer is rejected as
    out-of-vocabulary — a resolver/schema contract that disagrees with the
    prompt it is consuming.

**Fix**: the naming-mismatch 7/22 need a **prompt change** (add a
`CONTROLLED_VOCABULARIES` block mapping to the `MAT_*` codes in
`closing-conditions-producer-prompt.js`, mirroring
`representations-producer-prompt.js`) — this invalidates `prompt_digest` and
requires re-extraction. The null-disallowed 15/22 is **resolver-side, free,
replay-validatable**: either relax
`representation-accuracy-standard.v1.json`'s
`canonical_value_required_when_present` for the closing-condition consumer,
or (preferred, since REPRESENTATION_ACCURACY_STANDARD is shared with actual
representation qualifiers where `required_when_present` is presumably
correct) give `BRING_DOWN_TIER`'s null case its own reason/disposition in
`handleClosingConditionCandidate` instead of reusing the representation
qualifier's claim definition and hitting its stricter contract.

### Part 1 verdict

**Not one mechanism, not four independent ones — three, cleanly separated by
where the check lives:**
1. Resolver kind-dispatch gap for representation qualifiers (1a, 463/485 —
   the dominant one, THRESHOLD 306 + TEMPORAL 157, 100% accounted for).
2. Lexicon whitelist/front-door pattern gaps inside the ACCURACY path (1b +
   part of 1c, ~160 combined — drafting-variant misses, not missing
   governance).
3. A wholly different family (closing-conditions bring-down, 1d) sharing the
   same claim definition as representations but reached through its own
   prompt, which has its own, unrelated bug (no controlled-vocabulary block
   at all) plus a schema/prompt contract mismatch on null.
All of 1a-1c is resolver-side and replay-validatable at zero cost. 1d splits:
~7/22 needs a prompt change (digest invalidation), ~15/22 is resolver-side.

---

## PART 2 — proxy meeting cluster

### 2a. The three tallied reason codes

All raised in `lib/canonical-v2/native-producer/candidate-resolution.js`,
function `handleProxyMeetingCandidate` (~5449-5730).

- **PROXY_MEETING_ASSERTION_KIND_NOT_GOVERNED** (owner 24; measured 19) —
  line 5461-5464:
  ```js
  const mapping = PROXY_MEETING_ASSERTION_MAP[assertionKind];
  if (!mapping) { pushOpenWorld({ ..., reason: 'PROXY_MEETING_ASSERTION_KIND_NOT_GOVERNED' }); return; }
  ```
  `PROXY_MEETING_ASSERTION_MAP` (line 3329) has 11 entries. The prompt
  (`proxy-meeting-producer-prompt.js` line 8) tells the model to use 14
  kinds, including `MAILING_DEADLINE`, `ADJOURNMENT_CONTROL`, and
  `ADJOURNMENT_CONSENT_OVERRIDE` — **three enum-legal kinds the model is
  explicitly prompted to emit that have no entry in the concept map at
  all.** Measured breakdown of the 19, by `attributes.assertion_kind`:
  `ADJOURNMENT_CONTROL` 8, `MAILING_DEADLINE` 7, `ADJOURNMENT_CONSENT_OVERRIDE`
  4 — **8+7+4 = 19, i.e. 100% of the population**, and no other kind ever
  appears. This is a straightforward missing-registration bug, not a
  corroboration/regex issue.

  **This is the same defect underlying the owner's #255/#252 cards** — see
  2c below. `ADJOURNMENT_CONTROL` is exactly the assertion kind that carries
  the party grant ("(ii) may adjourn or postpone the Company Stockholders
  Meeting", `control_party: "the Company"`, confirmed from the recorded
  model response for concho §6.6). Because it has no map entry, it is
  discarded to open-world instead of being indexed, so it can never be used
  to backfill a sibling claim that needs that same party.

  **Fix — resolver-side, free, replay-validatable.** Add the three missing
  entries to `PROXY_MEETING_ASSERTION_MAP` (candidate-resolution.js line
  3329) with real claim definitions/concept keys, plus corroboration entries
  in `PROXY_MEETING_KIND_CORROBORATION` (line 3343) so they don't just move
  from NOT_GOVERNED to UNCORROBORATED. No prompt change — the prompt already
  asks for these three kinds.

- **PROXY_MEETING_KIND_UNCORROBORATED** (owner 31; measured 23) — line
  5467-5471: `assertionKind` is enum-legal and mapped, but
  `proxyMeetingCorroboratedKinds(quote)` (line 3381, tests the quote against
  `PROXY_MEETING_KIND_CORROBORATION`, line 3343) doesn't include it.

  Card **#251** (concho §6.6, `assertion_kind: "ADJOURNMENT_REASON"`,
  `reason_kind: "SUPPLEMENTAL_DISCLOSURE"`, `control_party: "the Company"` —
  confirmed from the recorded response): the *outer* gate
  `PROXY_MEETING_KIND_CORROBORATION.ADJOURNMENT_REASON` (line 3352) requires
  the tight phrase `supplement\w*\s+(?:the\s+)?proxy` (supplement directly
  adjacent to "proxy", only "the " allowed between). The quote is `"...any
  legally required supplement or amendment to the Joint Proxy Statement..."`
  — "or amendment to the Joint" sits between "supplement" and "Proxy", so
  the outer gate fails. But the *inner*, reason-kind-specific check,
  `ADJOURNMENT_REASON_PATTERNS.SUPPLEMENTAL_DISCLOSURE` (line 3360), allows
  a 60-character gap and *would* match this exact text. **Two checks for the
  same concept, with mismatched tolerance — the stricter one runs first and
  blocks a case the more accurate one would pass.** This is not the
  "upstream actor" pattern; it is a redundant-gate strictness mismatch.

  **Fix — resolver-side, free, replay-validatable.** Either widen
  `PROXY_MEETING_KIND_CORROBORATION.ADJOURNMENT_REASON`'s window to match
  `ADJOURNMENT_REASON_PATTERNS`' tolerance, or drop the outer
  ADJOURNMENT_REASON check entirely and let the inner, per-reason-kind
  pattern (already run downstream) be the sole gate — it is strictly the
  more accurate one of the pair.

- **AMBIGUOUS_PROXY_MEETING_KIND** (owner 10; measured 5) — line 5473-5475:
  two or more `PROXY_MEETING_KIND_CORROBORATION` patterns fire on the same
  quote and the pair isn't in the small `PROXY_MEETING_COMPATIBLE_KIND_PAIRS`
  whitelist (currently just `[MEETING_DEADLINE, CONVENE_OBLIGATION]`).
  Sample: `"Immediately following the execution of this Agreement, Parent,
  as sole stockholder of Merger Sub, shall adopt this Agreement."` —
  plausibly fires both `PARENT_APPROVAL` and `MERGER_SUB_APPROVAL` at once
  (both patterns key on "Parent"/"Merger Sub" + approval verbs in the same
  sentence). **Uncertain** whether this is a real ambiguity needing a
  priority rule or a legitimate second compatible pair to whitelist — did
  not trace the exact corroboration hits for all 5 samples; would need the
  full quote-vs-pattern replay to settle which pattern(s) actually fired for
  each. Flagging as the one sub-finding in this whole diagnosis I could not
  fully close.

### 2b. Card #252 — ANCHOR_KIND_UNCORROBORATED, emitted twice

**Raised**: candidate-resolution.js line 5687-5703, for
`assertionKind === 'MEETING_DEADLINE'`, `anchorKind === 'SEC_CLEARANCE'`:
```js
: /\bSEC\b[\s\S]{0,100}\b(?:no\s+further\s+comments?|clearance|cleared)\b/i.test(quote)
```
requires the literal token `SEC` to appear **before** "clearance"/"cleared"
within 100 chars. The concho §6.6 quote is `"...following the clearance of
the Joint Proxy Statement by the SEC and the Registration Statement is
declared effective by the SEC..."` — "clearance" precedes "SEC" (passive
voice: "the clearance ... by the SEC"), so the SEC-then-clearance-ordered
regex never matches. **Confirmed as a directional regex bug**, not a missing
concept — the SEC_CLEARANCE anchor concept is right, the word-order
assumption baked into the pattern is wrong.

**Why emitted twice**: confirmed from `native-producer-recorded-response-6.6.json`
— the raw model response contains this exact quote **twice**, once with
`obligated_party: "the Company"` / `meeting_ref: "the Company Stockholders
Meeting"`, and once with `obligated_party: "Parent"` / `meeting_ref: "the
Parent Stockholders Meeting"` (two distinct `claim_occurrence_id`s in
resolution.json's review_queue). §6.6 genuinely governs **both** the Company's
and Parent's stockholder meetings under the same shared timing language
("following the clearance...and the Registration Statement is declared
effective"), each requiring its own claim. **Not a duplication bug — two
genuine claims that happen to share identical governing text**, one per
party/meeting.

**Fix — resolver-side, free, replay-validatable.** Fix the regex to accept
either order:
`/(?:\bSEC\b[\s\S]{0,100}\b(?:no\s+further\s+comments?|clearance|cleared)\b|\b(?:clearance|cleared)\b[\s\S]{0,100}\bby\s+the\s+SEC\b)/i`
in candidate-resolution.js ~line 5698. No prompt change.

### 2c. Card #255 — CONTROL_PARTY_REF_ABSENT, and the upstream-actor hypothesis

**Raised**: candidate-resolution.js line 5530-5544, for
`ADJOURNMENT_COUNT_CAP`/`ADJOURNMENT_DURATION_CAP`:
```js
const controlParty = typeof attrs.control_party === 'string' && attrs.control_party.length > 0 ? attrs.control_party : null;
if (!controlParty) {
  pushProxyMeetingReview({ entry, claim, reason: 'CONTROL_PARTY_REF_ABSENT', ... });
```

**Hypothesis confirmed against the concho source** (`concho-raw-fetched.htm`,
§6.6): the full sentence is one long run-on: *"...the Company (i) shall be
required to adjourn or postpone the...Meeting (A)...or (B)...and (ii)
**may adjourn or postpone the Company Stockholders Meeting** if...; provided,
however, that unless otherwise agreed to by the Parties, **the Company
Stockholders Meeting shall not be adjourned or postponed to a date that is
more than ten (10) Business Days**..."*. The party+verb grant ("the Company
... (ii) may adjourn or postpone") sits in an early limb of the sentence; the
duration-cap constraint is a later, separate limb whose own grammatical
subject is "the Company Stockholders Meeting" (passive voice) — no party
token at all within that limb. Confirmed from the raw model response: the
model correctly emitted the grant clause as its own candidate
(`assertion_kind: "ADJOURNMENT_CONTROL"`, `control_party: "the Company"`) and
the duration-cap clause as a separate candidate
(`assertion_kind: "ADJOURNMENT_DURATION_CAP"`, `control_party: null`, `quote`
narrowed to just the constraint). **Exactly the owner's read: "a reason why
you're allowed to adjourn the meeting was not being picked up" /  "this
person can do X, but can't do it for more than this period" — the grant and
the limit are reported as two separate, correctly-scoped facts, and the
resolver has no mechanism to let the limit inherit the party from the grant
it structurally depends on.**

**Same shape as 2a's `ADJOURNMENT_CONTROL` finding, and they compound**: not
only is `ADJOURNMENT_CONTROL` unmapped in `PROXY_MEETING_ASSERTION_MAP` (so
the grant clause with its `control_party: "the Company"` is discarded to
open-world before it could ever be indexed), the sibling `ADJOURNMENT_
DURATION_CAP`/`ADJOURNMENT_COUNT_CAP` handling has no lookup path to a
sibling claim in the same section/`meeting_ref` even if `ADJOURNMENT_CONTROL`
were registered. **One mechanism, two missing pieces, both needed for a real
fix**: (1) register `ADJOURNMENT_CONTROL` so the grant clause resolves
instead of being thrown away, and (2) when a duration/count-cap claim has
`control_party: null`, look up the resolved `ADJOURNMENT_CONTROL` claim for
the same `(section_reference, meeting_ref)` and inherit its party instead of
queuing for review.

This is the general "party grant lives upstream of the limb that needs it"
defect CLAUDE.md's task brief names as already-established for termination
rights (chapeau grants the party, the trigger limb carries only grounds).
**Confirmed as the same shape here.** A single resolver mechanism — "when a
limb-level claim is missing its own party attribute, backfill from a sibling
claim in the same section that already resolved one" — would fix both the
termination-fee case and this proxy-meeting case; I did not verify the
termination-fee code path directly (out of scope for this brief) but the
pattern match is exact enough to flag as the same class of fix.

**Fix — resolver-side, free, replay-validatable**, in two parts, both in
`candidate-resolution.js`:
  1. Register `ADJOURNMENT_CONTROL` in `PROXY_MEETING_ASSERTION_MAP` /
     `PROXY_MEETING_KIND_CORROBORATION` (see 2a).
  2. In the `ADJOURNMENT_COUNT_CAP`/`ADJOURNMENT_DURATION_CAP` branch
     (~5530), before failing on `!controlParty`, look up an already-resolved
     `ADJOURNMENT_CONTROL` claim sharing `section_reference` + `meeting_ref`
     and use its party as a fallback.
Both steps use data already present in the recorded model responses — no
prompt change, no digest invalidation.

### Part 2 verdict

Five distinct mechanisms behind six reason codes (three tallied + three from
the owner's cards), not one:
1. Missing map registration (`PROXY_MEETING_ASSERTION_MAP`) for
   `ADJOURNMENT_CONTROL`/`MAILING_DEADLINE`/`ADJOURNMENT_CONSENT_OVERRIDE` —
   100% of NOT_GOVERNED (19/19).
2. Redundant, mismatched-strictness corroboration gates for
   `ADJOURNMENT_REASON` — confirmed root cause of #251/PROXY_MEETING_KIND_
   UNCORROBORATED.
3. Directional (word-order) regex bug in the SEC_CLEARANCE anchor check —
   confirmed root cause of #252/ANCHOR_KIND_UNCORROBORATED (the "emitted
   twice" is not a bug — two genuine per-party claims).
4. Missing party-inheritance across sibling proxy-meeting claims in the same
   section — confirmed root cause of #255/CONTROL_PARTY_REF_ABSENT, and
   mechanically entangled with #1 (`ADJOURNMENT_CONTROL`'s discarded data is
   exactly what #255 needs).
5. AMBIGUOUS_PROXY_MEETING_KIND — uncertain, not fully traced (5 cases).

All of 1-4 are resolver-side, free, replay-validatable — no prompt change,
because the model already emits everything needed (assertion kinds, party
refs, quotes) in its recorded responses; the gaps are entirely in
`candidate-resolution.js`'s dispatch tables and regexes.

---

## Byte-offset check

None of the mechanisms found here involve byte-offset/string-index
arithmetic (`utf8Slice` appears once, at line 5515, for an unrelated section-
text lookup already using the correct helper). Not applicable to this
diagnosis.

