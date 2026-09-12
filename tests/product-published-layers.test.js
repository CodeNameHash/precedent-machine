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
const publishedSummaryModule = require('../components/product/PublishedSummary.jsx');
const PublishedSummary = publishedSummaryModule.default;
const { PublishedFact } = publishedSummaryModule;

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/published-layers-fixture.v2.json'), 'utf8'));

test('groupPublishedFacts orders families by the legal schema and puts coverage_only facts last, collapsed', () => {
  const groups = groupPublishedFacts(fixture.facts, legalSchema);
  assert.deepEqual(groups.map((group) => group.family_key), ['TERMINATION_FEE', 'MAE_DEFINITION', 'MATERIAL_CONTRACTS', 'MISC_BOILERPLATE']);
  assert.deepEqual(groups.map((group) => group.collapsed), [false, false, false, true]);
  assert.deepEqual(groups.flatMap((group) => group.facts.map((fact) => fact.fact_id)), [
    'f-termination-fee-trigger-1', 'f-mae-carveout-1', 'f-material-contracts-1', 'f-boilerplate-notices-1',
  ]);
});

test('groupPublishedFacts orders facts within a family by section reference', () => {
  const facts = [
    { fact_id: 'b', family_key: 'MAE_DEFINITION', section_reference: '1.1(c)', coverage_only: false },
    { fact_id: 'a', family_key: 'MAE_DEFINITION', section_reference: '1.1(a)', coverage_only: false },
  ];
  const groups = groupPublishedFacts(facts, legalSchema);
  assert.deepEqual(groups[0].facts.map((fact) => fact.fact_id), ['a', 'b']);
});

test('an empty family list yields no groups and coverage_only facts form only collapsed groups', () => {
  assert.deepEqual(groupPublishedFacts([], legalSchema), []);
  const onlyCoverage = [{ fact_id: 'x', family_key: 'MAE_DEFINITION', section_reference: '1.1', coverage_only: true }];
  assert.deepEqual(groupPublishedFacts(onlyCoverage, legalSchema), [{ family_key: 'MAE_DEFINITION', collapsed: true, facts: onlyCoverage }]);
});

const groups = groupPublishedFacts(fixture.facts, legalSchema);

test('the published summary shows headlines only, families in schema order, coverage_only collapsed last', () => {
  const html = renderToStaticMarkup(React.createElement(PublishedSummary, { groups, onSource: () => {} }));
  const feeIndex = html.indexOf('Termination fee');
  const maeIndex = html.indexOf('MAE definition');
  const mcIndex = html.indexOf('Material contracts');
  assert.ok(feeIndex >= 0 && maeIndex > feeIndex && mcIndex > maeIndex);
  assert.match(html, /MAE carve-out/);
  assert.match(html, /Material Contracts category/);
  assert.match(html, /Termination fee trigger/);
  assert.match(html, /<details[^>]*data-collapsed="true"[^>]*>(?:(?!<\/details>).)*Notices mechanism/s);
  assert.ok(html.indexOf('<details') > mcIndex, 'boilerplate comes after every operative family');
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

const maeFact = groups.find((group) => group.family_key === 'MAE_DEFINITION').facts[0];

test('PublishedFact renders aids under the headline row and annotation above the fact when provided', () => {
  const html = renderToStaticMarkup(React.createElement('ul', {}, React.createElement(PublishedFact, {
    fact: maeFact, onSource: () => {},
    aids: React.createElement('div', { 'data-testid': 'test-aids' }, 'Decision controls'),
    annotation: React.createElement('p', { 'data-testid': 'test-annotation' }, 'Look for: the carve-out standard.'),
  })));
  assert.match(html, /data-testid="test-annotation"/);
  assert.match(html, /Look for: the carve-out standard\./);
  assert.match(html, /data-testid="test-aids"/);
  assert.match(html, /Decision controls/);
  assert.ok(html.indexOf('test-annotation') < html.indexOf('data-testid="fact-headline"'));
  assert.ok(html.indexOf('data-testid="fact-descend-control"') < html.indexOf('test-aids'));
});

test('absent aids and annotation change nothing in PublishedFact output', () => {
  const html = renderToStaticMarkup(React.createElement('ul', {}, React.createElement(PublishedFact, { fact: maeFact, onSource: () => {} })));
  assert.doesNotMatch(html, /test-aids/);
  assert.doesNotMatch(html, /test-annotation/);
  assert.doesNotMatch(html, /role="button"/);
});

test('onComponentSelect and selectedComponentId are optional and only change output when supplied', () => {
  const baseline = renderToStaticMarkup(React.createElement(PublishedSummary, { groups, onSource: () => {} }));
  const withSelection = renderToStaticMarkup(React.createElement('ul', {}, React.createElement(PublishedFact, {
    fact: maeFact, onSource: () => {}, onComponentSelect: () => {}, selectedComponentId: 'c-war', initiallyExpanded: true,
  })));
  assert.match(withSelection, /role="button"/);
  assert.match(withSelection, /data-selected="true"/);
  const withoutSelection = renderToStaticMarkup(React.createElement('ul', {}, React.createElement(PublishedFact, { fact: maeFact, onSource: () => {}, initiallyExpanded: true })));
  assert.doesNotMatch(withoutSelection, /role="button"/);
  assert.doesNotMatch(withoutSelection, /data-selected/);
  assert.ok(baseline.length > 0);
});
