const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  compileFixtureContractV12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  METRIC_DEFINITIONS,
  copyDeliveryInterpretationAllowed,
} = require('../lib/canonical-v2/serving-projection');
const {
  ACTIVE_SERVING_FINGERPRINT_SNAPSHOT,
  buildCandidateMetricDefinitionAdmission,
} = require('../lib/canonical-v2/candidate-metric-definition-policy');
const {
  compileMarketCohortRequest,
} = require('../lib/canonical-v2/market-cohort-query');
const {
  AUTHORITY_SCOPE,
  METRIC_KEY,
  WARNING_CODE,
  WARNING_TEXT,
} = require('../lib/canonical-v2/qxo-no-shop-copy-delivery-metric-f16');

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-metric-f16-staging-attestation.json';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

test('F16 governs a distinct copy-delivery metric under frozen V12', () => {
  const value = fixture();
  assert.equal(value.environment, 'STAGING');
  assert.equal(value.authority_scope, AUTHORITY_SCOPE);
  assert.equal(value.metric_contract.metric_key, METRIC_KEY);
  assert.equal(
    value.contract_binding.contract_fingerprint,
    '261525a8268a1392428a610bbf0c2166c87318192971d08bc7e6ac5f2c7235e5',
  );
  assert.equal(
    value.metric_contract.required_claim_definition_key,
    'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
  );
  assert.equal(
    value.metric_contract.metric_role,
    'COPY_DEADLINE_FROM_PROPOSAL_OR_REQUEST_RECEIPT',
  );
});

test('F16 cannot collapse into the initial-notice metric or cohort', () => {
  const copy = METRIC_DEFINITIONS.NO_SHOP_COPY_DELIVERY_PERIOD_DAYS;
  const notice = METRIC_DEFINITIONS.NO_SHOP_NOTICE_PERIOD_DAYS;
  assert.notEqual(copy.metric_key, notice.metric_key);
  assert.notEqual(copy.required_claim_definition_key, notice.required_claim_definition_key);
  assert.notEqual(copy.basis_key, notice.basis_key);
  assert.notEqual(copy.trigger, notice.trigger);
  assert.equal(copy.basis_key, 'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT');
  assert.equal(notice.basis_key, 'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL');
  assert.equal(Object.hasOwn(copy, 'required_ambiguity_dimensions'), false);
  assert.equal(Object.hasOwn(copy, 'required_ambiguity_warning_code'), false);
});

test('24 hours remains raw evidence and normalises to one elapsed day', () => {
  assert.deepEqual(fixture().normalisation_contract, {
    raw_value: {
      magnitude: '24',
      unit: 'HOURS',
      day_basis: 'ELAPSED',
    },
    canonical_value: '1',
    canonical_unit: 'DAYS',
    day_basis: 'ELAPSED',
    basis_key: 'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT',
    derivation_version: 'QXO_NO_SHOP_COPY_CLOCK_F15/V1',
    normalisation_payload_digest:
      'ae652eba2dfb5bc6fca4418455c21d9ab802eff9f46e6f86c8251d48d28349c7',
    source_metric_lineage: {
      source_derivation_version: 'QXO_NO_SHOP_NOTICE_COPY_CLOCK_F6/V1',
      source_normalisation_payload_digest:
        '5bfd481545b53ec694ffa59ce51bd39019294b3d61a8c7b8a690a215ddb2b4fc',
      source_timing_claim_revision_id:
        'fdc473bb486f0104c3e29e5afb263ee81c7a2953b6da67de42a0c3737322a177',
    },
  });
});

test('promptly, the outside cap and the legal trigger remain explicit', () => {
  const presentation = fixture().presentation_contract;
  assert.equal(
    presentation.display_value,
    'Promptly, and no later than 1 elapsed day',
  );
  assert.equal(
    presentation.trigger_label,
    'Receipt by the Company of a Company Acquisition Proposal or Company Request',
  );
  assert.equal(presentation.display_value_policy, 'PROMPTLY_WITH_OUTSIDE_CAP');
  assert.deepEqual(fixture().metric_contract.trigger_operand_codes, [
    'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
    'RECEIPT_OF_SOURCE_DEFINED_COMPANY_REQUEST',
  ]);
  assert.equal(fixture().metric_contract.trigger_expression_operator, 'ANY_OF');
  assert.equal(
    fixture().metric_contract.trigger_operand_sufficiency,
    'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT',
  );
  assert.equal(
    fixture().required_claim_attributes.company_request_semantic_code,
    'NON_PUBLIC_INFORMATION_OR_ACCESS_REQUEST_REASONABLY_EXPECTED_TO_GIVE_RISE_TO_OR_RESULT_IN_COMPANY_ACQUISITION_PROPOSAL',
  );
  assert.match(
    fixture().required_claim_attributes.company_request_neutral_meaning,
    /Company or any Company Subsidiary/,
  );
});

test('the ambiguity is governed data, not UI-only prose', () => {
  const value = fixture();
  assert.equal(value.presentation_contract.ambiguity_warning_code, WARNING_CODE);
  assert.equal(value.presentation_contract.ambiguity_warning_text, WARNING_TEXT);
  assert.deepEqual(value.required_claim_attributes.ambiguity_dimension_codes, [
    'REFERENT',
    'SCOPE',
    'CARDINALITY',
  ]);
  assert.equal(
    value.required_claim_attributes.clarity_state,
    'REASONABLE_BUT_AMBIGUOUS',
  );
  assert.equal(
    value.required_claim_attributes.interpretation_policy_version,
    'CLAIM_INTERPRETATION_POLICY/V2',
  );
  assert.equal(
    value.required_claim_attributes.comparability_effect_code,
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  );
  assert.equal(
    value.required_claim_attributes.alternative_item_or_batch_cardinality_state,
    'UNRESOLVED',
  );
  assert.equal(
    value.required_claim_attributes.alternative_clock_application_scope_state,
    'UNRESOLVED_ITEM_OR_BATCH',
  );
  assert.equal(
    value.required_claim_attributes.cardinality_ambiguity_scope_code,
    'ALTERNATIVE_ITEM_RECEIPT_INTERPRETATION_ONLY',
  );
  assert.equal(
    value.required_claim_attributes.ambiguity_qualified_comparability_state,
    'PRIMARY_INTERPRETATION_COMPARABLE_WITH_AMBIGUITY_FLAG',
  );
  assert.match(
    value.required_claim_attributes.interpretation_payload_id,
    /^[a-f0-9]{64}$/,
  );
  assert.match(
    value.required_claim_attributes.lawyer_note_digest,
    /^[a-f0-9]{64}$/,
  );
});

test('V12 is admitted only to the offline metric-definition seam', () => {
  const contract = compileFixtureContractV12();
  const admission = buildCandidateMetricDefinitionAdmission({
    contract_bundle: contract,
    metric_key: METRIC_KEY,
  });
  assert.equal(
    admission.metric_definition_authority,
    'OFFLINE_GOVERNED_ONLY',
  );
  assert.match(admission.interpretation_admission_digest, /^[a-f0-9]{64}$/);
  assert.equal(admission.candidate_projection_authority, 'NONE');
  assert.equal(admission.candidate_release_authority, 'NONE');
  assert.equal(admission.active_serving_authority, 'NONE');
  assert.equal(admission.active_query_authority, 'NONE');
  assert.equal(
    admission.candidate_metric_definition_admission_id,
    fixture().contract_binding.candidate_metric_definition_admission_id,
  );
  assert.deepEqual(
    [...FIXTURE_SERVING_CONTRACT_FINGERPRINTS].sort(),
    [...ACTIVE_SERVING_FINGERPRINT_SNAPSHOT],
  );
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(contract.fingerprint),
    false,
  );
});

test('the metric admits only governed ambiguity dimensions and effect', () => {
  const metric = METRIC_DEFINITIONS.NO_SHOP_COPY_DELIVERY_PERIOD_DAYS;
  assert.deepEqual(metric.accepted_clarity_states, [
    'CLEAR',
    'REASONABLE_BUT_AMBIGUOUS',
  ]);
  assert.deepEqual(metric.accepted_ambiguity_dimension_codes, [
    'REFERENT',
    'SCOPE',
    'CARDINALITY',
  ]);
  assert.deepEqual(metric.accepted_comparability_effect_codes, [
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  ]);
  assert.equal(
    metric.accepted_ambiguity_dimension_codes.includes('OTHER_REVIEWED'),
    false,
  );
  const ambiguous = {
    clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
    ambiguity_dimension_codes: ['REFERENT', 'SCOPE', 'CARDINALITY'],
    comparability_effect_code: 'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
    ambiguity_warning_code: WARNING_CODE,
    interpretation_payload_id: '1'.repeat(64),
    lawyer_note_digest: '2'.repeat(64),
  };
  assert.equal(copyDeliveryInterpretationAllowed(ambiguous, metric), true);
  assert.equal(copyDeliveryInterpretationAllowed({
    ...ambiguous,
    ambiguity_dimension_codes: ['OTHER_REVIEWED'],
  }, metric), false);
  assert.equal(copyDeliveryInterpretationAllowed({
    ...ambiguous,
    ambiguity_dimension_codes: ['REFERENT', 'REFERENT'],
  }, metric), false);
  assert.equal(copyDeliveryInterpretationAllowed({
    ...ambiguous,
    comparability_effect_code: 'AMBIGUITY_EFFECT_UNRESOLVED',
  }, metric), false);
  assert.equal(copyDeliveryInterpretationAllowed({
    clarity_state: 'CLEAR',
    ambiguity_dimension_codes: [],
  }, metric), true);
});

test('F16 governs the QXO source and normalisation lineage required in F17', () => {
  const attributes = fixture().required_claim_attributes;
  assert.deepEqual(attributes.source_raw_duration, {
    magnitude: '24',
    unit: 'HOURS',
    day_basis: 'ELAPSED',
  });
  assert.equal(
    attributes.outside_cap_semantic_code,
    'PROMPTLY_AND_NO_LATER_THAN_STATED_DURATION',
  );
  assert.equal(
    attributes.normalisation_payload_digest,
    fixture().normalisation_contract.normalisation_payload_digest,
  );
  assert.equal(
    attributes.source_timing_claim_revision_id,
    fixture().normalisation_contract.source_metric_lineage
      .source_timing_claim_revision_id,
  );
  assert.match(attributes.trigger_expression_id, /^[a-f0-9]{64}$/);
  assert.match(attributes.definition_scope_closure_id, /^[a-f0-9]{64}$/);
});

test('F17 must remint claim occurrence identity under explicit reclassification lineage', () => {
  const reclassification = fixture().claim_reclassification_contract;
  assert.equal(
    reclassification.predecessor_claim_definition_key,
    'NO_SHOP_NOTICE_PERIOD_DAYS',
  );
  assert.equal(
    reclassification.successor_claim_definition_key,
    'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
  );
  assert.equal(reclassification.claim_occurrence_continuity, 'PROHIBITED');
  assert.equal(reclassification.successor_claim_occurrence_must_be_reminted, true);
  assert.equal(reclassification.reclassification_lineage_required_in_f17, true);
});

test('the active cohort compiler refuses the candidate-only fingerprint', () => {
  assert.throws(() => compileMarketCohortRequest({
    serving_namespace_id: '1'.repeat(64),
    corpus_release_id: '2'.repeat(64),
    contract_fingerprint: compileFixtureContractV12().fingerprint,
    metric_key: METRIC_KEY,
    metric_version: 1,
    concept_key: 'NOSOL-NOTICE',
    party: {
      role: 'TARGET',
      value: 'COMPANY',
      capacity: 'COVENANT_OBLIGOR',
    },
    subject_deal_key: 'deal:qxo-topbuild',
    filters: {},
  }), /does not match a frozen serving contract/);
});

test('F16 grants no claim, result, release, query or live authority', () => {
  const status = fixture().status;
  assert.equal(status.metric_definition_authority, 'OFFLINE_GOVERNED_ONLY');
  assert.equal(status.candidate_projection_authority, 'NONE');
  assert.equal(status.claim_materialisation_authority, 'NONE');
  assert.equal(status.result_materialisation_authority, 'NONE');
  assert.equal(status.candidate_release_authority, 'NONE');
  assert.equal(status.active_serving_authority, 'NONE');
  assert.equal(status.active_query_authority, 'NONE');
  assert.equal(status.active_pointer_authority, 'NONE');
  assert.equal(status.publication_blocked, true);
  assert.equal(status.release_eligible, false);
});

test('the staging runner verifies F16 through the bounded existing read path', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /--copy-delivery-metric-f16-verify/);
  assert.match(source, /LIMIT 2/);
  const start = source.indexOf(
    'function buildCopyDeliveryMetricF16Attestation',
  );
  const end = source.indexOf('\nfunction ', start + 1);
  assert.doesNotMatch(
    source.slice(start, end),
    /\b(?:INSERT|UPDATE|DELETE|UPSERT)\b/,
  );
});

test('all F16 identities are pinned', () => {
  const value = fixture();
  assert.equal(
    value.qxo_no_shop_copy_delivery_metric_f16_id,
    '2cf61241fbf6c17bc642322943ba950b6664ec1447c9c3e3ec0adcd3804428bc',
  );
  assert.equal(
    value.canonical_payload_digest,
    'bd802b68186e77586676b4792564795c353d8d7c0d51f5edc59d7bd88add651d',
  );
});
