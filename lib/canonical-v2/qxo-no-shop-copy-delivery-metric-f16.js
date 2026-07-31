const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  validateContractBundle,
} = require('./contract-bundle');
const {
  METRIC_DEFINITIONS,
  metricDefinitionId,
} = require('./serving-projection');
const {
  buildCandidateMetricDefinitionAdmission,
} = require('./candidate-metric-definition-policy');
const {
  validateQxoNoShopCopyClockF15CarrierIdentity,
} = require('./qxo-no-shop-copy-clock-f15');

const AUTHORITY_SCOPE =
  'OFFLINE_GOVERNED_QXO_COPY_DELIVERY_METRIC_F16_ONLY';
const F15_CARRIER_ID =
  '40d47cbfa5c8bb2e7e250dd1356cbfdcb4a561bfd6e4068fde98feede3f003d0';
const F15_CARRIER_DIGEST =
  '8e1ecfc1877a3ecb2a63f66206413cc783a18096d828b10de2260ad6e553894b';
const METRIC_KEY = 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS';
const WARNING_CODE =
  'QXO_COPY_CLOCK_PRIMARY_WITH_SOURCE_BACKED_ITEM_RECEIPT_ALTERNATIVE';
const WARNING_TEXT =
  'Compared using the primary reading: each qualifying receipt by the Company of a Company Acquisition Proposal or Company Request starts one copy-delivery clock. The drafting may instead tie the clock to receipt of each item to be copied; whether items are measured individually or as a batch remains unresolved.';

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

function validateInputs({
  contract_bundle: contractBundle,
  qxo_no_shop_copy_clock_f15: predecessor,
} = {}) {
  validateContractBundle(contractBundle);
  validateQxoNoShopCopyClockF15CarrierIdentity(predecessor);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V12) {
    throw new TypeError('F16 requires the exact frozen V12 contract');
  }
  if (predecessor.qxo_no_shop_copy_clock_f15_id !== F15_CARRIER_ID
    || predecessor.canonical_payload_digest !== F15_CARRIER_DIGEST
    || predecessor.status.overall_resolution_state
      !== 'RESOLVED_WITH_REVIEW_NOTE'
    || predecessor.status.blocker_codes.length !== 0
    || predecessor.notice_revision?.copy_clock_scope?.comparability_state
      !== 'PRIMARY_INTERPRETATION_COMPARABLE_WITH_AMBIGUITY_FLAG'
    || predecessor.notice_revision.copy_clock_scope
      .comparability_effect_code
      !== 'AMBIGUITY_AFFECTS_METRIC_OR_COHORT'
    || canonicalJson(
      predecessor.notice_revision.copy_clock_scope
        .ambiguity_dimension_codes,
    ) !== canonicalJson(['REFERENT', 'SCOPE', 'CARDINALITY'])) {
    throw new TypeError('F16 requires the exact reviewed F15 decision');
  }
  const admission = buildCandidateMetricDefinitionAdmission({
    contract_bundle: contractBundle,
    metric_key: METRIC_KEY,
  });
  return { contractBundle, predecessor, admission };
}

function buildQxoNoShopCopyDeliveryMetricF16(input = {}) {
  if (!exactKeys(input, [
    'contract_bundle',
    'qxo_no_shop_copy_clock_f15',
  ])) {
    throw new TypeError('the F16 input is outside its contract');
  }
  const { contractBundle, predecessor, admission } =
    validateInputs(input);
  const definition = METRIC_DEFINITIONS[METRIC_KEY];
  const clock = predecessor.notice_revision.copy_clock_scope;
  const interpretation = predecessor.clock_interpretation;
  const body = {
    schema_version: 'QXO_NO_SHOP_COPY_DELIVERY_METRIC_F16/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: contractBundle.contract_key,
      contract_fingerprint: contractBundle.fingerprint,
      candidate_metric_definition_admission_id:
        admission.candidate_metric_definition_admission_id,
    },
    upstream_binding: {
      qxo_no_shop_copy_clock_f15_id: F15_CARRIER_ID,
      qxo_no_shop_copy_clock_f15_payload_digest: F15_CARRIER_DIGEST,
      notice_obligation_revision_id:
        predecessor.notice_revision.notice_obligation_revision_id,
      interpretation_payload_id:
        interpretation.interpretation_payload_id,
    },
    metric_contract: {
      metric_definition_id: metricDefinitionId(definition),
      metric_key: definition.metric_key,
      metric_version: definition.metric_version,
      metric_role: definition.metric_role,
      concept_key: definition.concept_key,
      required_claim_definition_key:
        definition.required_claim_definition_key,
      value_dimension: definition.value_dimension,
      canonical_unit: definition.canonical_unit,
      basis_key: definition.basis_key,
      allowed_day_bases: definition.allowed_day_bases,
      trigger: definition.trigger,
      trigger_expression_operator:
        definition.trigger_expression_operator,
      trigger_operand_codes: definition.trigger_operand_codes,
      trigger_operand_sufficiency:
        definition.trigger_operand_sufficiency,
      company_request_semantic_code:
        definition.company_request_semantic_code,
      interpretation_policy_version:
        definition.interpretation_policy_version,
      accepted_clarity_states:
        definition.accepted_clarity_states,
      accepted_ambiguity_dimension_codes:
        definition.accepted_ambiguity_dimension_codes,
      accepted_comparability_effect_codes:
        definition.accepted_comparability_effect_codes,
      owner_lineage_mode: definition.owner_lineage_mode,
      per_deal_rollup: definition.per_deal_rollup,
      weighting: definition.weighting,
    },
    presentation_contract: {
      display_label: definition.display_label,
      trigger_label: definition.trigger_label,
      display_value_policy: definition.display_value_policy,
      display_value: 'Promptly, and no later than 1 elapsed day',
      ambiguity_warning_code: WARNING_CODE,
      ambiguity_warning_text: WARNING_TEXT,
      ambiguity_flag_required_in_review: true,
      ambiguity_flag_required_in_compare: true,
      ambiguity_flag_required_in_query: true,
    },
    required_claim_attributes: {
      metric_role: definition.metric_role,
      trigger: definition.trigger,
      basis_key: definition.basis_key,
      promptly_qualifier: true,
      outside_cap_semantic_code:
        'PROMPTLY_AND_NO_LATER_THAN_STATED_DURATION',
      source_raw_duration: {
        magnitude: '24',
        unit: 'HOURS',
        day_basis: 'ELAPSED',
      },
      normalisation_payload_digest:
        clock.primary_metric_normalisation.normalisation_payload_digest,
      source_timing_claim_revision_id:
        clock.source_metric_lineage.source_timing_claim_revision_id,
      source_normalisation_payload_digest:
        clock.source_metric_lineage
          .source_normalisation_payload_digest,
      source_derivation_version:
        clock.source_metric_lineage.source_derivation_version,
      trigger_expression_operator:
        definition.trigger_expression_operator,
      trigger_operand_codes: definition.trigger_operand_codes,
      trigger_operand_sufficiency:
        definition.trigger_operand_sufficiency,
      company_request_semantic_code:
        definition.company_request_semantic_code,
      company_request_neutral_meaning:
        'A request for nonpublic information relating to the Company or any Company Subsidiary, or for access to the properties, books or records of the Company or any Company Subsidiary, that in the Company Board’s good-faith judgment would reasonably be expected to give rise to or result in a Company Acquisition Proposal.',
      trigger_expression_id:
        predecessor.notice_revision.trigger_expression
          .trigger_expression_id,
      definition_scope_closure_id:
        predecessor.notice_revision.definition_scope_closure_id,
      clarity_state: interpretation.clarity_state,
      interpretation_policy_version:
        definition.interpretation_policy_version,
      interpretation_payload_id:
        interpretation.interpretation_payload_id,
      primary_receipt_interpretation_code:
        clock.primary_receipt_interpretation_code,
      primary_clock_application_scope_code:
        clock.primary_clock_application_scope_code,
      primary_item_or_batch_cardinality_state:
        clock.primary_item_or_batch_cardinality_state,
      alternative_receipt_interpretation_code:
        clock.alternative_receipt_interpretation_codes[0],
      alternative_clock_application_scope_state:
        clock.alternative_clock_application_scope_state,
      alternative_item_or_batch_cardinality_state:
        clock.alternative_item_or_batch_cardinality_state,
      cardinality_ambiguity_scope_code:
        clock.cardinality_ambiguity_scope_code,
      ambiguity_qualified_comparability_state:
        clock.comparability_state,
      comparability_effect_code:
        clock.comparability_effect_code,
      ambiguity_dimension_codes: clock.ambiguity_dimension_codes,
      ambiguity_warning_code: WARNING_CODE,
      lawyer_note_digest: interpretation.lawyer_note_digest,
    },
    claim_reclassification_contract: {
      classification:
        'SAME_SOURCE_OBSERVATION_RECLASSIFIED_TO_DISTINCT_LEGAL_MEASURE',
      predecessor_claim_definition_key:
        'NO_SHOP_NOTICE_PERIOD_DAYS',
      predecessor_claim_revision_id:
        clock.source_metric_lineage.source_timing_claim_revision_id,
      successor_claim_definition_key:
        definition.required_claim_definition_key,
      claim_occurrence_continuity: 'PROHIBITED',
      successor_claim_occurrence_must_be_reminted: true,
      predecessor_claim_occurrence_id_required_in_f17: true,
      source_evidence_set_must_remain_exact: true,
      source_governed_ordinal_must_remain_exact: true,
      reclassification_lineage_required_in_f17: true,
    },
    normalisation_contract: {
      raw_value: clock.primary_metric_normalisation.raw_value,
      canonical_value:
        clock.primary_metric_normalisation.canonical_value,
      canonical_unit:
        clock.primary_metric_normalisation.canonical_unit,
      day_basis: clock.primary_metric_normalisation.day_basis,
      basis_key: clock.primary_metric_normalisation.basis_key,
      derivation_version:
        clock.primary_metric_normalisation.derivation_version,
      normalisation_payload_digest:
        clock.primary_metric_normalisation.normalisation_payload_digest,
      source_metric_lineage: clock.source_metric_lineage,
    },
    status: {
      legal_semantic_state: 'GOVERNED_DISTINCT_METRIC',
      metric_definition_authority: 'OFFLINE_GOVERNED_ONLY',
      candidate_projection_authority: 'NONE',
      claim_materialisation_authority: 'NONE',
      result_materialisation_authority: 'NONE',
      candidate_release_authority: 'NONE',
      active_serving_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'F17_CLAIM_AND_RESULT_MATERIALISATION_REQUIRED',
        'F18_SHARED_ROW_AND_EXACT_DETAIL_REQUIRED',
      ],
    },
  };
  return freeze({
    ...body,
    qxo_no_shop_copy_delivery_metric_f16_id: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_METRIC_F16/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_METRIC_F16_PAYLOAD/V1',
      body,
    ),
  });
}

function validateQxoNoShopCopyDeliveryMetricF16({
  qxo_no_shop_copy_delivery_metric_f16: carrier,
  ...input
} = {}) {
  const expected = buildQxoNoShopCopyDeliveryMetricF16(input);
  if (canonicalJson(carrier) !== canonicalJson(expected)) {
    throw new TypeError('the QXO F16 metric carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  METRIC_KEY,
  WARNING_CODE,
  WARNING_TEXT,
  buildQxoNoShopCopyDeliveryMetricF16,
  validateQxoNoShopCopyDeliveryMetricF16,
};
