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

// ═══════════════════════════════════════════════════════════════════════
// Stage 4: V1 IOC vocabulary consumed as second-chance corroboration
// (lib/vocab/ioc-categories.js + ioc-components.js -- see
// ioc-corroboration.js's own V2_CATEGORY_TO_V1_KEYS comment).
// ═══════════════════════════════════════════════════════════════════════

test('Stage 4: "Organizational Documents" corroborates CHARTER through the V1 vocabulary, typed with its own provenance (card 04)', () => {
  const result = corroborateRestrictionCategory({
    quote: 'amend or propose to amend the Company’s Organizational Documents',
    asserted_category: 'CHARTER',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.concept_key, 'IOC-CHARTER');
  assert.equal(result.corroboration_provenance, 'V1_IOC_CATEGORY_VOCABULARY');
  assert.equal(result.v1_category.v1_category_key, 'CHARTER_BYLAW_AMENDMENTS');
});

test('Stage 4: the V1 record carries sub-components exactly where lib/vocab/ioc-components.js has them, never invented', () => {
  const withComponents = corroborateRestrictionCategory({
    quote: 'complete any acquisition of any corporation, partnership or division thereof',
    asserted_category: 'MERGE',
  });
  assert.equal(withComponents.outcome, 'RESOLVED');
  assert.equal(withComponents.v1_category.v1_category_key, 'ACQUISITIONS_BUSINESS_COMBINATIONS');
  assert.ok(Array.isArray(withComponents.v1_category.v1_category_components), 'ACQUISITIONS has components in V1');
  const withoutComponents = corroborateRestrictionCategory({
    quote: 'amend or propose to amend the Company’s Organizational Documents',
    asserted_category: 'CHARTER',
  });
  assert.equal('v1_category_components' in withoutComponents.v1_category, false, 'CHARTER has no V1 components -- none invented');
});

test('Stage 4 HOSTILE: the second chance never fires when the primary tests matched (primary path byte-identical), never corroborates a wrong category, and a V1-only-category hit refuses', () => {
  // Primary path unchanged: no provenance, no v1_category.
  const primary = corroborateRestrictionCategory({
    quote: 'incur any indebtedness for borrowed money',
    asserted_category: 'DEBT',
  });
  assert.deepEqual(primary, { outcome: 'RESOLVED', restriction_category: 'DEBT', concept_key: 'IOC-DEBT' });

  // Wrong category: quote is charter text, asserted DEBT -- must refuse.
  const wrong = corroborateRestrictionCategory({
    quote: 'amend or propose to amend the Company’s Organizational Documents',
    asserted_category: 'DEBT',
  });
  assert.equal(wrong.outcome, 'REVIEW');

  // A quote whose only V1 hit is a category with NO V2 counterpart
  // (REAL_ESTATE_LEASES) must not corroborate anything.
  const v1Only = corroborateRestrictionCategory({
    quote: 'enter into any new real estate leases for office space',
    asserted_category: 'CONTRACT',
  });
  assert.equal(v1Only.outcome, 'REVIEW');
  assert.equal(v1Only.reason, 'CATEGORY_UNCORROBORATED');
});
