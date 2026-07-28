const RELATIONSHIP_DEFINITION_KIND = 'RELATIONSHIP_DEFINITION';
const RELATIONSHIP_DEFINITION_SCHEMA = 'RELATIONSHIP_DEFINITION/V1';
const RELATIONSHIP_EFFECT_SCHEMA_KIND = 'RELATIONSHIP_EFFECT_SCHEMA';
const RELATIONSHIP_EFFECT_MEMBER_SCHEMA = 'RELATIONSHIP_EFFECT_SCHEMA/V1';
const EFFECT_SCHEMA_REFERENCE_RE = /^([A-Z][A-Z0-9_]*)\/V([1-9][0-9]*)$/;

class CanonicalContractRelationshipInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractRelationshipInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractRelationshipInputError(code, message, details);
}

function requireExactKeys(value, expected, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(orderedExpected)) {
    fail(code, `${label} fields do not match the authored contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function validateRelationshipMember(member) {
  const code = 'INVALID_CANONICAL_BUNDLE_RELATIONSHIP_DEFINITION';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'relationship_key',
    'effect_mode',
    'version',
    'effect_schema',
  ], code, 'relationship definition');
  if (
    value.object_kind !== RELATIONSHIP_DEFINITION_KIND
    || value.schema_version !== RELATIONSHIP_DEFINITION_SCHEMA
    || typeof value.relationship_key !== 'string'
    || value.relationship_key.length === 0
    || value.stable_id !== value.relationship_key
    || value.effect_mode !== 'TYPED_LEGAL_EFFECT'
    || !Number.isSafeInteger(value.version)
    || value.version < 1
    || typeof value.effect_schema !== 'string'
    || !EFFECT_SCHEMA_REFERENCE_RE.test(value.effect_schema)
  ) {
    fail(code, 'Relationship definition does not match the typed authored contract.', {
      stable_id: value?.stable_id ?? null,
    });
  }
  return value;
}

function validateEffectSchemaMember(member) {
  const code = 'INVALID_CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_SCHEMA';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'effect_schema_key',
    'effect_schema_version',
    'definition',
  ], code, 'relationship effect-schema member');
  if (
    value.object_kind !== RELATIONSHIP_EFFECT_SCHEMA_KIND
    || value.schema_version !== RELATIONSHIP_EFFECT_MEMBER_SCHEMA
    || typeof value.effect_schema_key !== 'string'
    || value.effect_schema_key.length === 0
    || value.stable_id !== value.effect_schema_key
    || !Number.isSafeInteger(value.effect_schema_version)
    || value.effect_schema_version < 1
    || !value.definition
    || typeof value.definition !== 'object'
    || Array.isArray(value.definition)
  ) {
    fail(code, 'Relationship effect-schema member does not match the authored envelope.', {
      stable_id: value?.stable_id ?? null,
    });
  }
  const parsed = EFFECT_SCHEMA_REFERENCE_RE.exec(value.definition.schema_version || '');
  if (
    !parsed
    || parsed[1] !== value.effect_schema_key
    || Number(parsed[2]) !== value.effect_schema_version
  ) {
    fail(code, 'Effect-schema envelope does not match its nested definition version.', {
      stable_id: value.stable_id,
      definition_schema_version: value.definition.schema_version ?? null,
    });
  }
  return {
    value,
    reference: `${value.effect_schema_key}/V${value.effect_schema_version}`,
  };
}

function validateAuthoredRelationshipInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const relationshipMembers = authoredMembers.filter(
    (member) => member?.object_kind === RELATIONSHIP_DEFINITION_KIND,
  );
  const effectSchemaMembers = authoredMembers.filter(
    (member) => member?.object_kind === RELATIONSHIP_EFFECT_SCHEMA_KIND,
  );
  if (relationshipMembers.length === 0 && effectSchemaMembers.length === 0) return;

  const relationships = relationshipMembers.map(validateRelationshipMember);
  const effectsByReference = new Map();
  for (const member of effectSchemaMembers) {
    const effect = validateEffectSchemaMember(member);
    if (!effectsByReference.has(effect.reference)) effectsByReference.set(effect.reference, []);
    effectsByReference.get(effect.reference).push(effect.value);
  }

  const referenced = new Set();
  for (const relationship of relationships) {
    const candidates = effectsByReference.get(relationship.effect_schema) || [];
    if (candidates.length === 0) {
      fail(
        'CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_REFERENCE_UNRESOLVED',
        'Typed relationship effect-schema reference does not resolve.',
        {
          relationship_key: relationship.relationship_key,
          effect_schema: relationship.effect_schema,
        },
      );
    }
    if (candidates.length !== 1) {
      fail(
        'CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_REFERENCE_AMBIGUOUS',
        'Typed relationship effect-schema reference resolves more than once.',
        {
          relationship_key: relationship.relationship_key,
          effect_schema: relationship.effect_schema,
          actual_count: candidates.length,
        },
      );
    }
    const effect = candidates[0];
    if (
      effect.definition.relationship_key !== relationship.relationship_key
      || effect.definition.relationship_definition_version !== relationship.version
    ) {
      fail(
        'CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_BINDING_MISMATCH',
        'Relationship effect schema does not bind the selected relationship version.',
        {
          relationship_key: relationship.relationship_key,
          relationship_version: relationship.version,
          effect_relationship_key: effect.definition.relationship_key ?? null,
          effect_relationship_version:
            effect.definition.relationship_definition_version ?? null,
        },
      );
    }
    referenced.add(relationship.effect_schema);
  }

  for (const reference of [...effectsByReference.keys()].sort()) {
    if (!referenced.has(reference)) {
      fail(
        'CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_SCHEMA_UNREFERENCED',
        'Authored relationship effect schema is not selected by a relationship definition.',
        { effect_schema: reference },
      );
    }
  }
}

module.exports = {
  RELATIONSHIP_DEFINITION_KIND,
  RELATIONSHIP_DEFINITION_SCHEMA,
  RELATIONSHIP_EFFECT_SCHEMA_KIND,
  RELATIONSHIP_EFFECT_MEMBER_SCHEMA,
  CanonicalContractRelationshipInputError,
  validateAuthoredRelationshipInputs,
};
