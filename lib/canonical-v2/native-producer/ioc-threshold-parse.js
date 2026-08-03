'use strict';

const IOC_THRESHOLD_PARSE_VERSION = 1;

const CURRENCY_TOKEN_PATTERN = /([$€£])(\s?)(\d(?:[\d,]*\d)?(?:\.\d+)?)/g;
const STRICT_GROUPING_PATTERN = /^\d{1,3}(,\d{3})*(\.\d+)?$/;
const NON_LITERAL_MONEY_PATTERN =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion)\s+(hundred|thousand|million|billion)?\s*dollars\b/i;

function currencyMatches(quote) {
  const pattern = new RegExp(CURRENCY_TOKEN_PATTERN.source, 'g');
  const matches = [];
  let match = pattern.exec(quote);
  while (match) {
    matches.push(Object.freeze({
      text: match[0],
      currency_symbol: match[1],
      digits: match[3],
    }));
    match = pattern.exec(quote);
  }
  return matches;
}

function parseThresholdAmount(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseThresholdAmount requires a non-empty quote');
  }

  const candidates = currencyMatches(quote);
  if (candidates.length === 0) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: NON_LITERAL_MONEY_PATTERN.test(quote) ? 'NON_LITERAL_MONEY' : 'NO_MONEY_LITERAL',
    });
  }

  const nonUsd = candidates.find((candidate) => candidate.currency_symbol !== '$');
  if (nonUsd) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: 'NON_USD_CURRENCY',
      matched_text: nonUsd.text,
    });
  }

  if (candidates.length > 1) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_MONEY_LITERALS' });
  }

  const candidate = candidates[0];
  if (!STRICT_GROUPING_PATTERN.test(candidate.digits)) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: 'MALFORMED_GROUPING',
      matched_text: candidate.digits,
    });
  }

  return Object.freeze({
    outcome: 'RESOLVED',
    canonical_value: candidate.digits.replace(/,/g, ''),
    matched_text: candidate.digits,
    corroboration_text: quote,
    currency: 'USD',
  });
}

module.exports = Object.freeze({
  IOC_THRESHOLD_PARSE_VERSION,
  CURRENCY_TOKEN_PATTERN,
  STRICT_GROUPING_PATTERN,
  parseThresholdAmount,
});
