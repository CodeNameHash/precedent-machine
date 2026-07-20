const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('components/review-v2/ProvisionIndex.jsx', 'utf8');
const compareSource = fs.readFileSync('components/review-v2/CompareColumn.jsx', 'utf8');
const start = source.indexOf('export function DefinitionsSection');
const definitionsSource = source.slice(start);

test('DefinitionsSection puts See provision under Term and keeps the clean definition summary in its column', () => {
  assert.ok(start >= 0);
  assert.equal((definitionsSource.match(/<th\b/g) || []).length, 2);
  assert.match(definitionsSource, />Definition<\/th>/);
  assert.match(definitionsSource, /const definitionText = definitionSummaryForDisplay\(def\)/);
  assert.match(definitionsSource, /\{def\.defined_term\}[\s\S]*See provision[\s\S]*\{definitionText\}/);
  assert.match(definitionsSource, /data-testid="definition-full-text-row"/);
  assert.doesNotMatch(definitionsSource, /<summary[^>]*>full text<\/summary>/);
});

test('unified definitions keep source expansion beneath Term and sanitize captured definition text', () => {
  assert.match(compareSource, /definitionTextForDisplay/);
  assert.match(compareSource, /className="term-cell-seetext block"/);
  assert.match(compareSource, /data-testid="unified-definition-full-text-row"/);
  assert.doesNotMatch(compareSource, />full text<\/summary>/);
});
