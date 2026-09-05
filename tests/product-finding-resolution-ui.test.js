'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');

require.extensions['.jsx'] = function compileJsx(module, filename) {
  const result = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(result.code, filename);
};

const { default: Fields, findingResolutionCommand } = require('../components/product/FindingResolutionFields.jsx');
const { ReleaseEvaluation, Requirement } = require('../components/product/ReviewWorkspace.jsx');
const finding = { item_id: 'finding', kind: 'COVERAGE', source_id: 'coverage', decision: 'ACCEPTED',
  structure_node_id: 'section', family_key: 'TERMINATION', original: { state: 'UNRESOLVED', subject_kind: 'FACT_TYPE', subject_id: 'section:TERMINATION:OUTSIDE_DATE' } };
const fact = { review_item_id: 'fact', structure_node_id: 'section', family_key: 'TERMINATION', fact_type: 'OUTSIDE_DATE', statement: 'The outside date is 1 January.' };
const props = { findings: [finding], facts: [fact], selections: {}, onChange() {}, busy: false };

test('finding controls default to unresolved and distinguish acknowledgement from resolution', () => {
  const html = renderToStaticMarkup(React.createElement(Fields, props));
  assert.match(html, /Acknowledging a finding does not resolve it/);
  assert.match(html, /value="UNRESOLVED" selected=""/);
  assert.doesNotMatch(html, /omission reason/);
  assert.deepEqual(findingResolutionCommand([finding], {}), []);
});

test('fact resolution choices preserve exact IDs and exclude unrelated facts', () => {
  const selections = { finding: { disposition: 'PUBLISHED_FACT', published_fact_review_item_id: 'fact' } };
  const html = renderToStaticMarkup(React.createElement(Fields, { ...props, selections, facts: [fact,
    { ...fact, review_item_id: 'foreign', structure_node_id: 'other', statement: 'Foreign fact' },
    { ...fact, review_item_id: 'other-type', fact_type: 'FEE_AMOUNT', statement: 'Different type' },
  ] }));
  assert.match(html, /value="fact" selected=""/);
  assert.doesNotMatch(html, /Foreign fact|Different type/);
  assert.deepEqual(findingResolutionCommand([finding], selections), [{ finding_item_id: 'finding', disposition: 'PUBLISHED_FACT', published_fact_review_item_id: 'fact' }]);
});

test('omissions require a reason and omit stale fact IDs and client role claims', () => {
  const selections = { finding: { disposition: 'REVIEWED_OMISSION', omission_reason: 'Duplicate point already stated.', published_fact_review_item_id: 'stale', reviewed_by_role: 'LAWYER' } };
  const html = renderToStaticMarkup(React.createElement(Fields, { ...props, selections }));
  assert.match(html, /textarea required="" aria-label="Finding 1 omission reason"/);
  assert.deepEqual(findingResolutionCommand([finding], selections), [{ finding_item_id: 'finding', disposition: 'REVIEWED_OMISSION', omission_reason: 'Duplicate point already stated.' }]);
});

test('NOT_RUN has no resolution control and reopened findings remain editable', () => {
  const html = renderToStaticMarkup(React.createElement(Fields, { ...props, findings: [{ ...finding, original: { ...finding.original, state: 'NOT_RUN' } }] }));
  assert.match(html, /This work did not run/);
  assert.doesNotMatch(html, /<select/);
  const requirement = renderToStaticMarkup(React.createElement(Requirement, { item: { ...finding, decision: 'UNRESOLVED' }, onDecision() {}, onSource() {} }));
  assert.match(requirement, />Acknowledge<\/button>/);
});

test('existing evaluation form restores saved explicit finding choices', () => {
  const state = { items: [finding], summary: { families: [{ facts: [fact] }] }, release_evaluation_input: {
    finding_resolutions: [{ finding_item_id: 'finding', disposition: 'REVIEWED_OMISSION', omission_reason: 'Saved reason.' }],
  } };
  const html = renderToStaticMarkup(React.createElement(ReleaseEvaluation, { state, onEvaluate() {}, busy: false }));
  assert.match(html, /Resolve model findings/);
  assert.match(html, /Saved reason\./);
});
