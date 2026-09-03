# Independent verifier — M7 Work 4 finding

Measurements from `01-claims-per-node.out`, `02-profile-matchers.out`, `03-expression-signature.out`, and `04-consolidate-probe.out`. Code cites counted in the files named below, not from header comments.

## Defects

1. CONFIRMED — Every one of the ten Work 3 agreements has M4 claims that share a `source_node_occurrence_ids[0]` (285 shared nodes across 2,101 claims / 1,660 distinct nodes); `generateAnalysisV2` rejects a shared node (`lib/canonical-v2/m7-v2-deterministic-generator.js:2207-2219`), and the contract test lists `two claims share one governed node` as a required `generateAnalysisV2` throw (`tests/stage-2y-structure-m7-v2-repair-contract.test.js:8584-8588`, consumed at `9062-9074`).

2. CONFIRMED — The 1,382 approved profiles expose 1,399 distinct `match_test` word-tokens under the generator `wordTokens` rule (`lib/canonical-v2/m7-v2-deterministic-generator.js:301-303`); none of those tokens occur in any of the ten canonical texts, and the first three no-shop `match_fixtures` use synthetic authored markers such as `familynoshop noshopstandstillconcho63noshopstandstillactionor7494ac72891473d5x`.

3. CONFIRMED — Non-synthetic `compileOccurrence` requires `profile.required_expression_signature === 'ALL_OF(APPLIES_TO,FAMILY_MARKER)'` (`lib/canonical-v2/m7-v2-deterministic-generator.js:1900-1901`); 0 of 1,382 approved profiles carry that signature, and `consolidateAnalysis` does not pass `syntheticExpressionPayloads` (`lib/canonical-v2/agreement-analysis-consolidation.js:625-635`).

## Task 4 first error

```
M7_V2_DETERMINISTIC_GENERATOR: each governed claim must have a unique ID and one unique M2 node
```

## What a “cannot compile a real agreement” claim would miss or overstate

The compiler’s governance plumbing did accept the six real Work 3/4 bindings and handed `06ec3016…` to the generator: the first error is the generator uniqueness rule, not a missing semantic-input binding or a failed source-set seal. A claim that “the compiler cannot ingest real records at all” overstates that.

The same claim understates the later, independently fatal stops that this probe never reached. After uniqueness, every approved matcher token is absent from the ten real texts, and every approved expression signature is one of 1,382 unique non-`ALL_OF(APPLIES_TO,FAMILY_MARKER)` values, so a unique-node rewrite alone would still fail closed. Nothing in this measurement was misread as a refutation.
