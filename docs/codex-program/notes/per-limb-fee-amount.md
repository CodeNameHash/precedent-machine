# Per-limb fee amount -- design note

Status: implemented outside `candidate-resolution.js`; resolver patch
specified below, unapplied (file locked this session). Targeted and
full-suite tests green -- see section 13.

Target files: `lib/canonical-v2/native-producer/termination-fee-producer-
prompt.js`, `lib/canonical-v2/native-producer/anthropic-provider.js`,
`lib/canonical-v2/native-producer/termination-fee-parse.js`, tests. The
resolver (`lib/canonical-v2/native-producer/candidate-resolution.js`) is
locked by another agent this session -- its change is specified below as an
unapplied fenced diff, not applied.

## 1. The gap, confirmed independently

`termination-fee-producer-prompt.js` PROMPT_VERSION 2 requires every limb of
a conditional, single-payer fee (Modiv's "Company Base Amount": $10,000,000
under grounds (i)-(iii), $15,000,000.00 under grounds (iv)-(v)) to quote its
**entire** defining sentence, identically. Traced the consequence through the
real, unmodified code:

- `anthropic-provider.js`'s `shapeFeeAmountAssertion` sets
  `raw_value: assertion.quote` (the whole sentence) on the claim.
- `candidate-resolution.js`'s `handleFeeAmountCandidate` (~line 5670) calls
  `parseFeeAmount(claim.raw_value)`.
- `termination-fee-parse.js`'s `parseFeeAmount` (line 133): "Two or more
  surviving money literals -> ABSTAIN MULTIPLE_MONEY_LITERALS (never picked
  between -- the Dyax two-sided defined term: TWO claims; the producer
  prompt is responsible for splitting, the parser never picks)."

Both Modiv limbs, sharing the identical whole-sentence quote, now carry two
money literals each -> both ABSTAIN `MULTIPLE_MONEY_LITERALS` -> both land in
`review_queue`, neither in `resolved`. This is already pinned by a real test:
`tests/canonical-v2-termination-fee-producer-prompt.test.js`, test `'shape
(b) as instructed: both Modiv limbs sharing the identical full sentence both
fail closed, MULTIPLE_MONEY_LITERALS, no resolved amount, no silent
collision'` -- `resolved.length === 0`, both queue with
`reasons: ['MULTIPLE_MONEY_LITERALS']`. Confirmed by reading the test, not
just the brief's description of it.

The real, pre-fix recorded model response
(`evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/
native-producer-recorded-response-8.12.json`) shows the historical bug this
was fixed to prevent: the (x) limb's narrow fragment quote
(`"Company Base Amount" means (x) if payable pursuant to Section 7.3(b)(i),
Section 7.3(b)(ii) or Section 7.3(b)(iii), $10,000,000`) resolved ALONE to a
flat `10000000`, silently misrepresenting a conditional fee as unconditional.
PROMPT_VERSION 2 is a strict correctness improvement over that. It just
produces no usable structured data for either limb.

## 2. Investigation 1 -- `condition_groups`: dead end, not a foundation

`lib/canonical-v2/validate-write-set.js`'s `validateConditionGroupRows`
(~line 951) and the `condition_groups` write-set key are **not** a general
"N related sub-facts with a mapping" mechanism. Evidence:

- `semantic.condition_group_contracts` is a **frozen, fixed-length array**
  (`contract-bundle.js` line 2507, `CAPITALISATION_REPRESENTATION_SCHEMA_V1.
  condition_group_contracts`) with exactly **two** entries (`source_clause_
  code: 'B'` / `'C'`). `validateConditionGroupRows` throws
  `'condition_groups must contain every frozen capitalisation condition
  group exactly once'` if `rows.length !== semantic.condition_group_
  contracts.length` (line 963-967). There is no notion of "add a group for
  this deal" -- the set is closed at authoring time in `contract-bundle.js`,
  one row per index position, matched positionally
  (`contract.required_limb_ordinals`, line 1013-1014).
- The schema is wired end-to-end to ONE reviewed pilot, not a family: content-id
  domains are literally named `CAPITALISATION_CONDITION_GROUP_OCCURRENCE/V1`
  / `CAPITALISATION_CONDITION_GROUP_REVISION/V1` (lines 1047, 1055);
  `row.review_version` must equal the hardcoded literal
  `'QXO_CAPITALISATION_BRING_DOWN_F27/V1'` (line 1016); the parent provision
  must carry `concept_key === semantic.condition_concept_key`, a single
  fixed concept (`'COND-B-REP'`, contract-bundle.js line 2500); `party` must
  equal `semantic.party_contract.result_party`, a single fixed party.
- `CAPITALISATION_REPRESENTATION_SCHEMA_V1.party_contract` hardcodes actual
  deal-specific party labels (`TITANIUM_MERGER_SUB`, `FORWARD_MERGER_SUB`,
  contract-bundle.js lines 2538-2545) -- this is a closed, one-deal-shaped
  reviewed pilot object (F27's capitalisation bring-down review), not a
  reusable schema.

None of this fits the fee family's shape even loosely: two sides (SELLER/
BUYER) whose concept (`TERMF-TARGET`/`TERMF-REVERSE`) is decided at resolve
time from corroborated `fee_side`, not fixed at authoring time; a
variable-cardinality branch set per deal (Modiv has 3 SELLER branches + 1
BUYER branch; a different agreement's conditional fee would have a
different count); no existing "termination fee" semantic schema in
`contract-bundle.js` to hang a parallel `condition_group_contracts` off at
all. Generalising `condition_groups` would mean writing a **new**,
parallel validator function and a **new** frozen per-deal contract object,
not extending the existing one -- i.e., not reuse. **Conclusion: dead end,
not a foundation.** Building the fee-family fix as its own field on the
existing `fee_amount_assertions` shape (see section 4) is the smaller,
safer change.

## 3. Investigation 2 -- the Modiv pilot sidecar: what it encodes, what it doesn't

`lib/canonical-v2/native-producer/conditional-termination-fee-value.js`
(`buildConditionalTerminationFeeValue`) and `modiv-termination-fee-source-
parser.js` (`parseModivConditionalFees` / `resolveModivConditionalFees`),
wired into `candidate-resolution.js` at the very end of `resolveCandidates`
(~line 8408, comment: "This is a pilot-only sidecar. It does not turn a
conditional amount into the registered scalar TERMINATION_FEE_AMOUNT
claim.").

What it actually does, read closely:

- Gated on at least one **already-compiled** `FEE_TRIGGER_CLAIM_KEY`
  candidate existing at all (not on fee-amount candidates).
- Uses those trigger candidates only as a **consistency check**: confirms
  all six expected branches (`7.3(b)(i)`-`(v)`, `7.3(c)`) were seen with the
  correct corroborated `fee_side`, via a hardcoded `EXPECTED_BRANCH_SIDES`
  map. It never reads their content beyond that.
- Then **completely ignores the model's `fee_amount_assertions` output** and
  re-derives all six branch-to-amount rows by regexing the **raw admitted
  source text** directly, against patterns hardcoding the literal Modiv
  defined-term sentences byte-for-byte (`parseModivConditionalFees`,
  `modiv-termination-fee-source-parser.js` lines 20-23) -- including
  hardcoded section citations to the REIT-cap formula (`8.12(m)`, `8.12(f)`,
  `8.12(vv)`, `8.12(gg)`) that exist nowhere in any general schema.
- Output (`conditional_termination_fee_values`) is a wholly separate array,
  attached to the resolution result only when non-empty, that never touches
  `resolved` / `review_queue` for `TERMINATION_FEE_AMOUNT`. It runs
  regardless of whether the ordinary `FEE_AMOUNT_CLAIM_KEY` claims resolve
  or not -- today, they never do, and the sidecar doesn't care.

**What it's mining that the general design must handle**, i.e. the real
domain understanding baked into its hardcoded form: a conditional fee is
(a) a base amount, (b) capped by a `LOWER_OF` formula against a named cap
term (`REIT Requirements`), (c) with the base amount itself keyed on which
of several **cross-referenced sections** fired, (d) with the cap formula's
own defining sentence living in a **different** section than the base-amount
definition, cited separately (`source_citations`). None of that -- the cap
formula, the operator, the cross-reference-to-branch mapping -- has any
representation in the general `TERMINATION_FEE_AMOUNT` claim shape, today or
after this change.

**Disposition: sits alongside, not replaced, not subsumed.** The sidecar's
amount-extraction regex becomes *partially* redundant once per-limb
`TERMINATION_FEE_AMOUNT` claims resolve correctly (this change's actual
job -- see section 4) -- both would independently produce the same two
numbers for Modiv. But the sidecar does strictly more (REIT-cap lineage,
`LOWER_OF` operator, formula citations) that no per-limb amount field
captures or should try to capture; collapsing them would either lose that
enrichment or smuggle deal-specific regex logic into a claim shape meant to
generalise. The general field's job was always meant to be exactly what the
sidecar's own comment calls "the ordinary resolver path" ("Most agreements
will not carry the exact Modiv definitions. They remain on the ordinary
resolver path.") -- this change strengthens that path so it also covers the
Modiv (and Modiv-shaped) case, without requiring the Modiv-specific regex
sidecar to do it. No change to the sidecar is proposed or needed.

## 4. Chosen field shape

A new, **optional** field on each `fee_amount_assertions[]` entry:
`limb_amount_quote` -- a verbatim sub-quote, copied character-for-character
from within that same entry's own `quote` field, naming only this limb's own
dollar figure (ordinarily just the figure itself, e.g. `"$10,000,000"`).

Threaded through:

- **Prompt** (`termination-fee-producer-prompt.js`, PROMPT_VERSION 2 -> 3):
  new field in `RESPONSE_SHAPE.fee_amount_assertions[]`; new `LIMB_AMOUNT_
  QUOTE` instruction paragraph; the existing "no such field exists" sentence
  revised (see section 6).
- **Shaping** (`anthropic-provider.js`, `shapeFeeAmountAssertion`): the
  sub-quote is independently byte-verified as **nested inside a located span
  of the limb's own `quote`** in `sourceBytes` -- see section 5. Verified,
  it becomes `attributes.limb_amount_quote`; unverifiable, it is dropped as
  an attribute only (`FEE_AMOUNT_LIMB_QUOTE_UNVERIFIED` residual) and the
  whole candidate proceeds exactly as it does today.
- **Parsing** (`termination-fee-parse.js`, new function `resolveFeeAmount`):
  pure, deterministic, no resolver dependency -- tries `parseFeeAmount(quote)`
  first, unchanged; consults `limb_amount_quote` only when that specific
  call abstains `MULTIPLE_MONEY_LITERALS`.
- **Resolution** (`candidate-resolution.js`, `handleFeeAmountCandidate`,
  UNAPPLIED -- section 11): one-line swap of
  `parseFeeAmount(claim.raw_value)` for
  `resolveFeeAmount(claim.raw_value, attrs.limb_amount_quote)`.

## 5. Byte-verification of the sub-quote

Requirement: the sub-quote must be independently provable against source
bytes, exactly as the main quote is -- not merely a JS-string substring
check against an already-trusted string.

Found the existing precedent for exactly this shape: P1's
`share_count_assertions` (`anthropic-provider.js`, `shapeShareCountAssertion`
+ `evidenceForDerivedShareCount`, lines 627-640). A numeric share-count
figure can be nested inside a specific capitalisation limb's own quote
(`governing_limb_quote`); the verifier relocates BOTH strings independently
in `sourceBytes` via `locateAllQuoteBytes`, then requires the inner span to
fall inside an outer span, and requires that nesting relationship to be
**unique** (`spans.size !== 1 -> null`, ambiguous nesting fails closed
rather than guessing).

This design reuses that exact algorithm for the fee family via a new,
fee-family-scoped twin function, `evidenceForNestedSubQuote({ sourceBytes,
outerQuote, innerQuote })` -- not a call into `evidenceForDerivedShareCount`
itself. Per-family hand-carried duplication of small mechanical helpers
(rather than a cross-family import) is this file's own repeated,
explicit convention (see e.g. `SHARE_COUNT_KINDS`/`FEE_TRIGGER_CODES`,
each "duplicated here as a literal... matching this file's own precedent of
a hand-carried list" rather than reaching into a sibling family): the
algorithm is identical, the two call sites should not become coupled.

Concretely: `outerQuote` = the limb's own already-verified `quote` (the
whole defining sentence); `innerQuote` = the asserted `limb_amount_quote`.
`quote` was already confirmed present in `sourceBytes` earlier in the same
function (`evidenceFromQuote(sourceBytes, assertion.quote)`, the existing
first line of `shapeFeeAmountAssertion`) -- but `evidenceForNestedSubQuote`
does not rely on that prior result; it independently relocates `outerQuote`
in `sourceBytes` itself, so the sub-quote's proof chain is self-contained,
not dependent on shared mutable state.

Failure mode: if `limb_amount_quote` is present but does not verify (not a
substring anywhere, or nests ambiguously), the **attribute** is dropped, not
the candidate. The whole-sentence claim keeps flowing to the resolver with
its own independently-verified evidence exactly as it does today, and
without a usable `limb_amount_quote` it still abstains `MULTIPLE_MONEY_
LITERALS` -- identical to current behaviour. A broken new field can only
fail to help; it can never make an outcome worse than today's.

Quote verification is currently at zero flags (`evidence_residuals` with a
`*_QUOTE_UNVERIFIED`-family reason, across every pinned fixture replay).
This change adds a new, symmetric drop reason
(`FEE_AMOUNT_LIMB_QUOTE_UNVERIFIED`) that behaves exactly like every
existing `*_QUOTE_UNVERIFIED` reason -- typed, counted, never silently
absorbed -- so it does not change what "zero flags" means, only adds one
more typed way to earn a flag if a future live run's `limb_amount_quote`
doesn't verify.

## 6. Hash / replay stability (strict-additivity)

`mintSubjectId`'s hashed fields and the claim's `attributes` bag both feed
content-addressed identity (`subject_occurrence_id`, and via
`CLAIM_REVISION_PAYLOAD_FIELDS`, `claim_revision_id`). Any new key present
unconditionally -- even valued `null` -- changes those hashes for every
existing recorded fixture, breaking byte-identical replay. This file already
states the fix for exactly this situation twice (`SHARE_COUNT_ASSERTIONS_
KEY`'s comment; the `v1v2_comparison_receipt_id`/`lexical_disagreement_
counts` comments in `resolveCandidates`'s own receipt body: "Strictly
additive: OMITTED entirely (not present-as-null)... so hashes stay
byte-identical to pre-slice code"). This design follows the same rule:
`limb_amount_quote` is included in `mintSubjectId`'s fields and in
`attributes` **only when a verified value exists** (conditional spread, not
`?? null`); `allowed_attributes` gains the key unconditionally (confirmed
safe -- `allowed_attributes` is a validation-time-only input, never part of
`CLAIM_PROPOSAL_FIELDS`'s hashed subset in `claims-relationships.js`'s
`buildClaimRevision`, so listing an attribute that's never actually present
has no identity consequence).

Checked empirically, not just architecturally: grepped every termination-fee
test file for exact hash-literal assertions on `subject_occurrence_id` /
`claim_revision_id` for fee-amount claims -- none exist. The three
Modiv-fixture consumers (`derived-fields.test.js`, `review-parity-harness.
test.js`, `parse-money.test.js`) read the **stored, static**
`dfaa71fa-modiv.resolution.json` fixture directly; none re-invoke
`resolveCandidates`/`shapeFeeAmountAssertion` against it, so this change
cannot perturb them regardless.

## 7. The cross-reference-to-limb mapping -- NOT solved, scoped separately

This design does not solve, and does not attempt to solve, "which
cross-referenced sections gate this specific limb's amount." After this
change, Modiv's (x) and (y) limbs will each resolve to their own correct
`TERMINATION_FEE_AMOUNT` scalar claim (10000000 and 15000000.00), each with
its own evidence -- but nothing in the claim shape says "$10,000,000 applies
when Section 7.3(b)(i), (ii) or (iii) fires; $15,000,000.00 applies when
7.3(b)(iv) or (v) fires." The two claims are siblings under the same
`fee_side`/`fee_term_ref`/concept (`TERMF-TARGET`), distinguished only by
`ordinal` and their own evidence/`limb_amount_quote` -- there is no
structural link from either one to the trigger sections that gate it. The
existing `fee_trigger_assertions` shape has no field naming which amount
limb it corresponds to, either, so there is nothing to join against even if
a fee-amount limb had an ordinal to offer.

The Modiv pilot sidecar (section 3) is the only thing in this codebase that
captures that mapping today, and it does so by hardcoding both sides of the
join (the branch set and the amounts) to one specific agreement's literal
text. Generalising the mapping would need, at minimum, a new per-limb field
naming which cross-referenced sections gate it (itself quotable verbatim
from the same sentence, e.g. Modiv's (x) limb -> `"Section 7.3(b)(i),
Section 7.3(b)(ii) or Section 7.3(b)(iii)"`) and a resolver-side join against
`fee_trigger_assertions`' own section references -- a second, independent
field/verification/resolver slice at least as large as this one, and it
was not attempted here. Flagging it plainly rather than leaving it implicit:
after this change, a human reviewer looking at two resolved
`TERMINATION_FEE_AMOUNT` claims for Modiv still has to read the underlying
quotes to know which ground triggers which figure -- the claims data alone
doesn't say.

## 8. Residual risk this does not close

The nested-quote verification (section 5) proves `limb_amount_quote` is
genuine source text, located uniquely inside the limb's own quote. It does
NOT prove the sub-quote is the **semantically correct** figure for that
specific limb -- a model could byte-verifiably assert the (x) limb's
`limb_amount_quote` as the $15,000,000.00 figure that actually belongs to
(y) (a real, provable substring, just the wrong one). Every corroboration
table in this file already carries this same class of limitation ("does the
text match the claimed label, never was the candidate classified
correctly" -- the file's own words, in the `fee_side`-corroboration
comments).

**Correction, 2026-08-05, from adversarial review.** An earlier version of
this section claimed two mitigations, the first being "nothing here publishes
without human review". That is false and has been removed rather than
softened. A resolved claim IS published: it becomes a live extracted fact and
reaches the product. Only the review queue waits for a human. The commit that
landed the trigger-override fix says so in its own message, describing claims
that published as fact. The only trace a disambiguated amount leaves is the
`limb_amount_disambiguated: true` attribute on the claim, which is an audit
breadcrumb, not a gate.

The real bound on this risk is narrower and worth stating precisely, because
it is genuine rather than reassuring. Until the grounds-to-amount mapping in
section 7 exists, the published claim SET is swap-invariant: both limbs quote
the same sentence, so swapping which figure attaches to which limb produces an
identical set of claims. Corrupting the data therefore requires the model to
return the same figure twice, or a defining sentence containing a dollar
figure that is not a fee. Modiv's sentence contains exactly two figures and
both are fees.

The second mitigation stands: a stronger check, for example requiring each
limb's own leading marker, "(x)" or "(y)", to textually precede its own
`limb_amount_quote` within the shared sentence, is a natural next hardening
step, closely related to the cross-reference-mapping gap in section 7, and is
not attempted here.

The limitation is proven, not just asserted: `tests/canonical-v2-termination-
fee-parse.test.js`'s "a byte-real but WRONG-limb sub-quote... still
resolves" test demonstrates the limitation directly against the real
`resolveFeeAmount`.

## 9. Implementation -- what was actually changed

All changes below are additive; no existing exported name, response array,
or default behaviour was removed or repurposed.

- **`lib/canonical-v2/native-producer/termination-fee-parse.js`** -- new
  pure function `resolveFeeAmount(quote, limbAmountQuote)`, exported
  alongside `parseFeeAmount`/`parseTailPeriodMonths`. `parseFeeAmount` and
  `parseTailPeriodMonths` themselves are byte-for-byte unchanged. All of the
  fallback POLICY (try whole quote; consult the sub-quote only on
  `MULTIPLE_MONEY_LITERALS`; require it to be a substring of `quote`;
  require it to itself resolve to exactly one literal) lives here, in a
  file with no resolver dependency, so it is directly unit-testable without
  the rest of the pipeline -- see `tests/canonical-v2-termination-fee-parse.
  test.js`, "resolveFeeAmount" section (9 new tests, including the Dyax
  no-op case, both real Modiv limbs, a hallucinated hint, a still-ambiguous
  hint, a non-`MULTIPLE_MONEY_LITERALS` abstain never retried, and the
  documented wrong-limb-swap residual risk from section 8). This is also
  what keeps the eventual resolver change to one line (section 11) --
  `handleFeeAmountCandidate` only needs to call `resolveFeeAmount` in place
  of `parseFeeAmount`, never re-implement the fallback logic itself.
- **`lib/canonical-v2/native-producer/anthropic-provider.js`** --
  - New helper `evidenceForNestedSubQuote({ sourceBytes, outerQuote,
    innerQuote })`, placed immediately after `evidenceForDerivedShareCount`
    (whose nested-uniqueness algorithm it mirrors -- see section 5).
  - `shapeFeeAmountAssertion` extended to read `assertion.limb_amount_quote`,
    verify it via the new helper, and -- only when verified -- add it to
    `mintSubjectId`'s hashed fields and `attributes`; always add it to
    `allowed_attributes`. An unverifiable-but-present value is recorded as
    an `evidence_residuals` entry, reason `FEE_AMOUNT_LIMB_QUOTE_UNVERIFIED`,
    and dropped as an attribute only -- the candidate itself is never
    dropped by this path (see section 5's failure-mode note).
  - `shapeTerminationFeeProposals` (the family's own proposal-shaping
    entry point) is unchanged -- it already calls `shapeFeeAmountAssertion`
    per entry; no wiring change was needed there.
- **`lib/canonical-v2/native-producer/termination-fee-producer-prompt.js`**
  -- `PROMPT_VERSION` 2 -> 3, with a new file-header paragraph recording
  why (following this file's own established per-version convention).
  `RESPONSE_SHAPE.fee_amount_assertions[]` gained the `limb_amount_quote`
  field. `INSTRUCTIONS` gained a new `LIMB_AMOUNT_QUOTE` paragraph, and the
  pre-existing "no such field exists" sentence was revised to name the new
  field while preserving its still-true "do not repurpose section_reference/
  payer_party/fee_term_ref" instruction verbatim (the existing test
  asserting that exact substring still passes unmodified).
- **Tests** --
  - `tests/canonical-v2-termination-fee-parse.test.js`: 9 new
    `resolveFeeAmount` unit tests (listed above).
  - `tests/canonical-v2-termination-fee-producer-prompt.test.js`: PROMPT_
    VERSION assertion updated to 3; two new prompt-text content guards
    (RESPONSE_SHAPE field, INSTRUCTIONS paragraph); the repurposing-guard
    test updated to also assert the new field's own sentence; the
    `feeAmountAssertion()` test helper extended with an optional
    `limbAmountQuote` parameter (omitted entirely, not null, when not
    passed, so every pre-existing call site in the file is byte-for-byte
    unaffected); seven new tests covering the shaping layer directly
    (verified attach, omitted-when-absent, hallucinated sub-quote dropped
    as attribute only, duplicate-elsewhere-but-correctly-nested, ambiguous
    double-nesting fails closed), the simulated full chain (real shaped
    output fed through `resolveFeeAmount`), and the real end-to-end
    pipeline as it behaves TODAY (proving the shaping-layer change alone is
    inert until the resolver diff lands -- see section 11).
  - No changes to `tests/canonical-v2-termination-fee-resolution.test.js`
    or any other file -- re-run to confirm no regressions (section 13).

## 10. Alternatives rejected

- **Generalise `condition_groups`.** Dead end -- section 2.
- **Positional/ordinal disambiguation** (`limb_ordinal: 1` instead of a
  quote). Rejected: not independently provable against source bytes (the
  brief's own requirement) -- the resolver would have to trust the model's
  own counting with no cross-check, unlike a quote, which is relocated and
  verified. Also more brittle against belt-and-braces drafting (a figure
  restated in both digit and spelled form nearby) than a verbatim span.
- **Repurpose `section_reference` / `payer_party` / `fee_term_ref`.**
  Explicitly identified as wrong in the brief and confirmed independently:
  all three are correctly identical across Modiv's sibling limbs and each
  is already validated for its own real meaning by a dedicated resolver
  gate (`FEE_TERM_UNIDENTIFIED`/`FEE_TERM_NOT_IN_QUOTE` for `fee_term_ref`);
  repurposing any of them to also carry a disambiguation signal would
  either break that gate's semantics or silently stop being
  identical-when-the-underlying-fact-is-identical, which the prompt
  explicitly and correctly requires.
- **Take the first (or last) money literal in the whole quote as a
  heuristic**, no new field at all. Rejected on legal-correctness grounds
  already established in this codebase -- this is exactly the class of bug
  PROMPT_VERSION 2 and `MULTIPLE_MONEY_LITERALS` ("never picked between")
  exist to prevent; `handleDividendsCandidate`'s own comment states the
  same principle for a sibling per-share-amount case.
- **Make `limb_amount_quote` unconditionally required**, even for ordinary
  single-figure fees. Rejected: would require every pre-existing recorded
  response fixture (which predates this field) to be treated as
  non-compliant, breaking strict-additivity -- the exact failure mode this
  codebase already names and avoids for `share_count_assertions`
  (`SHARE_COUNT_ASSERTIONS_KEY`'s own comment).
- **Encapsulate the fallback policy inside `handleFeeAmountCandidate`
  itself** (inline branching in `candidate-resolution.js`) rather than a
  new `resolveFeeAmount` in `termination-fee-parse.js`. Rejected in favour
  of the latter once the file-lock constraint was in view: keeping the
  policy in a file this session CAN edit and directly unit-test shrinks the
  unapplied resolver diff to a one-line call-site swap (section 11) and
  makes the policy itself provable without the resolver at all.

## 11. The resolver patch -- UNAPPLIED

Target file: `lib/canonical-v2/native-producer/candidate-resolution.js`
(locked this session by another agent working on a different function,
`handleFeeTriggerCandidate`, in the same file -- see `docs/codex-program/
notes/trigger-override-fix.md`). Three anchored hunks, verified against the
file's current, exact contents at the line numbers below (re-checked
immediately before writing this, not from an earlier read -- the other
agent's own edits are confined to `handleFeeTriggerCandidate`, ~5719
onward, well clear of these three spots).

**Hunk 1 -- import (lines 250-254):**

```diff
 const {
   TERMINATION_FEE_PARSE_VERSION,
   parseFeeAmount,
+  resolveFeeAmount,
   parseTailPeriodMonths,
 } = require('./termination-fee-parse');
```

**Hunk 2 -- `handleFeeAmountCandidate`, the amount parse (line 5670):**

```diff
-    const parseResult = parseFeeAmount(claim.raw_value);
+    // Per-limb disambiguation (docs/codex-program/notes/per-limb-fee-
+    // amount.md): resolveFeeAmount tries the whole quote first, unchanged,
+    // and consults attrs.limb_amount_quote ONLY when that abstains
+    // MULTIPLE_MONEY_LITERALS specifically -- see that module's own header
+    // for why the fallback is scoped to exactly that one reason. attrs is
+    // already in scope (line 5600); limb_amount_quote was already byte-
+    // verified, nested uniquely inside claim.raw_value, by anthropic-
+    // provider.js's shapeFeeAmountAssertion before this candidate ever
+    // reached the resolver.
+    const parseResult = resolveFeeAmount(claim.raw_value, attrs.limb_amount_quote);
     if (parseResult.outcome !== 'RESOLVED') {
       pushReviewUnresolved({
         entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
         reasons: [parseResult.reason],
         materiality: materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT' }),
         normalisedPhrase, attachmentPosition: null,
       });
       return;
     }
```

**Hunk 3 -- `finalizeTerminationFeeClaim` call, the audit breadcrumb (lines
5702-5707):**

```diff
     finalizeTerminationFeeClaim({
       entry, claim, provenance, genericKey: FEE_AMOUNT_CLAIM_KEY,
       registeredClaimDefinitionKey: 'TERMINATION_FEE_AMOUNT', conceptKey, party,
       canonicalValue: parseResult.canonical_value,
-      extraAttributes: { fee_side: feeSide, fee_term_ref: feeTermRef },
+      extraAttributes: {
+        fee_side: feeSide, fee_term_ref: feeTermRef,
+        // Present ONLY when the fallback actually fired -- omitted, not
+        // false, so claim_revision_id stays byte-identical for every claim
+        // that resolved the ordinary way (design note section 6's
+        // omit-when-absent discipline). Lets a human/QA process distinguish
+        // "resolved directly" from "resolved via the new per-limb field"
+        // without re-deriving it from attributes.limb_amount_quote alone
+        // (which can be present on a claim that resolved WITHOUT needing
+        // it, if the model filled it in even though the whole quote already
+        // had only one money literal).
+        ...(parseResult.used_limb_amount_quote ? { limb_amount_disambiguated: true } : {}),
+      },
     });
```

No other lines in `candidate-resolution.js` need to change: `attrs` is
already destructured at the top of `handleFeeAmountCandidate` (line 5600);
`allowed_attributes`/quarantine handling needs no resolver-side change at
all (section 6 -- `rebuildClaim` carries `originalClaim.attributes` forward
without re-validating against `allowed_attributes`, and the shaping layer
already declared the key allowed unconditionally); no change to
`GENERIC_CLAIM_KEY_RESOLUTION_TABLE`, `finalizeTerminationFeeClaim` itself,
or any other handler.

Verified against the real, unmodified `resolveFeeAmount` and the real
shaped Modiv output (this session's "simulated full chain" test, section
9) -- NOT verified by actually applying this diff and running the resolver
end to end, since the file is locked. The "real end-to-end pipeline TODAY"
test (section 9) pins that, until this diff lands, the full pipeline
continues to abstain exactly as before; whoever applies this diff should
expect that one test to start failing (by design -- it is pinning
pre-diff behaviour) and should replace its `resolved.length === 0` /
`MULTIPLE_MONEY_LITERALS` assertions with the RESOLVED-outcome pattern
already proven in the "simulated full chain" test immediately above it in
the same file (two distinct canonical values, `10000000` and
`15000000.00`, both under `concept_key: 'TERMF-TARGET'`).

## 12. What is proven and what is not

Proven, by tests run against real, unmodified code in this session:

- The shaping layer (`anthropic-provider.js`) correctly attaches, verifies,
  and fails closed on `limb_amount_quote`, including the ambiguous-nesting
  and text-exists-but-not-nested-here edge cases -- direct unit tests
  against `shapeTerminationFeeProposals`.
- `resolveFeeAmount` (`termination-fee-parse.js`) correctly implements the
  fallback policy in isolation, including every abstain-reason boundary --
  direct unit tests, no resolver dependency.
- The two layers compose correctly: feeding the REAL output of
  `shapeTerminationFeeProposals` on the REAL Modiv sentence through
  `resolveFeeAmount` resolves both limbs to their own distinct, correct
  amounts (10000000 / 15000000.00) -- the "simulated full chain" test.
- The shaping-layer change alone, without the resolver diff, changes
  NOTHING about the real end-to-end pipeline's current output -- the "real
  end-to-end pipeline TODAY" test, and the full existing test suite
  (section 13).
- Every pre-existing termination-fee test in the repo (Dyax shape (a),
  Modiv shape (b) baseline, fee_side corroboration, tail periods, wave B,
  the Landos real-fixture replay, the Modiv resolution/review-parity static
  fixtures) is unaffected -- full suite green, section 13.
- The residual risk in section 8 (a byte-real but wrong-limb sub-quote
  still resolves) is real, not just asserted -- demonstrated directly
  against `resolveFeeAmount`.

NOT proven, and cannot be proven without a live model call (none was made,
per this task's constraints):

- Whether a live model, given the new `LIMB_AMOUNT_QUOTE` instruction, will
  actually populate the field, and populate it correctly, for Modiv or any
  other real conditional-fee agreement. PROMPT_VERSION 2's own header
  carries the identical caveat for the same reason -- prompt wording can be
  verified for clarity and internal consistency, never for compliance,
  without a live run.
- The resolver diff's actual behaviour once applied and executed inside the
  full `resolveCandidates` pipeline (as opposed to the equivalent logic
  proven in isolation) -- `candidate-resolution.js` was not editable this
  session.
- Anything about the cross-reference-to-limb (grounds-to-amount) mapping --
  explicitly out of scope, section 7.

## 13. Verification results

Targeted (this session, real output from the actual runs):

- `node --test tests/canonical-v2-termination-fee-parse.test.js` -- 43
  pass, 0 fail (9 new `resolveFeeAmount` tests among them).
- `node --test tests/canonical-v2-termination-fee-producer-prompt.test.js`
  -- 22 pass, 0 fail (9 new tests among them; every pre-existing PROMPT_
  VERSION-2 test, including the two Modiv/Dyax end-to-end regression pins,
  passes unmodified).
- `node --test` over the four widest-blast-radius siblings (`canonical-v2-
  termination-fee-resolution`, `canonical-v2-termination-fee-both-sources`,
  `canonical-v2-termination-real-fixture-replay` (the committed Landos
  fixture), `canonical-v2-native-provider-family-dispatch`) -- 80 pass, 0
  fail.
- `node --test` over the six static-fixture/replay consumers most likely to
  be sensitive to a hash or shape change (`canonical-v2-modiv-replay`,
  `canonical-v2-modiv-antitrust-closing-gap-replay`, `canonical-v2-p1-
  captable-numerics-resolution` -- the share-count sibling whose helper this
  change's own helper mirrors, `derived-fields`, `review-parity-harness`,
  `parse-money`) -- 90 pass, 0 fail.

Full suite, exactly as CI runs it:

```
CI=true npm test > /tmp/perlimb.log 2>&1; echo "EXIT=$?"
EXIT=0
```

`tests 7471`, `pass 7429`, `fail 0`, `cancelled 0`, `skipped 42`, `todo 0`.
42 skipped is pre-existing and unrelated to this change (read from the same
log via `grep`/`tail`, never a direct `Read` of the 1.05 MB log file; not
investigated further as out of scope for this task).

`npm run build` was not run -- not listed in this task's own Verification
section, and this change touches no runtime/UI code path.
