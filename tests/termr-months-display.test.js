// FB3 missed item 4 — render outsideDateMonthsPostSigning / extensionMonths
// (already stamped by the computeOutsideDateMonths post-pass — see
// tests/termr-outside-date-months.test.js for the data-layer coverage) in
// the Termination Rights outside-date row: "Outside date: [date] (~N months
// post-signing)" and the extension folded in as "+M months". Nothing
// invented — rendered ONLY when the fields exist.
//
// pages/review/[id].js is JSX and can't be imported under node --test; this
// file follows the established source-text pattern (see tests/fb3-wiring.test.js)
// plus re-verifies the data layer these strings are built from.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { computeOutsideDateMonths } = require('../lib/parser-v2/extract.js');

const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');

function sliceFn(name) {
  const start = reviewSrc.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} present`);
  return reviewSrc.slice(start, reviewSrc.indexOf('\n}', start));
}

test('formatIsoDateReadable formats a stored ISO date as a readable calendar date, null for anything unparseable', () => {
  const body = sliceFn('formatIsoDateReadable');
  assert.match(body, /toLocaleDateString/);
  assert.match(body, /return null/);
});

test('the "Outside date" row is only added when both outsideDateISO and outsideDateMonthsPostSigning are populated, formatted "(~N months post-signing)"', () => {
  const start = reviewSrc.indexOf("const extensionDetail = outsideProv ? buildOutsideDateExtensionDetail(of) : null;");
  assert.ok(start > 0);
  const body = reviewSrc.slice(start, start + 1800);
  assert.match(body, /outsideMonthsPostSigning = typeof of\.outsideDateMonthsPostSigning === 'number' \? of\.outsideDateMonthsPostSigning : null/);
  assert.match(body, /outsideDateReadable = formatIsoDateReadable\(of\.outsideDateISO\)/);
  assert.match(body, /label: 'Outside date', value: `\$\{outsideDateReadable\} \(~\$\{outsideMonthsPostSigning\} month\$\{outsideMonthsPostSigning === 1 \? '' : 's'\} post-signing\)`/);
});

test('the extension row folds in extensionMonths as "(+M months)" only when extensionMonths is populated', () => {
  const start = reviewSrc.indexOf("const extensionMonths = typeof of.extensionMonths === 'number'");
  assert.ok(start > 0);
  const body = reviewSrc.slice(start, start + 900);
  assert.match(body, /\(\+\$\{extensionMonths\} month\$\{extensionMonths === 1 \? '' : 's'\}\)/);
  assert.match(body, /extensionMonths !== null/, 'gated on the field actually being present');
});

test('data layer: Metsera-shaped outside/extension dates compute the exact months the new rendering displays (6 months to outside date, +3 months extension)', () => {
  const termr = {
    type: 'TERMR',
    code: 'TERMR-OUTSIDE',
    features: { outsideDateISO: '2026-03-21', extendedOutsideDateISO: '2026-06-21' },
  };
  computeOutsideDateMonths([termr], { signingDate: '2025-09-21' });
  assert.equal(termr.features.outsideDateMonthsPostSigning, 6);
  assert.equal(termr.features.extensionMonths, 3);
});
