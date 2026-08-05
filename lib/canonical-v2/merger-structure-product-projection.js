'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const PROJECTION_SCHEMA = 'MERGER_STRUCTURE_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'MERGER_STRUCTURE_PRODUCT_RECORD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const TRANSACTION_STEPS_BOUNDARY = 'DISTINCT_SOURCE_NOT_PROJECTED';

const STRUCTURE_CLAIMS = Object.freeze({
  MERGER_SURVIVOR: Object.freeze({
    concept: 'STRUCT-MERGER', label: 'Merger survivor', value_kind: 'ENUM',
    values: Object.freeze(['TARGET_SURVIVES']), allowed_attributes: Object.freeze([]),
  }),
  CLOSING_TIMING_FORMULA: Object.freeze({
    concept: 'STRUCT-CLOSING', label: 'Closing timing formula', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze(['timing_anchor']),
  }),
  CLOSING_TIMING_BUSINESS_DAY_COUNT: Object.freeze({
    concept: 'STRUCT-CLOSING', label: 'Closing timing business-day count', value_kind: 'DAYS',
    allowed_attributes: Object.freeze(['timing_anchor']),
  }),
  EFFECTIVE_TIME_FILING: Object.freeze({
    concept: 'STRUCT-EFFTIME', label: 'Effective-time filing', value_kind: 'PRESENCE',
    values: Object.freeze([true]),
    allowed_attributes: Object.freeze(['filing_instrument_ref', 'effective_time_term_ref']),
  }),
  SURVIVING_CHARTER_PROVISION: Object.freeze({
    concept: 'STRUCT-CHARTER', label: 'Surviving charter provision', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze(['instrument_ref']),
  }),
});

class MergerStructureProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'MergerStructureProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new MergerStructureProductProjectionError(code, message, details);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonNegativeDecimal(value) {
  return typeof value === 'string' && /^(0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function claimDefinitionKey(entry) {
  return entry?.resolved_claim_definition_key || entry?.claim?.claim_definition_key || null;
}

function rejectUngovernedAttributes(definition, attributes) {
  const allowed = new Set(definition.allowed_attributes);
  const extra = Object.keys(attributes).filter((key) => !allowed.has(key));
  if (extra.length > 0) {
    fail(
      'UNADJUDICATED_PRODUCT_ATTRIBUTE',
      'Only governed quote-local structure attributes can enter product projections.',
      { attribute_keys: extra.sort() },
    );
  }
}

function validateAttributes(key, attributes) {
  if (key === 'MERGER_SURVIVOR') return Object.keys(attributes).length === 0;
  if (key === 'CLOSING_TIMING_FORMULA' || key === 'CLOSING_TIMING_BUSINESS_DAY_COUNT') {
    return attributes.timing_anchor === 'CONDITIONS_SATISFACTION';
  }
  if (key === 'EFFECTIVE_TIME_FILING') {
    return nonEmpty(attributes.filing_instrument_ref)
      && nonEmpty(attributes.effective_time_term_ref);
  }
  return nonEmpty(attributes.instrument_ref);
}

function dimensionsFor(key, attributes) {
  if (key === 'MERGER_SURVIVOR') {
    return { claim_definition_key: key, relationship_state: 'QUOTE_LOCAL_ONLY' };
  }
  if (key === 'CLOSING_TIMING_FORMULA' || key === 'CLOSING_TIMING_BUSINESS_DAY_COUNT') {
    return { claim_definition_key: key, timing_anchor: attributes.timing_anchor };
  }
  if (key === 'EFFECTIVE_TIME_FILING') {
    return {
      claim_definition_key: key,
      filing_instrument_ref: attributes.filing_instrument_ref,
      effective_time_term_ref: attributes.effective_time_term_ref,
      relationship_state: 'QUOTE_LOCAL_ONLY',
    };
  }
  return {
    claim_definition_key: key,
    instrument_ref: attributes.instrument_ref,
    relationship_state: 'QUOTE_LOCAL_ONLY',
  };
}

function marketValue(key, definition, canonicalValue, dimensions) {
  if (definition.value_kind === 'DAYS') {
    return {
      metric_key: 'CLOSING_TIMING_BUSINESS_DAY_COUNT',
      value_dimension: 'DURATION', canonical_unit: 'BUSINESS_DAYS', canonical_value: canonicalValue,
      breakdown: dimensions, per_deal_rollup: 'DISTINCT_VALUES', weighting: 'DEAL',
    };
  }
  if (definition.value_kind === 'ENUM') {
    return {
      metric_key: 'MERGER_SURVIVOR',
      value_dimension: 'ENUM', canonical_unit: 'CODE', canonical_value: canonicalValue,
      breakdown: dimensions, per_deal_rollup: 'DISTINCT_VALUES', weighting: 'DEAL',
    };
  }
  return {
    metric_key: 'MERGER_STRUCTURE_GOVERNED_CLAIM_PRESENCE',
    value_dimension: 'BOOLEAN_PRESENCE', canonical_unit: 'PRESENT_TRUE', canonical_value: true,
    breakdown: dimensions, per_deal_rollup: 'ANY_TRUE', weighting: 'DEAL',
  };
}

function projectEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const key = claimDefinitionKey(entry);
  const definition = STRUCTURE_CLAIMS[key];
  if (!definition) {
    fail('UNGOVERNED_CLAIM', 'Only governed structure and closing claims can be projected.', {
      claim_definition_key: key,
    });
  }
  if (entry.concept_key !== definition.concept) {
    fail('CONCEPT_OWNERSHIP_MISMATCH', 'The claim does not belong to its governed structure concept.');
  }
  const claim = entry.claim;
  const valueValid = definition.value_kind === 'DAYS'
    ? nonNegativeDecimal(claim?.canonical_value)
    : definition.values.includes(claim?.canonical_value);
  if (!claim || claim.state !== 'PRESENT' || claim.claim_definition_key !== key
    || !nonEmpty(claim.claim_revision_id) || !valueValid) {
    fail('INVALID_GOVERNED_CLAIM', 'The claim value does not match its governed definition.');
  }
  const provision = entry.provision_instance;
  if (!provision || provision.schema_version !== 'PROVISION_INSTANCE/V1'
    || !nonEmpty(provision.provision_instance_id)
    || claim.subject_occurrence_id !== provision.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'The claim must bind to its governed provision instance.');
  }
  const attributes = claim.attributes || {};
  rejectUngovernedAttributes(definition, attributes);
  if (!validateAttributes(key, attributes)) {
    fail('INVALID_GOVERNED_ATTRIBUTES', 'The claim attributes do not match its governed definition.');
  }
  const dimensions = dimensionsFor(key, attributes);
  const productValue = {
    concept_key: definition.concept,
    claim_definition_key: key,
    canonical_value: claim.canonical_value,
    dimensions,
  };
  const body = {
    schema_version: RECORD_SCHEMA,
    authority_state: AUTHORITY_STATE,
    owner_family: 'MERGER_STRUCTURE_CLOSING',
    transaction_steps_boundary: TRANSACTION_STEPS_BOUNDARY,
    claim_revision_id: claim.claim_revision_id,
    provision_instance_id: provision.provision_instance_id,
    review: {
      row_key: key,
      label: definition.label,
      value: claim.canonical_value,
      dimensions,
      source_section_reference: entry.section_reference,
    },
    query: { field_key: 'structureMechanicFact', value: productValue },
    compare: { field_key: 'structureMechanicFact', value: productValue },
    market: { metric_version: 1, ...marketValue(key, definition, claim.canonical_value, dimensions) },
  };
  return Object.freeze({ ...body, projection_record_id: contentId(RECORD_SCHEMA, body) });
}

function projectMergerStructureClaims({ resolved_entries: resolvedEntries } = {}) {
  if (!Array.isArray(resolvedEntries) || resolvedEntries.length === 0) {
    fail('INVALID_INPUT', 'At least one resolved claim is required.');
  }
  const records = resolvedEntries.map(projectEntry)
    .sort((left, right) => left.projection_record_id.localeCompare(right.projection_record_id));
  const identities = records.map((record) => canonicalJson([
    record.claim_revision_id,
    record.owner_family,
  ]));
  if (new Set(identities).size !== identities.length) {
    fail('DUPLICATE_PRODUCT_CLAIM', 'A governed claim can contribute only one product record.');
  }
  const body = {
    schema_version: PROJECTION_SCHEMA,
    authority_state: AUTHORITY_STATE,
    transaction_steps_boundary: TRANSACTION_STEPS_BOUNDARY,
    records,
  };
  return Object.freeze({ ...body, projection_id: contentId(PROJECTION_SCHEMA, body) });
}

module.exports = {
  AUTHORITY_STATE,
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  STRUCTURE_CLAIMS,
  TRANSACTION_STEPS_BOUNDARY,
  MergerStructureProductProjectionError,
  projectMergerStructureClaims,
};
