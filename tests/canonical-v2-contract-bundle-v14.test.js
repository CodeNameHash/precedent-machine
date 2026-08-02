'use strict';

/**
 * tests/canonical-v2-contract-bundle-v14.test.js
 *
 * Acceptance test 2 (docs/superpowers/specs/2026-08-02-p1-captable-
 * numerics-design.md, section 5): V14 compiles; V13 arrays are untouched
 * byte-for-byte; both new definitions validate with zero validator changes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_INPUT_V13,
  FIXTURE_CONTRACT_INPUT_V14,
  FIXTURE_CONTRACT_FINGERPRINT_V13,
  FIXTURE_CONTRACT_FINGERPRINT_V14,
  FIXTURE_CONTRACT_FINGERPRINTS,
  CAPITALIZATION_SHARE_COUNT_CLAIM_DEFINITION_V1,
  RESERVED_SHARE_POOL_CLAIM_DEFINITION_V1,
  compileFixtureContract,
  compileFixtureContractV13,
  compileFixtureContractV14,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

test('CAPITALIZATION_SHARE_COUNT_CLAIM_DEFINITION_V1 matches the pinned shape', () => {
  assert.deepEqual(CAPITALIZATION_SHARE_COUNT_CLAIM_DEFINITION_V1, {
    claim_definition_key: 'CAPITALIZATION_SHARE_COUNT',
    version: 1,
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    canonical_value_required_when_present: true,
  });
});

test('RESERVED_SHARE_POOL_CLAIM_DEFINITION_V1 matches the pinned shape', () => {
  assert.deepEqual(RESERVED_SHARE_POOL_CLAIM_DEFINITION_V1, {
    claim_definition_key: 'RESERVED_SHARE_POOL',
    version: 1,
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    canonical_value_required_when_present: true,
  });
});

test('FIXTURE_CONTRACT_INPUT_V14 is a strictly additive spread of V13: claim_definitions gains exactly two entries, everything else byte-identical', () => {
  const { claim_definitions: v13Claims, ...v13Rest } = FIXTURE_CONTRACT_INPUT_V13;
  const { claim_definitions: v14Claims, ...v14Rest } = FIXTURE_CONTRACT_INPUT_V14;
  assert.equal(canonicalJson(v13Rest), canonicalJson(v14Rest), 'every field other than claim_definitions is byte-identical to V13');
  assert.equal(v14Claims.length, v13Claims.length + 2);
  assert.deepEqual(v14Claims.slice(0, v13Claims.length), v13Claims, 'V13 claim_definitions are untouched, byte-for-byte, in their original order');
  assert.deepEqual(v14Claims[v13Claims.length], CAPITALIZATION_SHARE_COUNT_CLAIM_DEFINITION_V1);
  assert.deepEqual(v14Claims[v13Claims.length + 1], RESERVED_SHARE_POOL_CLAIM_DEFINITION_V1);
});

test('V14 compiles, validates, and produces a distinct, stable fingerprint from V13', () => {
  const compiled = compileFixtureContractV14();
  validateContractBundle(compiled);
  assert.equal(compiled.fingerprint, FIXTURE_CONTRACT_FINGERPRINT_V14);
  assert.notEqual(FIXTURE_CONTRACT_FINGERPRINT_V14, FIXTURE_CONTRACT_FINGERPRINT_V13);
  assert.equal(
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V14)),
    canonicalJson(compiled),
    'compileFixtureContract(FIXTURE_CONTRACT_INPUT_V14) is equivalent to compileFixtureContractV14()',
  );
});

test('V13 compiled via compileFixtureContractV13() is completely unaffected by V14 existing', () => {
  const v13 = compileFixtureContractV13();
  assert.equal(v13.fingerprint, FIXTURE_CONTRACT_FINGERPRINT_V13);
});

test('the compiled V14 bundle exposes both new claim definitions by key with no validator changes required (zero-validator-change pin)', () => {
  const compiled = compileFixtureContractV14();
  const claimDefs = compiled.claim_definitions instanceof Map
    ? compiled.claim_definitions
    : new Map(compiled.claim_definitions.map((entry) => [entry.claim_definition_key, entry]));
  assert.ok(claimDefs.has('CAPITALIZATION_SHARE_COUNT'));
  assert.ok(claimDefs.has('RESERVED_SHARE_POOL'));
});

test('FIXTURE_CONTRACT_FINGERPRINTS includes V14 alongside every prior version', () => {
  assert.ok(FIXTURE_CONTRACT_FINGERPRINTS.includes(FIXTURE_CONTRACT_FINGERPRINT_V14));
  assert.ok(FIXTURE_CONTRACT_FINGERPRINTS.includes(FIXTURE_CONTRACT_FINGERPRINT_V13));
});
