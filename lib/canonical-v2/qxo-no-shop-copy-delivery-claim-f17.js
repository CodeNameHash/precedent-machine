const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  buildClaimInterpretation,
  buildInterpretedPresentClaimRevision,
  validateInterpretedPresentClaimRevision,
} = require('./claim-interpretation');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  validateContractBundle,
} = require('./contract-bundle');
const {
  buildFixtureResultComponent,
} = require('./serving-projection');
const {
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity,
} = require('./qxo-no-shop-notice-source-binding-f6');
const {
  validateQxoNoShopCopyClockF15CarrierIdentity,
} = require('./qxo-no-shop-copy-clock-f15');
const {
  validateQxoNoShopCopyDeliveryMetricF16,
} = require('./qxo-no-shop-copy-delivery-metric-f16');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_COPY_DELIVERY_CLAIM_AND_RESULT_F17_ONLY';
const REVIEW_VERSION = 'QXO_NO_SHOP_COPY_DELIVERY_CLAIM_F17/V1';
const F6_SOURCE_ID =
  '3e4e1a71bf89a360b7d712f96ea28ec2d8496868b7321648f9a214d96fcef7de';
const F6_SOURCE_DIGEST =
  '018dc57ded29b913378007f34ec2d7680076af6a321f0c32daef5b8807c9091b';
const F15_ID =
  '1062719fbf0974adae148ba9ab6bb74051df882a6838950c4b23c6d8d5c63295';
const F15_DIGEST =
  '72cd7e8465751e2c065e4dce10c987f2251852e091d8766bb1d62072138d8820';
const F16_ID =
  '2cf61241fbf6c17bc642322943ba950b6664ec1447c9c3e3ec0adcd3804428bc';
const F16_DIGEST =
  'bd802b68186e77586676b4792564795c353d8d7c0d51f5edc59d7bd88add651d';
const PREDECESSOR_CLAIM_REVISION_ID =
  'fdc473bb486f0104c3e29e5afb263ee81c7a2953b6da67de42a0c3737322a177';
const RESULT_KEY = 'TARGET_NO_SHOP_COPY_DELIVERY';
const VALUE_SLOT_KEY = 'COPY_DELIVERY_PERIOD';
const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'qxo_no_shop_copy_clock_f15',
  'qxo_no_shop_copy_delivery_metric_f16',
  'qxo_no_shop_notice_source_binding_f6',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...keys].sort());
}

function evidenceProjection(evidence) {
  return evidence.map((entry) => ({
    evidence_role: entry.evidence_role,
    excerpt_id: entry.excerpt_id,
    document_ordinal: entry.document_ordinal,
    absolute_start: entry.absolute_start,
    absolute_end: entry.absolute_end,
  }));
}

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    throw new TypeError('the F17 input is outside its closed contract');
  }
  const {
    contract_bundle: contractBundle,
    qxo_no_shop_copy_clock_f15: f15,
    qxo_no_shop_copy_delivery_metric_f16: f16,
    qxo_no_shop_notice_source_binding_f6: source,
  } = input;
  validateContractBundle(contractBundle);
  validateQxoNoShopCopyClockF15CarrierIdentity(f15);
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(source);
  validateQxoNoShopCopyDeliveryMetricF16({
    contract_bundle: contractBundle,
    qxo_no_shop_copy_clock_f15: f15,
    qxo_no_shop_copy_delivery_metric_f16: f16,
  });
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V12) {
    throw new TypeError('F17 requires the exact frozen V12 contract');
  }
  if (source.qxo_no_shop_notice_source_binding_f6_id !== F6_SOURCE_ID
    || source.canonical_payload_digest !== F6_SOURCE_DIGEST) {
    throw new TypeError('F17 requires the exact frozen F6 source carrier');
  }
  if (f15.qxo_no_shop_copy_clock_f15_id !== F15_ID
    || f15.canonical_payload_digest !== F15_DIGEST) {
    throw new TypeError('F17 requires the exact frozen F15 clock carrier');
  }
  if (f16.qxo_no_shop_copy_delivery_metric_f16_id !== F16_ID
    || f16.canonical_payload_digest !== F16_DIGEST
    || f16.status.claim_materialisation_authority !== 'NONE'
    || f16.status.result_materialisation_authority !== 'NONE'
    || !f16.status.blocker_codes.includes(
      'F17_CLAIM_AND_RESULT_MATERIALISATION_REQUIRED',
    )) {
    throw new TypeError('F17 requires the exact frozen F16 metric carrier');
  }
  const predecessor = source.copy_timing_source_binding.review_claim;
  if (predecessor.claim_revision_id !== PREDECESSOR_CLAIM_REVISION_ID
    || source.copy_timing_source_binding.claim_revision_id
      !== PREDECESSOR_CLAIM_REVISION_ID
    || predecessor.claim_definition_key
      !== f16.claim_reclassification_contract
        .predecessor_claim_definition_key
    || predecessor.ordinal !== 1
    || predecessor.state !== 'PRESENT'
    || predecessor.publication_state !== 'VALIDATED'
    || predecessor.retained_residuals.length !== 0) {
    throw new TypeError('the exact source-backed predecessor claim is required');
  }
  return {
    contractBundle,
    f15,
    f16,
    predecessor,
    source,
  };
}

function buildInterpretation({
  contractBundle,
  f15,
  f16,
  source,
  claimOccurrenceId,
}) {
  const attributes = f16.required_claim_attributes;
  return buildClaimInterpretation({
    claim_occurrence_id: claimOccurrenceId,
    policy: contractBundle.claim_interpretation_policy_definition,
    policy_version: attributes.interpretation_policy_version,
    clarity_state: attributes.clarity_state,
    primary_interpretation: {
      code: attributes.primary_receipt_interpretation_code,
      receipt_recipient_party: f15.notice_occurrence.party,
      trigger_expression_operator:
        attributes.trigger_expression_operator,
      trigger_operand_codes: attributes.trigger_operand_codes,
      trigger_operand_sufficiency:
        attributes.trigger_operand_sufficiency,
      clock_application_scope_code:
        attributes.primary_clock_application_scope_code,
    },
    alternative_interpretations: [{
      code: attributes.alternative_receipt_interpretation_code,
      clock_application_scope_state:
        attributes.alternative_clock_application_scope_state,
      item_or_batch_cardinality_state:
        attributes.alternative_item_or_batch_cardinality_state,
    }],
    ambiguity_dimension_codes: attributes.ambiguity_dimension_codes,
    evidence_excerpt_ids: [
      ...source.copy_timing_source_binding.evidence_excerpt_ids,
    ].sort(),
    lawyer_note_digest: attributes.lawyer_note_digest,
    review_provenance: {
      review_authority:
        'BEN_APPROVED_F15_PRIMARY_READING_AND_F16_DISTINCT_METRIC',
      decision_key:
        'QXO_COPY_DELIVERY_FROM_PROPOSAL_OR_REQUEST_RECEIPT_WITH_AMBIGUITY_FLAG',
      source_review_scope: 'EXACT_QXO_FIRST_NOTICE_SENTENCE',
      source_notice_clock_interpretation_payload_id:
        attributes.interpretation_payload_id,
      qxo_no_shop_copy_clock_f15_id: F15_ID,
      qxo_no_shop_copy_delivery_metric_f16_id: F16_ID,
    },
  });
}

function buildClaim({
  contractBundle,
  f15,
  f16,
  predecessor,
  source,
}) {
  const claimDefinition = contractBundle.claim_definitions.find(
    (entry) => entry.claim_definition_key
      === f16.metric_contract.required_claim_definition_key,
  );
  if (!claimDefinition) {
    throw new TypeError('the F17 claim definition is absent from V12');
  }
  const claimOccurrenceId = contentId('CLAIM_OCCURRENCE/V1', {
    subject_occurrence_id: predecessor.subject_occurrence_id,
    claim_definition_key: claimDefinition.claim_definition_key,
    claim_definition_version: claimDefinition.version,
    ordinal: predecessor.ordinal,
  });
  const interpretation = buildInterpretation({
    contractBundle,
    f15,
    f16,
    source,
    claimOccurrenceId,
  });
  const intervalIds = [...predecessor.scope.required_interval_ids];
  const scope = {
    scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V2', {
      review_version: REVIEW_VERSION,
      predecessor_scope_closure_id: predecessor.scope.scope_closure_id,
      claim_occurrence_id: claimOccurrenceId,
      interval_ids: intervalIds,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: intervalIds,
    examined_interval_ids: [...intervalIds],
  };
  const attributes = {
    ...f16.required_claim_attributes,
    source_notice_clock_interpretation_payload_id:
      f16.required_claim_attributes.interpretation_payload_id,
    interpretation_payload_id:
      interpretation.interpretation_payload_id,
    trigger_operand_codes: [
      ...f16.required_claim_attributes.trigger_operand_codes,
    ],
    ambiguity_dimension_codes: [
      ...f16.required_claim_attributes.ambiguity_dimension_codes,
    ],
    source_raw_duration: {
      ...f16.required_claim_attributes.source_raw_duration,
    },
  };
  const claim = buildInterpretedPresentClaimRevision({
    policy: contractBundle.claim_interpretation_policy_definition,
    interpretation,
    subject_occurrence_id: predecessor.subject_occurrence_id,
    claim_definition_key: claimDefinition.claim_definition_key,
    claim_definition_version: claimDefinition.version,
    ordinal: predecessor.ordinal,
    raw_value: predecessor.raw_value,
    canonical_value: f16.normalisation_contract.canonical_value,
    unit: f16.normalisation_contract.canonical_unit,
    day_basis: f16.normalisation_contract.day_basis,
    denominator: null,
    scope,
    attributes,
    allowed_attributes: [
      ...Object.keys(f16.required_claim_attributes),
      'source_notice_clock_interpretation_payload_id',
    ],
    codebooks: {},
    taxonomy_codes: {},
    evidence: evidenceProjection(predecessor.evidence),
    extraction_version:
      f16.normalisation_contract.source_metric_lineage
        .source_derivation_version,
    normalisation_version:
      f16.normalisation_contract.derivation_version,
    derivation_version: REVIEW_VERSION,
  });
  validateInterpretedPresentClaimRevision({
    claim,
    interpretation,
    policy: contractBundle.claim_interpretation_policy_definition,
    allowed_attributes: [
      ...Object.keys(f16.required_claim_attributes),
      'source_notice_clock_interpretation_payload_id',
    ],
    codebooks: {},
    expected_attributes: attributes,
  });
  return { claim, interpretation };
}

function buildResult(source, f15, claim, interpretation) {
  const compositionScopeClosureId = contentId(
    'COMPOSITION_SCOPE_CLOSURE/V2',
    {
      claim_revision_id: claim.claim_revision_id,
      interpretation_payload_id:
        interpretation.interpretation_payload_id,
      relationship_revision_ids: [],
    },
  );
  return buildFixtureResultComponent({
    deal_admission_id: source.source_binding.deal_admission_id,
    result_key: RESULT_KEY,
    result_version: 1,
    concept_key: 'NOSOL-NOTICE',
    party: f15.notice_occurrence.party,
    value_slot_key: VALUE_SLOT_KEY,
    ordinal: 0,
    claim,
    relationships: [],
    composition_scope_closure_id: compositionScopeClosureId,
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
}

function buildQxoNoShopCopyDeliveryClaimF17(input = {}) {
  const {
    contractBundle,
    f15,
    f16,
    predecessor,
    source,
  } = validateInputs(input);
  const { claim, interpretation } = buildClaim({
    contractBundle,
    f15,
    f16,
    predecessor,
    source,
  });
  if (claim.claim_occurrence_id === predecessor.claim_occurrence_id
    || canonicalJson(evidenceProjection(claim.evidence))
      !== canonicalJson(evidenceProjection(predecessor.evidence))
    || claim.ordinal !== predecessor.ordinal) {
    throw new TypeError('F17 failed the remint or exact source-lineage contract');
  }
  const result = buildResult(source, f15, claim, interpretation);
  const sourceEvidenceSetDigest = contentId(
    'QXO_COPY_DELIVERY_SOURCE_EVIDENCE_SET_F17/V1',
    evidenceProjection(predecessor.evidence),
  );
  const body = {
    schema_version: 'QXO_NO_SHOP_COPY_DELIVERY_CLAIM_F17/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: contractBundle.contract_key,
      contract_fingerprint: contractBundle.fingerprint,
      claim_interpretation_policy_version:
        contractBundle.claim_interpretation_policy_definition
          .schema_version,
    },
    source_binding: source.source_binding,
    upstream_bindings: {
      qxo_no_shop_notice_source_binding_f6_id: F6_SOURCE_ID,
      qxo_no_shop_notice_source_binding_f6_payload_digest:
        F6_SOURCE_DIGEST,
      qxo_no_shop_copy_clock_f15_id: F15_ID,
      qxo_no_shop_copy_clock_f15_payload_digest: F15_DIGEST,
      qxo_no_shop_copy_delivery_metric_f16_id: F16_ID,
      qxo_no_shop_copy_delivery_metric_f16_payload_digest:
        F16_DIGEST,
    },
    interpretation,
    claim,
    result,
    reclassification_lineage: {
      classification:
        f16.claim_reclassification_contract.classification,
      predecessor_claim_definition_key:
        predecessor.claim_definition_key,
      predecessor_claim_occurrence_id:
        predecessor.claim_occurrence_id,
      predecessor_claim_revision_id:
        predecessor.claim_revision_id,
      successor_claim_definition_key:
        claim.claim_definition_key,
      successor_claim_occurrence_id: claim.claim_occurrence_id,
      successor_claim_revision_id: claim.claim_revision_id,
      claim_occurrence_continuity: 'PROHIBITED',
      governed_ordinal: claim.ordinal,
      source_evidence_set_digest: sourceEvidenceSetDigest,
      source_evidence_set_preserved: true,
      source_scope_interval_ids:
        claim.scope.required_interval_ids,
      predecessor_scope_closure_id:
        predecessor.scope.scope_closure_id,
      successor_scope_closure_id: claim.scope.scope_closure_id,
    },
    presentation: {
      display_label: f16.presentation_contract.display_label,
      display_value: f16.presentation_contract.display_value,
      trigger_label: f16.presentation_contract.trigger_label,
      ambiguity_warning_code:
        f16.presentation_contract.ambiguity_warning_code,
      ambiguity_warning_text:
        f16.presentation_contract.ambiguity_warning_text,
      lawyer_warning_required: true,
    },
    status: {
      legal_semantic_state: 'REVIEWED_WITH_GOVERNED_AMBIGUITY',
      claim_materialisation_authority: 'OFFLINE_REVIEWED_ONLY',
      result_materialisation_authority: 'OFFLINE_REVIEWED_ONLY',
      candidate_projection_authority: 'NONE',
      candidate_release_authority: 'NONE',
      active_serving_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'F18_SHARED_ROW_AND_EXACT_DETAIL_REQUIRED',
      ],
    },
  };
  return freeze({
    ...body,
    qxo_no_shop_copy_delivery_claim_f17_id: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CLAIM_F17/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CLAIM_F17_PAYLOAD/V1',
      body,
    ),
  });
}

function validateQxoNoShopCopyDeliveryClaimF17({
  qxo_no_shop_copy_delivery_claim_f17: carrier,
  ...input
} = {}) {
  const expected = buildQxoNoShopCopyDeliveryClaimF17(input);
  if (canonicalJson(carrier) !== canonicalJson(expected)) {
    throw new TypeError('the QXO F17 claim carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  RESULT_KEY,
  REVIEW_VERSION,
  VALUE_SLOT_KEY,
  buildQxoNoShopCopyDeliveryClaimF17,
  validateQxoNoShopCopyDeliveryClaimF17,
};
