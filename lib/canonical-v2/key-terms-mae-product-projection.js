'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { MAE_CARVEOUT_CODES } = require('./native-producer/anthropic-provider');

const PROJECTION_SCHEMA = 'KEY_TERMS_MAE_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'KEY_TERMS_MAE_PRODUCT_RECORD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';

const KEY_TERM_CLAIMS = Object.freeze({
  ACQUISITION_PROPOSAL_THRESHOLD_PERCENT: Object.freeze({ concept: 'DEF-ACQPROPOSAL', label: 'Acquisition Proposal threshold', value_kind: 'PERCENT' }),
  SUPERIOR_PROPOSAL_THRESHOLD_PERCENT: Object.freeze({ concept: 'DEF-SUPERIOR', label: 'Superior Proposal threshold', value_kind: 'PERCENT' }),
  DEFINED_TERM_THRESHOLD_SUBSTITUTION: Object.freeze({ concept: 'DEF-SUPERIOR', label: 'Threshold substitution rule', value_kind: 'SUBSTITUTION' }),
  SUPERIOR_PROPOSAL_QUALIFIER: Object.freeze({ concept: 'DEF-SUPERIOR', label: 'Superior Proposal qualifier', value_kind: 'ENUM', values: Object.freeze(['FINANCIAL_FAVORABILITY', 'CONSUMMATION_LIKELIHOOD']) }),
  INTERVENING_EVENT_DEFINITION: Object.freeze({ concept: 'DEF-INTERVENING', label: 'Intervening Event definition', value_kind: 'PRESENCE', values: Object.freeze([true]) }),
  INTERVENING_EVENT_EXCLUSION: Object.freeze({ concept: 'DEF-INTERVENING', label: 'Intervening Event exclusion', value_kind: 'ENUM', values: Object.freeze(['ACQUISITION_PROPOSAL_RECEIPT', 'STOCK_PRICE_CHANGE', 'NON_MAE_EFFECT']) }),
  KNOWLEDGE_STANDARD: Object.freeze({ concept: 'DEF-KNOWLEDGE', label: 'Knowledge standard', value_kind: 'ENUM', values: Object.freeze(['ACTUAL', 'AFTER_INQUIRY', 'CONSTRUCTIVE']) }),
  KNOWLEDGE_PERSON_SOURCE: Object.freeze({ concept: 'DEF-KNOWLEDGE', label: 'Knowledge person source', value_kind: 'ENUM', values: Object.freeze(['NAMED_INDIVIDUALS', 'SCHEDULE_REFERENCE', 'TITLE_CLASS']) }),
  WILLFUL_BREACH_DEFINITION: Object.freeze({ concept: 'DEF-WILLFUL', label: 'Willful Breach definition', value_kind: 'PRESENCE', values: Object.freeze([true]) }),
  WILLFUL_BREACH_KNOWLEDGE_STANDARD: Object.freeze({ concept: 'DEF-WILLFUL', label: 'Willful Breach knowledge standard', value_kind: 'ENUM', values: Object.freeze(['ACTUAL', 'ACTUAL_OR_CONSTRUCTIVE']) }),
  TAX_DEFINITION_RECORDED: Object.freeze({ concept: 'DEF-TAX', label: 'Tax definition', value_kind: 'RECORDED_DEFINITION' }),
  TAX_RETURN_DEFINITION_RECORDED: Object.freeze({ concept: 'DEF-TAX-RETURN', label: 'Tax Return definition', value_kind: 'RECORDED_DEFINITION' }),
  MADE_AVAILABLE_DEFINITION_RECORDED: Object.freeze({ concept: 'DEF-MADE-AVAILABLE', label: 'Made Available definition', value_kind: 'RECORDED_DEFINITION' }),
  ORDINARY_COURSE_DEFINITION_RECORDED: Object.freeze({ concept: 'DEF-ORDINARY-COURSE', label: 'Ordinary Course definition', value_kind: 'RECORDED_DEFINITION' }),
});

const MAE_CLAIMS = Object.freeze({
  MAE_CARVEOUT: Object.freeze({ concept: 'DEF-MAE', label: 'MAE carve-out', value_kind: 'ENUM', values: MAE_CARVEOUT_CODES }),
  MAE_DEFINITION_PRONG: Object.freeze({ concept: 'DEF-MAE', label: 'MAE definition prong', value_kind: 'ENUM', values: Object.freeze(['BUSINESS_EFFECTS', 'CONSUMMATION_PREVENTION']) }),
  MAE_DISPROPORTIONALITY_CARVEBACK: Object.freeze({ concept: 'DEF-MAE', label: 'Disproportionality carveback', value_kind: 'PRESENCE', values: Object.freeze([true]) }),
});

class KeyTermsMaeProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'KeyTermsMaeProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new KeyTermsMaeProductProjectionError(code, message, details);
}

function claimDefinitionKey(entry) {
  return entry?.resolved_claim_definition_key || entry?.claim?.claim_definition_key || null;
}

function validateCanonicalValue(definition, value) {
  if (definition.value_kind === 'RECORDED_DEFINITION') return value === true;
  if (definition.value_kind === 'PERCENT' || definition.value_kind === 'SUBSTITUTION') {
    return typeof value === 'string' && /^(0|[1-9]\d*)(?:\.\d+)?$/.test(value);
  }
  return definition.values.includes(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0;
}

function validPercent(value) {
  return typeof value === 'string' && /^(0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function validateKeyTermAttributes(key, value, attributes) {
  const thresholdBasis = ['EQUITY_SECURITIES', 'ASSETS', 'REVENUE_OR_EARNINGS'];
  const knowledgeParty = [null, 'TARGET', 'BUYER'];
  const valid = {
    ACQUISITION_PROPOSAL_THRESHOLD_PERCENT: () => nonEmpty(attributes.proposal_term_ref)
      && thresholdBasis.includes(attributes.threshold_basis),
    SUPERIOR_PROPOSAL_THRESHOLD_PERCENT: () => nonEmpty(attributes.superior_term_ref)
      && thresholdBasis.includes(attributes.threshold_basis),
    DEFINED_TERM_THRESHOLD_SUBSTITUTION: () => validPercent(attributes.substitution_from_percent)
      && nonEmpty(attributes.substituted_term_ref) && nonEmpty(attributes.host_term_ref),
    SUPERIOR_PROPOSAL_QUALIFIER: () => nonEmpty(attributes.superior_term_ref)
      && attributes.qualifier_code === value,
    INTERVENING_EVENT_DEFINITION: () => nonEmpty(attributes.event_term_ref),
    INTERVENING_EVENT_EXCLUSION: () => nonEmpty(attributes.event_term_ref)
      && attributes.exclusion_code === value,
    KNOWLEDGE_STANDARD: () => nonEmpty(attributes.knowledge_term_ref)
      && attributes.standard_code === value && knowledgeParty.includes(attributes.knowledge_party ?? null),
    KNOWLEDGE_PERSON_SOURCE: () => nonEmpty(attributes.knowledge_term_ref)
      && attributes.source_code === value && knowledgeParty.includes(attributes.knowledge_party ?? null)
      && (value !== 'NAMED_INDIVIDUALS'
        || (Array.isArray(attributes.named_persons) && attributes.named_persons.length > 0
          && attributes.named_persons.every(nonEmpty))),
    WILLFUL_BREACH_DEFINITION: () => nonEmpty(attributes.breach_term_ref),
    WILLFUL_BREACH_KNOWLEDGE_STANDARD: () => nonEmpty(attributes.breach_term_ref)
      && attributes.standard_code === value,
    TAX_DEFINITION_RECORDED: () => validRecordedDefinitionEnvelope(attributes, 'tax'),
    TAX_RETURN_DEFINITION_RECORDED: () => validRecordedDefinitionEnvelope(attributes, 'tax return'),
    MADE_AVAILABLE_DEFINITION_RECORDED: () => validRecordedDefinitionEnvelope(attributes, 'made available'),
    ORDINARY_COURSE_DEFINITION_RECORDED: () => validRecordedDefinitionEnvelope(attributes, 'ordinary course'),
  }[key];
  return valid && valid();
}

function normaliseDefinedTermIdentity(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/[“”"]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase()
    : '';
}

function validRecordedDefinitionEnvelope(attributes, expectedIdentity) {
  const envelope = attributes.definition_envelope;
  return attributes.definition_equivalence === 'NOT_ASSERTED'
    && attributes.defined_term_identity === expectedIdentity
    && envelope && typeof envelope === 'object'
    && normaliseDefinedTermIdentity(envelope.defined_term) === expectedIdentity
    && typeof envelope.definition_head_quote === 'string'
    && envelope.definition_head_quote.includes(envelope.defined_term)
    && typeof envelope.definition_body_quote === 'string'
    && envelope.definition_body_quote.length > 0
    && (envelope.cross_reference_target === null
      || (typeof envelope.cross_reference_target === 'string'
        && envelope.definition_body_quote.includes(envelope.cross_reference_target)));
}

function validateMaeAttributes(key, value, attributes) {
  if (!nonEmpty(attributes.defined_term_ref)) return false;
  if (key === 'MAE_CARVEOUT') {
    return attributes.carveout_code === value && nonEmpty(attributes.clause_label);
  }
  if (key === 'MAE_DEFINITION_PRONG') return attributes.prong_code === value;
  return Array.isArray(attributes.applies_to_clause_labels)
    && attributes.applies_to_clause_labels.length > 0
    && attributes.applies_to_clause_labels.every(nonEmpty)
    && nonEmpty(attributes.comparison_baseline_phrase);
}

function keyTermDimensions(key, attributes) {
  const dimensions = { claim_definition_key: key };
  if (KEY_TERM_CLAIMS[key]?.value_kind === 'RECORDED_DEFINITION') {
    return {
      ...dimensions,
      defined_term_identity: attributes.defined_term_identity,
      definition_kind: attributes.definition_envelope.definition_kind,
      comparison_basis: 'SAME_NORMALIZED_DEFINED_TERM_IDENTITY_ONLY',
      definition_equivalence: 'NOT_ASSERTED',
    };
  }
  if (['ACQUISITION_PROPOSAL_THRESHOLD_PERCENT', 'SUPERIOR_PROPOSAL_THRESHOLD_PERCENT'].includes(key)) {
    dimensions.threshold_basis = attributes.threshold_basis ?? null;
  }
  if (key === 'DEFINED_TERM_THRESHOLD_SUBSTITUTION') {
    dimensions.substitution_from_percent = attributes.substitution_from_percent ?? null;
    dimensions.substituted_term_ref = attributes.substituted_term_ref ?? null;
    dimensions.host_term_ref = attributes.host_term_ref ?? null;
    dimensions.relationship_state = 'OPEN_WORLD_UNADJUDICATED';
  }
  if (['KNOWLEDGE_STANDARD', 'KNOWLEDGE_PERSON_SOURCE'].includes(key)) {
    dimensions.knowledge_party = attributes.knowledge_party ?? null;
  }
  return dimensions;
}

function maeDimensions(key, attributes) {
  if (key === 'MAE_CARVEOUT') return { carveout_code: attributes.carveout_code ?? null };
  if (key === 'MAE_DEFINITION_PRONG') return { prong_code: attributes.prong_code ?? null };
  return { relationship_state: 'OPEN_WORLD_UNADJUDICATED' };
}

function marketValue(family, key, definition, canonicalValue, dimensions) {
  if (family === 'KEY_DEFINED_TERMS' && definition.value_kind === 'RECORDED_DEFINITION') {
    return Object.freeze({ market_statistics: 'NOT_CALCULATED' });
  }
  if (family === 'KEY_DEFINED_TERMS' && definition.value_kind === 'PERCENT') {
    return {
      metric_key: 'KEY_DEFINED_TERM_PERCENT_BY_CLAIM_AND_BASIS',
      value_dimension: 'PERCENT', canonical_unit: 'PERCENT', canonical_value: canonicalValue,
      breakdown: dimensions, per_deal_rollup: 'DISTINCT_VALUES', weighting: 'DEAL',
    };
  }
  if (family === 'KEY_DEFINED_TERMS' && definition.value_kind === 'SUBSTITUTION') {
    return {
      metric_key: 'KEY_DEFINED_TERM_SUBSTITUTION_RULE_PRESENCE',
      value_dimension: 'BOOLEAN_PRESENCE', canonical_unit: 'PRESENT_TRUE', canonical_value: true,
      breakdown: dimensions, per_deal_rollup: 'ANY_TRUE', weighting: 'DEAL',
    };
  }
  if (family === 'MAE_DEFINITION') {
    return {
      metric_key: key === 'MAE_DISPROPORTIONALITY_CARVEBACK'
        ? 'MAE_DISPROPORTIONALITY_CARVEBACK_PRESENCE'
        : 'MAE_GOVERNED_VALUE_BY_CLAIM',
      value_dimension: definition.value_kind === 'PRESENCE' ? 'BOOLEAN_PRESENCE' : 'ENUM',
      canonical_unit: definition.value_kind === 'PRESENCE' ? 'PRESENT_TRUE' : 'CODE',
      canonical_value: canonicalValue, breakdown: dimensions,
      per_deal_rollup: definition.value_kind === 'PRESENCE' ? 'ANY_TRUE' : 'DISTINCT_VALUES', weighting: 'DEAL',
    };
  }
  return {
    metric_key: 'KEY_DEFINED_TERM_GOVERNED_VALUE_BY_CLAIM',
    value_dimension: definition.value_kind === 'PRESENCE' ? 'BOOLEAN_PRESENCE' : 'ENUM',
    canonical_unit: definition.value_kind === 'PRESENCE' ? 'PRESENT_TRUE' : 'CODE',
    canonical_value: canonicalValue, breakdown: dimensions,
    per_deal_rollup: definition.value_kind === 'PRESENCE' ? 'ANY_TRUE' : 'DISTINCT_VALUES', weighting: 'DEAL',
  };
}

function projectEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const key = claimDefinitionKey(entry);
  const definition = KEY_TERM_CLAIMS[key] || MAE_CLAIMS[key];
  if (!definition) {
    fail('UNGOVERNED_CLAIM', 'Only governed Key Defined Terms and MAE claims can be projected.', { claim_definition_key: key });
  }
  const family = KEY_TERM_CLAIMS[key] ? 'KEY_DEFINED_TERMS' : 'MAE_DEFINITION';
  if (entry.concept_key !== definition.concept) {
    fail('CONCEPT_OWNERSHIP_MISMATCH', 'The claim does not belong to its governed family concept.');
  }
  const claim = entry.claim;
  if (!claim || claim.state !== 'PRESENT' || claim.claim_definition_key !== key
    || !validateCanonicalValue(definition, claim.canonical_value)) {
    fail('INVALID_GOVERNED_CLAIM', 'The claim value does not match its governed definition.');
  }
  const provision = entry.provision_instance;
  const expectedProvisionSchema = family === 'KEY_DEFINED_TERMS'
    ? 'STRUCTURAL_PROVISION_INSTANCE/V1'
    : 'PROVISION_INSTANCE/V1';
  if (!provision || provision.schema_version !== expectedProvisionSchema
    || claim.subject_occurrence_id !== provision.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'The claim must bind to its governed provision instance.');
  }
  const attributes = claim.attributes || {};
  const attributesValid = family === 'KEY_DEFINED_TERMS'
    ? validateKeyTermAttributes(key, claim.canonical_value, attributes)
    : validateMaeAttributes(key, claim.canonical_value, attributes);
  if (!attributesValid) {
    fail('INVALID_GOVERNED_ATTRIBUTES', 'The claim attributes do not match its governed definition.');
  }
  const dimensions = family === 'KEY_DEFINED_TERMS'
    ? keyTermDimensions(key, attributes)
    : maeDimensions(key, attributes);
  if (Object.hasOwn(attributes, 'effective_threshold_percent')
    || Object.hasOwn(attributes, 'applies_to_carveout_claim_ids')) {
    fail('UNADJUDICATED_RELATIONSHIP', 'Derived cross-definition and per-clause relationships remain open world.');
  }
  const fieldKey = family === 'KEY_DEFINED_TERMS' ? 'definedTermFact' : 'maeDefinitionFact';
  const productValue = {
    concept_key: definition.concept,
    claim_definition_key: key,
    canonical_value: claim.canonical_value,
    dimensions,
    ...(definition.value_kind === 'RECORDED_DEFINITION'
      ? {
        definition_envelope: attributes.definition_envelope,
        definition_equivalence: 'NOT_ASSERTED',
      }
      : {}),
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
      ...(definition.value_kind === 'RECORDED_DEFINITION'
        ? {
          exact_definition: attributes.definition_envelope,
          definition_equivalence: 'NOT_ASSERTED',
        }
        : {}),
      source_section_reference: entry.section_reference,
    },
    query: { field_key: fieldKey, value: productValue },
    compare: { field_key: fieldKey, value: productValue },
    market: { metric_version: 1, ...marketValue(family, key, definition, claim.canonical_value, dimensions) },
  };
  return Object.freeze({ ...body, projection_record_id: contentId(RECORD_SCHEMA, body) });
}

function projectKeyTermsMaeClaims({ resolved_entries: resolvedEntries } = {}) {
  if (!Array.isArray(resolvedEntries) || resolvedEntries.length === 0) {
    fail('INVALID_INPUT', 'At least one resolved claim is required.');
  }
  const records = resolvedEntries.map(projectEntry)
    .sort((left, right) => left.projection_record_id.localeCompare(right.projection_record_id));
  const ids = records.map((record) => canonicalJson([
    record.claim_revision_id,
    record.owner_family,
  ]));
  if (new Set(ids).size !== ids.length) {
    fail('DUPLICATE_PRODUCT_CLAIM', 'A governed claim can contribute only one product record.');
  }
  const body = { schema_version: PROJECTION_SCHEMA, authority_state: AUTHORITY_STATE, records };
  return Object.freeze({ ...body, projection_id: contentId(PROJECTION_SCHEMA, body) });
}

module.exports = {
  AUTHORITY_STATE,
  KEY_TERM_CLAIMS,
  MAE_CLAIMS,
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  KeyTermsMaeProductProjectionError,
  projectKeyTermsMaeClaims,
};
