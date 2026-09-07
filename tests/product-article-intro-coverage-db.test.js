'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const phase2Database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { createSyntheticConchoModel, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');
const { substantiveSections } = require('../lib/product/source-context');

const ROOT = path.resolve(__dirname, '..');
const migrationFiles = [
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
];

const actor = 'article-intro-coverage-lawyer';

async function executeMigration(client, sql) {
  if (process.env.TEST_PGLITE_MODULE) await client.exec(sql);
  else await client.query(sql);
}

function sourceFixture() {
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER',
    'ARTICLE I',
    'GENERAL PROVISIONS',
    'Section 1.1 Purpose. This Agreement governs the merger.',
    'ARTICLE III',
    'REPRESENTATIONS AND WARRANTIES OF THE COMPANY',
    'Except as disclosed in the Company Disclosure Schedule, the Company represents and warrants to Parent as follows:',
    'Section 3.1 Organization. The Company is duly organised and validly existing.',
    'Section 3.2 Authority. The Company has the requisite power and authority.',
  ].join('\n\n');
  const sourceDocumentId = crypto.createHash('sha256').update(canonicalText).digest('hex');
  const raw = Buffer.from(canonicalText, 'utf8');
  return {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: sourceDocumentId,
    agreement_id: sourceDocumentId,
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000000000001/article-intro.htm',
    final_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000000000001/article-intro.htm',
    raw_sha256: sourceDocumentId, raw_bytes_base64: raw.toString('base64'), raw_byte_length: raw.length,
    canonical_text: canonicalText, canonical_text_sha256: sourceDocumentId,
    canonical_text_byte_length: raw.length, filing_accession: '1',
    exhibit_filename: 'article-intro.htm', source_map_id: sourceDocumentId,
  };
}

function acceptAll(state, analysis, clock) {
  let next = state;
  for (const item of next.items) {
    next = applyReviewCommand(next, {
      type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED',
    }, { analysis, legalSchema: schema, clock });
  }
  return applyReviewCommand(next, {
    type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true,
  }, { analysis, legalSchema: schema, clock });
}

test.before(async () => {
  await phase2Database.setupDatabase();
  const client = phase2Database.getDatabaseClient();
  for (const file of migrationFiles) {
    await executeMigration(client, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  }
});

test.after(phase2Database.teardownDatabase);

test('full database chain requires article-intro work and blocks publication when its result is missing', async () => {
  const client = phase2Database.getDatabaseClient();
  const store = new ProductPhase3Store({ client: phase2Database.databaseFacade() });
  const sourceDocument = sourceFixture();
  const structure = buildAgreementStructure(sourceDocument);
  const introduction = structure.nodes.find((node) => node.reference === 'III-INTRO');
  assert.ok(introduction);

  await store.persistSourceDocument(sourceDocument);
  const run = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: sourceDocument.retrieval_url,
    idempotencyKey: 'article-intro-full-chain', schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_ARTICLE_INTRO/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    explicitGeneration: 1,
  });
  await store.attachStructure({ runId: run.run_id, structure });
  const expectedIds = substantiveSections(structure).map((node) => node.node_id);
  const workIds = (await client.query(
    'SELECT node_id FROM public.product_section_work WHERE run_id=$1 ORDER BY authored_order', [run.run_id],
  )).rows.map((row) => row.node_id);
  assert.deepEqual(workIds, expectedIds);

  const analysis = await runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema,
    model: createSyntheticConchoModel(), workerId: 'article-intro-full-chain',
  });
  assert.equal(analysis.sections.length, expectedIds.length);
  assert.ok(analysis.coverage_assertions.some((coverage) => (
    coverage.subject_kind === 'SECTION' && coverage.subject_id === introduction.node_id
  )));

  await store.assignRunOwner({ runId: run.run_id, actor });
  const startedAt = new Date(Date.now() - 5 * 60_000);
  const clock = () => new Date();
  let state = initialiseReviewState(analysis, { clock: () => startedAt });
  let review = await store.initialiseReview({ runId: run.run_id, state, actor });
  state = acceptAll(review.state, analysis, clock);
  state = applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema: schema, clock });

  const historicalRead = await store.getReview({ runId: run.run_id, actor });
  const assertCoverageGuard = async (idempotencyKey) => {
    await assert.rejects(() => store.saveReview({
      runId: run.run_id, expectedVersion: 0, state, actor, eventType: 'PUBLISH',
      idempotencyKey, command: { type: 'PUBLISH' },
    }), (error) => {
      assert.equal(error.cause?.message, 'published review source coverage is incomplete');
      return true;
    });
  };

  await client.query('SAVEPOINT missing_article_intro_result');
  await client.query('ALTER TABLE public.product_section_results DISABLE TRIGGER product_section_results_immutable');
  await client.query(
    'DELETE FROM public.product_section_results WHERE run_id=$1 AND structure_node_id=$2',
    [run.run_id, introduction.node_id],
  );
  await assertCoverageGuard('missing-article-intro-result');
  await client.query('ROLLBACK TO SAVEPOINT missing_article_intro_result');
  await client.query('RELEASE SAVEPOINT missing_article_intro_result');
  assert.deepEqual(await store.getReview({ runId: run.run_id, actor }), historicalRead);

  await client.query('SAVEPOINT missing_article_intro_coverage');
  await client.query('ALTER TABLE public.product_coverage_assertions DISABLE TRIGGER product_coverage_assertions_immutable');
  await client.query(`DELETE FROM public.product_coverage_assertions
    WHERE run_id=$1 AND subject_kind='SECTION' AND structure_node_id=$2 AND subject_id=$2`, [run.run_id, introduction.node_id]);
  await assertCoverageGuard('missing-article-intro-coverage');
  await client.query('ROLLBACK TO SAVEPOINT missing_article_intro_coverage');
  await client.query('RELEASE SAVEPOINT missing_article_intro_coverage');
  assert.deepEqual(await store.getReview({ runId: run.run_id, actor }), historicalRead);

  await client.query('SAVEPOINT substituted_article_intro_result');
  await client.query('ALTER TABLE public.product_section_results DISABLE TRIGGER product_section_results_immutable');
  await client.query(`UPDATE public.product_section_results SET structure_node_id=$3
    WHERE run_id=$1 AND structure_node_id=$2`, [run.run_id, introduction.node_id, 'f'.repeat(64)]);
  assert.equal(Number((await client.query(
    'SELECT count(*) FROM public.product_section_results WHERE run_id=$1', [run.run_id],
  )).rows[0].count), expectedIds.length);
  await assertCoverageGuard('substituted-article-intro-result');
  await client.query('ROLLBACK TO SAVEPOINT substituted_article_intro_result');
  await client.query('RELEASE SAVEPOINT substituted_article_intro_result');
  assert.deepEqual(await store.getReview({ runId: run.run_id, actor }), historicalRead);

  review = await store.saveReview({
    runId: run.run_id, expectedVersion: 0, state, actor, eventType: 'PUBLISH',
    idempotencyKey: 'complete-article-intro', command: { type: 'PUBLISH' },
  });
  assert.equal(review.status, 'PUBLISHED');

  for (const signature of [
    'public.product_phase1_attach_structure(uuid,text,jsonb,jsonb)',
    'public.product_phase1_resolve_identity(uuid,jsonb)',
    'product_private.product_phase2_commit_section_legacy(uuid,text,text,uuid,jsonb)',
    'product_private.product_phase2_finalize_draft_legacy(uuid,jsonb)',
    'product_private.product_phase2_finalize_saved_run(uuid,jsonb)',
  ]) {
    const definition = (await client.query(
      'SELECT pg_get_functiondef(to_regprocedure($1)) AS definition', [signature],
    )).rows[0].definition;
    assert.doesNotMatch(definition, /!~ '-INTRO\$'/);
  }
  const privileges = (await client.query(`SELECT
    has_function_privilege('anon', 'product_private.product_phase3_validate_review(uuid,jsonb,boolean)', 'EXECUTE') AS anon,
    has_function_privilege('authenticated', 'product_private.product_phase3_validate_review(uuid,jsonb,boolean)', 'EXECUTE') AS authenticated,
    has_function_privilege('service_role', 'product_private.product_phase3_validate_review(uuid,jsonb,boolean)', 'EXECUTE') AS service
  `)).rows[0];
  assert.deepEqual(privileges, { anon: false, authenticated: false, service: true });
});
