const { contentId } = require('./canonical-bytes');

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

const QXO_MATERIAL_COMBINED_CANDIDATE_SEED = buildQxoMaterialCombinedCandidateSeed({
  contractFingerprint: QXO_MATERIAL_CONTRACT_FINGERPRINT,
  materialReviewedMappingId: QXO_MATERIAL_REVIEWED_MAPPING_ID,
});
const PROVISIONAL_CORPUS_RELEASE_ID = 'defab4022bf9b461c98151fc7afd8c6e090b2e429690934aee102a3eba8e6d30';
const PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST = 'c87b382a7d72126c96483bc5f9729e5a9d6b35effa000bb7bef1b6c8171616db';

if (qxoMaterialCombinedCandidateReleaseId(QXO_MATERIAL_COMBINED_CANDIDATE_SEED)
    !== PROVISIONAL_CORPUS_RELEASE_ID
  || contentId('QXO_MATERIAL_COMBINED_CANDIDATE_SEED/V1', QXO_MATERIAL_COMBINED_CANDIDATE_SEED)
    !== PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST) {
  throw new Error('The pinned QXO material combined candidate release identity has drifted.');
}

module.exports = {
  PRIOR_QXO_SEMANTIC_CLOSURE_IDS,
  PROVISIONAL_CORPUS_RELEASE_ID,
  PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST,
  QXO_MATERIAL_COMBINED_CANDIDATE_SEED,
  QXO_MATERIAL_CONTRACT_FINGERPRINT,
  QXO_MATERIAL_REVIEWED_MAPPING_ID,
  QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
  buildQxoMaterialCombinedCandidateSeed,
  qxoMaterialCombinedCandidateReleaseId,
};
