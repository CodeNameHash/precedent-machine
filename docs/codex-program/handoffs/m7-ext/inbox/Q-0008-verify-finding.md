id: Q-0008
from: ext
to: lead
date: 2026-09-03
re: A-0008 / A-0009 independent verification
status: ANSWERED

# Delivery: independent verification of the three real-text compile defects

Branch: `ext/m7-verify-finding` @ `6133a359`, from `059c47d2`.
Scratch only: `docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/`.
Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/487

Measurements were scripted on this branch. I re-ran `01`–`04` after the verifier session; stdout matched the committed `.out` files. Cited generator and contract-test lines were read in the files named below.

## Verdicts

1. **CONFIRMED** — All ten Work 3 agreements share governed nodes (2,101 claims / 1,660 distinct `source_node_occurrence_ids[0]` / 285 shared nodes). `generateAnalysisV2` rejects a shared node at `lib/canonical-v2/m7-v2-deterministic-generator.js:2207-2219`. The contract test lists `two claims share one governed node` as a required throw at `tests/stage-2y-structure-m7-v2-repair-contract.test.js:8584-8588` (consumed at `9062-9074`).
2. **CONFIRMED** — 1,382 profiles, 1,399 distinct matcher tokens under the generator `wordTokens` rule; **0** occur in any of the ten canonical texts. Three no-shop `match_fixtures` use synthetic authored markers such as `familynoshop noshopstandstillconcho63noshopstandstillactionor7494ac72891473d5x`.
3. **CONFIRMED** — Non-synthetic `compileOccurrence` requires `ALL_OF(APPLIES_TO,FAMILY_MARKER)` at `lib/canonical-v2/m7-v2-deterministic-generator.js:1900-1901` after the synthetic-payload branch. **0** of 1,382 profiles have that signature. `consolidateAnalysis` does not pass `syntheticExpressionPayloads` (`lib/canonical-v2/agreement-analysis-consolidation.js:625-635`).

## Task 4 first error (verbatim)

```
M7_V2_DETERMINISTIC_GENERATOR: each governed claim must have a unique ID and one unique M2 node
```

Governance plumbing accepted the six real bindings. The first stop is the generator uniqueness rule, not a missing semantic-input binding.

## What the “cannot compile a real agreement” claim overstates or understates

It overstates ingest: real Work 3/4 bindings reach the generator. It understates later independent stops this probe never reached: after uniqueness, every matcher token is absent from the ten texts and every expression signature is non-`ALL_OF(APPLIES_TO,FAMILY_MARKER)`. A unique-node rewrite alone would still fail closed.

Nothing in the three defects was refuted.

## Artefacts

`01-claims-per-node.mjs` / `.out`
`02-profile-matchers.mjs` / `.out`
`03-expression-signature.mjs` / `.out`
`04-consolidate-probe.mjs` / `.out`
`VERDICTS.md`

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/01-claims-per-node.mjs > /tmp/v01.out; echo $?
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/02-profile-matchers.mjs > /tmp/v02.out; echo $?
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/03-expression-signature.mjs > /tmp/v03.out; echo $?
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/04-consolidate-probe.mjs > /tmp/v04.out; echo $?
```

Each exit `0`. Re-run stdout matched the committed files.
