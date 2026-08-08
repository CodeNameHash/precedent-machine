'use strict';

// Corroboration for the three governed guaranty assertion kinds. Primary
// patterns are the design-spec conjunctive tables; Step 2X-B adds a second
// chance through lib/vocab/guaranty-assertion-legacy.js when the primary
// table misses (strictly additive -- primary hits stay byte-identical).
// Cross-kind ambiguity (PERFORMANCE vs delivery kinds) is enforced on both
// passes. Step 2X-C collision guard is already live here via the
// performance-vs-delivered exclusivity check.

const {
  LEGACY_GUARANTY_CORROBORATION,
  legacyGuarantyKindMatches,
} = require('../../vocab/guaranty-assertion-legacy');

const GUARANTY_ASSERTION_KINDS = Object.freeze([
  'PERFORMANCE_GUARANTY',
  'GUARANTY_DELIVERED',
  'GUARANTY_IN_EFFECT',
]);

const CORROBORATION = Object.freeze({
  PERFORMANCE_GUARANTY: (quote) => (
    /\bguarantees\b/i.test(quote)
    && /\bperformance\b/i.test(quote)
    && /\bobligations?\b/i.test(quote)
  ),
  GUARANTY_DELIVERED: (quote) => (
    /\b(delivered|furnished)\b/i.test(quote)
    && /guarant(y|ee)/i.test(quote)
    && (/\bduly executed\b/i.test(quote)
      || /true,? (complete and correct|correct and complete) copy/i.test(quote))
  ),
  GUARANTY_IN_EFFECT: (quote) => (
    /full force and effect/i.test(quote)
    && /guarant(y|ee)/i.test(quote)
    && /valid and binding/i.test(quote)
  ),
});

function primaryGuarantyKindMatches(quote) {
  return GUARANTY_ASSERTION_KINDS.filter((kind) => CORROBORATION[kind](quote)).sort();
}

function guarantyObjectAmbiguity(quote) {
  const performance = CORROBORATION.PERFORMANCE_GUARANTY(quote)
    || LEGACY_GUARANTY_CORROBORATION.PERFORMANCE_GUARANTY(quote);
  const deliveredInstrument = CORROBORATION.GUARANTY_DELIVERED(quote)
    || CORROBORATION.GUARANTY_IN_EFFECT(quote)
    || LEGACY_GUARANTY_CORROBORATION.GUARANTY_DELIVERED(quote)
    || LEGACY_GUARANTY_CORROBORATION.GUARANTY_IN_EFFECT(quote);
  return performance && deliveredInstrument;
}

function corroborateGuarantyKind({ quote, asserted_kind: assertedKind } = {}) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('corroborateGuarantyKind requires a non-empty quote');
  }
  if (!GUARANTY_ASSERTION_KINDS.includes(assertedKind)) {
    return Object.freeze({
      outcome: 'OPEN_WORLD',
      reason: 'GTY_ASSERTION_KIND_OUT_OF_VOCABULARY',
    });
  }
  if (CORROBORATION[assertedKind](quote)) {
    if (guarantyObjectAmbiguity(quote)) {
      return Object.freeze({ outcome: 'REVIEW', reason: 'AMBIGUOUS_GUARANTY_OBJECT' });
    }
    return Object.freeze({ outcome: 'RESOLVED', assertion_kind: assertedKind });
  }
  const primaryMatches = primaryGuarantyKindMatches(quote);
  if (primaryMatches.length > 1) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_GUARANTY_KIND',
      matches: primaryMatches,
    });
  }
  if (guarantyObjectAmbiguity(quote)) {
    return Object.freeze({ outcome: 'REVIEW', reason: 'AMBIGUOUS_GUARANTY_OBJECT' });
  }
  const v1Matches = legacyGuarantyKindMatches(quote);
  if (v1Matches.length > 1) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_GUARANTY_KIND',
      matches: v1Matches,
      corroboration_scope: 'V1_GUARANTY_ASSERTION_LEGACY',
    });
  }
  if (v1Matches.length === 1 && v1Matches[0] === assertedKind) {
    return Object.freeze({
      outcome: 'RESOLVED',
      assertion_kind: assertedKind,
      corroboration_provenance: 'V1_GUARANTY_ASSERTION_LEGACY',
    });
  }
  return Object.freeze({ outcome: 'REVIEW', reason: 'GTY_KIND_UNCORROBORATED' });
}

module.exports = Object.freeze({
  CORROBORATION,
  GUARANTY_ASSERTION_KINDS,
  primaryGuarantyKindMatches,
  corroborateGuarantyKind,
});
