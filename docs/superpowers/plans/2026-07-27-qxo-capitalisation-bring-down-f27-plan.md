# QXO capitalisation and bring-down F27 implementation plan

## Outcome

Produce one inactive, source-backed QXO Capital Structure representation result
that combines section 3.1(b), both applicable section 5.2(a)(ii) accuracy
groups, the dated-representation proviso and De Minimis Inaccuracies.

The result exposes two legally distinct market comparison classes through one
shared row contract. It retains the 17 April 2026 measurement date as one
calendar day before signing, folds the three buyer-side entities into one
`BUYER_GROUP`, and records no general knowledge, materiality or lookback
qualifier.

## Task 1: freeze V13 without changing V1 through V12

1. Add V13 as an append-only successor in
   `lib/canonical-v2/contract-bundle.js`.
2. Add the measurement-date, materiality-qualifier and retrospective-lookback
   claim definitions with closed value/state contracts.
3. Add the capitalisation semantic schema, typed `BRINGS_DOWN` and
   `USES_DEFINITION` effects, V2 result definition and one accuracy metric with
   two comparison classes.
4. Extend exact version-shape validation and exports.
5. Test exact V1 through V12 fingerprints and V13 rejection of unknown claims,
   codes, classes, effects and parties.

## Task 2: close the source and parser projection

1. Reuse the immutable QXO document admission and existing canonical source.
2. Bind parser proposals for sections 3.1(b) and 5.2(a)(ii), including clauses
   (B), (C), the proviso and the De Minimis definition.
3. Prove `PARSER_V2_TEXT_LAYERS/V1` removes the standalone page line `16` from
   clean text while retaining its source mapping.
4. Prove the Company Equity Rights text remains continuous in parser output and
   ordinary inline legal numbers remain intact.
5. Preserve exact source tokens for Parent, Titanium Merger Sub and Forward
   Merger Sub.

## Task 3: build the reviewed semantic graph

1. Create one target Capital Structure representation, five ordered
   representation limbs, one buyer-group closing condition and two ordered
   accuracy groups.
2. Bind limbs (i) and (iii) only to clause (B).
3. Bind limbs (ii), (iv) and (v) only to clause (C).
4. Add the two accuracy claims and typed `BRINGS_DOWN` effects.
5. Bind De Minimis Inaccuracies and the Company fully diluted equity
   denominator only to clause (B).
6. Apply the dated-representation proviso to both groups.
7. Record the measurement date, signing date and `-1 CALENDAR_DAY` derivation.
8. Certify complete-scope absence of general knowledge, general materiality and
   retrospective lookback.
9. Preserve limb (iv)’s outside-investment materiality threshold as limb
   substance, not a general qualifier.

## Task 4: compose and serve one result

1. Compose `TARGET_CAPITALISATION_BRING_DOWN/V2` with clause (B) and clause (C)
   as required primary subrows.
2. Add measurement date and three qualifier states as contextual subrows.
3. Add exact-detail references for limbs, accuracy clauses, proviso,
   definition and denominator derivation.
4. Add two exact metric admissions under one
   `REPRESENTATION_ACCURACY_STANDARD/V2` metric.
5. Create compact inactive observations keyed by release, deal, concept,
   metric, class and `BUYER_GROUP`.
6. Compile both comparison classes into one bounded, set-based request with
   exact QXO self-exclusion and a release-aware cache key.
7. Permit one cache miss RPC and zero cache-hit RPCs, with no immediate retry.

## Task 5: prove four-surface parity and local failure isolation

1. Build one compact fixture from the shared provision row.
2. Bind Review, Corpus Context, Compare and Query to identical row bytes.
3. Use “clause (B) group” and “clause (C) group” in all new output. Do not
   expose the legacy Tier B/Tier C shorthand.
4. Show subject-deal terms first and provision prevalence only as secondary
   context.
5. Damage each primary and contextual subrow in turn. Only the damaged row and
   its dependants may be suppressed.
6. Distinguish absent, failed, unresolved, non-comparable and feature-disabled
   states. Never collapse them into generic `No market data`.

## Task 6: staging-only proof

1. Use only `deal-corpus-canonical-v2-staging`.
2. Validate all identities locally before database access.
3. Insert the compact candidate artefacts using one bounded set-based statement
   inside a short transaction with statement and lock timeouts.
4. Query the inactive release using one bounded read.
5. Roll back unconditionally and prove the active pointer, tables and row
   counts are unchanged.
6. Emit only a compact attestation with identities and counts, never source
   text or credentials.

## Task 7: verification and delivery

1. Run focused F27 tests after each task.
2. Run the full test suite, production build, programme checks and F27
   allowlist.
3. Run extra-high adversarial architecture and legal-semantic reviews in
   parallel.
4. Fix every material finding and rerun affected checks.
5. Commit only F27 files. Preserve
   `docs/codex-program/engine-build-map.md` untouched.
6. Push, merge after CI, deploy `deal-corpus` and smoke-test the disabled
   production APIs.
7. Keep all production feature flags and active-release pointers closed.
