'use strict';

const PROXY_MEETING_PARSE_VERSION = 1;
const SPELLED = Object.freeze({
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  fifteen: '15', twenty: '20', 'twenty-five': '25', thirty: '30', 'forty-five': '45',
});
const SECTION_REFERENCE = /\bSection\s+\d+(?:\.\d+)*(?:\([^)]+\))*/gi;
const CURRENCY = /\$\s*\d[\d,]*(?:\.\d+)?/g;
const ORDINAL = /\b(?:\w+\s+)?\(?\d+(?:st|nd|rd|th)\)?\s+(?:business\s+|calendar\s+)?days?\b/i;

function cleaned(quote) {
  return String(quote || '').replace(SECTION_REFERENCE, '').replace(CURRENCY, '');
}

function hybridCheck(prefix, value) {
  const word = prefix.trim().split(/\s+/).pop().toLowerCase();
  return SPELLED[word] && SPELLED[word] !== value;
}

function parseDayCount(quote) {
  const text = cleaned(quote);
  if (ORDINAL.test(text)) return Object.freeze({ outcome: 'ABSTAIN', reason: 'ORDINAL_DAY_FORM' });
  const matches = [...text.matchAll(/(?:\b([A-Za-z-]+)\s+)?\(?([0-9]+)\)?\s+(?:(business|calendar)\s+)?days?\b/gi)];
  if (matches.length === 0) return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_DAY_COUNT' });
  if (matches.length !== 1) return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_DAY_COUNTS' });
  const match = matches[0];
  if (match[1] && hybridCheck(match[1], match[2])) return Object.freeze({ outcome: 'ABSTAIN', reason: 'SPELLED_DIGIT_MISMATCH' });
  return Object.freeze({ outcome: 'RESOLVED', canonical_value: match[2], matched_text: match[0] });
}

function parseAdjournmentCount(quote) {
  const text = cleaned(quote);
  const matches = [...text.matchAll(/(?:\b([A-Za-z-]+)\s+)?\(?([0-9]+)\)?\s+(?:times?|such\s+(?:postponement|adjournments?))\b/gi)];
  if (matches.length === 0) {
    return /\b(?:one|two|three|four|five)\s+times?\b/i.test(text)
      ? Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' })
      : Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_OCCURRENCE_COUNT' });
  }
  if (matches.length !== 1) return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_OCCURRENCE_COUNTS' });
  const match = matches[0];
  if (match[1] && hybridCheck(match[1], match[2])) return Object.freeze({ outcome: 'ABSTAIN', reason: 'SPELLED_DIGIT_MISMATCH' });
  return Object.freeze({ outcome: 'RESOLVED', canonical_value: match[2], matched_text: match[0] });
}

module.exports = { PROXY_MEETING_PARSE_VERSION, parseDayCount, parseAdjournmentCount };
