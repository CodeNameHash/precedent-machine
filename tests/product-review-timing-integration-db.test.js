'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const phase2Database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;

const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');

const ROOT = path.resolve(__dirname, '..');
const migrations = [
  'supabase/migrations/20260905070000_product_phase_3_review.sql',
  'supabase/migrations/20260905203000_product_finalization_retry.sql',
  'supabase/migrations/20260905205000_product_release_timing_guard.sql',
  'supabase/migrations/20260905212000_product_review_citation_repair.sql',
  'supabase/migrations/20260905213000_product_monotonic_failed_section_status.sql',
  'supabase/migrations/20260905214000_product_cumulative_review_timing.sql',
  'supabase/migrations/20260905215000_product_finding_resolution_validation.sql',
  'supabase/migrations/20260905220000_product_review_proposition_group_repair.sql',
].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));

const actor = 'review-timing-integration-lawyer';
const legalSchema = { schema_version: 'TEST_LEGAL_SCHEMA/V1', families: [] };

function fixedClock(instant) {
  return () => new Date(instant);
}

async function executeMigration(client, migration) {
  if (process.env.TEST_PGLITE_MODULE) await client.exec(migration);
  else await client.query(migration);
}

test.before(async () => {
  await phase2Database.setupDatabase();
  const client = phase2Database.getDatabaseClient();
  for (const migration of migrations) await executeMigration(client, migration);
});

test.after(phase2Database.teardownDatabase);

test('real review validator preserves cumulative timing across publish, reopen, restore and republish', async () => {
  const client = phase2Database.getDatabaseClient();
  const store = new ProductPhase3Store({ client: phase2Database.databaseFacade() });
  const runId = crypto.randomUUID();
  const sourceDocumentId = `timing-source-${runId}`;
  const draftAnalysisId = `timing-draft-${runId}`;
  const issueId = `timing-issue-${runId}`;
  const databaseNow = new Date((await client.query('SELECT statement_timestamp() AS now')).rows[0].now);
  const initialAt = new Date(databaseNow.getTime() - 100 * 60_000).toISOString();
  const firstPublishedAt = new Date(databaseNow.getTime() - 70 * 60_000).toISOString();
  const reopenedAt = new Date(databaseNow.getTime() - 5 * 60_000).toISOString();
  const republishedAt = databaseNow.toISOString();

  await client.query(`INSERT INTO public.product_source_documents
    (source_document_id,retrieval_url,raw_sha256,payload,payload_sha256)
    VALUES ($1,$2,$3,$4::jsonb,$5)`, [
    sourceDocumentId,
    `https://example.test/${sourceDocumentId}`,
    'a'.repeat(64),
    JSON.stringify({ source_document_id: sourceDocumentId }),
    'b'.repeat(64),
  ]);
  await client.query(`INSERT INTO public.product_analysis_runs
    (run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,schema_version,
      prompt_bundle_version,model_config,explicit_generation,source_generation,max_attempts,status,stage,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,0,1,1,'READY','READY',
      statement_timestamp() - interval '50 minutes',statement_timestamp())`, [
    runId,
    sourceDocumentId,
    `https://example.test/${sourceDocumentId}`,
    `timing-run-${runId}`,
    `timing-fingerprint-${runId}`,
    legalSchema.schema_version,
    'PRODUCT_PHASE3/V1',
    JSON.stringify({ provider: 'integration-test', model: 'none' }),
  ]);
  await client.query(`INSERT INTO public.product_draft_analyses
    (run_id,draft_analysis_id,legal_schema_version,payload_sha256,created_at)
    VALUES ($1,$2,$3,$4,statement_timestamp())`, [
    runId, draftAnalysisId, legalSchema.schema_version, 'c'.repeat(64),
  ]);
  await client.query(`INSERT INTO public.product_issues
    (run_id,issue_id,kind,state,payload) VALUES ($1,$2,'VALIDATION','OPEN','{}'::jsonb)`, [runId, issueId]);

  const analysis = {
    kind: 'draftAnalysis',
    draft_analysis_id: draftAnalysisId,
    analysis_run_id: runId,
    proposals: [],
    fact_links: [],
    issues: [{
      issue_id: issueId,
      kind: 'VALIDATION',
      state: 'OPEN',
      family_key: null,
      structure_node_id: null,
      source_closure_id: null,
      source_span_ids: [],
    }],
    coverage_assertions: [],
    sections: [],
    spans: [],
    source_closures: [],
  };

  await store.assignRunOwner({ runId, actor });
  let state = initialiseReviewState(analysis, { clock: fixedClock(initialAt) });
  let review = await store.initialiseReview({ runId, state, actor });
  state = applyReviewCommand(review.state, {
    type: 'DECIDE_ITEM', item_id: review.state.items[0].item_id, decision: 'ACCEPTED',
  }, { analysis, legalSchema, clock: fixedClock(firstPublishedAt) });
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, {
    analysis, legalSchema, clock: fixedClock(firstPublishedAt),
  });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis, legalSchema, clock: fixedClock(firstPublishedAt),
  });
  review = await store.saveReview({
    runId, expectedVersion: 0, state, actor, eventType: 'PUBLISH',
    idempotencyKey: `timing-first-publish-${runId}`, command: { type: 'PUBLISH' },
  });
  assert.equal(review.state.metrics.review_time_seconds, 30 * 60);

  state = applyReviewCommand(review.state, { type: 'REOPEN' }, {
    analysis, legalSchema, clock: fixedClock(reopenedAt),
  });
  review = await store.saveReview({
    runId, expectedVersion: 1, state, actor, eventType: 'REOPEN',
    idempotencyKey: `timing-reopen-${runId}`, command: { type: 'REOPEN' },
  });
  const liveAnchor = review.state.review_timing.active_draft_started_at;

  review = await store.restoreReview({
    runId, expectedVersion: 2, restoreVersion: 0, actor,
    idempotencyKey: `timing-restore-${runId}`,
  });
  assert.equal(review.state.review_timing.accumulated_draft_seconds, 30 * 60);
  assert.equal(Date.parse(review.state.review_timing.active_draft_started_at), Date.parse(liveAnchor));
  assert.equal(review.state.started_at, initialAt);

  state = applyReviewCommand(review.state, {
    type: 'DECIDE_ITEM', item_id: review.state.items[0].item_id, decision: 'ACCEPTED',
  }, { analysis, legalSchema, clock: fixedClock(republishedAt) });
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, {
    analysis, legalSchema, clock: fixedClock(republishedAt),
  });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis, legalSchema, clock: fixedClock(republishedAt),
  });
  review = await store.saveReview({
    runId, expectedVersion: 3, state, actor, eventType: 'PUBLISH',
    idempotencyKey: `timing-second-publish-${runId}`, command: { type: 'PUBLISH' },
  });
  assert.equal(review.state.metrics.review_time_seconds, 35 * 60);

  const timing = await store.getReleaseTiming({ runId });
  const evaluationCommand = {
    type: 'EVALUATE_RELEASE',
    reviewer_identity: actor,
    lawyer_attestation: true,
    independent_inventory_attestation: true,
    inventory: [],
    reconciliation: [],
    citation_assessments: [],
    elapsed_minutes: 1,
    developer_assisted: false,
  };
  state = applyReviewCommand(review.state, evaluationCommand, {
    analysis, legalSchema, clock: fixedClock(republishedAt), timing,
  });
  review = await store.saveReview({
    runId, expectedVersion: 4, state, actor, eventType: 'EVALUATE_RELEASE',
    idempotencyKey: `timing-evaluate-${runId}`, command: evaluationCommand,
  });
  assert.equal(review.state.release_evaluation.diagnostics.measured_review_time_seconds, 35 * 60);
  assert.equal(review.state.release_evaluation.diagnostics.effective_elapsed_minutes, 85);

  const read = await store.getReview({ runId, actor });
  assert.equal(read.publications.length, 2);
  const publications = [...read.publications].sort((left, right) => left.publication_version - right.publication_version);
  assert.equal(publications[0].metrics.review_time_seconds, 30 * 60);
  assert.equal(publications[1].metrics.review_time_seconds, 35 * 60);
  assert.equal(read.revisions.find((revision) => revision.event_type === 'EVALUATE_RELEASE')
    .release_evaluation_diagnostics.effective_elapsed_minutes, 85);

  const privileges = (await client.query(`SELECT
    has_function_privilege('anon', 'public.product_phase3_restore_review(uuid,integer,integer,text,text,text)', 'EXECUTE') AS anon_restore,
    has_function_privilege('authenticated', 'public.product_phase3_restore_review(uuid,integer,integer,text,text,text)', 'EXECUTE') AS authenticated_restore,
    has_function_privilege('service_role', 'public.product_phase3_restore_review(uuid,integer,integer,text,text,text)', 'EXECUTE') AS service_restore,
    has_function_privilege('anon', 'public.product_phase3_get_review(uuid,text)', 'EXECUTE') AS anon_read,
    has_function_privilege('authenticated', 'public.product_phase3_get_review(uuid,text)', 'EXECUTE') AS authenticated_read,
    has_function_privilege('service_role', 'public.product_phase3_get_review(uuid,text)', 'EXECUTE') AS service_read`)).rows[0];
  assert.deepEqual(privileges, {
    anon_restore: false,
    authenticated_restore: false,
    service_restore: true,
    anon_read: false,
    authenticated_read: false,
    service_read: true,
  });
});
