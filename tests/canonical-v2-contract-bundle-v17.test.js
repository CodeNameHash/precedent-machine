'use strict';

/**
 * tests/canonical-v2-contract-bundle-v17.test.js
 *
 * Acceptance test 3 (docs/superpowers/specs/2026-08-02-family-termination-
 * rights-design.md, section 6): V17 compiles; V16 arrays are untouched
 * byte-for-byte; both new concepts and all three new claim definitions
 * validate with zero validator changes; EXPECTED_CONCEPT_KEYS_V5
 * superset-diff test AND EXPECTED_CLAIM_KEYS_V17 superset-diff test (audit
 * m-4).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_INPUT_V16,
  FIXTURE_CONTRACT_INPUT_V17,
  FIXTURE_CONTRACT_FINGERPRINT_V16,
  FIXTURE_CONTRACT_FINGERPRINT_V17,
  FIXTURE_CONTRACT_FINGERPRINTS,
  TERMINATION_RIGHT_GRANT_CLAIM_DEFINITION_V1,
  TERMINATION_OUTSIDE_DATE_CLAIM_DEFINITION_V1,
  TERMINATION_CURE_PERIOD_DAYS_CLAIM_DEFINITION_V1,
  compileFixtureContract,
  compileFixtureContractV16,
  compileFixtureContractV17,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

test('TERMINATION_RIGHT_GRANT_CLAIM_DEFINITION_V1 matches the pinned shape (presence claim, KNOWLEDGE_QUALIFIER-style)', () => {
  assert.deepEqual(TERMINATION_RIGHT_GRANT_CLAIM_DEFINITION_V1, {
    claim_definition_key: 'TERMINATION_RIGHT_GRANT',
    version: 1,
    allowed_canonical_values: [true],
    canonical_value_required_when_present: true,
  });
});

test('TERMINATION_OUTSIDE_DATE_CLAIM_DEFINITION_V1 matches the pinned shape', () => {
  assert.deepEqual(TERMINATION_OUTSIDE_DATE_CLAIM_DEFINITION_V1, {
    claim_definition_key: 'TERMINATION_OUTSIDE_DATE',
    version: 1,
    canonical_value_type: 'ISO_8601_DATE_STRING',
    canonical_value_required_when_present: true,
  });
});

test('TERMINATION_CURE_PERIOD_DAYS_CLAIM_DEFINITION_V1 matches the pinned shape', () => {
  assert.deepEqual(TERMINATION_CURE_PERIOD_DAYS_CLAIM_DEFINITION_V1, {
    claim_definition_key: 'TERMINATION_CURE_PERIOD_DAYS',
    version: 1,
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    canonical_value_required_when_present: true,
  });
});

test('V17 compiles, validates, and equals compileFixtureContract(FIXTURE_CONTRACT_INPUT_V17)', () => {
  const bundle = compileFixtureContractV17();
  assert.equal(validateContractBundle(bundle), true);
  assert.equal(
    canonicalJson(bundle),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V17)),
  );
  assert.equal(bundle.fingerprint, FIXTURE_CONTRACT_FINGERPRINT_V17);
});

test('V17 concepts are exactly V16 plus TERMR-MUTUAL and TERMR-LEGAL (superset-diff by content)', () => {
  const v16Keys = FIXTURE_CONTRACT_INPUT_V16.concepts.map((entry) => entry.concept_key).sort();
  const v17Keys = FIXTURE_CONTRACT_INPUT_V17.concepts.map((entry) => entry.concept_key).sort();
  const added = v17Keys.filter((key) => !v16Keys.includes(key));
  const removed = v16Keys.filter((key) => !v17Keys.includes(key));
  assert.deepEqual(added.sort(), ['TERMR-LEGAL', 'TERMR-MUTUAL']);
  assert.deepEqual(removed, []);
  for (const key of ['TERMR-MUTUAL', 'TERMR-LEGAL']) {
    const entry = FIXTURE_CONTRACT_INPUT_V17.concepts.find((row) => row.concept_key === key);
    assert.deepEqual(entry, { concept_key: key, version: 1 });
  }
});

test('V17 claim_definitions are exactly V16 plus the three new termination-right claim definitions (superset-diff by content)', () => {
  const v16Keys = FIXTURE_CONTRACT_INPUT_V16.claim_definitions.map((e) => e.claim_definition_key).sort();
  const v17Keys = FIXTURE_CONTRACT_INPUT_V17.claim_definitions.map((e) => e.claim_definition_key).sort();
  const added = v17Keys.filter((key) => !v16Keys.includes(key));
  const removed = v16Keys.filter((key) => !v17Keys.includes(key));
  assert.deepEqual(added.sort(), ['TERMINATION_CURE_PERIOD_DAYS', 'TERMINATION_OUTSIDE_DATE', 'TERMINATION_RIGHT_GRANT'].sort());
  assert.deepEqual(removed, []);
});

test('V17 is byte-identical to V16 in every field except concepts, claim_definitions and fingerprint', () => {
  const v16 = compileFixtureContractV16();
  const v17 = compileFixtureContractV17();
  const stable = (bundle) => {
    const {
      concepts: _concepts, claim_definitions: _claims, fingerprint: _fingerprint, ...rest
    } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(stable(v16)), canonicalJson(stable(v17)));
});

test('F1 through F17 are distinct recognised fixture contract fingerprints', () => {
  assert.notEqual(FIXTURE_CONTRACT_FINGERPRINT_V16, FIXTURE_CONTRACT_FINGERPRINT_V17);
  assert.ok(FIXTURE_CONTRACT_FINGERPRINTS.includes(FIXTURE_CONTRACT_FINGERPRINT_V17));
});

test('no canonical value type or validator changes: V17\'s three new definitions use only pre-existing canonical_value_type/allowed_canonical_values shapes', () => {
  assert.equal(TERMINATION_OUTSIDE_DATE_CLAIM_DEFINITION_V1.canonical_value_type, 'ISO_8601_DATE_STRING');
  assert.equal(TERMINATION_CURE_PERIOD_DAYS_CLAIM_DEFINITION_V1.canonical_value_type, 'NON_NEGATIVE_DECIMAL_STRING');
  assert.deepEqual(TERMINATION_RIGHT_GRANT_CLAIM_DEFINITION_V1.allowed_canonical_values, [true]);
});
