# MAE clause_label / prong_label verification, design note

Status: implemented and wired into candidate-resolution.js. Full suite
green, see the Verification section.

Target files: `lib/canonical-v2/native-producer/mae-clause-label-parse.js`
(new, pure), `lib/canonical-v2/native-producer/candidate-resolution.js`
(resolver wiring), `lib/canonical-v2/phase1-authority-boundary-inventory.js`
(the new pure module had to be classified under the repo's Phase 1
authority-boundary governance test), and their tests. No change to
`mae-definition-producer-prompt.js` or `anthropic-provider.js`: no prompt
version bump, because no prompt change was needed. No live model call was
made.

## 1. The question the brief asked, answered first

Two hypotheses were named: (a) the model quotes correctly and the resolver
has nowhere to put a label that sits outside the quote (a resolver join,
like grounds-to-amount, no model change), or (b) the model is genuinely
narrowing its quotes so the label is lost (a prompt fix, like per-limb fee
amount).

**Answer: (a), for 17 of the 17 candidates the brief named, confirmed
against the real recorded response, not assumed.** Read
`evidence/canonical-v2/topbuild-mae-definition-20260806/native-producer-
recorded-response-3.1_a_.json` directly. The model's own JSON already
carries `clause_label` as its own dedicated field on every `carveout_
assertions` and `limb_local_disproportionality_assertions` entry, separate
from `quote`, correctly populated, every time. `quote` is deliberately
narrow, exactly as `mae-definition-producer-prompt.js`'s own RESPONSE_SHAPE
instructs ("narrow the quote to the single clause you are coding" when one
clause matches two codes) -- so a well-formed, correctly narrowed quote
never restates its own label, and the resolver's ONLY check
(`clauseLabel && !claim.raw_value.includes(clauseLabel)`, `candidate-
resolution.js`, pre-fix) only ever passed by coincidence, when a clause's
own internal proviso happened to self-reference its own letter (TopBuild
(C): "...provided that this clause (C) shall not apply..."). Twelve of the
fifteen `carveout_assertions` and all five `limb_local_disproportionality_
assertions` have no such self-reference and were refused for that reason
alone, mechanically, not because anything about them was actually wrong.

This is confirmed, not inferred, by reading the model's raw JSON side by
side with the real filed source text
(`tests/fixtures/canonical-v2/mae-definition-family/topbuild-company-mae-
definition.txt`, the actual TopBuild/QXO Company MAE definition). Every
label the model asserts is genuinely, verifiably the label immediately
preceding that exact clause in the real document. Nothing here required a
new field, a prompt change, or a live model call to prove.

## 2. The one genuine wrinkle, also confirmed against real text, also solved without a model change

Clause (D) reads, in the real filing:

> (D) changes or developments arising out of acts of terrorism or sabotage,
> civil disturbances or unrest, war (whether or not declared), the
> commencement, continuation or escalation of a war or military action,
> acts of hostility, weather conditions or other acts of God (including
> storms, earthquakes, floods or other natural disasters or changes due to
> the outbreak or continuation of any epidemic, pandemic or other health
> crisis), including any actual or threatened material worsening of such
> conditions, except to the extent that they have a disproportionate
> effect...

The model correctly splits this one lettered clause into three carve-out
codes (ACTS_OF_WAR_TERRORISM, NATURAL_DISASTERS, PANDEMIC), each narrowed to
its own distinctive words, per the prompt's own instruction. But the shared
chapeau ("changes or developments arising out of ... weather conditions or
other acts of God (including ... or changes due to ...)") sits between the
"(D)" marker and two of the three narrower quotes, so those two are not
textually adjacent to "(D)" at all -- checked directly against the real
source bytes with a small script, not assumed:

```
(D) ACTS_OF_WAR_TERRORISM  -- preceded by "(D) changes or developments arising out of " -- NOT adjacent
(D) NATURAL_DISASTERS      -- preceded by "(including "                                  -- NOT adjacent
(D) PANDEMIC                -- preceded by "or changes due to the "                       -- NOT adjacent
```

This is the same defect CLASS the brief named for termination fees (a
compound sentence split across severable pieces, common framing correctly
not repeated for each piece) but it is not the SAME fix, because the model
is not being asked to assert anything new here; it already, unprompted,
emits a fourth candidate that resolves this cleanly: `limb_local_
disproportionality_assertions`' own (D) entry, whose quote spans the WHOLE
clause from "(D)" onward (it is never narrowed the way the carve-out
codes are, because a disproportionality carveback has nothing to narrow
around). That full quote:

- Is itself directly adjacent to "(D)" (confirmed against real text).
- Contains all three narrower carve-out quotes as substrings, each exactly
  once (confirmed against real text).

So a second, resolver-only join closes the remaining three: if a candidate
is not directly adjacent to its own label, look for another candidate in
the same section sharing the exact same label whose own quote IS directly
adjacent, and check whether that sibling's quote contains this one. No new
field, no prompt change, no live model call. See section 4 for the exact
rule, including how it fails closed when no such sibling exists or more
than one candidate claims the same sibling.

## 3. Design: three tiers, strictly additive over the original check

`lib/canonical-v2/native-producer/mae-clause-label-parse.js`, new, pure, zero
dependencies (confirmed: no `require` anywhere in the file), mirroring
`termination-fee-parse.js`'s own contract shape.

1. **Tier 1, unchanged.** `quote.includes(clauseLabel)` -- the ORIGINAL
   check, tried first, exactly as before. Every candidate that passed
   before this fix still passes this way, taking a byte-identical code
   path through `finalizeMaeClaim`. Every pre-existing synthetic test
   fixture in this repository (which all happen to pass the FULL clause
   text, label prefix included, as `quote` -- a different shape from what
   the real model emits, and part of why this defect was not caught until
   the first live run) also passes here, unaffected.
2. **Tier 2, new.** `verifyMaeClauseLabelAdjacency`: locate `quote`
   uniquely in the governing section's own admitted text (fail closed,
   `QUOTE_NOT_LOCATED`, if it is absent or appears more than once), then
   check whether `clauseLabel` immediately precedes it, modulo trailing
   whitespace. Proven against the real, admitted document, never against
   the model's own quote.
3. **Tier 3, new.** `selectMaeClauseLabelSibling`: for a candidate that
   fails tier 2, look at every OTHER compiled MAE candidate in the same
   section sharing the exact same label. Keep only the ones that are
   THEMSELVES tier-1 or tier-2 verified (never a candidate that is itself
   unverified). If exactly one of those contains this candidate's quote as
   a substring, uniquely, that is the answer. Zero qualifying siblings is
   `NONE` (the ordinary case, most labels never need this tier at all).
   More than one, or a quote appearing more than once inside one
   candidate's own text, is `AMBIGUOUS` and is refused, never guessed --
   the identical "ambiguous nesting fails closed" discipline
   `selectFeeAmountGroundsCondition` already established for the
   termination-fee family.

`verifyMaeClauseLabel` composes all three and is what `candidate-
resolution.js` actually calls. No new byte-verification is invented
anywhere in this design (the same governing principle grounds-to-amount-
mapping.md names in its own section 4): `quote` was already independently
byte-verified during shaping, before this ever runs; this only relates two
already-asserted, already-in-scope strings, `clauseLabel` and `quote`'s own
position, to text the resolver already holds, or to another already-
verified sibling's own quote.

## 4. Resolver wiring

`candidate-resolution.js`:

- `indexMaeLabelledCandidatesBySection`, mirroring `indexFeeAmountCandidates
  BySection`'s own "built once per resolveCandidates call, never rescans"
  discipline exactly: every compiled `MAE_CARVEOUT_CLAIM_KEY` /
  `MAE_DISPROPORTIONALITY_CLAIM_KEY` candidate, indexed by
  `(section_reference, label)`. A `MAE_DISPROPORTIONALITY_CLAIM_KEY`
  candidate contributes a label only when it is PER_LIMB-sourced with a
  single `applies_to_clause_labels` element (a TRAILING_LIST candidate
  names several labels in one proviso and is never itself one clause's own
  anchor).
- `maeClauseLabelVerifiedInSection`, mirroring `resolveFeeAmountGrounds`'s
  own shape: every index it needs (`sectionsByReference`,
  `maeLabelledCandidatesBySection`, `admittedSourceContext`) is an explicit
  parameter, never a closure over `resolveCandidates`'s own locals, so it
  can be exercised directly in a test without a full `resolveCandidates`
  run. Lazily slices and caches each section's own text once, the first
  time that section is actually queried (`maeSectionTextCache`), not once
  per candidate.
- `handleMaeCarveoutCandidate`'s `clause_label` gate now calls this instead
  of the bare substring check. The missing-label early return
  (`!clauseLabel`) is untouched, still first, still its own reason.
- `handleMaeDisproportionalityCandidate`'s `applies_to_clause_labels` gate
  is upgraded **for `PER_LIMB` only**. `TRAILING_LIST` is deliberately left
  exactly as it was: a trailing proviso's own quote legitimately recites
  each covered label INLINE, as content ("... in the case of the foregoing
  clauses (a), (b) and (c) ..."), not as an external structural prefix, so
  the original substring-of-quote check is the semantically correct one for
  that shape. No committed run has ever exercised a TRAILING_LIST
  candidate failing this gate, so nothing about it was changed; a hostile
  test proves it still behaves exactly as before (section 6).
- `handleMaeDefinitionProngCandidate`'s `prong_label` gate is upgraded the
  same way, reusing `maeClauseLabelVerifiedInSection` directly (see section
  5).

The reason codes `CLAUSE_LABEL_NOT_IN_QUOTE`, `CARVEBACK_CLAUSE_LABELS_
NOT_IN_QUOTE` and `PRONG_LABEL_NOT_IN_QUOTE` are unchanged. A candidate that
still cannot be verified after all three tiers queues with the identical
reason it always did; the meaning to a human reviewer is the same either
way, "could not verify this label denotes this quote."

## 5. prong_label: same defect shape, found by structural analogy, not by replay

`prong_assertions` carries the identical design as `carveout_assertions`:
a `prong_label` field, separate from `quote`, and the same "quote only that
prong's own text" instruction. The pre-fix gate
(`prongLabel && !claim.raw_value.includes(prongLabel)`) had the identical
defect. Fixed the same way, reusing `maeClauseLabelVerifiedInSection`
directly rather than writing a parallel function: since
`maeLabelledCandidatesBySection` indexes only carve-out and
disproportionality candidates, tier 3 simply never finds a prong-shaped
sibling to try, which is exactly correct -- two prongs never share one
label the way a compound carve-out clause's severable sub-items do.

**This one is not replay-proven.** TopBuild's own MAE definition has a
single, unlabelled prong (`prong_label: null`), so no committed live run
has ever exercised a labelled prong failing this gate. The fix is justified
by structural analogy (same field pair, same file, same design principle,
confirmed identical prompt language) and tested against the real Modiv
prong text with its own label prefix mechanically removed -- the same
narrowing the real carve-out quotes were independently observed to
exhibit -- not against a recorded model response. Flagging this
distinction plainly rather than folding it into the replay-proven claim
above: a live run against a genuinely two-pronged MAE definition (Modiv's
own real filing has one) is the only thing that would fully confirm it.

## 6. What was actually verified, and how

**Acceptance 1 (replay).** `tests/canonical-v2-mae-definition-resolution.
test.js`'s new REPLAY test reconstructs `evidence/canonical-v2/topbuild-
mae-definition-20260806/native-producer-recorded-response-3.1_a_.json`'s
own `mae_definition_instances[0]` field for field (not paraphrased) and
runs it through the real, unmodified `shapeMaeDefinitionProposals` /
`resolveCandidates` pipeline over the real, committed TopBuild fixture
text. Measured, not asserted: **17 of the 17 candidates the brief named now
resolve** -- all 12 `CLAUSE_LABEL_NOT_IN_QUOTE` and all 5 `CARVEBACK_
CLAUSE_LABELS_NOT_IN_QUOTE`. The two `MAE_CARVEOUT_UNCORROBORATED`
candidates ((E), (F)) are confirmed still queued, by name, unchanged --
that gate is untouched and was always out of scope. Total resolved rises
from 2 to 19 of this replay's own 21 compiled candidates (the real run's
`compiled_candidates: 23` also counts 2 `open_world_candidates` this replay
omits, because both are drawn from organisational-representation prose
outside the narrower MAE-only fixture this repository has committed --
unrelated to clause labels, a different gate, `NATIVE_OPEN_WORLD_
PROPOSAL`, entirely untouched).

This did not need a live run to settle, because `clause_label` is not a new
field: the committed evidence already shows the model populating it
correctly, today, unprompted, under the current, unmodified prompt.

**Acceptance 2 (hostile tests), all three named, all confirmed unchanged
behaviour:**

- A label absent from the source entirely (a real narrowed quote asserting
  a clause_label that appears nowhere near it, and has no qualifying
  sibling either) still queues `CLAUSE_LABEL_NOT_IN_QUOTE`.
- A label whose location is ambiguous: the identical sentence drafted
  twice in one section. Tier 2 requires the quote's own location to be
  unique in the section text and fails closed the moment it is not,
  before a label is even looked at -- still queues, never guesses which
  occurrence.
- A carve-out with no label at all (`clause_label: null`) still queues
  `CLAUSE_LABEL_NOT_IN_QUOTE`. This is the one path genuinely untouched by
  the fix: the `!clauseLabel` early return is unchanged code, checked
  first, unconditionally, exactly as before.

Two further hostile tests beyond the three named, because the
disproportionality family has two source forms: an absent label on a
PER_LIMB carveback still queues `CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE`; a
label absent from a TRAILING_LIST proviso's own text also still queues it,
proving the deliberately-unmodified TRAILING_LIST path (section 4) behaves
exactly as before.

`tests/canonical-v2-mae-clause-label-parse.test.js` (new, 25 tests) proves
every tier of the pure module directly and independently of the resolver,
including the ambiguous-quote-location and ambiguous-sibling-containment
cases, and that an unverified sibling can never rescue another candidate
(no chained/recursive trust).

**Acceptance 3 (the two pre-existing resolves, unchanged).** Both the
BUSINESS_EFFECTS prong and the (C) carve-out pass tier 1 alone -- proven
directly (`canonical-v2-mae-clause-label-parse.test.js`, "tier 1 --
self-referencing quote ... verifies without any sectionText at all"),
meaning tiers 2 and 3 are never even reached for either claim. Their code
path through `finalizeMaeClaim`, and therefore their identity computation,
is byte-identical to before this fix, by construction, not merely by
testing. The REPLAY test additionally re-asserts both resolve with their
original `canonical_value`/`attributes` unchanged.

**Strict additivity, by construction and by grep.** `extraAttributes`
passed to `finalizeMaeClaim` is unchanged by this fix in every handler --
this change only alters which BOOLEAN gate decides whether a candidate is
allowed to reach that call at all, never what gets passed once it does.
No pre-existing claim's identity moves. Every new function added is a pure
addition (new file, new exports, new index, new resolver helper); no
existing exported name, response array, or default behaviour was removed
or repurposed anywhere in this change.

## 7. Does this fix shape generalise to other families

**Investigated directly, not guessed: no, this specific defect is unique to
MAE_DEFINITION among the 25 registered families, and both of its two
occurrences within that one family are now fixed.**

Grepped every `*-producer-prompt.js` file (27 registered producer prompts)
for every field ending in `_label`. Exactly two exist anywhere in the whole
extraction pipeline: `clause_label` and `prong_label`, both in `mae-
definition-producer-prompt.js`, both fixed by this change.

Two OTHER families (`capitalisation-producer-prompt.js`, `representations-
producer-prompt.js`) also use a `limb_path` array for structural position,
but neither pairs it with a separate scalar label field, and neither
resolver path verifies any `limb_path` element via substring-of-quote --
`limb_path` there is pure structural bookkeeping (qualifier-scope
governance: ITEM/TRAILING/CHAPEAU), read but never corroborated against
the quote's own text. There is no equivalent gate to have this equivalent
bug.

The general lesson, worth stating for whoever builds or reviews the next
family: **this specific failure needs a scalar "which clause is this"
field to exist SEPARATELY from an intentionally narrowed quote field, AND
a resolver gate that checks the label by searching inside that same narrow
quote rather than against the source text the quote came from.** Only
MAE_DEFINITION has that exact combination today. If a future family design
adds a scalar label field alongside a narrowed quote (the natural design
whenever one enumerated clause can assert more than one typed fact), the
right verification from day one is what this note built: adjacency against
the admitted section text, with a same-label sibling as the fallback for a
compound clause's shared framing, not substring-of-own-quote.

## 8. Residual risk, stated plainly

Tier 2 proves a label is genuinely, uniquely adjacent to a quote in the
real document. Tier 3 proves a quote is genuinely, uniquely nested inside
an independently-adjacent sibling's own quote. Neither proves the model
correctly identified WHICH carve-out code or prong code that clause states
-- that is `maeCarveoutCorroborated`/`maeDefinitionProngCorroborated`'s own
job, entirely unmodified by this change, and carries the same class of
limitation every corroboration table in this file already carries: does
the text match the claimed label, never was the candidate classified
correctly in the first place. Checked directly for this specific run,
not assumed: all 17 of the newly-verified candidates also independently
corroborate under their own asserted codes (confirmed by calling
`maeCarveoutCorroborated`/`maeDisproportionalityCorroborated` directly
against each real quote before writing the replay test), so this run
carries no open corroboration question. A future run could, in principle,
carry a genuinely miscoded but label-adjacent clause; that risk existed
identically before this fix, for the one candidate ((C)) that already
resolved, and is unchanged by it.

## 9. Verification results

Targeted, this session, real output from the actual runs:

- `node --test tests/canonical-v2-mae-clause-label-parse.test.js` -- 25
  pass, 0 fail.
- `node --test tests/canonical-v2-mae-definition-resolution.test.js` -- 29
  pass, 0 fail (8 new tests among them: the REPLAY test, five hostile
  tests, two prong_label tests; all 21 pre-existing tests in this file
  pass unmodified).
- `node --test tests/canonical-v2-phase1-authority-boundary.test.js` -- 19
  pass, 0 fail, after classifying the new pure module as `PURE_PROPOSAL`
  in `phase1-authority-boundary-inventory.js` (the repository's own Phase 1
  governance test requires every new production source to be classified;
  the new module is zero-dependency, resolver-support pure logic, the same
  species as the already-classified sibling `bare-citation-trigger-
  parser.js`).

Full suite, exactly as CI runs it:

```
CI=true npm test > /tmp/mae.log 2>&1; echo "EXIT=$?"
EXIT=0
```

`tests 7674`, `pass 7632`, `fail 0`, `cancelled 0`, `skipped 42`, `todo 0`.
Total tests rose from the baseline 7641 to 7674, exactly the 33 new tests
this change adds (25 + 8, accounted for above). Skipped count (42) is
unchanged from the baseline, confirming no new skip was introduced.

`npm run build` was not run: not listed in this task's own Verification
section, and this change touches no runtime/UI code path (`candidate-
resolution.js` and the new `mae-clause-label-parse.js` are both
server-side extraction library code, not imported by any page or
component) -- same precedent already established for the sibling
grounds-to-amount and per-limb-fee-amount changes.
