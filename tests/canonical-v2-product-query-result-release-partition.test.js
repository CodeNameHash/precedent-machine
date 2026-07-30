const assert = require('node:assert/strict');
const fixture = require(
  '../__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
);
const test = require('node:test');

const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');
const {
  buildProductQueryResultServingRecord,
} = require('../lib/canonical-v2/product-query-result-serving-record');
const {
  PRODUCT_QUERY_RESULT_RELEASE_PARTITION_BUNDLE_SCHEMA,
  buildProductQueryResultReleasePartition,
  validateProductCandidateReleaseBundle,
} = require(
  '../lib/canonical-v2/product-query-result-release-partition',
);

function manifest() {
  const roots = {
    deal_directory_root: '0'.repeat(64),
    observation_root: '1'.repeat(64),
    exclusion_root: '2'.repeat(64),
    shared_row_root: '3'.repeat(64),
    incomplete_canonical_row_root: '4'.repeat(64),
    source_specific_row_root: '5'.repeat(64),
    source_specific_serving_projection_root: '6'.repeat(64),
    exact_detail_root: '7'.repeat(64),
    query_projection_root: '8'.repeat(64),
    validated_semantic_graph_root: '9'.repeat(64),
    correction_input_root: 'a'.repeat(64),
  };
  const body = {
    schema_version: 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3',
    release_state: 'CERTIFIED_OFFLINE_FIXTURE',
    contract_fingerprint: 'b'.repeat(64),
    serving_namespace_id: 'c'.repeat(64),
    corpus_release_id: 'd'.repeat(64),
    serving_projection_version: SERVING_PROJECTION_VERSION_V2,
    query_projection_contract_digest:
      QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    correction_input_seal_id: 'e'.repeat(64),
    deal_keys: ['METSERA'],
    counts: {
      deals: 1,
      deal_directory_records: 1,
      metric_slots: 1,
      observations: 1,
      exclusions: 0,
      shared_rows: 1,
      incomplete_canonical_rows: 0,
      source_specific_rows: 0,
      source_specific_serving_records: 0,
      exact_detail_packages: 1,
      query_records: 1,
      validated_semantic_graphs: 0,
      correction_applications: 0,
      correction_discharges: 0,
      unresolved: 0,
      failed: 0,
      duplicates: 0,
    },
    roots,
  };
  return {
    ...body,
    candidate_release_manifest_id: contentId(
      'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3',
      body,
    ),
    canonical_payload_digest: contentId(
      'FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V3',
      body,
    ),
  };
}

function rebindResult(release) {
  const result = structuredClone(fixture.shared_result);
  result.candidate_release_manifest_id =
    release.candidate_release_manifest_id;
  result.candidate_release_manifest_payload_digest =
    release.canonical_payload_digest;
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

function servingRecord(release, candidateId = '7'.repeat(64)) {
  return buildProductQueryResultServingRecord({
    serving_namespace_id: release.serving_namespace_id,
    corpus_release_id: release.corpus_release_id,
    candidate_product_result_id: candidateId,
    candidate_product_result_payload_digest: '8'.repeat(64),
    product_query_result: rebindResult(release),
  });
}

test('builds one acyclic Product result partition over its base release', () => {
  const release = manifest();
  const record = servingRecord(release);
  const bundle = buildProductQueryResultReleasePartition({
    candidate_release_manifest: release,
    product_query_result_serving_records: [record],
  });

  assert.equal(
    bundle.schema_version,
    PRODUCT_QUERY_RESULT_RELEASE_PARTITION_BUNDLE_SCHEMA,
  );
  assert.equal(
    bundle.product_query_result_release_partition_manifest
      .candidate_release_manifest_id,
    release.candidate_release_manifest_id,
  );
  assert.equal(
    bundle.product_query_result_release_partition_manifest
      .product_query_result_record_count,
    1,
  );
  assert.equal(validateProductCandidateReleaseBundle(bundle), true);
});

test('rejects duplicate, release and record-content drift', () => {
  const release = manifest();
  const record = servingRecord(release, '9'.repeat(64));
  const rebound = structuredClone(record);
  rebound.canonical_payload = {
    ...rebound.canonical_payload,
    domain_result_identity: 'b'.repeat(64),
  };
  assert.throws(
    () => buildProductQueryResultReleasePartition({
      candidate_release_manifest: release,
      product_query_result_serving_records: [rebound],
    }),
    /changed|invalid/i,
  );

  const bundle = buildProductQueryResultReleasePartition({
    candidate_release_manifest: release,
    product_query_result_serving_records: [record],
  });
  assert.throws(
    () => buildProductQueryResultReleasePartition({
      candidate_release_manifest: release,
      product_query_result_serving_records: [record, record],
    }),
    /duplicates/,
  );
  assert.equal(validateProductCandidateReleaseBundle(bundle), true);

  const crossRelease = structuredClone(servingRecord(release));
  crossRelease.corpus_release_id = 'c'.repeat(64);
  assert.throws(
    () => buildProductQueryResultReleasePartition({
      candidate_release_manifest: release,
      product_query_result_serving_records: [crossRelease],
    }),
    /changed|outside/i,
  );
});
