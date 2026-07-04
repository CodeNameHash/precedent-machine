// FB3 item 5 — TERMR-OUTSIDE outsideDateMonthsPostSigning / extensionMonths:
// pure date math off the deal's signing date (deals.announce_date / the
// agreement's own "dated as of" date, threaded in as dealMeta.signingDate)
// and the LLM-normalized outsideDateISO / extendedOutsideDateISO fields.
// Deterministic — no LLM call, and null whenever either date is missing.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  monthsBetweenRounded,
  computeOutsideDateMonths,
  buildFeatureInstructions,
} = require('../lib/parser-v2/extract.js');
const { getFeaturesForType } = require('../lib/rubric');

function fieldFor(type, key) {
  return getFeaturesForType(type).find((f) => f.key === key);
}

test('outsideDateISO / extendedOutsideDateISO / outsideDateMonthsPostSigning / extensionMonths are registered on TERMR-OUTSIDE only', () => {
  for (const key of ['outsideDateISO', 'extendedOutsideDateISO', 'outsideDateMonthsPostSigning', 'extensionMonths']) {
    assert.ok(fieldFor('TERMR-OUTSIDE', key), `TERMR-OUTSIDE must declare ${key}`);
  }
  const monthsField = fieldFor('TERMR-OUTSIDE', 'outsideDateMonthsPostSigning');
  assert.equal(monthsField.source, 'post-pass');
});

test('monthsBetweenRounded rounds to the nearest whole month (Metsera: 2025-09-21 signing -> 2026-03-21 outside date = 6 months)', () => {
  assert.equal(monthsBetweenRounded('2025-09-21', '2026-03-21'), 6);
});

test('monthsBetweenRounded: extension from 2026-03-21 to 2026-06-21 is 3 months', () => {
  assert.equal(monthsBetweenRounded('2026-03-21', '2026-06-21'), 3);
});

test('monthsBetweenRounded returns null when either date is missing or unparseable', () => {
  assert.equal(monthsBetweenRounded(null, '2026-03-21'), null);
  assert.equal(monthsBetweenRounded('2025-09-21', undefined), null);
  assert.equal(monthsBetweenRounded('not-a-date', '2026-03-21'), null);
});

test('monthsBetweenRounded returns null for a reversed (negative) span, never a negative number', () => {
  assert.equal(monthsBetweenRounded('2026-03-21', '2025-09-21'), null);
});

test('computeOutsideDateMonths stamps both fields on the Metsera-shaped TERMR-OUTSIDE provision', () => {
  const termr = {
    type: 'TERMR',
    code: 'TERMR-OUTSIDE',
    features: {
      outsideDateISO: '2026-03-21',
      extendedOutsideDateISO: '2026-06-21',
    },
  };
  computeOutsideDateMonths([termr], { signingDate: '2025-09-21' });
  assert.equal(termr.features.outsideDateMonthsPostSigning, 6);
  assert.equal(termr.features.extensionMonths, 3);
});

test('computeOutsideDateMonths leaves both fields null when no extended date exists (no automatic extension)', () => {
  const termr = {
    type: 'TERMR',
    code: 'TERMR-OUTSIDE',
    features: { outsideDateISO: '2026-03-21' },
  };
  computeOutsideDateMonths([termr], { signingDate: '2025-09-21' });
  assert.equal(termr.features.outsideDateMonthsPostSigning, 6);
  assert.equal(termr.features.extensionMonths, null);
});

test('computeOutsideDateMonths leaves outsideDateMonthsPostSigning null when dealMeta has no signingDate', () => {
  const termr = {
    type: 'TERMR',
    code: 'TERMR-OUTSIDE',
    features: { outsideDateISO: '2026-03-21' },
  };
  computeOutsideDateMonths([termr], {});
  assert.equal(termr.features.outsideDateMonthsPostSigning, null);
});

test('computeOutsideDateMonths never touches other TERMR codes', () => {
  const mutual = { type: 'TERMR', code: 'TERMR-MUTUAL', features: {} };
  computeOutsideDateMonths([mutual], { signingDate: '2025-09-21' });
  assert.equal('outsideDateMonthsPostSigning' in mutual.features, false);
});

test('the TERMR prompt tells the model NOT to populate the post-pass-only month fields', () => {
  const instr = buildFeatureInstructions('TERMR');
  assert.match(instr, /outsideDateISO/);
  assert.match(instr, /extendedOutsideDateISO/);
  assert.match(instr, /computed deterministically by a post-pass/);
});
