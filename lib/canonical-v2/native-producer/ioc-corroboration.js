'use strict';

const {
  RESTRICTION_CATEGORY_TO_CONCEPT,
  LEGACY_RESTRICTION_CATEGORY_ALIASES,
  SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE,
  CATEGORY_TESTS,
  V2_CATEGORY_TO_V1_KEYS,
} = require('../../vocab/resolution/interim-operating-registry');



function normaliseRestrictionCategory(category, quote = null) {
  if (typeof category !== 'string') return category;
  const compatibility = LEGACY_RESTRICTION_CATEGORY_ALIASES[category];
  return compatibility?.source_quote === quote ? compatibility.canonical_category : category;
}

function categoryMatches(quote) {
  return Object.keys(CATEGORY_TESTS).filter((category) => CATEGORY_TESTS[category](quote)).sort();
}

function corroborateRestrictionCategory({ quote, asserted_category: assertedCategory } = {}) {
  if (typeof quote !== 'string' || quote.length === 0) throw new TypeError('quote must be a non-empty string');
  if (!Object.hasOwn(RESTRICTION_CATEGORY_TO_CONCEPT, assertedCategory)) {
    return Object.freeze({ outcome: 'OPEN_WORLD', reason: 'RESTRICTION_CATEGORY_OUT_OF_ENUM' });
  }
  const matches = categoryMatches(quote);
  if (matches.length > 1) {
    return Object.freeze({ outcome: 'REVIEW', reason: 'AMBIGUOUS_CATEGORY_CORROBORATION', matches });
  }
  if (matches.length === 1 && matches[0] === assertedCategory) {
    return Object.freeze({
      outcome: 'RESOLVED',
      restriction_category: assertedCategory,
      concept_key: RESTRICTION_CATEGORY_TO_CONCEPT[assertedCategory],
    });
  }
  return Object.freeze({ outcome: 'REVIEW', reason: 'CATEGORY_UNCORROBORATED', matches });
}

function corroborateThresholdBasis({ quote, asserted_basis: assertedBasis } = {}) {
  if (typeof quote !== 'string' || quote.length === 0) throw new TypeError('quote must be a non-empty string');
  if (!['INDIVIDUAL', 'AGGREGATE'].includes(assertedBasis)) {
    return Object.freeze({ outcome: 'OPEN_WORLD', reason: 'THRESHOLD_BASIS_OUT_OF_ENUM' });
  }
  const individual = /\bindividually\b|\bfor any single\b|\bfor any individual\b/i.test(quote);
  const aggregate = /\bin the aggregate\b/i.test(quote);
  if (individual && aggregate) {
    return Object.freeze({ outcome: 'REVIEW', reason: 'AMBIGUOUS_THRESHOLD_BASIS' });
  }
  const corroborated = assertedBasis === 'INDIVIDUAL' ? individual : aggregate;
  if (!corroborated) {
    return Object.freeze({ outcome: 'REVIEW', reason: 'THRESHOLD_BASIS_UNCORROBORATED' });
  }
  return Object.freeze({ outcome: 'RESOLVED', threshold_basis: assertedBasis });
}

module.exports = Object.freeze({
  RESTRICTION_CATEGORY_TO_CONCEPT,
  LEGACY_RESTRICTION_CATEGORY_ALIASES,
  SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE,
  normaliseRestrictionCategory,
  CATEGORY_TESTS,
  V2_CATEGORY_TO_V1_KEYS,
  categoryMatches,
  corroborateRestrictionCategory,
  corroborateThresholdBasis,
});
