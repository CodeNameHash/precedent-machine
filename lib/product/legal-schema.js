'use strict';

const LEGAL_SCHEMA_VERSION = 'LEGAL_SCHEMA/V1';
const { REGISTERED_FAMILY_KEYS } = require('./family-taxonomy');
const ABSENCE_STATES = Object.freeze(['FOUND', 'NOT_FOUND', 'UNRESOLVED', 'NOT_RUN']);
const RELATIONSHIP_TYPES = Object.freeze([
  'QUALIFIES', 'EXCEPTS', 'TRIGGERS', 'DEFINED_BY', 'ALTERNATIVE_TO', 'EXTENDS', 'REQUIRES',
]);

class LegalSchemaError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'LegalSchemaError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new LegalSchemaError(code, detail);
}

function validateLegalSchema(schema) {
  if (!schema || schema.schema_version !== LEGAL_SCHEMA_VERSION) {
    fail('LEGAL_SCHEMA_VERSION', 'expected LEGAL_SCHEMA/V1');
  }
  if (!Array.isArray(schema.families) || schema.families.length !== 25) {
    fail('LEGAL_SCHEMA_FAMILY_COUNT', 'exactly 25 families are required');
  }
  const keys = schema.families.map((family) => family.family_key);
  if (new Set(keys).size !== 25 || keys.some((key) => typeof key !== 'string' || key.length === 0)) {
    fail('LEGAL_SCHEMA_FAMILY_KEYS', 'family keys must be unique non-empty strings');
  }
  if (JSON.stringify([...keys].sort()) !== JSON.stringify([...REGISTERED_FAMILY_KEYS].sort())) {
    fail('LEGAL_SCHEMA_FAMILY_TAXONOMY', 'families must equal the registered taxonomy');
  }
  for (const family of schema.families) {
    if (family.state !== 'DEFINED') fail('LEGAL_SCHEMA_FAMILY_STATE', family.family_key);
    if (!Array.isArray(family.subtypes) || family.subtypes.length === 0) {
      fail('LEGAL_SCHEMA_SUBTYPES', family.family_key);
    }
    if (!Array.isArray(family.required_fact_types) || family.required_fact_types.length === 0
      || !Array.isArray(family.materiality_rules) || family.materiality_rules.length === 0
      || typeof family.summary_grammar !== 'string' || family.summary_grammar.length === 0
      || !Array.isArray(family.compact_omissions)
      || typeof family.absence_semantics !== 'string' || family.absence_semantics.length === 0
      || !family.prompt_audit || family.prompt_audit.status !== 'CONTRACT_SUPERSEDES_PROMPT_OUTPUT_GAPS'
      || !Array.isArray(family.prompt_audit.gaps_filled) || family.prompt_audit.gaps_filled.length === 0) {
      fail('LEGAL_SCHEMA_FAMILY_CONTRACT', family.family_key);
    }
    for (const subtype of family.subtypes) {
      if (!Array.isArray(subtype.required_roles) || subtype.required_roles.length === 0) {
        fail('LEGAL_SCHEMA_REQUIRED_ROLES', `${family.family_key}.${subtype.subtype_key}`);
      }
      if (!Array.isArray(subtype.relationships)
        || subtype.relationships.some((type) => !RELATIONSHIP_TYPES.includes(type))) {
        fail('LEGAL_SCHEMA_RELATIONSHIPS', `${family.family_key}.${subtype.subtype_key}`);
      }
    }
  }
  if (!schema.coverage
    || JSON.stringify(schema.coverage.states) !== JSON.stringify(ABSENCE_STATES)
    || schema.coverage.not_run_is_absence !== false
    || schema.coverage.published_absence_requires_lawyer_confirmation !== true) {
    fail('LEGAL_SCHEMA_COVERAGE', 'four-state coverage and reviewed absence are required');
  }
  if (!Array.isArray(schema.issues)
    || schema.issues.some((issue) => issue.kind !== 'LEGAL_GAP' || !keys.includes(issue.family_key))) {
    fail('LEGAL_SCHEMA_ISSUES', 'issues may contain only family-bound legal gaps');
  }
  return schema;
}

module.exports = {
  ABSENCE_STATES,
  LEGAL_SCHEMA_VERSION,
  RELATIONSHIP_TYPES,
  LegalSchemaError,
  validateLegalSchema,
};
