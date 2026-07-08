const test = require('node:test');
const assert = require('node:assert/strict');

const { FEATURES } = require('../../lib/schema/features');
const { FEATURE_VALUE_TYPES, validateFeatureDef } = require('../../lib/schema/types');

// These 14 keys exist in docs/schema-shape/normalized-v1.json's `entries` (added during
// Phase 0-C reconciliation) but were missing from the generated registry, leaving them
// ungoverned even though app code imports FEATURES from this file. See
// docs/schema-shape/normalized-v1.json and lib/schema/features.js header.
// (absenceNoMAE was dropped as a confirmed duplicate of aocNoMaePresent — both are
// REP-T-NOCHANGE / "Absence of Certain Changes or Events" booleans.)
const RECONCILED_KEYS = [
  'terminationFees',
  'antitrustEffortsStandard',
  'divestitureInCondition',
  'tenderOffer',
  'absenceConductedOrdinaryCourse',
  'absenceSpecifiedIOCReferences',
  'feeExpenseAllocationExceptions',
  'absenceSpecifiedIOCs',
  'party_role',
  'interveningEventExceptions',
  'notificationCovenantFailureStandard',
  'buyerEffortsCap',
  'targetEffortsCap',
  'nominalTargetParty',
];

test('all 14 reconciliation-added keys are present in FEATURES', () => {
  for (const key of RECONCILED_KEYS) {
    assert.ok(key in FEATURES, `${key} missing from FEATURES`);
  }
});

test('each reconciled key has a non-empty label and a valid valueType', () => {
  for (const key of RECONCILED_KEYS) {
    const feature = FEATURES[key];
    assert.ok(feature, `${key} missing from FEATURES`);
    assert.equal(feature.key, key);
    assert.ok(typeof feature.label === 'string' && feature.label.length > 0, `${key} needs a non-empty label`);
    assert.ok(FEATURE_VALUE_TYPES.has(feature.valueType), `${key} has invalid valueType ${feature.valueType}`);
  }
});

test('each reconciled key passes the full FeatureDef shape validator', () => {
  for (const key of RECONCILED_KEYS) {
    const errors = validateFeatureDef(FEATURES[key]);
    assert.deepEqual(errors, [], `${key}: ${JSON.stringify(errors)}`);
  }
});

test('enum-valued reconciled keys carry their authoritative enumSet', () => {
  assert.deepEqual(FEATURES.antitrustEffortsStandard.enumSet, [
    'best-efforts',
    'commercially-reasonable-efforts',
    'flat',
    'good-faith-efforts',
    'reasonable-best-efforts',
    'reasonable-efforts',
  ]);
  assert.deepEqual(FEATURES.notificationCovenantFailureStandard.enumSet, [
    'ALL_IN_MATERIAL_RESPECTS',
    'EACH_IN_MATERIAL_RESPECTS',
    'HYBRID',
  ]);
});
