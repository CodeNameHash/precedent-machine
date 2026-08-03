'use strict';

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
  if (!CORROBORATION[assertedKind](quote)) {
    return Object.freeze({ outcome: 'REVIEW', reason: 'GTY_KIND_UNCORROBORATED' });
  }

  const performance = CORROBORATION.PERFORMANCE_GUARANTY(quote);
  const deliveredInstrument = CORROBORATION.GUARANTY_DELIVERED(quote)
    || CORROBORATION.GUARANTY_IN_EFFECT(quote);
  if (performance && deliveredInstrument) {
    return Object.freeze({ outcome: 'REVIEW', reason: 'AMBIGUOUS_GUARANTY_OBJECT' });
  }
  return Object.freeze({ outcome: 'RESOLVED', assertion_kind: assertedKind });
}

module.exports = Object.freeze({
  CORROBORATION,
  GUARANTY_ASSERTION_KINDS,
  corroborateGuarantyKind,
});
