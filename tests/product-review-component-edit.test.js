'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');
const legalSchema = require('../contracts/product/legal-schema.v1.json');

const nodeOne = 'n'.repeat(64);
const closureId = 'c'.repeat(64);
const spanId = 's'.repeat(64);
const proposalId = 'p'.repeat(64);

const sectionText = 'The parties may terminate this Agreement by mutual written consent of Parent and the Company.';
const sectionStartByte = 1000;

function byteRange(text) {
  const index = sectionText.indexOf(text);
  const prefix = Buffer.byteLength(sectionText.slice(0, index), 'utf8');
  return { start_byte: sectionStartByte + prefix, end_byte: sectionStartByte + prefix + Buffer.byteLength(text, 'utf8') };
}

function component(id, kind, label, text) {
  return { component_id: id, kind, label, text, origin: 'OWN', source_span_id: spanId, ...byteRange(text), children: [] };
}

function componentsFixture() {
  return {
    headline: { label: 'Termination right', distinguishing_component_ids: ['c-trigger'] },
    components: [
      component('c-action', 'OPERATION', 'operation', 'terminate this Agreement'),
      component('c-trigger', 'TRIGGER', 'trigger', 'mutual written consent'),
    ],
  };
}

function analysisFixture() {
  const fact = componentsFixture();
  return {
    schema_version: 'AGREEMENT_ANALYSIS_READ/V1', kind: 'draftAnalysis', analysis_run_id: '00000000-0000-4000-8000-000000000001',
    draft_analysis_id: 'd'.repeat(64),
    source_document: { source_document_id: 'e'.repeat(64), parties: ['Buyer', 'Target'] },
    agreement_structure: { nodes: [{ node_id: nodeOne, kind: 'SECTION', reference: '7.1', authored_order: 1, title: 'Termination' }] },
    sections: [{ section_routing_id: 'r'.repeat(64), structure_node_id: nodeOne, section_reference: '7.1', disposition: 'FAMILY_ASSIGNED', families: ['TERMINATION'] }],
    proposals: [{
      proposal_id: proposalId, fact_occurrence_id: 'f'.repeat(64), structure_node_id: nodeOne, source_closure_id: closureId,
      proposition_group_id: null, family_key: 'TERMINATION', subtype_key: 'MUTUAL_CONSENT', fact_type: 'TERMINATION_RIGHT',
      statement: 'The parties may terminate by mutual consent.', roles: { action: 'terminate', trigger: 'mutual written consent', terminating_parties: 'Parent and the Company', writing_requirement: 'written consent' },
      canonical_value: null, validation_status: 'VALID', source_span_ids: [spanId], unmatched_evidence: [], context_only_evidence: [],
      headline: fact.headline, components: fact.components,
    }],
    proposition_groups: [], fact_links: [], issues: [], coverage_assertions: [],
    source_closures: [{ source_closure_id: closureId, structure_node_id: nodeOne, full_section_span_id: spanId }],
    spans: [{ span_id: spanId, structure_node_id: nodeOne, source_closure_ids: [closureId], exact_text: sectionText, start_byte: sectionStartByte, end_byte: sectionStartByte + Buffer.byteLength(sectionText, 'utf8'), kind: 'FULL_SECTION' }],
  };
}

const clock = () => new Date('2026-09-12T19:00:00.000Z');

function editedComponents(edits) {
  const fact = componentsFixture();
  return fact.components.map((existing) => (Object.hasOwn(edits, existing.component_id)
    ? { ...existing, text: edits[existing.component_id], ...byteRange(edits[existing.component_id]) }
    : existing));
}

test('DECIDE_ITEM/EDITED with a valid component tree is stored as edited_components, validated the way the extraction path validates', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const components = editedComponents({ 'c-trigger': 'written consent of Parent and the Company' });
  const edited = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: item.original.statement, components,
  }, { analysis, legalSchema, clock });
  const after = edited.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(after.decision, 'EDITED');
  assert.deepEqual(after.edited_components, components);
  assert.equal(after.edited_headline, null);
  assert.equal(after.edited_statement, item.original.statement);
});

test('a command without components leaves edited_components and edited_headline unchanged', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const components = editedComponents({ 'c-trigger': 'written consent of Parent and the Company' });
  const withComponents = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: item.original.statement, components,
  }, { analysis, legalSchema, clock });
  const roleOnlyEdit = applyReviewCommand(withComponents, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: 'Changed statement only.', roles: item.original.roles,
  }, { analysis, legalSchema, clock });
  const after = roleOnlyEdit.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(after.edited_statement, 'Changed statement only.');
  assert.deepEqual(after.edited_components, components);
  assert.equal(after.edited_headline, null);
});

test('an invalid component tree rejects the command with a clear error', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const badComponents = editedComponents({ 'c-trigger': 'text that is not in the section' });
  assert.throws(() => applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: item.original.statement, components: badComponents,
  }, { analysis, legalSchema, clock }), /REVIEW_FACT_COMPONENTS/);
  const missingHeadlineTarget = componentsFixture().components.filter((candidate) => candidate.component_id !== 'c-trigger');
  assert.throws(() => applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: item.original.statement, components: missingHeadlineTarget,
  }, { analysis, legalSchema, clock }), /REVIEW_FACT_COMPONENTS/);
});

test('RESET_ITEM clears edited_components and edited_headline', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const components = editedComponents({ 'c-trigger': 'written consent of Parent and the Company' });
  const edited = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: item.original.statement, components,
  }, { analysis, legalSchema, clock });
  const reset = applyReviewCommand(edited, { type: 'RESET_ITEM', item_id: item.item_id }, { analysis, legalSchema, clock });
  const after = reset.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(after.decision, 'PENDING');
  assert.equal(after.edited_components, null);
  assert.equal(after.edited_headline, null);
});

test('compileReviewSummary prefers edited_components and edited_headline over the original', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const components = editedComponents({ 'c-trigger': 'written consent of Parent and the Company' });
  const edited = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: item.original.statement, components,
  }, { analysis, legalSchema, clock });
  const covered = applyReviewCommand(edited, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema, clock });
  const published = applyReviewCommand(covered, { type: 'PUBLISH' }, { analysis, legalSchema, clock });
  const fact = published.summary.families.flatMap((family) => family.facts).find((candidate) => candidate.review_item_id === item.item_id);
  assert.deepEqual(fact.components, components);
  assert.deepEqual(fact.headline, item.original.headline);
});
