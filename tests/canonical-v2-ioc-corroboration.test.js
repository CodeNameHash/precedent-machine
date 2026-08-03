'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESTRICTION_CATEGORY_TO_CONCEPT,
  corroborateRestrictionCategory,
  corroborateThresholdBasis,
} = require('../lib/canonical-v2/native-producer/ioc-corroboration');

test('IOC category map covers the eleven governed categories', () => {
  assert.deepEqual(Object.keys(RESTRICTION_CATEGORY_TO_CONCEPT).sort(), [
    'ACCOUNTING', 'CAPEX', 'CHARTER', 'COMP', 'CONTRACT', 'DEBT',
    'DIVIDEND', 'ISSUE', 'MERGE', 'SETTLE', 'TAX',
  ]);
});

test('single-category quotes corroborate the asserted concept', () => {
  assert.deepEqual(
    corroborateRestrictionCategory({
      quote: 'incur any indebtedness for borrowed money',
      asserted_category: 'DEBT',
    }),
    { outcome: 'RESOLVED', restriction_category: 'DEBT', concept_key: 'IOC-DEBT' },
  );
  assert.deepEqual(
    corroborateRestrictionCategory({
      quote: 'amend any Material Contract',
      asserted_category: 'CONTRACT',
    }),
    { outcome: 'RESOLVED', restriction_category: 'CONTRACT', concept_key: 'IOC-CONTRACT' },
  );
});

test('full-width multi-category limb routes review', () => {
  assert.deepEqual(
    corroborateRestrictionCategory({
      quote: 'amend its certificate of incorporation or bylaws, or declare, set aside or pay any dividend',
      asserted_category: 'CHARTER',
    }),
    {
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_CATEGORY_CORROBORATION',
      matches: ['CHARTER', 'DIVIDEND'],
    },
  );
});

test('label-to-text drift and out-of-enum values cannot resolve', () => {
  assert.deepEqual(
    corroborateRestrictionCategory({ quote: 'amend a Material Contract', asserted_category: 'ACCOUNTING' }),
    { outcome: 'REVIEW', reason: 'CATEGORY_UNCORROBORATED', matches: ['CONTRACT'] },
  );
  assert.deepEqual(
    corroborateRestrictionCategory({ quote: 'make loans or investments', asserted_category: 'INVESTMENT' }),
    { outcome: 'OPEN_WORLD', reason: 'RESTRICTION_CATEGORY_OUT_OF_ENUM' },
  );
});

test('near-miss issuance wording does not make a debt quote ambiguous', () => {
  assert.deepEqual(
    corroborateRestrictionCategory({
      quote: 'incur indebtedness or issue or sell warrants or debt securities',
      asserted_category: 'DEBT',
    }),
    { outcome: 'RESOLVED', restriction_category: 'DEBT', concept_key: 'IOC-DEBT' },
  );
});

test('threshold basis requires one corroborated reading', () => {
  assert.deepEqual(
    corroborateThresholdBasis({ quote: 'not exceeding $250,000 individually', asserted_basis: 'INDIVIDUAL' }),
    { outcome: 'RESOLVED', threshold_basis: 'INDIVIDUAL' },
  );
  assert.deepEqual(
    corroborateThresholdBasis({ quote: '$150,000,000 in the aggregate', asserted_basis: 'AGGREGATE' }),
    { outcome: 'RESOLVED', threshold_basis: 'AGGREGATE' },
  );
  assert.deepEqual(
    corroborateThresholdBasis({ quote: 'in the aggregate $10,000,000 for any single Action', asserted_basis: 'AGGREGATE' }),
    { outcome: 'REVIEW', reason: 'AMBIGUOUS_THRESHOLD_BASIS' },
  );
  assert.deepEqual(
    corroborateThresholdBasis({ quote: '$17,000 per restaurant', asserted_basis: 'INDIVIDUAL' }),
    { outcome: 'REVIEW', reason: 'THRESHOLD_BASIS_UNCORROBORATED' },
  );
});
