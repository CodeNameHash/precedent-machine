const test = require('node:test');
const assert = require('node:assert/strict');

const { formatValue, humanizeEnum, escapeHtml } = require('../../lib/schema/formatters');
const { renderEmpty } = require('../../lib/schema/empty-policy');

test('percent formatters render decimal values as percentages', () => {
  assert.equal(formatValue('percent1dp', 0.0125), '1.3%');
  assert.equal(formatValue('percent2dp', 0.01234), '1.23%');
  assert.equal(formatValue('percent1dp', '0.04'), '4.0%');
});

test('USD formatters render short and long forms', () => {
  assert.equal(formatValue('usd_short', 1_250_000_000), '$1.25B');
  assert.equal(formatValue('usd_short', 12_500_000), '$12.5M');
  assert.equal(formatValue('usd_long', 1_250_000_000), '$1,250,000,000');
});

test('duration formatters pluralise days and months', () => {
  assert.equal(formatValue('months_int', 9), '9 months');
  assert.equal(formatValue('months_int', 1), '1 month');
  assert.equal(formatValue('days_int', 45), '45 days');
  assert.equal(formatValue('days_int', 1, { unit: 'business_days' }), '1 business day');
});

test('enum formatters map raw codes to market-readable labels', () => {
  assert.equal(formatValue('enum_titlecase', 'QUORUM_ABSENT'), 'Quorum failure');
  assert.equal(formatValue('enum_titlecase', 'INSUFFICIENT_VOTES'), 'Insufficient votes');
  assert.equal(humanizeEnum('HELL_OR_HIGH_WATER'), 'Hell Or High Water');
  assert.equal(formatValue('enum_verbatim', 'HELL_OR_HIGH_WATER'), 'HELL_OR_HIGH_WATER');
});

test('object formatters render deadline and tender basis objects', () => {
  assert.equal(formatValue('deadline_object', { days: 60, unit: 'business_days', trigger: 'signing' }), '60 business days from signing');
  assert.equal(formatValue('deadline_object', { days: '45', trigger: 'outside_date' }), '45 days from outside date');
  assert.equal(formatValue('tender_basis', { basis: 'FULLY_DILUTED', thresholdPct: 80 }), '80% of fully diluted');
});

test('generic schema rendering does not leak object coercions', () => {
  assert.equal(formatValue(null, { value: 'Company may respond to a Superior Proposal.', quotes: ['quote'] }), 'Company may respond to a Superior Proposal.');
  assert.equal(formatValue(null, { code: 'HELL_OR_HIGH_WATER' }), 'Hell Or High Water');
  assert.equal(formatValue(null, [{ label: 'Ordinary course exception' }, { text: 'required by law' }]), 'Ordinary course exception; required by law');
  assert.doesNotMatch(formatValue(null, { threshold: { amount: '$10m' } }), /\[object Object\]/);
});

test('quote formatter escapes HTML-sensitive characters', () => {
  assert.equal(escapeHtml('<b>"quoted"</b>'), '&lt;b&gt;&quot;quoted&quot;&lt;/b&gt;');
  assert.equal(formatValue('quote', 'A & B'), 'A &amp; B');
});

test('renderEmpty returns semantic empty-state objects', () => {
  assert.deepEqual(renderEmpty({ key: 'x', whenEmpty: 'silent' }), {
    kind: 'empty',
    state: 'silent',
    label: 'Silent',
    title: 'The agreement is silent on this point.',
    tone: 'muted',
    action: null,
    featureKey: 'x',
  });
  assert.equal(renderEmpty({ key: 'x', whenEmpty: 'needs_review' }).label, 'Needs review');
});
