'use strict';

const { CALENDAR_DATE_PATTERN } = require('./measurement-date-parse');
const { CLOCK_TIME_PATTERN, SECTION_REFERENCE_PATTERN } = require('./share-count-parse');

const EXCHANGE_RATIO_PARSE_VERSION = 1;
const DECIMAL_TOKEN_PATTERN = /(?<![\d.A-Za-z_])\d+\.\d+(?![\d.A-Za-z_])/g;
const RATIO_LITERAL_PATTERN = /^\d+\.\d{1,6}$/;
const CURRENCY_PREFIX_PATTERN = /[$€£][\s\u200e]*$/;
const PERCENT_SUFFIX_PATTERN = /^\s*%/;
const NON_LITERAL_RATIO_PATTERN = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b(?=[^.;]{0,80}\bshares?\b)/i;

function spans(pattern, text) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const result = [];
  let match = re.exec(text);
  while (match) {
    result.push({ start: match.index, end: match.index + match[0].length });
    match = re.exec(text);
  }
  return result;
}

function contains(span, token) {
  return token.start >= span.start && token.end <= span.end;
}

function parseExchangeRatio(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseExchangeRatio requires a non-empty quote');
  }
  const excludedSpans = [
    ...spans(SECTION_REFERENCE_PATTERN, quote),
    ...spans(CALENDAR_DATE_PATTERN, quote),
    ...spans(CLOCK_TIME_PATTERN, quote),
  ];
  const candidates = spans(DECIMAL_TOKEN_PATTERN, quote)
    .map((token) => ({ ...token, text: quote.slice(token.start, token.end) }))
    .filter((token) => !excludedSpans.some((span) => contains(span, token)))
    .filter((token) => !CURRENCY_PREFIX_PATTERN.test(quote.slice(Math.max(0, token.start - 8), token.start)))
    .filter((token) => !PERCENT_SUFFIX_PATTERN.test(quote.slice(token.end)));
  if (candidates.length === 0) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: NON_LITERAL_RATIO_PATTERN.test(quote) ? 'NON_LITERAL_NUMERAL' : 'NO_RATIO_LITERAL',
    });
  }
  if (candidates.length > 1) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_RATIO_LITERALS' });
  }
  const [candidate] = candidates;
  if (!RATIO_LITERAL_PATTERN.test(candidate.text)) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: 'MALFORMED_RATIO_LITERAL',
      matched_text: candidate.text,
    });
  }
  return Object.freeze({
    outcome: 'RESOLVED',
    canonical_value: candidate.text,
    matched_text: candidate.text,
  });
}

module.exports = {
  DECIMAL_TOKEN_PATTERN,
  EXCHANGE_RATIO_PARSE_VERSION,
  RATIO_LITERAL_PATTERN,
  parseExchangeRatio,
};
