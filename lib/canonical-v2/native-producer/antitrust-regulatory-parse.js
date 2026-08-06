'use strict';

const ANTITRUST_REGULATORY_PARSE_VERSION = 1;
const SCALE_WORD_PATTERN = /^\s*(?:million|billion|thousand)\b/i;
const MONEY_TOKEN_PATTERN = /(?:(?<![A-Za-z])((?:US|CA|C|AU|A|NZ|HK|S)?\$|€|£)|\b(USD|EUR|GBP|CAD|AUD|NZD|HKD|SGD)\b)\s*(\d(?:[\d,.]*\d)?)/g;
const DAY_TOKEN_PATTERN = /\b(?:(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -](one|two|three|four|five|six|seven|eight|nine))?\s*\()?([0-9]+)\)?\s*(business\s+days?|calendar\s+days?|days?)\b|\b([0-9]+)\s*(business\s+days?|calendar\s+days?|days?)\b/gi;
const SPELLED_NUMERALS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 });
const CURRENCY_CODES = Object.freeze({
  '$': 'USD', 'US$': 'USD', USD: 'USD',
  'C$': 'CAD', 'CA$': 'CAD', CAD: 'CAD',
  'A$': 'AUD', 'AU$': 'AUD', AUD: 'AUD',
  'NZ$': 'NZD', NZD: 'NZD',
  'HK$': 'HKD', HKD: 'HKD',
  'S$': 'SGD', SGD: 'SGD',
  '€': 'EUR', EUR: 'EUR',
  '£': 'GBP', GBP: 'GBP',
});

function isHsrRegimeRef(ref) {
  return typeof ref === 'string' && (
    /^HSR Act$/i.test(ref.trim())
    || /^Hart[-–— ]Scott[-–— ]Rodino(?: Antitrust Improvements)? Act(?: of 1976)?(?:,? as amended)?$/i.test(ref.trim())
  );
}

function parseDivestitureCapAmount(quote) {
  if (typeof quote !== 'string') return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_MONEY_LITERAL' });
  const candidates = [];
  for (const match of quote.matchAll(MONEY_TOKEN_PATTERN)) {
    const currencyLiteral = match[1] || match[2];
    const literal = match[3];
    if (SCALE_WORD_PATTERN.test(quote.slice(match.index + match[0].length))) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'SCALED_MONEY_LITERAL' });
    }
    candidates.push({ currency: CURRENCY_CODES[currencyLiteral], literal, matched_text: match[0] });
  }
  if (candidates.length > 1) return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_MONEY_LITERALS' });
  if (candidates.length === 0) {
    if (/\b[A-Z]{1,3}\$\s*\d/.test(quote)) return Object.freeze({ outcome: 'ABSTAIN', reason: 'UNSUPPORTED_CURRENCY_LITERAL' });
    return Object.freeze({ outcome: 'ABSTAIN', reason: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\s+dollars?\b/i.test(quote) ? 'NON_LITERAL_MONEY' : 'NO_MONEY_LITERAL' });
  }
  const candidate = candidates[0];
  if (!/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)(?:\.\d+)?$/.test(candidate.literal)) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING' });
  }
  return Object.freeze({ outcome: 'RESOLVED', canonical_value: candidate.literal.replace(/,/g, ''), currency: candidate.currency, matched_text: candidate.matched_text });
}

function spelledValue(first, second) {
  if (!first) return null;
  return (SPELLED_NUMERALS[first.toLowerCase()] || 0) + (second ? (SPELLED_NUMERALS[second.toLowerCase()] || 0) : 0);
}

function parseFilingDeadlineDays(quote) {
  if (typeof quote !== 'string') return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_DAY_COUNT' });
  const candidates = [];
  for (const match of quote.matchAll(DAY_TOKEN_PATTERN)) {
    const spelled = spelledValue(match[1], match[2]);
    const digit = match[3] || match[5];
    const matchedText = match[0];
    if (spelled && !match[3]) return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
    if (spelled && Number(digit) !== spelled) return Object.freeze({ outcome: 'ABSTAIN', reason: 'SPELLED_DIGIT_MISMATCH' });
    const dayKind = /business\s+days?/i.test(matchedText)
      ? 'BUSINESS' : (/calendar\s+days?/i.test(matchedText) ? 'CALENDAR' : 'UNSPECIFIED');
    candidates.push({ canonical_value: String(Number(digit)), matched_text: matchedText, day_kind: dayKind });
  }
  if (candidates.length === 0) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -](?:one|two|three|four|five|six|seven|eight|nine))?\s+(?:business\s+days?|calendar\s+days?|days?)\b/i.test(quote) ? 'NON_LITERAL_NUMERAL' : 'NO_DAY_COUNT' });
  }
  if (candidates.length > 1) return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_DAY_COUNTS' });
  return Object.freeze({ outcome: 'RESOLVED', ...candidates[0] });
}

module.exports = { ANTITRUST_REGULATORY_PARSE_VERSION, CURRENCY_CODES, isHsrRegimeRef, parseDivestitureCapAmount, parseFilingDeadlineDays };
