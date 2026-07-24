const { contentId } = require('./canonical-bytes');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('./serving-projection-contract');

const QXO_MATERIAL_CONTRACT_FINGERPRINT = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const QXO_MATERIAL_REVIEWED_MAPPING_ID = 'df48098d46c76258c3a04c7eab21305395c94eb8dd12a014bf9a4d64f712dfc1';
const QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS = Object.freeze([
  'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819',
  '8f34cf68078f669f9abac88ce5d5ac5cd1c331803beead14c55ec72a5bb3398c',
]);
const PRIOR_QXO_SEMANTIC_CLOSURE_IDS = Object.freeze([
  'cbb678180ec9951f12741a77a58f7ec03a6bebffbdc6e5d9fbea6add9beea596',
  '944c18cb24c5684c04eb3d2c9cae57f932c144790492bc1619ccd566d57a8a3e',
  '89683e5ff72a570948bfadda123254719d848310b5c50ad3720645e2cbd6291b',
  'dd232aa8077fd0d4158cd19c7fa5e8b439fceb8d97b578682c41936889808af8',
].sort());

function buildQxoMaterialCombinedCandidateSeed({
  contractFingerprint,
  materialReviewedMappingId,
} = {}) {
  if (!/^[a-f0-9]{64}$/.test(contractFingerprint || '')
    || !/^[a-f0-9]{64}$/.test(materialReviewedMappingId || '')) {
    throw new TypeError('The combined candidate seed requires fixed contract and material-review identities.');
  }
  return Object.freeze({
    schema_version: 'QXO_MATERIAL_COMBINED_CANDIDATE_SEED/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    contract_fingerprint: contractFingerprint,
    source_admission_manifest_ids: QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
    prior_semantic_closure_ids: PRIOR_QXO_SEMANTIC_CLOSURE_IDS,
    material_reviewed_mapping_id: materialReviewedMappingId,
    release_purpose: 'INCOMPLETE_CANONICAL_RESULT_CANDIDATE_ONLY',
  });
}

function qxoMaterialCombinedCandidateReleaseId(seed) {
  return contentId('CORPUS_RELEASE/V1', seed);
}

function buildQxoMaterialCombinedCandidateSeedV2({
  contractFingerprint,
  materialReviewedMappingId,
  servingProjectionVersion,
  queryProjectionContractDigest,
} = {}) {
  if (!/^[a-f0-9]{64}$/.test(contractFingerprint || '')
    || !/^[a-f0-9]{64}$/.test(materialReviewedMappingId || '')
    || !/^[a-f0-9]{64}$/.test(queryProjectionContractDigest || '')
    || servingProjectionVersion !== SERVING_PROJECTION_VERSION_V2) {
    throw new TypeError('The v2 combined candidate seed requires fixed legal and serving identities.');
  }
  return Object.freeze({
    schema_version: 'QXO_MATERIAL_COMBINED_CANDIDATE_SEED/V2',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    contract_fingerprint: contractFingerprint,
    source_admission_manifest_ids: QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
    prior_semantic_closure_ids: PRIOR_QXO_SEMANTIC_CLOSURE_IDS,
    material_reviewed_mapping_id: materialReviewedMappingId,
    serving_projection_version: servingProjectionVersion,
    query_projection_contract_digest: queryProjectionContractDigest,
    release_purpose: 'INCOMPLETE_CANONICAL_RESULT_CANDIDATE_ONLY',
  });
}

const QXO_MATERIAL_COMBINED_CANDIDATE_SEED = buildQxoMaterialCombinedCandidateSeed({
  contractFingerprint: QXO_MATERIAL_CONTRACT_FINGERPRINT,
  materialReviewedMappingId: QXO_MATERIAL_REVIEWED_MAPPING_ID,
});
const PROVISIONAL_CORPUS_RELEASE_ID = 'defab4022bf9b461c98151fc7afd8c6e090b2e429690934aee102a3eba8e6d30';
const PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST = 'c87b382a7d72126c96483bc5f9729e5a9d6b35effa000bb7bef1b6c8171616db';
const QXO_MATERIAL_COMBINED_CANDIDATE_SEED_V2 = buildQxoMaterialCombinedCandidateSeedV2({
  contractFingerprint: QXO_MATERIAL_CONTRACT_FINGERPRINT,
  materialReviewedMappingId: QXO_MATERIAL_REVIEWED_MAPPING_ID,
  servingProjectionVersion: SERVING_PROJECTION_VERSION_V2,
  queryProjectionContractDigest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
});
const QXO_MATERIAL_CORPUS_RELEASE_ID_V2 = 'df83cf6f0328dd387280ae17fd5ebda4c0a606d9af0cff1c189399a1461b077d';
const QXO_MATERIAL_CORPUS_RELEASE_SEED_DIGEST_V2 = '0735cad212c782e92c149212365edf5d757cddb09f6c0cd3857a8d6af93c7fa3';

if (qxoMaterialCombinedCandidateReleaseId(QXO_MATERIAL_COMBINED_CANDIDATE_SEED)
    !== PROVISIONAL_CORPUS_RELEASE_ID
  || contentId('QXO_MATERIAL_COMBINED_CANDIDATE_SEED/V1', QXO_MATERIAL_COMBINED_CANDIDATE_SEED)
    !== PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST) {
  throw new Error('The pinned QXO material combined candidate release identity has drifted.');
}
if (qxoMaterialCombinedCandidateReleaseId(QXO_MATERIAL_COMBINED_CANDIDATE_SEED_V2)
    !== QXO_MATERIAL_CORPUS_RELEASE_ID_V2
  || contentId('QXO_MATERIAL_COMBINED_CANDIDATE_SEED/V2', QXO_MATERIAL_COMBINED_CANDIDATE_SEED_V2)
    !== QXO_MATERIAL_CORPUS_RELEASE_SEED_DIGEST_V2) {
  throw new Error('The pinned QXO material v2 serving release identity has drifted.');
}

// SPEC-QXO-TERMF-F2-CANDIDATE-OPTION-A-2026-07-24.md: the F2 combined
// candidate (material release + termination-fee member). The termination
// reviewed mapping id derives from staging-only intake lineage (ruling R9),
// so this seed is parameterized; its pinned identity lands once the Option A
// Block 00 paste-back fixes the mapping id.
const QXO_MATERIAL_SEMANTIC_CLOSURE_ID = 'a08b15c095464e265205ffd87ec380a85e37e9867c9701551b7b59759ed0cab5';
const QXO_TERMINATION_CONTRACT_FINGERPRINT_V2 = '46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83';

function buildQxoTerminationCombinedCandidateSeed({
  contractFingerprint,
  materialReviewedMappingId,
  terminationReviewedMappingId,
  servingProjectionVersion,
  queryProjectionContractDigest,
} = {}) {
  if (!/^[a-f0-9]{64}$/.test(contractFingerprint || '')
    || !/^[a-f0-9]{64}$/.test(materialReviewedMappingId || '')
    || !/^[a-f0-9]{64}$/.test(terminationReviewedMappingId || '')
    || !/^[a-f0-9]{64}$/.test(queryProjectionContractDigest || '')
    || servingProjectionVersion !== SERVING_PROJECTION_VERSION_V2) {
    throw new TypeError('The termination combined candidate seed requires fixed legal and serving identities.');
  }
  if (contractFingerprint !== QXO_TERMINATION_CONTRACT_FINGERPRINT_V2) {
    throw new TypeError('The termination combined candidate is bound to the F2 versioned contract.');
  }
  return Object.freeze({
    schema_version: 'QXO_TERMINATION_COMBINED_CANDIDATE_SEED/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    contract_fingerprint: contractFingerprint,
    source_admission_manifest_ids: QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
    prior_semantic_closure_ids: Object.freeze([
      ...PRIOR_QXO_SEMANTIC_CLOSURE_IDS,
      QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
    ].sort()),
    material_reviewed_mapping_id: materialReviewedMappingId,
    termination_reviewed_mapping_id: terminationReviewedMappingId,
    serving_projection_version: servingProjectionVersion,
    query_projection_contract_digest: queryProjectionContractDigest,
    release_purpose: 'INCOMPLETE_CANONICAL_RESULT_CANDIDATE_ONLY',
  });
}

function qxoTerminationCombinedCandidateReleaseId(seed) {
  return contentId('CORPUS_RELEASE/V1', seed);
}

function qxoTerminationCombinedServingNamespaceId(seed) {
  return contentId('SERVING_NAMESPACE/V2', {
    schema_version: 'QXO_TERMINATION_COMBINED_SERVING_NAMESPACE/V1',
    governed_deal_key: seed.governed_deal_key,
    corpus_release_id: qxoTerminationCombinedCandidateReleaseId(seed),
    candidate_seed_digest: contentId('QXO_TERMINATION_COMBINED_CANDIDATE_SEED/V1', seed),
    serving_projection_version: seed.serving_projection_version,
    query_projection_contract_digest: seed.query_projection_contract_digest,
  });
}

module.exports = {
  PRIOR_QXO_SEMANTIC_CLOSURE_IDS,
  QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
  QXO_TERMINATION_CONTRACT_FINGERPRINT_V2,
  buildQxoTerminationCombinedCandidateSeed,
  qxoTerminationCombinedCandidateReleaseId,
  qxoTerminationCombinedServingNamespaceId,
  PROVISIONAL_CORPUS_RELEASE_ID,
  PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST,
  QXO_MATERIAL_COMBINED_CANDIDATE_SEED,
  QXO_MATERIAL_COMBINED_CANDIDATE_SEED_V2,
  QXO_MATERIAL_CONTRACT_FINGERPRINT,
  QXO_MATERIAL_CORPUS_RELEASE_ID_V2,
  QXO_MATERIAL_CORPUS_RELEASE_SEED_DIGEST_V2,
  QXO_MATERIAL_REVIEWED_MAPPING_ID,
  QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
  buildQxoMaterialCombinedCandidateSeed,
  buildQxoMaterialCombinedCandidateSeedV2,
  qxoMaterialCombinedCandidateReleaseId,
};
