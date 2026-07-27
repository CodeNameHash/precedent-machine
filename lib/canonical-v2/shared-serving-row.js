const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  validateClaimRevisionIdentity,
  validateRelationshipRevisionIdentity,
} = require('./claims-relationships');
const {
  validateContractBundle,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  fixtureContractForFingerprint,
  moneyDenominatorPrecisionPolicyForClaim,
} = require('./contract-bundle');
const {
  compileMarketCohortRequest,
  compileOfflineInterpretedMarketCohortRequest,
  validateOfflineInterpretedMarketCohortResult,
  validateOfflineInterpretedMarketCohortRequest,
  validateMarketCohortResult,
} = require('./market-cohort-query');
const {
  METRIC_DEFINITIONS,
  buildFixtureResultComponent,
  metricDefinitionId,
  validateDimensions,
  validateProjectedMetricSlotOutput,
} = require('./serving-projection');
const {
  validateClaimInterpretation,
  validateInterpretedPresentClaimRevision,
} = require('./claim-interpretation');
const {
  EFFECT_KEYS: TERMINATION_FEE_TRIGGER_EFFECT_KEYS,
  triggerPathSchemaForBinding,
  validateTerminationFeeTriggerEffect,
} = require('./termination-fee-trigger-path');

const SHA256_RE = /^[a-f0-9]{64}$/;
const SHARED_ROW_VARIANTS = Object.freeze({
  CANONICAL_RESULT: Object.freeze({
    body_key: 'canonical_result',
    forbidden_body_keys: Object.freeze(['incomplete_canonical_result', 'reviewed_source_specific']),
    producer_status: 'IMPLEMENTED_FIXTURE',
  }),
  INCOMPLETE_CANONICAL_RESULT: Object.freeze({
    body_key: 'incomplete_canonical_result',
    forbidden_body_keys: Object.freeze(['canonical_result', 'reviewed_source_specific']),
    producer_status: 'IMPLEMENTED_FIXTURE',
  }),
  REVIEWED_SOURCE_SPECIFIC: Object.freeze({
    body_key: 'reviewed_source_specific',
    forbidden_body_keys: Object.freeze(['canonical_result', 'incomplete_canonical_result']),
    producer_status: 'IMPLEMENTED_FIXTURE',
  }),
});

const COMMON_KEYS = Object.freeze([
  'schema_version',
  'row_kind',
  'corpus_release_id',
  'frozen_pair_id',
  'governed_deal_key',
  'deal_admission_id',
  'row_serving_key',
  'serving_contract',
  'provenance',
  'source_actions',
  'canonical_payload_digest',
]);

const CANONICAL_RESULT_KEYS = Object.freeze([
  'result_key',
  'result_version',
  'concept_key',
  'concept_version',
  'party',
  'result_completeness',
  'market_comparability',
  'governed_reason_codes',
  'derived_result_occurrence_id',
  'derived_result_revision_id',
  'result_ordinal',
  'components',
  'refinable_dimensions',
  'market_context',
  'source_detail_state',
]);

const INCOMPLETE_CANONICAL_RESULT_KEYS = Object.freeze([
  'result_key',
  'result_version',
  'concept_key',
  'concept_version',
  'party',
  'result_completeness',
  'market_comparability',
  'governed_reason_codes',
  'derived_result_occurrence_id',
  'derived_result_revision_id',
  'result_ordinal',
  'components',
  'intersecting_candidates',
  'refinable_dimensions',
  'metric_exclusion',
  'source_detail_state',
]);

const INCOMPLETE_METRIC_EXCLUSION_KEYS = Object.freeze([
  'metric_definition_id',
  'metric_key',
  'metric_version',
  'metric_slot_key',
  'exclusion_serving_key',
  'exclusion_reason',
  'cohort_membership',
  'aggregate_authority',
]);

const INCOMPLETE_REASON_CODES = Object.freeze([
  'UNMAPPED_MEASUREMENT_PERIOD',
]);

const INTERSECTING_CANDIDATE_KEYS = Object.freeze([
  'open_world_candidate_occurrence_id',
  'final_disposition_id',
  'semantic_impact_closure_id',
  'impact_value',
]);

const COMPONENT_KEYS = Object.freeze([
  'component_occurrence_id',
  'component_revision_id',
  'component_slot_key',
  'governed_ordinal',
  'component_state',
  'claim_occurrence_id',
  'claim_revision_id',
  'claim_definition_key',
  'claim_definition_version',
  'claim_attributes',
  'claim_scope_closure_id',
  'claim_scope',
  'composition_scope_closure_id',
  'result_input_lineage_digest',
  'relationship_revision_ids',
  'relationship_total',
  'relationship_set_digest',
  'bounded_relationship_effects',
  'raw_value',
  'canonical_value',
  'unit',
  'day_basis',
  'denominator',
  'derivation_version',
]);

const BOUNDED_RELATIONSHIP_EFFECT_KEYS = Object.freeze([
  'relationship_revision_id',
  'relationship_definition_key',
  'state',
  'effect',
]);

const COHORT_COUNT_KEYS = Object.freeze([
  'eligible_deals',
  'applicable_deals',
  'examined_deals',
  'present_deals',
  'comparable_deals',
  'distribution_deals',
  'excluded_deals',
  'observation_slots',
  'excluded_slots',
]);

const SOURCE_ACTION_KEYS = Object.freeze([
  'action_slot_key',
  'action_version',
  'action_definition_id',
  'action_definition_payload_digest',
  'detail_kind',
  'source_detail_reference_id',
  'source_detail_payload_id',
  'parent_edge_id',
  'governed_ordinal',
]);

const REVIEWED_SOURCE_SPECIFIC_KEYS = Object.freeze([
  'candidate_occurrence',
  'final_disposition',
  'reviewed_display_label',
  'non_comparable_reason',
  'observed_party_tokens',
  'primitive_collection',
  'bounded_inline_primitives',
  'semantic_impact_closure',
  'evidence_references',
  'market_comparability',
  'source_detail_state',
]);

const SOURCE_SPECIFIC_CANDIDATE_OCCURRENCE_KEYS = Object.freeze([
  'open_world_candidate_occurrence_id',
  'candidate_id',
  'candidate_kind',
  'admission_state',
  'document_hash',
  'ordered_proposition_evidence_reference_ids',
  'observed_party_token_digest',
  'governed_ordinal',
  'neutral_proposition_digest',
]);

const SOURCE_SPECIFIC_DISPOSITION_KEYS = Object.freeze([
  'final_disposition_id',
  'disposition_code',
  'review_state',
  'reviewed_display_label',
  'non_comparable_reason',
]);

const SOURCE_SPECIFIC_PRIMITIVE_COLLECTION_KEYS = Object.freeze([
  'primitive_collection_root_id',
  'primitive_collection_digest',
  'total',
  'inline_count',
  'overflow_child_collection_key',
]);

const SOURCE_SPECIFIC_PRIMITIVE_KEYS = Object.freeze([
  'primitive_id',
  'primitive_kind',
  'governed_ordinal',
  'raw_value',
  'interpreted_value',
  'evidence_reference_ids',
]);

const SOURCE_SPECIFIC_IMPACT_KEYS = Object.freeze([
  'semantic_impact_closure_id',
  'impact_value',
  'affected_canonical_result_occurrence_ids',
  'market_authority',
]);

const SOURCE_SPECIFIC_EVIDENCE_KEYS = Object.freeze([
  'evidence_reference_id',
  'evidence_role',
  'excerpt_id',
  'semantic_span_id',
  'document_hash',
  'absolute_start',
  'absolute_end',
  'exact_bytes_digest',
  'governed_ordinal',
]);

const FORBIDDEN_KEYS = new Set([
  'error',
  'cache_key',
  'request_id',
  'execution_id',
  'timestamp',
  'nonce',
  'cursor',
  'signature',
  'url',
  'credentials',
  'object_store_path',
  'cards',
  'claims',
  'observations',
  'hydrated_provisions',
  'candidate_manifest',
  'review_payload',
  'attestation',
  'correction_payload',
]);

const QXO_TAIL_CONDITIONS = Object.freeze([
  'COMPETING_PROPOSAL_PUBLICLY_PENDING',
  'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
  'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
]);
const QXO_BUYER_TAIL_CONDITIONS = Object.freeze([
  ...QXO_TAIL_CONDITIONS,
  'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED',
]);
const QXO_BUYER_INTERVENING_EVENT_TAIL_CONDITIONS = Object.freeze([
  'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
  'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
  'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED',
]);
const SELLER_FEE_TRIGGER_TERMS = Object.freeze({
  SUPERIOR_PROPOSAL_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'COMPANY',
    payment_timing: 'CONCURRENT_WITH_TERMINATION',
    conditions: Object.freeze([]),
  })]),
  CHANGE_IN_RECOMMENDATION_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'PARENT',
    payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
    conditions: Object.freeze([]),
  })]),
  ACQUISITION_PROPOSAL_TAIL: Object.freeze([Object.freeze({
    terminating_party: 'EITHER_OR_PARENT_AS_SPECIFIED',
    payment_timing: 'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
    conditions: Object.freeze([
      'PUBLIC_COMPANY_ALTERNATIVE_TRANSACTION_NOT_WITHDRAWN',
      'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
      'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
    ]),
  })]),
  NO_SOLICIT_BREACH_TERMINATION: Object.freeze([
    Object.freeze({
      terminating_party: 'PARENT',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      conditions: Object.freeze([]),
    }),
    Object.freeze({
      terminating_party: 'PARENT',
      payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
      conditions: QXO_TAIL_CONDITIONS,
    }),
  ]),
  STOCKHOLDER_APPROVAL_FAILURE_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'EITHER_OR_PARENT_AS_SPECIFIED',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: Object.freeze([
      ...QXO_TAIL_CONDITIONS,
      'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED',
    ]),
  })]),
  COUNTERPARTY_COVENANT_BREACH_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'PARENT',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: QXO_TAIL_CONDITIONS,
  })]),
  INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'PARENT',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: QXO_TAIL_CONDITIONS,
  })]),
});
const BUYER_FEE_TRIGGER_TERMS = Object.freeze({
  CHANGE_IN_RECOMMENDATION_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'COMPANY',
    payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
    conditions: Object.freeze([]),
  })]),
  NO_SOLICIT_BREACH_TERMINATION: Object.freeze([
    Object.freeze({
      terminating_party: 'COMPANY',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      conditions: Object.freeze([]),
    }),
    Object.freeze({
      terminating_party: 'COMPANY',
      payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
      conditions: QXO_BUYER_TAIL_CONDITIONS,
    }),
  ]),
  STOCKHOLDER_APPROVAL_FAILURE_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'EITHER_OR_COMPANY_AS_SPECIFIED',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: QXO_BUYER_TAIL_CONDITIONS,
  })]),
  COUNTERPARTY_COVENANT_BREACH_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'COMPANY',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: QXO_BUYER_TAIL_CONDITIONS,
  })]),
  INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION: Object.freeze([Object.freeze({
    terminating_party: 'COMPANY',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: QXO_BUYER_INTERVENING_EVENT_TAIL_CONDITIONS,
  })]),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) throw new TypeError(`${label} must be a full SHA-256 content ID`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer`);
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new TypeError(`${label} fields do not match the frozen contract`);
}

function validateMoneyDenominatorForContract({
  governingContract,
  claimDefinitionKey,
  claimState,
  denominator,
  claimAttributes,
  label = 'money denominator',
} = {}) {
  const policy = moneyDenominatorPrecisionPolicyForClaim(
    governingContract,
    claimDefinitionKey,
  );
  const precisionRequired = policy?.required_claim_state === claimState;
  requireExactKeys(
    denominator,
    precisionRequired
      ? ['value', 'currency', 'basis', 'source_lineage_ids', 'precision']
      : ['value', 'currency', 'basis', 'source_lineage_ids'],
    label,
  );
  if (precisionRequired) {
    const authoritativePrecision = denominator.precision;
    if (!policy.allowed_precision_values.includes(authoritativePrecision)
      || claimAttributes?.denominator_precision !== authoritativePrecision) {
      throw new TypeError(`${label} has invalid or mismatched denominator precision`);
    }
  }
  return true;
}

function metricAllowsCanonicalValue(metric, value) {
  if (Array.isArray(metric.allowed_canonical_values)) {
    return metric.allowed_canonical_values.some((allowed) => canonicalJson(allowed) === canonicalJson(value));
  }
  return metric.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING'
    && typeof value === 'string'
    && /^(0|[1-9]\d*)(\.\d+)?$/.test(value);
}

function validateMetricOperationBinding({
  governingContract,
  metric,
  body,
  component,
} = {}) {
  if (!governingContract || !metric || !body || !component
    || !Array.isArray(body.components)
    || !body.components.every((item) => Array.isArray(item.bounded_relationship_effects))) {
    throw new TypeError('metric-operation binding validation requires a governed result');
  }
  const bindings = governingContract?.serving_metric_operation_bindings || [];
  const metricBinding = bindings.find((binding) => (
    binding.metric_key === metric?.metric_key
    && binding.metric_version === metric?.metric_version
  )) || null;
  const governedOperations = new Set(bindings.map((binding) => binding.legal_operation));
  const observedGovernedEffects = body.components.flatMap(
    (item) => item.bounded_relationship_effects,
  ).filter((relationship) => governedOperations.has(relationship.effect.legal_operation));

  if (observedGovernedEffects.some((relationship) => (
    metricBinding === null
    || relationship.relationship_definition_key !== metricBinding.relationship_key
    || relationship.effect.legal_operation !== metricBinding.legal_operation
  ))) {
    throw new TypeError('bound legal operation crosses its frozen metric-operation binding');
  }
  if (metricBinding === null) return null;

  if (metricBinding.concept_key !== metric.concept_key
    || metricBinding.required_claim_definition_key !== metric.required_claim_definition_key
    || body.concept_key !== metricBinding.concept_key
    || canonicalJson(body.party) !== canonicalJson(metricBinding.payer)
    || component.claim_definition_key !== metricBinding.required_claim_definition_key
    || component.claim_attributes.fee_side !== metricBinding.fee_side
    || component.claim_attributes.payee_value !== metricBinding.payee.value
    || component.claim_attributes.payee_capacity !== metricBinding.payee.capacity
    || component.bounded_relationship_effects.length === 0
    || component.bounded_relationship_effects.some((relationship) => (
      relationship.relationship_definition_key !== metricBinding.relationship_key
      || relationship.effect.legal_operation !== metricBinding.legal_operation
    ))) {
    throw new TypeError('canonical result does not match its frozen metric-operation binding');
  }
  return metricBinding;
}

function assertNoForbiddenPayload(value, path = 'row') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPayload(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new TypeError(`${path}.${key} is forbidden in SharedServingRow`);
    if (child === 'FAILED' || child === 'BLOCKED' || child === 'OTHER') {
      throw new TypeError(`${path}.${key} contains a forbidden serving state`);
    }
    assertNoForbiddenPayload(child, `${path}.${key}`);
  }
}

function servingContract(contractFingerprint) {
  const contract = fixtureContractForFingerprint(contractFingerprint);
  if (!contract) throw new TypeError('fixture serving contract fingerprint is unrecognised');
  const exactDetailActions = contract.serving_exact_detail_action_definitions.map(
    (action) => action.action_slot_key,
  );
  return {
    access_registry_digest: contentId('SERVING_OBJECT_ACCESS_REGISTRY/V1', {
      contract_fingerprint: contractFingerprint,
      allowed_row_kinds: Object.keys(SHARED_ROW_VARIANTS),
    }),
    offline_denylist_digest: contentId('SERVING_OFFLINE_DENYLIST/V1', {
      contract_fingerprint: contractFingerprint,
      forbidden_keys: [...FORBIDDEN_KEYS].sort(),
    }),
    embedded_reference_allowlist_digest: contentId('SERVING_EMBEDDED_REFERENCE_ALLOWLIST/V1', {
      contract_fingerprint: contractFingerprint,
      source_actions: exactDetailActions.sort(),
    }),
  };
}

function validateSourceActions(row, body) {
  if (!Array.isArray(row.source_actions) || row.source_actions.length > 1) {
    throw new TypeError('fixture source_actions must contain at most one governed action');
  }
  if (row.source_actions.length === 0) {
    requireExactKeys(body.source_detail_state, ['state', 'reason_code'], 'canonical_result.source_detail_state');
    if (body.source_detail_state.state !== 'UNAVAILABLE'
      || body.source_detail_state.reason_code !== 'EXACT_DETAIL_PROJECTION_NOT_BUILT') {
      throw new TypeError('a row without source actions requires its exact no-detail reason');
    }
    return;
  }
  const action = row.source_actions[0];
  const contract = fixtureContractForFingerprint(row.provenance.contract_fingerprint);
  const definition = contract?.serving_exact_detail_action_definitions.find(
    (entry) => entry.action_slot_key === action.action_slot_key,
  );
  if (!definition) throw new TypeError('source action is outside the frozen exact-detail contract');
  const expectedParentKind = row.row_kind === 'CANONICAL_RESULT'
    ? 'RESULT_ROW'
    : row.row_kind === 'INCOMPLETE_CANONICAL_RESULT'
      ? 'RESULT_ROW'
    : row.row_kind === 'REVIEWED_SOURCE_SPECIFIC'
      ? 'REVIEWED_SOURCE_SPECIFIC_ROW'
      : null;
  requireExactKeys(action, SOURCE_ACTION_KEYS, 'source_actions[0]');
  for (const key of [
    'action_definition_id',
    'action_definition_payload_digest',
    'source_detail_reference_id',
    'source_detail_payload_id',
    'parent_edge_id',
  ]) requireDigest(action[key], `source_actions[0].${key}`);
  if (definition.parent_kind !== expectedParentKind
    || action.action_version !== definition.action_version
    || action.action_definition_id !== definition.action_definition_id
    || action.action_definition_payload_digest !== definition.action_definition_payload_digest
    || action.detail_kind !== definition.detail_kind
    || action.governed_ordinal !== 0) {
    throw new TypeError('source action is outside the frozen exact-detail contract');
  }
  requireExactKeys(body.source_detail_state, ['state', 'reason_code'], 'canonical_result.source_detail_state');
  if (body.source_detail_state.state !== 'AVAILABLE'
    || body.source_detail_state.reason_code !== 'EXACT_DETAIL_CERTIFIED') {
    throw new TypeError('a row with a source action requires certified exact detail');
  }
}

function buildCanonicalResultServingRow({
  contract_bundle,
  frozen_pair_id,
  projection_output,
  cohort_request,
  cohort_result,
  context_components = [],
  result_ordinal = 0,
}) {
  validateContractBundle(contract_bundle);
  requireDigest(frozen_pair_id, 'frozen_pair_id');
  validateProjectedMetricSlotOutput(projection_output);
  if (!projection_output.observation) throw new TypeError('only a comparable market observation can produce a canonical serving row');
  if (!Array.isArray(context_components) || context_components.length > 15) {
    throw new TypeError('context_components must contain at most 15 components');
  }
  if (!Number.isInteger(result_ordinal) || result_ordinal < 0) throw new TypeError('result_ordinal must be a non-negative integer');
  const observation = projection_output.observation;
  const compiledRequest = compileMarketCohortRequest(cohort_request);
  validateMarketCohortResult(cohort_result, compiledRequest);
  if (observation.contract_fingerprint !== contract_bundle.fingerprint
    || observation.corpus_release_id !== compiledRequest.corpus_release_id
    || observation.deal_key !== compiledRequest.subject_deal_key
    || observation.metric_key !== compiledRequest.metric_key
    || observation.metric_version !== compiledRequest.metric_version
    || observation.concept_key !== compiledRequest.concept_key
    || observation.basis_key !== compiledRequest.basis_key
    || canonicalJson(observation.party) !== canonicalJson(compiledRequest.party)) {
    throw new TypeError('observation, cohort and selected-deal identities do not agree');
  }
  if (observation.result_completeness !== 'COMPLETE'
    || observation.market_comparability !== 'COMPARABLE'
    || observation.state !== 'PRESENT') {
    throw new TypeError('canonical serving rows require a complete, comparable PRESENT result');
  }

  const derivedResultOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V1', {
    schema_version: 'DERIVED_RESULT_OCCURRENCE/V1',
    deal_admission_id: observation.deal_admission_id,
    result_key: observation.result_key,
    result_version: observation.result_version,
    concept_key: observation.concept_key,
    party: observation.party,
    result_ordinal,
  });
  const relationshipSetDigest = contentId('RESULT_RELATIONSHIP_SET/V1', {
    schema_version: 'RESULT_RELATIONSHIP_SET/V1',
    result_key: observation.result_key,
    result_version: observation.result_version,
    relationship_revision_ids: observation.relationship_revision_ids,
    relationship_effect_digests: observation.relationship_effect_digests,
    relationship_total: observation.relationship_revision_ids.length,
  });
  const component = {
    component_occurrence_id: observation.owner_occurrence_id,
    component_revision_id: observation.owner_revision_id,
    component_slot_key: observation.value_slot_key,
    governed_ordinal: observation.ordinal,
    component_state: observation.state,
    claim_occurrence_id: observation.claim_occurrence_id,
    claim_revision_id: observation.claim_revision_id,
    claim_definition_key: observation.claim_definition_key,
    claim_definition_version: observation.claim_definition_version,
    claim_attributes: clone(observation.claim_attributes),
    claim_scope_closure_id: observation.claim_scope_closure_id,
    claim_scope: clone(observation.claim_scope),
    composition_scope_closure_id: observation.composition_scope_closure_id,
    result_input_lineage_digest: observation.result_input_lineage_digest,
    relationship_revision_ids: clone(observation.relationship_revision_ids),
    relationship_total: observation.relationship_revision_ids.length,
    relationship_set_digest: relationshipSetDigest,
    bounded_relationship_effects: observation.relationship_effects.map((relationship) => ({
      relationship_revision_id: relationship.relationship_revision_id,
      relationship_definition_key: relationship.relationship_definition_key,
      state: relationship.state,
      effect: clone(relationship.effect),
    })),
    raw_value: clone(observation.raw_value),
    canonical_value: clone(observation.canonical_value),
    unit: observation.unit,
    day_basis: observation.day_basis,
    denominator: clone(observation.denominator),
    derivation_version: observation.derivation_version,
  };
  const components = [
    component,
    ...context_components.map((input) => projectContextResultComponent({
      dealAdmissionId: observation.deal_admission_id,
      resultKey: observation.result_key,
      resultVersion: observation.result_version,
      conceptKey: observation.concept_key,
      party: observation.party,
      ...input,
    })),
  ];
  const componentOrder = components.map((item) => item.governed_ordinal);
  if (canonicalJson(componentOrder) !== canonicalJson([...componentOrder].sort((left, right) => left - right))
    || new Set(componentOrder).size !== components.length
    || new Set(components.map((item) => item.component_slot_key)).size !== components.length
    || new Set(components.map((item) => item.component_occurrence_id)).size !== components.length
    || new Set(components.map((item) => item.component_revision_id)).size !== components.length) {
    throw new TypeError('canonical result components must have unique deterministic source order');
  }
  const derivedResultRevisionId = contentId('DERIVED_RESULT_REVISION/V1', {
    schema_version: 'DERIVED_RESULT_REVISION/V1',
    derived_result_occurrence_id: derivedResultOccurrenceId,
    component_revision_ids: components.map((item) => item.component_revision_id),
    relationship_set_digests: components.map((item) => item.relationship_set_digest),
    result_completeness: 'COMPLETE',
    market_comparability: 'COMPARABLE',
  });
  const rowServingKey = contentId('RESULT_SERVING_ROW/V1', {
    corpus_release_id: observation.corpus_release_id,
    derived_result_occurrence_id: derivedResultOccurrenceId,
  });
  const counts = clone(cohort_result.counts);
  const canonicalResult = {
    result_key: observation.result_key,
    result_version: observation.result_version,
    concept_key: observation.concept_key,
    concept_version: 1,
    party: clone(observation.party),
    result_completeness: 'COMPLETE',
    market_comparability: 'COMPARABLE',
    governed_reason_codes: [],
    derived_result_occurrence_id: derivedResultOccurrenceId,
    derived_result_revision_id: derivedResultRevisionId,
    result_ordinal,
    components,
    refinable_dimensions: {
      sector: observation.sector,
      buyer: observation.buyer,
      merger_form: observation.merger_form,
      adviser_firms: clone(observation.adviser_firms),
      lawyers: clone(observation.lawyers),
      announce_year: observation.announce_year,
      deal_value_usd: observation.deal_value_usd,
    },
    market_context: {
      metric_definition_id: observation.metric_definition_id,
      metric_key: observation.metric_key,
      metric_version: observation.metric_version,
      subject_observation: {
        market_observation_serving_key: observation.market_observation_serving_key,
        metric_observation_occurrence_id: observation.metric_observation_occurrence_id,
        metric_slot_key: observation.metric_slot_key,
        canonical_value: clone(observation.canonical_value),
        canonical_unit: observation.canonical_unit,
        basis_key: observation.basis_key,
        unit: observation.unit,
        day_basis: observation.day_basis,
        denominator: clone(observation.denominator),
        derivation_version: observation.derivation_version,
      },
      cohort: {
        cohort_digest: cohort_result.cohort_digest,
        counts,
        distribution: clone(cohort_result.distribution),
        exclusions: clone(cohort_result.exclusions),
      },
      denominators: {
        prevalence: {
          kind: 'EXAMINED_ELIGIBLE_APPLICABLE_DEALS',
          deal_count: counts.examined_deals,
        },
        distribution: {
          kind: 'COMPARABLE_PRESENT_DEALS',
          deal_count: counts.distribution_deals,
        },
      },
    },
    source_detail_state: {
      state: 'UNAVAILABLE',
      reason_code: 'EXACT_DETAIL_PROJECTION_NOT_BUILT',
    },
  };
  const body = {
    schema_version: 'SHARED_SERVING_ROW/V1',
    row_kind: 'CANONICAL_RESULT',
    corpus_release_id: observation.corpus_release_id,
    frozen_pair_id,
    governed_deal_key: observation.deal_key,
    deal_admission_id: observation.deal_admission_id,
    row_serving_key: rowServingKey,
    serving_contract: servingContract(contract_bundle.fingerprint),
    provenance: {
      contract_fingerprint: contract_bundle.fingerprint,
      metric_observation_occurrence_id: observation.metric_observation_occurrence_id,
      market_observation_serving_key: observation.market_observation_serving_key,
      metric_slot_key: observation.metric_slot_key,
      owner_occurrence_id: observation.owner_occurrence_id,
      owner_revision_id: observation.owner_revision_id,
    },
    source_actions: [],
    canonical_result: canonicalResult,
  };
  const row = {
    ...body,
    canonical_payload_digest: contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body),
  };
  validateSharedServingRow(row);
  return Object.freeze(row);
}

function buildIncompleteCanonicalResultServingRow({
  contract_bundle,
  frozen_pair_id,
  projection_output,
  result,
  claim,
  relationships = [],
  governed_reason_codes,
  intersecting_candidates,
  result_ordinal = 0,
} = {}) {
  validateContractBundle(contract_bundle);
  requireDigest(frozen_pair_id, 'frozen_pair_id');
  validateProjectedMetricSlotOutput(projection_output);
  if (projection_output.observation || !projection_output.exclusion) {
    throw new TypeError('an incomplete canonical serving row requires one excluded metric slot');
  }
  if (!Array.isArray(relationships) || relationships.length > 15) {
    throw new TypeError('relationships must contain at most 15 rows');
  }
  if (!Number.isInteger(result_ordinal) || result_ordinal < 0) {
    throw new TypeError('result_ordinal must be a non-negative integer');
  }
  const reasons = [...new Set(governed_reason_codes || [])].sort();
  if (canonicalJson(reasons) !== canonicalJson(['UNMAPPED_MEASUREMENT_PERIOD'])) {
    throw new TypeError('incomplete canonical result requires the governed unmapped-period reason');
  }
  if (!Array.isArray(intersecting_candidates) || intersecting_candidates.length !== 1) {
    throw new TypeError('fixture incomplete canonical result requires one intersecting open-world candidate');
  }
  const candidates = clone(intersecting_candidates);
  candidates.forEach((candidate, index) => {
    requireExactKeys(candidate, INTERSECTING_CANDIDATE_KEYS, `intersecting_candidates[${index}]`);
    for (const key of [
      'open_world_candidate_occurrence_id', 'final_disposition_id', 'semantic_impact_closure_id',
    ]) requireDigest(candidate[key], `intersecting_candidates[${index}].${key}`);
    if (candidate.impact_value !== 'AFFECTS_CANONICAL_RESULT') {
      throw new TypeError('intersecting candidate must affect the incomplete canonical result');
    }
  });
  validateClaimRevisionIdentity(claim);
  relationships.forEach(validateRelationshipRevisionIdentity);
  const exclusion = projection_output.exclusion;
  const expectedResult = buildFixtureResultComponent({
    deal_admission_id: exclusion.deal_admission_id,
    result_key: exclusion.result_key,
    result_version: exclusion.result_version,
    concept_key: exclusion.concept_key,
    party: exclusion.party,
    value_slot_key: exclusion.value_slot_key,
    ordinal: exclusion.ordinal,
    claim,
    relationships,
    composition_scope_closure_id: result?.composition_scope_closure_id,
    completeness: 'INCOMPLETE',
    comparability: 'NOT_CERTIFIED',
  });
  if (canonicalJson(result) !== canonicalJson(expectedResult)
    || exclusion.exclusion_reason !== 'RESULT_INCOMPLETE'
    || exclusion.result_completeness !== 'INCOMPLETE'
    || exclusion.market_comparability !== 'NOT_CERTIFIED'
    || exclusion.comparability_state !== 'NOT_CERTIFIED'
    || exclusion.cohort_membership !== 'NO_COHORT_MEMBERSHIP'
    || exclusion.aggregate_authority !== 'NO_AGGREGATE_AUTHORITY'
    || exclusion.owner_occurrence_id !== result.component_occurrence_id
    || exclusion.owner_revision_id !== result.component_revision_id
    || exclusion.claim_occurrence_id !== claim.claim_occurrence_id
    || exclusion.claim_revision_id !== claim.claim_revision_id) {
    throw new TypeError('incomplete result, claim and metric exclusion do not close over one lineage');
  }

  const relationshipFields = relationshipServingFields(
    exclusion.result_key,
    exclusion.result_version,
    relationships,
  );
  const component = {
    component_occurrence_id: result.component_occurrence_id,
    component_revision_id: result.component_revision_id,
    component_slot_key: result.value_slot_key,
    governed_ordinal: result.ordinal,
    component_state: claim.state,
    claim_occurrence_id: claim.claim_occurrence_id,
    claim_revision_id: claim.claim_revision_id,
    claim_definition_key: claim.claim_definition_key,
    claim_definition_version: claim.claim_definition_version,
    claim_attributes: clone(claim.attributes),
    claim_scope_closure_id: claim.scope?.scope_closure_id || null,
    claim_scope: clone(claim.scope),
    composition_scope_closure_id: result.composition_scope_closure_id,
    result_input_lineage_digest: result.input_lineage_digest,
    ...relationshipFields,
    raw_value: clone(claim.raw_value),
    canonical_value: clone(claim.canonical_value),
    unit: claim.unit,
    day_basis: claim.day_basis,
    denominator: clone(claim.denominator),
    derivation_version: claim.derivation_version,
  };
  const derivedResultOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V1', {
    schema_version: 'DERIVED_RESULT_OCCURRENCE/V1',
    deal_admission_id: exclusion.deal_admission_id,
    result_key: exclusion.result_key,
    result_version: exclusion.result_version,
    concept_key: exclusion.concept_key,
    party: exclusion.party,
    result_ordinal,
  });
  const derivedResultRevisionId = contentId('DERIVED_RESULT_REVISION/V1', {
    schema_version: 'DERIVED_RESULT_REVISION/V1',
    derived_result_occurrence_id: derivedResultOccurrenceId,
    component_revision_ids: [component.component_revision_id],
    relationship_set_digests: [component.relationship_set_digest],
    result_completeness: 'INCOMPLETE_NOVEL_SEMANTIC',
    market_comparability: 'NOT_CERTIFIED',
    governed_reason_codes: reasons,
    intersecting_candidates: candidates,
  });
  const rowServingKey = contentId('INCOMPLETE_RESULT_SERVING_ROW/V1', {
    corpus_release_id: exclusion.corpus_release_id,
    derived_result_occurrence_id: derivedResultOccurrenceId,
  });
  const bodyValue = {
    result_key: exclusion.result_key,
    result_version: exclusion.result_version,
    concept_key: exclusion.concept_key,
    concept_version: 1,
    party: clone(exclusion.party),
    result_completeness: 'INCOMPLETE_NOVEL_SEMANTIC',
    market_comparability: 'NOT_CERTIFIED',
    governed_reason_codes: reasons,
    derived_result_occurrence_id: derivedResultOccurrenceId,
    derived_result_revision_id: derivedResultRevisionId,
    result_ordinal,
    components: [component],
    intersecting_candidates: candidates,
    refinable_dimensions: validateDimensions(exclusion.dimensions),
    metric_exclusion: {
      metric_definition_id: exclusion.metric_definition_id,
      metric_key: exclusion.metric_key,
      metric_version: exclusion.metric_version,
      metric_slot_key: exclusion.metric_slot_key,
      exclusion_serving_key: exclusion.exclusion_serving_key,
      exclusion_reason: exclusion.exclusion_reason,
      cohort_membership: exclusion.cohort_membership,
      aggregate_authority: exclusion.aggregate_authority,
    },
    source_detail_state: {
      state: 'UNAVAILABLE',
      reason_code: 'EXACT_DETAIL_PROJECTION_NOT_BUILT',
    },
  };
  const body = {
    schema_version: 'SHARED_SERVING_ROW/V1',
    row_kind: 'INCOMPLETE_CANONICAL_RESULT',
    corpus_release_id: exclusion.corpus_release_id,
    frozen_pair_id,
    governed_deal_key: exclusion.deal_key,
    deal_admission_id: exclusion.deal_admission_id,
    row_serving_key: rowServingKey,
    serving_contract: servingContract(contract_bundle.fingerprint),
    provenance: {
      contract_fingerprint: contract_bundle.fingerprint,
      metric_slot_key: exclusion.metric_slot_key,
      exclusion_serving_key: exclusion.exclusion_serving_key,
      owner_occurrence_id: exclusion.owner_occurrence_id,
      owner_revision_id: exclusion.owner_revision_id,
      claim_revision_id: exclusion.claim_revision_id,
      intersecting_candidate_set_digest: contentId(
        'INTERSECTING_OPEN_WORLD_CANDIDATE_SET/V1',
        candidates,
      ),
    },
    source_actions: [],
    incomplete_canonical_result: bodyValue,
  };
  const row = {
    ...body,
    canonical_payload_digest: contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body),
  };
  validateSharedServingRow(row);
  return Object.freeze(row);
}

function buildReviewedSourceSpecificServingRow({
  contract_bundle,
  frozen_pair_id,
  corpus_release_id,
  governed_deal_key,
  deal_admission_id,
  candidate_occurrence,
  final_disposition,
  observed_party_tokens,
  primitive_collection,
  bounded_inline_primitives,
  semantic_impact_closure,
  evidence_references,
} = {}) {
  validateContractBundle(contract_bundle);
  requireDigest(frozen_pair_id, 'frozen_pair_id');
  requireDigest(corpus_release_id, 'corpus_release_id');
  requireDigest(deal_admission_id, 'deal_admission_id');
  requireText(governed_deal_key, 'governed_deal_key');
  const bodyValue = {
    candidate_occurrence: clone(candidate_occurrence),
    final_disposition: clone(final_disposition),
    reviewed_display_label: final_disposition?.reviewed_display_label,
    non_comparable_reason: final_disposition?.non_comparable_reason,
    observed_party_tokens: clone(observed_party_tokens),
    primitive_collection: clone(primitive_collection),
    bounded_inline_primitives: clone(bounded_inline_primitives),
    semantic_impact_closure: clone(semantic_impact_closure),
    evidence_references: clone(evidence_references),
    market_comparability: 'REVIEWED_SOURCE_SPECIFIC',
    source_detail_state: {
      state: 'UNAVAILABLE',
      reason_code: 'EXACT_DETAIL_PROJECTION_NOT_BUILT',
    },
  };
  const rowServingKey = contentId('REVIEWED_SOURCE_SPECIFIC_ROW/V1', {
    corpus_release_id,
    open_world_candidate_occurrence_id: candidate_occurrence?.open_world_candidate_occurrence_id,
  });
  const body = {
    schema_version: 'SHARED_SERVING_ROW/V1',
    row_kind: 'REVIEWED_SOURCE_SPECIFIC',
    corpus_release_id,
    frozen_pair_id,
    governed_deal_key: governed_deal_key.trim(),
    deal_admission_id,
    row_serving_key: rowServingKey,
    serving_contract: servingContract(contract_bundle.fingerprint),
    provenance: {
      contract_fingerprint: contract_bundle.fingerprint,
      open_world_candidate_occurrence_id: candidate_occurrence?.open_world_candidate_occurrence_id,
      final_disposition_id: final_disposition?.final_disposition_id,
      primitive_collection_root_id: primitive_collection?.primitive_collection_root_id,
      semantic_impact_closure_id: semantic_impact_closure?.semantic_impact_closure_id,
    },
    source_actions: [],
    reviewed_source_specific: bodyValue,
  };
  const row = {
    ...body,
    canonical_payload_digest: contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body),
  };
  validateSharedServingRow(row);
  return Object.freeze(row);
}

function relationshipServingFields(resultKey, resultVersion, relationships) {
  const relationshipRevisionIds = relationships
    .map((relationship) => relationship.relationship_revision_id)
    .sort();
  const relationshipEffectDigests = relationships
    .map((relationship) => contentId('RELATIONSHIP_EFFECT/V1', relationship.effect))
    .sort();
  const relationshipSetDigest = contentId('RESULT_RELATIONSHIP_SET/V1', {
    schema_version: 'RESULT_RELATIONSHIP_SET/V1',
    result_key: resultKey,
    result_version: resultVersion,
    relationship_revision_ids: relationshipRevisionIds,
    relationship_effect_digests: relationshipEffectDigests,
    relationship_total: relationshipRevisionIds.length,
  });
  return {
    relationship_revision_ids: relationshipRevisionIds,
    relationship_total: relationshipRevisionIds.length,
    relationship_set_digest: relationshipSetDigest,
    bounded_relationship_effects: relationships.map((relationship) => ({
      relationship_revision_id: relationship.relationship_revision_id,
      relationship_definition_key: relationship.relationship_definition_key,
      state: relationship.state,
      effect: clone(relationship.effect),
    })),
  };
}

function projectContextResultComponent({
  dealAdmissionId,
  resultKey,
  resultVersion,
  conceptKey,
  party,
  component,
  claim,
  relationships = [],
}) {
  validateClaimRevisionIdentity(claim);
  relationships.forEach(validateRelationshipRevisionIdentity);
  const expected = buildFixtureResultComponent({
    deal_admission_id: dealAdmissionId,
    result_key: resultKey,
    result_version: resultVersion,
    concept_key: conceptKey,
    party,
    value_slot_key: component.value_slot_key,
    ordinal: component.ordinal,
    claim,
    relationships,
    composition_scope_closure_id: component.composition_scope_closure_id,
    completeness: component.completeness,
    comparability: component.comparability,
  });
  if (canonicalJson(component) !== canonicalJson(expected)
    || component.completeness !== 'COMPLETE'
    || component.comparability !== 'COMPARABLE') {
    throw new TypeError('context result component does not match its canonical inputs');
  }
  return {
    component_occurrence_id: component.component_occurrence_id,
    component_revision_id: component.component_revision_id,
    component_slot_key: component.value_slot_key,
    governed_ordinal: component.ordinal,
    component_state: claim.state,
    claim_occurrence_id: claim.claim_occurrence_id,
    claim_revision_id: claim.claim_revision_id,
    claim_definition_key: claim.claim_definition_key,
    claim_definition_version: claim.claim_definition_version,
    claim_attributes: clone(claim.attributes),
    claim_scope_closure_id: claim.scope?.scope_closure_id || null,
    claim_scope: clone(claim.scope),
    composition_scope_closure_id: component.composition_scope_closure_id,
    result_input_lineage_digest: component.input_lineage_digest,
    ...relationshipServingFields(resultKey, resultVersion, relationships),
    raw_value: clone(claim.raw_value),
    canonical_value: clone(claim.canonical_value),
    unit: claim.unit,
    day_basis: claim.day_basis,
    denominator: clone(claim.denominator),
    derivation_version: claim.derivation_version,
  };
}

function validateReviewedSourceSpecificBody(body, row) {
  requireExactKeys(body, REVIEWED_SOURCE_SPECIFIC_KEYS, 'reviewed_source_specific');
  if (body.market_comparability !== 'REVIEWED_SOURCE_SPECIFIC') {
    throw new TypeError('reviewed source-specific row must be explicitly non-comparable');
  }
  requireText(body.reviewed_display_label, 'reviewed_source_specific.reviewed_display_label');
  requireText(body.non_comparable_reason, 'reviewed_source_specific.non_comparable_reason');

  const occurrence = body.candidate_occurrence;
  requireExactKeys(occurrence, SOURCE_SPECIFIC_CANDIDATE_OCCURRENCE_KEYS, 'reviewed_source_specific.candidate_occurrence');
  for (const key of ['open_world_candidate_occurrence_id', 'candidate_id', 'document_hash', 'observed_party_token_digest', 'neutral_proposition_digest']) {
    requireDigest(occurrence[key], `reviewed_source_specific.candidate_occurrence.${key}`);
  }
  if (occurrence.candidate_kind !== 'CONCEPT' || occurrence.admission_state !== 'ADMITTED_SEMANTIC') {
    throw new TypeError('reviewed source-specific row requires an admitted semantic concept candidate');
  }
  requireNonNegativeInteger(occurrence.governed_ordinal, 'reviewed_source_specific.candidate_occurrence.governed_ordinal');

  if (!Array.isArray(body.observed_party_tokens) || body.observed_party_tokens.length < 1
    || body.observed_party_tokens.some((token) => typeof token !== 'string' || !token.trim())
    || canonicalJson(body.observed_party_tokens) !== canonicalJson([...new Set(body.observed_party_tokens)].sort())) {
    throw new TypeError('reviewed source-specific observed party tokens must be a non-empty sorted set');
  }
  const expectedPartyTokenDigest = contentId('OBSERVED_PARTY_TOKEN_SET/V1', body.observed_party_tokens);
  if (occurrence.observed_party_token_digest !== expectedPartyTokenDigest) {
    throw new TypeError('reviewed source-specific party-token identity mismatch');
  }

  if (!Array.isArray(body.evidence_references) || body.evidence_references.length < 1 || body.evidence_references.length > 16) {
    throw new TypeError('reviewed source-specific evidence references must be bounded and non-empty');
  }
  const evidenceIds = new Set();
  body.evidence_references.forEach((evidence, index) => {
    requireExactKeys(evidence, SOURCE_SPECIFIC_EVIDENCE_KEYS, `reviewed_source_specific.evidence_references[${index}]`);
    for (const key of ['evidence_reference_id', 'excerpt_id', 'semantic_span_id', 'document_hash', 'exact_bytes_digest']) {
      requireDigest(evidence[key], `reviewed_source_specific.evidence_references[${index}].${key}`);
    }
    requireText(evidence.evidence_role, `reviewed_source_specific.evidence_references[${index}].evidence_role`);
    requireNonNegativeInteger(evidence.absolute_start, `reviewed_source_specific.evidence_references[${index}].absolute_start`);
    requireNonNegativeInteger(evidence.absolute_end, `reviewed_source_specific.evidence_references[${index}].absolute_end`);
    requireNonNegativeInteger(evidence.governed_ordinal, `reviewed_source_specific.evidence_references[${index}].governed_ordinal`);
    if (evidence.absolute_end <= evidence.absolute_start || evidence.governed_ordinal !== index) {
      throw new TypeError('reviewed source-specific evidence ordering or offsets are invalid');
    }
    const { evidence_reference_id: evidenceReferenceId, ...evidenceBody } = evidence;
    if (evidenceReferenceId !== contentId('OPEN_WORLD_EVIDENCE_REFERENCE/V1', evidenceBody)) {
      throw new TypeError('reviewed source-specific evidence identity mismatch');
    }
    if (evidence.document_hash !== occurrence.document_hash || evidenceIds.has(evidenceReferenceId)) {
      throw new TypeError('reviewed source-specific evidence source or uniqueness mismatch');
    }
    evidenceIds.add(evidenceReferenceId);
  });
  if (!Array.isArray(occurrence.ordered_proposition_evidence_reference_ids)
    || occurrence.ordered_proposition_evidence_reference_ids.length < 1
    || occurrence.ordered_proposition_evidence_reference_ids.some((id) => !evidenceIds.has(id))) {
    throw new TypeError('candidate occurrence lacks its exact ordered proposition evidence');
  }
  const expectedCandidateId = contentId('NOVEL_CONCEPT_CANDIDATE/V1', {
    schema_version: 'NOVEL_CONCEPT_CANDIDATE/V1',
    candidate_kind: occurrence.candidate_kind,
    document_hash: occurrence.document_hash,
    ordered_proposition_evidence_reference_ids: occurrence.ordered_proposition_evidence_reference_ids,
    observed_party_token_digest: occurrence.observed_party_token_digest,
    governed_ordinal: occurrence.governed_ordinal,
    neutral_proposition_digest: occurrence.neutral_proposition_digest,
  });
  const expectedOccurrenceId = contentId('OPEN_WORLD_CANDIDATE_OCCURRENCE/V1', {
    schema_version: 'OPEN_WORLD_CANDIDATE_OCCURRENCE/V1',
    candidate_id: expectedCandidateId,
    admission_state: occurrence.admission_state,
    document_hash: occurrence.document_hash,
    ordered_proposition_evidence_reference_ids: occurrence.ordered_proposition_evidence_reference_ids,
    observed_party_token_digest: occurrence.observed_party_token_digest,
    governed_ordinal: occurrence.governed_ordinal,
    neutral_proposition_digest: occurrence.neutral_proposition_digest,
  });
  if (occurrence.candidate_id !== expectedCandidateId
    || occurrence.open_world_candidate_occurrence_id !== expectedOccurrenceId) {
    throw new TypeError('reviewed source-specific candidate occurrence identity mismatch');
  }

  const disposition = body.final_disposition;
  requireExactKeys(disposition, SOURCE_SPECIFIC_DISPOSITION_KEYS, 'reviewed_source_specific.final_disposition');
  requireDigest(disposition.final_disposition_id, 'reviewed_source_specific.final_disposition.final_disposition_id');
  if (disposition.disposition_code !== 'REVIEWED_SOURCE_SPECIFIC'
    || disposition.review_state !== 'FINAL'
    || disposition.reviewed_display_label !== body.reviewed_display_label
    || disposition.non_comparable_reason !== body.non_comparable_reason) {
    throw new TypeError('reviewed source-specific final disposition is incomplete');
  }
  const expectedDispositionId = contentId('OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1', {
    schema_version: 'OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1',
    open_world_candidate_occurrence_id: occurrence.open_world_candidate_occurrence_id,
    disposition_code: disposition.disposition_code,
    review_state: disposition.review_state,
    reviewed_display_label: disposition.reviewed_display_label,
    non_comparable_reason: disposition.non_comparable_reason,
  });
  if (disposition.final_disposition_id !== expectedDispositionId) {
    throw new TypeError('reviewed source-specific disposition identity mismatch');
  }

  if (!Array.isArray(body.bounded_inline_primitives)
    || body.bounded_inline_primitives.length < 1
    || body.bounded_inline_primitives.length > 16) {
    throw new TypeError('reviewed source-specific primitives must be bounded and non-empty');
  }
  const primitiveIds = new Set();
  body.bounded_inline_primitives.forEach((primitive, index) => {
    requireExactKeys(primitive, SOURCE_SPECIFIC_PRIMITIVE_KEYS, `reviewed_source_specific.bounded_inline_primitives[${index}]`);
    requireDigest(primitive.primitive_id, `reviewed_source_specific.bounded_inline_primitives[${index}].primitive_id`);
    requireText(primitive.primitive_kind, `reviewed_source_specific.bounded_inline_primitives[${index}].primitive_kind`);
    requireText(primitive.raw_value, `reviewed_source_specific.bounded_inline_primitives[${index}].raw_value`);
    requireText(primitive.interpreted_value, `reviewed_source_specific.bounded_inline_primitives[${index}].interpreted_value`);
    requireNonNegativeInteger(primitive.governed_ordinal, `reviewed_source_specific.bounded_inline_primitives[${index}].governed_ordinal`);
    if (primitive.governed_ordinal !== index
      || !Array.isArray(primitive.evidence_reference_ids)
      || primitive.evidence_reference_ids.length < 1
      || primitive.evidence_reference_ids.some((id) => !evidenceIds.has(id))) {
      throw new TypeError('reviewed source-specific primitive evidence or ordering is invalid');
    }
    const { primitive_id: primitiveId, ...primitiveBody } = primitive;
    const expectedPrimitiveId = contentId('OPEN_WORLD_LEGAL_PRIMITIVE/V1', {
      open_world_candidate_occurrence_id: occurrence.open_world_candidate_occurrence_id,
      ...primitiveBody,
    });
    if (primitiveId !== expectedPrimitiveId || primitiveIds.has(primitiveId)) {
      throw new TypeError('reviewed source-specific primitive identity mismatch');
    }
    primitiveIds.add(primitiveId);
  });
  const primitiveCollection = body.primitive_collection;
  requireExactKeys(primitiveCollection, SOURCE_SPECIFIC_PRIMITIVE_COLLECTION_KEYS, 'reviewed_source_specific.primitive_collection');
  requireDigest(primitiveCollection.primitive_collection_root_id, 'reviewed_source_specific.primitive_collection.primitive_collection_root_id');
  requireDigest(primitiveCollection.primitive_collection_digest, 'reviewed_source_specific.primitive_collection.primitive_collection_digest');
  requireNonNegativeInteger(primitiveCollection.total, 'reviewed_source_specific.primitive_collection.total');
  requireNonNegativeInteger(primitiveCollection.inline_count, 'reviewed_source_specific.primitive_collection.inline_count');
  if (primitiveCollection.total !== body.bounded_inline_primitives.length
    || primitiveCollection.inline_count !== body.bounded_inline_primitives.length
    || primitiveCollection.overflow_child_collection_key !== null) {
    throw new TypeError('fixture source-specific primitive collection must be completely inlined');
  }
  const expectedPrimitiveDigest = contentId('OPEN_WORLD_PRIMITIVE_COLLECTION/V1', body.bounded_inline_primitives);
  const expectedPrimitiveRootId = contentId('OPEN_WORLD_PRIMITIVE_COLLECTION_ROOT/V1', {
    open_world_candidate_occurrence_id: occurrence.open_world_candidate_occurrence_id,
    primitive_collection_digest: expectedPrimitiveDigest,
    total: primitiveCollection.total,
  });
  if (primitiveCollection.primitive_collection_digest !== expectedPrimitiveDigest
    || primitiveCollection.primitive_collection_root_id !== expectedPrimitiveRootId) {
    throw new TypeError('reviewed source-specific primitive collection identity mismatch');
  }

  const impact = body.semantic_impact_closure;
  requireExactKeys(impact, SOURCE_SPECIFIC_IMPACT_KEYS, 'reviewed_source_specific.semantic_impact_closure');
  requireDigest(impact.semantic_impact_closure_id, 'reviewed_source_specific.semantic_impact_closure.semantic_impact_closure_id');
  if (impact.impact_value !== 'REVIEW_ONLY_SOURCE_SPECIFIC'
    || impact.market_authority !== 'NO_MARKET_AUTHORITY'
    || !Array.isArray(impact.affected_canonical_result_occurrence_ids)
    || impact.affected_canonical_result_occurrence_ids.length !== 0) {
    throw new TypeError('reviewed source-specific impact must not claim canonical or market authority');
  }
  const expectedImpactId = contentId('SEMANTIC_IMPACT_CLOSURE/V1', {
    schema_version: 'SEMANTIC_IMPACT_CLOSURE/V1',
    open_world_candidate_occurrence_id: occurrence.open_world_candidate_occurrence_id,
    impact_value: impact.impact_value,
    affected_canonical_result_occurrence_ids: impact.affected_canonical_result_occurrence_ids,
    market_authority: impact.market_authority,
  });
  if (impact.semantic_impact_closure_id !== expectedImpactId) {
    throw new TypeError('reviewed source-specific impact closure identity mismatch');
  }
  validateSourceActions(row, body);
}

function validateIncompleteCanonicalResultBody(body, row) {
  requireExactKeys(body, INCOMPLETE_CANONICAL_RESULT_KEYS, 'incomplete_canonical_result');
  if (body.result_completeness !== 'INCOMPLETE_NOVEL_SEMANTIC'
    || body.market_comparability !== 'NOT_CERTIFIED') {
    throw new TypeError('incomplete canonical result has the wrong completeness or comparability state');
  }
  if (canonicalJson(body.governed_reason_codes) !== canonicalJson(INCOMPLETE_REASON_CODES)) {
    throw new TypeError('incomplete canonical result has an ungoverned reason code');
  }
  if (!Array.isArray(body.intersecting_candidates) || body.intersecting_candidates.length !== 1) {
    throw new TypeError('fixture incomplete canonical result requires one intersecting candidate');
  }
  body.intersecting_candidates.forEach((candidate, index) => {
    requireExactKeys(candidate, INTERSECTING_CANDIDATE_KEYS, `incomplete_canonical_result.intersecting_candidates[${index}]`);
    for (const key of [
      'open_world_candidate_occurrence_id', 'final_disposition_id', 'semantic_impact_closure_id',
    ]) requireDigest(candidate[key], `incomplete_canonical_result.intersecting_candidates[${index}].${key}`);
    if (candidate.impact_value !== 'AFFECTS_CANONICAL_RESULT') {
      throw new TypeError('intersecting candidate does not affect the incomplete result');
    }
  });
  if (!Array.isArray(body.components) || body.components.length !== 1) {
    throw new TypeError('fixture incomplete canonical result requires one bounded component');
  }
  const component = body.components[0];
  requireExactKeys(component, COMPONENT_KEYS, 'incomplete_canonical_result.components[0]');
  for (const [key, value] of Object.entries(component)) {
    if (key.endsWith('_id') && value !== null) requireDigest(value, `incomplete component.${key}`);
  }
  if (component.component_state !== 'PRESENT'
    || typeof component.raw_value !== 'string'
    || !component.raw_value.trim()
    || typeof component.canonical_value !== 'string'
    || !/^(0|[1-9]\d*)(\.\d+)?$/.test(component.canonical_value)
    || !component.claim_attributes
    || typeof component.claim_attributes !== 'object'
    || Array.isArray(component.claim_attributes)) {
    throw new TypeError('incomplete canonical result must retain one typed PRESENT component');
  }
  requireExactKeys(component.claim_scope, [
    'scope_closure_id', 'coverage_status', 'required_interval_ids', 'examined_interval_ids',
  ], 'incomplete_canonical_result.components[0].claim_scope');
  requireDigest(component.claim_scope.scope_closure_id, 'incomplete component claim scope closure');
  const requiredIntervals = [...component.claim_scope.required_interval_ids].sort();
  const examinedIntervals = [...component.claim_scope.examined_interval_ids].sort();
  if (component.claim_scope_closure_id !== component.claim_scope.scope_closure_id
    || component.claim_scope.coverage_status !== 'COMPLETE'
    || requiredIntervals.length < 1
    || canonicalJson(requiredIntervals) !== canonicalJson(examinedIntervals)) {
    throw new TypeError('incomplete component must retain complete exact source scope');
  }
  [...requiredIntervals, ...examinedIntervals].forEach((id, index) => requireDigest(
    id,
    `incomplete component claim scope interval ${index}`,
  ));
  if (!Array.isArray(component.relationship_revision_ids)
    || component.relationship_revision_ids.length !== 0
    || component.relationship_total !== 0
    || !Array.isArray(component.bounded_relationship_effects)
    || component.bounded_relationship_effects.length !== 0) {
    throw new TypeError('fixture incomplete material-contract result cannot invent relationships');
  }
  const expectedRelationshipSetDigest = contentId('RESULT_RELATIONSHIP_SET/V1', {
    schema_version: 'RESULT_RELATIONSHIP_SET/V1',
    result_key: body.result_key,
    result_version: body.result_version,
    relationship_revision_ids: [],
    relationship_effect_digests: [],
    relationship_total: 0,
  });
  if (component.relationship_set_digest !== expectedRelationshipSetDigest) {
    throw new TypeError('incomplete component relationship-set identity mismatch');
  }

  requireExactKeys(body.metric_exclusion, INCOMPLETE_METRIC_EXCLUSION_KEYS, 'incomplete_canonical_result.metric_exclusion');
  const exclusion = body.metric_exclusion;
  for (const key of ['metric_definition_id', 'metric_slot_key', 'exclusion_serving_key']) {
    requireDigest(exclusion[key], `incomplete_canonical_result.metric_exclusion.${key}`);
  }
  const metric = METRIC_DEFINITIONS[exclusion.metric_key];
  const governingContract = fixtureContractForFingerprint(row.provenance.contract_fingerprint);
  if (!metric
    || !governingContract
    || metric.value_dimension !== 'MONEY_RELATIVE_TO_DEAL_VALUE'
    || metric.concept_key !== body.concept_key
    || metric.required_claim_definition_key !== component.claim_definition_key
    || metric.metric_version !== exclusion.metric_version
    || metricDefinitionId(metric) !== exclusion.metric_definition_id
    || exclusion.exclusion_reason !== 'RESULT_INCOMPLETE'
    || exclusion.cohort_membership !== 'NO_COHORT_MEMBERSHIP'
    || exclusion.aggregate_authority !== 'NO_AGGREGATE_AUTHORITY'
    || component.unit !== metric.canonical_unit
    || component.day_basis !== null
    || !metricAllowsCanonicalValue(metric, component.canonical_value)) {
    throw new TypeError('incomplete metric exclusion does not match the frozen metric contract');
  }
  validateMoneyDenominatorForContract({
    governingContract,
    claimDefinitionKey: component.claim_definition_key,
    claimState: component.component_state,
    denominator: component.denominator,
    claimAttributes: component.claim_attributes,
    label: 'incomplete component denominator',
  });
  if (component.denominator.currency !== metric.currency
    || component.denominator.basis !== metric.denominator_basis
    || !Array.isArray(component.denominator.source_lineage_ids)
    || component.denominator.source_lineage_ids.length < 1) {
    throw new TypeError('incomplete money component lacks its governed deal-value denominator');
  }
  component.denominator.source_lineage_ids.forEach((id, index) => requireDigest(
    id,
    `incomplete component denominator lineage ${index}`,
  ));

  const expectedComponentOccurrenceId = contentId('RESULT_COMPONENT_OCCURRENCE/V1', {
    schema_version: 'RESULT_COMPONENT_OCCURRENCE/V1',
    deal_admission_id: row.deal_admission_id,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  const expectedInputLineageDigest = contentId('RESULT_INPUT_LINEAGE/V1', {
    schema_version: 'RESULT_INPUT_LINEAGE/V1',
    component_occurrence_id: expectedComponentOccurrenceId,
    claim_revision_ids: [component.claim_revision_id],
    relationship_revision_ids: [],
    relationship_effect_digests: [],
  });
  const expectedComponentRevisionId = contentId('RESULT_COMPONENT_REVISION/V1', {
    schema_version: 'RESULT_COMPONENT_REVISION/V1',
    component_occurrence_id: expectedComponentOccurrenceId,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
    claim_revision_ids: [component.claim_revision_id],
    relationship_revision_ids: [],
    relationship_effect_digests: [],
    composition_scope_closure_id: component.composition_scope_closure_id,
    input_lineage_digest: expectedInputLineageDigest,
    completeness: 'INCOMPLETE',
    comparability: 'NOT_CERTIFIED',
  });
  if (component.component_occurrence_id !== expectedComponentOccurrenceId
    || component.result_input_lineage_digest !== expectedInputLineageDigest
    || component.component_revision_id !== expectedComponentRevisionId) {
    throw new TypeError('incomplete result component identity mismatch');
  }
  const expectedMetricSlotKey = contentId('MARKET_METRIC_SLOT/V1', {
    schema_version: 'MARKET_METRIC_SLOT/V1',
    metric_definition_id: exclusion.metric_definition_id,
    deal_key: row.governed_deal_key,
    deal_admission_id: row.deal_admission_id,
    concept_key: body.concept_key,
    metric_key: exclusion.metric_key,
    metric_version: exclusion.metric_version,
    party: body.party,
    result_key: body.result_key,
    result_version: body.result_version,
    owner_type: 'RESULT_COMPONENT_OCCURRENCE',
    owner_occurrence_id: expectedComponentOccurrenceId,
    scope_type: 'RESULT_COMPONENT_OCCURRENCE',
    scope_id: expectedComponentOccurrenceId,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  const expectedExclusionKey = contentId('MARKET_METRIC_SLOT_EXCLUSION/V1', {
    schema_version: 'MARKET_METRIC_SLOT_EXCLUSION/V1',
    corpus_release_id: row.corpus_release_id,
    metric_slot_key: expectedMetricSlotKey,
  });
  if (exclusion.metric_slot_key !== expectedMetricSlotKey
    || exclusion.exclusion_serving_key !== expectedExclusionKey
    || row.provenance.metric_slot_key !== expectedMetricSlotKey
    || row.provenance.exclusion_serving_key !== expectedExclusionKey
    || row.provenance.owner_occurrence_id !== component.component_occurrence_id
    || row.provenance.owner_revision_id !== component.component_revision_id
    || row.provenance.claim_revision_id !== component.claim_revision_id) {
    throw new TypeError('incomplete metric exclusion lineage does not match row provenance');
  }

  const expectedOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V1', {
    schema_version: 'DERIVED_RESULT_OCCURRENCE/V1',
    deal_admission_id: row.deal_admission_id,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    result_ordinal: body.result_ordinal,
  });
  const expectedRevisionId = contentId('DERIVED_RESULT_REVISION/V1', {
    schema_version: 'DERIVED_RESULT_REVISION/V1',
    derived_result_occurrence_id: expectedOccurrenceId,
    component_revision_ids: [component.component_revision_id],
    relationship_set_digests: [component.relationship_set_digest],
    result_completeness: body.result_completeness,
    market_comparability: body.market_comparability,
    governed_reason_codes: body.governed_reason_codes,
    intersecting_candidates: body.intersecting_candidates,
  });
  if (body.derived_result_occurrence_id !== expectedOccurrenceId
    || body.derived_result_revision_id !== expectedRevisionId
    || row.provenance.intersecting_candidate_set_digest !== contentId(
      'INTERSECTING_OPEN_WORLD_CANDIDATE_SET/V1',
      body.intersecting_candidates,
    )) {
    throw new TypeError('incomplete derived result or intersecting-candidate identity mismatch');
  }
  const dimensions = validateDimensions(body.refinable_dimensions);
  if (canonicalJson(dimensions) !== canonicalJson(body.refinable_dimensions)) {
    throw new TypeError('incomplete result dimensions are not canonical');
  }
  validateSourceActions(row, body);
}

function validateCanonicalResultBody(body, row) {
  requireExactKeys(body, CANONICAL_RESULT_KEYS, 'canonical_result');
  if (body.result_completeness !== 'COMPLETE' || body.market_comparability !== 'COMPARABLE') {
    throw new TypeError('canonical result is not complete and comparable');
  }
  if (!Array.isArray(body.governed_reason_codes) || body.governed_reason_codes.length !== 0) {
    throw new TypeError('complete canonical result cannot carry governed reason codes');
  }
  if (!Array.isArray(body.components) || body.components.length < 1 || body.components.length > 16) {
    throw new TypeError('fixture canonical result requires between one and 16 bounded components');
  }
  const ordinals = body.components.map((component) => component.governed_ordinal);
  if (canonicalJson(ordinals) !== canonicalJson([...ordinals].sort((left, right) => left - right))
    || new Set(ordinals).size !== body.components.length
    || new Set(body.components.map((component) => component.component_slot_key)).size !== body.components.length
    || new Set(body.components.map((component) => component.component_occurrence_id)).size !== body.components.length
    || new Set(body.components.map((component) => component.component_revision_id)).size !== body.components.length) {
    throw new TypeError('canonical result components are not a unique governed sequence');
  }
  const relationshipEffectDigestsByComponent = body.components.map((component, componentIndex) => {
  requireExactKeys(component, COMPONENT_KEYS, `canonical_result.components[${componentIndex}]`);
  for (const [key, value] of Object.entries(component)) {
    if (key.endsWith('_id') && value !== null) requireDigest(value, `component.${key}`);
  }
  if (!['PRESENT', 'ABSENT'].includes(component.component_state)) {
    throw new TypeError('serving component must be PRESENT or scoped ABSENT');
  }
  requireText(component.claim_definition_key, 'component.claim_definition_key');
  if (!Number.isInteger(component.claim_definition_version) || component.claim_definition_version < 1) {
    throw new TypeError('component.claim_definition_version must be a positive integer');
  }
  if ((component.component_slot_key === 'ACCURACY_EXCEPTION'
      && component.claim_definition_key !== 'REPRESENTATION_ACCURACY_EXCEPTION')
    || (component.component_slot_key.startsWith('KNOWLEDGE_QUALIFIER_')
      && component.claim_definition_key !== 'KNOWLEDGE_QUALIFIER')) {
    throw new TypeError('context component slot does not match its governed claim definition');
  }
  if (!component.claim_attributes || typeof component.claim_attributes !== 'object'
    || Array.isArray(component.claim_attributes)
    || Buffer.byteLength(canonicalJson(component.claim_attributes), 'utf8') > 4096) {
    throw new TypeError('fixture component claim_attributes must be a bounded object');
  }
  if (component.component_state === 'PRESENT'
    && (typeof component.raw_value !== 'string' || !component.raw_value.trim()
      || Buffer.byteLength(component.raw_value, 'utf8') > 4096)) {
    throw new TypeError('PRESENT fixture component raw_value must be a bounded source string');
  }
  if (component.claim_scope !== null) {
    requireExactKeys(component.claim_scope, [
      'scope_closure_id', 'coverage_status', 'required_interval_ids', 'examined_interval_ids',
    ], `canonical_result.components[${componentIndex}].claim_scope`);
    requireDigest(component.claim_scope.scope_closure_id, 'component.claim_scope.scope_closure_id');
    if (component.claim_scope_closure_id !== component.claim_scope.scope_closure_id
      || !Array.isArray(component.claim_scope.required_interval_ids)
      || !Array.isArray(component.claim_scope.examined_interval_ids)) {
      throw new TypeError('component claim scope projection is invalid');
    }
    [...component.claim_scope.required_interval_ids, ...component.claim_scope.examined_interval_ids]
      .forEach((id, index) => requireDigest(id, `component.claim_scope.interval_ids[${index}]`));
  } else if (component.claim_scope_closure_id !== null) {
    throw new TypeError('component claim scope closure lacks its governed scope');
  }
  if (component.component_state === 'ABSENT') {
    const scope = component.claim_scope;
    if (component.raw_value !== null
      || component.canonical_value !== null
      || component.unit !== null
      || component.day_basis !== null
      || component.denominator !== null
      || !scope
      || scope.coverage_status !== 'COMPLETE'
      || scope.required_interval_ids.length < 1
      || canonicalJson([...scope.required_interval_ids].sort())
        !== canonicalJson([...scope.examined_interval_ids].sort())) {
      throw new TypeError('ABSENT serving component requires a complete exact scope and no asserted value');
    }
  }
  if (!Array.isArray(component.relationship_revision_ids)
    || component.relationship_revision_ids.length !== component.relationship_total
    || !Array.isArray(component.bounded_relationship_effects)
    || component.bounded_relationship_effects.length !== component.relationship_total) {
    throw new TypeError('component relationship projection is incomplete');
  }
  component.relationship_revision_ids.forEach((value, index) => requireDigest(value, `component.relationship_revision_ids[${index}]`));
  const relationshipEffectDigests = component.bounded_relationship_effects.map((relationship, index) => {
    requireExactKeys(relationship, BOUNDED_RELATIONSHIP_EFFECT_KEYS, `component.bounded_relationship_effects[${index}]`);
    requireDigest(relationship.relationship_revision_id, `component.bounded_relationship_effects[${index}].relationship_revision_id`);
    requireText(relationship.relationship_definition_key, `component.bounded_relationship_effects[${index}].relationship_definition_key`);
    if (relationship.state !== 'PRESENT' || relationship.effect == null) {
      throw new TypeError('a complete canonical result may contain only PRESENT bounded relationship effects');
    }
    const isBringDown = relationship.relationship_definition_key === 'BRINGS_DOWN';
    const isNoShopException = relationship.relationship_definition_key === 'EXCEPTED_BY';
    const isFeeTrigger = relationship.relationship_definition_key === 'TRIGGERED_BY';
    const relationshipContract = fixtureContractForFingerprint(row.provenance.contract_fingerprint);
    const feeBinding = relationshipContract?.serving_metric_operation_bindings?.find(
      (binding) => binding.legal_operation === relationship.effect.legal_operation,
    ) || null;
    const triggerPathSchema = feeBinding?.trigger_path_schema_key
      ? triggerPathSchemaForBinding(relationshipContract, feeBinding)
      : null;
    const isCapexException = isNoShopException
      && relationship.effect.legal_operation === 'EXCLUDES_CAPEX_RESTRICTION_WHEN_APPLICABLE';
    const effectKeys = relationship.effect.legal_operation === 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING'
      ? ['effect_mode', 'legal_operation', 'accuracy_standard', 'exception', 'time_points']
      : isBringDown
        ? ['effect_mode', 'legal_operation', 'accuracy_standard']
        : isCapexException
          ? ['effect_mode', 'legal_operation', 'restriction_period', 'obligors', 'exceptions', 'consent_standard']
          : isFeeTrigger && triggerPathSchema
            ? TERMINATION_FEE_TRIGGER_EFFECT_KEYS
          : isFeeTrigger
            ? ['effect_mode', 'legal_operation', 'trigger_code', 'terminating_party', 'payment_timing', 'conditions']
        : ['effect_mode', 'legal_operation', 'permitted_action', 'prerequisites'];
    requireExactKeys(relationship.effect, effectKeys, `component.bounded_relationship_effects[${index}].effect`);
    const validBringDown = isBringDown
      && ['TEST_ACCURACY_AT_CLOSING', 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING'].includes(
        relationship.effect.legal_operation,
      );
    const validNoShopException = isNoShopException
      && ['PERMITS_LIMITED_INFORMATION_SHARING', 'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS', 'PERMITS_CONFIDENTIALITY_AGREEMENT'].includes(
        relationship.effect.legal_operation,
      )
      && typeof relationship.effect.permitted_action === 'string'
      && relationship.effect.permitted_action.length > 0
      && Array.isArray(relationship.effect.prerequisites)
      && relationship.effect.prerequisites.length > 0;
    const validCapexException = isCapexException
      && relationship.effect.restriction_period === 'PRE_CLOSING_PERIOD'
      && canonicalJson(relationship.effect.obligors) === canonicalJson(['COMPANY', 'COMPANY_SUBSIDIARIES'])
      && canonicalJson(relationship.effect.exceptions) === canonicalJson([
        'REQUIRED_OR_CONTEMPLATED_BY_AGREEMENT_OR_LAW',
        'PARENT_WRITTEN_CONSENT',
        'COMPANY_DISCLOSURE_SCHEDULE',
      ])
      && relationship.effect.consent_standard === 'NOT_UNREASONABLY_WITHHELD_CONDITIONED_OR_DELAYED';
    const feeTriggerTerms = relationship.effect.legal_operation
      === 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER'
      ? SELLER_FEE_TRIGGER_TERMS
      : relationship.effect.legal_operation === 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER'
        ? BUYER_FEE_TRIGGER_TERMS
        : null;
    const expectedFeeTriggerOptions = feeTriggerTerms?.[relationship.effect.trigger_code] || [];
    const governedContract = fixtureContractForFingerprint(row.provenance.contract_fingerprint);
    const legalOperationPermitted = relationship.effect.legal_operation
      === 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER'
      || governedContract?.serving_metric_operation_bindings?.some(
        (binding) => binding.legal_operation === relationship.effect.legal_operation,
      );
    let validFeeTrigger = false;
    if (isFeeTrigger && triggerPathSchema) {
      validateTerminationFeeTriggerEffect(relationship.effect, {
        binding: feeBinding,
        schema: triggerPathSchema,
      });
      validFeeTrigger = true;
    } else {
      validFeeTrigger = isFeeTrigger
        && feeTriggerTerms !== null
        && legalOperationPermitted
        && expectedFeeTriggerOptions.some((option) => (
          relationship.effect.terminating_party === option.terminating_party
          && relationship.effect.payment_timing === option.payment_timing
          && canonicalJson(relationship.effect.conditions) === canonicalJson(option.conditions)
        ));
    }
    if (relationship.effect.effect_mode !== 'TYPED_LEGAL_EFFECT'
      || (!validBringDown && !validNoShopException && !validCapexException && !validFeeTrigger)) {
      throw new TypeError('fixture relationship effect is outside the frozen serving contract');
    }
    if (relationship.effect.legal_operation === 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING'
      && (relationship.effect.exception !== 'DE_MINIMIS_INACCURACIES'
        || canonicalJson(relationship.effect.time_points) !== canonicalJson([
          'SIGNING', 'CLOSING', 'EXPRESS_EARLIER_DATE_IF_APPLICABLE',
        ]))) {
      throw new TypeError('fixture signing-and-closing relationship effect is incomplete');
    }
    return contentId('RELATIONSHIP_EFFECT/V1', relationship.effect);
  }).sort();
  const boundedRelationshipRevisionIds = component.bounded_relationship_effects
    .map((relationship) => relationship.relationship_revision_id)
    .sort();
  if (canonicalJson(boundedRelationshipRevisionIds) !== canonicalJson([...component.relationship_revision_ids].sort())) {
    throw new TypeError('bounded relationship effects do not match the component relationship set');
  }
  const expectedRelationshipSetDigest = contentId('RESULT_RELATIONSHIP_SET/V1', {
    schema_version: 'RESULT_RELATIONSHIP_SET/V1',
    result_key: body.result_key,
    result_version: body.result_version,
    relationship_revision_ids: [...component.relationship_revision_ids].sort(),
    relationship_effect_digests: relationshipEffectDigests,
    relationship_total: component.relationship_total,
  });
  if (component.relationship_set_digest !== expectedRelationshipSetDigest) {
    throw new TypeError('component relationship set identity mismatch');
  }
  const expectedComponentOccurrenceId = contentId('RESULT_COMPONENT_OCCURRENCE/V1', {
    schema_version: 'RESULT_COMPONENT_OCCURRENCE/V1',
    deal_admission_id: row.deal_admission_id,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  if (component.component_occurrence_id !== expectedComponentOccurrenceId) {
    throw new TypeError('result component occurrence identity mismatch');
  }
  const expectedInputLineageDigest = contentId('RESULT_INPUT_LINEAGE/V1', {
    schema_version: 'RESULT_INPUT_LINEAGE/V1',
    component_occurrence_id: expectedComponentOccurrenceId,
    claim_revision_ids: [component.claim_revision_id],
    relationship_revision_ids: [...component.relationship_revision_ids].sort(),
    relationship_effect_digests: relationshipEffectDigests,
  });
  if (component.result_input_lineage_digest !== expectedInputLineageDigest) {
    throw new TypeError('result component input lineage identity mismatch');
  }
  const expectedComponentRevisionId = contentId('RESULT_COMPONENT_REVISION/V1', {
    schema_version: 'RESULT_COMPONENT_REVISION/V1',
    component_occurrence_id: expectedComponentOccurrenceId,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
    claim_revision_ids: [component.claim_revision_id],
    relationship_revision_ids: [...component.relationship_revision_ids].sort(),
    relationship_effect_digests: relationshipEffectDigests,
    composition_scope_closure_id: component.composition_scope_closure_id,
    input_lineage_digest: expectedInputLineageDigest,
    completeness: body.result_completeness,
    comparability: body.market_comparability,
  });
  if (component.component_revision_id !== expectedComponentRevisionId) {
    throw new TypeError('result component revision identity mismatch');
  }
  return relationshipEffectDigests;
  });
  const subjectComponentIndexes = body.components
    .map((component, index) => (
      component.component_occurrence_id === row.provenance.owner_occurrence_id
        && component.component_revision_id === row.provenance.owner_revision_id ? index : -1
    ))
    .filter((index) => index >= 0);
  if (subjectComponentIndexes.length !== 1 || subjectComponentIndexes[0] !== 0) {
    throw new TypeError('canonical result market subject lineage must resolve exactly to component zero');
  }
  const component = body.components[0];
  const relationshipEffectDigests = relationshipEffectDigestsByComponent[0];
  validateSourceActions(row, body);
  requireExactKeys(body.market_context, [
    'metric_definition_id', 'metric_key', 'metric_version', 'subject_observation', 'cohort', 'denominators',
  ], 'canonical_result.market_context');
  requireExactKeys(body.market_context.subject_observation, [
    'market_observation_serving_key',
    'metric_observation_occurrence_id',
    'metric_slot_key',
    'canonical_value',
    'canonical_unit',
    'basis_key',
    'unit',
    'day_basis',
    'denominator',
    'derivation_version',
  ], 'canonical_result.market_context.subject_observation');
  requireExactKeys(body.market_context.cohort, ['cohort_digest', 'counts', 'distribution', 'exclusions'], 'canonical_result.market_context.cohort');
  requireDigest(body.market_context.metric_definition_id, 'canonical_result.market_context.metric_definition_id');
  requireText(body.market_context.metric_key, 'canonical_result.market_context.metric_key');
  requireNonNegativeInteger(body.market_context.metric_version, 'canonical_result.market_context.metric_version');
  requireDigest(body.market_context.cohort.cohort_digest, 'canonical_result.market_context.cohort.cohort_digest');
  requireExactKeys(body.market_context.cohort.counts, COHORT_COUNT_KEYS, 'canonical_result.market_context.cohort.counts');
  COHORT_COUNT_KEYS.forEach((key) => requireNonNegativeInteger(
    body.market_context.cohort.counts[key],
    `canonical_result.market_context.cohort.counts.${key}`,
  ));
  const counts = body.market_context.cohort.counts;
  if (counts.eligible_deals < counts.applicable_deals
    || counts.applicable_deals < counts.examined_deals
    || counts.examined_deals < counts.present_deals
    || counts.present_deals < counts.comparable_deals
    || counts.comparable_deals < counts.distribution_deals
    || counts.eligible_deals < counts.excluded_deals
    || counts.observation_slots < counts.comparable_deals
    || counts.excluded_slots < counts.excluded_deals) {
    throw new TypeError('canonical result cohort counts violate governed denominator ordering');
  }
  if (!Array.isArray(body.market_context.cohort.distribution) || !Array.isArray(body.market_context.cohort.exclusions)) {
    throw new TypeError('canonical_result market cohort requires bounded distribution and exclusion arrays');
  }
  body.market_context.cohort.distribution.forEach((item, index) => {
    requireExactKeys(item, ['canonical_value', 'subject_count', 'deal_count'], `canonical_result.market_context.cohort.distribution[${index}]`);
    requireNonNegativeInteger(item.subject_count, `canonical_result.market_context.cohort.distribution[${index}].subject_count`);
    requireNonNegativeInteger(item.deal_count, `canonical_result.market_context.cohort.distribution[${index}].deal_count`);
    if (item.deal_count > counts.distribution_deals || item.subject_count < item.deal_count
      || item.subject_count > counts.observation_slots) {
      throw new TypeError('canonical result distribution count exceeds its governed denominator');
    }
  });
  body.market_context.cohort.exclusions.forEach((item, index) => {
    requireExactKeys(item, ['reason_code', 'slot_count', 'deal_count'], `canonical_result.market_context.cohort.exclusions[${index}]`);
    requireText(item.reason_code, `canonical_result.market_context.cohort.exclusions[${index}].reason_code`);
    requireNonNegativeInteger(item.slot_count, `canonical_result.market_context.cohort.exclusions[${index}].slot_count`);
    requireNonNegativeInteger(item.deal_count, `canonical_result.market_context.cohort.exclusions[${index}].deal_count`);
    if (item.deal_count > counts.excluded_deals || item.slot_count < item.deal_count
      || item.slot_count > counts.excluded_slots) {
      throw new TypeError('canonical result exclusion count exceeds its governed denominator');
    }
  });
  requireExactKeys(body.market_context.denominators, ['prevalence', 'distribution'], 'canonical_result.market_context.denominators');
  requireExactKeys(body.market_context.denominators.prevalence, ['kind', 'deal_count'], 'canonical_result.market_context.denominators.prevalence');
  requireExactKeys(body.market_context.denominators.distribution, ['kind', 'deal_count'], 'canonical_result.market_context.denominators.distribution');
  const subject = body.market_context.subject_observation;
  for (const key of ['market_observation_serving_key', 'metric_observation_occurrence_id', 'metric_slot_key']) {
    requireDigest(subject[key], `canonical_result.market_context.subject_observation.${key}`);
  }
  requireText(subject.basis_key, 'canonical_result.market_context.subject_observation.basis_key');
  const metric = METRIC_DEFINITIONS[body.market_context.metric_key];
  const governingContract = fixtureContractForFingerprint(row.provenance.contract_fingerprint);
  if (!governingContract
    || !metric
    || !governingContract.concepts.some((entry) => entry.concept_key === metric.concept_key)
    || !governingContract.claim_definitions.some(
      (entry) => entry.claim_definition_key === metric.required_claim_definition_key,
    )) {
    throw new TypeError('canonical result metric is outside its frozen contract version');
  }
  const metricOperationBinding = validateMetricOperationBinding({
    governingContract,
    metric,
    body,
    component,
  });
  if (metric.metric_key === 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE'
    && !metricOperationBinding?.trigger_path_schema_key
    && component.bounded_relationship_effects.length !== 6) {
    throw new TypeError('buyer termination fee result does not contain its six governed triggers');
  }
  const isMoneyMetric = metric?.value_dimension === 'MONEY_RELATIVE_TO_DEAL_VALUE';
  if (isMoneyMetric) {
    validateMoneyDenominatorForContract({
      governingContract,
      claimDefinitionKey: component.claim_definition_key,
      claimState: component.component_state,
      denominator: component.denominator,
      claimAttributes: component.claim_attributes,
      label: 'component.denominator',
    });
    requireText(component.denominator.value, 'component.denominator.value');
    if (!Array.isArray(component.denominator.source_lineage_ids)
      || component.denominator.source_lineage_ids.length === 0) {
      throw new TypeError('money component denominator requires exact source lineage');
    }
    component.denominator.source_lineage_ids.forEach((id, index) => requireDigest(
      id,
      `component.denominator.source_lineage_ids[${index}]`,
    ));
    if (component.unit !== metric.canonical_unit
      || component.denominator.basis !== metric.denominator_basis
      || component.denominator.currency !== metric.currency
      || canonicalJson(component.denominator) !== canonicalJson(subject.denominator)) {
      throw new TypeError('money component denominator does not match its governed metric');
    }
  } else if (component.denominator !== null || subject.denominator !== null) {
    throw new TypeError('non-money fixture metric cannot carry a deal-value denominator');
  }
  if (!metric
    || component.component_state !== 'PRESENT'
    || component.claim_definition_key !== metric.required_claim_definition_key
    || body.concept_key !== metric.concept_key
    || body.market_context.metric_version !== metric.metric_version
    || body.market_context.metric_definition_id !== metricDefinitionId(metric)
    || subject.canonical_unit !== metric.canonical_unit
    || subject.basis_key !== (metric.basis_key || metric.canonical_unit)
    || !metricAllowsCanonicalValue(metric, component.canonical_value)
    || component.canonical_value !== subject.canonical_value
    || component.unit !== subject.unit
    || component.day_basis !== subject.day_basis
    || component.derivation_version !== subject.derivation_version
    || component.bounded_relationship_effects.some((effect) => (
      metric.required_relationship_key
        ? effect.relationship_definition_key !== metric.required_relationship_key
          || (effect.relationship_definition_key === 'BRINGS_DOWN'
            && effect.effect.accuracy_standard !== component.canonical_value)
        : !['EXCEPTED_BY', 'TRIGGERED_BY'].includes(effect.relationship_definition_key)
    ))) {
    throw new TypeError('canonical result metric fields do not match the frozen metric contract');
  }
  const expectedComponentOccurrenceId = contentId('RESULT_COMPONENT_OCCURRENCE/V1', {
    schema_version: 'RESULT_COMPONENT_OCCURRENCE/V1',
    deal_admission_id: row.deal_admission_id,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  if (component.component_occurrence_id !== expectedComponentOccurrenceId) {
    throw new TypeError('result component occurrence identity mismatch');
  }
  const expectedInputLineageDigest = contentId('RESULT_INPUT_LINEAGE/V1', {
    schema_version: 'RESULT_INPUT_LINEAGE/V1',
    component_occurrence_id: expectedComponentOccurrenceId,
    claim_revision_ids: [component.claim_revision_id],
    relationship_revision_ids: [...component.relationship_revision_ids].sort(),
    relationship_effect_digests: relationshipEffectDigests,
  });
  if (component.result_input_lineage_digest !== expectedInputLineageDigest) {
    throw new TypeError('result component input lineage identity mismatch');
  }
  const expectedComponentRevisionId = contentId('RESULT_COMPONENT_REVISION/V1', {
    schema_version: 'RESULT_COMPONENT_REVISION/V1',
    component_occurrence_id: expectedComponentOccurrenceId,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
    claim_revision_ids: [component.claim_revision_id],
    relationship_revision_ids: [...component.relationship_revision_ids].sort(),
    relationship_effect_digests: relationshipEffectDigests,
    composition_scope_closure_id: component.composition_scope_closure_id,
    input_lineage_digest: expectedInputLineageDigest,
    completeness: body.result_completeness,
    comparability: body.market_comparability,
  });
  if (component.component_revision_id !== expectedComponentRevisionId) {
    throw new TypeError('result component revision identity mismatch');
  }
  const expectedMetricSlotKey = contentId('MARKET_METRIC_SLOT/V1', {
    schema_version: 'MARKET_METRIC_SLOT/V1',
    metric_definition_id: metricDefinitionId(metric),
    deal_key: row.governed_deal_key,
    deal_admission_id: row.deal_admission_id,
    concept_key: body.concept_key,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    party: body.party,
    result_key: body.result_key,
    result_version: body.result_version,
    owner_type: 'RESULT_COMPONENT_OCCURRENCE',
    owner_occurrence_id: expectedComponentOccurrenceId,
    scope_type: 'RESULT_COMPONENT_OCCURRENCE',
    scope_id: expectedComponentOccurrenceId,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  if (subject.metric_slot_key !== expectedMetricSlotKey) throw new TypeError('market metric slot identity mismatch');
  const expectedMetricOccurrenceId = contentId('METRIC_OBSERVATION_OCCURRENCE/V1', {
    schema_version: 'METRIC_OBSERVATION_OCCURRENCE/V1',
    deal_key: row.governed_deal_key,
    deal_admission_id: row.deal_admission_id,
    concept_key: body.concept_key,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    party: body.party,
    result_key: body.result_key,
    result_version: body.result_version,
    owner_type: 'RESULT_COMPONENT_OCCURRENCE',
    owner_occurrence_id: expectedComponentOccurrenceId,
    scope_type: 'RESULT_COMPONENT_OCCURRENCE',
    scope_id: expectedComponentOccurrenceId,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  if (subject.metric_observation_occurrence_id !== expectedMetricOccurrenceId
    || subject.market_observation_serving_key !== contentId('MARKET_OBSERVATION/V1', {
      corpus_release_id: row.corpus_release_id,
      metric_observation_occurrence_id: expectedMetricOccurrenceId,
    })) {
    throw new TypeError('market observation serving identity mismatch');
  }
  if (subject.market_observation_serving_key !== row.provenance.market_observation_serving_key
    || subject.metric_observation_occurrence_id !== row.provenance.metric_observation_occurrence_id
    || subject.metric_slot_key !== row.provenance.metric_slot_key
    || component.component_occurrence_id !== row.provenance.owner_occurrence_id
    || component.component_revision_id !== row.provenance.owner_revision_id) {
    throw new TypeError('canonical result lineage does not match row provenance');
  }
  if (body.market_context.denominators.prevalence.kind !== 'EXAMINED_ELIGIBLE_APPLICABLE_DEALS'
    || body.market_context.denominators.prevalence.deal_count !== body.market_context.cohort.counts.examined_deals
    || body.market_context.denominators.distribution.kind !== 'COMPARABLE_PRESENT_DEALS'
    || body.market_context.denominators.distribution.deal_count !== body.market_context.cohort.counts.distribution_deals) {
    throw new TypeError('canonical result denominators do not match the governed cohort counts');
  }
  const expectedOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V1', {
    schema_version: 'DERIVED_RESULT_OCCURRENCE/V1',
    deal_admission_id: row.deal_admission_id,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    result_ordinal: body.result_ordinal,
  });
  if (body.derived_result_occurrence_id !== expectedOccurrenceId) throw new TypeError('derived result occurrence identity mismatch');
  const expectedRevisionId = contentId('DERIVED_RESULT_REVISION/V1', {
    schema_version: 'DERIVED_RESULT_REVISION/V1',
    derived_result_occurrence_id: expectedOccurrenceId,
    component_revision_ids: body.components.map((item) => item.component_revision_id),
    relationship_set_digests: body.components.map((item) => item.relationship_set_digest),
    result_completeness: body.result_completeness,
    market_comparability: body.market_comparability,
  });
  if (body.derived_result_revision_id !== expectedRevisionId) throw new TypeError('derived result revision identity mismatch');
  const dimensions = validateDimensions(body.refinable_dimensions);
  if (canonicalJson(dimensions) !== canonicalJson(body.refinable_dimensions)) {
    throw new TypeError('refinable dimensions are not canonical');
  }
}

function validateSharedServingRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('SharedServingRow must be an object');
  const variant = SHARED_ROW_VARIANTS[row.row_kind];
  if (!variant) throw new TypeError('unknown SharedServingRow variant');
  requireExactKeys(row, [...COMMON_KEYS, variant.body_key], 'SharedServingRow');
  for (const forbiddenKey of variant.forbidden_body_keys) {
    if (Object.hasOwn(row, forbiddenKey)) throw new TypeError(`${forbiddenKey} is forbidden for ${row.row_kind}`);
  }
  if (variant.producer_status !== 'IMPLEMENTED_FIXTURE') {
    throw new TypeError(`${row.row_kind} has no certified fixture producer`);
  }
  if (row.schema_version !== 'SHARED_SERVING_ROW/V1') throw new TypeError('invalid SharedServingRow schema version');
  for (const key of ['corpus_release_id', 'frozen_pair_id', 'deal_admission_id', 'row_serving_key']) requireDigest(row[key], key);
  requireText(row.governed_deal_key, 'governed_deal_key');
  requireExactKeys(row.serving_contract, [
    'access_registry_digest', 'offline_denylist_digest', 'embedded_reference_allowlist_digest',
  ], 'serving_contract');
  Object.entries(row.serving_contract).forEach(([key, value]) => requireDigest(value, `serving_contract.${key}`));
  const provenanceKeys = row.row_kind === 'CANONICAL_RESULT'
    ? [
      'contract_fingerprint',
      'metric_observation_occurrence_id',
      'market_observation_serving_key',
      'metric_slot_key',
      'owner_occurrence_id',
      'owner_revision_id',
    ]
    : row.row_kind === 'INCOMPLETE_CANONICAL_RESULT'
      ? [
        'contract_fingerprint',
        'metric_slot_key',
        'exclusion_serving_key',
        'owner_occurrence_id',
        'owner_revision_id',
        'claim_revision_id',
        'intersecting_candidate_set_digest',
      ]
    : [
      'contract_fingerprint',
      'open_world_candidate_occurrence_id',
      'final_disposition_id',
      'primitive_collection_root_id',
      'semantic_impact_closure_id',
    ];
  requireExactKeys(row.provenance, provenanceKeys, 'provenance');
  Object.entries(row.provenance).forEach(([key, value]) => requireDigest(value, `provenance.${key}`));
  // SPEC-VERSIONED-CONTRACT-2026-07-23: a fixture row may be built under any
  // currently-supported contract version (F1 default, or F2 once a reviewed
  // artifact compiles under it); membership in the known set replaces
  // equality with a single hardcoded default so amending the vocabulary
  // never breaks a previously-reviewed row's serving validation.
  if (!FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(row.provenance.contract_fingerprint)) {
    throw new TypeError('fixture SharedServingRow uses an unrecognised contract fingerprint');
  }
  if (canonicalJson(row.serving_contract) !== canonicalJson(servingContract(row.provenance.contract_fingerprint))) {
    throw new TypeError('serving contract does not match the frozen contract fingerprint');
  }
  let expectedRowKey;
  if (row.row_kind === 'CANONICAL_RESULT') {
    validateCanonicalResultBody(row.canonical_result, row);
    expectedRowKey = contentId('RESULT_SERVING_ROW/V1', {
      corpus_release_id: row.corpus_release_id,
      derived_result_occurrence_id: row.canonical_result.derived_result_occurrence_id,
    });
  } else if (row.row_kind === 'INCOMPLETE_CANONICAL_RESULT') {
    validateIncompleteCanonicalResultBody(row.incomplete_canonical_result, row);
    expectedRowKey = contentId('INCOMPLETE_RESULT_SERVING_ROW/V1', {
      corpus_release_id: row.corpus_release_id,
      derived_result_occurrence_id: row.incomplete_canonical_result.derived_result_occurrence_id,
    });
  } else if (row.row_kind === 'REVIEWED_SOURCE_SPECIFIC') {
    validateReviewedSourceSpecificBody(row.reviewed_source_specific, row);
    const body = row.reviewed_source_specific;
    if (row.provenance.open_world_candidate_occurrence_id !== body.candidate_occurrence.open_world_candidate_occurrence_id
      || row.provenance.final_disposition_id !== body.final_disposition.final_disposition_id
      || row.provenance.primitive_collection_root_id !== body.primitive_collection.primitive_collection_root_id
      || row.provenance.semantic_impact_closure_id !== body.semantic_impact_closure.semantic_impact_closure_id) {
      throw new TypeError('reviewed source-specific lineage does not match row provenance');
    }
    expectedRowKey = contentId('REVIEWED_SOURCE_SPECIFIC_ROW/V1', {
      corpus_release_id: row.corpus_release_id,
      open_world_candidate_occurrence_id: body.candidate_occurrence.open_world_candidate_occurrence_id,
    });
  }
  if (row.row_serving_key !== expectedRowKey) throw new TypeError('shared row serving identity mismatch');
  const { canonical_payload_digest, ...body } = row;
  if (canonical_payload_digest !== contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body)) {
    throw new TypeError('SharedServingRow payload digest mismatch');
  }
  assertNoForbiddenPayload(row);
  return true;
}

function buildOfflineCandidateCanonicalResultServingRow({
  contract_bundle: contractBundle,
  frozen_pair_id: frozenPairId,
  projection_output: projectionOutput,
  cohort_request: cohortRequest,
  cohort_result: cohortResult,
  result,
  claim,
  interpretation,
  comparability_context: comparabilityContext,
} = {}) {
  validateContractBundle(contractBundle);
  requireDigest(frozenPairId, 'frozen_pair_id');
  const observation = projectionOutput?.observation;
  const compiled = cohortRequest?.schema_version === 'MARKET_COHORT_REQUEST/V2'
    ? cohortRequest
    : compileOfflineInterpretedMarketCohortRequest(cohortRequest);
  validateOfflineInterpretedMarketCohortRequest(compiled);
  validateOfflineInterpretedMarketCohortResult(cohortResult, compiled);
  validateClaimInterpretation({
    claim_interpretation: interpretation,
    policy: contractBundle.claim_interpretation_policy_definition,
  });
  validateInterpretedPresentClaimRevision({
    claim,
    interpretation,
    policy: contractBundle.claim_interpretation_policy_definition,
    allowed_attributes: Object.keys(claim.attributes),
    codebooks: {},
    expected_attributes: claim.attributes,
  });
  if (!observation
    || observation.schema_version !== 'MARKET_OBSERVATION/V2'
    || observation.contract_fingerprint !== contractBundle.fingerprint
    || compiled.comparability_class_digest
      !== comparabilityContext?.comparability_class_digest
    || observation.comparability_context?.comparability_class_digest
      !== comparabilityContext.comparability_class_digest
    || result.claim_revision_ids?.length !== 1
    || result.claim_revision_ids[0] !== claim.claim_revision_id
    || result.component_occurrence_id !== observation.owner_occurrence_id
    || result.component_revision_id !== observation.owner_revision_id) {
    throw new TypeError('offline candidate row lineage or comparability class has drifted');
  }
  const resultOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V2', {
    deal_admission_id: observation.deal_admission_id,
    result_key: result.result_key,
    result_version: result.result_version,
    concept_key: result.concept_key,
    party: result.party,
    result_ordinal: result.ordinal,
    comparability_class_digest:
      comparabilityContext.comparability_class_digest,
  });
  const component = {
    component_occurrence_id: result.component_occurrence_id,
    component_revision_id: result.component_revision_id,
    component_slot_key: result.value_slot_key,
    governed_ordinal: result.ordinal,
    component_state: claim.state,
    claim_schema_version: claim.schema_version,
    claim_occurrence_id: claim.claim_occurrence_id,
    claim_revision_id: claim.claim_revision_id,
    interpretation_payload_id: interpretation.interpretation_payload_id,
    claim_definition_key: claim.claim_definition_key,
    claim_definition_version: claim.claim_definition_version,
    raw_value: clone(claim.raw_value),
    canonical_value: clone(claim.canonical_value),
    unit: claim.unit,
    day_basis: claim.day_basis,
    denominator: clone(claim.denominator),
    derivation_version: claim.derivation_version,
    comparability_context: clone(comparabilityContext),
  };
  const resultRevisionId = contentId('DERIVED_RESULT_REVISION/V2', {
    derived_result_occurrence_id: resultOccurrenceId,
    component_revision_ids: [result.component_revision_id],
    interpretation_payload_ids: [
      interpretation.interpretation_payload_id,
    ],
    comparability_class_digest:
      comparabilityContext.comparability_class_digest,
    result_completeness: 'COMPLETE',
    market_comparability: 'COMPARABLE_WITH_GOVERNED_AMBIGUITY',
  });
  const rowKey = contentId('RESULT_SERVING_ROW/V2', {
    corpus_release_id: observation.corpus_release_id,
    derived_result_occurrence_id: resultOccurrenceId,
  });
  const body = {
    schema_version: 'SHARED_SERVING_ROW/V2',
    row_kind: 'CANONICAL_RESULT',
    authority_scope: 'OFFLINE_CANDIDATE_ONLY',
    integration_admission_id:
      observation.integration_admission_id,
    activation_eligibility:
      'INELIGIBLE_CONTRACT_NOT_SERVING_ADMITTED',
    corpus_release_id: observation.corpus_release_id,
    frozen_pair_id: frozenPairId,
    governed_deal_key: observation.deal_key,
    deal_admission_id: observation.deal_admission_id,
    row_serving_key: rowKey,
    provenance: {
      contract_fingerprint: contractBundle.fingerprint,
      metric_observation_occurrence_id:
        observation.metric_observation_occurrence_id,
      market_observation_serving_key:
        observation.market_observation_serving_key,
      metric_slot_key: observation.metric_slot_key,
      owner_occurrence_id: observation.owner_occurrence_id,
      owner_revision_id: observation.owner_revision_id,
      interpretation_payload_id:
        interpretation.interpretation_payload_id,
    },
    source_actions: [],
    canonical_result: {
      result_key: result.result_key,
      result_version: result.result_version,
      concept_key: result.concept_key,
      party: clone(result.party),
      result_completeness: 'COMPLETE',
      market_comparability:
        'COMPARABLE_WITH_GOVERNED_AMBIGUITY',
      derived_result_occurrence_id: resultOccurrenceId,
      derived_result_revision_id: resultRevisionId,
      components: [component],
      comparability_context: clone(comparabilityContext),
      market_context: {
        subject_observation: {
          market_observation_serving_key:
            observation.market_observation_serving_key,
          canonical_value: clone(observation.canonical_value),
          canonical_unit: observation.canonical_unit,
          basis_key: observation.basis_key,
          comparability_class_digest:
            comparabilityContext.comparability_class_digest,
        },
        cohort: clone(cohortResult),
      },
      source_detail_state: {
        state: 'UNAVAILABLE',
        reason_code: 'EXACT_DETAIL_PROJECTION_NOT_BUILT',
      },
    },
  };
  const row = {
    ...body,
    canonical_payload_digest: contentId(
      'SHARED_SERVING_ROW_PAYLOAD/V2',
      body,
    ),
  };
  validateOfflineCandidateSharedServingRow(row);
  return Object.freeze(row);
}

function validateOfflineCandidateSharedServingRow(row) {
  const {
    FIXTURE_CONTRACT_FINGERPRINT_V12,
  } = require('./contract-bundle');
  const {
    QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
  } = require('./candidate-metric-definition-policy');
  if (!row || row.schema_version !== 'SHARED_SERVING_ROW/V2'
    || row.authority_scope !== 'OFFLINE_CANDIDATE_ONLY'
    || row.integration_admission_id
      !== QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID
    || row.activation_eligibility
      !== 'INELIGIBLE_CONTRACT_NOT_SERVING_ADMITTED'
    || row.provenance?.contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || row.canonical_result?.components?.length !== 1
    || row.canonical_result.components[0].interpretation_payload_id
      !== row.provenance.interpretation_payload_id
    || row.canonical_result.comparability_context
      ?.comparability_class_digest
      !== row.canonical_result.market_context?.subject_observation
        ?.comparability_class_digest
    || (row.source_actions.length === 0
      ? row.canonical_result.source_detail_state.state !== 'UNAVAILABLE'
      : row.source_actions.length !== 1
        || row.canonical_result.source_detail_state.state !== 'AVAILABLE')) {
    throw new TypeError('invalid offline candidate SharedServingRow/V2');
  }
  const { canonical_payload_digest: digest, ...body } = row;
  const result = row.canonical_result;
  const component = result.components[0];
  const expectedOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V2', {
    deal_admission_id: row.deal_admission_id,
    result_key: result.result_key,
    result_version: result.result_version,
    concept_key: result.concept_key,
    party: result.party,
    result_ordinal: component.governed_ordinal,
    comparability_class_digest:
      result.comparability_context.comparability_class_digest,
  });
  const expectedRevisionId = contentId('DERIVED_RESULT_REVISION/V2', {
    derived_result_occurrence_id: expectedOccurrenceId,
    component_revision_ids: [component.component_revision_id],
    interpretation_payload_ids: [
      component.interpretation_payload_id,
    ],
    comparability_class_digest:
      result.comparability_context.comparability_class_digest,
    result_completeness: 'COMPLETE',
    market_comparability: 'COMPARABLE_WITH_GOVERNED_AMBIGUITY',
  });
  if (digest !== contentId('SHARED_SERVING_ROW_PAYLOAD/V2', body)
    || result.derived_result_occurrence_id !== expectedOccurrenceId
    || result.derived_result_revision_id !== expectedRevisionId
    || component.component_occurrence_id
      !== row.provenance.owner_occurrence_id
    || component.component_revision_id
      !== row.provenance.owner_revision_id
    || row.row_serving_key !== contentId('RESULT_SERVING_ROW/V2', {
      corpus_release_id: row.corpus_release_id,
      derived_result_occurrence_id:
        row.canonical_result.derived_result_occurrence_id,
    })) {
    throw new TypeError('offline candidate shared row identity has drifted');
  }
  return true;
}

function prepareSharedRowsForRendering(rows, prepareRow = (row) => row) {
  const seen = new Set();
  return (rows || []).map((row, index) => {
    try {
      validateSharedServingRow(row);
      if (seen.has(row.row_serving_key)) throw new TypeError('duplicate shared serving row key');
      seen.add(row.row_serving_key);
      return { render_kind: 'ROW', key: row.row_serving_key, row, prepared: prepareRow(row) };
    } catch {
      const suppliedKey = row && SHA256_RE.test(row.row_serving_key || '') ? row.row_serving_key : null;
      return {
        render_kind: 'ROW_RENDER_FAILED',
        key: suppliedKey || contentId('ROW_RENDER_FAILED/V1', { index }),
        reason_code: 'INVALID_SHARED_SERVING_ROW',
      };
    }
  });
}

module.exports = {
  BOUNDED_RELATIONSHIP_EFFECT_KEYS,
  CANONICAL_RESULT_KEYS,
  COHORT_COUNT_KEYS,
  COMMON_KEYS,
  COMPONENT_KEYS,
  INCOMPLETE_CANONICAL_RESULT_KEYS,
  INCOMPLETE_METRIC_EXCLUSION_KEYS,
  INTERSECTING_CANDIDATE_KEYS,
  SOURCE_ACTION_KEYS,
  SHARED_ROW_VARIANTS,
  buildCanonicalResultServingRow,
  buildOfflineCandidateCanonicalResultServingRow,
  buildIncompleteCanonicalResultServingRow,
  buildReviewedSourceSpecificServingRow,
  prepareSharedRowsForRendering,
  validateMoneyDenominatorForContract,
  validateMetricOperationBinding,
  validateOfflineCandidateSharedServingRow,
  validateSharedServingRow,
};
