'use strict';

// Phase 6 cutover scripts (lib/product/cutover-client.js,
// release-candidate.js, rollback-drill.js, smoke-test.js) over the real
// route handlers and an in-memory store that keeps the database's release
// rules: PUBLISH stores an immutable release superseding the current head
// and leaves the head alone; ACTIVATE_RELEASE moves the head to a release
// that supersedes it; ROLLBACK_RELEASE moves it back; the published read
// lists the head's facts. The database proof is
// tests/product-phase-6-db.test.js.

const assert = require('node:assert/strict');
const test = require('node:test');

const { createProductIntakeHandler } = require('../lib/product/intake-handler');
const { createProductAnalysisHandler } = require('../lib/product/analysis-handler');
const { createProductPreviewHandler } = require('../lib/product/preview-handler');
const { createProductReviewHandler } = require('../lib/product/review-handler');
const { createPublishedFactsHandler } = require('../lib/product/published-facts-handler');
const { createInProcessCutoverClient, createHttpCutoverClient, cutoverClientFromEnvironment, CutoverRequestError } = require('../lib/product/cutover-client');
const { assessReleaseCandidate, loadReleaseCandidate, renderAssessment } = require('../lib/product/release-candidate');
const { rollbackDrill, renderDrill } = require('../lib/product/rollback-drill');
const { runSmokeTest, renderSmokeTest } = require('../lib/product/smoke-test');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const RUN_ID = '00000000-0000-4000-8000-000000000001';
const SOURCE_ID = 'e'.repeat(64);
const NODE = '1'.repeat(64);
const CLOSURE = 'c'.repeat(64);
const SPAN = 's'.repeat(64);
const actor = 'lawyer@example.test';
const clock = () => new Date('2026-10-18T20:00:00.000Z');

function layeredProposal(id, label, start, end) {
  return {
    proposal_id: id.repeat(64), fact_occurrence_id: `${id}o`.padEnd(64, id), structure_node_id: NODE,
    family_key: 'TERMINATION_FEE', subtype_key: 'FEE_AMOUNT', fact_type: 'FEE_AMOUNT', statement: label,
    roles: { payer: 'Company', payee: 'Parent', amount: '$300', currency: 'USD' }, canonical_value: null, proposition_group_id: null, source_closure_id: CLOSURE,
    source_span_ids: [SPAN], validation_status: 'VALID', state: 'PROPOSED',
    headline: { label, distinguishing_component_ids: [] },
    components: [{ component_id: `${id}-c1`, kind: 'AMOUNT', label: 'amount', text: '$300', origin: 'OWN', start_byte: start, end_byte: end, source_span_id: SPAN, gap_before: false, children: [] }],
  };
}

function analysisFixture() {
  return {
    schema_version: 'AGREEMENT_ANALYSIS_READ/V1', kind: 'draftAnalysis', analysis_run_id: RUN_ID, status: 'READY', stage: 'READY',
    draft_analysis_id: 'd'.repeat(64), legal_schema_version: 'LEGAL_SCHEMA/V2', created_at: '2026-10-18T19:00:00.000Z',
    source_document: { source_document_id: SOURCE_ID, retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000100000001/ex21.htm', parties: ['Buyer', 'Target'] },
    agreement_structure: { nodes: [{ node_id: NODE, kind: 'SECTION', reference: '8.3', authored_order: 1, title: 'Termination fee' }] },
    sections: [{ section_routing_id: 'r'.repeat(64), structure_node_id: NODE, section_reference: '8.3', disposition: 'FAMILY_ASSIGNED', families: ['TERMINATION_FEE'] }],
    proposals: [layeredProposal('a', 'Company termination fee', 8, 12), layeredProposal('b', 'Parent termination fee', 13, 17)],
    proposition_groups: [], fact_links: [], issues: [],
    // The release evaluation's coverage bar wants every section and every
    // required role disposed.
    coverage_assertions: [
      { coverage_assertion_id: 'v'.repeat(64), structure_node_id: NODE, family_key: null, subject_kind: 'SECTION', subject_id: NODE, state: 'FOUND' },
      ...['a', 'b'].flatMap((id) => ['payer', 'payee', 'amount', 'currency'].map((role) => ({
        coverage_assertion_id: sha256Hex(`${id}:${role}`), structure_node_id: NODE, family_key: 'TERMINATION_FEE', subject_kind: 'ROLE',
        subject_id: `${`${id}o`.padEnd(64, id)}:${role}`, required_role: role, state: 'FOUND',
      }))),
    ],
    source_closures: [{ source_closure_id: CLOSURE, structure_node_id: NODE }],
    spans: [{ span_id: SPAN, structure_node_id: NODE, source_closure_ids: [CLOSURE], exact_text: '“Fee” means $300.', start_byte: 0, end_byte: 18, kind: 'FULL_SECTION' }],
  };
}

// The in-memory store: one run, one review session, releases and one head
// per source, as supabase/migrations/20260905070000_product_phase_3_review.sql
// keeps them.
function createFakeStore(analysis) {
  const state = { session: null, revisions: [], publications: [], releases: [], heads: new Map(), actions: new Map() };
  const releaseHistory = () => state.releases.map((release) => ({
    release_id: release.release_id, publication_version: release.publication_version, review_version: release.review_version,
    supersedes_release_id: release.supersedes_release_id, published_by: release.published_by, published_at: release.published_at,
    active: state.heads.get(SOURCE_ID) === release.release_id,
  })).sort((left, right) => right.publication_version - left.publication_version);
  const review = () => (state.session ? {
    schema_version: 'PRODUCT_REVIEW_READ/V1', run_id: RUN_ID, version: state.session.version, status: state.session.status, state: state.session.state,
    active_release_id: state.heads.get(SOURCE_ID) || null,
    revisions: state.revisions.map((revision) => ({ version: revision.version, actor, event_type: revision.event_type, created_at: revision.created_at })).reverse(),
    publications: [...state.publications].reverse(), release_history: releaseHistory(),
  } : null);
  const fail = (message) => { throw Object.assign(new Error(message), { code: 'DATABASE_ERROR' }); };
  return {
    state,
    assertAccess: async () => 'OWNER',
    getRun: async () => ({ run_id: RUN_ID, source_document_id: SOURCE_ID, status: 'READY', stage: 'READY', schema_version: 'LEGAL_SCHEMA/V2', source_generation: 8, model_config: { provider_id: 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION' }, created_at: '2026-10-18T18:00:00.000Z' }),
    getAgreementAnalysis: async () => analysis,
    getRunContext: async () => ({ run: await this?.getRun?.() || { run_id: RUN_ID, status: 'READY', stage: 'READY', schema_version: 'LEGAL_SCHEMA/V2', source_generation: 8, model_config: {} }, sourceDocument: { ...analysis.source_document, canonical_text: '“Fee” means $300.' }, agreementStructure: analysis.agreement_structure }),
    loadCompletedSectionResults: async () => [],
    loadDraftIssues: async () => [],
    getReleaseTiming: async () => ({ processingStartedAt: '2026-10-18T18:00:00.000Z', processingCompletedAt: '2026-10-18T19:00:00.000Z' }),
    listReferenceSources: async () => [{ source_document_id: SOURCE_ID, retrieval_url: analysis.source_document.retrieval_url, parties: [] }],
    getReview: async () => review(),
    initialiseReview: async ({ state: initial }) => {
      state.session = { version: 0, status: initial.status, state: initial };
      state.revisions.push({ version: 0, event_type: 'INITIALISE', created_at: clock().toISOString() });
      return review();
    },
    saveReview: async ({ expectedVersion, state: next, eventType, idempotencyKey, command }) => {
      const actionId = sha256Hex(`${RUN_ID}\u001f${actor}\u001f${idempotencyKey}`);
      if (state.actions.has(idempotencyKey)) {
        const existing = state.actions.get(idempotencyKey);
        if (existing.actionId !== actionId || JSON.stringify(existing.command) !== JSON.stringify(command)) fail('review action idempotency collision');
        return review();
      }
      if (state.session.version !== expectedVersion) fail('review optimistic lock conflict');
      const version = state.session.version + 1;
      const now = clock().toISOString();
      if (eventType === 'PUBLISH') {
        if (next.items.some((item) => item.decision === 'PENDING')) fail('review is not publishable');
        const publicationVersion = state.publications.length + 1;
        state.publications.push({ publication_version: publicationVersion, review_version: version, summary_id: next.summary.summary_id, summary: next.summary, metrics: next.metrics, published_at: next.published_at });
        state.releases.push({
          release_id: sha256Hex(`${SOURCE_ID}\u001f${RUN_ID}\u001f${publicationVersion}\u001f${next.summary.summary_id}`), source_document_id: SOURCE_ID, run_id: RUN_ID,
          publication_version: publicationVersion, review_version: version, supersedes_release_id: state.heads.get(SOURCE_ID) || null,
          summary: next.summary, metrics: next.metrics, published_by: actor, published_at: next.published_at,
        });
      } else if (eventType === 'ACTIVATE_RELEASE') {
        const candidate = state.releases.find((release) => release.release_id === command.release_id);
        if (!candidate) fail('release candidate does not match this reviewed summary');
        if ((state.heads.get(SOURCE_ID) || null) !== candidate.supersedes_release_id) fail('release candidate is stale');
        state.heads.set(SOURCE_ID, candidate.release_id);
      } else if (eventType === 'ROLLBACK_RELEASE') {
        const active = state.releases.find((release) => release.release_id === state.heads.get(SOURCE_ID));
        if (!active || !active.supersedes_release_id) fail('no prior active release exists');
        state.heads.set(SOURCE_ID, active.supersedes_release_id);
      }
      state.session = { version, status: next.status, state: next };
      state.revisions.push({ version, event_type: eventType, created_at: now });
      state.actions.set(idempotencyKey, { actionId, command });
      return review();
    },
    listPublishedLayeredFacts: async () => [...state.heads].map(([sourceDocumentId, releaseId]) => {
      const release = state.releases.find((candidate) => candidate.release_id === releaseId);
      return {
        run_id: release.run_id, source_document_id: sourceDocumentId, agreement_label: analysis.source_document.retrieval_url, released_at: release.published_at,
        facts: release.summary.families.flatMap((family) => family.facts).filter((fact) => Array.isArray(fact.components)),
      };
    }),
  };
}

function createClient(store, { intakeFoundation } = {}) {
  const getClient = () => ({});
  const storeFactory = () => store;
  const actorResolver = async () => actor;
  return createInProcessCutoverClient({ handlers: {
    intake: createProductIntakeHandler({
      getClient, storeFactory, actorResolver, intakeFactory: () => ({ intake() {} }),
      modelConfigResolver: () => ({ provider_id: 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION' }),
      foundationFactory: () => ({ submit: intakeFoundation || (async () => { throw new Error('no intake in this test'); }) }),
    }),
    analysis: createProductAnalysisHandler({ getClient, storeFactory, actorResolver }),
    preview: createProductPreviewHandler({ getClient, storeFactory, actorResolver }),
    review: createProductReviewHandler({ getClient, storeFactory, actorResolver, clock }),
    publishedFacts: createPublishedFactsHandler({ getClient, storeFactory, actorResolver }),
  } });
}

async function decideEverything(client) {
  let workspace = await client.getReview(RUN_ID);
  let version = workspace.review.version;
  for (const item of workspace.review.state.items) {
    const response = await client.reviewCommand(RUN_ID, { expected_version: version, idempotency_key: `decide-${item.item_id}-${version}`, command: { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' } });
    version = response.review.version;
  }
  const response = await client.reviewCommand(RUN_ID, { expected_version: version, idempotency_key: `coverage-${version}`, command: { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true } });
  return response.review.version;
}

async function evaluateAndActivate(client, releaseId, sampleId) {
  const workspace = await client.getReview(RUN_ID);
  const facts = workspace.review.state.summary.families.flatMap((family) => family.facts);
  let response = await client.reviewCommand(RUN_ID, { expected_version: workspace.review.version, idempotency_key: `evaluate-${sampleId}`, command: {
    type: 'EVALUATE_RELEASE', lawyer_attestation: true, reference_samples_attestation: true,
    reference_samples: [{ reference_sample_id: sampleId, source_document_id: SOURCE_ID, source_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000100000001/ex21.htm', source_section: 'Section 8.3', description: 'One reviewed reference legal point.', severity: 'MATERIAL', assessment: 'FOUND', comparison: 'Same legal point.' }],
    citation_assessments: facts.map((fact) => ({ review_item_id: fact.review_item_id, exact: true, legally_sufficient: true, narrow: true })),
    elapsed_minutes: 90, developer_assisted: false,
  } });
  assert.equal(response.review.state.release_evaluation.passed, true, JSON.stringify(response.review.state.release_evaluation.bars));
  response = await client.reviewCommand(RUN_ID, { expected_version: response.review.version, idempotency_key: `activate-${sampleId}`, command: { type: 'ACTIVATE_RELEASE', release_id: releaseId } });
  return response;
}

test('the smoke test runs the intake dry, reads status, preview and the published read, and reports a failing step', async () => {
  const store = createFakeStore(analysisFixture());
  let submitted = null;
  const client = createClient(store, { intakeFoundation: async (input) => { submitted = input; return { run_id: RUN_ID, source_document_id: SOURCE_ID, source_generation: 9, status: 'QUEUED', stage: 'STRUCTURE' }; } });
  const result = await runSmokeTest({ client, secUrl: 'https://www.sec.gov/Archives/edgar/data/1/000000000100000001/ex21.htm', generation: 9 });
  assert.equal(result.ok, true, JSON.stringify(result.steps));
  assert.equal(submitted.explicitGeneration, 9);
  assert.match(submitted.idempotencyKey, /^smoke:/);
  assert.deepEqual(result.steps.map((step) => step.name), ['intake (dry run, no worker woken)', 'run status', 'provisions page read', 'published read']);
  assert.equal(result.steps[0].generation, 9);
  assert.equal(result.steps[1].run_status, 'READY');
  assert.equal(result.steps[1].model_provider, 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION');
  assert.equal(result.steps[2].review_status, 'DRAFT');
  assert.equal(result.steps[3].this_source, null);
  assert.match(renderSmokeTest(result), /smoke test passed for run/);

  const broken = createClient({ ...store, getAgreementAnalysis: async () => { throw new Error('boom'); } });
  const consoleError = console.error; console.error = () => {};
  let failed;
  try { failed = await runSmokeTest({ client: broken, runId: RUN_ID }); } finally { console.error = consoleError; }
  assert.equal(failed.ok, false);
  assert.equal(failed.steps.find((step) => step.name === 'run status').ok, false);
  assert.equal(failed.steps.find((step) => step.name === 'run status').status, 500);
  assert.match(renderSmokeTest(failed), /FAIL run status/);
});

test('the load refuses a pending review, publishes an inactive release once decided, and refuses to repeat', async () => {
  const store = createFakeStore(analysisFixture());
  const client = createClient(store);
  const refused = await loadReleaseCandidate({ client, runId: RUN_ID });
  assert.equal(refused.loaded, false);
  assert.equal(refused.published, false);
  assert.equal(refused.assessment.items.pending, 2);
  assert.deepEqual(refused.assessment.blockers, ['2 review items pending a lawyer decision', 'agreement coverage not confirmed']);
  assert.match(renderAssessment(refused.assessment), /not publishable: 2 review items pending/);
  assert.equal(store.state.releases.length, 0);

  await decideEverything(client);
  const ready = await loadReleaseCandidate({ client, runId: RUN_ID, publish: false });
  assert.equal(ready.assessment.blockers.length, 0);
  assert.equal(ready.assessment.can_publish, true);
  assert.equal(ready.published, false, 'publish: false only assesses');
  assert.match(renderAssessment(ready.assessment), /publishable: every item decided/);

  const loaded = await loadReleaseCandidate({ client, runId: RUN_ID, idempotencyKey: 'load-1' });
  assert.equal(loaded.loaded, true, JSON.stringify(loaded.proof));
  assert.deepEqual(loaded.proof, { review_status: 'PUBLISHED', release_created: true, release_inactive: true, head_unchanged: true, published_read_unchanged: true, summary_fact_count: 2 });
  assert.equal(store.state.releases.length, 1);
  assert.equal(store.state.heads.size, 0, 'the pointer did not move');
  assert.equal(loaded.release.release_id, store.state.releases[0].release_id);
  assert.equal(loaded.release.supersedes_release_id, null);
  assert.equal(loaded.visible_after, null);

  const repeated = await loadReleaseCandidate({ client, runId: RUN_ID, idempotencyKey: 'load-2' });
  assert.equal(repeated.published, false);
  assert.match(repeated.assessment.blockers[0], /already PUBLISHED/);
  assert.equal(store.state.releases.length, 1);
});

test('the rollback drill returns the prior view and restores the candidate, and names what blocks it', async () => {
  const store = createFakeStore(analysisFixture());
  const client = createClient(store);
  const nothing = await rollbackDrill({ client, runId: RUN_ID });
  assert.equal(nothing.completed, false);
  assert.deepEqual(nothing.blockers, ['the source has no current release: nothing to roll back', 'review is DRAFT, not PUBLISHED']);

  await decideEverything(client);
  const first = await loadReleaseCandidate({ client, runId: RUN_ID, idempotencyKey: 'load-1' });
  await evaluateAndActivate(client, first.release.release_id, 'sample-1');
  assert.equal(store.state.heads.get(SOURCE_ID), first.release.release_id);
  const firstOnly = await rollbackDrill({ client, runId: RUN_ID });
  assert.equal(firstOnly.completed, false);
  assert.match(firstOnly.blockers[0], /supersedes nothing/);

  let response = await client.reviewCommand(RUN_ID, { expected_version: (await client.getReview(RUN_ID)).review.version, idempotency_key: 'reopen', command: { type: 'REOPEN' } });
  const item = response.review.state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  response = await client.reviewCommand(RUN_ID, { expected_version: response.review.version, idempotency_key: 'edit', command: { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'REJECTED' } });
  response = await client.reviewCommand(RUN_ID, { expected_version: response.review.version, idempotency_key: 'coverage-after-reopen', command: { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true } });
  const second = await loadReleaseCandidate({ client, runId: RUN_ID, idempotencyKey: 'load-2' });
  assert.equal(second.loaded, true, JSON.stringify(second.proof));
  assert.equal(second.release.supersedes_release_id, first.release.release_id);
  assert.equal(second.release.summary_fact_count, 1);
  assert.equal(store.state.heads.get(SOURCE_ID), first.release.release_id, 'still the first release');
  assert.equal(second.visible_after.fact_count, 2, 'the reader still sees the first release');
  await evaluateAndActivate(client, second.release.release_id, 'sample-2');
  assert.equal(store.state.heads.get(SOURCE_ID), second.release.release_id);

  const drill = await rollbackDrill({ client, runId: RUN_ID, idempotencyPrefix: 'drill' });
  assert.equal(drill.completed, true, JSON.stringify(drill.steps));
  assert.deepEqual(drill.steps.map((step) => [step.name, step.active_release_id === first.release.release_id ? 'first' : 'second', step.visible.fact_count]), [['before', 'second', 1], ['rollback', 'first', 2], ['restore', 'second', 1]]);
  assert.deepEqual(drill.steps[1].proof, { pointer_moved_to_prior: true, candidate_still_stored: true, prior_view_visible: true });
  assert.deepEqual(drill.steps[2].proof, { pointer_back_on_candidate: true, candidate_view_visible: true });
  assert.equal(store.state.releases.length, 2);
  assert.deepEqual(store.state.revisions.slice(-2).map((revision) => revision.event_type), ['ROLLBACK_RELEASE', 'ACTIVATE_RELEASE']);
  assert.match(renderDrill(drill), /drill complete: the prior view returned and the candidate is current again/);

  const stay = await rollbackDrill({ client, runId: RUN_ID, restore: false, idempotencyPrefix: 'drill-stay' });
  assert.equal(stay.completed, true);
  assert.equal(stay.restored, false);
  assert.equal(store.state.heads.get(SOURCE_ID), first.release.release_id);
  assert.equal(assessReleaseCandidate(await client.getReview(RUN_ID)).active_release_id, first.release.release_id);
});

test('the HTTP transport sends the bearer token to the product routes and surfaces a refusal', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method, headers: options.headers, body: options.body });
    if (url.endsWith('/api/product/published-facts?family=NO_SHOP')) return { ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), text: async () => JSON.stringify({ agreements: [] }) };
    if (url.endsWith(`/api/product/review/${RUN_ID}`) && options.method === 'POST') return { ok: false, status: 422, headers: new Map(), text: async () => JSON.stringify({ error: 'REVIEW_PENDING_ITEMS' }) };
    if (url.endsWith('/query/provisions')) return { ok: true, status: 200, headers: new Map([['content-type', 'text/html; charset=utf-8']]), text: async () => '<html><body>Query</body></html>' };
    return { ok: true, status: 200, headers: new Map(), text: async () => '{}' };
  };
  const client = createHttpCutoverClient({ baseUrl: 'https://deal-corpus-preview.example/', token: 't'.repeat(40), fetchImpl });
  assert.deepEqual(await client.getPublishedFacts({ family: 'NO_SHOP', subtype: '' }), { agreements: [] });
  assert.equal(calls[0].headers.authorization, `Bearer ${'t'.repeat(40)}`);
  await assert.rejects(() => client.reviewCommand(RUN_ID, { expected_version: 0, idempotency_key: 'k', command: { type: 'PUBLISH' } }), (error) => error instanceof CutoverRequestError && error.status === 422 && error.body.error === 'REVIEW_PENDING_ITEMS');
  assert.equal(calls[1].body, JSON.stringify({ expected_version: 0, idempotency_key: 'k', command: { type: 'PUBLISH' } }));
  assert.deepEqual(await client.getPage('/query/provisions'), { status: 200, content_type: 'text/html; charset=utf-8', length: 31, html: true });
  await client.submitIntake({ url: 'https://www.sec.gov/x', idempotencyKey: 'i', explicitGeneration: 1, maxAttempts: 3 });
  assert.equal(calls[3].url, 'https://deal-corpus-preview.example/api/product/intake');
  assert.throws(() => client.getAnalysis('not-a-run'), /run id/);
  assert.throws(() => createHttpCutoverClient({ baseUrl: 'ftp://x', token: 't' }), /baseUrl/);
});

test('the environment chooses the transport: --base-url needs the internal token, else the service role', () => {
  assert.throws(() => cutoverClientFromEnvironment({ baseUrl: 'https://x.example', env: {} }), /PRODUCT_INTERNAL_TOKEN is not set/);
  assert.equal(cutoverClientFromEnvironment({ baseUrl: 'https://x.example', env: { PRODUCT_INTERNAL_TOKEN: 't'.repeat(40) } }).transport, 'http');
  assert.throws(() => cutoverClientFromEnvironment({ env: {} }), /give --base-url/);
  const created = [];
  const client = cutoverClientFromEnvironment({ env: { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'k', AUTH_USERNAME: 'ben' }, createClient: (url, key) => { created.push([url, key]); return { rpc() {}, from() {} }; } });
  assert.equal(client.transport, 'in-process');
  assert.deepEqual(created, [['https://db.example', 'k']]);
});
