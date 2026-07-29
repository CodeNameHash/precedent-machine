const { canonicalJson } = require('./canonical-bytes');

const EFFECT_KIND = 'RELATIONSHIP_EFFECT_SCHEMA';
const EFFECT_SCHEMA_KEY = 'EXCEPTED_BY_EFFECT';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const VARIANTS = Object.freeze([
  'CONDITIONAL_ACTION_PERMISSION',
  'INLINE_PERMISSION',
  'RESTRICTION_CARVEOUT',
]);

class CanonicalContractExceptedByError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractExceptedByError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractExceptedByError(code, message, details);
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

function requireDigest(value, code, label) {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    fail(code, `${label} must be a SHA-256 identity.`);
  }
}

function requireBoundedUniqueDigests(value, minimum, maximum, code, label) {
  if (
    !Array.isArray(value)
    || value.length < minimum
    || value.length > maximum
    || new Set(value).size !== value.length
  ) {
    fail(code, `${label} cardinality is outside the authored contract.`);
  }
  value.forEach((entry) => requireDigest(entry, code, label));
}

function authoredPayload(authoredMembers, objectKind, stableId, payloadField = null) {
  const value = authoredMembers.find(
    (member) => member?.object_kind === objectKind
      && member.canonical_value?.stable_id === stableId,
  )?.canonical_value || null;
  return payloadField && value ? value[payloadField] : value;
}

function effectDefinition(authoredMembers) {
  return authoredMembers.find(
    (member) => member?.object_kind === EFFECT_KIND
      && member.canonical_value?.effect_schema_key === EFFECT_SCHEMA_KEY,
  )?.canonical_value?.definition || null;
}

function variantByCode(definition, variant) {
  return definition.variant_contracts.find(
    (entry) => entry.effect_variant === variant,
  ) || null;
}

function expectedVariantContracts(conditionalSchema, inlineSchema) {
  return [
    {
      effect_variant: 'CONDITIONAL_ACTION_PERMISSION',
      source_contract: 'NO_SHOP_EXCEPTION_EFFECT/V1',
      required_effect_fields: [
        'effect_mode',
        'effect_variant',
        ...conditionalSchema.required_effect_fields,
      ],
      endpoint_contract: {
        source_occurrence_kind: 'PROVISION_COMPONENT',
        target_occurrence_kind: 'PROVISION_COMPONENT',
        target_cardinality: 'EXACTLY_ONE',
        same_deal_required: true,
      },
    },
    {
      effect_variant: 'INLINE_PERMISSION',
      source_contract: 'NO_SHOP_INLINE_PERMISSION_EFFECT/V1',
      required_effect_fields: [
        'effect_mode',
        'effect_variant',
        ...inlineSchema.required_effect_fields,
      ],
      endpoint_contract: {
        source_occurrence_kind: 'PROVISION_INSTANCE',
        target_occurrence_kind: 'PROVISION_COMPONENT',
        target_cardinality: 'EXACTLY_ONE',
        same_deal_required: true,
      },
    },
    {
      effect_variant: 'RESTRICTION_CARVEOUT',
      source_contract: 'REVIEWED_IOC_CAPEX_SLICE/V1',
      required_effect_fields: [
        'effect_mode',
        'effect_variant',
        'legal_operation',
        'restriction_period',
        'obligors',
        'exceptions',
        'consent_standard',
      ],
      allowed_legal_operations: [
        'EXCLUDES_CAPEX_RESTRICTION_WHEN_APPLICABLE',
      ],
      allowed_restriction_periods: [
        'PRE_CLOSING_PERIOD',
      ],
      allowed_exception_codes: [
        'REQUIRED_OR_CONTEMPLATED_BY_AGREEMENT_OR_LAW',
        'PARENT_WRITTEN_CONSENT',
        'COMPANY_DISCLOSURE_SCHEDULE',
      ],
      allowed_consent_standards: [
        'NOT_UNREASONABLY_WITHHELD_CONDITIONED_OR_DELAYED',
      ],
      endpoint_contract: {
        source_occurrence_kind: 'PROVISION_COMPONENT',
        target_occurrence_kind: 'PROVISION_COMPONENT',
        target_cardinality: 'EXACTLY_ONE',
        same_deal_required: true,
      },
    },
  ];
}

function validateExceptedByDefinition(definition, authoredMembers) {
  const code = 'INVALID_CANONICAL_BUNDLE_EXCEPTED_BY_EFFECT_SCHEMA';
  requireExactKeys(definition, [
    'schema_version',
    'relationship_key',
    'relationship_definition_version',
    'effect_mode',
    'variant_discriminator',
    'allowed_effect_variants',
    'variant_contracts',
    'comparison_contract',
    'propagation',
    'party_transfer',
    'automatic_variant_inference',
  ], code, 'EXCEPTED_BY effect definition');

  const conditionalSchema = authoredPayload(
    authoredMembers,
    'NO_SHOP_SEMANTIC_SCHEMA_INPUT',
    'NO_SHOP_EXCEPTION_EFFECT',
    'authored_schema',
  );
  const inlineSchema = authoredPayload(
    authoredMembers,
    'NO_SHOP_SEMANTIC_SCHEMA_INPUT',
    'NO_SHOP_INLINE_PERMISSION_EFFECT',
    'authored_schema',
  );
  const partyShape = authoredPayload(
    authoredMembers,
    'PARTY_TUPLE_SHAPE_MIGRATION_INPUT',
    'FIXTURE_CONTRACT_INPUT_V12_PARTY_TUPLE_FIELDS',
  );
  if (
    definition.schema_version !== 'EXCEPTED_BY_EFFECT/V1'
    || definition.relationship_key !== 'EXCEPTED_BY'
    || definition.relationship_definition_version !== 3
    || definition.effect_mode !== 'TYPED_LEGAL_EFFECT'
    || definition.variant_discriminator !== 'effect_variant'
    || !same(definition.allowed_effect_variants, VARIANTS)
    || !conditionalSchema
    || conditionalSchema.effect_schema !== 'NO_SHOP_EXCEPTION_EFFECT/V1'
    || conditionalSchema.relationship_key !== 'EXCEPTED_BY'
    || conditionalSchema.relationship_definition_version !== 2
    || !inlineSchema
    || inlineSchema.effect_schema !== 'NO_SHOP_INLINE_PERMISSION_EFFECT/V1'
    || inlineSchema.relationship_key !== 'EXCEPTED_BY'
    || inlineSchema.relationship_definition_version !== 2
    || !same(
      definition.variant_contracts,
      expectedVariantContracts(conditionalSchema, inlineSchema),
    )
    || !same(definition.comparison_contract, {
      cohort_key_fields: ['effect_variant', 'legal_operation'],
      cross_variant_comparison: 'FORBIDDEN',
      missing_variant_disposition: 'QUARANTINE_RELATIONSHIP',
      unknown_variant_disposition: 'RETAIN_RESIDUAL_AND_QUARANTINE_RELATIONSHIP',
    })
    || definition.propagation !== 'EXACT_NAMED_TARGETS_ONLY'
    || definition.party_transfer !== 'NONE'
    || definition.automatic_variant_inference !== 'FORBIDDEN'
    || !partyShape
    || !same(partyShape.ordered_fields, ['role', 'value', 'capacity'])
  ) {
    fail(
      code,
      'EXCEPTED_BY does not match the approved three-variant contract.',
    );
  }
}

function validatePartyTuple(value, partyShape, code, label) {
  requireExactKeys(value, partyShape.ordered_fields, code, label);
  for (const field of partyShape.ordered_fields) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      fail(code, `${label}.${field} must be non-empty.`);
    }
  }
}

function validateConditionalPermission(effect, variant, conditionalSchema, partyShape) {
  const code = 'INVALID_EXCEPTED_BY_CONDITIONAL_ACTION_PERMISSION';
  requireExactKeys(effect, variant.required_effect_fields, code, 'conditional permission effect');
  const operation = conditionalSchema.allowed_legal_operations.find(
    (entry) => entry.legal_operation === effect.legal_operation,
  );
  if (
    !operation
    || effect.affected_action_code !== operation.affected_action_code
    || !same(
      effect.shared_prerequisite_codes,
      conditionalSchema.required_shared_prerequisite_codes,
    )
    || !same(
      effect.action_specific_prerequisite_codes,
      operation.required_action_specific_prerequisite_codes,
    )
    || effect.temporal_start !== conditionalSchema.temporal_start
    || effect.temporal_end !== conditionalSchema.temporal_end
    || effect.precedence_code !== conditionalSchema.precedence_code
    || (operation.required_definition_relationship_key === null
      ? effect.definition_use_relationship_ids.length !== 0
      : effect.definition_use_relationship_ids.length < 1)
  ) {
    fail(code, 'Conditional permission is outside its closed source contract.');
  }
  validatePartyTuple(effect.obligated_party, partyShape, code, 'obligated party');
  validatePartyTuple(effect.protected_party, partyShape, code, 'protected party');
  requireDigest(
    effect.governing_notice_obligation_revision_id,
    code,
    'governing notice revision',
  );
  requireBoundedUniqueDigests(
    effect.definition_use_relationship_ids,
    operation.required_definition_relationship_key === null ? 0 : 1,
    conditionalSchema.maximum_relationships_per_result,
    code,
    'definition-use relationship IDs',
  );
}

function validateInlinePermission(effect, variant, inlineSchema, partyShape) {
  const code = 'INVALID_EXCEPTED_BY_INLINE_PERMISSION';
  requireExactKeys(effect, variant.required_effect_fields, code, 'inline permission effect');
  if (
    effect.legal_operation !== inlineSchema.legal_operation
    || effect.permitted_action_code !== inlineSchema.permitted_action_code
    || effect.information_subject_code !== inlineSchema.information_subject_code
    || effect.temporal_scope_inheritance !== inlineSchema.temporal_scope_inheritance
  ) {
    fail(code, 'Inline permission is outside its closed source contract.');
  }
  validatePartyTuple(effect.permitted_actor_party, partyShape, code, 'permitted actor party');
  requireBoundedUniqueDigests(
    effect.qualified_action_occurrence_ids,
    inlineSchema.minimum_qualified_action_occurrences,
    inlineSchema.maximum_qualified_action_occurrences,
    code,
    'qualified action occurrence IDs',
  );
  requireDigest(effect.cross_reference_excerpt_id, code, 'cross-reference excerpt');
  requireDigest(effect.scope_closure_id, code, 'scope closure');
  requireBoundedUniqueDigests(
    effect.evidence_excerpt_ids,
    inlineSchema.minimum_evidence_excerpts,
    inlineSchema.maximum_evidence_excerpts,
    code,
    'evidence excerpt IDs',
  );
}

function validateRestrictionCarveout(effect, variant) {
  const code = 'INVALID_EXCEPTED_BY_RESTRICTION_CARVEOUT';
  requireExactKeys(effect, variant.required_effect_fields, code, 'restriction carve-out effect');
  if (
    !variant.allowed_legal_operations.includes(effect.legal_operation)
    || !variant.allowed_restriction_periods.includes(effect.restriction_period)
    || !variant.allowed_consent_standards.includes(effect.consent_standard)
    || !Array.isArray(effect.obligors)
    || effect.obligors.length < 1
    || new Set(effect.obligors).size !== effect.obligors.length
    || effect.obligors.some((entry) => typeof entry !== 'string' || entry.length === 0)
    || !Array.isArray(effect.exceptions)
    || effect.exceptions.length < 1
    || new Set(effect.exceptions).size !== effect.exceptions.length
    || effect.exceptions.some((entry) => !variant.allowed_exception_codes.includes(entry))
  ) {
    fail(code, 'Restriction carve-out is outside its closed source contract.');
  }
}

function validateExceptedByEffect(effect, definition, authoredMembers) {
  if (!definition || !Array.isArray(authoredMembers)) {
    throw new TypeError('definition and authoredMembers are required');
  }
  const variantCode = effect?.effect_variant;
  const variant = variantByCode(definition, variantCode);
  if (
    effect?.effect_mode !== 'TYPED_LEGAL_EFFECT'
    || !VARIANTS.includes(variantCode)
    || !variant
  ) {
    fail(
      'INVALID_EXCEPTED_BY_EFFECT_VARIANT',
      'EXCEPTED_BY requires one approved explicit effect variant.',
    );
  }
  const conditionalSchema = authoredPayload(
    authoredMembers,
    'NO_SHOP_SEMANTIC_SCHEMA_INPUT',
    'NO_SHOP_EXCEPTION_EFFECT',
    'authored_schema',
  );
  const inlineSchema = authoredPayload(
    authoredMembers,
    'NO_SHOP_SEMANTIC_SCHEMA_INPUT',
    'NO_SHOP_INLINE_PERMISSION_EFFECT',
    'authored_schema',
  );
  const partyShape = authoredPayload(
    authoredMembers,
    'PARTY_TUPLE_SHAPE_MIGRATION_INPUT',
    'FIXTURE_CONTRACT_INPUT_V12_PARTY_TUPLE_FIELDS',
  );
  if (!conditionalSchema || !inlineSchema || !partyShape) {
    fail(
      'INVALID_EXCEPTED_BY_EFFECT_DEPENDENCY',
      'EXCEPTED_BY effect dependencies are incomplete.',
    );
  }
  if (variantCode === 'CONDITIONAL_ACTION_PERMISSION') {
    validateConditionalPermission(effect, variant, conditionalSchema, partyShape);
  } else if (variantCode === 'INLINE_PERMISSION') {
    validateInlinePermission(effect, variant, inlineSchema, partyShape);
  } else {
    validateRestrictionCarveout(effect, variant);
  }
  return true;
}

function validateAuthoredExceptedByInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const definition = effectDefinition(authoredMembers);
  if (definition) validateExceptedByDefinition(definition, authoredMembers);
}

module.exports = {
  CanonicalContractExceptedByError,
  validateAuthoredExceptedByInputs,
  validateExceptedByEffect,
};
