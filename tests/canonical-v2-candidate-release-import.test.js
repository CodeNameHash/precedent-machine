const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/landos-candidate-release');
const { buildInitialActiveReleasePointer } = require('../lib/canonical-v2/candidate-release');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  activateCandidateRelease,
  buildCandidateReleaseImportPlan,
  importCandidateRelease,
  validateCandidateReleaseImportPlan,
} = require('../lib/canonical-v2/candidate-release-import');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function receiptFor(plan, replayed = false) {
  return {
    schema_version: 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V3',
    import_state: 'IMPORTED_COMPLETE',
    replayed,
    candidate_manifest_id: plan.release_record.candidate_manifest_id,
    correction_input_seal_id: plan.release_record.correction_input_seal_id,
    correction_input_root: plan.release_record.correction_input_root,
    corpus_release_id: plan.release_record.corpus_release_id,
    serving_namespace_id: plan.release_record.canonical_payload.serving_namespace_id,
    candidate_release_import_plan_id: plan.candidate_release_import_plan_id,
    expected_counts: plan.expected_counts,
    imported_at: '2026-07-21T12:00:00.000Z',
  };
}

function rekeyPlan(plan) {
  const { candidate_release_import_plan_id: ignored, ...body } = plan;
  plan.candidate_release_import_plan_id = contentId('CANDIDATE_RELEASE_IMPORT_PLAN/V3', body);
  return plan;
}

test('one certified release becomes one deterministic atomic import plan across every serving partition', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const first = buildCandidateReleaseImportPlan({ release });
  const second = buildCandidateReleaseImportPlan({ release });

  assert.deepEqual(first, second);
  assert.equal(validateCandidateReleaseImportPlan(first), true);
  assert.deepEqual(first.expected_counts, {
    correction_input_seal_records: 1,
    correction_discharge_records: 0,
    deal_directory_records: 1,
    market_observations: 12,
    market_exclusions: 0,
    query_records: 12,
    source_specific_records: 1,
    exact_detail_packages: 13,
    validated_semantic_graph_records: 1,
  });
  assert.equal(first.release_record.correction_input_seal_id, release.manifest.correction_input_seal_id);
  assert.equal(first.release_record.correction_input_root, release.manifest.roots.correction_input_root);
  assert.equal(first.correction_input_seal_record.correction_input_seal_id, release.manifest.correction_input_seal_id);
  assert.deepEqual(first.correction_discharge_records, []);
  assert.equal(first.query_records.some((row) => row.canonical_payload.row_kind !== 'CANONICAL_RESULT'), false);
  assert.equal(first.source_specific_records[0].canonical_payload.row_kind, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(first.source_specific_records[0].market_cohort_eligible, false);
  assert.equal(first.exact_detail_packages.length, first.query_records.length + first.source_specific_records.length);
  assert.equal(first.validated_semantic_graph_records[0].governed_deal_key, 'deal:landos-abbvie');
  assert.equal(first.validated_semantic_graph_records[0].definition_cue_count, 1);
  assert.equal(first.validated_semantic_graph_records[0].definition_use_cue_count, 2);
});

test('bundle or physical projection drift blocks the import plan before any database call', async () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const tamperedBundle = clone(release);
  tamperedBundle.query_records[0].buyer = 'Different buyer';
  let calls = 0;
  await assert.rejects(importCandidateRelease({
    client: {
      rpc() {
        calls += 1;
        return Promise.resolve({ data: null, error: null });
      },
    },
    release: tamperedBundle,
  }), /query projection/);
  assert.equal(calls, 0);

  const plan = clone(buildCandidateReleaseImportPlan({ release }));
  plan.source_specific_records[0].market_cohort_eligible = true;
  assert.throws(() => validateCandidateReleaseImportPlan(plan), /identity mismatch|market_cohort_eligible|projection/);

  const graphDrift = clone(buildCandidateReleaseImportPlan({ release }));
  graphDrift.validated_semantic_graph_records[0].governed_deal_key = 'WRONG-DEAL';
  rekeyPlan(graphDrift);
  assert.throws(() => validateCandidateReleaseImportPlan(graphDrift), /semantic graph import record drift/);

  const missingSeal = clone(buildCandidateReleaseImportPlan({ release }));
  delete missingSeal.correction_input_seal_record;
  rekeyPlan(missingSeal);
  assert.throws(() => validateCandidateReleaseImportPlan(missingSeal), /import contract/);

  const rootDrift = clone(buildCandidateReleaseImportPlan({ release }));
  rootDrift.release_record.correction_input_root = '0'.repeat(64);
  rekeyPlan(rootDrift);
  assert.throws(() => validateCandidateReleaseImportPlan(rootDrift), /does not close over its certified manifest/);
});

test('release import performs one writer RPC, validates the complete receipt and never retries failures', async () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const calls = [];
  const imported = await importCandidateRelease({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({ data: receiptFor(params.p_import_plan), error: null });
      },
    },
    release,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_import_candidate_release');
  assert.equal(calls[0].params.p_environment, 'staging');
  assert.equal(imported.receipt.import_state, 'IMPORTED_COMPLETE');
  assert.equal(imported.receipt.replayed, false);
  assert.equal(imported.receipt.correction_input_seal_id, release.manifest.correction_input_seal_id);
  assert.equal(imported.receipt.correction_input_root, release.manifest.roots.correction_input_root);

  let failedCalls = 0;
  await assert.rejects(importCandidateRelease({
    client: {
      rpc() {
        failedCalls += 1;
        return Promise.resolve({ data: null, error: { message: 'capacity' } });
      },
    },
    release,
  }), (error) => error.code === 'DATA_SOURCE_ERROR');
  assert.equal(failedCalls, 1);
});

test('active release movement is one exact compare-and-swap RPC over a completely imported candidate', async () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const currentPointer = buildInitialActiveReleasePointer();
  const calls = [];
  const activated = await activateCandidateRelease({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({ data: params.p_next_pointer, error: null });
      },
    },
    currentPointer,
    release,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_activate_candidate_release');
  assert.deepEqual(calls[0].params.p_expected_current_pointer, currentPointer);
  assert.equal(activated.pointer.generation, 1);
  assert.equal(activated.pointer.schema_version, 'FIXTURE_ACTIVE_RELEASE_POINTER/V2');
  assert.equal(activated.pointer.corpus_release_id, release.manifest.corpus_release_id);
  assert.equal(activated.pointer.correction_input_seal_id, release.manifest.correction_input_seal_id);
  assert.equal(activated.pointer.correction_input_root, release.manifest.roots.correction_input_root);
  assert.equal(activated.pointer.previous_pointer_id, currentPointer.pointer_id);

  await assert.rejects(activateCandidateRelease({
    client: { rpc: () => Promise.resolve({ data: currentPointer, error: null }) },
    currentPointer,
    release,
  }), (error) => error.code === 'INVALID_RESPONSE');
});

test('staging import is set-based, transactional and withholds completion until every certified count closes', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const functionStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_import_candidate_release');
  const functionEnd = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_market_cohort');
  const importer = sql.slice(functionStart, functionEnd);

  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.exact_detail_serving_packages/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.deal_serving_directory/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.candidate_release_import_receipts/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.candidate_release_semantic_graphs/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.candidate_release_correction_input_seals/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.candidate_release_correction_discharges/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.active_corpus_release_pointer_history/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.active_corpus_release_pointers/);
  assert.match(importer, /SET statement_timeout = '15000ms'/);
  assert.match(importer, /pg_advisory_xact_lock\(hashtextextended\(manifest_id, 0\)\)/);
  assert.match(importer, /jsonb_populate_recordset/);
  assert.match(importer, /candidate_release_correction_input_seals[\s\S]*candidate_release_correction_discharges[\s\S]*deal_serving_directory[\s\S]*market_observations[\s\S]*market_metric_slot_exclusions[\s\S]*shared_serving_rows[\s\S]*reviewed_source_specific_serving_rows[\s\S]*exact_detail_serving_packages[\s\S]*candidate_release_semantic_graphs/);
  assert.match(importer, /candidate correction discharge import set does not equal its seal/);
  assert.match(importer, /candidate_release_correction_input_seals[\s\S]*candidate_release_correction_discharges[\s\S]*did not close over every certified serving object/);
  assert.match(importer, /CANDIDATE_RELEASE_IMPORT_RECEIPT\/V3/);
  assert.match(importer, /did not close over every certified serving object[\s\S]*INSERT INTO canonical_v2_staging\.candidate_release_import_receipts/);
  assert.doesNotMatch(importer, /\bLOOP\b/i);
  assert.doesNotMatch(importer, /\bOFFSET\b/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_import_candidate_release\(text, jsonb\)[\s\S]*TO canonical_v2_writer/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_import_candidate_release\(text, jsonb\)\s+TO canonical_v2_serving/);
  assert.doesNotMatch(sql, /GRANT SELECT[\s\S]*TO (anon|authenticated|service_role|canonical_v2_serving|canonical_v2_writer)/);
  assert.doesNotMatch(sql, /GRANT SELECT ON (?:TABLE )?canonical_v2_staging\.candidate_release_semantic_graphs/);

  const activationStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_activate_candidate_release');
  const activationEnd = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_release');
  const activation = sql.slice(activationStart, activationEnd);
  assert.ok(activationStart >= 0 && activationEnd > activationStart);
  assert.match(activation, /pg_advisory_xact_lock/);
  assert.match(activation, /active release pointer changed before compare-and-swap/);
  assert.match(activation, /receipt\.import_state = 'IMPORTED_COMPLETE'/);
  assert.match(activation, /active release pointer does not match the imported correction seal/);
  assert.match(activation, /FIXTURE_ACTIVE_RELEASE_POINTER\/V2/);
  assert.match(activation, /candidate release has no complete import receipt/);
  assert.match(activation, /INSERT INTO canonical_v2_staging\.active_corpus_release_pointer_history[\s\S]*INSERT INTO canonical_v2_staging\.active_corpus_release_pointers/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_activate_candidate_release\(text, jsonb, jsonb\)[\s\S]*TO canonical_v2_writer/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_active_release\(text\)[\s\S]*TO canonical_v2_serving/);
});
