# Spec: versioned contract inputs (unblocks concept minting)

Problem proven 2026-07-23: adding Ben's four approved concepts to the
single module-global FIXTURE_CONTRACT_INPUT moves the compiled
fingerprint under every reviewed-slice module, invalidating ~18 files'
pinned digests including the protected Landos oracle (142+ failures).

Principle: a reviewed artifact is bound to the contract it was reviewed
under, forever. Vocabulary growth must never move past reviews' digests.

## Design

- `contract-bundle.js` gains `FIXTURE_CONTRACT_INPUT_V1` (the EXACT
  current input, frozen — byte-identical, compiles to F1
  `56da82be…` forever, pinned by test) and `FIXTURE_CONTRACT_INPUT_V2`
  (V1 + the four Ben-approved concepts: TERMR-NOSOL-BREACH termination
  right for material breach of the no-solicitation covenant;
  TERMR-BREACH general covenant/representation breach termination right,
  bring-down/MAE-gated; TERMR-NOVOTE stockholder-vote-failure termination
  right; TERMR-OUTSIDE outside-date termination right — entry shape
  copied from TERMR-RECOMMEND's).
- `compileFixtureContract()` DEFAULT UNCHANGED (V1) so every existing
  reviewed module and test needs zero edits and every existing digest is
  provably immobile. `compileFixtureContract({ version: 'V2' })` (or an
  exported `compileFixtureContractV2()`) compiles F2. Concept-key
  validation (`EXPECTED_CONCEPT_KEYS`) becomes per-version.
- New pinned test: F1 unchanged under default compile; F2 value pinned
  once computed; V2 is a strict superset of V1 except the four
  additions (deep-diff test proving nothing else moved).
- QXO termination fixture re-keys to the approved concepts and compiles
  under V2; its tests updated; the 'reported reuse' warning block
  removed. Serving already tolerates the divergence (step 1, merged).
- Candidate building for the future QXO termination release uses V2;
  nothing activates without Ben (unchanged).

## Bounds

No edits to any reviewed-*-slice.js module or its tests. No edits to the
harness. Frozen F1 input must be byte-identical to today's (test-proven,
not asserted). Full battery post-commit; Fable review; live-path retest
after merge.
