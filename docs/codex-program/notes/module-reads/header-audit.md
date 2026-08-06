# Header audit -- lib/ and scripts/ modules referenced in CODEBASE-GUIDE.md

Task: verify each module's header comment against its actual code. Fix
inaccurate headers in place (source files only, nothing under docs/). This
file is the working report, written incrementally as modules are audited.

Trigger case (already known, included for completeness):
`lib/canonical-v2/native-producer/section-family-classifier.js` header
claimed "the ONLY stage-1 rule this slice ports" when the module in fact
carries 26 rules, one per family. Confirming and fixing this first.

Status: COMPLETE. All 38 modules read and checked. 6 headers fixed, 1
minor imprecision fixed, 1 empirical claim left unresolved, 1 guide
line-number table + 1 guide shape-description issue flagged for the
coordinator (not edited, per the file constraint).

## Verification

    CI=true npm test > /tmp/headers.log 2>&1; echo "EXIT=$?"

Result: `EXIT=0`. 7724 tests, 7682 pass, 0 fail, 42 skipped, 0 cancelled
(unrelated to this change; the same skip count as before). All edits are
comment-only -- confirmed both by the clean exit code and by reading each
diff directly: every changed line sits inside a `/** */` or `//` block,
no code line was touched (see the diffs quoted inline through this
report where relevant).

    bash scripts/lint/forbidden-patterns.sh

Result: `INVARIANT-4: PASS`, exit 0.

---

## Findings (ranked by consequence -- would believing the header cause a wrong decision)

### 1. `lib/canonical-v2/native-producer/section-family-classifier.js` -- FIXED (trigger case)

Header claimed (line 22, its own numbering): "This is the ONLY stage-1
rule this slice ports; the seam is written so a future family's own title
rule is added to `STAGE_1_TITLE_RULES` in that family's own reviewed
diff, never invented here."

Actual: `STAGE_1_TITLE_RULES` holds 27 rule entries covering 26 distinct
family labels. INTERIM_OPERATING contributes two entries (one per
`covenant_side`, BUYER/TARGET). TAKEOVER_STATUTE_EXCLUDED is an
exclusion-only label used to suppress a false ANTITRUST_REGULATORY match,
never dispatched to a producer. That leaves 25 real dispatchable
families, which matches `producer-prompt-registry.js`'s REGISTRY exactly
(verified by direct count, not by trusting either header).

This is the header the coordinator read and repeated to Ben as "one
classification rule, cannot scale" -- the entire premise of that
conversation. Confirmed false: the module scales fine and already has.

Fix applied: rewrote the paragraph to keep the TERMINATION/TERMF history
(ported verbatim from `classify.js`, still true and still the reason the
TERMF exclusion pattern exists) but stated in the past tense as the
*original* state, corrected the live count to 27 entries / 26 labels /
25 registered families, and added an explicit instruction to recount
from `STAGE_1_TITLE_RULES` rather than trust the prose -- since the prose
has now gone stale once already.

### 2. `lib/canonical-v2/native-producer/producer-prompt-registry.js` -- FIXED (same disease, second instance)

Header claimed (under "ONE ENTRY THIS SLICE"): "The existing
capitalisation producer is registered as the first, and this slice's
only, entry: `CAPITALISATION -> buildCapitalisationProducerPrompt`,"
and separately described future families by example ("e.g. TERMINATION,
per the termination-rights spec") as if TERMINATION were still
unregistered.

Actual: `REGISTRY` (the `Map` literal in the module body) holds 25
entries -- every family the classifier can produce a rule-classified or
AI-classified result for, including TERMINATION, which the header still
described as a hypothetical future example. Direct count via grep on the
`Map` literal: 25 `['FAMILY', builder]` entries.

This is the identical failure mode to finding #1, in the sibling module
the classifier's own header points to as the source of truth for family
counts -- meaning a reader who doubted the classifier header and went to
check the registry header instead would have been told the same wrong
story. Ranked just below #1 only because this is not the header the
coordinator actually quoted to Ben; the risk it poses is the same.

Fix applied: reframed "ONE ENTRY THIS SLICE" as the historical starting
state, preserved the pure-refactor/byte-identical-fixture-replay
reasoning (still true and still the point), updated the count to 25
entries "as of this writing," removed the stale TERMINATION-as-future-
example line since TERMINATION is now registered, and added a note to
check `REGISTRY` itself rather than the header's count.

### 3. `lib/canonical-v2/termination-fee-serving-source.js` -- FIXED (same disease, third instance)

Header claimed: "This module owns three things and nothing else," then
enumerated the env gate, the per-deal card registry, and the wire
stamping.

Actual: a fourth concern -- the "compare" mode gate
(`isCanonicalV2TerminationFeeCompareEnabled`, its own env key
`CANONICAL_V2_TERMINATION_FEE_COMPARE_ENV_KEY`, and its own wire field
`CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD`) -- was added below that
same header, introduced by "Ben's ruling, 2026-08-05" per the module's
own inline comment. The closed "three things" claim was written before
that addition and never updated after. Confirmed by reading the full
export list at the bottom of the file (10 exports including
`isCanonicalV2TerminationFeeCompareEnabled` and the three
`..._COMPARE_...` constants).

Ranked below #1/#2 because this header was never quoted to Ben and the
scope claim is narrower in consequence (a developer reading "three
things" might miss that compare-mode is in scope here rather than
elsewhere, but the code itself is correct and tested regardless) -- still
the same failure mode, so recorded at the same tier of the list rather
than in the minor section.

Fix applied: changed the claim to state the module started at three
things and is now four, listed the fourth (compare-mode gate), kept the
existing numbered reasoning for 1-3 unchanged, and added an explicit
instruction to recount from the module's own export list rather than
trust the number in prose -- same self-aware caveat added to findings #1
and #2, because this makes three headers in this codebase that have
independently gone stale on a closed count. That is a pattern, not a
coincidence, and is called out in the summary at the end of this report.

### 4. `lib/canonical-v2/native-producer/native-extraction-run.js` -- FIXED

Header's opening summary lists "the four existing native-producer pieces
in order," with step 2 named as literally `capitalisation-producer-
prompt.js`. Actual: this module now resolves the producer prompt module
through `producer-prompt-registry.js`'s `getProducerPromptModule
(section_family)` (confirmed at line 676:
`const producerPromptModule = sectionFamily ? getProducerPromptModule(sectionFamily) : null;`).
`capitalisation-producer-prompt.js` is only what it resolves to by
*default*, when no `section_family_classifier` is supplied -- with a
classifier supplied it can resolve to any of the registered families'
producer-prompt builders.

Notably, the header does NOT fully contradict itself: a later section
("PRODUCER DISPATCH THROUGH THE REGISTRY, PURE REFACTOR") already
explains the registry-based dispatch correctly. The bug is that the
opening "four pieces" list was never updated to match -- it still reads
as if step 2 is one fixed file, and a reader who stops at the summary
(which is exactly what a summary invites) gets the pre-registry picture.
Two truths about the same module, in the same header, disagreeing with
each other.

Fix applied: reworded step 2 to name `producer-prompt-registry.js` as
the piece, explained the default-vs-classified resolution in place, and
pointed to the existing "PRODUCER DISPATCH THROUGH THE REGISTRY" section
for the full history rather than duplicating it.

### 5. `lib/canonical-v2/native-producer/native-write-set-adapter.js` -- FIXED

Header claimed, flatly: "`claim_occurrence_id`/`relationship_occurrence_id`
are NOT re-derived: neither depends on evidence, so the 'same claim
slot, new evidence revision' semantics fall out for free."

Actual: `relationship_occurrence_id` is indeed never re-derived. But
`claim_occurrence_id` IS re-derived -- not from evidence, but whenever an
assertion-node claim's subject gets a newly-minted
`COMPONENT_KEY_REPRESENTATION_LIMB` component row (component rows are a
later addition, per the design spec the file cites elsewhere:
`docs/superpowers/specs/2026-08-01-component-rows-design.md`). Confirmed
in code at lines ~744-772: `claim_occurrence_id` is content-derived from
`subject_occurrence_id` (per `claims-relationships.js`'s
`buildClaimRevision`), so when component minting changes
`subject_occurrence_id`, the occurrence id is recomputed
(`claimSubjectRekey`) before evidence rebuilding runs.

This one is unusual: the file's OWN later inline comment (lines
744-756) already states the correct, current behaviour in detail and
even names the tension explicitly ("the occurrence id must be
re-derived too, not just the revision"). The top header simply was
never brought into line with it -- the correct explanation and the
stale one have coexisted in the same file.

Fix applied: split the claim in two -- relationship_occurrence_id stays
"never re-derived," claim_occurrence_id is now described as "not
re-derived from evidence, but re-derived on the separate component-
minting trigger," with a pointer to the `claimSubjectRekey` code for the
mechanism rather than duplicating it.

### 6. `lib/canonical-v2/native-producer/candidate-resolution.js` -- FIXED (omission, not a false statement)

Header's "WHAT THIS MODULE DOES, IN ORDER" numbered list (5 steps:
provision resolution, concept resolution, triage, residuals, citation
validation) is individually still true, but does not mention
"corroboration" as a concept anywhere except one incidental use of the
word in a different context (citation corroboration, step 5). Actual:
the file defines ten distinct `*_CORROBORATION_TABLE` constants
(FEE_SIDE, FEE_TRIGGER, MAE_CARVEOUT, MAE_DEFINITION_PRONG,
NO_SHOP_ACTION, NO_SHOP_PERIOD_ROLE, NO_SHOP_PREREQUISITE,
NO_SHOP_WAVE_B, SHARE_COUNT_KIND, TERMINATION_TRIGGER_KIND) plus several
further one-off `*Corroborated()` checks with no table backing (regulatory
value/filing regime, proxy-meeting party position, appraisal status,
material-contract bucket/threshold, general-covenant text, exchange-
ratio/per-share context). "corroborat" occurs 357 times in the file. This
is a pervasive, cross-family gate on whether a resolved value is trusted
against its own quote, routing to `review_queue` with typed
`*_UNCORROBORATED` reasons -- and it is invisible to anyone reading only
the module's own "what this module does" summary.

This is not the same failure as #1-#5 (nothing here asserts a false
count or names a dead file) -- it is a significant omission: the
summary's individual claims remain true, but a reader would not know this
whole mechanism exists without independently finding it in the exports
list or grepping the file, which is exactly the blind spot a "what this
module does, in order" header exists to prevent. Ranked below the six
fixes above for that reason (nothing here is actively false), but above
the "accurate" tier because the omission is large enough (a few hundred
references, ten tables) to cause a wrong mental model of the module.

Fix applied: added a paragraph after step 5 naming the corroboration
mechanism, listing the ten tables and the untabled checks, explaining
where it routes (`review_queue`, `*_UNCORROBORATED`), and noting it grew
alongside the numbered steps without ever being folded into them. Did
not renumber or rewrite steps 1-5, which remain accurate as written.

### The pattern across findings #1-#6

Three of six fixes (#1, #2, #3) are the exact same disease as the trigger
case: a closed count ("the only," "three things and nothing else," "one
entry") written when it was true and never revisited as the module grew.
Two more (#4, #5) are a header that describes an earlier, simpler
mechanism and was only partly updated when the mechanism changed -- the
correct explanation exists SOMEWHERE in the same file, just not where a
reader looking at the top summary would find it. One (#6) is a header
that stayed individually true while a large new concern grew up beside
it, unmentioned. All six share a root cause: nothing re-reads a header
against the code it describes once the code changes. I added an explicit
"recount before repeating this number" instruction to #1, #2 and #3 for
that reason -- a durable fix would be mechanical (a lint rule or test that
fails when a named count drifts from a countable array), not something
this pass can install, but worth flagging to the coordinator as a
structural recommendation, not just six point fixes.

### Minor: `lib/canonical-v2/dark-bridge-gate.js` -- imprecise but low-consequence, fixed

Inline comment on `DarkBridgeGateError` said "the four *-dark-bridge.js
modules assert through assertDarkBridgeIntegrationAllowed." The count
(four) is correct -- confirmed by grepping every caller of
`assertDarkBridgeIntegrationAllowed` -- but one of the four is
`legacy-card-bridge.js`, which does not match the literal `*-dark-
bridge.js` filename pattern (it predates that naming convention; its own
header calls it "the template the other three families' dark bridges...
were modelled on"). Nobody would grep by that literal pattern based on
an internal error-class comment, so this was never going to cause a
wrong decision -- fixed anyway since it was a two-word change once found.
Reworded to "the four dark-bridge modules -- legacy-card-bridge.js plus
the three *-dark-bridge.js-named families."

---

## Headers checked and found accurate (no edit made)

For each: the specific claims checked, not just "looked fine."

- **`lib/canonical-v2/producer-prompt-registry.js`'s sibling
  `lib/canonical-v2/native-producer/section-family-classifier.js`
  cross-references** -- covered above as fixes, not separately here.
- **`lib/canonical-v2/native-producer/candidate-resolution.js`** -- steps
  1-5 of the "what this module does" list individually verified against
  code (provision minting, `GENERIC_CLAIM_KEY_RESOLUTION_TABLE`, the
  three-outcome triage, residual handling, `citation_validation`
  propagation). Export count is 90, matching the guide's own "~90
  exports" to the exact number. Only the corroboration omission (finding
  #6) needed fixing.
- **`lib/canonical-v2/legacy-card-bridge.js`** -- "template the other
  three families' dark bridges were modelled on" claim verified: the
  other three (`general-covenants-`, `no-other-reps-fraud-`,
  `representations-dark-bridge.js`) each independently describe copying
  its pattern. "Chained dark-bridge merges... all four families"
  cross-checked against `review-preview-assembly.js` and found
  consistent everywhere it repeats (4 files, 5 separate occurrences).
- **`lib/canonical-v2/general-covenants-dark-bridge.js`** -- the
  `owner_id` extra-field claim (present only for `NATIVE_SOURCE` cards,
  validated against a closed set, fails `UNMAPPABLE_OWNER`/
  `UNKNOWN_COVENANT_CODE` rather than silently accepted) verified line
  for line against the actual validation code.
- **`lib/canonical-v2/no-other-reps-fraud-dark-bridge.js`** and
  **`lib/canonical-v2/representations-dark-bridge.js`** -- family counts
  ("three siblings," "four families," "two steps") all consistent with
  the other dark-bridge files and with `review-preview-assembly.js`.
- **`lib/canonical-v2/review-preview-assembly.js`** -- "four... dark-bridge
  preview areas," "four outcomes" (`CANONICAL_V2_PREVIEW_STATE` has
  exactly `NOT_REQUESTED`/`REFUSED`/`ATTACHED`/`FAILED`), and every "other
  three families" reference, all checked and consistent.
- **`lib/canonical-v2/dark-bridge-gate.js`** -- "Production authority is
  NONE," the single-evaluation/thin-reader claim for
  `isDarkBridgeIntegrationEnabled`/`assertDarkBridgeIntegrationAllowed`,
  and the CI-detection clause ordering all verified against code. (One
  minor imprecision fixed separately, above.)
- **`lib/negation-boundary-guard.js`** -- cross-referenced files
  (`lib/instrument-negation.js`, `docs/codex-program/notes/
  negation-reversal.md`, `tests/fixtures/canonical-v2/
  mae-definition-family/`) all exist. Integration into
  `lib/verification.js` confirmed (`hasUnclosedNegationBeforeSpan` is
  called from `groundedContainment`/`leftGroundedContainment`). The
  empirical validation numbers (36/36, ~300-position stride sample, ~10%
  fire rate) could not be re-verified by static reading -- see
  "Unresolved" below.
- **`lib/verification.js`** -- "two questions" framing (quote
  verification, coverage) still matches its export list; helper exports
  not named in the header (`locateProvisionInSource`,
  `detectAncillaryRegions`, `detectHeadMatter`) are subordinate to those
  two questions, not a third undocumented concern, unlike the
  candidate-resolution.js case.
- **`lib/queries/review-deal-wire.js`** -- every cross-referenced file
  exists; the "exactly five fields" claim in the sibling file
  `lib/queries/review-deal.js` (see below) and this file's own per-field
  trimming comments were checked against the actual `trimCardForWire`/
  `trimReviewDealForWire` code and matched.
- **`lib/queries/review-deal.js`** -- `projectReference()` returns exactly
  `provision_instance_id`, `defined_term`, `short_title`, `defined_value`,
  `primary_quote` -- five fields, matching the comment above it precisely.
- **`lib/parser-v2/extract.js`** -- the header already carries its own
  anti-drift caveat ("a type's strategy has moved before... treat this
  summary as a map, not the source of truth") and, checked anyway,
  `STRATEGY_A_TYPES`/`STRATEGY_B_TYPES`/`STRATEGY_C_TYPES` plus the
  `strategyD` function match the header's A/B/C/D description exactly.
  `RUBRIC.md` (referenced by `lib/rubric.js`, which this file requires)
  exists at the repo root.
- **`lib/parser-v2/structural.js`** -- "Purely deterministic regex-based
  parsing -- no AI calls" checked by grepping the file for any
  provider/model/API-call signature; none found.
- **`lib/canonical-v2/contract-bundle.js`** -- no file-level header, but
  the load-bearing inline claim on `FIXTURE_CONTRACT_INPUT_V1`
  ("`compileFixtureContract()`'s DEFAULT stays V1") verified directly
  against the function signature
  (`function compileFixtureContract(input = FIXTURE_CONTRACT_INPUT_V1)`)
  -- still true despite the contract having grown to V38.
- **`lib/rubric.js`** -- header's `/RUBRIC.md` reference confirmed to
  exist.
- **`lib/taxonomy.js`** -- header is generic and makes no count or scope
  claim narrow enough to falsify; spot-checked inline comments (the
  Metsera four-vs-three-exceptions reversal) are correctly framed as
  history, not current-state claims stated as if permanent.
- **`scripts/canonical-v2-live-extraction-run.mjs`** -- "25 families,"
  the `DEAL_PINS`/default-deal/default-family claims, and the
  `--follow-citations` "INERT for every other family" claim all verified
  against `producer-prompt-registry.js`, the script's own `DEFAULT_DEAL`/
  `DEFAULT_FAMILY` constants, and
  `native-extraction-run-citation-followup.js`'s own
  `CITATION_FOLLOWUP_SECTION_FAMILY` constant, respectively.
- **`scripts/review-parity-check.js`** -- the header IS the `--help` text
  (mechanically read from its own file at runtime, so the two cannot
  drift), and its documented exit codes (0/1/2/3) match
  `lib/review-parity/report.js`'s `EXIT` object exactly.
- **`lib/canonical-v2/feature-flags.js`** and **`lib/design/route-guard.js`**
  -- no monolithic header; the one specific inline claim in
  feature-flags.js ("every Canonical V2 flag below other than the pilot
  flag" shares the allowlist) verified true by reading all five flag
  functions.

## Modules with no file-level header comment (nothing to audit)

These 13 of the 38 have no `/**...*/` or banner comment block at the top
of the file -- just `'use strict'`/requires straight into code. No claim
exists to be right or wrong, so none were edited. Listed so the
coordinator knows these were checked, not skipped:
`lib/canonical-v2/admitted-semantic-source.js`,
`lib/canonical-v2/candidate-release.js`,
`lib/canonical-v2/canonical-writer.js`,
`lib/canonical-v2/claims-relationships.js`,
`lib/canonical-v2/definition-graph.js`,
`lib/canonical-v2/product-query-result-compiler.js`,
`lib/canonical-v2/sec-edgar-intake-capture.js`,
`lib/canonical-v2/sec-source-admission.js`,
`lib/canonical-v2/serving-projection.js`,
`lib/canonical-v2/source-structure.js`,
`lib/canonical-v2/termination-product-projection.js`,
`lib/canonical-v2/validate-write-set.js`,
`lib/queries/review-deal.js`.

`scripts/eval.js`'s header lists example golden-check categories
("provision counts, required categories/terms, MAE carve-outs,
coverage %, quote-verification %, schema-error rows") that are a subset
of what the file actually checks (it also gates `min_def_count`,
`min_termr_canonical_codes`, `min_nosol_provisions`, and
`feature_code_pins`, none named). Not fixed: the list reads as
illustrative ("Asserts... against LIVE data: X, Y, Z"), not as a closed
enumeration, so it is incomplete rather than false. Flagged here in case
the coordinator disagrees with that reading.

---

## Unresolved (left alone; recorded rather than guessed)

- **`lib/negation-boundary-guard.js`**'s empirical validation claim
  ("36/36 real ... qualifiers ... are flagged; a stride sample of ~300
  arbitrary positions ... fired on ~10%") is a one-time analysis result
  against the committed TopBuild/Modiv fixtures. I could not re-verify
  it by reading code; doing so would mean re-running the same
  positional-sampling analysis the original author ran, which is outside
  what static reading can confirm or refute. Nothing in the current code
  or fixtures contradicts it. Left as-is.

---

## For the coordinator: guide accuracy (do not edit `docs/` myself, per constraints)

### Line-number drift I caused directly -- needs a mechanical fix

Fixing `lib/canonical-v2/native-producer/candidate-resolution.js`'s
header (finding #6) inserted 24 lines before the rest of the file, which
shifts every line-number citation `docs/core/CODEBASE-GUIDE.md` section
4.5 makes into that file:

| Guide currently says | Now actually at |
|---|---|
| `candidate-resolution.js:605` (`GENERIC_CLAIM_KEY_RESOLUTION_TABLE`) | `:629` |
| `candidate-resolution.js:1070` (`MATERIALITY_TABLE`) | `:1094` |
| `candidate-resolution.js:9988-9990` (`resolved`/`review_queue`/`open_world`) | `:10012-10014` |
| `candidate-resolution.js:9933` (the `counts` block) | `:9953` (see next item -- also currently mis-described, not just mis-numbered) |

No other file I edited is cited by line number anywhere in the guide
(checked by grepping the guide for `<filename>:<number>` against all
seven files I touched) -- this table is the complete set of fallout.

### Pre-existing, independent of my edit: section 4.5's output-shape description

The guide calls `resolveCandidates`'s return value "the single most
important shape in the whole Canonical V2 system to hold in your head,"
then describes it as "a single object with three arrays, `resolved` /
`review_queue` / `open_world`... the sibling `counts` block... totals
each, plus `residuals` for compiler failures."

Reading the actual `return Object.freeze({...})` (current lines
10011-10030): the object has at minimum seven top-level keys always
present in some form -- `resolved`, `review_queue`, `open_world`,
`residuals`, `limb_component_trees`, `ioc_restriction_components`,
`resolution_receipt` -- plus up to three more when non-empty
(`conditional_termination_fee_values`, `structured_per_share_cash_values`,
`relationships`). `counts` is not a sibling of the three named arrays at
all; it is nested one level deeper, inside `resolution_receipt`. This
is not something my edit changed -- the shape was already this size
before I touched the file; only the line numbers pointing at it moved.
Given the guide's own framing of how important this shape is to get
right, this seems worth the coordinator's attention independent of the
line-number fix above.

Both items are guide content, in `docs/`, which I have not touched, per
the file constraint on this task.


