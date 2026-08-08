'use strict';

// V1's IOC category vocabulary, consumed rather than re-curated (Stage 4,
// docs/codex-program/notes/structural-inheritance-diagnosis.md card 04;
// docs/core/CLAUDE.md's "check the library before the scripts"):
// lib/vocab/ioc-categories.js carries 25 canonical categories with a
// heading matcher measured against the real corpus (22 of 25 exercised,
// 302 of 462 restriction texts classified), and lib/vocab/ioc-components.js
// carries their sub-component structure (populated for 2 of 25 categories
// today -- consumed as-is, never invented for the other 23).
const {
  HEADING_TO_IOC_CATEGORY,
  IOC_CATEGORY_BY_KEY,
} = require('../../vocab/ioc-categories');
const { IOC_COMPONENTS_BY_CATEGORY } = require('../../vocab/ioc-components');

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
  DEBT: (quote) => /\bindebtedness\b/i.test(quote) || /\bdebt securities\b/i.test(quote)
    || /\bIndenture\b/.test(quote) || /\bSenior Notes\b/.test(quote),
  DIVIDEND: (quote) => /\bdividends?\b/i.test(quote) || /declare, set aside/i.test(quote),
  SETTLE: (quote) => (/\b(settle|compromise)\b/i.test(quote) && /\bActions?\b/.test(quote))
    || /\bwaive any claims\b/i.test(quote),
  COMP: (quote) => /\bcompensation\b/i.test(quote) || /\bBenefit Plan\b/.test(quote) || /\bEmployee Plan\b/.test(quote)
    || /\b(?:hire|promote|terminate) the employment\b/i.test(quote)
    || /\bseverance(?: or termination)? (?:payments|benefits)\b/i.test(quote),
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
    || /method of Tax accounting/.test(quote)
    || /\b(?:audit|proceeding) relating to a material Tax\b/.test(quote)
    || /\bTax sharing agreement\b/.test(quote)
    || /\bTax ruling\b/.test(quote),
});

function categoryMatches(quote) {
  return Object.keys(CATEGORY_TESTS).filter((category) => CATEGORY_TESTS[category](quote)).sort();
}

// The explicit V2 restriction category -> V1 canonical category
// correspondence. V2's producer enum is 11 categories (prompt-pinned; a
// resolver cannot widen it -- that is a producer-prompt decision, flagged
// in the Stage 4 report, not taken here); V1's vocabulary is 25. Every V2
// category maps to the V1 categories whose heading vocabulary describes the
// same restriction; the nine-plus V1 categories with NO V2 counterpart
// (REAL_ESTATE_LEASES, IP_LICENSING, LIENS_ENCUMBRANCES, INSURANCE,
// INTERCOMPANY_ARRANGEMENTS, REGULATORY_FILINGS, DATA_PRIVACY_CYBER,
// LOANS_INVESTMENTS, EQUITY_REPURCHASES, ...) are deliberately absent: a
// quote whose only vocabulary hit is one of those is NOT corroboration for
// any V2 category and must keep failing closed.
const V2_CATEGORY_TO_V1_KEYS = Object.freeze({
  MERGE: Object.freeze(['ACQUISITIONS_BUSINESS_COMBINATIONS', 'DISPOSITIONS_ASSET_SALES']),
  CONTRACT: Object.freeze(['MATERIAL_CONTRACTS']),
  COMP: Object.freeze(['EMPLOYEE_COMPENSATION', 'EMPLOYEE_HIRING_TERMINATION', 'BENEFIT_PLANS', 'COLLECTIVE_BARGAINING']),
  DEBT: Object.freeze(['INDEBTEDNESS']),
  TAX: Object.freeze(['TAX_ELECTIONS']),
  CHARTER: Object.freeze(['CHARTER_BYLAW_AMENDMENTS']),
  ISSUE: Object.freeze(['EQUITY_ISSUANCES']),
  ACCOUNTING: Object.freeze(['ACCOUNTING_CHANGES']),
  SETTLE: Object.freeze(['LITIGATION_SETTLEMENTS']),
  DIVIDEND: Object.freeze(['DIVIDENDS_DISTRIBUTIONS']),
  CAPEX: Object.freeze(['CAPITAL_EXPENDITURES']),
});
const V1_KEY_TO_PATTERN = Object.freeze(Object.fromEntries(
  HEADING_TO_IOC_CATEGORY.map((entry) => [entry.key, entry.pattern]),
));

// Second-chance corroboration through the V1 vocabulary, tried ONLY when
// the primary CATEGORY_TESTS matched nothing at all -- strictly additive: a
// quote the primary tests already corroborate (or already find ambiguous)
// resolves byte-identically to before this existed. The V1 heading
// patterns are broader than the primary tests (they were written to match
// headings, not to gate corroboration), so the same fail-closed shape is
// enforced ACROSS the whole V1 vocabulary: every V1 category's pattern is
// tested, hits map back to V2 categories where a correspondence exists
// (a hit on an unmapped V1 category counts as a competing hit and refuses
// -- see V1_ONLY sentinel below), and only a single, unambiguous V2
// category equal to the asserted one corroborates.
function v1CategoryMatches(quote) {
  const v2Hits = new Set();
  for (const [v1Key, pattern] of Object.entries(V1_KEY_TO_PATTERN)) {
    if (!pattern.test(quote)) continue;
    const v2Key = Object.keys(V2_CATEGORY_TO_V1_KEYS)
      .find((candidate) => V2_CATEGORY_TO_V1_KEYS[candidate].includes(v1Key));
    v2Hits.add(v2Key || `V1_ONLY:${v1Key}`);
  }
  return [...v2Hits].sort();
}

// The V1 category record (canonical key, label, and -- where V1 has them --
// sub-components) carried onto a resolved claim so the richer V1 structure
// survives into Canonical-V2 output instead of being flattened away.
// Components exist for 2 of 25 categories in lib/vocab/ioc-components.js
// today; absent categories carry no components field rather than an
// invented list.
function v1CategoryRecord(assertedCategory, quote) {
  const v1Keys = V2_CATEGORY_TO_V1_KEYS[assertedCategory] || [];
  const matched = v1Keys.filter((key) => {
    const pattern = V1_KEY_TO_PATTERN[key];
    return pattern ? pattern.test(quote) : false;
  });
  if (matched.length !== 1) return null;
  const key = matched[0];
  const components = IOC_COMPONENTS_BY_CATEGORY[key];
  return Object.freeze({
    v1_category_key: key,
    v1_category_label: IOC_CATEGORY_BY_KEY[key] ? IOC_CATEGORY_BY_KEY[key].label : null,
    ...(Array.isArray(components) ? { v1_category_components: Object.freeze([...components]) } : {}),
  });
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
    // Primary-test resolution stays BYTE-IDENTICAL to its pre-Stage-4
    // shape -- deliberately no v1_category enrichment here: claim
    // attributes feed claim identity, so enriching this path would re-mint
    // every already-resolved IOC claim across the corpus for zero
    // information gain (the primary tests corroborated; the V1 record adds
    // nothing a reviewer needs on these rows).
    return Object.freeze({
      outcome: 'RESOLVED',
      restriction_category: assertedCategory,
      concept_key: RESTRICTION_CATEGORY_TO_CONCEPT[assertedCategory],
    });
  }
  if (matches.length === 0) {
    // Second chance through the V1 vocabulary (Stage 4) -- fail-closed on
    // any ambiguity, and typed with its own provenance so a reviewer can
    // always tell which vocabulary corroborated.
    const v1Matches = v1CategoryMatches(quote);
    if (v1Matches.length === 1 && v1Matches[0] === assertedCategory) {
      return Object.freeze({
        outcome: 'RESOLVED',
        restriction_category: assertedCategory,
        concept_key: RESTRICTION_CATEGORY_TO_CONCEPT[assertedCategory],
        corroboration_provenance: 'V1_IOC_CATEGORY_VOCABULARY',
        ...(v1CategoryRecord(assertedCategory, quote) ? { v1_category: v1CategoryRecord(assertedCategory, quote) } : {}),
      });
    }
    if (v1Matches.length > 1 && v1Matches.includes(assertedCategory)) {
      return Object.freeze({ outcome: 'REVIEW', reason: 'AMBIGUOUS_CATEGORY_CORROBORATION', matches: v1Matches });
    }
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
  CATEGORY_TESTS,
  V2_CATEGORY_TO_V1_KEYS,
  categoryMatches,
  v1CategoryMatches,
  corroborateRestrictionCategory,
  corroborateThresholdBasis,
});
