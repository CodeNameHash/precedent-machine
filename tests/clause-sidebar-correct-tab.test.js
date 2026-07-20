const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const SOURCE = fs.readFileSync('components/review-v2/ClauseSidebar.jsx', 'utf8');

test('Correct tab posts to the submit endpoint with the editor-key header', () => {
  assert.match(SOURCE, /fetch\('\/api\/corrections\/submit'/);
  assert.match(SOURCE, /'x-editor-key':\s*editorKey/);
  assert.match(SOURCE, /mtx_editor_key/);
});

test('Correct tab form covers every field the spec lists', () => {
  assert.match(SOURCE, /WRONG_KINDS/);
  assert.match(SOURCE, /'code'/);
  assert.match(SOURCE, /'party'/);
  assert.match(SOURCE, /'value'/);
  assert.match(SOURCE, /'quote'/);
  assert.match(SOURCE, /'other'/);
  assert.match(SOURCE, /Proposed fix/);
  assert.match(SOURCE, /Rationale \(required\)/);
  assert.match(SOURCE, /Your name/);
  assert.match(SOURCE, /Editor key/);
});

test('Correct tab distinguishes applied vs queued outcomes with the spec copy', () => {
  assert.match(SOURCE, /Applied to the corpus\./);
  assert.match(SOURCE, /Queued for weekly review\./);
  assert.match(SOURCE, /data-outcome=\{result\.outcome\}/);
});

test('Correct tab claim dropdown reads from the card\'s features (attribute — current value)', () => {
  assert.match(SOURCE, /cardClaimOptions/);
  assert.match(SOURCE, /c\.attribute.*—.*c\.valueText/);
});

test('Correct tab requires kind + proposed + rationale before enabling submit', () => {
  assert.match(SOURCE, /canSubmit = kind && proposed\.trim\(\) && rationale\.trim\(\) && !submitting/);
});

// r13 (Ben, "No corpus comparison captured for this row yet" investigation):
// a row only gets rowContext.features/instrument when it actually asked
// (featureKeys or itemCode) -- for rows that structurally never ask (a
// bundled negative-covenant row, a deal-specific fragment row), the empty
// state should read as "not applicable" rather than "we looked and found
// nothing", while rows that DID ask and came back empty keep the original,
// more alarming copy (a genuine coverage gap).
test('RowCorpusContext distinguishes a genuine empty corpus answer from a row that never asked', () => {
  assert.match(SOURCE, /function rowRequestedCorpusContext\(rowFocus\)/);
  assert.match(SOURCE, /row-corpus-context-empty-genuine/);
  assert.match(SOURCE, /row-corpus-context-empty-uncomparable/);
  assert.match(SOURCE, /No corpus comparison captured for this row yet\./);
  assert.match(SOURCE, /doesn&apos;t map to a single comparable feature/);
});

test('rowRequestedCorpusContext logic: only featureKeys/itemCode count as "asked"', () => {
  // Re-implements the exact predicate (source-only test runner, no JSX
  // loader -- see the file-header convention above) to pin its behavior
  // independent of the component's render tree.
  function rowRequestedCorpusContext(rowFocus) {
    if (!rowFocus) return false;
    if (Array.isArray(rowFocus.featureKeys) && rowFocus.featureKeys.length) return true;
    if (rowFocus.itemCode) return true;
    return false;
  }
  assert.equal(rowRequestedCorpusContext(null), false);
  assert.equal(rowRequestedCorpusContext({ label: 'Some row' }), false, 'label alone is not a request');
  assert.equal(rowRequestedCorpusContext({ label: 'Some row', featureKeys: [] }), false, 'empty featureKeys array is not a request');
  assert.equal(rowRequestedCorpusContext({ label: 'Some row', featureKeys: ['noticePeriod'] }), true);
  assert.equal(rowRequestedCorpusContext({ label: 'Some row', itemCode: 'STOCK_OPTIONS' }), true);
});

test('no serif typography anywhere in the sidebar (Inter/mono only)', () => {
  // Strip // comments before scanning — the file's own header documents the
  // "no serif" rule in prose, which would otherwise self-trigger this check.
  const code = SOURCE.split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
  assert.doesNotMatch(code, /serif/i);
  assert.doesNotMatch(code, /Georgia|Times New Roman|font-display/i);
  assert.match(code, /var\(--mtx-sans\)/);
});

test('Correct tab reuses the sidebar\'s existing LAB/SEL style constants', () => {
  assert.match(SOURCE, /className={LAB}/);
  assert.match(SOURCE, /className={SEL}/);
});

test('current deal values are marked inline and numeric context shows all six statistics', () => {
  assert.doesNotMatch(SOURCE, /function ThisDealPill/);
  assert.match(SOURCE, /this-deal-inline-marker/);
  assert.match(SOURCE, /function NumericScale\(\{ min, p25, median, mean, p75, max, value, format \}\)/);
  for (const label of ['Min', 'P25', 'Median', 'Mean', 'P75', 'Max']) assert.match(SOURCE, new RegExp(`label: '${label}'`));
});

test('row corpus context supports local bringdown treatment and item frequency', () => {
  assert.match(SOURCE, /function CurrentTreatmentBlock/);
  assert.match(SOURCE, /No peer treatment inferred/);
  assert.match(SOURCE, /function ItemFrequencySummary/);
  assert.match(SOURCE, /row-item-frequency/);
});
