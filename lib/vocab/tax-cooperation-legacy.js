'use strict';

// Step 2X-B scaffold: legacy drafting-shape vocabulary for the two TAX_MATTERS
// cooperation covenants. Before Step 3G, candidate-resolution used inline
// regexes (a literal /tax opinion/i bigram; "preparation"/"filing" as fixed
// word forms). Those patterns are preserved here as second-chance vocabulary
// only -- they are too narrow for Modiv's operative text (the reason Step 3G
// widened the primary tables) but may still rescue deals that draft with the
// literal bigram or fixed word forms.
//
// CURATION STILL NEEDED: the tax-matters design spec's grounded
// TRANSFER_TAX_COOPERATION form (/cooperate in the preparation, execution
// and filing/i) and additional opinion-delivery shapes should be measured
// against the corpus before promotion. The scaffold below adds only the pre-
// 3G shapes plus one design-spec phrase not yet in the primary table.

const TAX_OPINION_LEGACY_PATTERNS = Object.freeze([
  /\btax\s+opinion\b/i,
  /\bopinion\s+letter\b/i,
  /\bcustomary\s+representations?\b/i,
]);

const COOPERATIVE_ACTION_LEGACY_PATTERN = /\b(?:deliver|furnish|provide|execute|enable|cooperat\w*|assist\w*)\b/i;

const TRANSFER_TAX_LEGACY_VOCABULARY_PATTERN = /\btransfer\s+taxe?s?\b|\bsales,\s*transfer,\s*stamp\b|\btransfer,?\s*documentary,?\s*sales,?\s*use,?\s*stamp\b/i;

// Pre-3G preparation/filing gate (word-form sensitive). Kept for second
// chance only; the primary table uses prepar\w*|fil\w* with a mandatory
// cooperation verb.
const TRANSFER_PREPARATION_LEGACY_PATTERN = /\b(?:preparation|filing)\b/i;

const TRANSFER_COOPERATION_LEGACY_PHRASE = /cooperate in the preparation, execution and filing/i;

function taxOpinionCooperationLegacyCorroborated(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  return TAX_OPINION_LEGACY_PATTERNS.some((pattern) => pattern.test(quote))
    && COOPERATIVE_ACTION_LEGACY_PATTERN.test(quote);
}

function transferCooperationLegacyCorroborated(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  if (TRANSFER_COOPERATION_LEGACY_PHRASE.test(quote)
    && TRANSFER_TAX_LEGACY_VOCABULARY_PATTERN.test(quote)) {
    return true;
  }
  return TRANSFER_TAX_LEGACY_VOCABULARY_PATTERN.test(quote)
    && COOPERATIVE_ACTION_LEGACY_PATTERN.test(quote)
    && TRANSFER_PREPARATION_LEGACY_PATTERN.test(quote);
}

const TAX_COOPERATION_LEGACY_KINDS = Object.freeze([
  'TAX_OPINION_COOPERATION',
  'TRANSFER_COOPERATION',
]);

function taxCooperationLegacyKindMatches(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  const hits = [];
  if (taxOpinionCooperationLegacyCorroborated(quote)) hits.push('TAX_OPINION_COOPERATION');
  if (transferCooperationLegacyCorroborated(quote)) hits.push('TRANSFER_COOPERATION');
  return hits.sort();
}

module.exports = Object.freeze({
  TAX_OPINION_LEGACY_PATTERNS,
  COOPERATIVE_ACTION_LEGACY_PATTERN,
  TRANSFER_TAX_LEGACY_VOCABULARY_PATTERN,
  TRANSFER_PREPARATION_LEGACY_PATTERN,
  TRANSFER_COOPERATION_LEGACY_PHRASE,
  TAX_COOPERATION_LEGACY_KINDS,
  taxOpinionCooperationLegacyCorroborated,
  transferCooperationLegacyCorroborated,
  taxCooperationLegacyKindMatches,
});
