'use strict';

/**
 * tests/canonical-v2-contract-bundle-v15.test.js
 *
 * Acceptance test 3 (docs/superpowers/specs/2026-08-02-family-termination-
 * fee-design.md, section 6): V15 compiles; V14 arrays are untouched
 * byte-for-byte; all three new definitions validate with zero validator
 * changes; the trigger enum equals the six TERMINATION_FEE_TRIGGER_PATH/V2
 * codes plus SUPERIOR_PROPOSAL_TERMINATION exactly (content, not the
 * numeral -- the openworld-promotion-program spec's own pin: "write
 * superset-diff acceptance tests against CONTENT (sorted key sets), never
 * the numeral", because this slice is first in merge order for the frozen
 * V15 slot and a sibling slice could otherwise claim the same number).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_INPUT_V14,
  FIXTURE_CONTRACT_INPUT_V15,
  FIXTURE_CONTRACT_FINGERPRINT_V14,
  FIXTURE_CONTRACT_FINGERPRINT_V15,
  FIXTURE_CONTRACT_FINGERPRINTS,
  TERMINATION_FEE_AMOUNT_CLAIM_DEFINITION_V1,
  TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1,
  TERMINATION_FEE_TAIL_PERIOD_MONTHS_CLAIM_DEFINITION_V1,
  TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2,
  compileFixtureContract,
  compileFixtureContractV14,
  compileFixtureContractV15,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

test('TERMINATION_FEE_AMOUNT_CLAIM_DEFINITION_V1 matches the pinned shape', () => {
  assert.deepEqual(TERMINATION_FEE_AMOUNT_CLAIM_DEFINITION_V1, {
    claim_definition_key: 'TERMINATION_FEE_AMOUNT',
    version: 1,
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    canonical_value_required_when_present: true,
  });
});

test('TERMINATION_FEE_TAIL_PERIOD_MONTHS_CLAIM_DEFINITION_V1 matches the pinned shape', () => {
  assert.deepEqual(TERMINATION_FEE_TAIL_PERIOD_MONTHS_CLAIM_DEFINITION_V1, {
    claim_definition_key: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS',
    version: 1,
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    canonical_value_required_when_present: true,
  });
});

test('TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1: enum equals the six trigger-path codes plus SUPERIOR_PROPOSAL_TERMINATION exactly (content diff, drift is loud)', () => {
  assert.equal(TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1.claim_definition_key, 'TERMINATION_FEE_TRIGGER');
  assert.equal(TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1.version, 1);
  assert.equal(TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1.canonical_value_required_when_present, true);

  const pathCodes = [...TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2.allowed_trigger_codes];
  const claimCodes = [...TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1.allowed_canonical_values];
  const expectedSuperset = [...pathCodes, 'SUPERIOR_PROPOSAL_TERMINATION'].sort();
  assert.deepEqual([...claimCodes].sort(), expectedSuperset);
  // Every trigger-path code is present in the claim enum (superset, never a
  // parallel vocabulary) -- checked by set membership, not array order.
  for (const code of pathCodes) {
    assert.ok(claimCodes.includes(code), `trigger-path code ${code} missing from the claim enum`);
  }
  assert.ok(claimCodes.includes('SUPERIOR_PROPOSAL_TERMINATION'));
  assert.equal(claimCodes.length, pathCodes.length + 1, 'exactly one addition over the trigger-path codes');
});

test('FIXTURE_CONTRACT_INPUT_V15 is a strictly additive spread of V14: claim_definitions gains exactly three entries, everything else byte-identical', () => {
  const { claim_definitions: v14Claims, ...v14Rest } = FIXTURE_CONTRACT_INPUT_V14;
  const { claim_definitions: v15Claims, ...v15Rest } = FIXTURE_CONTRACT_INPUT_V15;
  assert.equal(canonicalJson(v14Rest), canonicalJson(v15Rest), 'every field other than claim_definitions is byte-identical to V14');
  assert.equal(v15Claims.length, v14Claims.length + 3);
  assert.deepEqual(v15Claims.slice(0, v14Claims.length), v14Claims, 'V14 claim_definitions are untouched, byte-for-byte, in their original order');

  // Content superset check (sorted key sets), never a positional/numeral
  // pin -- the openworld-promotion-program's own merge-order convention.
  const addedKeys = v15Claims.slice(v14Claims.length).map((d) => d.claim_definition_key).sort();
  assert.deepEqual(addedKeys, [
    'TERMINATION_FEE_AMOUNT',
    'TERMINATION_FEE_TAIL_PERIOD_MONTHS',
    'TERMINATION_FEE_TRIGGER',
  ]);
});

test('V15 compiles, validates, and produces a distinct, stable fingerprint from V14', () => {
  const compiled = compileFixtureContractV15();
  validateContractBundle(compiled);
  assert.equal(compiled.fingerprint, FIXTURE_CONTRACT_FINGERPRINT_V15);
  assert.notEqual(FIXTURE_CONTRACT_FINGERPRINT_V15, FIXTURE_CONTRACT_FINGERPRINT_V14);
  assert.equal(
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V15)),
    canonicalJson(compiled),
    'compileFixtureContract(FIXTURE_CONTRACT_INPUT_V15) is equivalent to compileFixtureContractV15()',
  );
});

test('V14 compiled via compileFixtureContractV14() is completely unaffected by V15 existing', () => {
  const v14 = compileFixtureContractV14();
  assert.equal(v14.fingerprint, FIXTURE_CONTRACT_FINGERPRINT_V14);
});

test('the compiled V15 bundle exposes all three new claim definitions by key with no validator changes required (zero-validator-change pin)', () => {
  const compiled = compileFixtureContractV15();
  const claimDefs = compiled.claim_definitions instanceof Map
    ? compiled.claim_definitions
    : new Map(compiled.claim_definitions.map((entry) => [entry.claim_definition_key, entry]));
  assert.ok(claimDefs.has('TERMINATION_FEE_AMOUNT'));
  assert.ok(claimDefs.has('TERMINATION_FEE_TAIL_PERIOD_MONTHS'));
  assert.ok(claimDefs.has('TERMINATION_FEE_TRIGGER'));
});

test('FIXTURE_CONTRACT_FINGERPRINTS includes V15 alongside every prior version', () => {
  assert.ok(FIXTURE_CONTRACT_FINGERPRINTS.includes(FIXTURE_CONTRACT_FINGERPRINT_V15));
  assert.ok(FIXTURE_CONTRACT_FINGERPRINTS.includes(FIXTURE_CONTRACT_FINGERPRINT_V14));
});
