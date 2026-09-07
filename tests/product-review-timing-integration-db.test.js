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
  'supabase/migrations/20260905221000_product_analysis_running_progress.sql',
  'supabase/migrations/20260905222000_product_relationship_review.sql',
  'supabase/migrations/20260905223000_product_span_closure_lookup.sql',
  'supabase/migrations/20260905224000_product_cross_section_relationship_staging.sql',
  'supabase/migrations/20260905225000_product_legal_schema_v1_1_relationship_types.sql',
  'supabase/migrations/20260905227000_product_legal_schema_revision_persistence.sql',
  'supabase/migrations/20260905230000_product_notice_update_relationship_types.sql',
  'supabase/migrations/20260905231000_product_termination_effect_relationship_types.sql',
  'supabase/migrations/20260905232000_product_review_validation_identity_lookup.sql',
  'supabase/migrations/20260906234757_product_release_timing_measurement.sql',
  'supabase/migrations/20260907005021_product_article_intro_coverage.sql',
].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
const referenceSamplesV3Migration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260907082337_product_release_reference_samples_v3.sql',
), 'utf8');
let preV3SaveReviewDefinition;

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
  preV3SaveReviewDefinition = (await client.query(`SELECT pg_get_functiondef(to_regprocedure(
    'product_private.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)'
  )) AS definition`)).rows[0].definition;
  await executeMigration(client, referenceSamplesV3Migration);
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
      statement_timestamp() - interval '100 minutes',statement_timestamp())`, [
    runId,
    sourceDocumentId,
    `https://example.test/${sourceDocumentId}`,
    `timing-run-${runId}`,
    `timing-fingerprint-${runId}`,
    legalSchema.schema_version,
    'PRODUCT_PHASE3/V1',
    JSON.stringify({ provider: 'integration-test', model: 'none' }),
  ]);
  const structureId = `timing-structure-${runId}`;
  const sectionId = `timing-section-${runId}`;
  const modelCallId = `timing-model-${runId}`;
  const closureId = `timing-closure-${runId}`;
  const routingId = `timing-routing-${runId}`;
  await client.query(`INSERT INTO public.product_agreement_structures
    (structure_id,source_document_id,payload,payload_sha256) VALUES ($1,$2,$3::jsonb,$4)`, [
    structureId, sourceDocumentId,
    JSON.stringify({ schema_version: 'AGREEMENT_STRUCTURE/V1', nodes: [{ node_id: sectionId, kind: 'SECTION', reference: 'I-INTRO' }] }),
    'd'.repeat(64),
  ]);
  await client.query('INSERT INTO public.product_run_structures(run_id,structure_id) VALUES ($1,$2)', [runId, structureId]);
  await client.query(`INSERT INTO public.product_model_calls
    (run_id,model_call_id,structure_node_id,call_kind,prompt_version,provider_id,model_id,request,response,
      input_tokens,output_tokens,cost_microusd,duration_ms)
    VALUES ($1,$2,$3,'ROUTING','TEST/V1','test','none','{}'::jsonb,'{}'::jsonb,0,0,0,0)`, [runId, modelCallId, sectionId]);
  await client.query(`INSERT INTO public.product_source_closures
    (run_id,source_closure_id,structure_node_id,section_reference,payload)
    VALUES ($1,$2,$3,'I-INTRO','{}'::jsonb)`, [runId, closureId, sectionId]);
  await client.query(`INSERT INTO public.product_section_routings
    (run_id,section_routing_id,structure_node_id,model_call_id,authored_order,disposition,families,payload)
    VALUES ($1,$2,$3,$4,0,'FAMILY_ASSIGNED','[]'::jsonb,'{}'::jsonb)`, [runId, routingId, sectionId, modelCallId]);
  await client.query(`INSERT INTO public.product_section_results
    (run_id,structure_node_id,section_result_id,section_routing_id,source_closure_id,payload_sha256)
    VALUES ($1,$2,$3,$4,$5,$6)`, [runId, sectionId, `timing-result-${runId}`, routingId, closureId, 'e'.repeat(64)]);
  await client.query(`INSERT INTO public.product_coverage_assertions
    (run_id,coverage_assertion_id,subject_kind,subject_id,structure_node_id,model_call_id,state,payload)
    VALUES ($1,$2,'SECTION',$3,$3,$4,'FOUND',$5::jsonb)`, [
    runId, `timing-coverage-${runId}`, sectionId, modelCallId,
    JSON.stringify({ subject_kind: 'SECTION', subject_id: sectionId, structure_node_id: sectionId, state: 'FOUND' }),
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
  const referenceSources = (await client.query(
    'SELECT public.product_phase3_list_reference_sources($1) AS sources', [actor],
  )).rows[0].sources;
  assert.deepEqual(referenceSources.map((source) => ({
    source_document_id: source.source_document_id, retrieval_url: source.retrieval_url,
  })), [{ source_document_id: sourceDocumentId, retrieval_url: `https://example.test/${sourceDocumentId}` }]);
  assert.deepEqual((await client.query(
    'SELECT public.product_phase3_list_reference_sources($1) AS sources', ['other-lawyer'],
  )).rows[0].sources, []);
  const evaluationCommand = {
    type: 'EVALUATE_RELEASE',
    reviewer_identity: actor,
    lawyer_attestation: true,
    reference_samples_attestation: true,
    reference_samples: [{
      reference_sample_id: 'timing-sample-1', source_document_id: sourceDocumentId,
      source_url: `https://example.test/${sourceDocumentId}`, source_section: 'Section 5.2',
      description: 'The source contains a no-shop exception.', severity: 'MATERIAL', assessment: 'FOUND',
      comparison: 'The source and product output state the same legal point.',
    }],
    citation_assessments: [],
    elapsed_minutes: 1,
    developer_assisted: false,
  };
  state = applyReviewCommand(review.state, evaluationCommand, {
    analysis, legalSchema, clock: fixedClock(republishedAt), timing, referenceSources,
  });
  review = await store.saveReview({
    runId, expectedVersion: 4, state, actor, eventType: 'EVALUATE_RELEASE',
    idempotencyKey: `timing-evaluate-${runId}`, command: evaluationCommand,
  });
  assert.equal(review.state.release_evaluation.diagnostics.measured_review_time_seconds, 35 * 60);
  assert.equal(review.state.release_evaluation.diagnostics.effective_elapsed_minutes, 135);
  assert.equal(review.state.release_evaluation.bars.timing_measured_without_developer, true);
  assert.equal(review.state.release_evaluation.schema_version, 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V3');

  const read = await store.getReview({ runId, actor });
  assert.equal(read.publications.length, 2);
  const publications = [...read.publications].sort((left, right) => left.publication_version - right.publication_version);
  assert.equal(publications[0].metrics.review_time_seconds, 30 * 60);
  assert.equal(publications[1].metrics.review_time_seconds, 35 * 60);
  assert.equal(read.revisions.find((revision) => revision.event_type === 'EVALUATE_RELEASE')
    .release_evaluation_diagnostics.effective_elapsed_minutes, 135);

  const forgedTiming = structuredClone(review.state);
  forgedTiming.release_evaluation.diagnostics.processing_minutes += 1;
  await client.query('SAVEPOINT forged_timing_measurement');
  await assert.rejects(() => store.saveReview({
    runId, expectedVersion: 5, state: forgedTiming, actor, eventType: 'EVALUATE_RELEASE',
    idempotencyKey: `timing-forged-${runId}`, command: evaluationCommand,
  }), /release timing mismatch|DATABASE_ERROR/i);
  await client.query('ROLLBACK TO SAVEPOINT forged_timing_measurement');
  await client.query('RELEASE SAVEPOINT forged_timing_measurement');

  const invalidReferenceStates = [];
  for (const missingValue of [undefined, null]) {
    for (const field of ['reference_sample_id', 'source_document_id', 'source_url', 'source_section', 'description', 'severity', 'assessment', 'reviewed_by_role', 'comparison']) {
      const invalid = structuredClone(review.state);
      if (missingValue === undefined) delete invalid.release_evaluation_input.reference_samples[0][field];
      else invalid.release_evaluation_input.reference_samples[0][field] = null;
      invalidReferenceStates.push([`${missingValue === undefined ? 'missing' : 'null'}_${field}`, invalid]);
    }
    const invalidAttestation = structuredClone(review.state);
    if (missingValue === undefined) delete invalidAttestation.release_evaluation_input.reference_samples_attested;
    else invalidAttestation.release_evaluation_input.reference_samples_attested = null;
    invalidReferenceStates.push([`${missingValue === undefined ? 'missing' : 'null'}_attestation`, invalidAttestation]);
  }
  const missingReference = structuredClone(review.state);
  delete missingReference.release_evaluation_input.reference_samples;
  invalidReferenceStates.push(['missing_reference_array', missingReference]);
  const credentialedUrl = structuredClone(review.state);
  credentialedUrl.release_evaluation_input.reference_samples[0].source_url = 'https://user:secret@example.test/olaplex';
  invalidReferenceStates.push(['credentialed_url', credentialedUrl]);
  const missingComparison = structuredClone(review.state);
  delete missingComparison.release_evaluation_input.reference_samples[0].comparison;
  invalidReferenceStates.push(['missing_comparison', missingComparison]);
  const inaccessibleSource = structuredClone(review.state);
  inaccessibleSource.release_evaluation_input.reference_samples[0].source_document_id = 'unowned-source';
  invalidReferenceStates.push(['inaccessible_source', inaccessibleSource]);
  const falseCandidateRecall = structuredClone(review.state);
  falseCandidateRecall.release_evaluation.diagnostics.severity_weighted_recall = 1;
  invalidReferenceStates.push(['false_candidate_recall', falseCandidateRecall]);
  for (const field of ['reference_sample_success_rate', 'reference_sample_count', 'reference_sample_missed_count', 'reference_sample_incorrect_count', 'reference_sample_unresolved_count']) {
    const forgedDiagnostic = structuredClone(review.state);
    forgedDiagnostic.release_evaluation.diagnostics[field] += 1;
    invalidReferenceStates.push([`forged_${field}`, forgedDiagnostic]);
  }
  const unresolvedPassed = structuredClone(review.state);
  unresolvedPassed.release_evaluation_input.reference_samples[0].assessment = 'UNRESOLVED';
  unresolvedPassed.release_evaluation_input.reference_samples[0].reviewed_limitation = 'The source comparison remains unresolved.';
  delete unresolvedPassed.release_evaluation_input.reference_samples[0].comparison;
  invalidReferenceStates.push(['unresolved_passed', unresolvedPassed]);
  for (const [label, invalidState] of invalidReferenceStates) {
    await client.query(`SAVEPOINT ${label}`);
    await assert.rejects(() => store.saveReview({
      runId, expectedVersion: 5, state: invalidState, actor, eventType: 'EVALUATE_RELEASE',
      idempotencyKey: `timing-${label}-${runId}`, command: evaluationCommand,
    }), /release reference sample|DATABASE_ERROR/i);
    await client.query(`ROLLBACK TO SAVEPOINT ${label}`);
    await client.query(`RELEASE SAVEPOINT ${label}`);
  }

  const historicalV2 = structuredClone(review.state);
  historicalV2.release_evaluation.schema_version = 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V2';
  delete historicalV2.release_evaluation.bars.reference_samples_reviewed;
  historicalV2.release_evaluation.bars.inventory_reconciled = true;
  delete historicalV2.release_evaluation.diagnostics.reference_sample_success_rate;
  delete historicalV2.release_evaluation.diagnostics.reference_sample_count;
  delete historicalV2.release_evaluation.diagnostics.reference_sample_missed_count;
  delete historicalV2.release_evaluation.diagnostics.reference_sample_incorrect_count;
  delete historicalV2.release_evaluation.diagnostics.reference_sample_unresolved_count;
  historicalV2.release_evaluation.diagnostics.severity_weighted_recall = 1;
  historicalV2.release_evaluation.diagnostics.severity_weighted_precision = 1;
  historicalV2.release_evaluation_input.inventory = [{ inventory_item_id: 'historical', description: 'Historical point', severity: 'MATERIAL' }];
  historicalV2.release_evaluation_input.reconciliation = [{ inventory_item_id: 'historical', disposition: 'REVIEWED_OMISSION', omission_reason: 'Historical assessment', reviewed_by_role: 'LAWYER' }];
  historicalV2.release_evaluation_input.independent_inventory_attested = true;
  delete historicalV2.release_evaluation_input.reference_samples;
  delete historicalV2.release_evaluation_input.reference_samples_attested;
  await client.query('SAVEPOINT historical_v2');
  await assert.doesNotReject(() => store.saveReview({
    runId, expectedVersion: 5, state: historicalV2, actor, eventType: 'EVALUATE_RELEASE',
    idempotencyKey: `timing-historical-v2-${runId}`, command: evaluationCommand,
  }));
  await client.query('ROLLBACK TO SAVEPOINT historical_v2');
  await client.query('RELEASE SAVEPOINT historical_v2');

  for (const [label, schemaVersion] of [['missing', undefined], ['unknown', 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V999']]) {
    const invalidVersion = structuredClone(review.state);
    if (schemaVersion === undefined) delete invalidVersion.release_evaluation.schema_version;
    else invalidVersion.release_evaluation.schema_version = schemaVersion;
    await client.query(`SAVEPOINT ${label}_timing_version`);
    await assert.rejects(() => store.saveReview({
      runId, expectedVersion: 5, state: invalidVersion, actor, eventType: 'EVALUATE_RELEASE',
      idempotencyKey: `timing-${label}-version-${runId}`, command: evaluationCommand,
    }), /release timing is incomplete|DATABASE_ERROR/i);
    await client.query(`ROLLBACK TO SAVEPOINT ${label}_timing_version`);
    await client.query(`RELEASE SAVEPOINT ${label}_timing_version`);
  }

  const assistedCommand = { ...evaluationCommand, developer_assisted: true };
  state = applyReviewCommand(review.state, assistedCommand, {
    analysis, legalSchema, clock: fixedClock(republishedAt), timing, referenceSources,
  });
  assert.equal(state.release_evaluation.bars.timing_measured_without_developer, false);
  review = await store.saveReview({
    runId, expectedVersion: 5, state, actor, eventType: 'EVALUATE_RELEASE',
    idempotencyKey: `timing-assisted-${runId}`, command: assistedCommand,
  });

  await client.query(preV3SaveReviewDefinition);
  await client.query('DROP FUNCTION public.product_phase3_list_reference_sources(text)');
  await client.query('DROP FUNCTION product_private.product_phase3_list_reference_sources(text)');
  await client.query('SAVEPOINT restored_v2_accepts_v2');
  await assert.doesNotReject(() => store.saveReview({
    runId, expectedVersion: 6, state: historicalV2, actor, eventType: 'EVALUATE_RELEASE',
    idempotencyKey: `timing-restored-v2-${runId}`, command: evaluationCommand,
  }));
  await client.query('ROLLBACK TO SAVEPOINT restored_v2_accepts_v2');
  await client.query('RELEASE SAVEPOINT restored_v2_accepts_v2');
  await client.query('SAVEPOINT restored_v2_rejects_v3');
  await assert.rejects(() => store.saveReview({
    runId, expectedVersion: 6, state: review.state, actor, eventType: 'EVALUATE_RELEASE',
    idempotencyKey: `timing-restored-rejects-v3-${runId}`, command: assistedCommand,
  }), /release timing is incomplete|DATABASE_ERROR/i);
  await client.query('ROLLBACK TO SAVEPOINT restored_v2_rejects_v3');
  await client.query('RELEASE SAVEPOINT restored_v2_rejects_v3');

  await executeMigration(client, referenceSamplesV3Migration);
  await client.query('SAVEPOINT reapplied_v3_accepts_v3');
  await assert.doesNotReject(() => store.saveReview({
    runId, expectedVersion: 6, state: review.state, actor, eventType: 'EVALUATE_RELEASE',
    idempotencyKey: `timing-reapplied-v3-${runId}`, command: assistedCommand,
  }));
  await client.query('ROLLBACK TO SAVEPOINT reapplied_v3_accepts_v3');
  await client.query('RELEASE SAVEPOINT reapplied_v3_accepts_v3');

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

  const savePrivileges = (await client.query(`SELECT
    has_function_privilege('anon', 'product_private.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)', 'EXECUTE') AS anon_private_save,
    has_function_privilege('authenticated', 'product_private.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)', 'EXECUTE') AS authenticated_private_save,
    has_function_privilege('service_role', 'product_private.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)', 'EXECUTE') AS service_private_save,
    has_function_privilege('anon', 'public.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)', 'EXECUTE') AS anon_public_save,
    has_function_privilege('authenticated', 'public.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)', 'EXECUTE') AS authenticated_public_save,
    has_function_privilege('service_role', 'public.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb)', 'EXECUTE') AS service_public_save,
    has_function_privilege('anon', 'public.product_phase3_list_reference_sources(text)', 'EXECUTE') AS anon_reference_sources,
    has_function_privilege('authenticated', 'public.product_phase3_list_reference_sources(text)', 'EXECUTE') AS authenticated_reference_sources,
    has_function_privilege('service_role', 'public.product_phase3_list_reference_sources(text)', 'EXECUTE') AS service_reference_sources`)).rows[0];
  assert.deepEqual(savePrivileges, {
    anon_private_save: false,
    authenticated_private_save: false,
    service_private_save: true,
    anon_public_save: false,
    authenticated_public_save: false,
    service_public_save: true,
    anon_reference_sources: false,
    authenticated_reference_sources: false,
    service_reference_sources: true,
  });
});
