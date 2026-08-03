'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const PROJECTION_SCHEMA = 'TAX_DIVIDENDS_APPRAISAL_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'TAX_DIVIDENDS_APPRAISAL_PRODUCT_RECORD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';

const TAX_CLAIMS = Object.freeze({
  INTENDED_TAX_TREATMENT_KIND: Object.freeze({
    concept: 'TAXM-TREATMENT', label: 'Intended tax treatment', value_kind: 'ENUM',
    values: Object.freeze(['REORG_368A', 'TRANSFER_351']),
    allowed_attributes: Object.freeze(['treatment_scope_ref', 'treatment_term_ref']),
  }),
  TAX_TREATMENT_PROTECTION_COVENANT: Object.freeze({
    concept: 'TAXM-TREATMENT', label: 'Tax treatment protection covenant', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze(['treatment_term_ref']),
  }),
  TRANSFER_TAX_ALLOCATION: Object.freeze({
    concept: 'TAXM-TRANSFER', label: 'Transfer tax allocation', value_kind: 'ENUM',
    values: Object.freeze(['PARENT', 'SPLIT_EVEN', 'SURVIVING_CORPORATION']),
    allowed_attributes: Object.freeze(['bearer_ref']),
  }),
  TRANSFER_TAX_COOPERATION: Object.freeze({
    concept: 'TAXM-TRANSFER', label: 'Transfer tax cooperation', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze([]),
  }),
  FIRPTA_CERTIFICATE_DELIVERY: Object.freeze({
    concept: 'TAXM-FIRPTA', label: 'FIRPTA certificate delivery', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze([]),
  }),
  TAX_OPINION_COOPERATION_COVENANT: Object.freeze({
    concept: 'TAXM-OPINION', label: 'Tax opinion cooperation and representation-letter delivery', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze([]),
  }),
});

const DIVIDEND_CLAIMS = Object.freeze({
  DIVIDEND_COORDINATION_COVENANT: Object.freeze({
    concept: 'DIVD-COORD', label: 'Dividend coordination covenant', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze([]),
  }),
});

const APPRAISAL_CLAIMS = Object.freeze({
  APPRAISAL_SETTLEMENT_CONSENT: Object.freeze({
    concept: 'APPR-SETTLE', label: 'Appraisal settlement consent control', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze(['statute_ref']),
  }),
  APPRAISAL_WITHDRAWAL_RECONVERSION: Object.freeze({
    concept: 'APPR-WITHDRAW', label: 'Appraisal withdrawal reconversion', value_kind: 'PRESENCE',
    values: Object.freeze([true]), allowed_attributes: Object.freeze(['statute_ref']),
  }),
});

class TaxDividendsAppraisalProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TaxDividendsAppraisalProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new TaxDividendsAppraisalProductProjectionError(code, message, details);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalNonEmpty(value) {
  return value === undefined || nonEmpty(value);
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
      'Only governed tax, dividend and appraisal attributes can enter product projections.',
      { attribute_keys: extra.sort() },
    );
  }
}

function validateAttributes(family, key, attributes) {
  if (family === 'TAX_MATTERS') {
    if (key === 'INTENDED_TAX_TREATMENT_KIND') {
      return optionalNonEmpty(attributes.treatment_scope_ref)
        && optionalNonEmpty(attributes.treatment_term_ref);
    }
    if (key === 'TAX_TREATMENT_PROTECTION_COVENANT') {
      return optionalNonEmpty(attributes.treatment_term_ref);
    }
    if (key === 'TRANSFER_TAX_ALLOCATION') return nonEmpty(attributes.bearer_ref);
    return Object.keys(attributes).length === 0;
  }
  if (family === 'DIVIDENDS') return Object.keys(attributes).length === 0;
  return optionalNonEmpty(attributes.statute_ref);
}

function taxDimensions(key, attributes) {
  if (key === 'INTENDED_TAX_TREATMENT_KIND') {
    return {
      claim_definition_key: key,
      ...(attributes.treatment_scope_ref ? { treatment_scope_ref: attributes.treatment_scope_ref } : {}),
      ...(attributes.treatment_term_ref ? { treatment_term_ref: attributes.treatment_term_ref } : {}),
    };
  }
  if (key === 'TAX_TREATMENT_PROTECTION_COVENANT') {
    return {
      claim_definition_key: key,
      ...(attributes.treatment_term_ref ? { treatment_term_ref: attributes.treatment_term_ref } : {}),
    };
  }
  if (key === 'TRANSFER_TAX_ALLOCATION') {
    return { claim_definition_key: key, bearer_ref: attributes.bearer_ref };
  }
  if (key === 'TAX_OPINION_COOPERATION_COVENANT') {
    return { claim_definition_key: key, condition_scope_state: 'COVENANT_ONLY' };
  }
  return { claim_definition_key: key };
}

function appraisalDimensions(key, attributes) {
  return {
    claim_definition_key: key,
    ...(attributes.statute_ref ? { statute_ref: attributes.statute_ref } : {}),
    statute_taxonomy_state: 'VERBATIM_ONLY_NO_ENUM',
    detail_state: 'OPEN_WORLD_UNADJUDICATED',
  };
}

function marketValue(family, key, definition, canonicalValue, dimensions) {
  if (definition.value_kind === 'ENUM') {
    return {
      metric_key: key === 'INTENDED_TAX_TREATMENT_KIND'
        ? 'INTENDED_TAX_TREATMENT_KIND'
        : 'TRANSFER_TAX_ALLOCATION',
      value_dimension: 'ENUM', canonical_unit: 'CODE', canonical_value: canonicalValue,
      breakdown: dimensions, per_deal_rollup: 'DISTINCT_VALUES', weighting: 'DEAL',
    };
  }
  const metricKey = family === 'TAX_MATTERS'
    ? 'TAX_GOVERNED_CLAIM_PRESENCE'
    : family === 'DIVIDENDS'
      ? 'DIVIDEND_COORDINATION_COVENANT_PRESENCE'
      : 'APPRAISAL_GOVERNED_CLAIM_PRESENCE';
  return {
    metric_key: metricKey,
    value_dimension: 'BOOLEAN_PRESENCE', canonical_unit: 'PRESENT_TRUE', canonical_value: true,
    breakdown: dimensions, per_deal_rollup: 'ANY_TRUE', weighting: 'DEAL',
  };
}

function projectEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const key = claimDefinitionKey(entry);
  const definition = TAX_CLAIMS[key] || DIVIDEND_CLAIMS[key] || APPRAISAL_CLAIMS[key];
  if (!definition) {
    fail('UNGOVERNED_CLAIM', 'Only governed tax, dividend and appraisal claims can be projected.', {
      claim_definition_key: key,
    });
  }
  const family = TAX_CLAIMS[key]
    ? 'TAX_MATTERS'
    : DIVIDEND_CLAIMS[key]
      ? 'DIVIDENDS'
      : 'APPRAISAL_DISSENTERS_RIGHTS';
  if (entry.concept_key !== definition.concept) {
    fail('CONCEPT_OWNERSHIP_MISMATCH', 'The claim does not belong to its governed family concept.');
  }
  const claim = entry.claim;
  if (!claim || claim.state !== 'PRESENT' || claim.claim_definition_key !== key
    || !nonEmpty(claim.claim_revision_id) || !definition.values.includes(claim.canonical_value)) {
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
  if (!validateAttributes(family, key, attributes)) {
    fail('INVALID_GOVERNED_ATTRIBUTES', 'The claim attributes do not match its governed definition.');
  }
  const dimensions = family === 'TAX_MATTERS'
    ? taxDimensions(key, attributes)
    : family === 'DIVIDENDS'
      ? { claim_definition_key: key }
      : appraisalDimensions(key, attributes);
  const fieldKey = family === 'TAX_MATTERS'
    ? 'taxMatterFact'
    : family === 'DIVIDENDS'
      ? 'dividendFact'
      : 'appraisalFact';
  const productValue = {
    concept_key: definition.concept,
    claim_definition_key: key,
    canonical_value: claim.canonical_value,
    dimensions,
  };
  const body = {
    schema_version: RECORD_SCHEMA,
    authority_state: AUTHORITY_STATE,
    owner_family: family,
    claim_revision_id: claim.claim_revision_id,
    provision_instance_id: provision.provision_instance_id,
    review: {
      row_key: key,
      label: definition.label,
      value: claim.canonical_value,
      dimensions,
      source_section_reference: entry.section_reference,
    },
    query: { field_key: fieldKey, value: productValue },
    compare: { field_key: fieldKey, value: productValue },
    market: { metric_version: 1, ...marketValue(family, key, definition, claim.canonical_value, dimensions) },
  };
  return Object.freeze({ ...body, projection_record_id: contentId(RECORD_SCHEMA, body) });
}

function projectTaxDividendsAppraisalClaims({ resolved_entries: resolvedEntries } = {}) {
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
  const body = { schema_version: PROJECTION_SCHEMA, authority_state: AUTHORITY_STATE, records };
  return Object.freeze({ ...body, projection_id: contentId(PROJECTION_SCHEMA, body) });
}

module.exports = {
  APPRAISAL_CLAIMS,
  AUTHORITY_STATE,
  DIVIDEND_CLAIMS,
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  TAX_CLAIMS,
  TaxDividendsAppraisalProductProjectionError,
  projectTaxDividendsAppraisalClaims,
};
