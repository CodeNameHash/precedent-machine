const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  QXO_MATERIAL_REVIEWED_MAPPING_ID,
  QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
  QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
  PRIOR_QXO_SEMANTIC_CLOSURE_IDS,
} = require('./qxo-material-candidate-identity');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('./serving-projection-contract');

const SHA256_RE = /^[a-f0-9]{64}$/;
const QXO_REVERSE_F3_CONTRACT_FINGERPRINT =
  '5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c';
const QXO_REVERSE_F4_CONTRACT_FINGERPRINT =
  'd4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74';
const QXO_DENOMINATOR_PRECISION_F5_CONTRACT_FINGERPRINT =
  'f80a77651d1b6a6a9eec8ac67526a8704f498761cbb22a67e6ceb4716abb5478';
const QXO_REVERSE_F4_CORPUS_RELEASE_ID =
  '0123651d12399ee8efbd6835c107a8632642a78527b253ac5a5378b70265ea76';
const QXO_REVERSE_F4_CANDIDATE_MANIFEST_ID =
  '9f17f11afe08e87bca51d656efef3411308aa50ebf1a387dad286368e7584551';
const QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID =
  '004382fdbcea63076347a2f11c1f7f227626376789cd222e77cd36cc7344edf3';
const QXO_SELLER_TERMINATION_REVIEWED_MAPPING_ID =
  '9c3501f89e0574d94821241915748292c0c345b980d0c90ba2986cff21606a4a';
const QXO_SELLER_TERMINATION_SEMANTIC_CLOSURE_ID =
  '6e59b62130b2c0bac205251bf936c7aaca55b84ed9251971a1528870b17672a2';
const QXO_RICH_DEAL_DIMENSIONS = Object.freeze({
  sector: 'Building products',
  buyer: 'QXO',
  merger_form: 'Reverse triangular merger',
  adviser_firms: Object.freeze(['Jones Day', 'Paul Weiss']),
  lawyers: Object.freeze(['Robert Profusek', 'Scott Barshay']),
  announce_year: 2026,
  deal_value_usd: '17000000000',
});
const QXO_RICH_DEAL_DIMENSIONS_DIGEST = contentId(
  'QXO_RICH_DEAL_DIMENSION_PROFILE/V1',
  QXO_RICH_DEAL_DIMENSIONS,
);
const QXO_REVERSE_PRIOR_SEMANTIC_CLOSURE_IDS = Object.freeze([
  ...PRIOR_QXO_SEMANTIC_CLOSURE_IDS,
  QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
  QXO_SELLER_TERMINATION_SEMANTIC_CLOSURE_ID,
].sort());
const QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS = Object.freeze([
  ...QXO_REVERSE_PRIOR_SEMANTIC_CLOSURE_IDS,
  QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
].sort());

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    throw new TypeError(`${label} must be a SHA-256 content ID.`);
  }
}

function buildQxoReverseCombinedCandidateSeed({
  contractFingerprint,
  materialReviewedMappingId,
  sellerTerminationReviewedMappingId,
  reverseTerminationReviewedMappingId,
  dealDimensions = QXO_RICH_DEAL_DIMENSIONS,
  servingProjectionVersion,
  queryProjectionContractDigest,
} = {}) {
  requireDigest(contractFingerprint, 'contractFingerprint');
  requireDigest(materialReviewedMappingId, 'materialReviewedMappingId');
  requireDigest(sellerTerminationReviewedMappingId, 'sellerTerminationReviewedMappingId');
  requireDigest(reverseTerminationReviewedMappingId, 'reverseTerminationReviewedMappingId');
  requireDigest(queryProjectionContractDigest, 'queryProjectionContractDigest');
  if (contractFingerprint !== QXO_REVERSE_F3_CONTRACT_FINGERPRINT) {
    throw new TypeError('The reverse-fee candidate is bound to the F3 versioned contract.');
  }
  if (materialReviewedMappingId !== QXO_MATERIAL_REVIEWED_MAPPING_ID
    || sellerTerminationReviewedMappingId !== QXO_SELLER_TERMINATION_REVIEWED_MAPPING_ID) {
    throw new TypeError('The reverse-fee candidate must retain the reviewed F2 family mappings.');
  }
  if (servingProjectionVersion !== SERVING_PROJECTION_VERSION_V2
    || queryProjectionContractDigest !== QUERY_PROJECTION_CONTRACT_DIGEST_V2) {
    throw new TypeError('The reverse-fee candidate requires the frozen v2 serving contract.');
  }
  if (canonicalJson(dealDimensions) !== canonicalJson(QXO_RICH_DEAL_DIMENSIONS)) {
    throw new TypeError('The reverse-fee candidate requires the reviewed rich QXO deal dimensions.');
  }
  return Object.freeze({
    schema_version: 'QXO_REVERSE_F3_COMBINED_CANDIDATE_SEED/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    contract_fingerprint: contractFingerprint,
    source_admission_manifest_ids: QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
    prior_semantic_closure_ids: QXO_REVERSE_PRIOR_SEMANTIC_CLOSURE_IDS,
    material_reviewed_mapping_id: materialReviewedMappingId,
    seller_termination_reviewed_mapping_id: sellerTerminationReviewedMappingId,
    reverse_termination_reviewed_mapping_id: reverseTerminationReviewedMappingId,
    deal_dimension_profile_digest: QXO_RICH_DEAL_DIMENSIONS_DIGEST,
    serving_projection_version: servingProjectionVersion,
    query_projection_contract_digest: queryProjectionContractDigest,
    release_purpose: 'INACTIVE_CANONICAL_RESULT_CANDIDATE_ONLY',
  });
}

function qxoReverseCombinedCandidateReleaseId(seed) {
  return contentId('CORPUS_RELEASE/V1', seed);
}

function qxoReverseCombinedServingNamespaceId(seed) {
  return contentId('SERVING_NAMESPACE/V2', {
    schema_version: 'QXO_REVERSE_F3_COMBINED_SERVING_NAMESPACE/V1',
    governed_deal_key: seed.governed_deal_key,
    corpus_release_id: qxoReverseCombinedCandidateReleaseId(seed),
    candidate_seed_digest: contentId('QXO_REVERSE_F3_COMBINED_CANDIDATE_SEED/V1', seed),
    deal_dimension_profile_digest: seed.deal_dimension_profile_digest,
    serving_projection_version: seed.serving_projection_version,
    query_projection_contract_digest: seed.query_projection_contract_digest,
  });
}

function buildQxoReverseF4CombinedCandidateSeed({
  contractFingerprint,
  materialReviewedMappingId,
  sellerTerminationReviewedMappingId,
  reverseTerminationReviewedMappingId,
  dealDimensions = QXO_RICH_DEAL_DIMENSIONS,
  servingProjectionVersion,
  queryProjectionContractDigest,
} = {}) {
  for (const [value, label] of [
    [contractFingerprint, 'contractFingerprint'],
    [materialReviewedMappingId, 'materialReviewedMappingId'],
    [sellerTerminationReviewedMappingId, 'sellerTerminationReviewedMappingId'],
    [reverseTerminationReviewedMappingId, 'reverseTerminationReviewedMappingId'],
    [queryProjectionContractDigest, 'queryProjectionContractDigest'],
  ]) requireDigest(value, label);
  if (contractFingerprint !== QXO_REVERSE_F4_CONTRACT_FINGERPRINT) {
    throw new TypeError('The corrected reverse-fee candidate is bound to the F4 versioned contract.');
  }
  if (materialReviewedMappingId !== QXO_MATERIAL_REVIEWED_MAPPING_ID) {
    throw new TypeError('The corrected reverse-fee candidate must retain the reviewed material-contract mapping.');
  }
  if (servingProjectionVersion !== SERVING_PROJECTION_VERSION_V2
    || queryProjectionContractDigest !== QUERY_PROJECTION_CONTRACT_DIGEST_V2) {
    throw new TypeError('The corrected reverse-fee candidate requires the frozen v2 serving contract.');
  }
  if (canonicalJson(dealDimensions) !== canonicalJson(QXO_RICH_DEAL_DIMENSIONS)) {
    throw new TypeError('The corrected reverse-fee candidate requires the reviewed rich QXO dimensions.');
  }
  return Object.freeze({
    schema_version: 'QXO_REVERSE_F4_COMBINED_CANDIDATE_SEED/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    contract_fingerprint: contractFingerprint,
    predecessor_contract_fingerprint: QXO_REVERSE_F3_CONTRACT_FINGERPRINT,
    rejected_predecessor_semantic_closure_id:
      QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
    source_admission_manifest_ids: QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
    prior_semantic_closure_ids: QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS,
    material_reviewed_mapping_id: materialReviewedMappingId,
    seller_termination_reviewed_mapping_id: sellerTerminationReviewedMappingId,
    reverse_termination_reviewed_mapping_id: reverseTerminationReviewedMappingId,
    deal_dimension_profile_digest: QXO_RICH_DEAL_DIMENSIONS_DIGEST,
    serving_projection_version: servingProjectionVersion,
    query_projection_contract_digest: queryProjectionContractDigest,
    release_purpose: 'INACTIVE_CORRECTED_CANONICAL_RESULT_CANDIDATE_ONLY',
  });
}

function qxoReverseF4CombinedCandidateReleaseId(seed) {
  return contentId('CORPUS_RELEASE/V1', seed);
}

function qxoReverseF4CombinedServingNamespaceId(seed) {
  return contentId('SERVING_NAMESPACE/V2', {
    schema_version: 'QXO_REVERSE_F4_COMBINED_SERVING_NAMESPACE/V1',
    governed_deal_key: seed.governed_deal_key,
    corpus_release_id: qxoReverseF4CombinedCandidateReleaseId(seed),
    candidate_seed_digest: contentId('QXO_REVERSE_F4_COMBINED_CANDIDATE_SEED/V1', seed),
    deal_dimension_profile_digest: seed.deal_dimension_profile_digest,
    serving_projection_version: seed.serving_projection_version,
    query_projection_contract_digest: seed.query_projection_contract_digest,
  });
}

function buildQxoDenominatorPrecisionF5CandidateSeed({
  contractFingerprint,
  materialReviewedMappingId,
  sellerTerminationReviewedMappingId,
  reverseTerminationReviewedMappingId,
  dealDimensions = QXO_RICH_DEAL_DIMENSIONS,
  servingProjectionVersion,
  queryProjectionContractDigest,
} = {}) {
  for (const [value, label] of [
    [contractFingerprint, 'contractFingerprint'],
    [materialReviewedMappingId, 'materialReviewedMappingId'],
    [sellerTerminationReviewedMappingId, 'sellerTerminationReviewedMappingId'],
    [reverseTerminationReviewedMappingId, 'reverseTerminationReviewedMappingId'],
    [queryProjectionContractDigest, 'queryProjectionContractDigest'],
  ]) requireDigest(value, label);
  if (contractFingerprint !== QXO_DENOMINATOR_PRECISION_F5_CONTRACT_FINGERPRINT) {
    throw new TypeError('The denominator-precision candidate is bound to the F5 versioned contract.');
  }
  if (materialReviewedMappingId !== QXO_MATERIAL_REVIEWED_MAPPING_ID) {
    throw new TypeError('The denominator-precision candidate must retain the reviewed material-contract mapping.');
  }
  if (servingProjectionVersion !== SERVING_PROJECTION_VERSION_V2
    || queryProjectionContractDigest !== QUERY_PROJECTION_CONTRACT_DIGEST_V2) {
    throw new TypeError('The denominator-precision candidate requires the frozen v2 serving contract.');
  }
  if (canonicalJson(dealDimensions) !== canonicalJson(QXO_RICH_DEAL_DIMENSIONS)) {
    throw new TypeError('The denominator-precision candidate requires the reviewed rich QXO dimensions.');
  }
  return Object.freeze({
    schema_version: 'QXO_DENOMINATOR_PRECISION_F5_CANDIDATE_SEED/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    contract_fingerprint: contractFingerprint,
    predecessor_contract_fingerprint: QXO_REVERSE_F4_CONTRACT_FINGERPRINT,
    predecessor_corpus_release_id: QXO_REVERSE_F4_CORPUS_RELEASE_ID,
    predecessor_candidate_manifest_id: QXO_REVERSE_F4_CANDIDATE_MANIFEST_ID,
    source_admission_manifest_ids: QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
    material_reviewed_mapping_id: materialReviewedMappingId,
    seller_termination_reviewed_mapping_id: sellerTerminationReviewedMappingId,
    reverse_termination_reviewed_mapping_id: reverseTerminationReviewedMappingId,
    deal_dimension_profile_digest: QXO_RICH_DEAL_DIMENSIONS_DIGEST,
    serving_projection_version: servingProjectionVersion,
    query_projection_contract_digest: queryProjectionContractDigest,
    release_purpose: 'INACTIVE_DENOMINATOR_PRECISION_CANDIDATE_ONLY',
  });
}

function qxoDenominatorPrecisionF5CandidateReleaseId(seed) {
  return contentId('CORPUS_RELEASE/V1', seed);
}

function qxoDenominatorPrecisionF5ServingNamespaceId(seed) {
  return contentId('SERVING_NAMESPACE/V2', {
    schema_version: 'QXO_DENOMINATOR_PRECISION_F5_SERVING_NAMESPACE/V1',
    governed_deal_key: seed.governed_deal_key,
    corpus_release_id: qxoDenominatorPrecisionF5CandidateReleaseId(seed),
    candidate_seed_digest: contentId(
      'QXO_DENOMINATOR_PRECISION_F5_CANDIDATE_SEED/V1',
      seed,
    ),
    deal_dimension_profile_digest: seed.deal_dimension_profile_digest,
    serving_projection_version: seed.serving_projection_version,
    query_projection_contract_digest: seed.query_projection_contract_digest,
  });
}

module.exports = {
  QXO_DENOMINATOR_PRECISION_F5_CONTRACT_FINGERPRINT,
  QXO_REVERSE_F3_CONTRACT_FINGERPRINT,
  QXO_REVERSE_F4_CONTRACT_FINGERPRINT,
  QXO_REVERSE_F4_CORPUS_RELEASE_ID,
  QXO_REVERSE_F4_CANDIDATE_MANIFEST_ID,
  QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
  QXO_REVERSE_PRIOR_SEMANTIC_CLOSURE_IDS,
  QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS,
  QXO_RICH_DEAL_DIMENSIONS,
  QXO_RICH_DEAL_DIMENSIONS_DIGEST,
  QXO_SELLER_TERMINATION_REVIEWED_MAPPING_ID,
  QXO_SELLER_TERMINATION_SEMANTIC_CLOSURE_ID,
  buildQxoReverseCombinedCandidateSeed,
  buildQxoReverseF4CombinedCandidateSeed,
  buildQxoDenominatorPrecisionF5CandidateSeed,
  qxoDenominatorPrecisionF5CandidateReleaseId,
  qxoDenominatorPrecisionF5ServingNamespaceId,
  qxoReverseCombinedCandidateReleaseId,
  qxoReverseCombinedServingNamespaceId,
  qxoReverseF4CombinedCandidateReleaseId,
  qxoReverseF4CombinedServingNamespaceId,
};
