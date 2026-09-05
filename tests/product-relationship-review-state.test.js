'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');
const { buildReviewView } = require('../lib/product/review-view');
const { projectReviewRelationships } = require('../lib/product/review-handler');

const nodeId = '1'.repeat(64);
const closureId = 'c'.repeat(64);
const spanId = 's'.repeat(64);

function proposal(id, subtypeKey, factType, roles, statement) {
  return {
    schema_version: 'PRODUCT_FACT_PROPOSAL/V1', proposal_id: id.repeat(64),
    fact_occurrence_id: `${id}o`.padEnd(64, id), structure_node_id: nodeId,
    family_key: 'NO_SHOP', subtype_key: subtypeKey, fact_type: factType, statement, roles,
    canonical_value: null, proposition_group_id: null, source_closure_id: closureId,
    source_span_ids: [spanId], validation_status: 'VALID', state: 'PROPOSED',
  };
}

function analysisFixture({ emptyExceptionSource = false, disallowedException = false } = {}) {
  const prohibited = proposal('a', 'PROHIBITED_ACTION', 'PROHIBITED_ACTION', {
    covenant_obligor: 'Company', prohibited_action: 'solicit proposals',
  }, 'The Company must not solicit proposals.');
  const exception = proposal('b', 'EXCEPTION_PREREQUISITE', 'EXCEPTION_PREREQUISITE', {
    permitted_actor: 'Company', permitted_action: 'furnish information', prerequisite: 'superior proposal',
  }, 'The Company may furnish information after a superior proposal.');
  const exceptionFrom = disallowedException ? prohibited : exception;
  const links = [{
    schema_version: 'PRODUCT_FACT_LINK/V1', fact_link_id: 'e'.repeat(64),
    from_proposal_id: exceptionFrom.proposal_id,
    to_proposal_id: disallowedException ? exception.proposal_id : prohibited.proposal_id,
    relationship_type: 'EXCEPTS', source_span_ids: emptyExceptionSource ? [] : [spanId],
  }, {
    schema_version: 'PRODUCT_FACT_LINK/V1', fact_link_id: 'q'.repeat(64),
    from_proposal_id: prohibited.proposal_id, to_proposal_id: exception.proposal_id,
    relationship_type: 'QUALIFIES', source_span_ids: [spanId],
  }];
  return {
    kind: 'draftAnalysis', analysis_run_id: '00000000-0000-4000-8000-000000000001',
    draft_analysis_id: 'd'.repeat(64),
    agreement_structure: { nodes: [{ node_id: nodeId, kind: 'SECTION', reference: '6.3', authored_order: 1 }] },
    sections: [{ section_routing_id: 'r'.repeat(64), structure_node_id: nodeId, section_reference: '6.3', disposition: 'FAMILY_ASSIGNED', families: ['NO_SHOP'] }],
    proposals: [prohibited, exception], proposition_groups: [], fact_links: links,
    issues: [], coverage_assertions: [],
    source_closures: [{ source_closure_id: closureId, structure_node_id: nodeId }],
    spans: [{ span_id: spanId, structure_node_id: nodeId, source_closure_ids: [closureId], exact_text: 'Section 6.3 source.', kind: 'FULL_SECTION' }],
  };
}

function decideAllFacts(state, analysis) {
  let next = state;
  for (const item of next.items.filter((candidate) => ['PROPOSAL', 'USER_FACT'].includes(candidate.kind)
    && candidate.decision === 'PENDING')) {
    next = applyReviewCommand(next, {
      type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED',
    }, { analysis, legalSchema });
  }
  return next;
}

test('all typed model links are reviewable and lawyer relationships retain immutable originals', () => {
  const analysis = analysisFixture();
  const rawLinks = structuredClone(analysis.fact_links);
  let state = initialiseReviewState(analysis);
  assert.deepEqual(state.items.filter((item) => ['EXCEPTION_LINK', 'RELATIONSHIP'].includes(item.kind))
    .map((item) => [item.kind, item.source_id]).sort(), [
    ['EXCEPTION_LINK', 'e'.repeat(64)],
    ['RELATIONSHIP', 'q'.repeat(64)],
  ].sort());
  assert.deepEqual(state.items.find((item) => item.kind === 'EXCEPTION_LINK').original, rawLinks[0]);
  assert.deepEqual(state.items.find((item) => item.kind === 'RELATIONSHIP').original, rawLinks[1]);

  state = applyReviewCommand(state, {
    type: 'ADD_MISSING_FACT', structure_node_id: nodeId, source_closure_id: closureId,
    family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', fact_type: 'PROHIBITED_ACTION',
    statement: 'The Company must not initiate discussions.',
    roles: { covenant_obligor: 'Company', prohibited_action: 'initiate discussions' },
    source_span_ids: [spanId],
  }, { analysis, legalSchema });
  const userFact = state.items.find((item) => item.kind === 'USER_FACT');
  const prohibited = state.items.find((item) => item.source_id === 'a'.repeat(64));
  state = applyReviewCommand(state, {
    type: 'UPSERT_RELATIONSHIP', from_item_id: userFact.item_id, to_item_id: prohibited.item_id,
    relationship_type: 'QUALIFIES', source_closure_id: closureId, source_span_ids: [spanId],
  }, { analysis, legalSchema });
  const added = state.items.find((item) => item.kind === 'USER_RELATIONSHIP');
  assert.equal(added.source_id, '03f36358a1a0fa65512dc4358734a6f007e9d11e7dd0e1802c60eb4aee9f7e5b');
  assert.equal(added.decision, 'EDITED');
  assert.equal(added.edited_relationship, null);
  assert.deepEqual(added.original, {
    schema_version: 'PRODUCT_USER_RELATIONSHIP/V1',
    from_proposal_id: userFact.source_id, to_proposal_id: prohibited.source_id,
    relationship_type: 'QUALIFIES', source_closure_id: closureId, source_span_ids: [spanId],
  });

  const modelRelationship = state.items.find((item) => item.kind === 'RELATIONSHIP');
  const exception = state.items.find((item) => item.source_id === 'b'.repeat(64));
  const immutableOriginal = structuredClone(modelRelationship.original);
  state = applyReviewCommand(state, {
    type: 'UPSERT_RELATIONSHIP', item_id: modelRelationship.item_id,
    from_item_id: userFact.item_id, to_item_id: exception.item_id,
    relationship_type: 'QUALIFIES', source_closure_id: closureId, source_span_ids: [spanId],
  }, { analysis, legalSchema });
  const edited = state.items.find((item) => item.item_id === modelRelationship.item_id);
  assert.deepEqual(edited.original, immutableOriginal);
  assert.deepEqual(edited.edited_relationship, {
    from_proposal_id: userFact.source_id, to_proposal_id: exception.source_id,
    relationship_type: 'QUALIFIES', source_closure_id: closureId, source_span_ids: [spanId],
  });
  assert.equal(edited.decision, 'EDITED');
  state = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: edited.item_id, decision: 'REJECTED',
  }, { analysis, legalSchema });
  assert.deepEqual(state.items.find((item) => item.item_id === edited.item_id).edited_relationship,
    edited.edited_relationship);
  state = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: edited.item_id, decision: 'ACCEPTED',
  }, { analysis, legalSchema });
  assert.deepEqual(state.items.find((item) => item.item_id === edited.item_id).edited_relationship,
    edited.edited_relationship);
  state = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: exception.item_id, decision: 'EDITED',
    statement: 'Edited exception statement.', roles: exception.original.roles,
    source_span_ids: [spanId],
  }, { analysis, legalSchema });
  const relationshipView = buildReviewView({ analysis, review: { state, version: 2 } });
  assert.equal(relationshipView.relationship_items.find((item) => item.item_id === edited.item_id)
    .relationship_context.to, 'Edited exception statement.');

  state = decideAllFacts(state, analysis);
  const exceptionItem = state.items.find((item) => item.kind === 'EXCEPTION_LINK');
  state = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: exceptionItem.item_id, decision: 'ACCEPTED',
  }, { analysis, legalSchema });
  state = applyReviewCommand(state, {
    type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true,
  }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema });
  assert.equal(state.summary.relationships.length, 3);
  assert.ok(state.summary.relationships.some((relationship) => (
    relationship.review_item_id === edited.item_id
    && relationship.from_proposal_id === userFact.source_id
    && relationship.relationship_type === 'QUALIFIES'
  )));
  const reopened = applyReviewCommand(state, { type: 'REOPEN' }, { analysis, legalSchema });
  assert.deepEqual(reopened.items.find((item) => item.item_id === edited.item_id).original,
    immutableOriginal);
  assert.deepEqual(reopened.items.find((item) => item.item_id === edited.item_id).edited_relationship,
    edited.edited_relationship);
  assert.ok(reopened.items.some((item) => item.item_id === added.item_id));
});

test('old drafts and reopened reviews backfill every raw typed link as pending work', () => {
  const analysis = analysisFixture();
  const current = initialiseReviewState(analysis);
  const oldDraft = {
    ...current,
    items: current.items.filter((item) => item.kind !== 'RELATIONSHIP'),
  };
  const projected = projectReviewRelationships({ state: oldDraft, version: 4 }, analysis);
  const view = buildReviewView({ analysis, review: projected });
  assert.equal(view.pending_count, oldDraft.items.filter((item) => item.decision === 'PENDING').length + 1);
  assert.equal(view.can_publish, false);
  const saved = applyReviewCommand(oldDraft, { type: 'SAVE_PROGRESS' }, { analysis, legalSchema });
  const backfilled = saved.items.find((item) => item.source_id === 'q'.repeat(64));
  assert.equal(backfilled.kind, 'RELATIONSHIP');
  assert.equal(backfilled.decision, 'PENDING');

  let published = decideAllFacts(oldDraft, analysis);
  for (const item of published.items.filter((candidate) => candidate.decision === 'PENDING')) {
    published = applyReviewCommand(published, {
      type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED',
    }, { analysis, legalSchema });
  }
  published = applyReviewCommand(published, {
    type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true,
  }, { analysis, legalSchema });
  assert.throws(() => applyReviewCommand({ ...published, items: oldDraft.items.map((item) => ({ ...item, decision: 'ACCEPTED' })) }, {
    type: 'PUBLISH',
  }, { analysis, legalSchema }), /REVIEW_PENDING_ITEMS/);

  const oldPublished = {
    ...oldDraft, status: 'PUBLISHED', summary: { marker: 'prior release' },
    published_at: new Date().toISOString(),
    review_timing: {
      schema_version: 'PRODUCT_REVIEW_TIMING/V1', accumulated_draft_seconds: 0,
      active_draft_started_at: null,
    },
  };
  const snapshot = structuredClone(oldPublished);
  const publishedProjection = projectReviewRelationships({ state: oldPublished, version: 8 }, analysis);
  buildReviewView({ analysis, review: publishedProjection });
  assert.deepEqual(oldPublished, snapshot);
  assert.equal(publishedProjection.state, oldPublished);
  const reopened = applyReviewCommand(oldPublished, { type: 'REOPEN' }, { analysis, legalSchema });
  assert.equal(reopened.items.find((item) => item.source_id === 'q'.repeat(64)).decision, 'PENDING');
  assert.equal(snapshot.summary.marker, 'prior release');
});

test('server projection prevents publication when an accepted relationship has a rejected endpoint', () => {
  const analysis = analysisFixture();
  let state = initialiseReviewState(analysis);
  for (const item of state.items) {
    state = applyReviewCommand(state, {
      type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED',
    }, { analysis, legalSchema });
  }
  const rejectedEndpoint = state.items.find((item) => item.source_id === 'a'.repeat(64));
  state = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: rejectedEndpoint.item_id, decision: 'REJECTED',
  }, { analysis, legalSchema });
  state = applyReviewCommand(state, {
    type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true,
  }, { analysis, legalSchema });
  const projected = projectReviewRelationships({ state, version: 4 }, analysis);
  assert.equal(projected.state.relationship_review_coherent, false);
  assert.equal(buildReviewView({ analysis, review: projected }).can_publish, false);
});

test('relationship review rejects guessed endpoints, types and source bindings', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis);
  const exceptionItem = state.items.find((item) => item.kind === 'EXCEPTION_LINK');
  const prohibited = state.items.find((item) => item.source_id === 'a'.repeat(64));
  const exception = state.items.find((item) => item.source_id === 'b'.repeat(64));
  const base = {
    type: 'UPSERT_RELATIONSHIP', from_item_id: prohibited.item_id, to_item_id: exception.item_id,
    relationship_type: 'QUALIFIES', source_closure_id: closureId, source_span_ids: [spanId],
  };
  assert.throws(() => applyReviewCommand(state, { ...base, from_item_id: 'missing' }, {
    analysis, legalSchema,
  }), /REVIEW_RELATIONSHIP_ENDPOINT/);
  assert.throws(() => applyReviewCommand(state, { ...base, to_item_id: prohibited.item_id }, {
    analysis, legalSchema,
  }), /REVIEW_RELATIONSHIP_ENDPOINT/);
  assert.throws(() => applyReviewCommand(state, { ...base, relationship_type: 'MODEL_GUESS' }, {
    analysis, legalSchema,
  }), /REVIEW_RELATIONSHIP_TYPE/);
  assert.throws(() => applyReviewCommand(state, { ...base, relationship_type: 'EXCEPTS' }, {
    analysis, legalSchema,
  }), /REVIEW_RELATIONSHIP_TYPE/);
  assert.throws(() => applyReviewCommand(state, { ...base, source_closure_id: 'missing' }, {
    analysis, legalSchema,
  }), /REVIEW_RELATIONSHIP_SOURCE/);
  assert.throws(() => applyReviewCommand(state, { ...base, source_span_ids: [] }, {
    analysis, legalSchema,
  }), /REVIEW_RELATIONSHIP_SOURCE/);
  assert.throws(() => applyReviewCommand(state, {
    ...base,
    item_id: state.items.find((item) => item.kind === 'RELATIONSHIP').item_id,
    from_item_id: exception.item_id,
    to_item_id: prohibited.item_id,
    relationship_type: 'EXCEPTS',
  }, { analysis, legalSchema }), /REVIEW_RELATIONSHIP_DUPLICATE/);
  assert.throws(() => applyReviewCommand(initialiseReviewState(analysisFixture({ disallowedException: true })), {
    type: 'DECIDE_ITEM', item_id: exceptionItem.item_id, decision: 'ACCEPTED',
  }, { analysis: analysisFixture({ disallowedException: true }), legalSchema }), /REVIEW_RELATIONSHIP_TYPE/);

  const missingSourceAnalysis = analysisFixture({ emptyExceptionSource: true });
  const missingSourceState = initialiseReviewState(missingSourceAnalysis);
  assert.throws(() => applyReviewCommand(missingSourceState, {
    type: 'DECIDE_ITEM',
    item_id: missingSourceState.items.find((item) => item.kind === 'EXCEPTION_LINK').item_id,
    decision: 'ACCEPTED',
  }, { analysis: missingSourceAnalysis, legalSchema }), /REVIEW_RELATIONSHIP_SOURCE/);
});
