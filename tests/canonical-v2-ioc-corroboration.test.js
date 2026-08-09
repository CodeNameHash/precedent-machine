'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { IOC_CATEGORIES_CANONICAL } = require('../lib/vocab/ioc-categories');
const {
  RESTRICTION_CATEGORY_TO_CONCEPT,
  SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE,
  normaliseRestrictionCategory,
  corroborateRestrictionCategory,
  corroborateThresholdBasis,
} = require('../lib/canonical-v2/native-producer/ioc-corroboration');

const V1_CATEGORY_KEYS = IOC_CATEGORIES_CANONICAL.map((entry) => entry.key).sort();

test('IOC category map covers all twenty-five V1 canonical categories', () => {
  assert.deepEqual(Object.keys(RESTRICTION_CATEGORY_TO_CONCEPT).sort(), V1_CATEGORY_KEYS);
});

test('single-category quotes corroborate the asserted concept', () => {
  assert.deepEqual(
    corroborateRestrictionCategory({
      quote: 'incur any indebtedness for borrowed money',
      asserted_category: 'INDEBTEDNESS',
    }),
    { outcome: 'RESOLVED', restriction_category: 'INDEBTEDNESS', concept_key: 'IOC-DEBT' },
  );
  assert.deepEqual(
    corroborateRestrictionCategory({
      quote: 'amend any Material Contract',
      asserted_category: 'MATERIAL_CONTRACTS',
    }),
    { outcome: 'RESOLVED', restriction_category: 'MATERIAL_CONTRACTS', concept_key: 'IOC-CONTRACT' },
  );
});

test('full-width multi-category limb routes review', () => {
  assert.deepEqual(
    corroborateRestrictionCategory({
      quote: 'amend its certificate of incorporation or bylaws, or declare, set aside or pay any dividend',
      asserted_category: 'CHARTER_BYLAW_AMENDMENTS',
    }),
    {
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_CATEGORY_CORROBORATION',
      matches: ['CHARTER_BYLAW_AMENDMENTS', 'DIVIDENDS_DISTRIBUTIONS'],
    },
  );
});

test('label-to-text drift and out-of-enum values cannot resolve', () => {
  assert.deepEqual(
    corroborateRestrictionCategory({ quote: 'amend a Material Contract', asserted_category: 'ACCOUNTING_CHANGES' }),
    { outcome: 'REVIEW', reason: 'CATEGORY_UNCORROBORATED', matches: ['MATERIAL_CONTRACTS'] },
  );
  assert.deepEqual(
    corroborateRestrictionCategory({ quote: 'make loans or investments', asserted_category: 'INVESTMENT' }),
    { outcome: 'OPEN_WORLD', reason: 'RESTRICTION_CATEGORY_OUT_OF_ENUM' },
  );
});

test('recorded legacy IOC aliases normalise only to canonical categories and remain quote-corroborated', () => {
  const cases = [
    ['TAX', 'consent to any extension or waiver of any limitation period with respect to any material Tax claim or assessment', 'TAX_ELECTIONS'],
    ['COMP', 'enter into any change in control, severance or similar agreement or any retention or similar agreement with any officer, employee, director, individual independent contractor, individual consultant, or other individual service provider of the Company Group', 'EMPLOYEE_COMPENSATION'],
    ['MERGE', 'merge or consolidate the Company or any Company Subsidiary with any Person or adopt a plan of complete or partial liquidation, dissolution, restructuring, recapitalization or other reorganization of the Company or any Company Subsidiary', 'ACQUISITIONS_BUSINESS_COMBINATIONS'],
  ];
  for (const [legacy, quote, canonical] of cases) {
    assert.equal(normaliseRestrictionCategory(legacy, quote), canonical);
    assert.equal(corroborateRestrictionCategory({ quote, asserted_category: normaliseRestrictionCategory(legacy, quote) }).outcome, 'RESOLVED');
    assert.equal(normaliseRestrictionCategory(legacy, `${quote}.`), legacy, 'nearby prose does not cross the frozen compatibility boundary');
  }
  assert.equal(normaliseRestrictionCategory('ISSUE'), 'ISSUE', 'unapproved legacy codes stay outside the compatibility boundary');
  assert.notEqual(
    corroborateRestrictionCategory({
      quote: 'enter into any change in control agreement',
      asserted_category: 'ACQUISITIONS_BUSINESS_COMBINATIONS',
    }).outcome,
    'RESOLVED',
    'a normalised label still cannot bypass quote corroboration',
  );
});

test('the recorded Modiv SETTLE insurance-casualty replay quote alone normalises to INSURANCE', () => {
  assert.equal(normaliseRestrictionCategory('SETTLE', SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE), 'INSURANCE');
  assert.equal(
    corroborateRestrictionCategory({
      quote: SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE,
      asserted_category: normaliseRestrictionCategory('SETTLE', SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE),
    }).outcome,
    'RESOLVED',
  );
  assert.equal(normaliseRestrictionCategory('SETTLE', 'settle any insurance claim'), 'SETTLE');
  assert.equal(normaliseRestrictionCategory('SETTLE', SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE.replace('casualty', 'loss')), 'SETTLE');
});

test('near-miss issuance wording does not make a debt quote ambiguous', () => {
  assert.deepEqual(
    corroborateRestrictionCategory({
      quote: 'incur indebtedness or issue or sell warrants or debt securities',
      asserted_category: 'INDEBTEDNESS',
    }),
    { outcome: 'RESOLVED', restriction_category: 'INDEBTEDNESS', concept_key: 'IOC-DEBT' },
  );
});

test('Organizational Documents corroborates CHARTER_BYLAW_AMENDMENTS', () => {
  const result = corroborateRestrictionCategory({
    quote: 'amend or propose to amend the Company’s Organizational Documents',
    asserted_category: 'CHARTER_BYLAW_AMENDMENTS',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.concept_key, 'IOC-CHARTER');
  assert.equal(result.restriction_category, 'CHARTER_BYLAW_AMENDMENTS');
});

test('acquisition quotes corroborate ACQUISITIONS_BUSINESS_COMBINATIONS', () => {
  const result = corroborateRestrictionCategory({
    quote: 'complete any acquisition of any corporation, partnership or division thereof',
    asserted_category: 'ACQUISITIONS_BUSINESS_COMBINATIONS',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.concept_key, 'IOC-MERGE');
});

test('wrong category and V1-only-category hits refuse', () => {
  const wrong = corroborateRestrictionCategory({
    quote: 'amend or propose to amend the Company’s Organizational Documents',
    asserted_category: 'INDEBTEDNESS',
  });
  assert.equal(wrong.outcome, 'REVIEW');

  const v1Only = corroborateRestrictionCategory({
    quote: 'enter into any new real estate leases for office space',
    asserted_category: 'MATERIAL_CONTRACTS',
  });
  assert.equal(v1Only.outcome, 'REVIEW');
  assert.equal(v1Only.reason, 'CATEGORY_UNCORROBORATED');
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
