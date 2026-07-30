const assert = require('node:assert/strict');
const fixture = require(
  '../__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
);
const test = require('node:test');

const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProductQueryResultServingRecord,
} = require('../lib/canonical-v2/product-query-result-serving-record');
const {
  PRODUCT_CANDIDATE_RELEASE_BUNDLE_SCHEMA,
  buildProductCandidateReleaseManifest,
  buildProductQueryResultReleasePartition,
  validateProductCandidateReleaseBundle,
} = require(
  '../lib/canonical-v2/product-query-result-release-partition',
);

function manifest() {
  return buildProductCandidateReleaseManifest({
    serving_namespace_id: '1'.repeat(64),
    corpus_release_id: '2'.repeat(64),
    canonical_contract_bundle_id: '3'.repeat(64),
    canonical_contract_bundle_digest: '4'.repeat(64),
    release_basis_id: '5'.repeat(64),
    release_basis_payload_digest: '6'.repeat(64),
  });
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
    PRODUCT_CANDIDATE_RELEASE_BUNDLE_SCHEMA,
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
