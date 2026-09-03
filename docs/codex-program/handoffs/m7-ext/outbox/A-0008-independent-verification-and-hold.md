id: A-0008
from: lead
to: ext
date: 2026-09-03
re: Ben's direction after A-0007; independent verification task; hold Work 6
status: OPEN (answer as Q-0006)

# Direction from Ben

Ben has read A-0007's finding and rejected "a quick packet". His words in
substance: he wants a system that works end to end, to publication, with no
false-complete step. The lead is running an exhaustive diagnosis and
re-plan now (multi-agent, adversarially verified). You will receive the
plan and your work items as A-0009 when it lands, expected within hours.
Ben says you now poll every 5 minutes; I will answer at that cadence while
this is live.

# Hold

- `ext/m7-w6-audit`: stop where you are. Commit and push what exists so it
  is not lost; do not start the four remaining reports. Their spec may
  change under the re-plan.
- `ext/m7-w5-renderer`: do not start.
- Do not rebase or delete anything.

# Task now: independent cross-vendor verification (Q-0006)

Ben doubted the finding, so it needs a second opinion that shares no
context with mine. Do this from your own reading, not from my note. Use a
fresh session for the verifier if you can.

Reproduce or refute each of the three defects, with a script and its exact
output for each. Work read-only; write scripts and outputs under a new
branch `ext/m7-verify-finding` from `059c47d2`, under
`docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/` only.

1. **Claims per node.** For each of the ten agreements bound by
   `control/m7-v2-repair-work3-agreement-analysis-set.json`, count M4
   claims, distinct `source_node_occurrence_ids[0]`, and nodes carrying
   two or more claims. Then read `lib/canonical-v2/m7-v2-deterministic-generator.js`
   near `generateAnalysisV2` and state whether the generator accepts a node
   shared by two claims, citing lines. Confirm or deny that
   `tests/stage-2y-structure-m7-v2-repair-contract.test.js` lists "two
   claims share one governed node" as a required rejection.
2. **Profile matchers.** From `control/m7-v2-repair-family-work3-approved-profile-set.json`,
   collect every `match_test.tokens` value across the 1,382 profiles. Using
   the generator's own tokeniser rule (`wordTokens`: NFKC, lowercase,
   `[\p{L}\p{N}]+`), test whether each token occurs in any of the ten
   canonical texts (`source_binding.canonical_text` in the M2 index files
   bound by `control/m7-v2-repair-work3-agreement-index-set.json`; 4.6 MB
   each, read by script). Report the count of tokens present. Then look at
   three `match_fixtures` in any family package and report what
   `authored_unit_source_text` contains.
3. **Expression signature.** State what `compileOccurrence` requires of
   `profile.required_expression_signature` outside a synthetic payload,
   count approved profiles whose signature equals that value, and confirm
   or deny that `consolidateAnalysis` in
   `lib/canonical-v2/agreement-analysis-consolidation.js` passes any
   `syntheticExpressionPayloads`.

Then, separately: the compiler's governance plumbing does work on real
inputs up to the generator (I got that far). Confirm by driving
`consolidateAnalysis` on agreement `06ec3016…` with the governance record
built from the successor manifest's `candidate_registration_binding`
(roles: COMPILER, DETERMINISTIC_GENERATOR, CONTRACT_VALIDATOR;
`semantic_input_bindings` mapped from `input_role` to `role`) and report
the first error message verbatim.

Deliver Q-0006 with: verdict per defect (CONFIRMED / REFUTED / PARTLY, one
sentence each), the scripts, their outputs, and anything you found that I
did not. If you refute any part, say exactly what I misread.

# Second task, lower priority, same branch: real-text capability inventory

Independently of my agents: list every component in `lib/` that today
produces typed facts or classifications from real agreement text (the 25
section-family extractors, `lib/rubric.js`, the canonical-v2 M2/M3/M4
modules, `m7-deterministic-generalisation.js`, the family compound
adapter), with its input, output schema, and how it was validated (real
files or fixtures). Where their outputs for the ten agreements live. This
is the reuse map; CLAUDE.md says the project forgets what it built, so
count cases in code, do not trust headers.

Acceptance: a markdown table plus the scripts you used, on the same
branch, delivered as Q-0007.
