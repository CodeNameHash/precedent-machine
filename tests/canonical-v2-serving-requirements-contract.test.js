// tests/canonical-v2-serving-requirements-contract.test.js
//
// Plan Task 5 / spec section 3 + section 5's three serving rulings (Ben,
// 2026-08-01): the not-comparable count surface, the all-with-warnings
// default with one switch, and warning-exposure logging. This test is the
// anti-drop mechanism the plan calls for -- "asserts the three requirements
// exist as typed constants the serving slice must consume; fails if any is
// removed" -- so it fails LOUD if a future edit silently drops one, and
// pins the content address so a silent CONTENT change is caught too.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');

const CONTRACT_PATH = path.join(
  __dirname,
  '..',
  'contracts',
  'serving-requirements',
  'claim-provenance-serving-contract.v1.json',
);

// eslint-disable-next-line global-require, import/no-dynamic-require
const contract = require(CONTRACT_PATH);

const REQUIRED_REQUIREMENT_IDS = Object.freeze([
  // Spec section 3: "Any cross-deal date query MUST surface the count of
  // deals it could not compare ... -- silent omission is forbidden."
  'CROSS_DEAL_DATE_QUERY_MUST_SURFACE_NOT_COMPARABLE_COUNT',
  // Spec section 5: "'all results, with warnings' while the VERIFIED set is
  // small, with exactly one clear control to switch to 'verified only'."
  'SEARCH_DEFAULT_ALL_RESULTS_WITH_WARNINGS_ONE_SWITCH',
  // Spec section 5: "Warning-exposure should be logged so warning fatigue
  // ... becomes measurable rather than assumed."
  'WARNING_EXPOSURE_MUST_BE_LOGGED',
]);

test('the contract file is schema-versioned and content-addressed', () => {
  assert.equal(contract.schema_version, 'CLAIM_PROVENANCE_SERVING_CONTRACT/V1');
  assert.equal(typeof contract.version, 'number');
  assert.ok(Array.isArray(contract.requirements));
  const { claim_provenance_serving_contract_id: storedId, ...body } = contract;
  const recomputed = contentId(contract.schema_version, body);
  assert.equal(storedId, recomputed, 'the stored content id must match a fresh contentId() over the body');
});

test('all three of Ben\'s serving rulings are present as typed requirement_id constants', () => {
  const presentIds = new Set(contract.requirements.map((entry) => entry.requirement_id));
  for (const requiredId of REQUIRED_REQUIREMENT_IDS) {
    assert.ok(presentIds.has(requiredId), `serving contract is missing required ruling: ${requiredId}`);
  }
  assert.equal(contract.requirements.length, REQUIRED_REQUIREMENT_IDS.length,
    'the contract must carry EXACTLY the three governed rulings -- not fewer (a silent drop) and not more (an unruled addition)');
});

test('every requirement entry carries a non-empty statement and Ben as the ruler on 2026-08-01', () => {
  for (const entry of contract.requirements) {
    assert.equal(typeof entry.statement, 'string');
    assert.ok(entry.statement.length > 0);
    assert.equal(entry.ruled_by, 'Ben');
    assert.equal(entry.ruling_date, '2026-08-01');
  }
});

test('the not-comparable-count requirement statement is the exact silent-omission-forbidden rule', () => {
  const entry = contract.requirements.find(
    (item) => item.requirement_id === 'CROSS_DEAL_DATE_QUERY_MUST_SURFACE_NOT_COMPARABLE_COUNT',
  );
  assert.ok(entry);
  assert.match(entry.statement, /cross-deal date query/i);
  assert.match(entry.statement, /not comparable/i);
  assert.match(entry.statement, /forbidden/i);
});

test('the search-default requirement statement names both the default and the single switch', () => {
  const entry = contract.requirements.find(
    (item) => item.requirement_id === 'SEARCH_DEFAULT_ALL_RESULTS_WITH_WARNINGS_ONE_SWITCH',
  );
  assert.ok(entry);
  assert.match(entry.statement, /all results, with warnings/i);
  assert.match(entry.statement, /verified only/i);
});

test('the warning-exposure requirement statement requires logging', () => {
  const entry = contract.requirements.find((item) => item.requirement_id === 'WARNING_EXPOSURE_MUST_BE_LOGGED');
  assert.ok(entry);
  assert.match(entry.statement, /logged/i);
});
