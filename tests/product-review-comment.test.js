'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');
const legalSchema = require('../contracts/product/legal-schema.v1.json');

const nodeOne = 'n'.repeat(64);
const closureId = 'c'.repeat(64);
const spanId = 's'.repeat(64);
const proposalId = 'p'.repeat(64);

function analysisFixture() {
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
    }],
    proposition_groups: [], fact_links: [], issues: [], coverage_assertions: [],
    source_closures: [{ source_closure_id: closureId, structure_node_id: nodeOne }],
    spans: [{ span_id: spanId, structure_node_id: nodeOne, source_closure_ids: [closureId], exact_text: 'by mutual written consent', start_byte: 0, end_byte: 25, kind: 'SUPPORTING_EVIDENCE' }],
  };
}

const clock = () => new Date('2026-09-12T19:00:00.000Z');

test('a comment is stored on the item without changing its decision, and can be removed', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const commented = applyReviewCommand(state, { type: 'COMMENT_ITEM', item_id: item.item_id, comment: '  Tail needs breaking up.  ' }, { analysis, legalSchema, clock });
  const after = commented.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(after.comment, 'Tail needs breaking up.');
  assert.equal(after.commented_at, '2026-09-12T19:00:00.000Z');
  assert.equal(after.decision, 'PENDING');
  assert.deepEqual(after.original, item.original);
  const decided = applyReviewCommand(commented, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'REJECTED' }, { analysis, legalSchema, clock });
  assert.equal(decided.items.find((candidate) => candidate.item_id === item.item_id).comment, 'Tail needs breaking up.');
  const cleared = applyReviewCommand(decided, { type: 'COMMENT_ITEM', item_id: item.item_id, comment: null }, { analysis, legalSchema, clock });
  const final = cleared.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(Object.hasOwn(final, 'comment'), false);
  assert.equal(final.decision, 'REJECTED');
});

test('comment command rejects unknown items and non-text comments', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  assert.throws(() => applyReviewCommand(state, { type: 'COMMENT_ITEM', item_id: 'missing', comment: 'x' }, { analysis, legalSchema, clock }), /REVIEW_ITEM_NOT_FOUND/);
  const item = state.items[0];
  assert.throws(() => applyReviewCommand(state, { type: 'COMMENT_ITEM', item_id: item.item_id, comment: 5 }, { analysis, legalSchema, clock }), /REVIEW_COMMENT/);
  assert.throws(() => applyReviewCommand(state, { type: 'COMMENT_ITEM', item_id: item.item_id, comment: 'x'.repeat(4001) }, { analysis, legalSchema, clock }), /REVIEW_COMMENT/);
});

test('reset returns an edited item to pending, drops the edit and keeps the comment', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const commented = applyReviewCommand(state, { type: 'COMMENT_ITEM', item_id: item.item_id, comment: 'note' }, { analysis, legalSchema, clock });
  const edited = applyReviewCommand(commented, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: 'Changed.', roles: { ...item.original.roles, action: 'x [[note]]' }, source_span_ids: item.original.source_span_ids }, { analysis, legalSchema, clock });
  assert.equal(edited.items.find((candidate) => candidate.item_id === item.item_id).decision, 'EDITED');
  const reset = applyReviewCommand(edited, { type: 'RESET_ITEM', item_id: item.item_id }, { analysis, legalSchema, clock });
  const after = reset.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(after.decision, 'PENDING');
  assert.equal(after.edited_statement, null);
  assert.equal(after.edited_roles, null);
  assert.equal(after.comment, 'note');
  assert.deepEqual(after.source_span_ids, item.original.source_span_ids);
  assert.equal(Object.hasOwn(after, 'reviewed_at'), false);
  assert.throws(() => applyReviewCommand(reset, { type: 'RESET_ITEM', item_id: 'missing' }, { analysis, legalSchema, clock }), /REVIEW_ITEM_NOT_FOUND/);
});
