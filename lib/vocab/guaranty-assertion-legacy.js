'use strict';

// Step 2X-B scaffold: broader guaranty corroboration patterns for second-
// chance resolution when the primary conjunctive tables in
// guaranty-corroboration.js miss. Unlike IOC, there is no pre-existing V1
// vocabulary file for this family -- these patterns are deliberately
// RELAXED versions of the design-spec tables (one conjunct dropped per
// kind), grounded in the same fixture quotes the primary tables cite.
//
// CURATION STILL NEEDED: a corpus-wide pass over all five grounding cards
// (guaranty-financing-party design spec) should measure recall/pricing for
// each relaxed conjunct before any pattern is promoted beyond scaffold
// status. Known collision surface: bare "Guarantee(s)" in TARGET-rep
// articles (design spec section 3) -- any broadening here must be checked
// against that surface before enforcement.

const LEGACY_GUARANTY_CORROBORATION = Object.freeze({
  // Primary requires guarantees + performance + obligations; the D&O false
  // positive ("guarantees the obligations of the Surviving Corporation…")
  // still lacks a performance token and must refuse here too.
  PERFORMANCE_GUARANTY: (quote) => (
    /\bguarantee?s?\b/i.test(quote)
    && /\bobligations?\b/i.test(quote)
  ),
  // Primary requires delivered|furnished + guaranty + (duly executed|true
  // copy); deals like 5921052e use "furnished… a true, complete and correct
  // copy" where "duly executed" is absent from the delivery sentence.
  GUARANTY_DELIVERED: (quote) => (
    /\b(delivered|furnished)\b/i.test(quote)
    && /guarant(y|ee)/i.test(quote)
  ),
  // Primary requires full force and effect + guaranty + valid and binding;
  // some cards carry "legal, valid and binding" without the exact triple.
  GUARANTY_IN_EFFECT: (quote) => (
    /full force and effect/i.test(quote)
    && /guarant(y|ee)/i.test(quote)
  ),
});

const LEGACY_GUARANTY_ASSERTION_KINDS = Object.freeze(
  Object.keys(LEGACY_GUARANTY_CORROBORATION).sort(),
);

function legacyGuarantyKindMatches(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  return LEGACY_GUARANTY_ASSERTION_KINDS.filter(
    (kind) => LEGACY_GUARANTY_CORROBORATION[kind](quote),
  ).sort();
}

module.exports = Object.freeze({
  LEGACY_GUARANTY_CORROBORATION,
  LEGACY_GUARANTY_ASSERTION_KINDS,
  legacyGuarantyKindMatches,
});
