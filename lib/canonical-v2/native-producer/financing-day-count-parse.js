'use strict';
const FINANCING_DAY_COUNT_PARSE_VERSION = 1;
const DAY_PATTERN = /(?:\b\w+\s*\()?\b(\d+)\)?(?:\s+consecutive)?\s+(Business\s+Days?|business\s+days?|Days?|days?)\b/g;
function parseFinancingDayCount(quote) {
  if (typeof quote !== 'string' || quote.length === 0) throw new TypeError('quote must be a non-empty string');
  if (/\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen)\s+(?:\(\d+\)\s+)?(?:consecutive\s+)?(?:Business\s+)?Days?\b/i.test(quote) && !/\(\d+\)/.test(quote)) return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
  const values = []; let match; const pattern = new RegExp(DAY_PATTERN.source, 'g');
  while ((match = pattern.exec(quote))) values.push({ value: match[1], text: match[0] });
  if (values.length === 0) return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_DAY_COUNT' });
  if (values.length > 1) return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_DAY_COUNTS' });
  const found = values[0];
  return Object.freeze({ outcome: 'RESOLVED', canonical_value: found.value, matched_text: quote });
}
module.exports = Object.freeze({ FINANCING_DAY_COUNT_PARSE_VERSION, parseFinancingDayCount });
