'use strict';

const RESTRICTION_CATEGORY_TO_CONCEPT = Object.freeze({
  MERGE: 'IOC-MERGE',
  CONTRACT: 'IOC-CONTRACT',
  COMP: 'IOC-COMP',
  DEBT: 'IOC-DEBT',
  TAX: 'IOC-TAX',
  CHARTER: 'IOC-CHARTER',
  ISSUE: 'IOC-ISSUE',
  ACCOUNTING: 'IOC-ACCOUNTING',
  SETTLE: 'IOC-SETTLE',
  DIVIDEND: 'IOC-DIVIDEND',
  CAPEX: 'IOC-CAPEX',
});

const CATEGORY_TESTS = Object.freeze({
  CAPEX: (quote) => /\bcapital expenditures?\b/i.test(quote),
  DEBT: (quote) => /\bindebtedness\b/i.test(quote) || /\bdebt securities\b/i.test(quote),
  DIVIDEND: (quote) => /\bdividends?\b/i.test(quote) || /declare, set aside/i.test(quote),
  SETTLE: (quote) => /\b(settle|compromise)\b/i.test(quote) && /\bActions?\b/.test(quote),
  COMP: (quote) => /\bcompensation\b/i.test(quote) || /\bBenefit Plan\b/.test(quote) || /\bEmployee Plan\b/.test(quote),
  ISSUE: (quote) => /\bissue, (deliver|sell)\b/i.test(quote) || /\bissuance\b/i.test(quote),
  CHARTER: (quote) => /certificate of incorporation|certificate of formation|bylaws|governing documents/i.test(quote),
  MERGE: (quote) => /\bmerge with\b/i.test(quote)
    || /\bconsolidation with\b/i.test(quote)
    || /including by merger/i.test(quote)
    || /\bbusiness combinations?\b/i.test(quote)
    || /\bacquire control\b/i.test(quote)
    || /acquire a substantial portion of the assets/i.test(quote)
    || /transfer, sell, lease/i.test(quote),
  CONTRACT: (quote) => /\bMaterial Contract\b/.test(quote),
  ACCOUNTING: (quote) => /accounting (policies|practices|procedures)/i.test(quote) || /\bGAAP\b/.test(quote),
  TAX: (quote) => /\bTax elections?\b/.test(quote)
    || /election relating to Taxes/.test(quote)
    || /\bTax Returns?\b/.test(quote)
    || /method of Tax accounting/.test(quote),
});

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
  if (matches.length !== 1 || matches[0] !== assertedCategory) {
    return Object.freeze({ outcome: 'REVIEW', reason: 'CATEGORY_UNCORROBORATED', matches });
  }
  return Object.freeze({
    outcome: 'RESOLVED',
    restriction_category: assertedCategory,
    concept_key: RESTRICTION_CATEGORY_TO_CONCEPT[assertedCategory],
  });
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
  CATEGORY_TESTS,
  categoryMatches,
  corroborateRestrictionCategory,
  corroborateThresholdBasis,
});
