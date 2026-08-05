'use strict';

const { contentId } = require('./canonical-bytes');

const PRODUCT_PROJECTION_SCHEMA = 'NO_OTHER_REPS_FRAUD_PRODUCT_PROJECTION/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const LABELS = Object.freeze({
  NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT: 'No other representations',
  NON_RELIANCE_ACKNOWLEDGMENT_PRESENT: 'Non-reliance',
  EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT: 'Extra-contractual disclaimer',
  INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT_PRESENT: 'Independent investigation',
  FRAUD_CARVEOUT_PRESENT: 'Fraud carve-out',
  WILLFUL_BREACH_DEFINITION_PRESENT: 'Willful breach definition',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function evidenceQuote(item) {
  return item?.claim?.evidence?.[0] ? item.claim.raw_value || null : null;
}

function projectNoOtherRepsFraudProduct({ resolved } = {}) {
  if (!Array.isArray(resolved)) throw new TypeError('resolved must be an array');
  const facts = resolved.map((item) => {
    const claim = item.claim;
    if (!claim || claim.state !== 'PRESENT' || claim.canonical_value !== true) {
      throw new TypeError('resolved items must be positive presence claims');
    }
    return Object.freeze({
      id: item.resolution_id,
      claim_definition_key: claim.claim_definition_key,
      concept_key: claim.concept_key,
      owner_family: claim.owner_family,
      label: LABELS[claim.claim_definition_key],
      present: true,
      attributes: claim.attributes,
      evidence: evidenceQuote(item),
      evidence_only: item.evidence_only,
    });
  });

  const review = facts.map((fact) => Object.freeze({
    row_id: `no-other-reps-fraud-${fact.id}`,
    table_id: fact.owner_family === 'KEY_DEFINED_TERMS' ? 'key-defined-terms' : 'no-other-reps-fraud',
    label: fact.label,
    status: 'Present',
    concept_key: fact.concept_key,
    owner_family: fact.owner_family,
    attributes: fact.attributes,
    evidence: fact.evidence,
    source_section_reference: resolved.find((item) => item.resolution_id === fact.id)?.section_reference || null,
  }));
  const query = facts.map((fact) => Object.freeze({
    field_key: fact.owner_family === 'KEY_DEFINED_TERMS' ? 'definedTermFact' : 'noOtherRepsFraudFact',
    value: fact.label,
    concept_key: fact.concept_key,
    present: true,
    attributes: fact.attributes,
  }));
  const compare = query.map((fact) => Object.freeze({
    field_key: fact.field_key,
    display_value: fact.value,
    concept_key: fact.concept_key,
  }));
  const market = facts.map((fact) => Object.freeze({
    metric_key: `${fact.claim_definition_key.toLowerCase()}_prevalence`,
    cohort: fact.owner_family,
    present: true,
    concept_key: fact.concept_key,
    breakdown: Object.freeze({ ...fact.attributes }),
  }));
  const body = { schema_version: PRODUCT_PROJECTION_SCHEMA, authority_state: AUTHORITY_STATE, review, query, compare, market };
  return deepFreeze({ ...body, projection_id: contentId(PRODUCT_PROJECTION_SCHEMA, body) });
}

module.exports = {
  AUTHORITY_STATE,
  LABELS,
  PRODUCT_PROJECTION_SCHEMA,
  projectNoOtherRepsFraudProduct,
};
