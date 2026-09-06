'use strict';

const { SECTION_REFERENCE_PATTERN, CLOCK_TIME_PATTERN, CURRENCY_SYMBOLS } = require('../canonical-v2/native-producer/share-count-parse');
const { CALENDAR_DATE_PATTERN } = require('../canonical-v2/native-producer/measurement-date-parse');
const { parseNoShopPeriod, SEC_RULE_CITATION_PATTERN, UNIT_ADJACENCY_PATTERN, STRICT_GROUPING_PATTERN } = require('../canonical-v2/native-producer/no-shop-period-parse');

function parseProductNoShopPeriod(quote) {
  const legacy = parseNoShopPeriod(quote);
  const excluded = [SECTION_REFERENCE_PATTERN, CLOCK_TIME_PATTERN, CALENDAR_DATE_PATTERN, SEC_RULE_CITATION_PATTERN]
    .flatMap((pattern) => [...quote.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
      .map((match) => [match.index, match.index + match[0].length]));
  const candidates = [...quote.matchAll(/\d(?:[\d,]*\d)?(?:\.\d+)?/g)]
    .filter((match) => !excluded.some(([start, end]) => match.index >= start && match.index + match[0].length <= end))
    .filter((match) => !CURRENCY_SYMBOLS.includes(quote.slice(0, match.index).trimEnd().slice(-1)))
    .filter((match) => !/^\s*(?:%|percent\b)/i.test(quote.slice(match.index + match[0].length)))
    .map((match) => ({ digits: match[0], unit: UNIT_ADJACENCY_PATTERN.exec(quote.slice(match.index + match[0].length))?.[1] }))
    .filter((candidate) => candidate.unit);
  if (!candidates.some((candidate) => /^hours?$/i.test(candidate.unit))) return legacy;
  if (candidates.length !== 1) {
    return { outcome: 'ABSTAIN', reason: 'MULTIPLE_PERIOD_LITERALS' };
  }
  const [{ digits, unit }] = candidates;
  if (digits.includes('.')) return { outcome: 'ABSTAIN', reason: 'NON_INTEGER_PERIOD' };
  if (!STRICT_GROUPING_PATTERN.test(digits)) return { outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING' };
  return { outcome: 'RESOLVED', canonical_value: digits.replace(/,/g, ''), unit: 'HOURS', unit_phrase: unit, matched_text: digits };
}

function canonicalPeriodUnit(value) {
  if (typeof value !== 'string') return null;
  const normal = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (/^hours?$/.test(normal)) return 'HOURS';
  if (/^business days?$/.test(normal)) return 'BUSINESS_DAYS';
  if (/^(calendar )?days?$/.test(normal)) return 'CALENDAR_DAYS';
  return null;
}

module.exports = { canonicalPeriodUnit, parseProductNoShopPeriod };
