'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');

require.extensions['.jsx'] = (module, filename) => {
  const result = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(result.code, filename);
};

const { Requirement, ReleaseEvaluation } = require('../components/product/ReviewWorkspace.jsx');
const { default: FindingResolutionFields } = require('../components/product/FindingResolutionFields.jsx');

function renderBoth(item, analysis) {
  return [
    renderToStaticMarkup(React.createElement(Requirement, { item, analysis, onDecision() {}, onSource() {} })),
    renderToStaticMarkup(React.createElement(FindingResolutionFields, { findings: [item], facts: [], selections: {}, analysis, onChange() {}, onSource() {} })),
  ];
}

test('final evaluation passes the analysis read interface into the finding controls', () => {
  const item = { item_id: 'coverage-1', kind: 'COVERAGE', decision: 'PENDING', structure_node_id: 'node-1', original: { subject_kind: 'SECTION_FAMILY', state: 'UNRESOLVED', family_key: 'INTERIM_OPERATING' } };
  const analysis = { schema_version: 'AGREEMENT_ANALYSIS_READ/V1', sections: [{ structure_node_id: 'node-1', families: ['INTERIM_OPERATING'] }], proposals: [] };
  const state = { items: [item], summary: { families: [] } };
  const html = renderToStaticMarkup(React.createElement(ReleaseEvaluation, { state, analysis, onEvaluate() {} }));
  assert.match(html, /AI identified this subject but proposed no facts/);
  assert.match(html, /value="UNRESOLVED" selected=""/);
});

test('empty extraction warning appears in both review locations only for the matching unresolved family', () => {
  const item = { item_id: 'coverage-1', kind: 'COVERAGE', decision: 'PENDING', original: { subject_kind: 'SECTION_FAMILY', state: 'UNRESOLVED', family_key: 'GENERAL_COVENANTS' }, structure_node_id: 'node-1' };
  const analysis = { sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }], proposals: [] };
  for (const html of renderBoth(item, analysis)) {
    assert.match(html, /AI identified this subject but proposed no facts/);
    assert.match(html, /This is not an absence statement/);
  }
});

test('empty extraction warning does not infer from missing analysis, routing, status, section, family, or proposals', () => {
  const base = { item_id: 'coverage-1', kind: 'COVERAGE', decision: 'PENDING', original: { subject_kind: 'SECTION_FAMILY', state: 'UNRESOLVED', family_key: 'GENERAL_COVENANTS' }, structure_node_id: 'node-1' };
  const cases = [
    [base, undefined],
    [base, { sections: [], proposals: [] }],
    [base, { sections: [{ structure_node_id: 'node-2', families: ['GENERAL_COVENANTS'] }], proposals: [] }],
    [{ ...base, structure_node_id: 'node-2' }, { sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }], proposals: [] }],
    [{ ...base, original: { ...base.original, family_key: 'OTHER_FAMILY' } }, { sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }], proposals: [] }],
    [{ ...base, original: { ...base.original, state: 'NOT_FOUND' } }, { sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }], proposals: [] }],
    [base, { sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }], proposals: [{ structure_node_id: 'node-1', family_key: 'GENERAL_COVENANTS', validation_status: 'INVALID' }] }],
  ];
  for (const [item, analysis] of cases) {
    for (const html of renderBoth(item, analysis)) assert.doesNotMatch(html, /AI identified this subject but proposed no facts/);
  }
});

test('partial analysis does not suppress or invent the warning, and unrelated proposals do not suppress it', () => {
  const item = { item_id: 'coverage-1', kind: 'COVERAGE', decision: 'PENDING', structure_node_id: 'node-1', original: { subject_kind: 'SECTION_FAMILY', state: 'UNRESOLVED', family_key: 'GENERAL_COVENANTS' } };
  const unrelated = { sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }], proposals: [{ structure_node_id: 'node-2', family_key: 'GENERAL_COVENANTS' }, { structure_node_id: 'node-1', family_key: 'OTHER_FAMILY' }] };
  for (const html of renderBoth(item, unrelated)) assert.match(html, /AI identified this subject but proposed no facts/);
  for (const analysis of [{ sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }] }, { proposals: [] }]) {
    for (const html of renderBoth(item, analysis)) assert.doesNotMatch(html, /AI identified this subject but proposed no facts/);
  }
  for (const state of ['VALID', 'INVALID']) {
    const analysis = { sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }], proposals: [{ structure_node_id: 'node-1', family_key: 'GENERAL_COVENANTS', validation_status: state }] };
    for (const html of renderBoth(item, analysis)) assert.doesNotMatch(html, /AI identified this subject but proposed no facts/);
  }
  for (const html of renderBoth({ ...item, original: { ...item.original, subject_kind: 'FACT_TYPE' } }, { sections: [{ structure_node_id: 'node-1', families: ['GENERAL_COVENANTS'] }], proposals: [] })) assert.doesNotMatch(html, /AI identified this subject but proposed no facts/);
});
