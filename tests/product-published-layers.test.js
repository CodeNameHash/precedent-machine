'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');

require.extensions['.jsx'] = function compileJsx(module, filename) {
  const transformed = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};

const { groupPublishedFacts } = require('../lib/product/published-layers');
const legalSchema = require('../contracts/product/legal-schema.v1.json');
const PublishedSummary = require('../components/product/PublishedSummary.jsx').default;

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/published-layers-fixture.v2.json'), 'utf8'));

test('groupPublishedFacts orders families by the legal schema and drops coverage_only facts', () => {
  const groups = groupPublishedFacts(fixture.facts, legalSchema);
  assert.deepEqual(groups.map((group) => group.family_key), ['TERMINATION_FEE', 'MAE_DEFINITION', 'MATERIAL_CONTRACTS']);
  assert.deepEqual(groups.flatMap((group) => group.facts.map((fact) => fact.fact_id)), [
    'f-termination-fee-trigger-1', 'f-mae-carveout-1', 'f-material-contracts-1',
  ]);
  const allIds = groups.flatMap((group) => group.facts.map((fact) => fact.fact_id));
  assert.ok(!allIds.includes('f-boilerplate-notices-1'));
});

test('groupPublishedFacts orders facts within a family by section reference', () => {
  const facts = [
    { fact_id: 'b', family_key: 'MAE_DEFINITION', section_reference: '1.1(c)', coverage_only: false },
    { fact_id: 'a', family_key: 'MAE_DEFINITION', section_reference: '1.1(a)', coverage_only: false },
  ];
  const groups = groupPublishedFacts(facts, legalSchema);
  assert.deepEqual(groups[0].facts.map((fact) => fact.fact_id), ['a', 'b']);
});

test('an empty family list yields no groups and coverage_only facts never surface', () => {
  assert.deepEqual(groupPublishedFacts([], legalSchema), []);
  const onlyCoverage = [{ fact_id: 'x', family_key: 'MAE_DEFINITION', section_reference: '1.1', coverage_only: true }];
  assert.deepEqual(groupPublishedFacts(onlyCoverage, legalSchema), []);
});

const groups = groupPublishedFacts(fixture.facts, legalSchema);

test('the published summary shows headlines only, families in schema order, coverage_only absent', () => {
  const html = renderToStaticMarkup(React.createElement(PublishedSummary, { groups, onSource: () => {} }));
  const feeIndex = html.indexOf('Termination fee');
  const maeIndex = html.indexOf('MAE definition');
  const mcIndex = html.indexOf('Material contracts');
  assert.ok(feeIndex >= 0 && maeIndex > feeIndex && mcIndex > maeIndex);
  assert.match(html, /MAE carve-out/);
  assert.match(html, /Material Contracts category/);
  assert.match(html, /Termination fee trigger/);
  assert.doesNotMatch(html, /Notices mechanism/);
  assert.doesNotMatch(html, /nationally recognized overnight courier/);
  assert.doesNotMatch(html, /to the extent resulting from/);
  assert.doesNotMatch(html, /\[\.\.\.\]/);
  assert.doesNotMatch(html, /data-testid="inherited-word"/);
});

test('expanding a fact reveals its layer text, gap markers and inherited words', () => {
  const html = renderToStaticMarkup(React.createElement(PublishedSummary, { groups, onSource: () => {}, initiallyExpanded: true }));
  assert.match(html, /to the extent resulting from/);
  assert.match(html, /\[\.\.\.\]/);
  assert.match(html, /data-testid="inherited-word"/);
  assert.match(html, /data-testid="canonical-value"[^>]*>750000 USD/);
  assert.match(html, /title="Parent may terminate if the Support Agreement has not been delivered by the Consent Time\."/);
});

test('every published fact has a citation button', () => {
  const html = renderToStaticMarkup(React.createElement(PublishedSummary, { groups, onSource: () => {} }));
  const factCount = groups.reduce((total, group) => total + group.facts.length, 0);
  assert.equal((html.match(/data-testid="citation-button"/g) || []).length, factCount);
});
