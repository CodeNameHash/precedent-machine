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
const { contract } = require('../lib/product/fact-components');
const { buildEditedComponents, componentEditPayload } = require('../lib/product/component-edit');
const focusedModule = require('../components/product/FocusedReview.jsx');
const FocusedReview = focusedModule.default;
const { sectionFacts, ComponentEditor } = focusedModule;
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
    proposals: proposals.map((item) => ({ proposal: item, review_item: { item_id: `item-${item.proposal_id}`, kind: 'PROPOSAL', decision: item.proposal_id === 'p-support' ? 'REJECTED' : 'PENDING', ...(item.proposal_id === 'p-support' ? { comment: 'Not a vote failure.', commented_at: '2026-09-12T19:00:00.000Z' } : {}), source_span_ids: item.source_span_ids }, group: null, group_members: [], related_proposals: [] })),
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
  assert.match(html, /data-decision="REJECTED"/);
  assert.equal((html.match(/Revert to pending/g) || []).length, 1);
  assert.match(html, /1 of 3 decided/);
  assert.match(html, /Comment saved[^<]*:<\/span> Not a vote failure\./);
  assert.match(html, /Edit comment/);
  assert.match(html, /Add comment/);
  assert.doesNotMatch(html, /Save comment/);
});

test('a reviewer brief renders at the top and per section', () => {
  const brief = { title: 'What to look at', intro: 'Only these.', ask: ['Is the label right?'], sections: [{ reference: '7.1', look_for: 'Support Agreement right labelled Vote failure.' }] };
  const html = renderToStaticMarkup(React.createElement(FocusedReview, {
    view, analysis, focus: ['7.1'], busy: false, command: async () => {}, openSource: () => {}, cardPropsFor: () => ({}), allSectionsHref: '/review/product/run?all=1', brief,
  }));
  assert.match(html, /data-testid="review-brief"/);
  assert.match(html, /What to look at/);
  assert.match(html, /Is the label right\?/);
  assert.match(html, /Look for: <\/span>Support Agreement right labelled Vote failure\./);
  const { briefForRun } = require('../lib/product/review-briefs');
  const ncs = briefForRun('eaafcac8-790b-41bb-a5e1-b12187a55e7d');
  assert.ok(ncs && ncs.sections.length >= 10);
  assert.equal(briefForRun('other'), null);
});

function stampedComponentsFact() {
  const fact = JSON.parse(JSON.stringify(contract.example_fact));
  let cursor = 0;
  (function stamp(list) {
    for (const component of list || []) {
      component.start_byte = cursor; cursor += Buffer.byteLength(component.text, 'utf8'); component.end_byte = cursor;
      component.source_span_id = 's-v2';
      stamp(component.children);
    }
  }(fact.components));
  fact.components.forEach((component) => { if (component.origin === 'CHAPEAU') component.origin_structure_node_id = 'n-v2'; });
  return fact;
}

test('a proposal carrying FACT_COMPONENTS/V2 headline and components renders with PublishedFact and keeps decision controls inside it; a proposal without components is unchanged', () => {
  const fact = stampedComponentsFact();
  const v2Proposal = {
    proposal_id: 'p-v2', structure_node_id: 'n71', source_closure_id: 'c71', proposition_group_id: 'g-v2',
    family_key: fact.family_key, subtype_key: fact.subtype_key, fact_type: 'MAE_DEFINITION',
    statement: 'Old one-sentence MAE carve-out statement.', roles: {}, canonical_value: null,
    validation_status: 'VALID', source_span_ids: ['e-a'], unmatched_evidence: [], context_only_evidence: [],
    headline: fact.headline, components: fact.components,
  };
  const plainProposal = proposal('p-plain', 'Parties may terminate by mutual written consent.', ['e-a'], 'g-plain');
  const localView = {
    sections: [{
      node: analysis.agreement_structure.nodes[0], routing: analysis.sections[0], heading: 'Termination',
      source_closure: analysis.source_closures[0], coverage: [],
      proposals: [
        { proposal: v2Proposal, review_item: { item_id: 'item-p-v2', kind: 'PROPOSAL', decision: 'PENDING', source_span_ids: v2Proposal.source_span_ids }, group: null, group_members: [], related_proposals: [] },
        { proposal: plainProposal, review_item: { item_id: 'item-p-plain', kind: 'PROPOSAL', decision: 'REJECTED', source_span_ids: plainProposal.source_span_ids }, group: null, group_members: [], related_proposals: [] },
      ],
      review_items: [],
    }],
    fact_items: [], relationship_items: [], agreement_items: [], pending_count: 2, unresolved_count: 0, residual_paragraph_count: 0, unusual_provision_count: 0, can_publish: false,
  };
  const html = renderToStaticMarkup(React.createElement(FocusedReview, {
    view: localView, analysis, focus: ['7.1'], busy: false, command: async () => {}, openSource: () => {}, cardPropsFor: () => ({}), allSectionsHref: '/review/product/run',
  }));
  assert.equal((html.match(/data-testid="published-fact"/g) || []).length, 1);
  assert.match(html, /MAE carve-out: geopolitical conditions/);
  assert.doesNotMatch(html, /Old one-sentence MAE carve-out statement\./);
  assert.match(html, /data-decision="PENDING"/);
  assert.match(html, /data-decision="REJECTED"/);
  const publishedFactHtml = html.split('data-testid="published-fact"')[1].split('data-testid="focused-fact"')[0];
  assert.match(publishedFactHtml, /Accept/);
  assert.match(publishedFactHtml, /Reject/);
  assert.match(publishedFactHtml, /Unresolved/);
  assert.match(html, /Parties may terminate by mutual written consent\./);
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

// Component-level edit of a layered fact (plan 5B.4). The section text
// carries a section sign (§, two UTF-8 bytes, one JS string character) ahead
// of the edited text so a byte-vs-index bug would shift the offset by one.
const editorSectionText = 'Fees payable under § 3(a) include the reimbursement obligation described below.';
const editorSectionSpan = { span_id: 'full-71', exact_text: editorSectionText, start_byte: 5000, end_byte: 5000 + Buffer.byteLength(editorSectionText, 'utf8') };

test('buildEditedComponents computes UTF-8 byte offsets relative to the section span, not string indices', () => {
  const prefix = 'Fees payable under § 3(a) include ';
  assert.notEqual(prefix.length, Buffer.byteLength(prefix, 'utf8'), 'fixture must contain a multibyte character before the edited text');
  const editedText = 'the reimbursement obligation described below.';
  const original = [{
    component_id: 'c-obligation', kind: 'TERM', label: 'obligation', text: 'old text', origin: 'CHAPEAU',
    origin_structure_node_id: 'other-node', source_span_id: 'other-span', start_byte: 1, end_byte: 9, children: [],
  }];
  const { components, problems } = buildEditedComponents({
    components: original,
    edits: new Map([['c-obligation', editedText]]),
    removed: new Set(),
    additions: [],
    sectionText: editorSectionText,
    sectionStartByte: editorSectionSpan.start_byte,
    sectionSpanId: editorSectionSpan.span_id,
  });
  assert.equal(problems.length, 0);
  const updated = components[0];
  assert.equal(updated.text, editedText);
  assert.equal(updated.origin, 'OWN');
  assert.equal(updated.source_span_id, editorSectionSpan.span_id);
  assert.equal(Object.hasOwn(updated, 'origin_structure_node_id'), false);
  assert.equal(updated.start_byte, editorSectionSpan.start_byte + Buffer.byteLength(prefix, 'utf8'));
  assert.equal(updated.end_byte, updated.start_byte + Buffer.byteLength(editedText, 'utf8'));
});

test('buildEditedComponents blocks on text that is missing or not unique in the section, leaving problems for the caller to report', () => {
  const original = [
    { component_id: 'c-1', kind: 'TERM', label: 'a', text: 'old a', origin: 'OWN', source_span_id: editorSectionSpan.span_id, start_byte: 1, end_byte: 6, children: [] },
    { component_id: 'c-2', kind: 'TERM', label: 'b', text: 'old b', origin: 'OWN', source_span_id: editorSectionSpan.span_id, start_byte: 1, end_byte: 6, children: [] },
  ];
  const sectionText = 'Fees payable under Fees payable again.';
  const { problems } = buildEditedComponents({
    components: original,
    edits: new Map([
      ['c-1', 'Fees payable'], // occurs twice in sectionText: not unique
      ['c-2', 'not present anywhere in this section'], // occurs zero times: missing
    ]),
    removed: new Set(),
    additions: [{ id: 'new-1', kind: 'TERM', text: 'under' }], // occurs exactly once: no problem
    sectionText,
    sectionStartByte: 0,
    sectionSpanId: editorSectionSpan.span_id,
  });
  const problemIds = problems.map((problem) => problem.component_id);
  assert.deepEqual(problemIds.sort(), ['c-1', 'c-2']);
});

function componentsForEditor() {
  return [
    { component_id: 'c-fee', kind: 'TERM', label: 'fee reference', text: 'Fees payable under § 3(a)', origin: 'OWN', source_span_id: editorSectionSpan.span_id, start_byte: editorSectionSpan.start_byte, end_byte: editorSectionSpan.start_byte + Buffer.byteLength('Fees payable under § 3(a)', 'utf8'), children: [] },
    { component_id: 'c-obligation', kind: 'TERM', label: 'obligation', text: 'the reimbursement obligation described below.', origin: 'OWN', source_span_id: editorSectionSpan.span_id, start_byte: editorSectionSpan.start_byte + Buffer.byteLength('Fees payable under § 3(a) include ', 'utf8'), end_byte: editorSectionSpan.end_byte, children: [] },
  ];
}

test('the component editor renders every component as a kind label, a verbatim-text input and a Remove button, plus an Add-component control', () => {
  const editorProposal = {
    proposal_id: 'p-editor', family_key: 'MAE_DEFINITION', subtype_key: 'EXCLUSION',
    headline: { label: 'Fee provision', distinguishing_component_ids: ['c-fee'] },
    components: componentsForEditor(),
  };
  const html = renderToStaticMarkup(React.createElement(ComponentEditor, {
    proposal: editorProposal, item: { item_id: 'item-editor', edited_components: null, edited_headline: null },
    sectionText: editorSectionSpan, onDecision: async () => {}, busy: false,
  }));
  assert.match(html, /data-testid="component-editor"/);
  assert.equal((html.match(/data-testid="component-edit-row"/g) || []).length, 2);
  assert.match(html, /value="Fees payable under § 3\(a\)"/);
  assert.match(html, /value="the reimbursement obligation described below\."/);
  assert.equal((html.match(/>Remove</g) || []).length, 2);
  assert.match(html, />Add component</);
  assert.match(html, />Save components</);
});

test('a component editor dispatches DECIDE_ITEM/EDITED with a components tree whose byte offsets are UTF-8 bytes', async () => {
  const original = componentsForEditor();
  const edits = new Map([['c-obligation', 'the reimbursement obligation described below, revised.']]);
  const sectionTextWithRevision = 'Fees payable under § 3(a) include the reimbursement obligation described below, revised.';
  const { components, problems } = buildEditedComponents({
    components: original, edits, removed: new Set(), additions: [],
    sectionText: sectionTextWithRevision, sectionStartByte: editorSectionSpan.start_byte, sectionSpanId: editorSectionSpan.span_id,
  });
  assert.equal(problems.length, 0);
  let dispatched = null;
  async function onDecision(itemId, decision, edit) {
    dispatched = { itemId, decision, edit };
  }
  await onDecision('item-editor', 'EDITED', componentEditPayload({
    proposal: { statement: 'Unchanged statement.', roles: { payer: 'Company' } },
    item: { edited_statement: null, edited_roles: null },
    components,
  }));
  assert.equal(dispatched.itemId, 'item-editor');
  // The database rejects an EDITED proposal without an object of roles.
  assert.deepEqual(dispatched.edit.roles, { payer: 'Company' });
  assert.equal(dispatched.decision, 'EDITED');
  assert.equal(dispatched.edit.statement, 'Unchanged statement.');
  const revised = dispatched.edit.components.find((component) => component.component_id === 'c-obligation');
  const prefix = 'Fees payable under § 3(a) include ';
  assert.equal(revised.start_byte, editorSectionSpan.start_byte + Buffer.byteLength(prefix, 'utf8'));
  assert.equal(revised.end_byte, revised.start_byte + Buffer.byteLength('the reimbursement obligation described below, revised.', 'utf8'));
  assert.equal(revised.origin, 'OWN');
  const untouched = dispatched.edit.components.find((component) => component.component_id === 'c-fee');
  assert.deepEqual(untouched, original[0]);
});
