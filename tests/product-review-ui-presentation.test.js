'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
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

const ProposalCard = require('../components/product/ProposalCard.jsx').default;
const SourceContextPanel = require('../components/product/SourceContextPanel.jsx').default;

const nodes = [
  { node_id: 'section', reference: '6.3', title: 'No solicitation' },
  { node_id: 'definition', reference: '1.1', title: 'Definitions' },
];
const spans = [
  { span_id: 'owned', structure_node_id: 'section', source_closure_ids: ['closure'], kind: 'SUPPORTING_EVIDENCE', exact_text: 'The Company shall not solicit.', start_byte: 0, end_byte: 30 },
  { span_id: 'context', structure_node_id: 'definition', source_closure_ids: ['closure'], kind: 'FULL_SECTION', exact_text: 'Acquisition Proposal means any offer.', start_byte: 31, end_byte: 70 },
];
const proposal = {
  proposal_id: 'proposal', structure_node_id: 'section', source_closure_id: 'closure',
  family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', fact_type: 'PROHIBITED_ACTION',
  statement: 'The Company shall not solicit.', validation_status: 'INVALID', source_span_ids: ['owned'],
  roles: { LEGAL_OPERATION: 'shall not solicit' }, canonical_value: null,
  unmatched_evidence: [{
    source_span_id: 'context', quote: 'The Company ... solicit', reason: 'NOT_EXACT_CONTIGUOUS_SOURCE_TEXT',
    component_structure_node_id: 'section', component_kind: 'FULL_SECTION',
  }],
  context_only_evidence: [{
    source_span_id: 'context', quote: 'Acquisition Proposal means any offer.', reason: 'OUTSIDE_ANALYSED_STRUCTURE_NODE',
    component_structure_node_id: 'definition', component_kind: 'CROSS_REFERENCE',
  }],
};

test('invalid proposal UI distinguishes failed quotes, outside context, roles and citation quality', () => {
  const markup = renderToStaticMarkup(React.createElement(ProposalCard, {
    entry: { proposal, review_item: { item_id: 'item', decision: 'PENDING', source_span_ids: ['owned'] }, related_proposals: [], group_members: [] },
    requiredRoleKeys: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT', 'TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS'],
    availableSourceSpans: spans,
    structureNodes: nodes,
    busy: false,
    onDecision() {},
    onSource() {},
  }));

  assert.match(markup, /At least one citation is saved, but one or more claimed quotes did not match/);
  assert.match(markup, /Claimed quotes that did not match the source/);
  assert.match(markup, /Supporting context outside the owned section/);
  assert.match(markup, /The claimed quote is not exact contiguous source text/);
  assert.match(markup, /Missing required roles/);
  assert.match(markup, /Legal actor or subject/);
  assert.match(markup, /Who has the right, duty, status or protection/);
});

test('source panel says an unmatched quote is not the highlighted containing context', () => {
  const markup = renderToStaticMarkup(React.createElement(SourceContextPanel, {
    open: true,
    onClose() {},
    source: { canonical_text: spans[1].exact_text },
    span: { ...spans[1], start_byte: 0, end_byte: Buffer.byteLength(spans[1].exact_text) },
    closureSpans: [{ ...spans[1], start_byte: 0, end_byte: Buffer.byteLength(spans[1].exact_text) }],
    loading: false,
    reviewContext: {
      kind: 'UNMATCHED', attempted_quote: 'The Company ... solicit',
      reason: 'The claimed quote is not exact contiguous source text.', section_reference: 'Section 6.3',
    },
  }));

  assert.match(markup, /Attempted quote, not an exact source citation/);
  assert.match(markup, /The highlighted text is the declared containing context/);
  assert.match(markup, /It is not an automatic citation/);
});

test('saved edit acknowledgement stays neutral about citation sufficiency', () => {
  const completeRoles = {
    LEGAL_ACTOR_OR_SUBJECT: 'Company', LEGAL_OPERATION: 'must not solicit',
    OPERATIVE_OBJECT: 'Acquisition Proposals', TEMPORAL_OR_TRIGGER_SCOPE: 'before the Effective Time',
    QUALIFICATIONS: 'subject to the fiduciary exception',
  };
  const markup = renderToStaticMarkup(React.createElement(ProposalCard, {
    entry: {
      proposal: { ...proposal, roles: completeRoles },
      review_item: { item_id: 'item', decision: 'EDITED', source_span_ids: ['owned'], edited_roles: completeRoles },
      related_proposals: [], group_members: [],
    },
    requiredRoleKeys: Object.keys(completeRoles),
    availableSourceSpans: spans,
    structureNodes: nodes,
    busy: false,
    onDecision() {},
    onSource() {},
  }));

  assert.match(markup, /Edit saved in this review revision/);
  assert.match(markup, /still requires lawyer assessment for support, scope and legal sufficiency/);
  assert.doesNotMatch(markup, /Correction saved/);
});

test('source panel identifies context-only text as outside owned evidence', () => {
  const markup = renderToStaticMarkup(React.createElement(SourceContextPanel, {
    open: true,
    onClose() {},
    source: { canonical_text: spans[1].exact_text },
    span: { ...spans[1], start_byte: 0, end_byte: Buffer.byteLength(spans[1].exact_text) },
    closureSpans: [{ ...spans[1], start_byte: 0, end_byte: Buffer.byteLength(spans[1].exact_text) }],
    loading: false,
    reviewContext: {
      kind: 'CONTEXT_ONLY', attempted_quote: spans[1].exact_text,
      reason: 'The text belongs to a different agreement section or subclause.', section_reference: 'Section 1.1',
    },
  }));

  assert.match(markup, /Supporting context outside the owned section/);
  assert.match(markup, /It is not owned evidence for this proposal/);
});
