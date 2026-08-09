'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');

const PROJECTION_SCHEMA = 'FINANCING_GUARANTY_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'FINANCING_GUARANTY_PRODUCT_RECORD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';

// PLAN.md Step 2D1 defect 4 (2026-08-07): this used to compare
// provision.schema_version to the single literal 'PROVISION_INSTANCE/V1'.
// Step 4A1 taught the SQL writer a second, legitimate provision kind --
// 'STRUCTURAL_PROVISION_INSTANCE/V1', the partyless shape --
// and validate-write-set.js's assertStructuralRowShape/expectedObjectId
// admit both. Neither FINANCING_CLAIMS nor GUARANTY_CLAIMS reads
// provision.party, so both kinds bind equally well here; the strict-equal
// check just never saw a claim resolve under the structural kind before
// (0 resolved entries in the committed modiv-financing-covenants-20260807-
// replay and modiv-guaranty-20260807-replay runs -- latent, not confirmed).
// Accepting the union of the two real kinds, not any string, is the fix.
const GOVERNED_PROVISION_SCHEMA_VERSIONS = new Set([
  'PROVISION_INSTANCE/V1',
  'STRUCTURAL_PROVISION_INSTANCE/V1',
]);

const FINANCING_KINDS = Object.freeze(['DEBT', 'EQUITY', 'DEBT_AND_EQUITY', 'UNSPECIFIED']);
const DAY_KINDS = Object.freeze(['CALENDAR', 'BUSINESS']);

const FINANCING_CLAIMS = Object.freeze({
  FINANCING_OBTAIN_EFFORTS_STANDARD: Object.freeze({
    concept: 'COV-FINANCING', label: 'Financing obtain efforts standard', value_kind: 'ENUM',
    values: Object.freeze(['REASONABLE_BEST_EFFORTS', 'COMMERCIALLY_REASONABLE_EFFORTS']),
    allowed_attributes: Object.freeze(['financing_kind', 'obligor_ref', 'standard_code']),
  }),
  FINANCING_COOPERATION_PRESENT: Object.freeze({
    concept: 'COV-FINANCING', label: 'Financing cooperation', value_kind: 'PRESENCE', values: Object.freeze([true]),
    allowed_attributes: Object.freeze(['financing_kind', 'obligor_ref']),
  }),
  NO_FINANCING_CONDITION_ACKNOWLEDGMENT: Object.freeze({
    concept: 'COV-FINANCING', label: 'No-financing-condition acknowledgment', value_kind: 'PRESENCE', values: Object.freeze([true]),
    allowed_attributes: Object.freeze(['financing_kind']),
  }),
  PAYOFF_DELIVERY_LEAD_TIME_DAYS: Object.freeze({
    concept: 'COV-PAYOFF', label: 'Payoff delivery lead time', value_kind: 'DAYS',
    allowed_attributes: Object.freeze(['day_kind', 'delivery_stage', 'deliverable_term_ref']),
  }),
  MARKETING_PERIOD_LENGTH_DAYS: Object.freeze({
    concept: 'COV-MARKETING', label: 'Marketing Period length', value_kind: 'DAYS',
    allowed_attributes: Object.freeze(['day_kind', 'marketing_term_ref']),
  }),
});

const GUARANTY_CLAIMS = Object.freeze({
  PARENT_PERFORMANCE_GUARANTY: Object.freeze({
    concept: 'GTY-PERF', label: 'Parent performance guaranty', value_kind: 'PRESENCE', values: Object.freeze([true]),
    allowed_attributes: Object.freeze(['guarantor_ref', 'obligor_ref']),
  }),
  LIMITED_GUARANTY_DELIVERED: Object.freeze({
    concept: 'GTY-DELIVERY', label: 'Limited guaranty delivered', value_kind: 'PRESENCE', values: Object.freeze([true]),
    allowed_attributes: Object.freeze(['guarantor_ref']),
  }),
  LIMITED_GUARANTY_IN_EFFECT: Object.freeze({
    concept: 'GTY-DELIVERY', label: 'Limited guaranty in effect', value_kind: 'PRESENCE', values: Object.freeze([true]),
    allowed_attributes: Object.freeze(['guarantor_ref']),
  }),
});

class FinancingGuarantyProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FinancingGuarantyProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new FinancingGuarantyProductProjectionError(code, message, details);
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

function validateCanonicalValue(definition, value) {
  return definition.value_kind === 'DAYS' ? nonNegativeDecimal(value) : definition.values.includes(value);
}

// See tax-dividends-appraisal-product-projection.js's identical constant
// for the full account (found in the same PLAN.md Step 2D1 investigation).
// finalizeFinancingGuarantyClaim (candidate-resolution.js) always injects
// answer_provenance via attributesReplace, for every FINANCING_COVENANTS
// and GUARANTY_FINANCING_PARTY claim; it is routing/derivation metadata,
// never one of FINANCING_CLAIMS/GUARANTY_CLAIMS' own allowed_attributes,
// and neither family had a claim resolve in the committed
// modiv-financing-covenants/-guaranty-20260807-replay runs to surface it --
// latent, not confirmed, but certain to fire on the first real claim
// without this fix.
const SYSTEM_ATTRIBUTE_KEYS = new Set(['assertion_kind', 'section_reference', 'answer_provenance']);

function sanitizeAttributes(attributes) {
  return Object.fromEntries(
    Object.entries(attributes || {}).filter(([attributeKey, value]) => (
      value !== null && value !== undefined && !SYSTEM_ATTRIBUTE_KEYS.has(attributeKey)
    )),
  );
}

function rejectUngovernedAttributes(definition, attributes) {
  const allowed = new Set(definition.allowed_attributes);
  const extra = Object.keys(attributes).filter((key) => !allowed.has(key));
  if (extra.length > 0) {
    fail(
      'UNADJUDICATED_PRODUCT_ATTRIBUTE',
      'Only governed financing and guaranty attributes can enter product projections.',
      { attribute_keys: extra.sort() },
    );
  }
}

function validateFinancingAttributes(key, value, attributes) {
  if (key === 'FINANCING_OBTAIN_EFFORTS_STANDARD') {
    return FINANCING_KINDS.includes(attributes.financing_kind)
      && nonEmpty(attributes.obligor_ref) && attributes.standard_code === value;
  }
  if (key === 'FINANCING_COOPERATION_PRESENT') {
    return FINANCING_KINDS.includes(attributes.financing_kind) && nonEmpty(attributes.obligor_ref);
  }
  if (key === 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT') {
    return FINANCING_KINDS.includes(attributes.financing_kind);
  }
  if (key === 'PAYOFF_DELIVERY_LEAD_TIME_DAYS') {
    return DAY_KINDS.includes(attributes.day_kind)
      && ['FINAL', 'DRAFT'].includes(attributes.delivery_stage)
      && nonEmpty(attributes.deliverable_term_ref);
  }
  return attributes.day_kind === 'BUSINESS' && nonEmpty(attributes.marketing_term_ref);
}

function validateGuarantyAttributes(key, attributes) {
  if (!nonEmpty(attributes.guarantor_ref)) return false;
  if (key === 'PARENT_PERFORMANCE_GUARANTY') {
    return attributes.obligor_ref === undefined || nonEmpty(attributes.obligor_ref);
  }
  return attributes.obligor_ref === undefined;
}

function financingDimensions(key, attributes) {
  if (key === 'FINANCING_OBTAIN_EFFORTS_STANDARD') {
    return {
      claim_definition_key: key,
      financing_kind: attributes.financing_kind,
      obligor_ref: attributes.obligor_ref,
      standard_code: attributes.standard_code,
    };
  }
  if (key === 'FINANCING_COOPERATION_PRESENT') {
    return {
      claim_definition_key: key,
      financing_kind: attributes.financing_kind,
      obligor_ref: attributes.obligor_ref,
    };
  }
  if (key === 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT') {
    return {
      claim_definition_key: key,
      financing_kind: attributes.financing_kind,
      condition_scope_state: 'QUOTED_ACKNOWLEDGMENT_ONLY',
    };
  }
  if (key === 'PAYOFF_DELIVERY_LEAD_TIME_DAYS') {
    return {
      claim_definition_key: key,
      day_kind: attributes.day_kind,
      delivery_stage: attributes.delivery_stage,
      deliverable_term_ref: attributes.deliverable_term_ref,
    };
  }
  return {
    claim_definition_key: key,
    day_kind: attributes.day_kind,
    marketing_term_ref: attributes.marketing_term_ref,
    mechanics_state: 'LENGTH_ONLY_OPEN_WORLD',
  };
}

function guarantyDimensions(key, attributes) {
  return {
    claim_definition_key: key,
    guarantor_ref: attributes.guarantor_ref,
    ...(key === 'PARENT_PERFORMANCE_GUARANTY' && attributes.obligor_ref
      ? { obligor_ref: attributes.obligor_ref }
      : {}),
    economics_state: 'OPEN_WORLD_UNADJUDICATED',
  };
}

function marketValue(family, key, definition, canonicalValue, dimensions) {
  if (family === 'FINANCING_COVENANTS' && definition.value_kind === 'DAYS') {
    return {
      metric_key: key === 'PAYOFF_DELIVERY_LEAD_TIME_DAYS'
        ? 'FINANCING_PAYOFF_LEAD_TIME_DAYS'
        : 'FINANCING_MARKETING_PERIOD_LENGTH_DAYS',
      value_dimension: 'DURATION',
      canonical_unit: dimensions.day_kind === 'BUSINESS' ? 'BUSINESS_DAYS' : 'CALENDAR_DAYS',
      canonical_value: canonicalValue,
      breakdown: dimensions,
      per_deal_rollup: 'DISTINCT_VALUES',
      weighting: 'DEAL',
    };
  }
  if (family === 'FINANCING_COVENANTS' && definition.value_kind === 'ENUM') {
    return {
      metric_key: 'FINANCING_OBTAIN_EFFORTS_STANDARD',
      value_dimension: 'ENUM', canonical_unit: 'CODE', canonical_value: canonicalValue,
      breakdown: dimensions, per_deal_rollup: 'DISTINCT_VALUES', weighting: 'DEAL',
    };
  }
  const financingPresenceMetric = {
    FINANCING_COOPERATION_PRESENT: 'FINANCING_COOPERATION_PRESENCE',
    NO_FINANCING_CONDITION_ACKNOWLEDGMENT: 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT_PRESENCE',
  }[key];
  return {
    metric_key: family === 'FINANCING_COVENANTS'
      ? financingPresenceMetric
      : 'GUARANTY_GOVERNED_CLAIM_PRESENCE',
    value_dimension: 'BOOLEAN_PRESENCE', canonical_unit: 'PRESENT_TRUE', canonical_value: true,
    breakdown: dimensions, per_deal_rollup: 'ANY_TRUE', weighting: 'DEAL',
  };
}

function projectEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const key = claimDefinitionKey(entry);
  const definition = FINANCING_CLAIMS[key] || GUARANTY_CLAIMS[key];
  if (!definition) {
    fail('UNGOVERNED_CLAIM', 'Only governed financing and guaranty claims can be projected.', {
      claim_definition_key: key,
    });
  }
  const family = FINANCING_CLAIMS[key] ? 'FINANCING_COVENANTS' : 'GUARANTY_FINANCING_PARTY';
  if (entry.concept_key !== definition.concept) {
    fail('CONCEPT_OWNERSHIP_MISMATCH', 'The claim does not belong to its governed family concept.');
  }
  const claim = entry.claim;
  if (!claim || claim.state !== 'PRESENT' || claim.claim_definition_key !== key
    || !nonEmpty(claim.claim_revision_id) || !validateCanonicalValue(definition, claim.canonical_value)) {
    fail('INVALID_GOVERNED_CLAIM', 'The claim value does not match its governed definition.');
  }
  const provision = entry.provision_instance;
  if (!provision || !GOVERNED_PROVISION_SCHEMA_VERSIONS.has(provision.schema_version)
    || !nonEmpty(provision.provision_instance_id)
    || claim.subject_occurrence_id !== provision.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'The claim must bind to its governed provision instance.');
  }
  const attributes = sanitizeAttributes(claim.attributes || {});
  rejectUngovernedAttributes(definition, attributes);
  const attributesValid = family === 'FINANCING_COVENANTS'
    ? validateFinancingAttributes(key, claim.canonical_value, attributes)
    : validateGuarantyAttributes(key, attributes);
  if (!attributesValid) {
    fail('INVALID_GOVERNED_ATTRIBUTES', 'The claim attributes do not match its governed definition.');
  }
  const dimensions = family === 'FINANCING_COVENANTS'
    ? financingDimensions(key, attributes)
    : guarantyDimensions(key, attributes);
  const fieldKey = family === 'FINANCING_COVENANTS' ? 'financingCovenantFact' : 'guarantyFact';
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

function projectFinancingGuarantyClaims({ resolved_entries: resolvedEntries, publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  const permittedEntries = filterResolvedEntriesForPublication(resolvedEntries, publicationFilter, releaseReceiptId, publicationEvaluationTime);
  if (permittedEntries.length === 0) {
    fail('INVALID_INPUT', 'At least one resolved claim is required.');
  }
  const records = permittedEntries.map(projectEntry)
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
  AUTHORITY_STATE,
  FINANCING_CLAIMS,
  GUARANTY_CLAIMS,
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  FinancingGuarantyProductProjectionError,
  projectFinancingGuarantyClaims,
};
