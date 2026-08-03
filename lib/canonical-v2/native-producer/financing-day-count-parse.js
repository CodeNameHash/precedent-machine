'use strict';

const {
  CLOCK_TIME_PATTERN,
  CURRENCY_SYMBOLS,
  SECTION_REFERENCE_PATTERN,
} = require('./share-count-parse');
const { CALENDAR_DATE_PATTERN } = require('./measurement-date-parse');

const FINANCING_DAY_COUNT_PARSE_VERSION = 1;
const DIGIT_TOKEN_PATTERN = /\d+/g;
const DAY_WORD_ADJACENCY_PATTERN = /^\)?\s*(?:consecutive\s+)?((?:business\s+)?days?)\b/i;
const NON_LITERAL_DAY_PATTERN = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(?:consecutive\s+)?(?:business\s+)?days?\b/i;
const SPELLED_NUMBER_VALUES = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
});

function allMatches(pattern, text) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  const matches = [];
  let match = matcher.exec(text);
  while (match) {
    matches.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    if (match[0].length === 0) matcher.lastIndex += 1;
    match = matcher.exec(text);
  }
  return matches;
}

function precedingSpelledWord(quote, start) {
  if (quote[start - 1] !== '(') return null;
  const prefix = quote.slice(0, start - 1).match(/([A-Za-z]+)\s*$/);
  return prefix ? prefix[1].toLowerCase() : null;
}

function containingParenthetical(quote, offset) {
  const stack = [];
  const pairs = [];
  for (let index = 0; index < quote.length; index += 1) {
    if (quote[index] === '(') stack.push(index);
    if (quote[index] === ')' && stack.length > 0) {
      const start = stack.pop();
      const content = quote.slice(start + 1, index);
      if (start < offset && offset < index && !/^\d+$/.test(content)) {
        pairs.push({ start, end: index + 1 });
      }
    }
  }
  pairs.sort((left, right) => right.start - left.start);
  return pairs[0] || null;
}

function governingWindow(quote, offset) {
  const parenthetical = containingParenthetical(quote, offset);
  if (parenthetical) return quote.slice(parenthetical.start, parenthetical.end);
  const before = quote.slice(0, offset);
  const after = quote.slice(offset);
  const priorTerminal = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'));
  const nextTerminalOffsets = ['.', '!', '?']
    .map((terminal) => after.indexOf(terminal))
    .filter((index) => index >= 0);
  const nextTerminal = nextTerminalOffsets.length > 0 ? Math.min(...nextTerminalOffsets) : after.length - 1;
  return quote.slice(priorTerminal + 1, offset + nextTerminal + 1).trim();
}

function parseFinancingDayCount(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseFinancingDayCount requires a non-empty quote');
  }

  const excluded = [
    ...allMatches(SECTION_REFERENCE_PATTERN, quote),
    ...allMatches(CALENDAR_DATE_PATTERN, quote),
    ...allMatches(CLOCK_TIME_PATTERN, quote),
  ];
  const dayCandidates = allMatches(DIGIT_TOKEN_PATTERN, quote).filter((token) => {
    if (excluded.some((span) => token.start >= span.start && token.end <= span.end)) return false;
    let prior = token.start - 1;
    while (prior >= 0 && /\s/.test(quote[prior])) prior -= 1;
    if (prior >= 0 && CURRENCY_SYMBOLS.includes(quote[prior])) return false;
    if (/^\s?(?:%|percent\b)/i.test(quote.slice(token.end))) return false;
    return DAY_WORD_ADJACENCY_PATTERN.test(quote.slice(token.end));
  });

  if (dayCandidates.length === 0) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: NON_LITERAL_DAY_PATTERN.test(quote) ? 'NON_LITERAL_NUMERAL' : 'NO_DAY_COUNT',
    });
  }
  if (dayCandidates.length > 1) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_DAY_COUNTS' });
  }

  const token = dayCandidates[0];
  const spelledWord = precedingSpelledWord(quote, token.start);
  if (spelledWord && Object.hasOwn(SPELLED_NUMBER_VALUES, spelledWord)
    && SPELLED_NUMBER_VALUES[spelledWord] !== Number(token.text)) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: 'SPELLED_DIGIT_MISMATCH',
      matched_text: governingWindow(quote, token.start),
    });
  }

  return Object.freeze({
    outcome: 'RESOLVED',
    canonical_value: token.text,
    matched_text: governingWindow(quote, token.start),
  });
}

module.exports = Object.freeze({
  DAY_WORD_ADJACENCY_PATTERN,
  FINANCING_DAY_COUNT_PARSE_VERSION,
  parseFinancingDayCount,
});
