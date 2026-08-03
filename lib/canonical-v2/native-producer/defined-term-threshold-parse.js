'use strict';

const DEFINED_TERM_THRESHOLD_PARSE_VERSION = 1;
const PERCENT = /\d+(?:\.\d+)?%/g;
const NUMBER_WORD = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)';
const WORD_PERCENT = new RegExp(`\\b${NUMBER_WORD}(?:[ -]${NUMBER_WORD})*\\s+percent\\b`, 'i');

const SUBSTITUTION_PATTERNS = Object.freeze([
  /references\s+to[\s\S]{0,160}?\d+(?:\.\d+)?%[\s\S]{0,220}?deemed\s+to\s+be\s+references\s+to[\s\S]{0,160}?\d+(?:\.\d+)?%/gi,
  /references[\s\S]{0,160}?to[\s\S]{0,100}?\d+(?:\.\d+)?%[\s\S]{0,180}?shall\s+instead\s+refer\s+to[\s\S]{0,100}?\d+(?:\.\d+)?%/gi,
  /changed\s+from[\s\S]{0,100}?\d+(?:\.\d+)?%[\s\S]{0,100}?to[\s\S]{0,100}?\d+(?:\.\d+)?%/gi,
]);

const SUBSTITUTION_LANGUAGE = /(?:deemed\s+to\s+be\s+references\s+to|shall\s+instead\s+refer\s+to|changed\s+from[\s\S]{0,100}?to)/i;

function abstain(reason) {
  return Object.freeze({ outcome: 'ABSTAIN', reason });
}

function percentTokens(text) {
  return [...text.matchAll(PERCENT)].filter((match) => {
    const prefix = text.slice(Math.max(0, match.index - 16), match.index);
    return !/[$€£]\s*$/.test(prefix);
  }).map((match) => ({
    text: match[0],
    value: match[0].slice(0, -1),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function substitutionMatches(text) {
  const matches = [];
  for (const pattern of SUBSTITUTION_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const tokens = percentTokens(match[0]).map((token) => ({
        ...token,
        start: token.start + match.index,
        end: token.end + match.index,
      }));
      matches.push({ text: match[0], start: match.index, end: match.index + match[0].length, tokens });
    }
  }
  return matches.sort((left, right) => left.start - right.start || left.end - right.end);
}

function parsePercentThreshold(quote) {
  if (typeof quote !== 'string' || quote.length === 0) return abstain('NO_PERCENT_LITERAL');
  if (SUBSTITUTION_LANGUAGE.test(quote)) return abstain('SUBSTITUTION_GRAMMAR_PRESENT');
  const tokens = percentTokens(quote);
  if (tokens.length > 1) return abstain('MULTIPLE_PERCENT_LITERALS');
  if (tokens.length === 0) {
    return abstain(WORD_PERCENT.test(quote) ? 'NON_LITERAL_PERCENT' : 'NO_PERCENT_LITERAL');
  }
  return Object.freeze({
    outcome: 'RESOLVED',
    canonical_value: tokens[0].value,
    matched_text: tokens[0].text,
    parse_version: DEFINED_TERM_THRESHOLD_PARSE_VERSION,
  });
}

function parseThresholdSubstitution(quote) {
  if (typeof quote !== 'string' || quote.length === 0) return abstain('NO_SUBSTITUTION_GRAMMAR');
  const matches = substitutionMatches(quote);
  if (matches.length === 0) {
    if (SUBSTITUTION_LANGUAGE.test(quote) && WORD_PERCENT.test(quote)) {
      return abstain('NON_LITERAL_PERCENT');
    }
    return abstain('NO_SUBSTITUTION_GRAMMAR');
  }
  if (matches.length > 1) return abstain('MULTIPLE_SUBSTITUTION_PAIRS');
  const [match] = matches;
  if (match.tokens.length !== 2) return abstain('EXTRA_PERCENT_LITERALS');
  const allTokens = percentTokens(quote);
  const paired = new Set(match.tokens.map((token) => `${token.start}:${token.end}`));
  if (allTokens.some((token) => !paired.has(`${token.start}:${token.end}`))) {
    return abstain('EXTRA_PERCENT_LITERALS');
  }
  return Object.freeze({
    outcome: 'RESOLVED',
    canonical_value: match.tokens[1].value,
    substitution_from_percent: match.tokens[0].value,
    matched_text: match.text,
    parse_version: DEFINED_TERM_THRESHOLD_PARSE_VERSION,
  });
}

module.exports = {
  DEFINED_TERM_THRESHOLD_PARSE_VERSION,
  parsePercentThreshold,
  parseThresholdSubstitution,
};
