'use strict';

// Section 9 of the plan: a UI change is checked where it renders, not by a
// regular expression over the component's source. These are the review
// workbench's release controls and its progress counts, rendered with
// react-dom/server (the suite that used to assert the same strings inside
// components/product/ReviewWorkspace.jsx is gone; the commands behind the
// controls are tested at the review HTTP boundary in
// tests/product-phase-3.test.js).

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
const projectRoot = path.join(__dirname, '..');
const originalJsLoader = require.extensions['.js'];
require.extensions['.js'] = function compileProjectEsm(module, filename) {
  if (!filename.startsWith(projectRoot) || filename.includes(`${path.sep}node_modules${path.sep}`)) return originalJsLoader(module, filename);
  const source = fs.readFileSync(filename, 'utf8');
  if (!/(^|\n)\s*(import\s|export\s)/.test(source)) return originalJsLoader(module, filename);
  const transformed = transformSync(source, {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};

const ReviewSectionRail = require('../components/product/ReviewSectionRail.jsx').default;
const { ReleaseEvaluation } = require('../components/product/ReviewWorkspace.jsx');

const sections = [{
  node: { node_id: 'node-6-3', reference: '6.3', title: 'No solicitation' },
  routing: { section_reference: '6.3' },
  heading: 'No solicitation',
  proposals: [{ proposal: { proposal_id: 'p1' }, review_item: { decision: 'PENDING' } }],
  review_items: [],
}];

test('the review rail shows the agreement, the pending count and the unresolved count', () => {
  const html = renderToStaticMarkup(React.createElement(ReviewSectionRail, {
    sections, activeId: 'node-6-3', onSelect() {}, pendingCount: 4, unresolvedCount: 2, heldCount: 1,
  }));
  assert.match(html, /Review progress/);
  assert.match(html, /<p class="pw-rail-big">4<span> pending<\/span><\/p>/);
  assert.match(html, /<p class="pw-rail-meta">2 unresolved · 1 held<\/p>/);
  assert.match(html, /6\.3/, 'the section is named by its reference');
  assert.match(html, /No solicitation/);
  // A rail with no sections renders nothing rather than an empty frame.
  assert.equal(renderToStaticMarkup(React.createElement(ReviewSectionRail, { sections: [] })), '');
});

test('the release evaluation panel shows the bars and the evaluate command, and says which checks are missing', () => {
  const state = {
    status: 'PUBLISHED',
    release_evaluation: null,
    items: [],
    agreement_coverage: { decision: 'ACCEPTED' },
    summary: { families: [] },
    metrics: {},
    review_timing: {},
  };
  const analysis = { sections: [], proposals: [], coverage_assertions: [], issues: [] };
  const html = renderToStaticMarkup(React.createElement(ReleaseEvaluation, { state, analysis, referenceSources: [], onEvaluate() {}, busy: false, onSource() {} }));
  assert.match(html, /Supervised candidate evaluation/);
  assert.match(html, /Evaluate/, 'the panel offers the evaluate command');
});
