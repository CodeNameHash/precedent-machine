const { canonicalJson } = require('./canonical-bytes');
const {
  EFFECT_KEYS: TERMINATION_FEE_TRIGGER_EFFECT_KEYS,
} = require('./termination-fee-trigger-path');

const EFFECT_KIND = 'RELATIONSHIP_EFFECT_SCHEMA';

class CanonicalContractTechnicalRelationshipError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractTechnicalRelationshipError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractTechnicalRelationshipError(code, message, details);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function requireExactKeys(value, expected, code, label) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !same(Object.keys(value).sort(), [...expected].sort())
  ) {
    fail(code, `${label} fields do not match the authored contract.`);
  }
}

function effectDefinition(authoredMembers, key) {
  return authoredMembers.find(
    (member) => member?.object_kind === EFFECT_KIND
      && member.canonical_value?.effect_schema_key === key,
  )?.canonical_value?.definition || null;
}

function authoredPayload(authoredMembers, objectKind, stableId, payloadField = null) {
  const value = authoredMembers.find(
    (member) => member?.object_kind === objectKind
      && member.canonical_value?.stable_id === stableId,
  )?.canonical_value || null;
  return payloadField && value ? value[payloadField] : value;
}

function validateBringsDownDefinition(definition, authoredMembers) {
  const code = 'INVALID_CANONICAL_BUNDLE_BRINGS_DOWN_EFFECT_SCHEMA';
  if (definition?.schema_version === 'BRINGS_DOWN_EFFECT/V2') {
    requireExactKeys(definition, [
      'schema_version',
      'relationship_key',
      'relationship_definition_version',
      'legal_operation',
      'source_endpoint_contract',
      'target_endpoint_contract',
      'required_effect_fields',
      'allowed_test_point_codes',
      'required_test_point_codes',
      'dated_representation_proviso_contract',
      'allowed_accuracy_standard_codes',
      'allowed_accuracy_exception_codes',
      'materiality_scrape_contract',
      'comparison_class_contracts',
      'maximum_evidence_excerpts',
      'complete_scope_closure_required',
      'cross_class_target_overlap_forbidden',
      'class_aggregation_forbidden',
    ], code, 'BRINGS_DOWN effect definition');
    if (
      definition.relationship_key !== 'BRINGS_DOWN'
      || definition.relationship_definition_version !== 3
      || definition.legal_operation !== 'TEST_REPRESENTATION_ACCURACY'
    ) {
      fail(code, 'BRINGS_DOWN effect v2 does not bind its successor relationship.');
    }
    return;
  }
  requireExactKeys(definition, [
    'schema_version',
    'relationship_key',
    'relationship_definition_version',
    'effect_mode',
    'required_effect_fields',
    'conditional_effect_fields',
    'required_exact_values',
    'allowed_accuracy_standards',
    'accuracy_exception_contract',
    'materiality_scrape_contract',
    'endpoint_contract',
    'scope_contract',
    'evidence_role_contract',
    'propagation',
    'party_transfer',
  ], code, 'BRINGS_DOWN effect definition');

  const accuracyClaim = authoredPayload(
    authoredMembers,
    'CLAIM_DEFINITION',
    'REPRESENTATION_ACCURACY_STANDARD',
  );
  const exceptionClaim = authoredPayload(
    authoredMembers,
    'CLAIM_DEFINITION',
    'REPRESENTATION_ACCURACY_EXCEPTION',
  );
  const partyShape = authoredPayload(
    authoredMembers,
    'PARTY_TUPLE_SHAPE_MIGRATION_INPUT',
    'FIXTURE_CONTRACT_INPUT_V12_PARTY_TUPLE_FIELDS',
  );
  const expectedExceptionContract = [
    { accuracy_standard: 'MAT_ALL_RESPECTS', required_exception: null },
    {
      accuracy_standard: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      required_exception: 'DE_MINIMIS_INACCURACIES',
    },
    { accuracy_standard: 'MAT_ALL_MATERIAL', required_exception: null },
    { accuracy_standard: 'MAT_MAE_QUALIFIED', required_exception: null },
  ];
  if (
    definition.schema_version !== 'BRINGS_DOWN_EFFECT/V1'
    || definition.relationship_key !== 'BRINGS_DOWN'
    || definition.relationship_definition_version !== 2
    || definition.effect_mode !== 'TYPED_LEGAL_EFFECT'
    || !same(definition.required_effect_fields, [
      'effect_mode',
      'legal_operation',
      'accuracy_standard',
      'exception',
      'time_points',
    ])
    || !same(definition.conditional_effect_fields, [{
      field_key: 'materiality_scrape',
      required_when_accuracy_standard_in: ['MAT_ALL_MATERIAL', 'MAT_MAE_QUALIFIED'],
      forbidden_otherwise: true,
      required_fields: ['applied', 'disregarded_qualifiers'],
    }])
    || !same(definition.required_exact_values, {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING',
      time_points: ['SIGNING', 'CLOSING', 'EXPRESS_EARLIER_DATE_IF_APPLICABLE'],
    })
    || !accuracyClaim
    || !same(
      definition.allowed_accuracy_standards,
      accuracyClaim.allowed_canonical_values,
    )
    || !exceptionClaim
    || !same(exceptionClaim.allowed_canonical_values, ['DE_MINIMIS_INACCURACIES'])
    || !same(definition.accuracy_exception_contract, expectedExceptionContract)
    || !same(definition.materiality_scrape_contract, {
      applied: true,
      disregarded_qualifiers: [
        'MATERIAL',
        'MATERIALITY',
        'COMPANY_MATERIAL_ADVERSE_EFFECT',
      ],
    })
    || !same(definition.endpoint_contract, {
      source_occurrence_kind: 'PROVISION_INSTANCE',
      target_occurrence_kind: 'PROVISION_COMPONENT',
      target_cardinality: 'ONE_OR_MORE_BOUNDED',
      same_deal_required: true,
      target_ids_in_governed_component_order: true,
      source_party_tuple_required: true,
      target_parent_party_tuple_required: true,
    })
    || !same(definition.scope_contract, {
      raw_scope_required: true,
      coverage_status: 'COMPLETE',
      required_intervals_include_source_and_every_target: true,
      examined_intervals_equal_required_intervals: true,
      target_intervals_equal_resolved_target_excerpts: true,
    })
    || !same(definition.evidence_role_contract, {
      source_role: 'CROSS_REFERENCE',
      target_role: 'DERIVATION_INPUT',
      exception_role: 'DEFINITION',
      materiality_scrape_role: 'DERIVATION_INPUT',
    })
    || definition.propagation !== 'EXACT_NAMED_TARGETS_ONLY'
    || definition.party_transfer !== 'NONE'
    || !partyShape
    || !same(partyShape.ordered_fields, ['role', 'value', 'capacity'])
  ) {
    fail(code, 'BRINGS_DOWN effect schema is outside the reviewed QXO contract.');
  }
}

function validateContainedInDefinition(definition) {
  const code = 'INVALID_CANONICAL_BUNDLE_CONTAINED_IN_EFFECT_SCHEMA';
  requireExactKeys(definition, [
    'schema_version',
    'relationship_key',
    'relationship_definition_version',
    'effect_mode',
    'required_effect_fields',
    'required_exact_values',
    'endpoint_contract',
    'propagation',
    'party_transfer',
    'concept_transfer',
    'qualifier_transfer',
    'exception_transfer',
    'definition_transfer',
    'claim_transfer',
    'evidence_transfer',
    'semantic_use_satisfaction',
  ], code, 'CONTAINED_IN effect definition');
  if (
    definition.schema_version !== 'CONTAINED_IN_EFFECT/V1'
    || definition.relationship_key !== 'CONTAINED_IN'
    || definition.relationship_definition_version !== 2
    || definition.effect_mode !== 'NON_SEMANTIC'
    || !same(definition.required_effect_fields, ['effect_mode', 'legal_operation'])
    || !same(definition.required_exact_values, {
      effect_mode: 'NON_SEMANTIC',
      legal_operation: 'GEOMETRIC_ONLY',
    })
    || !same(definition.endpoint_contract, {
      source_occurrence_kind: 'SOURCE_OCCURRENCE',
      target_occurrence_kind: 'SOURCE_OCCURRENCE',
      target_cardinality: 'EXACTLY_ONE',
      same_document_required: true,
      source_span_relation_to_target: 'WITHIN_OR_EQUAL',
    })
    || definition.propagation !== 'NONE'
    || definition.party_transfer !== 'NONE'
    || definition.concept_transfer !== 'NONE'
    || definition.qualifier_transfer !== 'NONE'
    || definition.exception_transfer !== 'NONE'
    || definition.definition_transfer !== 'NONE'
    || definition.claim_transfer !== 'NONE'
    || definition.evidence_transfer !== 'NONE'
    || definition.semantic_use_satisfaction !== 'FORBIDDEN'
  ) {
    fail(code, 'CONTAINED_IN must remain geometric and non-semantic.');
  }
}

function validateTerminationFeeTriggerDefinition(definition, authoredMembers) {
  const code = 'INVALID_CANONICAL_BUNDLE_TERMINATION_FEE_TRIGGER_EFFECT_SCHEMA';
  requireExactKeys(definition, [
    'schema_version',
    'relationship_key',
    'relationship_definition_version',
    'effect_mode',
    'required_effect_fields',
    'required_exact_values',
    'allowed_legal_operations',
    'required_metric_operation_binding_keys',
    'trigger_path_schema',
    'endpoint_contract',
    'condition_expression_contract',
    'indexed_fact_contract',
    'party_contract',
    'propagation',
    'party_transfer',
  ], code, 'termination-fee trigger effect definition');

  const triggerPath = authoredPayload(
    authoredMembers,
    'SERVING_TRIGGER_PATH_SCHEMA_INPUT',
    'TERMINATION_FEE_TRIGGER_PATH',
    'authored_schema',
  );
  const bindings = authoredMembers
    .filter((member) => member?.object_kind === 'SERVING_METRIC_OPERATION_BINDING_INPUT')
    .map((member) => member.canonical_value.authored_binding)
    .filter((binding) => definition.required_metric_operation_binding_keys.includes(
      binding.binding_key,
    ))
    .sort((left, right) => left.binding_key.localeCompare(right.binding_key));
  const expectedBindingKeys = [
    'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
    'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
  ];
  const expectedOperations = [
    'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER',
    'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
  ];
  if (
    definition.schema_version !== 'TERMINATION_FEE_TRIGGER_EFFECT/V2'
    || definition.relationship_key !== 'TRIGGERED_BY'
    || definition.relationship_definition_version !== 2
    || definition.effect_mode !== 'TYPED_LEGAL_EFFECT'
    || !same(definition.required_effect_fields, TERMINATION_FEE_TRIGGER_EFFECT_KEYS)
    || !same(definition.required_exact_values, {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      trigger_path_schema_key: 'TERMINATION_FEE_TRIGGER_PATH',
      trigger_path_schema_version: 2,
    })
    || !same(definition.allowed_legal_operations, expectedOperations)
    || !same(definition.required_metric_operation_binding_keys, expectedBindingKeys)
    || definition.trigger_path_schema !== 'TERMINATION_FEE_TRIGGER_PATH/V2'
    || !same(definition.endpoint_contract, {
      source_occurrence_kind: 'PROVISION_COMPONENT',
      target_occurrence_kind: 'PROVISION_COMPONENT',
      target_cardinality: 'EXACTLY_ONE',
      same_deal_required: true,
    })
    || !same(definition.condition_expression_contract, {
      root_operator_from_trigger_path_schema: true,
      operators_from_trigger_path_schema: true,
      bounds_from_trigger_path_schema: true,
      declared_trigger_required_at_root: true,
      pathway_template_digest_required: true,
    })
    || !same(definition.indexed_fact_contract, {
      sorted_unique: true,
      derived_from_condition_expression: true,
      trigger_codes_excluded: true,
      semantics: 'SET_MEMBERSHIP_SEARCH_AID_ONLY',
    })
    || !same(definition.party_contract, {
      payer_and_payee_from_metric_operation_binding: true,
      terminating_party_from_pathway_constraint: true,
      party_inference_forbidden: true,
    })
    || definition.propagation !== 'EXACT_NAMED_TARGET_ONLY'
    || definition.party_transfer !== 'NONE'
    || !triggerPath
    || triggerPath.effect_schema !== 'TERMINATION_FEE_TRIGGER_EFFECT/V2'
    || triggerPath.schema_key !== 'TERMINATION_FEE_TRIGGER_PATH'
    || triggerPath.schema_version !== 2
    || bindings.length !== 2
    || !same(bindings.map((binding) => binding.binding_key), expectedBindingKeys)
    || !same(bindings.map((binding) => binding.legal_operation), expectedOperations)
    || bindings.some((binding) => (
      binding.relationship_key !== 'TRIGGERED_BY'
      || binding.trigger_path_schema_key !== triggerPath.schema_key
      || binding.trigger_path_schema_version !== triggerPath.schema_version
      || !same(Object.keys(binding.payer).sort(), ['capacity', 'role', 'value'])
      || !same(Object.keys(binding.payee).sort(), ['capacity', 'role', 'value'])
    ))
  ) {
    fail(
      code,
      'Termination-fee trigger effect schema does not close over its path and party bindings.',
    );
  }
}

function validateAuthoredTechnicalRelationshipInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const bringsDown = effectDefinition(authoredMembers, 'BRINGS_DOWN_EFFECT');
  const containedIn = effectDefinition(authoredMembers, 'CONTAINED_IN_EFFECT');
  const triggeredBy = effectDefinition(authoredMembers, 'TERMINATION_FEE_TRIGGER_EFFECT');
  if (bringsDown) validateBringsDownDefinition(bringsDown, authoredMembers);
  if (containedIn) validateContainedInDefinition(containedIn);
  if (triggeredBy) validateTerminationFeeTriggerDefinition(triggeredBy, authoredMembers);
}

function validateBringsDownEffect(effect, definition) {
  const required = definition.required_effect_fields;
  const scrapeRule = definition.conditional_effect_fields[0];
  const scrapeRequired = scrapeRule.required_when_accuracy_standard_in.includes(
    effect?.accuracy_standard,
  );
  requireExactKeys(
    effect,
    scrapeRequired ? [...required, scrapeRule.field_key] : required,
    'INVALID_BRINGS_DOWN_EFFECT',
    'BRINGS_DOWN effect',
  );
  const exceptionRule = definition.accuracy_exception_contract.find(
    (entry) => entry.accuracy_standard === effect.accuracy_standard,
  );
  if (
    !same(effect.effect_mode, definition.required_exact_values.effect_mode)
    || effect.legal_operation !== definition.required_exact_values.legal_operation
    || !same(effect.time_points, definition.required_exact_values.time_points)
    || !exceptionRule
    || effect.exception !== exceptionRule.required_exception
    || (scrapeRequired
      && !same(effect.materiality_scrape, definition.materiality_scrape_contract))
  ) {
    fail('INVALID_BRINGS_DOWN_EFFECT', 'BRINGS_DOWN effect is outside its closed schema.');
  }
  return true;
}

function validateContainedInEffect(effect, definition) {
  requireExactKeys(
    effect,
    definition.required_effect_fields,
    'INVALID_CONTAINED_IN_EFFECT',
    'CONTAINED_IN effect',
  );
  if (!same(effect, definition.required_exact_values)) {
    fail('INVALID_CONTAINED_IN_EFFECT', 'CONTAINED_IN effect is not geometric-only.');
  }
  return true;
}

module.exports = {
  CanonicalContractTechnicalRelationshipError,
  validateAuthoredTechnicalRelationshipInputs,
  validateBringsDownEffect,
  validateContainedInEffect,
};
