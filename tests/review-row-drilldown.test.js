const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TABLE = fs.readFileSync('components/review/ProvisionTable.jsx', 'utf8');
const PRIMITIVES = fs.readFileSync('components/review/primitives/ProvisionTablePrimitives.jsx', 'utf8');
const MAE = fs.readFileSync('components/review-v2/MaeSection.jsx', 'utf8');
const COMPARE = fs.readFileSync('components/review-v2/CompareColumn.jsx', 'utf8');

test('flat review rows use the resolved source card for drilldown and provision text', () => {
  const resolveAt = TABLE.indexOf('const rowCard = resolveCard(row)');
  const fallbackAt = TABLE.indexOf('fallbackEvidenceText(row, rowCard)');
  const clickAt = TABLE.indexOf('onSelectCard(rowCard, resolveRowFocus(row))');
  assert.ok(resolveAt >= 0);
  assert.ok(fallbackAt > resolveAt);
  assert.ok(clickAt > fallbackAt);
  assert.match(TABLE, /const objectSource = row\?\.source && typeof row\.source === 'object'/);
  assert.match(TABLE, /objectSource \|\| row\?\.card[\s\S]*row\?\.sourceCards/);
});

test('grouped substantive rows add See provision from evidence or their resolved card', () => {
  assert.match(PRIMITIVES, /const fallbackProvisionText = typeof row\.evidence === 'string'/);
  assert.match(PRIMITIVES, /const expansionContent = row\.seeTextContent \|\| fallbackProvisionText/);
  assert.match(PRIMITIVES, /\{isExpanded \? 'Hide provision' : 'See provision'\}/);
  assert.match(PRIMITIVES, /onSelectCard\(rowCard, resolveRowFocus\(row\)\)/);
});

test('MAE test, carve-out, and exception rows keep source-backed row drilldown and provision affordances', () => {
  assert.match(MAE, /function rowTrProps\(row, onSelectCard, selectedCardId, rowFocus\)/);
  assert.match(MAE, /onClick: \(\) => onSelectCard\(card, rowFocus \|\| resolveRowFocus\(row\)\)/);
  assert.ok((MAE.match(/seeTextNode\(/g) || []).length >= 4);
  assert.match(MAE, />See provision<\/summary>/);
});

test('grouped compare rows use source-backed fallback text when no bespoke expansion was supplied', () => {
  assert.match(COMPARE, /function groupedExpansionContent\(row\)/);
  assert.match(COMPARE, /return row\?\.seeTextContent \|\| unifiedFallbackEvidence\(row\)/);
  assert.match(COMPARE, /const expansionContent = groupedExpansionContent\(row\)/);
});
