// Regression tests for lib/instrument-negation.js (fix batch item 2):
// a bare regex hit on an instrument's name is not evidence it's actually
// outstanding — merger agreements routinely name an instrument only to
// negate its existence. Fixtures below are the REAL Metsera sentences that
// motivated the fix: the ESPP wind-down paragraph (affirmative — a real,
// still-outstanding plan being wound down) and the capitalization rep's
// "no ... stock appreciation rights ... issued or outstanding" boilerplate
// (negated — SARs do not exist in this deal at all).
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isNegatedMention,
  firstAffirmativeMention,
  hasAffirmativeMention,
} = require('../lib/instrument-negation.js');

const METSERA_ESPP_WINDDOWN =
  '(e) Company ESPP. Prior to the Effective Time, the Company shall take such ' +
  'actions as are necessary (including obtaining any resolutions of the ' +
  'Company Board or, if appropriate, any committee designated thereby) to ' +
  'provide that: (i) no new offering or new purchase period will commence ' +
  'following the date hereof unless and until this Agreement is terminated; ' +
  '(ii) from and after the date hereof, no new participants will be permitted ' +
  'to participate in the Company ESPP and participants will not be permitted ' +
  'to increase their payroll deductions or purchase elections from those in ' +
  'effect on the date of this Agreement; and (iii) the Company ESPP shall ' +
  'terminate effective no later than ten (10) business days prior to the ' +
  'Effective Time.';

const METSERA_SAR_NEGATION =
  'Since the Measurement Date, there have been no issuances by the Company or ' +
  'any Company Subsidiary of (x) shares of capital stock or other voting ' +
  'securities or equity interests of the Company, (y) options, warrants, ' +
  'rights, convertible or exchangeable securities or other rights to acquire ' +
  'shares of capital stock or other voting securities or equity interests of ' +
  'the Company or (z) restricted shares, stock appreciation rights, ' +
  'contingent value rights, "phantom" stock, stock-based performance units or ' +
  'other rights that give the holder thereof any economic or voting interest.';

test('negative: "no ... stock appreciation rights ... " boilerplate is negated', () => {
  const idx = METSERA_SAR_NEGATION.search(/stock appreciation rights/i);
  assert.ok(idx >= 0);
  assert.equal(isNegatedMention(METSERA_SAR_NEGATION, idx), true);
});

test('positive: ESPP wind-down paragraph is NOT negated, despite several "no ..." idioms nearby', () => {
  const idx = METSERA_ESPP_WINDDOWN.search(/Company ESPP/);
  assert.ok(idx >= 0);
  assert.equal(isNegatedMention(METSERA_ESPP_WINDDOWN, idx), false);
});

test('idiomatic "no later than" / "no new ..." never false-positive as negation', () => {
  const noLaterThanIdx = METSERA_ESPP_WINDDOWN.indexOf('no later than');
  const noNewOfferingIdx = METSERA_ESPP_WINDDOWN.indexOf('no new offering');
  assert.equal(isNegatedMention(METSERA_ESPP_WINDDOWN, noLaterThanIdx), false);
  assert.equal(isNegatedMention(METSERA_ESPP_WINDDOWN, noNewOfferingIdx), false);
});

test('firstAffirmativeMention returns null when every occurrence is negated', () => {
  const re = /\bstock\s+appreciation\s+rights?\b/i;
  assert.equal(firstAffirmativeMention(re, METSERA_SAR_NEGATION), null);
  assert.equal(hasAffirmativeMention(re, METSERA_SAR_NEGATION), false);
});

test('firstAffirmativeMention finds the real match when the mention is affirmative', () => {
  const re = /\bESPP\b/;
  const m = firstAffirmativeMention(re, METSERA_ESPP_WINDDOWN);
  assert.ok(m, 'ESPP mention found');
  assert.equal(hasAffirmativeMention(re, METSERA_ESPP_WINDDOWN), true);
});

test('a mention negated on its first occurrence but affirmed later is still found', () => {
  const text =
    'There are no Company Warrants outstanding as of the date hereof. ' +
    'Each Company Warrant outstanding immediately prior to the Effective Time ' +
    'shall be canceled in exchange for the Merger Consideration.';
  const re = /\bCompany\s+Warrants?\b/;
  const m = firstAffirmativeMention(re, text);
  assert.ok(m, 'a later, non-negated mention is found');
  assert.ok(text.slice(m.index).startsWith('Company Warrant '), 'matched the SECOND (affirmative) occurrence');
});
