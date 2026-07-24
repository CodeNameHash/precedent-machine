const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
} = require('./candidate-release');
const { buildCandidateReleaseImportPlan } = require('./candidate-release-import');
const {
  compileFixtureContractV4,
  compileFixtureContractV5,
} = require('./contract-bundle');
const {
  composeReferenceOnlyDealScopeWriteSet,
} = require('./deal-extraction-write-set');
const { buildFixtureCandidateInputAuthority } = require('../../__fixtures__/canonical-v2/candidate-input-authority');
const {
  PROVISIONAL_CORPUS_RELEASE_ID,
  QXO_MATERIAL_F5_REVIEWED_MAPPING_ID,
  QXO_MATERIAL_REVIEWED_MAPPING_ID,
  QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
} = require('./qxo-material-candidate-identity');
const {
  QXO_DENOMINATOR_PRECISION_F5_CONTRACT_FINGERPRINT,
  QXO_REVERSE_F4_CONTRACT_FINGERPRINT,
  QXO_RICH_DEAL_DIMENSIONS,
  buildQxoDenominatorPrecisionF5CandidateSeed,
  buildQxoReverseF4CombinedCandidateSeed,
  qxoDenominatorPrecisionF5CandidateReleaseId,
  qxoDenominatorPrecisionF5ServingNamespaceId,
  qxoReverseF4CombinedCandidateReleaseId,
  qxoReverseF4CombinedServingNamespaceId,
} = require('./qxo-reverse-candidate-identity');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('./serving-projection-contract');
const {
  buildQxoReviewedCapitalisationSlice,
} = require('./reviewed-qxo-capitalisation-slice');
const {
  buildQxoAdmittedNoShopActionsSlice,
} = require('./reviewed-qxo-admitted-no-shop-actions-slice');
const {
  buildQxoAdmittedNoShopRematchSlice,
} = require('./reviewed-qxo-admitted-no-shop-rematch-slice');
const {
  buildQxoAdmittedNoShopNoticeSlice,
} = require('./reviewed-qxo-admitted-no-shop-slice');
const {
  buildQxoCapitalisationServingSlice,
} = require('./qxo-capitalisation-serving-slice');
const {
  buildQxoNoShopActionsServingSlice,
} = require('./qxo-no-shop-actions-serving-slice');
const {
  buildQxoNoShopRematchServingSlice,
} = require('./qxo-no-shop-rematch-serving-slice');
const {
  buildQxoNoShopServingSlice,
} = require('./qxo-no-shop-serving-slice');
const {
  buildQxoMaterialContractsSlice,
} = require('./qxo-material-contracts-slice');
const {
  DEAL_DIMENSIONS: BUYER_FEE_DEAL_DIMENSIONS,
  buildQxoBuyerTerminationFeeAdmittedSlice,
  buildQxoSellerTerminationFeeF4AdmittedSlice,
} = require('./qxo-buyer-termination-fee-admitted-slice');

const APPLICATION_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const DEAL_KEY = 'deal:qxo-topbuild';
const PROVISIONAL_NAMESPACE_ID = contentId(
  'SERVING_NAMESPACE/V2',
  'qxo-reverse-f4-provisional-probe',
);

function assertRichDimensions(terminalSlots) {
  for (const slot of terminalSlots) {
    if (canonicalJson(slot.dimensions) !== canonicalJson(QXO_RICH_DEAL_DIMENSIONS)) {
      throw new TypeError('Every F4 metric slot must use the reviewed rich QXO deal dimensions.');
    }
  }
}

function buildQxoReverseCandidate({
  agreementSourceContext,
  agreementSourceAdmission,
  dealValueSourceContext,
  dealValueSourceAdmission,
  contractBundle,
  correctionAuthoritySelection,
  candidateVariant,
} = {}) {
  const variant = candidateVariant === 'F5'
    ? {
      contractFingerprint: QXO_DENOMINATOR_PRECISION_F5_CONTRACT_FINGERPRINT,
      materialReviewedMappingId: QXO_MATERIAL_F5_REVIEWED_MAPPING_ID,
      buildSeed: buildQxoDenominatorPrecisionF5CandidateSeed,
      releaseId: qxoDenominatorPrecisionF5CandidateReleaseId,
      namespaceId: qxoDenominatorPrecisionF5ServingNamespaceId,
      schemaVersion: 'QXO_DENOMINATOR_PRECISION_F5_CANDIDATE_BUILD/V1',
    }
    : {
      contractFingerprint: QXO_REVERSE_F4_CONTRACT_FINGERPRINT,
      materialReviewedMappingId: QXO_MATERIAL_REVIEWED_MAPPING_ID,
      buildSeed: buildQxoReverseF4CombinedCandidateSeed,
      releaseId: qxoReverseF4CombinedCandidateReleaseId,
      namespaceId: qxoReverseF4CombinedServingNamespaceId,
      schemaVersion: 'QXO_REVERSE_F4_CANDIDATE_BUILD/V1',
    };
  if (contractBundle.fingerprint !== variant.contractFingerprint) {
    throw new TypeError(`The corrected QXO reverse candidate requires the frozen ${candidateVariant} contract.`);
  }
  if (agreementSourceAdmission?.source_admission_manifest_id
      !== QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS[0]
    || dealValueSourceAdmission?.source_admission_manifest_id
      !== QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS[1]) {
    throw new TypeError('The QXO reverse candidate requires the two admitted production source manifests.');
  }
  if (canonicalJson(BUYER_FEE_DEAL_DIMENSIONS) !== canonicalJson(QXO_RICH_DEAL_DIMENSIONS)) {
    throw new TypeError('The buyer-fee slice and F4 candidate disagree on QXO deal dimensions.');
  }
  const authoritySelection = correctionAuthoritySelection
    || buildFixtureCandidateInputAuthority({ contractBundle });

  const capitalisationSlice = buildQxoReviewedCapitalisationSlice({
    sourceContext: agreementSourceContext,
    contractBundle,
  });
  const noShopSlice = buildQxoAdmittedNoShopNoticeSlice({
    sourceContext: agreementSourceContext,
    contractBundle,
  });
  const actionsSlice = buildQxoAdmittedNoShopActionsSlice({
    sourceContext: agreementSourceContext,
    contractBundle,
  });
  const rematchSlice = buildQxoAdmittedNoShopRematchSlice({
    sourceContext: agreementSourceContext,
    contractBundle,
  });
  const familyInputs = {
    agreementSourceContext,
    agreementSourceAdmission,
    dealValueSourceContext,
    dealValueSourceAdmission,
    contractBundle,
  };
  const materialProbe = buildQxoMaterialContractsSlice({
    ...familyInputs,
    corpusReleaseId: PROVISIONAL_CORPUS_RELEASE_ID,
    dealDimensions: QXO_RICH_DEAL_DIMENSIONS,
  });
  const sellerProbe = buildQxoSellerTerminationFeeF4AdmittedSlice({
    ...familyInputs,
    corpusReleaseId: PROVISIONAL_CORPUS_RELEASE_ID,
    servingNamespaceId: PROVISIONAL_NAMESPACE_ID,
    dealDimensions: QXO_RICH_DEAL_DIMENSIONS,
  });
  const reverseProbe = buildQxoBuyerTerminationFeeAdmittedSlice({
    ...familyInputs,
    corpusReleaseId: PROVISIONAL_CORPUS_RELEASE_ID,
    servingNamespaceId: PROVISIONAL_NAMESPACE_ID,
  });
  if (materialProbe.reviewed_mapping.reviewed_mapping_id !== variant.materialReviewedMappingId) {
    throw new TypeError(`The reviewed QXO material mapping has drifted before the ${candidateVariant} rebuild.`);
  }

  const seed = variant.buildSeed({
    contractFingerprint: contractBundle.fingerprint,
    materialReviewedMappingId: materialProbe.reviewed_mapping.reviewed_mapping_id,
    sellerTerminationReviewedMappingId: sellerProbe.reviewed_mapping.reviewed_mapping_id,
    reverseTerminationReviewedMappingId: reverseProbe.reviewed_mapping.reviewed_mapping_id,
    dealDimensions: QXO_RICH_DEAL_DIMENSIONS,
    servingProjectionVersion: SERVING_PROJECTION_VERSION_V2,
    queryProjectionContractDigest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  });
  const corpusReleaseId = variant.releaseId(seed);
  const servingNamespaceId = variant.namespaceId(seed);

  const material = buildQxoMaterialContractsSlice({
    ...familyInputs,
    corpusReleaseId,
    dealDimensions: QXO_RICH_DEAL_DIMENSIONS,
  });
  const sellerTermination = buildQxoSellerTerminationFeeF4AdmittedSlice({
    ...familyInputs,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions: QXO_RICH_DEAL_DIMENSIONS,
  });
  const reverseTermination = buildQxoBuyerTerminationFeeAdmittedSlice({
    ...familyInputs,
    corpusReleaseId,
    servingNamespaceId,
  });
  if (reverseTermination.reviewed_mapping.reviewed_mapping_id
      !== reverseProbe.reviewed_mapping.reviewed_mapping_id
    || sellerTermination.reviewed_mapping.reviewed_mapping_id
      !== sellerProbe.reviewed_mapping.reviewed_mapping_id) {
    throw new TypeError('A termination-fee reviewed mapping depends on release identity.');
  }
  const terminationFeeSemanticWriteSet = composeReferenceOnlyDealScopeWriteSet({
    writeSets: [
      sellerTermination.semantic_write_set,
      reverseTermination.semantic_write_set,
    ],
    deal: reverseTermination.semantic_write_set.deal,
  });

  const servingInputs = (slice) => ({
    sourceContext: agreementSourceContext,
    sourceAdmission: agreementSourceAdmission,
    slice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions: QXO_RICH_DEAL_DIMENSIONS,
  });
  const capitalisation = buildQxoCapitalisationServingSlice(servingInputs(capitalisationSlice));
  const noShop = buildQxoNoShopServingSlice(servingInputs(noShopSlice));
  const actions = buildQxoNoShopActionsServingSlice(servingInputs(actionsSlice));
  const rematch = buildQxoNoShopRematchServingSlice(servingInputs(rematchSlice));

  const release = buildFixtureCandidateRelease({
    contract_bundle: contractBundle,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: [
      ...capitalisation.candidate_release_members,
      ...noShop.candidate_release_members,
      ...actions.candidate_release_members,
      ...rematch.candidate_release_members,
      material.candidate_release_member,
      sellerTermination.candidate_release_member,
      reverseTermination.candidate_release_member,
    ],
    correction_authority_selection: authoritySelection,
    deal_directory_entries: [{
      application_deal_id: APPLICATION_DEAL_ID,
      governed_deal_key: DEAL_KEY,
    }],
  });
  validateCandidateReleaseBundle(release);
  if (release.market_observations.length !== 10
    || release.market_exclusions.length !== 2
    || release.shared_rows.length !== 11
    || release.incomplete_canonical_rows.length !== 1
    || release.query_records.length !== 10
    || release.exact_detail_packages.length !== 11
    || release.deal_directory_records.length !== 1) {
    throw new TypeError('The F4 candidate release partition counts are not exact.');
  }
  assertRichDimensions([...release.market_observations, ...release.market_exclusions]);
  const importPlan = buildCandidateReleaseImportPlan({ release });

  return Object.freeze({
    schema_version: variant.schemaVersion,
    contract_bundle: contractBundle,
    correction_authority_selection: authoritySelection,
    seed,
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    reviewed_slices: Object.freeze({
      capitalisation: capitalisationSlice,
      no_shop: noShopSlice,
      actions: actionsSlice,
      rematch: rematchSlice,
    }),
    serving_slices: Object.freeze({
      capitalisation,
      no_shop: noShop,
      actions,
      rematch,
      material,
      seller_termination: sellerTermination,
      reverse_termination: reverseTermination,
      termination_fee_semantic_write_set: terminationFeeSemanticWriteSet,
    }),
    release,
    import_plan: importPlan,
  });
}

function buildQxoReverseF4Candidate(inputs = {}) {
  return buildQxoReverseCandidate({
    ...inputs,
    contractBundle: inputs.contractBundle || compileFixtureContractV4(),
    candidateVariant: 'F4',
  });
}

function buildQxoDenominatorPrecisionF5Candidate(inputs = {}) {
  return buildQxoReverseCandidate({
    ...inputs,
    contractBundle: inputs.contractBundle || compileFixtureContractV5(),
    candidateVariant: 'F5',
  });
}

module.exports = {
  APPLICATION_DEAL_ID,
  DEAL_KEY,
  buildQxoDenominatorPrecisionF5Candidate,
  buildQxoReverseF4Candidate,
};
