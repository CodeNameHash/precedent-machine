'use strict';

const PER_SHARE_CASH_PARSE_VERSION = 1;
const CURRENCY_TOKEN_PATTERN = /([$€£])[\s\u200e]*(\d(?:[\d,]*\d)?(?:\.\d+)?)/g;
const STRICT_GROUPING_PATTERN = /^\d{1,3}(,\d{3})*(\.\d+)?$/;
const PAR_VALUE_SPAN_PATTERN = /par value\s*[$€£][\s\u200e]*\d(?:[\d,]*\d)?(?:\.\d+)?\s+per share/gi;
const NON_LITERAL_MONEY_PATTERN = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine|ten))*\s+dollars?\b/i;

function matches(pattern, text) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const result = [];
  let match = re.exec(text);
  while (match) {
    result.push({ start: match.index, end: match.index + match[0].length, match });
    match = re.exec(text);
  }
  return result;
}

function parsePerShareCash(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parsePerShareCash requires a non-empty quote');
  }
  const parValueSpans = matches(PAR_VALUE_SPAN_PATTERN, quote);
  const candidates = matches(CURRENCY_TOKEN_PATTERN, quote)
    .filter(({ start, end }) => !parValueSpans.some((span) => start >= span.start && end <= span.end))
    .map(({ match }) => ({
      text: match[0],
      currency_symbol: match[1],
      digits: match[2],
    }));
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
  const [candidate] = candidates;
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
    currency: 'USD',
  });
}

module.exports = {
  CURRENCY_TOKEN_PATTERN,
  PAR_VALUE_SPAN_PATTERN,
  PER_SHARE_CASH_PARSE_VERSION,
  STRICT_GROUPING_PATTERN,
  parsePerShareCash,
};
