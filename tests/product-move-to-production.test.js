'use strict';

// The production move (lib/product/production-move.js) proved on two
// databases of one inactive Postgres: the source gets every migration and
// the Concho synthetic draft reviewed, published, evaluated and activated;
// the target starts empty. The dry run reports the 42 migrations and every
// table's rows without writing; the apply migrates, carries the run's rows
// and proves the target's analysis, review and published reads equal the
// source's; a second apply inserts nothing and changes nothing.
//
// Needs TEST_DATABASE_URL for a role that may CREATE DATABASE (the CI
// service's postgres role; the embedded Postgres locally). Two databases,
// pm_move_source and pm_move_target, are created and dropped.

const assert = require('node:assert/strict');
const test = require('node:test');
const { Client } = require('pg');

const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const { applyReviewCommand, initialiseReviewState, ProductReviewError } = require('../lib/product/review-state');
const { createPgStoreFacade } = require('../lib/product/pg-store-facade');
const { applyMigrations, migrationFiles, moveRunToTarget, readLedger, renderMoveReport, MOVE_TABLES } = require('../lib/product/production-move');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { CONCHO_URL, conchoSource, createSyntheticConchoModel, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for the production move test');
const actor = 'move-test-lawyer';
let admin; let source; let target;

function databaseUrlFor(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

test.before(async () => {
  admin = new Client({ connectionString: databaseUrl });
  await admin.connect();
  for (const name of ['pm_move_source', 'pm_move_target']) {
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
    await admin.query(`CREATE DATABASE ${name}`);
  }
  source = new Client({ connectionString: databaseUrlFor('pm_move_source') });
  target = new Client({ connectionString: databaseUrlFor('pm_move_target') });
  await source.connect();
  await target.connect();
});

test.after(async () => {
  if (source) await source.end();
  if (target) await target.end();
  if (admin) {
    for (const name of ['pm_move_source', 'pm_move_target']) await admin.query(`DROP DATABASE IF EXISTS ${name}`);
    await admin.end();
  }
});

function decideAll(state, analysis, clock) {
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

// The source as the preview branch is: migrated, one reviewed run with a
// published, evaluated and activated release.
async function seedSource() {
  await source.query('BEGIN');
  const migrated = await applyMigrations(source, { createRoles: true });
  await source.query('COMMIT');
  assert.equal(migrated.applied.length, migrationFiles().length);
  const store = new ProductPhase3Store({ client: createPgStoreFacade(source) });
  const sourceDocument = await conchoSource();
  const structure = buildAgreementStructure({ agreement_id: sourceDocument.source_document_id, canonical_text: sourceDocument.canonical_text, canonical_text_sha256: sourceDocument.canonical_text_sha256 });
  await store.persistSourceDocument(sourceDocument);
  const run = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id, retrievalUrl: CONCHO_URL, idempotencyKey: 'move-concho-v1',
    schemaVersion: schema.schema_version, promptBundleVersion: 'PRODUCT_MOVE/V1', modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' }, explicitGeneration: 1,
  });
  await store.attachStructure({ runId: run.run_id, structure });
  const analysis = await runAgreementDraftAnalysis({ runId: run.run_id, store, legalSchema: schema, model: createSyntheticConchoModel(), workerId: 'move-test' });
  assert.equal(analysis.status, 'READY');
  await store.assignRunOwner({ runId: run.run_id, actor });
  // The review clock sits after the session's start; the processing
  // timing goes to the evaluation as ISO text so its milliseconds survive
  // (the database's guard recomputes it to the microsecond).
  const instant = new Date(Date.now() + (5 * 60_000));
  const clock = () => instant;
  let review = await store.initialiseReview({ runId: run.run_id, state: initialiseReviewState(analysis), actor });
  let state = decideAll(review.state, analysis, clock);
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 0, state, actor, eventType: 'SAVE', idempotencyKey: 'move-decide', command: { type: 'SAVE_PROGRESS' } });
  state = applyReviewCommand(review.state, { type: 'PUBLISH' }, { analysis, legalSchema: schema, clock });
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 1, state, actor, eventType: 'PUBLISH', idempotencyKey: 'move-publish', command: { type: 'PUBLISH' } });
  const facts = review.state.summary.families.flatMap((family) => family.facts);
  const unresolved = new Set((analysis.coverage_assertions || []).filter((item) => item.state === 'UNRESOLVED').map((item) => item.coverage_assertion_id));
  const findingResolutions = review.state.items.filter((item) => item.kind === 'COVERAGE' && item.decision === 'ACCEPTED' && unresolved.has(item.source_id))
    .map((item) => ({ finding_item_id: item.item_id, disposition: 'REVIEWED_OMISSION', omission_reason: 'Reviewed against the source: nothing further to extract.', reviewed_by_role: 'LAWYER' }));
  const evaluation = {
    type: 'EVALUATE_RELEASE', reviewer_identity: actor, lawyer_attestation: true, reference_samples_attestation: true,
    reference_samples: [{ reference_sample_id: 'move-sample-1', source_document_id: sourceDocument.source_document_id, source_url: sourceDocument.retrieval_url, source_section: 'Section 5.2', description: 'One reviewed reference legal point.', severity: 'MATERIAL', assessment: 'FOUND', comparison: 'The source and product output state the same legal point.' }],
    citation_assessments: facts.map((fact) => ({ review_item_id: fact.review_item_id, exact: true, legally_sufficient: true, narrow: true })),
    finding_resolutions: findingResolutions, elapsed_minutes: 120, developer_assisted: false,
  };
  const measured = await store.getReleaseTiming({ runId: run.run_id });
  const timing = { processingStartedAt: new Date(measured.processingStartedAt).toISOString(), processingCompletedAt: new Date(measured.processingCompletedAt).toISOString() };
  const referenceSources = await store.listReferenceSources({ actor });
  state = applyReviewCommand(review.state, evaluation, { analysis, legalSchema: schema, clock, timing, referenceSources });
  assert.equal(state.release_evaluation.passed, true, JSON.stringify(state.release_evaluation.bars));
  review = await store.saveReview({ runId: run.run_id, expectedVersion: 2, state, actor, eventType: 'EVALUATE_RELEASE', idempotencyKey: 'move-evaluate', command: evaluation });
  const release = (await source.query('SELECT release_id FROM public.product_agreement_releases WHERE run_id = $1', [run.run_id])).rows[0].release_id;
  state = applyReviewCommand(review.state, { type: 'ACTIVATE_RELEASE', release_id: release }, { analysis, legalSchema: schema, clock });
  await store.saveReview({ runId: run.run_id, expectedVersion: 3, state, actor, eventType: 'ACTIVATE_RELEASE', idempotencyKey: 'move-activate', command: { type: 'ACTIVATE_RELEASE', release_id: release } });
  assert.equal((await source.query('SELECT release_id FROM public.product_agreement_release_heads WHERE source_document_id = $1', [sourceDocument.source_document_id])).rows[0].release_id, release);
  return { runId: run.run_id, sourceDocumentId: sourceDocument.source_document_id, release };
}

test('the move: dry run reads without writing, apply migrates and carries the run so the target reads as the source does, a second apply changes nothing', async () => {
  const seeded = await seedSource();
  const files = migrationFiles();

  const dry = await moveRunToTarget({ source, target, runId: seeded.runId, apply: false });
  assert.equal(dry.apply, false);
  assert.equal(dry.migrations.total, files.length);
  assert.equal(dry.migrations.applied_before, 0);
  assert.equal(dry.migrations.ledger_exists, false);
  assert.deepEqual(dry.migrations.to_apply, files.map((file) => file.file));
  assert.equal(dry.tables.length, MOVE_TABLES.length);
  assert.ok(dry.tables.every((entry) => entry.target_rows === null), 'an empty target has no product tables');
  const sourceRows = Object.fromEntries(dry.tables.map((entry) => [entry.table, entry.source_rows]));
  assert.equal(sourceRows.product_source_documents, 1);
  assert.equal(sourceRows.product_analysis_runs, 1);
  assert.ok(sourceRows.product_proposals > 0);
  assert.ok(sourceRows.product_model_calls > 0);
  assert.equal(sourceRows.product_review_sessions, 1);
  assert.equal(sourceRows.product_agreement_releases, 1);
  assert.equal(sourceRows.product_agreement_release_heads, 1);
  assert.equal(dry.head_elsewhere, null);
  assert.equal(dry.proof, null);
  assert.equal((await target.query("SELECT to_regclass('public.product_analysis_runs') AS relation")).rows[0].relation, null, 'the dry run wrote nothing');
  assert.match(renderMoveReport(dry), /dry run: nothing written/);

  const applied = await moveRunToTarget({ source, target, runId: seeded.runId, apply: true, createRoles: true });
  assert.deepEqual(applied.migrations.applied_now, files.map((file) => file.file));
  assert.equal((await readLedger(target)).rows.length, files.length);
  for (const entry of applied.tables) {
    assert.equal(entry.inserted, entry.source_rows, `${entry.table} inserted every source row`);
    assert.equal(entry.missing, 0, `${entry.table} missing`);
    assert.equal(entry.differing, 0, `${entry.table} differing: ${JSON.stringify(entry.differences)}`);
    assert.equal(entry.target_rows, entry.source_rows, `${entry.table} target rows`);
  }
  assert.ok(applied.inserted_total > 100, `inserted ${applied.inserted_total}`);
  assert.deepEqual(applied.proof, {
    ...applied.proof, analysis_read_equal: true, review_reads_equal: true, published_read_equal: true, review_actors: [actor],
  });
  assert.equal(applied.proof.published_on_target.run_id, seeded.runId);
  assert.equal(applied.complete, true, renderMoveReport(applied));
  assert.equal((await target.query('SELECT release_id FROM public.product_agreement_release_heads WHERE source_document_id = $1', [seeded.sourceDocumentId])).rows[0].release_id, seeded.release);
  assert.equal((await target.query('SELECT count(*)::int AS n FROM public.product_run_sandboxes')).rows[0].n, 0, 'the sandbox table exists on the target and carries nothing');
  assert.match(renderMoveReport(applied), /move complete: the target reads as the source does/);

  const again = await moveRunToTarget({ source, target, runId: seeded.runId, apply: true });
  assert.deepEqual(again.migrations.applied_now, []);
  assert.equal(again.migrations.applied_before, files.length);
  assert.equal(again.inserted_total, 0);
  assert.equal(again.differing_total, 0);
  assert.equal(again.missing_total, 0);
  assert.equal(again.complete, true);
  assert.equal((await readLedger(target)).rows.length, files.length);
  for (const entry of again.tables) assert.equal(entry.already_there, entry.source_rows, `${entry.table} already there`);

  // A target already migrated by hand (the ledger carries the names under
  // other versions, as the preview branch's does) applies nothing twice.
  await target.query("UPDATE supabase_migrations.schema_migrations SET version = '2099' || substr(version, 5) WHERE name = 'product_run_sandboxes'");
  const renumbered = await moveRunToTarget({ source, target, runId: seeded.runId, apply: false });
  assert.equal(renumbered.migrations.to_apply.length, 0);

  await assert.rejects(() => moveRunToTarget({ source, target, runId: '00000000-0000-4000-8000-00000000dead', apply: false }), /is not on the source/);
});
