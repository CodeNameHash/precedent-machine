# Acceptance spec: WP-EXP-01 — reviewed-slice harness

First packet of `PLAN-CANDIDATE-EXPANSION-2026-07-23.md`, under
`candidate_scope_and_extraction` (unlocked, see docs/certification/).
Programme rules bind: no taxonomy invention, no change to any frozen
contract file, deterministic identities, quarantine for unfamiliar
propositions, no DB access from tests.

## Problem

Each reviewed deal-slice today is a hand-built module
(`lib/canonical-v2/reviewed-no-shop-slice.js`,
`reviewed-qxo-no-shop-slice.js`, `reviewed-termination-fee-slice.js`,
`reviewed-qxo-*-slice.js`, …): several hundred lines that assemble
reviewed payloads into validated claims/relationships/shared rows via
the frozen constructors. Expanding to more deals by copying these
modules would multiply drift risk. The harness extracts the REPEATED
construction mechanics into one tested path, leaving per-deal content as
pure data.

## Deliverable

1. `lib/canonical-v2/reviewed-slice-harness.js` — pure module exporting
   `buildReviewedSlice(input)` where `input` is a plain data object
   (deal key, reviewed source hash/version, sections, parties, reviewed
   payload entries per concept). The harness performs ONLY mechanics the
   existing slice modules already perform via the frozen constructors —
   identity derivation, claim/relationship assembly, row construction,
   validation. It must not add defaults, coerce values, or fill gaps: an
   input lacking anything a frozen constructor requires throws (that is
   the quarantine posture — never guess).
2. Byte-identical replay proof: tests that rebuild AT LEAST the Landos
   termination-fee row and one QXO no-shop row from harness INPUT DATA
   and assert deep-equality (including every digest/identity field)
   against the outputs of the existing hand-built modules. If a
   hand-built module contains a step the harness cannot reproduce
   exactly, the harness is wrong — fix the harness, never the module.
3. The existing slice modules are NOT modified or deleted (they are the
   regression oracles). No production code path switches to the harness
   in this packet; consumers migrate in later packets after the pilot.

## Constraints

- Forbidden files: every existing lib/canonical-v2/* module (read-only
  oracles), docs/codex-program/**, registries, taxonomy. The harness is
  a NEW file plus tests only.
- node:test, no new dependencies, fixtures from __fixtures__ only.
- The harness must be usable for the WP-EXP-02 pilot: its input format
  documented in the module header, one worked example in the tests.

## Battery

Post-commit full `npm test` green; `verify:codex-program` PASS digest
unchanged; build green; `git diff --check` clean.

## Review gates (Fable)

Deep-equality proofs present for both oracle deals; zero writes to
oracle modules; throw-don't-guess proven by tests (missing/unknown input
fields throw); no vocabulary literal in the harness that isn't
structural.
