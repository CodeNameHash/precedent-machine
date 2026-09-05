'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const phase2Database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;
const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { CONCHO_URL, conchoSource, createSyntheticConchoModel, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

const ROOT = path.resolve(__dirname, '..');
const phase3Migration = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260905070000_product_phase_3_review.sql'), 'utf8');
const actor = 'phase3-db-lawyer';

test.before(async () => {
  await phase2Database.setupDatabase();
  const client = phase2Database.getDatabaseClient();
  if (process.env.TEST_PGLITE_MODULE) await client.exec(phase3Migration);
  else await client.query(phase3Migration);
});

test.after(phase2Database.teardownDatabase);

function acceptAll(state, analysis, clock) {
  let next = state;
  for (const item of next.items) {
    next = applyReviewCommand(next, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' }, { analysis, legalSchema: schema, clock });
  }
  return applyReviewCommand(next, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema: schema, clock });
}

test('Phase 3 review persistence is isolated, idempotent, versioned and atomically published', async () => {
  const client = phase2Database.getDatabaseClient();
  const facade = phase2Database.databaseFacade();
  const store = new ProductPhase3Store({ client: facade });
  const sourceDocument = await conchoSource();
  const structure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  await store.persistSourceDocument(sourceDocument);
  const identityRun = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'phase3-identity-summary-v1',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE3/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    explicitGeneration: 4,
  });
  await store.attachStructure({ runId: identityRun.run_id, structure, identityReview: { reasons: ['PARTIES_UNCONFIRMED'] } });
  await store.assignRunOwner({ runId: identityRun.run_id, actor });
  const identityRead = await store.getAgreementAnalysis(identityRun.run_id);
  assert.equal(identityRead.stage, 'DOCUMENT_IDENTITY_REVIEW');
  assert.deepEqual(identityRead.source_identity.parties, sourceDocument.parties);
  assert.deepEqual(identityRead.identity_review.reasons, ['PARTIES_UNCONFIRMED']);
  const run = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'phase3-concho-durable-v1',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE3/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    explicitGeneration: 3,
  });
  await store.attachStructure({ runId: run.run_id, structure });
  const analysis = await runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model: createSyntheticConchoModel(), workerId: 'phase3-db-test',
  });
  assert.equal(analysis.status, 'READY');
  await store.assignRunOwner({ runId: run.run_id, actor });
  await assert.rejects(() => store.assertAccess({ runId: run.run_id, actor: 'other-lawyer' }), /ACCESS_DENIED|access denied/i);

  const initialState = initialiseReviewState(analysis);
  const forgedInitialState = structuredClone(initialState);
  forgedInitialState.items[0].item_id = '0'.repeat(64);
  await client.query('SAVEPOINT phase3_forged_item');
  await assert.rejects(() => store.initialiseReview({ runId: run.run_id, state: forgedInitialState, actor }), /invalid review items|DATABASE_ERROR/i);
  await client.query('ROLLBACK TO SAVEPOINT phase3_forged_item');
  await client.query('RELEASE SAVEPOINT phase3_forged_item');
  const storedProposals = (await client.query('SELECT proposal_id, payload FROM public.product_proposals WHERE run_id=$1 ORDER BY proposal_id', [run.run_id])).rows;
  const proposalItems = initialState.items.filter((item) => item.kind === 'PROPOSAL');
  assert.equal(storedProposals.length, proposalItems.length);
  for (const row of storedProposals) {
    assert.deepEqual(proposalItems.find((item) => item.source_id === row.proposal_id)?.original, row.payload);
  }
  let review = await store.initialiseReview({ runId: run.run_id, state: initialState, actor });
  assert.equal(review.version, 0);
  const clock = () => new Date('2026-09-05T12:05:00.000Z');
  let state = acceptAll(review.state, analysis, clock);
  const saveKey = 'phase3-save-accepted';
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 0, state, actor, eventType: 'SAVE', idempotencyKey: saveKey, command: { type: 'SAVE_PROGRESS' } });
  assert.equal(review.version, 1);
  const duplicate = await store.saveReview({ runId: run.run_id, expectedVersion: 0, state, actor, eventType: 'SAVE', idempotencyKey: saveKey, command: { type: 'SAVE_PROGRESS' } });
  assert.equal(duplicate.version, 1);

  await client.query('SAVEPOINT phase3_idempotency_collision');
  await assert.rejects(() => store.saveReview({ runId: run.run_id, expectedVersion: 1, state, actor, eventType: 'SAVE', idempotencyKey: saveKey, command: { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true } }), /IDEMPOTENCY_CONFLICT|idempotency collision/i);
  await client.query('ROLLBACK TO SAVEPOINT phase3_idempotency_collision');
  await client.query('RELEASE SAVEPOINT phase3_idempotency_collision');

  await client.query('SAVEPOINT phase3_stale_save');
  await assert.rejects(() => store.saveReview({ runId: run.run_id, expectedVersion: 0, state, actor, eventType: 'SAVE', idempotencyKey: 'phase3-stale', command: { type: 'SAVE_PROGRESS' } }), /OPTIMISTIC_LOCK_CONFLICT|optimistic lock/i);
  await client.query('ROLLBACK TO SAVEPOINT phase3_stale_save');
  await client.query('RELEASE SAVEPOINT phase3_stale_save');

  review = await store.restoreReview({ runId: run.run_id, expectedVersion: 1, restoreVersion: 0, actor, idempotencyKey: 'phase3-restore-v0' });
  assert.equal(review.version, 2);
  assert.equal(review.state.agreement_coverage.decision, 'PENDING');
  state = acceptAll(review.state, analysis, clock);
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 2, state, actor, eventType: 'SAVE', idempotencyKey: 'phase3-resave', command: { type: 'SAVE_PROGRESS' } });
  state = applyReviewCommand(review.state, { type: 'PUBLISH' }, { analysis, legalSchema: schema, clock });
  const tampered = structuredClone(state);
  tampered.metrics.proposal_count += 1;
  await client.query('SAVEPOINT phase3_tampered_publish');
  await assert.rejects(() => store.saveReview({ runId: run.run_id, expectedVersion: 3, state: tampered, actor, eventType: 'PUBLISH', idempotencyKey: 'phase3-tampered-publish', command: { type: 'PUBLISH' } }), /published review summary mismatch|DATABASE_ERROR/i);
  await client.query('ROLLBACK TO SAVEPOINT phase3_tampered_publish');
  await client.query('RELEASE SAVEPOINT phase3_tampered_publish');
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 3, state, actor, eventType: 'PUBLISH', idempotencyKey: 'phase3-publish-1', command: { type: 'PUBLISH' } });
  assert.equal(review.status, 'PUBLISHED');
  const firstRelease = (await client.query('SELECT * FROM public.product_agreement_releases WHERE run_id=$1', [run.run_id])).rows[0];
  assert.ok(firstRelease.release_id);
  assert.equal((await client.query('SELECT count(*)::integer AS count FROM public.product_agreement_release_heads WHERE source_document_id=$1', [sourceDocument.source_document_id])).rows[0].count, 0);

  const publishedFacts = review.state.summary.families.flatMap((family) => family.facts);
  const evaluationCommand = {
    type: 'EVALUATE_RELEASE', reviewer_identity: actor, lawyer_attestation: true, independent_inventory_attestation: true,
    inventory: [{ inventory_item_id: 'phase3-db-inventory-1', description: 'One independently identified material legal point.', severity: 'MATERIAL' }],
    reconciliation: [{ inventory_item_id: 'phase3-db-inventory-1', disposition: 'PUBLISHED_FACT', review_item_id: publishedFacts[0].review_item_id }],
    citation_assessments: publishedFacts.map((fact) => ({ review_item_id: fact.review_item_id, exact: true, legally_sufficient: true, narrow: true })),
    elapsed_minutes: 45, developer_assisted: false,
  };
  state = applyReviewCommand(review.state, evaluationCommand, { analysis, legalSchema: schema, clock });
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 4, state, actor, eventType: 'EVALUATE_RELEASE', idempotencyKey: 'phase3-release-evaluation', command: evaluationCommand });
  assert.equal(review.state.release_evaluation_input.lawyer_attested_by, actor);
  assert.equal(review.state.release_evaluation.schema_version, 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1');
  state = applyReviewCommand(review.state, { type: 'ACTIVATE_RELEASE', release_id: firstRelease.release_id }, { analysis, legalSchema: schema, clock });
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 5, state, actor, eventType: 'ACTIVATE_RELEASE', idempotencyKey: 'phase3-activate-1', command: { type: 'ACTIVATE_RELEASE', release_id: firstRelease.release_id } });
  assert.equal((await client.query('SELECT release_id FROM public.product_agreement_release_heads WHERE source_document_id=$1', [sourceDocument.source_document_id])).rows[0].release_id, firstRelease.release_id);

  state = applyReviewCommand(review.state, { type: 'REOPEN' }, { analysis, legalSchema: schema, clock });
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 6, state, actor, eventType: 'REOPEN', idempotencyKey: 'phase3-reopen', command: { type: 'REOPEN' } });
  assert.equal(review.state.published_at, null);
  assert.equal(review.state.summary, null);
  assert.equal(review.state.metrics, null);
  assert.equal((await client.query('SELECT count(*)::integer AS count FROM public.product_review_publications WHERE run_id=$1', [run.run_id])).rows[0].count, 1);
  assert.equal((await client.query('SELECT count(*)::integer AS count FROM public.product_agreement_releases WHERE run_id=$1', [run.run_id])).rows[0].count, 1);
  state = applyReviewCommand(review.state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema: schema, clock });
  const firstProposal = state.items.find((item) => item.kind === 'PROPOSAL');
  state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: firstProposal.item_id, decision: 'EDITED', statement: `${firstProposal.original.statement} (reviewed)`, roles: firstProposal.original.roles, value: firstProposal.original.canonical_value }, { analysis, legalSchema: schema, clock });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema: schema, clock });
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 7, state, actor, eventType: 'PUBLISH', idempotencyKey: 'phase3-publish-2', command: { type: 'PUBLISH' } });
  assert.equal(review.status, 'PUBLISHED');
  const releases = (await client.query('SELECT * FROM public.product_agreement_releases WHERE run_id=$1 ORDER BY publication_version', [run.run_id])).rows;
  assert.equal(releases.length, 2);
  assert.equal(releases[1].supersedes_release_id, releases[0].release_id);
  let head = (await client.query('SELECT release_id FROM public.product_agreement_release_heads WHERE source_document_id=$1', [sourceDocument.source_document_id])).rows[0];
  assert.equal(head.release_id, releases[0].release_id);
  const secondFacts = review.state.summary.families.flatMap((family) => family.facts);
  const secondEvaluation = { ...evaluationCommand,
    inventory: [{ inventory_item_id: 'phase3-db-inventory-2', description: 'One independently identified material legal point.', severity: 'MATERIAL' }],
    reconciliation: [{ inventory_item_id: 'phase3-db-inventory-2', disposition: 'PUBLISHED_FACT', review_item_id: secondFacts[0].review_item_id }],
    citation_assessments: secondFacts.map((fact) => ({ review_item_id: fact.review_item_id, exact: true, legally_sufficient: true, narrow: true })),
  };
  state = applyReviewCommand(review.state, secondEvaluation, { analysis, legalSchema: schema, clock });
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 8, state, actor, eventType: 'EVALUATE_RELEASE', idempotencyKey: 'phase3-release-evaluation-2', command: secondEvaluation });
  state = applyReviewCommand(review.state, { type: 'ACTIVATE_RELEASE', release_id: releases[1].release_id }, { analysis, legalSchema: schema, clock });
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 9, state, actor, eventType: 'ACTIVATE_RELEASE', idempotencyKey: 'phase3-activate-2', command: { type: 'ACTIVATE_RELEASE', release_id: releases[1].release_id } });
  head = (await client.query('SELECT release_id FROM public.product_agreement_release_heads WHERE source_document_id=$1', [sourceDocument.source_document_id])).rows[0];
  assert.equal(head.release_id, releases[1].release_id);
  state = applyReviewCommand(review.state, { type: 'ROLLBACK_RELEASE' }, { analysis, legalSchema: schema, clock });
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 10, state, actor, eventType: 'ROLLBACK_RELEASE', idempotencyKey: 'phase3-rollback', command: { type: 'ROLLBACK_RELEASE' } });
  head = (await client.query('SELECT release_id FROM public.product_agreement_release_heads WHERE source_document_id=$1', [sourceDocument.source_document_id])).rows[0];
  assert.equal(head.release_id, releases[0].release_id);
  review = await store.restoreReview({ runId: run.run_id, expectedVersion: 11, restoreVersion: 7, actor, idempotencyKey: 'phase3-restore-after-release' });
  head = (await client.query('SELECT release_id FROM public.product_agreement_release_heads WHERE source_document_id=$1', [sourceDocument.source_document_id])).rows[0];
  assert.equal(head.release_id, releases[0].release_id);

  const retryKey = crypto.randomUUID();
  const retry = await store.retryRun({ runId: run.run_id, actor, idempotencyKey: retryKey });
  const retryAgain = await store.retryRun({ runId: run.run_id, actor, idempotencyKey: retryKey });
  assert.equal(retryAgain.run_id, retry.run_id);

  await client.query('SET LOCAL ROLE service_role');
  const finalReview = (await client.query('SELECT public.product_phase3_get_review($1,$2) AS review', [run.run_id, actor])).rows[0].review;
  assert.equal(finalReview.status, 'DRAFT');
  assert.equal(finalReview.active_release_id, releases[0].release_id);
  assert.equal(finalReview.release_history.filter((release) => release.active).length, 1);
  await client.query('RESET ROLE');
  await client.query('SAVEPOINT phase3_denied_role');
  await client.query('SET LOCAL ROLE anon');
  await assert.rejects(() => client.query('SELECT public.product_phase3_get_review($1,$2)', [run.run_id, actor]), /permission denied/i);
  await client.query('ROLLBACK TO SAVEPOINT phase3_denied_role');
  await client.query('RELEASE SAVEPOINT phase3_denied_role');
  const privileges = (await client.query(`SELECT
    has_table_privilege('service_role', 'public.product_review_sessions', 'INSERT') AS direct_insert,
    has_function_privilege('anon', 'public.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)', 'EXECUTE') AS anon_save,
    has_function_privilege('authenticated', 'product_private.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)', 'EXECUTE') AS authenticated_private_save`)).rows[0];
  assert.equal(privileges.direct_insert, false);
  assert.equal(privileges.anon_save, false);
  assert.equal(privileges.authenticated_private_save, false);
});
