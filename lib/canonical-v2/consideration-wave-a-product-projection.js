'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');

const PROJECTION_SCHEMA = 'CONSIDERATION_WAVE_A_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'CONSIDERATION_WAVE_A_PRODUCT_RECORD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const FIELD_DEFINITIONS = Object.freeze({
  PER_SHARE_CASH_CONSIDERATION: Object.freeze({
    concept_key: 'CONS-PERSHARE',
    label: 'Cash per share',
    field_key: 'perShareAmount',
    metric_key: 'PER_SHARE_CASH_CONSIDERATION_USD_PER_SHARE',
    value_dimension: 'MONEY_PER_SHARE',
    canonical_unit: 'USD_PER_SHARE',
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  }),
  EXCHANGE_RATIO_VALUE: Object.freeze({
    concept_key: 'CONS-RATIO',
    label: 'Exchange ratio',
    field_key: 'exchangeRatio',
    metric_key: 'EXCHANGE_RATIO_SHARES_PER_TARGET_SHARE',
    value_dimension: 'SHARES_PER_TARGET_SHARE',
    canonical_unit: 'SHARES_PER_TARGET_SHARE',
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  }),
  APPRAISAL_RIGHTS_STATUS: Object.freeze({
    concept_key: 'CONS-DISSENT',
    label: 'Appraisal rights',
    field_key: 'appraisalRightsAvailable',
    metric_key: 'APPRAISAL_RIGHTS_STATUS',
    value_dimension: 'APPRAISAL_RIGHTS_STATUS',
    canonical_unit: 'APPRAISAL_RIGHTS_STATUS_CODE',
    canonical_value_type: 'ENUM',
  }),
});

class ConsiderationWaveAProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ConsiderationWaveAProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ConsiderationWaveAProjectionError(code, message, details);
}

function displayValue(definition, value, attributes) {
  if (definition.field_key === 'perShareAmount') return `$${value} per share`;
  if (definition.field_key === 'exchangeRatio') {
    const issuer = attributes.issuer_stock_ref;
    if (typeof issuer !== 'string' || issuer.length === 0) {
      fail('MISSING_ISSUER_STOCK_REFERENCE', 'An exchange-ratio projection requires issuer_stock_ref.');
    }
    return `${value} ${issuer} per target share`;
  }
  return value === 'AVAILABLE' ? 'Available' : 'Not available';
}

function surfaceValue(definition, value) {
  return definition.field_key === 'appraisalRightsAvailable' ? value === 'AVAILABLE' : value;
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const definition = FIELD_DEFINITIONS[entry.resolved_claim_definition_key];
  if (!definition) {
    fail('WAVE_B_OR_UNKNOWN_CLAIM', 'Only grounded Consideration Wave A claims can be projected.', {
      claim_definition_key: entry.resolved_claim_definition_key || null,
    });
  }
  if (entry.concept_key !== definition.concept_key) {
    fail('CLAIM_CONCEPT_MISMATCH', 'The claim does not use the governed Wave A concept.', {
      claim_definition_key: entry.resolved_claim_definition_key,
      concept_key: entry.concept_key,
    });
  }
  if (entry.party !== null) {
    fail('PARTY_BEARING_ENTRY', 'A Consideration Wave A fact must not have an obligation party.');
  }
  const provision = entry.provision_instance;
  if (!provision || provision.schema_version !== 'STRUCTURAL_PROVISION_INSTANCE/V1'
    || Object.hasOwn(provision, 'party')) {
    fail('NON_STRUCTURAL_PROVISION', 'A Consideration Wave A fact requires a partyless structural provision.');
  }
  const claim = entry.claim;
  if (!claim || claim.state !== 'PRESENT'
    || claim.subject_occurrence_id !== provision.provision_instance_id
    || claim.claim_definition_key !== entry.resolved_claim_definition_key) {
    fail('INVALID_PUBLISHED_CLAIM', 'The claim must be PRESENT and bound to its structural provision.');
  }
  const value = claim.canonical_value;
  if (definition.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING') {
    if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
      fail('INVALID_CANONICAL_VALUE', 'The Wave A numeric value must be a non-negative decimal string.');
    }
  } else if (!['AVAILABLE', 'NOT_AVAILABLE'].includes(value)) {
    fail('INVALID_CANONICAL_VALUE', 'The appraisal status is outside the governed enum.');
  }
  return { definition, provision, claim, value };
}

function projectEntry(entry) {
  const {
    definition, provision, claim, value,
  } = validateEntry(entry);
  const projectedValue = surfaceValue(definition, value);
  const attributes = claim.attributes || {};
  const body = {
    schema_version: RECORD_SCHEMA,
    authority_state: AUTHORITY_STATE,
    claim_revision_id: claim.claim_revision_id,
    provision_instance_id: provision.provision_instance_id,
    concept_key: definition.concept_key,
    claim_definition_key: claim.claim_definition_key,
    review: {
      label: definition.label,
      value: projectedValue,
      display_value: displayValue(definition, value, attributes),
      source_section_reference: entry.section_reference,
    },
    query: { field_key: definition.field_key, value: projectedValue },
    compare: { field_key: definition.field_key, value: projectedValue },
    market: {
      metric_key: definition.metric_key,
      metric_version: 1,
      value_dimension: definition.value_dimension,
      canonical_unit: definition.canonical_unit,
      canonical_value: value,
      canonical_value_type: definition.canonical_value_type,
      per_deal_rollup: 'DISTINCT_VALUE_SET',
      weighting: 'DEAL',
    },
  };
  return Object.freeze({
    ...body,
    projection_record_id: contentId(RECORD_SCHEMA, body),
  });
}

function projectConsiderationWaveAClaims({ resolved_entries: resolvedEntries, publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  const permittedEntries = filterResolvedEntriesForPublication(resolvedEntries, publicationFilter, releaseReceiptId, publicationEvaluationTime);
  if (permittedEntries.length === 0) {
    fail('INVALID_INPUT', 'resolved_entries must contain at least one resolved Wave A claim.');
  }
  const records = permittedEntries.map(projectEntry).sort(
    (left, right) => left.projection_record_id.localeCompare(right.projection_record_id),
  );
  const duplicateKeys = records.map((record) => canonicalJson([
    record.provision_instance_id,
    record.claim_definition_key,
  ]));
  if (new Set(duplicateKeys).size !== duplicateKeys.length) {
    fail('DUPLICATE_PRODUCT_FIELD', 'A provision can contribute only one value for each Wave A field.');
  }
  const body = {
    schema_version: PROJECTION_SCHEMA,
    authority_state: AUTHORITY_STATE,
    records,
  };
  return Object.freeze({
    ...body,
    projection_id: contentId(PROJECTION_SCHEMA, body),
  });
}

module.exports = {
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  AUTHORITY_STATE,
  FIELD_DEFINITIONS,
  ConsiderationWaveAProjectionError,
  projectConsiderationWaveAClaims,
};
