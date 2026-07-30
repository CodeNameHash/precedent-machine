const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  PRODUCT_QUERY_RESULT_SERVING_RECORD_SCHEMA,
  validateProductQueryResultServingRecord,
} = require('./product-query-result-serving-record');

const PRODUCT_CANDIDATE_RELEASE_MANIFEST_SCHEMA =
  'PRODUCT_CANDIDATE_RELEASE_MANIFEST/V1';
const PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST_SCHEMA =
  'PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST/V1';
const PRODUCT_CANDIDATE_RELEASE_BUNDLE_SCHEMA =
  'PRODUCT_CANDIDATE_RELEASE_BUNDLE/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_PRODUCT_RESULTS = 5000;

class ProductQueryResultReleasePartitionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProductQueryResultReleasePartitionError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProductQueryResultReleasePartitionError(code, message);
}

function exactKeys(value, expected, label) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) {
    fail('INVALID_PRODUCT_RELEASE_PARTITION', `${label} has an open or incomplete shape.`);
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_PRODUCT_RELEASE_PARTITION', `${label} must be a full SHA-256 digest.`);
  }
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function buildProductCandidateReleaseManifest({
  serving_namespace_id: servingNamespaceId,
  corpus_release_id: corpusReleaseId,
  canonical_contract_bundle_id: contractBundleId,
  canonical_contract_bundle_digest: contractBundleDigest,
  release_basis_id: releaseBasisId,
  release_basis_payload_digest: releaseBasisPayloadDigest,
} = {}) {
  [
    ['serving_namespace_id', servingNamespaceId],
    ['corpus_release_id', corpusReleaseId],
    ['canonical_contract_bundle_id', contractBundleId],
    ['canonical_contract_bundle_digest', contractBundleDigest],
    ['release_basis_id', releaseBasisId],
    ['release_basis_payload_digest', releaseBasisPayloadDigest],
  ].forEach(([label, value]) => requireDigest(value, label));
  const body = {
    schema_version: PRODUCT_CANDIDATE_RELEASE_MANIFEST_SCHEMA,
    release_state: 'CANDIDATE_NOT_ACTIVE',
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    canonical_contract_bundle_id: contractBundleId,
    canonical_contract_bundle_digest: contractBundleDigest,
    release_basis_id: releaseBasisId,
    release_basis_payload_digest: releaseBasisPayloadDigest,
    authority_state: 'NOT_GRANTED',
  };
  return Object.freeze({
    ...body,
    candidate_release_manifest_id: contentId(
      PRODUCT_CANDIDATE_RELEASE_MANIFEST_SCHEMA,
      body,
    ),
    canonical_payload_digest: contentId(
      'PRODUCT_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
      body,
    ),
  });
}

function validateProductCandidateReleaseManifest(value) {
  exactKeys(value, [
    'schema_version',
    'release_state',
    'serving_namespace_id',
    'corpus_release_id',
    'canonical_contract_bundle_id',
    'canonical_contract_bundle_digest',
    'release_basis_id',
    'release_basis_payload_digest',
    'authority_state',
    'candidate_release_manifest_id',
    'canonical_payload_digest',
  ], 'Product candidate release manifest');
  const rebuilt = buildProductCandidateReleaseManifest(value);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(
      'INVALID_PRODUCT_RELEASE_PARTITION',
      'The Product candidate release manifest identity or authority changed.',
    );
  }
  return true;
}

function servingRecordInput(record) {
  return {
    serving_namespace_id: record.serving_namespace_id,
    corpus_release_id: record.corpus_release_id,
    candidate_product_result_id: record.candidate_product_result_id,
    candidate_product_result_payload_digest:
      record.candidate_product_result_payload_digest,
    product_query_result: record.canonical_payload,
  };
}

function releaseEntry(record) {
  return {
    product_query_result_serving_record_id:
      record.product_query_result_serving_record_id,
    product_query_definition_id: record.product_query_definition_id,
    product_query_result_identity:
      record.product_query_result_identity,
    domain_key: record.domain_key,
    candidate_product_result_id: record.candidate_product_result_id,
    candidate_product_result_payload_digest:
      record.candidate_product_result_payload_digest,
    canonical_payload_digest: record.canonical_payload_digest,
  };
}

function buildProductQueryResultReleasePartition({
  candidate_release_manifest: candidateManifest,
  product_query_result_serving_records: inputRecords,
} = {}) {
  validateProductCandidateReleaseManifest(candidateManifest);
  if (
    !Array.isArray(inputRecords)
    || inputRecords.length < 1
    || inputRecords.length > MAX_PRODUCT_RESULTS
  ) {
    fail(
      'INVALID_PRODUCT_RELEASE_PARTITION',
      `Product result records must contain between 1 and ${MAX_PRODUCT_RESULTS} members.`,
    );
  }
  inputRecords.forEach((record) => {
    if (record?.schema_version !== PRODUCT_QUERY_RESULT_SERVING_RECORD_SCHEMA) {
      fail('INVALID_PRODUCT_RELEASE_PARTITION', 'A Product result record has an invalid schema.');
    }
    validateProductQueryResultServingRecord(record, servingRecordInput(record));
    if (
      record.serving_namespace_id !== candidateManifest.serving_namespace_id
      || record.corpus_release_id !== candidateManifest.corpus_release_id
      || record.candidate_release_manifest_id
        !== candidateManifest.candidate_release_manifest_id
      || record.candidate_release_manifest_payload_digest
        !== candidateManifest.canonical_payload_digest
    ) {
      fail(
        'INVALID_PRODUCT_RELEASE_PARTITION',
        'A Product result record is outside the candidate release.',
      );
    }
  });
  const records = [...inputRecords].sort((left, right) => (
    left.product_query_result_identity.localeCompare(
      right.product_query_result_identity,
    )
  ));
  if (
    new Set(records.map((record) => record.product_query_result_identity)).size
      !== records.length
    || new Set(records.map(
      (record) => record.product_query_result_serving_record_id,
    )).size !== records.length
  ) {
    fail('INVALID_PRODUCT_RELEASE_PARTITION', 'Product result records contain duplicates.');
  }
  const orderedEntries = records.map(releaseEntry);
  const body = {
    schema_version:
      PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST_SCHEMA,
    release_state: 'CANDIDATE_NOT_ACTIVE',
    serving_namespace_id: candidateManifest.serving_namespace_id,
    corpus_release_id: candidateManifest.corpus_release_id,
    candidate_release_manifest_id:
      candidateManifest.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      candidateManifest.canonical_payload_digest,
    product_query_result_record_count: records.length,
    product_query_result_record_root: contentId(
      'PRODUCT_QUERY_RESULT_SERVING_RECORD_SET/V1',
      orderedEntries,
    ),
    ordered_record_entries: orderedEntries,
    authority_state: 'NOT_GRANTED',
  };
  const partitionManifest = Object.freeze({
    ...body,
    product_query_result_release_partition_manifest_id: contentId(
      PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST_SCHEMA,
      body,
    ),
    canonical_payload_digest: contentId(
      'PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST_PAYLOAD/V1',
      body,
    ),
  });
  const bundle = Object.freeze({
    schema_version: PRODUCT_CANDIDATE_RELEASE_BUNDLE_SCHEMA,
    candidate_release_manifest: Object.freeze(clone(candidateManifest)),
    product_query_result_release_partition_manifest:
      partitionManifest,
    product_query_result_serving_records:
      Object.freeze(records.map((record) => Object.freeze(clone(record)))),
  });
  validateProductCandidateReleaseBundle(bundle);
  return bundle;
}

function validateProductCandidateReleaseBundle(value) {
  exactKeys(value, [
    'schema_version',
    'candidate_release_manifest',
    'product_query_result_release_partition_manifest',
    'product_query_result_serving_records',
  ], 'Product candidate release bundle');
  if (value.schema_version !== PRODUCT_CANDIDATE_RELEASE_BUNDLE_SCHEMA) {
    fail('INVALID_PRODUCT_RELEASE_PARTITION', 'The Product release bundle schema is invalid.');
  }
  const rebuilt = buildProductQueryResultReleasePartitionUnchecked({
    candidateManifest: value.candidate_release_manifest,
    records: value.product_query_result_serving_records,
  });
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('INVALID_PRODUCT_RELEASE_PARTITION', 'The Product release bundle changed.');
  }
  return true;
}

function buildProductQueryResultReleasePartitionUnchecked({
  candidateManifest,
  records,
}) {
  validateProductCandidateReleaseManifest(candidateManifest);
  if (
    !Array.isArray(records)
    || records.length < 1
    || records.length > MAX_PRODUCT_RESULTS
  ) {
    fail('INVALID_PRODUCT_RELEASE_PARTITION', 'The Product result record set is invalid.');
  }
  records.forEach((record) => {
    validateProductQueryResultServingRecord(record, servingRecordInput(record));
    if (
      record.serving_namespace_id !== candidateManifest.serving_namespace_id
      || record.corpus_release_id !== candidateManifest.corpus_release_id
      || record.candidate_release_manifest_id
        !== candidateManifest.candidate_release_manifest_id
      || record.candidate_release_manifest_payload_digest
        !== candidateManifest.canonical_payload_digest
    ) {
      fail(
        'INVALID_PRODUCT_RELEASE_PARTITION',
        'A Product result record is outside the candidate release.',
      );
    }
  });
  if (
    canonicalJson(records.map(
      (record) => record.product_query_result_identity,
    )) !== canonicalJson([...records].map(
      (record) => record.product_query_result_identity,
    ).sort())
    || new Set(records.map(
      (record) => record.product_query_result_identity,
    )).size !== records.length
    || new Set(records.map(
      (record) => record.product_query_result_serving_record_id,
    )).size !== records.length
  ) {
    fail(
      'INVALID_PRODUCT_RELEASE_PARTITION',
      'The Product result record set is reordered or duplicated.',
    );
  }
  const orderedEntries = records.map(releaseEntry);
  const body = {
    schema_version:
      PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST_SCHEMA,
    release_state: 'CANDIDATE_NOT_ACTIVE',
    serving_namespace_id: candidateManifest.serving_namespace_id,
    corpus_release_id: candidateManifest.corpus_release_id,
    candidate_release_manifest_id:
      candidateManifest.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      candidateManifest.canonical_payload_digest,
    product_query_result_record_count: records.length,
    product_query_result_record_root: contentId(
      'PRODUCT_QUERY_RESULT_SERVING_RECORD_SET/V1',
      orderedEntries,
    ),
    ordered_record_entries: orderedEntries,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: PRODUCT_CANDIDATE_RELEASE_BUNDLE_SCHEMA,
    candidate_release_manifest: clone(candidateManifest),
    product_query_result_release_partition_manifest: {
      ...body,
      product_query_result_release_partition_manifest_id: contentId(
        PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST_SCHEMA,
        body,
      ),
      canonical_payload_digest: contentId(
        'PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST_PAYLOAD/V1',
        body,
      ),
    },
    product_query_result_serving_records: records.map(clone),
  };
}

module.exports = {
  MAX_PRODUCT_RESULTS,
  PRODUCT_CANDIDATE_RELEASE_BUNDLE_SCHEMA,
  PRODUCT_CANDIDATE_RELEASE_MANIFEST_SCHEMA,
  PRODUCT_QUERY_RESULT_RELEASE_PARTITION_MANIFEST_SCHEMA,
  ProductQueryResultReleasePartitionError,
  buildProductCandidateReleaseManifest,
  buildProductQueryResultReleasePartition,
  validateProductCandidateReleaseBundle,
  validateProductCandidateReleaseManifest,
};
