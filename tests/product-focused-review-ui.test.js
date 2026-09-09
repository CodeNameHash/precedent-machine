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

const { byteRangesToParts, firstCitedByte, parseFocusSections } = require('../lib/product/section-highlight');
const focusedModule = require('../components/product/FocusedReview.jsx');
const FocusedReview = focusedModule.default;
const { sectionFacts } = focusedModule;
const { DraftReview } = require('../components/product/ReviewWorkspace.jsx');

test('byte ranges become marked parts, merging overlaps and honouring UTF-8 offsets', () => {
  const text = 'Parent’s right expires upon delivery.';
  const bytes = Buffer.from(text, 'utf8');
  const start = bytes.indexOf(Buffer.from('right'));
  const end = bytes.indexOf(Buffer.from('delivery')) + Buffer.byteLength('delivery');
  const parts = byteRangesToParts(text, 1000, [
    { start_byte: 1000 + start, end_byte: 1000 + start + 5 },
    { start_byte: 1000 + start + 3, end_byte: 1000 + end },
  ]);
  assert.deepEqual(parts, [
    { text: 'Parent’s ', marked: false },
    { text: 'right expires upon delivery', marked: true },
    { text: '.', marked: false },
  ]);
  assert.equal(firstCitedByte([{ start_byte: 9 }, { start_byte: 4 }]), 4);
  assert.deepEqual(parseFocusSections('7.1, 7.3,7.1,'), ['7.1', '7.3']);
  assert.deepEqual(parseFocusSections(['6.1', '6.2']), ['6.1', '6.2']);
  assert.deepEqual(parseFocusSections(undefined), []);
});

const sectionText = 'Section 7.1 Termination. (a) by mutual written consent; (b) by Parent if the Support Agreement has not been delivered by the Consent Time.';
const spans = [
  { span_id: 'full', kind: 'FULL_SECTION', structure_node_id: 'n71', source_closure_ids: ['c71'], exact_text: sectionText, start_byte: 100, end_byte: 100 + Buffer.byteLength(sectionText) },
  { span_id: 'e-b', kind: 'SUPPORTING_EVIDENCE', structure_node_id: 'n71', source_closure_ids: ['c71'], exact_text: 'by Parent if the Support Agreement', start_byte: 100 + sectionText.indexOf('by Parent'), end_byte: 100 + sectionText.indexOf('by Parent') + 'by Parent if the Support Agreement'.length },
  { span_id: 'e-a', kind: 'SUPPORTING_EVIDENCE', structure_node_id: 'n71', source_closure_ids: ['c71'], exact_text: 'by mutual written consent', start_byte: 100 + sectionText.indexOf('by mutual'), end_byte: 100 + sectionText.indexOf('by mutual') + 'by mutual written consent'.length },
];
function proposal(id, statement, spanIds, group, subtype = 'MUTUAL_CONSENT') {
  return { proposal_id: id, structure_node_id: 'n71', source_closure_id: 'c71', proposition_group_id: group, family_key: 'TERMINATION', subtype_key: subtype, fact_type: 'TERMINATION_RIGHT', statement, roles: { action: 'terminate' }, canonical_value: null, validation_status: 'VALID', source_span_ids: spanIds, unmatched_evidence: [], context_only_evidence: [] };
}
const proposals = [
  proposal('p-support', 'Parent may terminate if the Support Agreement is not delivered.', ['e-b'], 'g2', 'VOTE_FAILURE'),
  proposal('p-mutual', 'Parties may terminate by mutual written consent.', ['e-a'], 'g1'),
  proposal('p-mutual-2', 'Termination requires a writing.', ['e-a'], 'g1'),
];
const analysis = {
  kind: 'draftAnalysis', analysis_run_id: 'run', draft_analysis_id: 'draft', spans, proposals, proposition_groups: [], fact_links: [], issues: [], coverage_assertions: [],
  sections: [{ section_routing_id: 'r71', structure_node_id: 'n71', section_reference: '7.1', disposition: 'FAMILY_ASSIGNED', families: ['TERMINATION'] }],
  source_closures: [{ source_closure_id: 'c71', structure_node_id: 'n71', section_reference: '7.1', full_section_span_id: 'full' }],
  agreement_structure: { nodes: [{ node_id: 'n71', reference: '7.1', title: 'Termination', authored_order: 1 }] },
  source_document: { parties: [] },
};
const heldItem = { item_id: 'held-1', kind: 'ISSUE', structure_node_id: 'n71', decision: 'PENDING', source_span_ids: [], original: { issue_id: 'i1', code: 'UNSUPPORTED_SUBTYPE', state: 'OPEN', message: JSON.stringify({ statement: 'The Company shall elect within seven Business Days.', subtype_key: 'TERMINATION_EFFECT' }) } };
const view = {
  sections: [{
    node: analysis.agreement_structure.nodes[0], routing: analysis.sections[0], heading: 'Termination', source_closure: analysis.source_closures[0], coverage: [],
    proposals: proposals.map((item) => ({ proposal: item, review_item: { item_id: `item-${item.proposal_id}`, kind: 'PROPOSAL', decision: 'PENDING', source_span_ids: item.source_span_ids }, group: null, group_members: [], related_proposals: [] })),
    review_items: [heldItem],
  }],
  fact_items: [], relationship_items: [], agreement_items: [], pending_count: 4, unresolved_count: 0, residual_paragraph_count: 0, unusual_provision_count: 0, can_publish: false,
};

test('facts are ordered by first cited byte and grouped by proposition group', () => {
  const groups = sectionFacts(view.sections[0], new Map(spans.map((span) => [span.span_id, span])));
  assert.deepEqual(groups.map((group) => group.facts.map((fact) => fact.entry.proposal.proposal_id)), [['p-mutual', 'p-mutual-2'], ['p-support']]);
});

test('focused review shows the provision text beside grouped facts and held content', () => {
  const html = renderToStaticMarkup(React.createElement(FocusedReview, {
    view, analysis, focus: ['7.1', '9.9'], busy: false, command: async () => {}, openSource: () => {}, cardPropsFor: () => ({}), allSectionsHref: '/review/product/run',
  }));
  assert.match(html, /1 provision selected for discussion/);
  assert.match(html, /Not found in this agreement: 9\.9/);
  assert.match(html, /data-testid="focused-section-text"/);
  assert.match(html, /by mutual written consent; \(b\) by Parent/);
  assert.equal((html.match(/data-testid="focused-fact"/g) || []).length, 3);
  assert.match(html, /One legal effect, 2 facts/);
  assert.match(html, /Proposed by the model but held, not shown as facts/);
  assert.match(html, /The Company shall elect within seven Business Days\./);
  assert.match(html, /1 held, not shown as facts/);
  assert.match(html, /href="\/review\/product\/run"/);
  assert.doesNotMatch(html, /<mark/);
});

test('draft review swaps the full section list for the focused view when focus is set', () => {
  const workspace = { analysis, review: { version: 0, state: { status: 'DRAFT', agreement_coverage: { decision: 'PENDING' }, items: [] }, revisions: [] } };
  const focusedHtml = renderToStaticMarkup(React.createElement(DraftReview, { workspace, view, busy: false, command: async () => {}, openSource: () => {}, focus: ['7.1'], allSectionsHref: '/review/product/run' }));
  assert.match(focusedHtml, /Focused review/);
  assert.doesNotMatch(focusedHtml, /Jump to agreement section/);
  assert.match(focusedHtml, /Review checks/);
  const fullHtml = renderToStaticMarkup(React.createElement(DraftReview, { workspace, view, busy: false, command: async () => {}, openSource: () => {} }));
  assert.doesNotMatch(fullHtml, /Focused review/);
  assert.match(fullHtml, /Jump to agreement section/);
});
