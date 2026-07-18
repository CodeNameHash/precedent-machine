// Span accounting spec (docs/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md),
// Part 3 (REPORT-ONLY) — lib/parser-v2/span-residual.js and validate.js's
// computeSpanResidualReport wiring.
const test = require('node:test');
const assert = require('node:assert/strict');

const { computeSectionResidual } = require('../lib/parser-v2/span-residual.js');
const { validateProvisions, computeSpanResidualReport } = require('../lib/parser-v2/validate.js');

// A 3-leaf section: chapeau boilerplate + two substantive top-level items,
// each comfortably over the 200-char minimum-leaf-size floor.
function buildSection() {
  const chapeau = 'Each of the following conditions must be satisfied: ';
  const a = '(a)' + 'The Company shall deliver a certificate as to due organization and good standing in each jurisdiction where it conducts material business, '.repeat(2);
  const b = '(b)' + 'Parent shall have received an opinion of counsel reasonably satisfactory to it as to the enforceability of this Agreement against the Company, '.repeat(2);
  return chapeau + '\n\n' + a + '\n\n' + b;
}

test('a fully-claimed section has zero residual and is not flagged', () => {
  const text = buildSection();
  // Claim BOTH leaves fully by passing spans covering the whole text.
  const claimedSpans = [{ start: 0, end: text.length }];
  const result = computeSectionResidual(text, claimedSpans);
  assert.equal(result.flagged, false);
  assert.equal(result.residualChars, 0);
  assert.deepEqual(result.drops, []);
});

test('an unclaimed leaf whose share of the section exceeds 25% is flagged EXTRACTION_INCOMPLETE', () => {
  const text = buildSection();
  // Only claim leaf (a) — (b) (roughly half the section) goes unclaimed.
  const aStart = text.indexOf('(a)');
  const aEnd = text.indexOf('(b)');
  const claimedSpans = [{ start: aStart, end: aEnd }];
  const result = computeSectionResidual(text, claimedSpans);
  assert.equal(result.flagged, true);
  assert.equal(result.flagReason, 'EXTRACTION_INCOMPLETE');
  assert.ok(result.drops.length >= 1);
  assert.equal(result.drops[0].marker, 'b');
  assert.ok(result.drops[0].preview.length > 0);
});

test('a single unclaimed leaf over 1,500 chars flags even if the overall ratio is under 25%', () => {
  const huge = '(a)' + 'This is a single very long unclaimed sub-clause that goes on and on describing indemnification obligations in exhaustive detail. '.repeat(20);
  const small = '(b)' + 'Short second clause that is claimed and therefore excluded from the residual entirely regardless of size here.';
  const text = huge + '\n\n' + small;
  const bStart = text.indexOf('(b)');
  const claimedSpans = [{ start: bStart, end: text.length }]; // only (b) claimed
  const result = computeSectionResidual(text, claimedSpans);
  assert.equal(result.flagged, true);
  assert.ok(result.drops[0].length > 1500);
});

test('leaves under 200 normalized chars are ignored even when fully unclaimed', () => {
  const text = '(a)Short.\n\n(b)Also short.';
  const result = computeSectionResidual(text, []); // nothing claimed
  assert.equal(result.flagged, false);
  assert.deepEqual(result.drops, []);
});

test('a benign chapeau leaf (pure preamble boilerplate) is excluded from residual', () => {
  const chapeau = 'The obligations of Parent are subject to the satisfaction or waiver of each of the following further conditions:';
  const text = chapeau + '\n\n' + '(a)' + 'Substantive obligation text that is long enough to matter for residual purposes and clears the 200 char floor easily here. '.repeat(2);
  // Claim (a) fully; chapeau is never claimed by anything.
  const aStart = text.indexOf('(a)');
  const result = computeSectionResidual(text, [{ start: aStart, end: text.length }]);
  assert.equal(result.flagged, false);
  assert.deepEqual(result.drops, []);
});

// ---------------------------------------------------------------------------
// validate.js wiring — inert unless opts.spanResidual === true.
// ---------------------------------------------------------------------------
test('validateProvisions does not attach span_residual without opts.spanResidual === true', () => {
  const provisions = [{ type: 'MISC', code: 'MISC-1', category: 'x', text: 'x', startChar: 0, features: {} }];
  const classifiedSections = [{ startChar: 0, text: buildSection(), sectionNumber: '1.1' }];
  const { report } = validateProvisions(provisions, 'x', classifiedSections);
  assert.equal(report.span_residual, null);
});

test('validateProvisions attaches span_residual ONLY when opts.spanResidual === true', () => {
  const provisions = [{ type: 'MISC', code: 'MISC-1', category: 'x', text: 'x', startChar: 0, features: {} }];
  const classifiedSections = [{ startChar: 0, text: buildSection(), sectionNumber: '1.1' }];
  const { report } = validateProvisions(provisions, 'x', classifiedSections, { spanResidual: true });
  assert.ok(report.span_residual);
  // No spanClaims on the provision -> conservative: whole section unclaimed -> flagged.
  assert.equal(report.span_residual.sectionsFlagged, 1);
  assert.equal(report.span_residual.flaggedSections[0].sectionNumber, '1.1');
});

test('computeSpanResidualReport is directly callable and returns null for no sections', () => {
  assert.equal(computeSpanResidualReport(null, []), null);
  assert.equal(computeSpanResidualReport([], []), null);
});
