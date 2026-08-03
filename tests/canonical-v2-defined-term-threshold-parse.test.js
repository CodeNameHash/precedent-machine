'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFINED_TERM_THRESHOLD_PARSE_VERSION,
  parsePercentThreshold,
  parseThresholdSubstitution,
} = require('../lib/canonical-v2/native-producer/defined-term-threshold-parse');

const CARD_751D3F42_EQUITY_LIMB = 'securities representing more than 15% of the total outstanding equity securities of the Company';
const DEAL_667447F0_DEEMED = 'with all references to "twenty percent (20%)" included in the definition of Acquisition Proposal deemed to be references to "fifty percent (50%)"';
const DEAL_DC042001_INSTEAD = 'all references in the definition of Acquisition Proposal to 20% shall instead refer to 50%';
const CARD_74EAFCF0_CHANGED = 'with the percentages set forth in the definition thereof changed from 15% to 50%';

test('percent thresholds resolve one digit percent literal and preserve the decimal text', () => {
  assert.deepEqual(parsePercentThreshold('more than 15.5% of the outstanding shares'), {
    outcome: 'RESOLVED',
    canonical_value: '15.5',
    matched_text: '15.5%',
    parse_version: DEFINED_TERM_THRESHOLD_PARSE_VERSION,
  });
  assert.deepEqual(parsePercentThreshold('twenty percent (20%) of the assets'), {
    outcome: 'RESOLVED',
    canonical_value: '20',
    matched_text: '20%',
    parse_version: DEFINED_TERM_THRESHOLD_PARSE_VERSION,
  });
  assert.equal(parsePercentThreshold(CARD_751D3F42_EQUITY_LIMB).canonical_value, '15');
});

test('percent thresholds abstain on multiple, absent, word-only, currency-prefixed and substitution values', () => {
  assert.deepEqual(parsePercentThreshold('20% of assets or 20% of revenue'), {
    outcome: 'ABSTAIN', reason: 'MULTIPLE_PERCENT_LITERALS',
  });
  assert.deepEqual(parsePercentThreshold('all or substantially all assets'), {
    outcome: 'ABSTAIN', reason: 'NO_PERCENT_LITERAL',
  });
  assert.deepEqual(parsePercentThreshold('twenty percent of the shares'), {
    outcome: 'ABSTAIN', reason: 'NON_LITERAL_PERCENT',
  });
  assert.deepEqual(parsePercentThreshold('a fee of $ 20%'), {
    outcome: 'ABSTAIN', reason: 'NO_PERCENT_LITERAL',
  });
  assert.deepEqual(parsePercentThreshold('percentages changed from 15% to 50%'), {
    outcome: 'ABSTAIN', reason: 'SUBSTITUTION_GRAMMAR_PRESENT',
  });
});

test('all three grounded substitution grammars resolve FROM and TO without applying them', () => {
  const cases = [
    DEAL_667447F0_DEEMED,
    DEAL_DC042001_INSTEAD,
    CARD_74EAFCF0_CHANGED,
  ];
  const expected = [['20', '50'], ['20', '50'], ['15', '50']];
  cases.forEach((quote, index) => {
    const result = parseThresholdSubstitution(quote);
    assert.equal(result.outcome, 'RESOLVED');
    assert.equal(result.substitution_from_percent, expected[index][0]);
    assert.equal(result.canonical_value, expected[index][1]);
    assert.equal(result.parse_version, DEFINED_TERM_THRESHOLD_PARSE_VERSION);
  });
});

test('substitution parsing abstains instead of choosing among ambiguous operands', () => {
  assert.deepEqual(parseThresholdSubstitution('changed from fifteen percent to fifty percent'), {
    outcome: 'ABSTAIN', reason: 'NON_LITERAL_PERCENT',
  });
  assert.deepEqual(parseThresholdSubstitution('changed from 15% to 50%, subject to 60%'), {
    outcome: 'ABSTAIN', reason: 'EXTRA_PERCENT_LITERALS',
  });
  assert.deepEqual(parseThresholdSubstitution('changed from 15% to 50%; changed from 20% to 60%'), {
    outcome: 'ABSTAIN', reason: 'MULTIPLE_SUBSTITUTION_PAIRS',
  });
  assert.deepEqual(parseThresholdSubstitution('more than 20% of the shares'), {
    outcome: 'ABSTAIN', reason: 'NO_SUBSTITUTION_GRAMMAR',
  });
});
