'use strict';

// Phase 6 (plan section 6, "Internal cutover and live use") rehearsed on an
// inactive database: every migration in supabase/migrations applied in
// order, the real Concho source through the synthetic runner, and then the
// cutover scripts' library functions driven through the product's own
// route handlers (lib/product/cutover-client.js in-process transport):
//
//   smoke test (dry run)   intake, run status, provisions read, published read
//   load candidate         PUBLISH -> an immutable release the pointer does
//                          not select; refused while an item is pending
//   evaluate + activate    the pointer selects the release (the page's own
//                          commands, sent to the handler)
//   second candidate       REOPEN, one edit, PUBLISH -> release 2 supersedes
//                          release 1, pointer still on release 1
//   rollback drill         pointer to release 1 and the published read shows
//                          publication 1, then back to release 2
//
// Needs TEST_DATABASE_URL (a disposable Postgres; every statement runs in
// one transaction that is rolled back) or TEST_PGLITE_MODULE.

const assert = require('node:assert/strict');
const test = require('node:test');

const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const { applyReviewCommand, ProductReviewError } = require('../lib/product/review-state');
const { createProductIntakeHandler } = require('../lib/product/intake-handler');
const { createProductAnalysisHandler } = require('../lib/product/analysis-handler');
const { createProductPreviewHandler } = require('../lib/product/preview-handler');
const { createProductReviewHandler } = require('../lib/product/review-handler');
const { createPublishedFactsHandler } = require('../lib/product/published-facts-handler');
const { createInProcessCutoverClient } = require('../lib/product/cutover-client');
const { loadReleaseCandidate, assessReleaseCandidate } = require('../lib/product/release-candidate');
const { rollbackDrill } = require('../lib/product/rollback-drill');
const { runSmokeTest } = require('../lib/product/smoke-test');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { CONCHO_URL, conchoSource, createSyntheticConchoModel, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

// The harness: every migration in order, one rolled-back transaction, the
// Supabase-shaped facade (tests/helpers/product-database.js; finding (141)).
const database = require('./helpers/product-database');
const { databaseFacade } = database;
const actor = 'phase6-db-lawyer';
let client;

test.before(async () => { client = await database.setupDatabase(); });
test.after(database.teardownDatabase);

// Every item decided as a lawyer would decide the synthetic draft: a held
// (not VALID) proposal rejected, a relationship the review state refuses
// to accept rejected, everything else accepted.
function acceptAll(state, analysis, clock) {
  let next = state;
  for (const item of next.items) {
    const held = item.kind === 'PROPOSAL' && item.original.validation_status !== 'VALID';
    try {
      next = applyReviewCommand(next, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: held ? 'REJECTED' : 'ACCEPTED' }, { analysis, legalSchema: schema, clock });
    } catch (error) {
      if (!(error instanceof ProductReviewError)) throw error;
      next = applyReviewCommand(next, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'REJECTED' }, { analysis, legalSchema: schema, clock });
    }
  }
  return applyReviewCommand(next, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema: schema, clock });
}

async function headFor(sourceDocumentId) {
  const result = await client.query('SELECT release_id FROM public.product_agreement_release_heads WHERE source_document_id=$1', [sourceDocumentId]);
  return result.rows[0]?.release_id || null;
}

test('Phase 6 rehearsal: smoke test, inactive candidate load, activation, rollback drill and restore through the route handlers', async () => {
  const facade = databaseFacade();
  const store = new ProductPhase3Store({ client: facade });
  const sourceDocument = await conchoSource();
  const structure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  await store.persistSourceDocument(sourceDocument);
  const run = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'phase6-concho-durable-v1',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE6/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    explicitGeneration: 1,
  });
  await store.attachStructure({ runId: run.run_id, structure });
  const analysis = await runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model: createSyntheticConchoModel(), workerId: 'phase6-db-test',
  });
  assert.equal(analysis.status, 'READY');
  await store.assignRunOwner({ runId: run.run_id, actor });

  // The route handlers as the deployment builds them, the actor fixed as
  // the bearer token would fix it, the clock five minutes after the draft
  // so the review timing is measurable.
  // The clock advances between the two publications so the two releases
  // are told apart by their published_at in the published read.
  let reviewInstant = new Date(Date.parse(analysis.created_at || new Date().toISOString()) + (5 * 60_000));
  const clock = () => reviewInstant;
  const getClient = () => facade;
  const actorResolver = async () => actor;
  const storeFactory = () => new ProductPhase3Store({ client: facade });
  const cutover = createInProcessCutoverClient({ handlers: {
    intake: createProductIntakeHandler({
      getClient, storeFactory, actorResolver,
      intakeFactory: () => ({ intake: async () => sourceDocument }),
      modelConfigResolver: () => ({ provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' }),
    }),
    analysis: createProductAnalysisHandler({ getClient, storeFactory, actorResolver }),
    preview: createProductPreviewHandler({ getClient, storeFactory, actorResolver }),
    review: createProductReviewHandler({ getClient, storeFactory, actorResolver, clock }),
    publishedFacts: createPublishedFactsHandler({ getClient, storeFactory, actorResolver }),
  } });

  // Smoke test, dry run: the intake creates the next generation as a QUEUED
  // run (a different submission fingerprint), nothing wakes a worker, and
  // the three reads answer for it and for the analysed run.
  const smoke = await runSmokeTest({ client: cutover, secUrl: CONCHO_URL, generation: 2, pages: true });
  assert.equal(smoke.ok, true, JSON.stringify(smoke.steps));
  const intakeStep = smoke.steps.find((step) => step.name.startsWith('intake'));
  assert.equal(intakeStep.generation, 2);
  assert.equal(intakeStep.run_status, 'QUEUED');
  assert.notEqual(intakeStep.run_id, run.run_id);
  const queued = await store.getRun(intakeStep.run_id);
  assert.equal(queued.status, 'QUEUED');
  assert.equal((await client.query('SELECT count(*)::integer AS count FROM public.product_model_calls WHERE run_id=$1', [intakeStep.run_id])).rows[0].count, 0);
  assert.equal(smoke.steps.find((step) => step.name === 'run status').kind, 'runStatus');
  assert.equal(smoke.steps.find((step) => step.name === 'published read').this_source, null);
  const analysedSmoke = await runSmokeTest({ client: cutover, runId: run.run_id, pages: false });
  assert.equal(analysedSmoke.ok, true, JSON.stringify(analysedSmoke.steps));
  assert.equal(analysedSmoke.steps.find((step) => step.name === 'run status').kind, 'draftAnalysis');
  assert.equal(analysedSmoke.steps.find((step) => step.name === 'run status').run_status, 'READY');

  // Load refused while items are pending: the read initialises the review
  // session (as opening the page would) and reports the pending count.
  const refused = await loadReleaseCandidate({ client: cutover, runId: run.run_id, publish: true });
  assert.equal(refused.loaded, false);
  assert.equal(refused.published, false);
  assert.equal(refused.assessment.review.version, 0);
  assert.ok(refused.assessment.items.pending > 0);
  assert.match(refused.assessment.blockers.join('; '), /pending a lawyer decision/);
  assert.equal((await client.query('SELECT count(*)::integer AS count FROM public.product_agreement_releases WHERE run_id=$1', [run.run_id])).rows[0].count, 0);

  // The lawyer's decisions are not the script's: accept every item through
  // the review state and save, as the review page does.
  let review = await store.getReview({ runId: run.run_id, actor });
  const accepted = acceptAll(review.state, analysis, clock);
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 0, state: accepted, actor, eventType: 'SAVE', idempotencyKey: 'phase6-accept-all', command: { type: 'SAVE_PROGRESS' } });
  assert.equal(review.version, 1);

  // Load: a release the pointer does not select.
  const loaded = await loadReleaseCandidate({ client: cutover, runId: run.run_id, publish: true, idempotencyKey: 'phase6-load-1' });
  assert.equal(loaded.published, true);
  assert.deepEqual(loaded.proof, { ...loaded.proof, review_status: 'PUBLISHED', release_created: true, release_inactive: true, head_unchanged: true, published_read_unchanged: true });
  assert.equal(loaded.loaded, true);
  assert.equal(loaded.release.supersedes_release_id, null);
  assert.equal(await headFor(sourceDocument.source_document_id), null);
  assert.equal(loaded.visible_after, null);
  const releaseOne = loaded.release.release_id;
  assert.equal((await client.query('SELECT release_id FROM public.product_agreement_releases WHERE run_id=$1', [run.run_id])).rows[0].release_id, releaseOne);
  // A second load of a published review is refused, not repeated.
  const again = await loadReleaseCandidate({ client: cutover, runId: run.run_id, publish: true, idempotencyKey: 'phase6-load-1-again' });
  assert.equal(again.published, false);
  assert.match(again.assessment.blockers.join('; '), /already PUBLISHED/);

  // The drill has nothing to return to yet.
  const noPrior = await rollbackDrill({ client: cutover, runId: run.run_id });
  assert.equal(noPrior.completed, false);
  assert.match(noPrior.blockers.join('; '), /no current release/);

  // Evaluate and activate: the page's own commands through the handler
  // (the lawyer's attestation is a command input, never the script's).
  const workspace = await cutover.getReview(run.run_id);
  const publishedFacts = workspace.review.state.summary.families.flatMap((family) => family.facts);
  // The synthetic draft leaves some coverage UNRESOLVED; the lawyer's
  // resolution of each (a reviewed omission) is a command input.
  const unresolvedCoverage = new Set((analysis.coverage_assertions || []).filter((item) => item.state === 'UNRESOLVED').map((item) => item.coverage_assertion_id));
  const findingResolutions = workspace.review.state.items
    .filter((item) => item.kind === 'COVERAGE' && item.decision === 'ACCEPTED' && unresolvedCoverage.has(item.source_id))
    .map((item) => ({ finding_item_id: item.item_id, disposition: 'REVIEWED_OMISSION', omission_reason: 'Reviewed against the source: nothing further to extract.', reviewed_by_role: 'LAWYER' }));
  const evaluation = (sampleId) => ({
    type: 'EVALUATE_RELEASE', lawyer_attestation: true, reference_samples_attestation: true,
    reference_samples: [{ reference_sample_id: sampleId, source_document_id: sourceDocument.source_document_id, source_url: sourceDocument.retrieval_url, source_section: 'Section 5.2', description: 'One reviewed reference legal point.', severity: 'MATERIAL', assessment: 'FOUND', comparison: 'The source and product output state the same legal point.' }],
    citation_assessments: publishedFacts.map((fact) => ({ review_item_id: fact.review_item_id, exact: true, legally_sufficient: true, narrow: true })),
    finding_resolutions: findingResolutions,
    elapsed_minutes: 120, developer_assisted: false,
  });
  let response = await cutover.reviewCommand(run.run_id, { expected_version: workspace.review.version, idempotency_key: 'phase6-evaluate-1', command: evaluation('phase6-sample-1') });
  assert.equal(response.review.state.release_evaluation.passed, true, JSON.stringify({ bars: response.review.state.release_evaluation.bars, diagnostics: response.review.state.release_evaluation.diagnostics, resolutions: findingResolutions.length }));
  response = await cutover.reviewCommand(run.run_id, { expected_version: response.review.version, idempotency_key: 'phase6-activate-1', command: { type: 'ACTIVATE_RELEASE', release_id: releaseOne } });
  assert.equal(response.review.active_release_id, releaseOne);
  assert.equal(await headFor(sourceDocument.source_document_id), releaseOne);
  const visibleOne = (await cutover.getPublishedFacts()).agreements.find((entry) => entry.source_document_id === sourceDocument.source_document_id);
  assert.equal(visibleOne.run_id, run.run_id);
  assert.equal(assessReleaseCandidate(await cutover.getReview(run.run_id)).releases[0].active, true);

  // Still nothing to return to: release 1 supersedes nothing.
  const firstOnly = await rollbackDrill({ client: cutover, runId: run.run_id });
  assert.equal(firstOnly.completed, false);
  assert.match(firstOnly.blockers.join('; '), /supersedes nothing/);

  // A second candidate: reopen, one edit, publish through the load.
  reviewInstant = new Date(reviewInstant.getTime() + (10 * 60_000));
  response = await cutover.reviewCommand(run.run_id, { expected_version: response.review.version, idempotency_key: 'phase6-reopen', command: { type: 'REOPEN' } });
  assert.equal(response.review.state.status, 'DRAFT');
  const firstProposal = response.review.state.items.find((item) => item.kind === 'PROPOSAL' && item.original.validation_status === 'VALID' && item.decision === 'ACCEPTED');
  response = await cutover.reviewCommand(run.run_id, { expected_version: response.review.version, idempotency_key: 'phase6-edit', command: {
    type: 'DECIDE_ITEM', item_id: firstProposal.item_id, decision: 'EDITED', statement: `${firstProposal.original.statement} (reviewed)`, roles: firstProposal.original.roles, value: firstProposal.original.canonical_value,
  } });
  response = await cutover.reviewCommand(run.run_id, { expected_version: response.review.version, idempotency_key: 'phase6-coverage-2', command: { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true } });
  const second = await loadReleaseCandidate({ client: cutover, runId: run.run_id, publish: true, idempotencyKey: 'phase6-load-2' });
  assert.equal(second.loaded, true, JSON.stringify(second.proof));
  assert.equal(second.release.supersedes_release_id, releaseOne);
  assert.equal(second.proof.head_unchanged, true);
  assert.equal(await headFor(sourceDocument.source_document_id), releaseOne);
  const releaseTwo = second.release.release_id;
  const secondWorkspace = await cutover.getReview(run.run_id);
  const secondFacts = secondWorkspace.review.state.summary.families.flatMap((family) => family.facts);
  response = await cutover.reviewCommand(run.run_id, { expected_version: secondWorkspace.review.version, idempotency_key: 'phase6-evaluate-2', command: {
    ...evaluation('phase6-sample-2'), citation_assessments: secondFacts.map((fact) => ({ review_item_id: fact.review_item_id, exact: true, legally_sufficient: true, narrow: true })),
  } });
  assert.equal(response.review.state.release_evaluation.passed, true);
  response = await cutover.reviewCommand(run.run_id, { expected_version: response.review.version, idempotency_key: 'phase6-activate-2', command: { type: 'ACTIVATE_RELEASE', release_id: releaseTwo } });
  assert.equal(await headFor(sourceDocument.source_document_id), releaseTwo);

  // The drill: back to release 1, the published read shows publication 1,
  // then release 2 is current again. Every release stays stored.
  const drill = await rollbackDrill({ client: cutover, runId: run.run_id, idempotencyPrefix: 'phase6-drill' });
  assert.equal(drill.blockers.length, 0);
  assert.equal(drill.completed, true, JSON.stringify(drill.steps));
  assert.equal(drill.steps[0].active_release_id, releaseTwo);
  assert.equal(drill.steps[1].active_release_id, releaseOne);
  assert.equal(new Date(drill.steps[1].visible.released_at).getTime(), new Date(loaded.release.published_at).getTime());
  assert.equal(drill.steps[2].active_release_id, releaseTwo);
  assert.equal(await headFor(sourceDocument.source_document_id), releaseTwo);
  assert.equal((await client.query('SELECT count(*)::integer AS count FROM public.product_agreement_releases WHERE run_id=$1', [run.run_id])).rows[0].count, 2);
  const revisions = (await client.query('SELECT event_type FROM public.product_review_revisions WHERE run_id=$1 ORDER BY version', [run.run_id])).rows.map((row) => row.event_type);
  assert.deepEqual(revisions.slice(-2), ['ROLLBACK_RELEASE', 'ACTIVATE_RELEASE']);

  // Rollback without restore leaves the prior release current.
  const stayed = await rollbackDrill({ client: cutover, runId: run.run_id, restore: false, idempotencyPrefix: 'phase6-drill-stay' });
  assert.equal(stayed.completed, true, JSON.stringify(stayed.steps));
  assert.equal(await headFor(sourceDocument.source_document_id), releaseOne);
});
