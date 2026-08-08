'use strict';

// Stage 4 / Step 2X-B scaffold: the V1 presentation vocabulary for the 18
// GENERAL_COVENANT_FOLLOW_ON_OWNERS codes. Before Step 3G,
// candidate-resolution corroborated covenant codes by normalising
// lib/rubric.js CODES[code].label and .aliases and checking whether the
// normalised quote contained one of those strings. That check failed on
// real operative text (Modiv resolved zero) and was replaced by operative-
// text patterns in general-covenant-corroboration.js -- but the rubric
// strings remain the only legacy vocabulary artifact for this family.
//
// CURATION STILL NEEDED: rubric labels are written for a person browsing a
// covenant-type rubric, not for corroborating clause text. A measured
// corpus pass should promote only presentation strings that actually
// appear in operative clauses (the IOC ioc-categories discipline), and add
// heading-shaped patterns where labels never appear verbatim. Until that
// pass lands, this file exports the rubric strings as-is for second-chance
// corroboration only.

const { CODES } = require('../rubric');
const { normaliseForMatching } = require('../canonical-v2/zero-width-normalise');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../canonical-v2/p0-product-surface-routing');

const GENERAL_COVENANT_FOLLOW_ON_CODES = Object.freeze(
  Object.keys(GENERAL_COVENANT_FOLLOW_ON_OWNERS).sort(),
);

function rubricPresentationTerms(code) {
  const entry = CODES[code];
  if (!entry) return [];
  return [entry.label, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]
    .map((term) => normaliseForMatching(term))
    .filter((term) => term.length > 0);
}

const PRESENTATION_TERMS_BY_CODE = Object.freeze(Object.fromEntries(
  GENERAL_COVENANT_FOLLOW_ON_CODES.map((code) => [
    code,
    Object.freeze(rubricPresentationTerms(code)),
  ]),
));

function rubricPresentationCodeMatches(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  const normalizedQuote = normaliseForMatching(quote);
  const hits = [];
  for (const code of GENERAL_COVENANT_FOLLOW_ON_CODES) {
    const terms = PRESENTATION_TERMS_BY_CODE[code];
    if (terms.some((term) => normalizedQuote.includes(term))) {
      hits.push(code);
    }
  }
  return hits.sort();
}

module.exports = Object.freeze({
  GENERAL_COVENANT_FOLLOW_ON_CODES,
  PRESENTATION_TERMS_BY_CODE,
  rubricPresentationTerms,
  rubricPresentationCodeMatches,
});
