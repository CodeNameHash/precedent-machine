const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/landos-candidate-release');
const {
  buildFixtureCandidateRelease,
  buildInitialActiveReleasePointer,
} = require('../lib/canonical-v2/candidate-release');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const metseraFixture = require(
  '../__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
);
const {
  activateCandidateRelease,
  buildCandidateReleaseImportPlan,
  importCandidateRelease,
  rollbackInactiveCandidateRelease,
  validateCandidateReleaseImportPlan,
} = require('../lib/canonical-v2/candidate-release-import');
const {
  buildProductQueryResultServingRecord,
} = require('../lib/canonical-v2/product-query-result-serving-record');
const {
  buildProductQueryResultReleasePartition,
} = require(
  '../lib/canonical-v2/product-query-result-release-partition',
);
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function receiptFor(plan, replayed = false) {
  const version = plan.schema_version.split('/V')[1];
  return {
    schema_version: `CANDIDATE_RELEASE_IMPORT_RECEIPT/V${version}`,
    import_state: 'IMPORTED_COMPLETE',
    replayed,
    candidate_manifest_id: plan.release_record.candidate_manifest_id,
    candidate_input_authority: plan.candidate_input_authority,
    correction_input_seal_id: plan.release_record.correction_input_seal_id,
    correction_input_root: plan.release_record.correction_input_root,
    corpus_release_id: plan.release_record.corpus_release_id,
    serving_namespace_id: plan.release_record.canonical_payload.serving_namespace_id,
    candidate_release_import_plan_id: plan.candidate_release_import_plan_id,
    expected_counts: plan.expected_counts,
    imported_at: '2026-07-21T12:00:00.000Z',
  };
}

function productResultFor(release) {
  const result = clone(metseraFixture.shared_result);
  result.candidate_release_manifest_id =
    release.manifest.candidate_release_manifest_id;
  result.candidate_release_manifest_payload_digest =
    release.manifest.canonical_payload_digest;
  result.product_query_result_identity = contentId(
    'PRODUCT_QUERY_RESULT/V1',
    {
      schema_version: 'PRODUCT_QUERY_RESULT/V1',
      product_query_definition_id:
        result.product_query_definition_id,
      approved_pm_data_version_id:
        result.approved_pm_data_version_id,
      candidate_release_manifest_id:
        result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        result.candidate_release_manifest_payload_digest,
      domain_key: result.domain_key,
      domain_result_definition_stable_id:
        result.domain_result_definition.stable_id,
      domain_result_definition_version:
        result.domain_result_definition.version,
      domain_result_identity: result.domain_result_identity,
    },
  );
  result.exact_citation.citation_target_identity = contentId(
    result.exact_citation.schema_version,
    {
      product_query_result_identity:
        result.product_query_result_identity,
      candidate_release_manifest_id:
        result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        result.candidate_release_manifest_payload_digest,
      source_document_identity:
        result.exact_citation.source_document_identity,
      source_evidence_identity:
        result.exact_citation.source_evidence_identity,
    },
  );
  return result;
}

function productPartitionFor(release) {
  const record = buildProductQueryResultServingRecord({
    serving_namespace_id: release.manifest.serving_namespace_id,
    corpus_release_id: release.manifest.corpus_release_id,
    candidate_product_result_id:
      metseraFixture.candidate_product_result_id,
    candidate_product_result_payload_digest: 'f'.repeat(64),
    product_query_result: productResultFor(release),
  });
  return buildProductQueryResultReleasePartition({
    candidate_release_manifest: release.manifest,
    product_query_result_serving_records: [record],
  });
}

function rekeyPlan(plan) {
  const { candidate_release_import_plan_id: ignored, ...body } = plan;
  plan.candidate_release_import_plan_id = contentId('CANDIDATE_RELEASE_IMPORT_PLAN/V4', body);
  return plan;
}

function rollbackReceiptFor(plan) {
  return {
    schema_version: 'CANDIDATE_RELEASE_ROLLBACK_RECEIPT/V1',
    rollback_state: 'REMOVED_INACTIVE',
    candidate_manifest_id: plan.release_record.candidate_manifest_id,
    corpus_release_id: plan.release_record.corpus_release_id,
    serving_namespace_id: plan.release_record.canonical_payload.serving_namespace_id,
    candidate_release_import_plan_id: plan.candidate_release_import_plan_id,
    active_pointer_id: 'a'.repeat(64),
    deleted_counts: {
      ...plan.expected_counts,
      import_receipts: 1,
      release_records: 1,
    },
    rolled_back_at: '2026-07-22T12:00:00.000Z',
  };
}

function buildProjectionBoundRelease() {
  const fixture = buildLandosCandidateReleaseFixture();
  return buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: fixture.members,
    source_specific_members: fixture.sourceSpecificMembers,
    validated_semantic_graphs: fixture.validatedSemanticGraphs,
    correction_authority_selection: fixture.correctionAuthoritySelection,
    deal_directory_entries: fixture.dealDirectoryEntries,
  });
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
  assert.deepEqual(first.candidate_input_authority, {
    contract_fingerprint: release.candidate_correction_input_seal.contract_fingerprint,
    candidate_input_head_id: release.candidate_correction_input_seal.candidate_input_head_id,
    candidate_input_head_payload_digest:
      release.candidate_correction_input_seal.candidate_input_head_payload_digest,
    correction_discharge_map_id: release.candidate_correction_input_seal.correction_discharge_map_id,
    correction_discharge_map_payload_digest:
      release.candidate_correction_input_seal.correction_discharge_map_payload_digest,
  });
  assert.deepEqual(first.correction_discharge_records, []);
  assert.equal(first.query_records.some((row) => row.canonical_payload.row_kind !== 'CANONICAL_RESULT'), false);
  assert.equal(first.source_specific_records[0].canonical_payload.row_kind, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(first.source_specific_records[0].market_cohort_eligible, false);
  assert.equal(first.exact_detail_packages.length, first.query_records.length + first.source_specific_records.length);
  assert.equal(
    first.exact_detail_packages[0].exact_detail_package_digest,
    contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', first.exact_detail_packages[0].canonical_payload),
  );
  assert.equal(first.validated_semantic_graph_records[0].governed_deal_key, 'deal:landos-abbvie');
  assert.equal(first.validated_semantic_graph_records[0].definition_cue_count, 1);
  assert.equal(first.validated_semantic_graph_records[0].definition_use_cue_count, 2);
});

test('projection-bound manifests exclusively determine the v2 import and exact query schema', () => {
  const legacy = buildLandosCandidateReleaseFixture().release;
  const legacyPlan = buildCandidateReleaseImportPlan({ release: legacy });
  assert.equal(legacyPlan.release_record.projection_version, 'canonical-v2-serving/v1');
  assert.equal(Object.hasOwn(legacyPlan.release_record, 'query_projection_contract_digest'), false);
  assert.equal(legacy.query_records.some((record) => Object.hasOwn(record, 'payment_timings')), false);

  const release = buildProjectionBoundRelease();
  const plan = buildCandidateReleaseImportPlan({
    release,
    projectionVersion: 'canonical-v2-serving/v1',
  });
  assert.equal(release.schema_version, 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V3');
  assert.equal(release.manifest.schema_version, 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3');
  assert.equal(plan.schema_version, 'CANDIDATE_RELEASE_IMPORT_PLAN/V6');
  assert.equal(plan.release_record.projection_version, SERVING_PROJECTION_VERSION_V2);
  assert.equal(
    plan.release_record.query_projection_contract_digest,
    QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  );
  assert.equal(release.query_records.every((record) => (
    Array.isArray(record.payment_timings) && Array.isArray(record.trigger_conditions)
  )), true);

  const tampered = clone(release);
  tampered.manifest.serving_projection_version = 'canonical-v2-serving/v1';
  assert.throws(
    () => buildCandidateReleaseImportPlan({ release: tampered }),
    /frozen v2|complete certified release/,
  );
});

test('one V7 import plan binds the existing release and Product result partition', async () => {
  const release = buildProjectionBoundRelease();
  const partition = productPartitionFor(release);
  const plan = buildCandidateReleaseImportPlan({
    release,
    product_result_release_partition: partition,
  });

  assert.equal(plan.schema_version, 'CANDIDATE_RELEASE_IMPORT_PLAN/V7');
  assert.equal(
    plan.expected_counts.product_query_result_release_partition_manifests,
    1,
  );
  assert.equal(plan.expected_counts.product_query_result_serving_records, 1);
  assert.equal(
    plan.release_record
      .product_query_result_release_partition_manifest_id,
    partition.product_query_result_release_partition_manifest
      .product_query_result_release_partition_manifest_id,
  );
  assert.equal(
    plan.product_query_result_serving_records[0]
      .candidate_release_manifest_id,
    release.manifest.candidate_release_manifest_id,
  );
  assert.equal(validateCandidateReleaseImportPlan(plan), true);

  const calls = [];
  const imported = await importCandidateRelease({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({
          data: receiptFor(params.p_import_plan),
          error: null,
        });
      },
    },
    release,
    productResultReleasePartition: partition,
  });
  assert.equal(calls.length, 1);
  assert.equal(imported.receipt.schema_version, 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V7');

  const drifted = clone(partition);
  drifted.base_candidate_release_manifest.corpus_release_id =
    '0'.repeat(64);
  assert.throws(
    () => buildCandidateReleaseImportPlan({
      release,
      product_result_release_partition: drifted,
    }),
    /manifest|release|identity/i,
  );
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

  const staleAuthority = clone(buildCandidateReleaseImportPlan({ release }));
  staleAuthority.candidate_input_authority.candidate_input_head_id = '0'.repeat(64);
  rekeyPlan(staleAuthority);
  assert.throws(
    () => validateCandidateReleaseImportPlan(staleAuthority),
    /candidate input authority does not equal its certified correction seal/,
  );

  const rehashedDetailDrift = clone(buildCandidateReleaseImportPlan({ release }));
  const detailRecord = rehashedDetailDrift.exact_detail_packages[0];
  detailRecord.canonical_payload.detail_payloads[0].response_body.detail_kind = 'FABRICATED_DETAIL';
  const driftedPackageDigest = contentId(
    'EXACT_DETAIL_ATOMIC_PACKAGE/V1',
    detailRecord.canonical_payload,
  );
  detailRecord.exact_detail_package_digest = driftedPackageDigest;
  detailRecord.canonical_payload_digest = driftedPackageDigest;
  rekeyPlan(rehashedDetailDrift);
  assert.throws(
    () => validateCandidateReleaseImportPlan(rehashedDetailDrift),
    /do not equal the certified release package set/,
  );
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
  assert.deepEqual(imported.receipt.candidate_input_authority, imported.plan.candidate_input_authority);

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

test('inactive candidate rollback is one exact writer RPC and validates every deleted partition count', async () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const calls = [];
  const rolledBack = await rollbackInactiveCandidateRelease({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        const plan = buildCandidateReleaseImportPlan({ release });
        return Promise.resolve({ data: rollbackReceiptFor(plan), error: null });
      },
    },
    release,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_rollback_inactive_candidate_release');
  assert.deepEqual(calls[0].params, {
    p_environment: 'staging',
    p_candidate_manifest_id: rolledBack.plan.release_record.candidate_manifest_id,
    p_corpus_release_id: rolledBack.plan.release_record.corpus_release_id,
    p_serving_namespace_id: rolledBack.plan.release_record.canonical_payload.serving_namespace_id,
    p_candidate_release_import_plan_id: rolledBack.plan.candidate_release_import_plan_id,
  });
  assert.equal(rolledBack.receipt.rollback_state, 'REMOVED_INACTIVE');
  assert.deepEqual(rolledBack.receipt.deleted_counts, {
    ...rolledBack.plan.expected_counts,
    import_receipts: 1,
    release_records: 1,
  });

  let failedCalls = 0;
  await assert.rejects(rollbackInactiveCandidateRelease({
    client: {
      rpc() {
        failedCalls += 1;
        return Promise.resolve({ data: null, error: { message: 'blocked' } });
      },
    },
    release,
  }), (error) => error.code === 'DATA_SOURCE_ERROR');
  assert.equal(failedCalls, 1);

  await assert.rejects(rollbackInactiveCandidateRelease({
    client: {
      rpc(name, params) {
        const plan = buildCandidateReleaseImportPlan({ release });
        const receipt = rollbackReceiptFor(plan);
        receipt.deleted_counts.query_records -= 1;
        return Promise.resolve({ data: receipt, error: null });
      },
    },
    release,
  }), (error) => error.code === 'INVALID_RESPONSE');
});

test('V7 inactive rollback preserves the Product partition plan identity and counts', async () => {
  const release = buildProjectionBoundRelease();
  const productResultReleasePartition = productPartitionFor(release);
  const expectedPlan = buildCandidateReleaseImportPlan({
    release,
    product_result_release_partition: productResultReleasePartition,
  });
  const calls = [];

  const rolledBack = await rollbackInactiveCandidateRelease({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({
          data: rollbackReceiptFor(expectedPlan),
          error: null,
        });
      },
    },
    release,
    productResultReleasePartition,
  });

  assert.equal(rolledBack.plan.schema_version, 'CANDIDATE_RELEASE_IMPORT_PLAN/V7');
  assert.equal(
    rolledBack.plan.candidate_release_import_plan_id,
    expectedPlan.candidate_release_import_plan_id,
  );
  assert.equal(
    rolledBack.plan.expected_counts.product_query_result_serving_records,
    1,
  );
  assert.equal(
    calls[0].params.p_candidate_release_import_plan_id,
    expectedPlan.candidate_release_import_plan_id,
  );
  assert.deepEqual(
    rolledBack.receipt.deleted_counts,
    rollbackReceiptFor(expectedPlan).deleted_counts,
  );
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
  assert.match(sql, /query_projection_contract_digest text/);
  assert.match(sql, /canonical-v2-serving\/v2/);
  assert.match(sql, /048394ed05f7b810b0688e8cc0324f6270196b0c531e50d37fa9ac537efed827/);
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
  assert.match(importer, /CANDIDATE_RELEASE_IMPORT_RECEIPT\/V4/);
  assert.match(importer, /CANDIDATE_RELEASE_IMPORT_RECEIPT\/V6/);
  assert.match(importer, /FIXTURE_CANDIDATE_RELEASE_MANIFEST\/V3/);
  const inputHeadLock = importer.indexOf('FROM canonical_v2_staging.candidate_input_heads current_head');
  const replayLookup = importer.indexOf('FROM canonical_v2_staging.candidate_release_import_receipts receipt');
  const firstReleaseInsert = importer.indexOf('INSERT INTO canonical_v2_staging.fixture_corpus_releases');
  assert.ok(inputHeadLock >= 0 && inputHeadLock < replayLookup && replayLookup < firstReleaseInsert);
  assert.match(importer, /current_head\.singleton_key = 'CURRENT'/);
  assert.match(importer, /current_head\.environment = 'staging'/);
  assert.match(importer, /current_head\.contract_fingerprint = contract_id/);
  assert.match(importer, /FOR SHARE OF current_head/);
  assert.match(importer, /current_input_contract_fingerprint IS DISTINCT FROM contract_id/);
  assert.match(importer, /current_input_head_id IS DISTINCT FROM input_head_id/);
  assert.match(importer, /current_input_head_payload_digest IS DISTINCT FROM input_head_payload_digest/);
  assert.match(importer, /current_discharge_map_id IS DISTINCT FROM discharge_map_id/);
  assert.match(importer, /current_discharge_map_payload_digest IS DISTINCT FROM discharge_map_payload_digest/);
  assert.match(importer, /candidate input authority changed before release import/);
  assert.match(importer, /did not close over every certified serving object[\s\S]*INSERT INTO canonical_v2_staging\.candidate_release_import_receipts/);
  assert.doesNotMatch(importer, /\bLOOP\b/i);
  assert.doesNotMatch(importer, /\bOFFSET\b/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_import_candidate_release\(text, jsonb\)[\s\S]*TO canonical_v2_writer/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_import_candidate_release\(text, jsonb\)\s+TO canonical_v2_serving/);
  assert.doesNotMatch(sql, /GRANT SELECT[\s\S]*TO (anon|authenticated|service_role|canonical_v2_serving|canonical_v2_writer)/);
  assert.doesNotMatch(sql, /GRANT SELECT ON (?:TABLE )?canonical_v2_staging\.candidate_release_semantic_graphs/);

  const rollbackStart = sql.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_rollback_inactive_candidate_release',
  );
  const rollbackEnd = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_activate_candidate_release');
  const rollback = sql.slice(rollbackStart, rollbackEnd);
  assert.ok(rollbackStart >= 0 && rollbackEnd > rollbackStart);
  assert.match(rollback, /SET statement_timeout = '10000ms'/);
  assert.match(rollback, /pg_advisory_xact_lock\(hashtextextended\(p_candidate_manifest_id, 0\)\)/);
  assert.match(rollback, /FOR UPDATE OF receipt/);
  assert.match(rollback, /active or historically active release cannot be removed/);
  assert.match(rollback, /candidate_release_correction_discharges[\s\S]*fixture_corpus_releases/);
  assert.match(rollback, /inactive candidate rollback did not remove the exact certified partition/);
  assert.match(rollback, /inactive candidate rollback changed the active release pointer/);
  assert.doesNotMatch(rollback, /\bLOOP\b/i);
  const rollbackGrantStart = sql.indexOf(
    'REVOKE ALL ON FUNCTION public.canonical_v2_rollback_inactive_candidate_release',
  );
  const rollbackGrantEnd = sql.indexOf(
    'REVOKE ALL ON FUNCTION public.canonical_v2_activate_candidate_release',
  );
  const rollbackGrant = sql.slice(rollbackGrantStart, rollbackGrantEnd);
  assert.match(rollbackGrant, /GRANT EXECUTE[\s\S]*TO canonical_v2_writer/);
  assert.doesNotMatch(rollbackGrant, /TO canonical_v2_serving/);

  const activationStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_activate_candidate_release');
  const activationEnd = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_release');
  const activation = sql.slice(activationStart, activationEnd);
  assert.ok(activationStart >= 0 && activationEnd > activationStart);
  assert.match(activation, /pg_advisory_xact_lock/);
  assert.match(activation, /active release pointer changed before compare-and-swap/);
  assert.match(activation, /receipt\.import_state = 'IMPORTED_COMPLETE'/);
  assert.match(activation, /active release pointer does not match the imported correction seal/);
  const activationReceiptLookup = activation.indexOf(
    'FROM canonical_v2_staging.candidate_release_import_receipts receipt',
  );
  const activationHeadLock = activation.indexOf(
    'FROM canonical_v2_staging.candidate_input_heads current_head',
  );
  const activationHistoryInsert = activation.indexOf(
    'INSERT INTO canonical_v2_staging.active_corpus_release_pointer_history',
  );
  assert.ok(
    activationReceiptLookup >= 0
      && activationReceiptLookup < activationHeadLock
      && activationHeadLock < activationHistoryInsert,
  );
  assert.match(activation, /current_head\.singleton_key = 'CURRENT'/);
  assert.match(activation, /current_head\.environment = 'staging'/);
  assert.match(activation, /current_head\.contract_fingerprint = imported_input_contract_fingerprint/);
  assert.match(activation, /FOR SHARE OF current_head/);
  assert.match(activation, /current_input_contract_fingerprint IS DISTINCT FROM imported_input_contract_fingerprint/);
  assert.match(activation, /current_input_head_id IS DISTINCT FROM imported_input_head_id/);
  assert.match(activation, /current_input_head_payload_digest IS DISTINCT FROM imported_input_head_payload_digest/);
  assert.match(activation, /current_discharge_map_id IS DISTINCT FROM imported_discharge_map_id/);
  assert.match(activation, /current_discharge_map_payload_digest IS DISTINCT FROM imported_discharge_map_payload_digest/);
  assert.match(activation, /candidate input authority changed before active release activation/);
  assert.match(activation, /FIXTURE_ACTIVE_RELEASE_POINTER\/V2/);
  assert.match(activation, /candidate release has no complete import receipt/);
  assert.match(activation, /INSERT INTO canonical_v2_staging\.active_corpus_release_pointer_history[\s\S]*INSERT INTO canonical_v2_staging\.active_corpus_release_pointers/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_activate_candidate_release\(text, jsonb, jsonb\)[\s\S]*TO canonical_v2_writer/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_active_release\(text\)[\s\S]*TO canonical_v2_serving/);
});

test('import checkpoint exact replay is a no-op and conflicting replay fails closed', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const functionStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_import_candidate_release');
  const functionEnd = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_market_cohort');
  const importer = sql.slice(functionStart, functionEnd);

  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  assert.match(
    importer,
    /FROM canonical_v2_staging\.candidate_release_import_receipts receipt[\s\S]*WHERE receipt\.candidate_manifest_id = manifest_id/,
  );
  assert.match(
    importer,
    /IF existing_plan_id IS NOT NULL THEN[\s\S]*'replayed', true[\s\S]*RETURN jsonb_build_object/,
  );
  assert.match(
    importer,
    /candidate manifest already imported under different content/,
  );
  assert.match(
    importer,
    /import_plan_id IS DISTINCT FROM canonical_v2_staging\.content_id\([\s\S]*p_import_plan - 'candidate_release_import_plan_id'/,
  );

  const planIdentityCheck = importer.indexOf(
    'import_plan_id IS DISTINCT FROM canonical_v2_staging.content_id(',
  );
  const replayCheck = importer.indexOf('IF existing_plan_id IS NOT NULL THEN');
  const firstReleaseInsert = importer.indexOf(
    'INSERT INTO canonical_v2_staging.fixture_corpus_releases',
  );
  assert.ok(
    planIdentityCheck >= 0
      && planIdentityCheck < replayCheck
      && replayCheck < firstReleaseInsert,
  );
});
