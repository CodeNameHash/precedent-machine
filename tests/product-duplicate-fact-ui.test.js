'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');
require.extensions['.jsx'] = (module, filename) => { const result = transformSync(fs.readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }); module._compile(result.code, filename); };
const { Requirement } = require('../components/product/ReviewWorkspace.jsx');
const { default: FindingResolutionFields } = require('../components/product/FindingResolutionFields.jsx');

function renderBoth(code, message) {
  const item = { item_id: 'issue-1', kind: 'ISSUE', decision: 'PENDING', source_closure_id: 'closure-1', source_span_ids: ['span-1'], original: { code, message } };
  return [
    renderToStaticMarkup(React.createElement(Requirement, { item, onDecision() {}, onSource() {} })),
    renderToStaticMarkup(React.createElement(FindingResolutionFields, { findings: [item], facts: [], selections: {}, onChange() {}, onSource() {} })),
  ];
}

test('duplicate fact collision is readable in ordinary and final review', () => {
  const message = JSON.stringify({ shared_fact_occurrence_id: 'occ-1', candidates: [{ client_ref: 'p1' }, { client_ref: 'p2' }] });
  for (const html of renderBoth('DUPLICATE_FACT_OCCURRENCE', message)) {
    assert.match(html, /Review proposals that share supporting text/);
    assert.match(html, /These proposals use the same supporting text/);
    assert.match(html, /2 candidate proposals/);
    assert.match(html, /Show recorded detail/);
    assert.match(html, /occ-1/);
    assert.match(html, /<details[^>]*>/);
    assert.doesNotMatch(html.match(/<details[^>]*>/)[0], /\bopen\b/);
    assert.match(html, /View (?:complete source closure|finding source)/);
    assert.doesNotMatch(html, /DUPLICATE_FACT_OCCURRENCE/);
  }
});

test('malformed collision detail is safe and unrelated issues remain ordinary', () => {
  for (const malformed of ['{bad', '{}', '{"candidates":[null]}']) {
    for (const html of renderBoth('DUPLICATE_FACT_OCCURRENCE', malformed)) {
      assert.match(html, /Review proposals that share supporting text/);
      assert.match(html, /recorded details could not be read/);
      assert.match(html, /Show recorded detail/);
      assert.match(html, /<pre[^>]*>[^<]+<\/pre>/);
      assert.doesNotMatch(html, /\d+ candidate proposals/);
    }
  }
  for (const html of renderBoth('OTHER', 'ordinary')) {
    assert.match(html, /ordinary/);
    assert.doesNotMatch(html, /Review proposals that share supporting text/);
    assert.doesNotMatch(html, /Show recorded detail/);
  }
});
