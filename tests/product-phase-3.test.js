'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { createAnthropicProductModel } = require('../lib/product/anthropic-model');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');
const { buildReviewView } = require('../lib/product/review-view');
const { createProductReviewHandler } = require('../lib/product/review-handler');
const { createProductRunHandler } = require('../lib/product/run-handler');

const nodeOne = '1'.repeat(64);
const nodeTwo = '2'.repeat(64);
const closureId = 'c'.repeat(64);
const closureTwoId = 'd'.repeat(64);
const spanId = 's'.repeat(64);
const spanTwoId = 't'.repeat(64);
const proposal = (id, family, subtype, factType, roles, statement = 'Legal fact') => ({
  proposal_id: id.repeat(64), fact_occurrence_id: `${id}o`.padEnd(64, id), structure_node_id: nodeOne,
  family_key: family, subtype_key: subtype, fact_type: factType, statement, roles,
  canonical_value: null, proposition_group_id: `${id}g`.padEnd(64, id), source_closure_id: closureId,
  source_span_ids: [spanId], validation_status: 'VALID', state: 'PROPOSED',
});

function analysisFixture() {
  const prohibited = proposal('a', 'NO_SHOP', 'PROHIBITED_ACTION', 'PROHIBITED_ACTION', { covenant_obligor: 'Company', prohibited_action: 'solicit proposals' });
  const exception = proposal('b', 'NO_SHOP', 'EXCEPTION_PREREQUISITE', 'EXCEPTION_PREREQUISITE', { permitted_actor: 'Company', permitted_action: 'furnish information', prerequisite: 'superior proposal' });
  return {
    schema_version: 'AGREEMENT_ANALYSIS_READ/V1', kind: 'draftAnalysis', analysis_run_id: '00000000-0000-4000-8000-000000000001',
    draft_analysis_id: 'd'.repeat(64),
    source_document: { source_document_id: 'e'.repeat(64), parties: ['Buyer', 'Target'] },
    agreement_structure: { nodes: [
      { node_id: nodeOne, kind: 'SECTION', reference: '6.3', authored_order: 1, title: 'No solicitation' },
      { node_id: nodeTwo, kind: 'SECTION', reference: '9.1', authored_order: 2, title: 'Notices' },
    ] },
    sections: [
      { section_routing_id: 'r'.repeat(64), structure_node_id: nodeOne, section_reference: '6.3', disposition: 'FAMILY_ASSIGNED', families: ['NO_SHOP'] },
      { section_routing_id: 'i'.repeat(64), structure_node_id: nodeTwo, section_reference: '9.1', disposition: 'IMMATERIAL', families: [] },
    ],
    proposals: [prohibited, exception], proposition_groups: [],
    fact_links: [{ fact_link_id: 'l'.repeat(64), from_proposal_id: exception.proposal_id, to_proposal_id: prohibited.proposal_id, relationship_type: 'EXCEPTS', source_span_ids: [] }],
    issues: [{ issue_id: 'x'.repeat(64), structure_node_id: nodeOne, family_key: 'NO_SHOP', code: 'CHECK', message: 'Review this', state: 'OPEN' }],
    coverage_assertions: [
      { coverage_assertion_id: 'v'.repeat(64), structure_node_id: nodeOne, family_key: 'NO_SHOP', subject_kind: 'FACT_TYPE', state: 'NOT_FOUND' },
      { coverage_assertion_id: 'g'.repeat(64), structure_node_id: null, family_key: 'TERMINATION_FEE', subject_kind: 'FAMILY', state: 'NOT_FOUND' },
      { coverage_assertion_id: 'q'.repeat(64), structure_node_id: nodeOne, family_key: null, subject_kind: 'RESIDUAL_PARAGRAPH', subject_id: spanId, state: 'FOUND', reason: 'IMMATERIAL' },
      { coverage_assertion_id: 'k'.repeat(64), structure_node_id: nodeOne, family_key: 'NO_SHOP', subject_kind: 'RESIDUAL_PARAGRAPH', subject_id: spanId, state: 'FOUND', reason: 'KNOWN_FAMILY' },
      { coverage_assertion_id: 'u'.repeat(64), structure_node_id: nodeTwo, family_key: null, subject_kind: 'RESIDUAL_PARAGRAPH', subject_id: spanTwoId, state: 'UNRESOLVED', reason: 'UNRESOLVED_UNUSUAL_PROVISION' },
    ],
    source_closures: [
      { source_closure_id: closureId, structure_node_id: nodeOne },
      { source_closure_id: closureTwoId, structure_node_id: nodeTwo },
    ],
    spans: [
      { span_id: spanId, structure_node_id: nodeOne, source_closure_ids: [closureId], exact_text: '“Fee” means $300.', start_byte: 0, end_byte: 18, kind: 'FULL_SECTION' },
      { span_id: spanTwoId, structure_node_id: nodeTwo, source_closure_ids: [closureTwoId], exact_text: 'Section 9.1. Notices.', start_byte: 19, end_byte: 40, kind: 'FULL_SECTION' },
    ],
  };
}

const clock = (value) => () => new Date(value);

function responseDouble() {
  return { headers: {}, statusCode: null, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; } };
}

test('review worklist requires proposals, exceptions, issues, absence and immaterial decisions', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock: clock('2026-09-04T12:00:00Z') });
  assert.deepEqual(new Set(state.items.map((item) => item.kind)), new Set(['PROPOSAL', 'EXCEPTION_LINK', 'ISSUE', 'COVERAGE', 'IMMATERIAL_ROUTING']));
  const view = buildReviewView({ analysis, review: { state, version: 0 } });
  assert.equal(view.sections.length, 2);
  assert.equal(view.agreement_items.length, 1);
  const exceptionItem = view.sections[0].review_items.find((item) => item.kind === 'EXCEPTION_LINK');
  assert.equal(exceptionItem.relationship_context.from, analysis.proposals[1].statement);
  assert.equal(exceptionItem.relationship_context.to, analysis.proposals[0].statement);
  const residualItems = state.items.filter((item) => item.kind === 'COVERAGE' && item.original.subject_kind === 'RESIDUAL_PARAGRAPH');
  assert.equal(residualItems.length, 2);
  const residualItem = residualItems.find((item) => item.source_id === 'q'.repeat(64));
  assert.equal(residualItem.source_closure_id, closureId);
  assert.deepEqual(residualItem.source_span_ids, [spanId]);
  const unresolvedResidualItem = residualItems.find((item) => item.source_id === 'u'.repeat(64));
  assert.equal(unresolvedResidualItem.source_closure_id, closureTwoId);
  assert.deepEqual(unresolvedResidualItem.source_span_ids, [spanTwoId]);
  assert.equal(state.items.some((item) => item.source_id === 'k'.repeat(64)), false);
  const immaterialItem = state.items.find((item) => item.kind === 'IMMATERIAL_ROUTING');
  assert.equal(immaterialItem.source_closure_id, closureTwoId);
  assert.deepEqual(immaterialItem.source_span_ids, [spanTwoId]);
  const agreementCoverageItem = state.items.find((item) => item.kind === 'COVERAGE' && item.structure_node_id === null);
  assert.equal(agreementCoverageItem.source_closure_id, null);
  assert.deepEqual(agreementCoverageItem.source_span_ids, [spanId, spanTwoId]);
  assert.equal(view.can_publish, false);
  assert.throws(() => applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema }), /REVIEW_PENDING_ITEMS/);
});

test('lawyer edits preserve citations, missing facts validate roles, and publish retains accepted exceptions', () => {
  const analysis = analysisFixture();
  let state = initialiseReviewState(analysis, { clock: clock('2026-09-04T12:00:00Z') });
  const firstProposal = state.items.find((item) => item.kind === 'PROPOSAL');
  state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: firstProposal.item_id, decision: 'EDITED', statement: 'Company must not solicit proposals.', roles: firstProposal.original.roles }, { analysis, legalSchema, clock: clock('2026-09-04T12:01:00Z') });
  assert.deepEqual(state.items.find((item) => item.item_id === firstProposal.item_id).source_span_ids, [spanId]);
  state = applyReviewCommand(state, {
    type: 'ADD_MISSING_FACT', structure_node_id: nodeOne, source_closure_id: closureId,
    family_key: 'TERMINATION_FEE', subtype_key: 'FEE_AMOUNT', fact_type: 'FEE_AMOUNT',
    statement: 'The fee is $300.', roles: { payer: 'Company', payee: 'Parent', amount: '300', currency: 'USD' },
    value: '300', source_span_ids: [spanId],
  }, { analysis, legalSchema, clock: clock('2026-09-04T12:02:00Z') });
  assert.throws(() => applyReviewCommand(state, {
    type: 'ADD_MISSING_FACT', structure_node_id: nodeOne, source_closure_id: closureId,
    family_key: 'TERMINATION_FEE', subtype_key: 'FEE_AMOUNT', fact_type: 'FEE_AMOUNT',
    statement: 'Incomplete fee.', roles: { payer: 'Company' }, value: '300', source_span_ids: [spanId],
  }, { analysis, legalSchema }), /REVIEW_FACT_ROLES/);
  for (const item of state.items.filter((candidate) => candidate.decision === 'PENDING')) {
    state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' }, { analysis, legalSchema });
  }
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema, clock: clock('2026-09-04T12:10:00Z') });
  assert.equal(state.status, 'PUBLISHED');
  assert.throws(() => applyReviewCommand(state, { type: 'ACTIVATE_RELEASE', release_id: 'candidate-1' }, { analysis, legalSchema }), /RELEASE_EVALUATION_REQUIRED/);
  assert.equal(state.summary.relationships.length, 1);
  assert.equal(state.summary.relationships[0].source_closure_id, closureId);
  assert.deepEqual(state.summary.relationships[0].source_span_ids, [spanId]);
  assert.equal(state.summary.families.flatMap((family) => family.facts).every((fact) => fact.source_span_ids.length > 0), true);
  assert.equal(state.metrics.proposal_omissions, 1);
  assert.equal(state.metrics.review_time_seconds, 600);
  const publishedFacts = state.summary.families.flatMap((family) => family.facts);
  state = applyReviewCommand(state, {
    type: 'EVALUATE_RELEASE', reviewer_identity: 'lawyer@example.test', lawyer_attestation: true, independent_inventory_attestation: true,
    inventory: [{ inventory_item_id: 'inventory-1', description: 'The agreement contains a termination fee.', severity: 'CRITICAL' }],
    reconciliation: [{ inventory_item_id: 'inventory-1', disposition: 'PUBLISHED_FACT', review_item_id: publishedFacts[0].review_item_id }],
    citation_assessments: publishedFacts.map((fact) => ({ review_item_id: fact.review_item_id, exact: true, legally_sufficient: true, narrow: true })),
    elapsed_minutes: 10, developer_assisted: false,
  }, { analysis, legalSchema, clock: clock('2026-09-04T12:11:00Z') });
  assert.equal(state.release_evaluation.schema_version, 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1');
  assert.equal(state.release_evaluation_input.lawyer_attested_by, 'lawyer@example.test');
  assert.equal(state.items.filter((item) => ['ACCEPTED', 'EDITED'].includes(item.decision)).every((item) => item.decided_by_role === 'LAWYER'), true);
  assert.equal(state.agreement_coverage.confirmed_by_role, 'LAWYER');
  state = applyReviewCommand({ ...state, release_evaluation: { ...state.release_evaluation, passed: true } }, { type: 'ACTIVATE_RELEASE', release_id: 'candidate-1' }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'ROLLBACK_RELEASE' }, { analysis, legalSchema });
  const reopened = applyReviewCommand(state, { type: 'REOPEN' }, { analysis, legalSchema });
  assert.equal(reopened.status, 'DRAFT');
  assert.equal(reopened.agreement_coverage.decision, 'PENDING');
  assert.equal(reopened.published_at, null);
  assert.equal(reopened.summary, null);
  assert.equal(reopened.metrics, null);
  assert.equal(reopened.release_evaluation_input, null);
  assert.equal(reopened.release_evaluation, null);
});

test('release evaluation requires an explicit lawyer attestation and atomic inventory text', () => {
  const analysis = analysisFixture();
  let state = initialiseReviewState(analysis);
  for (const item of state.items) state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema });
  assert.throws(() => applyReviewCommand(state, {
    type: 'EVALUATE_RELEASE', reviewer_identity: 'lawyer@example.test', lawyer_attestation: true, independent_inventory_attestation: false,
    inventory: [], reconciliation: [], citation_assessments: [], elapsed_minutes: 1, developer_assisted: false,
  }, { analysis, legalSchema }), /LAWYER_ATTESTATION_REQUIRED/);
  assert.throws(() => applyReviewCommand(state, {
    type: 'EVALUATE_RELEASE', reviewer_identity: 'lawyer@example.test', lawyer_attestation: true, independent_inventory_attestation: true,
    inventory: [{ inventory_item_id: 'blank', description: ' ', severity: 'MATERIAL' }],
    reconciliation: [], citation_assessments: [], elapsed_minutes: 1, developer_assisted: false,
  }, { analysis, legalSchema }), /RELEASE_INVENTORY/);
});

test('unresolved or independently immaterial residual dispositions are source-linked and block publication until reviewed', () => {
  const analysis = analysisFixture();
  let state = initialiseReviewState(analysis);
  const residual = state.items.find((item) => item.kind === 'COVERAGE'
    && item.original.subject_kind === 'RESIDUAL_PARAGRAPH' && item.original.state === 'UNRESOLVED');
  for (const item of state.items.filter((candidate) => candidate.item_id !== residual.item_id)) {
    state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' }, { analysis, legalSchema });
  }
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema });
  assert.throws(() => applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema }), /REVIEW_PENDING_ITEMS/);
  state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: residual.item_id, decision: 'UNRESOLVED' }, { analysis, legalSchema });
  assert.throws(() => applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema }), /REVIEW_UNRESOLVED_ITEMS/);
});

test('publication rejects an accepted exception whose endpoint was rejected', () => {
  const analysis = analysisFixture();
  let state = initialiseReviewState(analysis);
  for (const item of state.items) {
    state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: item.kind === 'PROPOSAL' && item.source_id.startsWith('a') ? 'REJECTED' : 'ACCEPTED' }, { analysis, legalSchema });
  }
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema });
  assert.throws(() => applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema }), /PUBLISHED_RELATIONSHIP_ENDPOINT/);
});

test('Anthropic adapter records the exact provider request without credentials', async () => {
  let observed;
  const client = { messages: { create: async (request) => {
    observed = request;
    return { id: 'msg_test', model: request.model, stop_reason: 'end_turn', content: [{ type: 'text', text: '{"families":[]}' }], usage: { input_tokens: 10, output_tokens: 2 } };
  } } };
  const model = createAnthropicProductModel({ client, modelId: 'test-model' });
  const result = await model.complete({ call_kind: 'ROUTING', prompt_version: 'V1', request: { section_reference: '1.1' } });
  assert.deepEqual(result.raw_request, observed);
  assert.equal(result.raw_request.model, 'test-model');
  assert.equal(result.raw_request.messages[0].content.includes('section_reference'), true);
  assert.equal(JSON.stringify(result.raw_request).includes('apiKey'), false);
  assert.equal(result.cost_microusd, 60);
});

test('Anthropic adapter canonicalises provider responses that omit optional Anthropic fields', async () => {
  const client = { messages: { create: async () => ({
    content: [{ type: 'text', text: '{"families":[]}' }],
    usage: { input_tokens: 1, output_tokens: 1 },
    codex_invocation_identity: { transport: 'CODEX_CLI' },
  }) } };
  const model = createAnthropicProductModel({ client, modelId: 'codex-compatible-test' });
  const result = await model.complete({ call_kind: 'ROUTING', prompt_version: 'V1', request: { section_reference: '1.1' } });
  assert.deepEqual(result.raw_response, {
    content: [{ type: 'text', text: '{"families":[]}' }],
    usage: { input_tokens: 1, output_tokens: 1 },
    codex_invocation_identity: { transport: 'CODEX_CLI' },
  });
});

test('review HTTP boundary initialises state and persists commands with server-derived actor identity', async () => {
  const analysis = analysisFixture();
  let persisted = null;
  const store = {
    assertAccess: async ({ actor }) => assert.equal(actor, 'lawyer@example.test'),
    getAgreementAnalysis: async () => analysis,
    getReview: async () => persisted,
    initialiseReview: async ({ state, actor }) => {
      assert.equal(actor, 'lawyer@example.test');
      persisted = { version: 0, status: state.status, state, revisions: [{ version: 0, event_type: 'INITIALISE' }], publications: [], release_history: [] };
      return persisted;
    },
    saveReview: async ({ expectedVersion, state, actor, command }) => {
      assert.equal(expectedVersion, persisted.version);
      assert.equal(actor, 'lawyer@example.test');
      assert.equal(command.type, 'DECIDE_ITEM');
      persisted = { ...persisted, version: persisted.version + 1, status: state.status, state };
      return persisted;
    },
  };
  const handler = createProductReviewHandler({ getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test' });
  const getResponse = responseDouble();
  await handler({ method: 'GET', query: { id: analysis.analysis_run_id }, headers: {} }, getResponse);
  assert.equal(getResponse.statusCode, 200);
  const proposalItem = persisted.state.items.find((item) => item.kind === 'PROPOSAL');
  const postResponse = responseDouble();
  await handler({ method: 'POST', query: { id: analysis.analysis_run_id }, headers: { 'x-pm-csrf': 'same-origin' }, body: {
    expected_version: 0, idempotency_key: 'review-command-1', command: { type: 'DECIDE_ITEM', item_id: proposalItem.item_id, decision: 'ACCEPTED' },
  } }, postResponse);
  assert.equal(postResponse.statusCode, 200);
  assert.equal(postResponse.body.review.version, 1);
  assert.equal(postResponse.body.review.state.items.find((item) => item.item_id === proposalItem.item_id).decision, 'ACCEPTED');
});

test('review HTTP boundary evaluates and persists lawyer evidence with server-derived reviewer identity', async () => {
  const analysis = analysisFixture();
  let state = initialiseReviewState(analysis);
  for (const item of state.items) state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema });
  const facts = state.summary.families.flatMap((family) => family.facts);
  let persisted = { version: 0, status: state.status, state, revisions: [], publications: [], release_history: [] };
  let savedCommand = null;
  let savedEventType = null;
  const store = {
    assertAccess: async () => 'OWNER', getAgreementAnalysis: async () => analysis,
    getReview: async () => persisted,
    saveReview: async ({ state: next, command, eventType }) => {
      savedCommand = command;
      savedEventType = eventType;
      persisted = { ...persisted, version: 1, status: next.status, state: next };
      return persisted;
    },
  };
  const handler = createProductReviewHandler({ getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test' });
  const response = responseDouble();
  await handler({ method: 'POST', query: { id: analysis.analysis_run_id }, headers: { 'x-pm-csrf': 'same-origin' }, body: {
    expected_version: 0, idempotency_key: 'release-evaluation-1', command: {
      type: 'EVALUATE_RELEASE', reviewer_identity: 'forged@example.test', lawyer_attestation: true, independent_inventory_attestation: true,
      inventory: [{ inventory_item_id: 'inventory-1', description: 'One material legal point.', severity: 'MATERIAL' }],
      reconciliation: [{ inventory_item_id: 'inventory-1', disposition: 'PUBLISHED_FACT', review_item_id: facts[0].review_item_id }],
      citation_assessments: facts.map((fact) => ({ review_item_id: fact.review_item_id, exact: true, legally_sufficient: true, narrow: true })),
      elapsed_minutes: 30, developer_assisted: false,
    },
  } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(savedCommand.reviewer_identity, 'lawyer@example.test');
  assert.equal(savedEventType, 'EVALUATE_RELEASE');
  assert.equal(response.body.review.state.release_evaluation_input.lawyer_attested_by, 'lawyer@example.test');
  const rejected = responseDouble();
  await handler({ method: 'POST', query: { id: analysis.analysis_run_id }, headers: { 'x-pm-csrf': 'same-origin' }, body: {
    expected_version: 1, idempotency_key: 'release-evaluation-2', command: {
      ...savedCommand, reviewer_identity: 'forged@example.test', independent_inventory_attestation: false,
    },
  } }, rejected);
  assert.equal(rejected.statusCode, 422);
  assert.equal(rejected.body.error, 'LAWYER_ATTESTATION_REQUIRED');
});

test('Review UI separates candidate finalisation, evaluation, activation and recovery', () => {
  const source = fs.readFileSync(require.resolve('../components/product/ReviewWorkspace.jsx'), 'utf8');
  assert.match(source, /Finalise inactive candidate/);
  assert.match(source, /Activate evaluated release/);
  assert.match(source, /ROLLBACK_RELEASE/);
  assert.match(source, /Retry review load/);
  assert.match(source, /import \{ displaySectionReference \}/);
  assert.match(source, /displaySectionReference\(section\.section_reference\)/);
  assert.match(source, /displaySectionReference\(section\.routing\.section_reference\)/);
  assert.match(source, /pendingAction\.current\?\.signature === signature/);
  assert.match(source, /await load\(\)/);
  assert.match(source, /loadSource\(\).*catch/);
});

test('run HTTP boundary exposes one resumable step and explicit retry without a detached server task', async () => {
  const runId = analysisFixture().analysis_run_id;
  let retryKey = null;
  const store = {
    assertAccess: async () => 'OWNER',
    retryRun: async ({ idempotencyKey }) => { retryKey = idempotencyKey; },
    getRunContext: async () => ({ sourceDocument: { canonical_text: '' }, agreementStructure: { nodes: [] } }),
    claimNextSection: async () => null,
    getProgress: async () => ({ total: 1, completed: 0, failed: 0 }),
    loadCompletedSectionResults: async () => [],
    getAgreementAnalysis: async () => ({ kind: 'analysisProgress', run_id: runId, status: 'RUNNING', stage: 'SECTION_ANALYSIS', progress: { total: 1, completed: 0, failed: 0 } }),
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test',
    modelFactory: () => ({ complete: async () => { throw new Error('model must not run without a claimed section'); } }),
  });
  const response = responseDouble();
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: { retry: true, idempotency_key: 'retry-one' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(retryKey, 'retry-one');
  assert.equal(response.body.kind, 'analysisProgress');
});
