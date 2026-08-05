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
  // seeTextNode() used to build its own inline <details><summary>See
  // provision</summary>...</details> -- it now renders through the shared
  // SeeProvisionDisclosure (components/review/primitives/
  // ProvisionTablePrimitives.jsx), which every other "See provision"
  // disclosure in the app also uses. That component is what stops Chrome's
  // find-in-page from force-opening every closed clause at once (see its
  // own header comment and clauseSearchMode.js) while still defaulting the
  // affordance to read "See provision" -- checked directly against
  // SeeProvisionDisclosure's own default `label` prop, not duplicated here.
  const seeTextNodeFn = MAE.match(/function seeTextNode\(text\) \{[\s\S]*?\n\}/);
  assert.ok(seeTextNodeFn, 'seeTextNode() must still exist');
  assert.match(seeTextNodeFn[0], /<SeeProvisionDisclosure/, 'seeTextNode renders the shared See-provision disclosure, not a bare <details>');
  assert.match(MAE, /import \{[^}]*SeeProvisionDisclosure[^}]*\} from '\.\.\/review\/primitives\/ProvisionTablePrimitives';/);
});

test('grouped compare rows use source-backed fallback text when no bespoke expansion was supplied', () => {
  assert.match(COMPARE, /function groupedExpansionContent\(row\)/);
  assert.match(COMPARE, /return row\?\.seeTextContent \|\| unifiedFallbackEvidence\(row\)/);
  assert.match(COMPARE, /const expansionContent = groupedExpansionContent\(row\)/);
});
