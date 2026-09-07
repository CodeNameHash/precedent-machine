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
const sourceContextModule = require('../components/product/SourceContextPanel.jsx');
const SourceContextPanel = sourceContextModule.default;
const { surroundingSourceSpan } = sourceContextModule;
const {
  AcceptedSummary, AddFact, ReleaseEvaluation, ReviewSectionHeading, missingFactCommand, toggleSourceSpanId,
} = require('../components/product/ReviewWorkspace.jsx');

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

test('source panel highlights exact supporting words inside the smallest stored surrounding clause', () => {
  const canonicalText = '5.1 Company’s Conduct of Business. The Company shall not amend its charter, except as permitted by Law.';
  const selectedText = 'shall not amend its charter';
  const clauseText = 'The Company shall not amend its charter, except as permitted by Law.';
  const selectedStart = Buffer.byteLength(canonicalText.slice(0, canonicalText.indexOf(selectedText)));
  const clauseStart = Buffer.byteLength(canonicalText.slice(0, canonicalText.indexOf(clauseText)));
  const selectedSpan = {
    span_id: 'support', kind: 'SUPPORTING_EVIDENCE', structure_node_id: 'section',
    start_byte: selectedStart, end_byte: selectedStart + Buffer.byteLength(selectedText), exact_text: selectedText,
  };
  const clauseSpan = {
    span_id: 'operative', kind: 'OPERATIVE', structure_node_id: 'section',
    start_byte: clauseStart, end_byte: clauseStart + Buffer.byteLength(clauseText), exact_text: clauseText,
  };
  const markup = renderToStaticMarkup(React.createElement(SourceContextPanel, {
    open: true,
    onClose() {},
    source: { canonical_text: canonicalText },
    span: selectedSpan,
    closureSpans: [{
      span_id: 'full', kind: 'FULL_SECTION', structure_node_id: 'section',
      start_byte: 0, end_byte: Buffer.byteLength(canonicalText), exact_text: canonicalText,
    }, selectedSpan, clauseSpan],
    loading: false,
  }));

  assert.match(markup, /Full surrounding clause/);
  assert.match(markup, /The Company <mark[^>]*>shall not amend its charter<\/mark>, except as permitted by Law\./);
  assert.match(markup, /OPERATIVE · bytes/);
});

test('proposal card exposes every saved citation and labels first-citation shortcuts', () => {
  const markup = renderToStaticMarkup(React.createElement(ProposalCard, {
    entry: {
      proposal: { ...proposal, validation_status: 'VALID', source_span_ids: ['other-changes', 'increase-price'] },
      review_item: { item_id: 'item', decision: 'PENDING', source_span_ids: ['other-changes', 'increase-price'] },
      related_proposals: [], group_members: [],
    },
    requiredRoleKeys: [], availableSourceSpans: spans, structureNodes: nodes, busy: false,
    onDecision() {}, onSource() {},
  }));

  assert.match(markup, /Saved citations/);
  assert.match(markup, />Citation 1</);
  assert.match(markup, />Citation 2</);
  assert.match(markup, /Citation 1 of 2/);
});

test('source panel prefers a complete authored unit over a shorter residual fragment', () => {
  const selected = { span_id: 'selected', kind: 'SUPPORTING_EVIDENCE', start_byte: 10094, end_byte: 10164 };
  const residual = { span_id: 'residual', kind: 'RESIDUAL_PARAGRAPH', start_byte: 9399, end_byte: 10695 };
  const operative = { span_id: 'operative', kind: 'OPERATIVE', start_byte: 9399, end_byte: 11871 };
  const full = { span_id: 'full', kind: 'FULL_SECTION', start_byte: 8676, end_byte: 19662 };

  assert.equal(surroundingSourceSpan(selected, [selected, residual, operative, full]), operative);
});

test('source panel labels a residual-only fallback as a stored passage', () => {
  const canonicalText = 'The Purchaser may increase the Offer Price.';
  const selectedText = 'increase the Offer Price';
  const selectedStart = Buffer.byteLength(canonicalText.slice(0, canonicalText.indexOf(selectedText)));
  const selected = {
    span_id: 'selected', kind: 'SUPPORTING_EVIDENCE', start_byte: selectedStart,
    end_byte: selectedStart + Buffer.byteLength(selectedText), exact_text: selectedText,
  };
  const residual = {
    span_id: 'residual', kind: 'RESIDUAL_PARAGRAPH', start_byte: 0,
    end_byte: Buffer.byteLength(canonicalText), exact_text: canonicalText,
  };
  const markup = renderToStaticMarkup(React.createElement(SourceContextPanel, {
    open: true, onClose() {}, source: { canonical_text: canonicalText }, span: selected,
    closureSpans: [selected, residual], loading: false,
  }));

  assert.match(markup, /Stored surrounding passage/);
  assert.doesNotMatch(markup, /Full surrounding paragraph/);
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

test('missing fact UI requires deliberate multi-span source selection and preserves selected IDs', () => {
  const analysis = {
    agreement_structure: { nodes },
    source_closures: [{ source_closure_id: 'closure', structure_node_id: 'section' }],
    spans: [
      { span_id: 'definition', structure_node_id: 'definition', source_closure_ids: ['closure'], kind: 'DEFINITION', exact_text: 'Acquisition Proposal means an offer.' },
      { ...spans[0], kind: 'CHAPEAU', exact_text: 'The Company shall not, before the Effective Time,' },
      { span_id: 'residual', structure_node_id: 'section', source_closure_ids: ['closure'], kind: 'RESIDUAL_PARAGRAPH', exact_text: 'Residual source text.' },
      { ...spans[1], span_id: 'operative', structure_node_id: 'section', kind: 'OPERATIVE', exact_text: `(a) amend (i) its charter or (ii) the Tax Receivable Agreement${' subject to the stated exceptions'.repeat(8)}.` },
      { span_id: 'full', structure_node_id: 'section', source_closure_ids: ['closure'], kind: 'FULL_SECTION', exact_text: 'Complete Section 5.1 text.' },
      { span_id: 'cross', structure_node_id: 'definition', source_closure_ids: ['closure'], kind: 'CROSS_REFERENCE', exact_text: 'Section 8.4 source text.' },
    ],
  };
  const markup = renderToStaticMarkup(React.createElement(AddFact, {
    section: { node: nodes[0] }, analysis, onAdd() {}, busy: false, initiallyOpen: true,
  }));

  assert.match(markup, /Exact fact sources/);
  assert.match(markup, /Chapeau.*The Company shall not, before the Effective Time,/);
  assert.match(markup, /Operative.*\(a\) amend/);
  assert.match(markup, /Full section.*Complete Section 5\.1 text/);
  assert.match(markup, /Read full source/);
  assert.equal((markup.match(/type="checkbox"/g) || []).length, 6);
  assert.equal(markup.indexOf('Chapeau') < markup.indexOf('Operative'), true);
  assert.equal(markup.indexOf('Operative') < markup.indexOf('Full section'), true);
  assert.equal(markup.indexOf('Full section') < markup.indexOf('Definition'), true);
  assert.equal(markup.indexOf('Definition') < markup.indexOf('Cross reference'), true);
  assert.equal(markup.indexOf('Cross reference') < markup.indexOf('Residual paragraph'), true);
  assert.doesNotMatch(markup, /checked=""/);
  assert.match(markup, /<button disabled=""[^>]*>Add fact<\/button>/);

  let selected = toggleSourceSpanId([], 'owned', true);
  selected = toggleSourceSpanId(selected, 'operative', true);
  selected = toggleSourceSpanId(selected, 'owned', true);
  assert.deepEqual(selected, ['owned', 'operative']);
  selected = toggleSourceSpanId(selected, 'owned', false);
  assert.deepEqual(selected, ['operative']);
  const command = missingFactCommand({
    section: { node: nodes[0] }, closure: analysis.source_closures[0], familyKey: 'INTERIM_OPERATING',
    subtypeKey: 'RESTRICTIVE_COVENANT', factType: 'IOC_RESTRICTION_PRESENT', statement: 'Company shall not amend its organisation documents.',
    roles: { LEGAL_ACTOR_OR_SUBJECT: 'Company', LEGAL_OPERATION: 'shall not amend', OPERATIVE_OBJECT: 'organisation documents', TEMPORAL_OR_TRIGGER_SCOPE: 'before the Effective Time', QUALIFICATIONS: 'subject to stated exceptions' }, value: '',
    sourceSpanIds: ['owned', 'operative'],
  });
  assert.deepEqual(command.source_span_ids, ['owned', 'operative']);
});

test('review section heading keeps routing rationale separate and closed', () => {
  const markup = renderToStaticMarkup(React.createElement(ReviewSectionHeading, {
    section: {
      heading: 'Conduct of Business by the Company Pending the Closing',
      routing: {
        section_reference: '5.1',
        rationale: 'The section contains interim operating covenants.',
      },
    },
  }));

  assert.match(markup, /<h2[^>]*>Conduct of Business by the Company Pending the Closing<\/h2>/);
  assert.match(markup, /<details[^>]*><summary[^>]*>Why this section was classified<\/summary>/);
  assert.match(markup, /The section contains interim operating covenants/);
  assert.doesNotMatch(markup, /<details[^>]*open/);
});

test('citation review labels focused supporting words as a diagnostic with surrounding context', () => {
  const markup = renderToStaticMarkup(React.createElement(ReleaseEvaluation, {
    state: {
      summary: { families: [{ facts: [{
        review_item_id: 'fact-1', statement: 'The Company shall not amend its charter.',
        source_closure_id: 'closure', source_span_ids: ['owned'],
      }] }] },
      items: [],
      release_evaluation_input: null,
    },
    analysis: { issues: [], coverage_assertions: [] },
    onEvaluate() {},
    onSource() {},
    busy: false,
  }));

  assert.match(markup, /Focused supporting words \(diagnostic\)/);
  assert.match(markup, /The full surrounding paragraph or clause remains visible/);
  assert.match(markup, /does not add a publication requirement/);
  assert.doesNotMatch(markup, />Narrow</);
});

test('release timing explanation matches the stored evaluation version', () => {
  const renderEvaluation = (schemaVersion) => renderToStaticMarkup(React.createElement(ReleaseEvaluation, {
    state: {
      summary: { families: [] }, items: [], release_evaluation_input: null,
      release_evaluation: {
        schema_version: schemaVersion, passed: true, bars: {},
        diagnostics: {
          review_time_minutes: 120, measured_review_time_seconds: 1200,
          processing_minutes: 100, effective_elapsed_minutes: 120,
        },
      },
    },
    analysis: { issues: [], coverage_assertions: [] }, onEvaluate() {}, onSource() {}, busy: false,
  }));

  const current = renderEvaluation('PRODUCT_SUPERVISED_RELEASE_EVALUATION/V2');
  assert.match(current, /There is no 90-minute pass\/fail limit\. Valid timing is still required\./);
  assert.doesNotMatch(current, /historical evaluation/);

  const historical = renderEvaluation('PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1');
  assert.match(historical, /This historical evaluation used the 90-minute pass\/fail limit\./);
  assert.doesNotMatch(historical, /There is no 90-minute/);
});

test('accepted summary and release evaluation expose every saved citation', () => {
  const fact = {
    review_item_id: 'fact-1', source_id: 'proposal-1', statement: 'The Company shall not amend its charter.',
    family_key: 'INTERIM_OPERATING', subtype_key: 'RESTRICTIVE_COVENANT', fact_type: 'IOC_RESTRICTION_PRESENT',
    source_closure_id: 'closure', source_span_ids: ['support-1', 'support-2'],
  };
  const summary = { families: [{ family_key: fact.family_key, facts: [fact] }], relationships: [] };
  const summaryMarkup = renderToStaticMarkup(React.createElement(AcceptedSummary, {
    summary, metrics: { proposal_count: 1, proposal_errors: 0, proposal_omissions: 0, review_time_seconds: 60 },
    onSource() {}, active: true,
  }));
  const evaluationMarkup = renderToStaticMarkup(React.createElement(ReleaseEvaluation, {
    state: { summary, items: [], release_evaluation_input: null },
    analysis: { issues: [], coverage_assertions: [] }, onEvaluate() {}, onSource() {}, busy: false,
  }));

  for (const markup of [summaryMarkup, evaluationMarkup]) {
    assert.match(markup, />Citation 1</);
    assert.match(markup, />Citation 2</);
  }
});

test('proposal edit offers explicit standalone or compatible recorded group repair', () => {
  const markup = renderToStaticMarkup(React.createElement(ProposalCard, {
    entry: {
      proposal,
      review_item: { item_id: 'item', kind: 'PROPOSAL', decision: 'PENDING', source_span_ids: ['owned'] },
      related_proposals: [], group_members: [],
    },
    availablePropositionGroups: [{
      proposition_group_id: 'compatible-group', family_key: proposal.family_key,
      subtype_key: proposal.subtype_key, structure_node_id: 'section',
    }],
    availableProposals: [{ ...proposal, proposition_group_id: 'compatible-group' }],
    requiredRoleKeys: [],
    availableSourceSpans: spans,
    structureNodes: nodes,
    busy: false,
    onDecision() {},
    onSource() {},
  }));

  assert.match(markup, /Summary group/);
  assert.match(markup, /Keep current grouping/);
  assert.match(markup, /Standalone fact/);
  assert.match(markup, /Section 6.3: The Company shall not solicit/);
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
