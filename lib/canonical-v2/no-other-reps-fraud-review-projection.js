'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');

const PROJECTION_SCHEMA = 'CANONICAL_V2_NO_OTHER_REPS_FRAUD_REVIEW_PROJECTION/V1';
const CARD_SCHEMA = 'CANONICAL_V2_NO_OTHER_REPS_FRAUD_REVIEW_CARD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const FEATURE_KEY = 'noOtherRepsFraudFact';

const OBSERVED_CLAIMS = Object.freeze({
  NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT: Object.freeze({
    label: 'No other representations',
    conceptBySide: Object.freeze({ TARGET: 'REP-T-NOOTHERREPS', BUYER: 'REP-B-NOOTHERREPS' }),
  }),
  NON_RELIANCE_ACKNOWLEDGMENT_PRESENT: Object.freeze({
    label: 'Non-reliance',
    conceptBySide: Object.freeze({ TARGET: 'REP-T-NONRELIANCE', BUYER: 'REP-B-NONRELIANCE' }),
  }),
  EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT: Object.freeze({
    label: 'Extra-contractual disclaimer',
    conceptBySide: Object.freeze({ TARGET: 'REP-T-NONRELIANCE', BUYER: 'REP-B-NONRELIANCE' }),
  }),
});

class NoOtherRepsFraudReviewProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NoOtherRepsFraudReviewProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NoOtherRepsFraudReviewProjectionError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function projectCard(entry, dealId) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const definitionKey = entry.resolved_claim_definition_key || entry.claim?.claim_definition_key;
  const definition = OBSERVED_CLAIMS[definitionKey];
  if (!definition) {
    fail('UNOBSERVED_NO_OTHER_REPS_FRAUD_CLAIM', 'The claim has no approved atomic review route.', {
      claim_definition_key: definitionKey || null,
    });
  }
  const claim = entry.claim;
  if (!claim || claim.claim_definition_key !== definitionKey || claim.state !== 'PRESENT'
    || claim.canonical_value !== true || !nonEmpty(claim.claim_revision_id)
    || !nonEmpty(claim.raw_value) || !Array.isArray(claim.evidence) || claim.evidence.length === 0) {
    fail('INVALID_GOVERNED_CLAIM', 'The claim is not a governed positive-presence claim.');
  }
  const side = claim.attributes?.representation_side;
  const expectedConcept = definition.conceptBySide[side];
  if (!expectedConcept || entry.concept_key !== expectedConcept) {
    fail('CONCEPT_OWNERSHIP_MISMATCH', 'The claim side does not match its governed concept.', {
      claim_definition_key: definitionKey,
      representation_side: side || null,
      concept_key: entry.concept_key || null,
    });
  }
  const provision = entry.provision_instance;
  if (!provision || provision.schema_version !== 'PROVISION_INSTANCE/V1'
    || !nonEmpty(provision.provision_instance_id)
    || claim.subject_occurrence_id !== provision.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'The claim must bind to its governed provision.');
  }
  const party = entry.party;
  if (!party || party.role !== 'REPRESENTATION_MAKER' || party.capacity !== side
    || !nonEmpty(party.value) || !provision.party
    || canonicalJson(party) !== canonicalJson(provision.party)) {
    fail('INVALID_INHERITED_PARTY', 'The claim and provision must use the same representation maker for the claimed side.', {
      claim_definition_key: definitionKey,
      representation_side: side,
    });
  }
  const features = freeze({ [FEATURE_KEY]: claim.raw_value });
  const identity = {
    claim_revision_id: claim.claim_revision_id,
    provision_instance_id: provision.provision_instance_id,
  };
  return freeze({
    id: contentId(CARD_SCHEMA, identity),
    deal_id: dealId,
    provision_instance_id: provision.provision_instance_id,
    excerpt_id: claim.evidence[0]?.excerpt_id || `native:${claim.claim_revision_id}`,
    type: 'REPRESENTATION',
    provision_type: 'REPRESENTATION',
    provision_subtype: entry.concept_key,
    section_ref: entry.section_reference,
    short_title: definition.label,
    primary_quote: claim.raw_value,
    region_full_text: claim.raw_value,
    full_text: claim.raw_value,
    features,
    ai_metadata: freeze({ features }),
    authority_state: AUTHORITY_STATE,
    owner_family: 'NO_OTHER_REPS_FRAUD',
    concept_key: entry.concept_key,
    claim_definition_key: definitionKey,
    attributes: freeze(clone(claim.attributes || {})),
    canonical_v2_lineage: freeze({
      source: NATIVE_SOURCE,
      claim_revision_ids: [claim.claim_revision_id],
      claim_definition_keys: [definitionKey],
      feature_claim_revision_ids: { [FEATURE_KEY]: [claim.claim_revision_id] },
    }),
  });
}

function projectNoOtherRepsFraudReviewSurfaces({
  resolution,
  deal_id: dealId,
  publication_filter: publicationFilter,
  release_receipt_id: releaseReceiptId,
  publication_evaluation_time: publicationEvaluationTime,
} = {}) {
  if (!resolution || !Array.isArray(resolution.resolved)) {
    fail('INVALID_INPUT', 'resolution.resolved must be an array.');
  }
  if (!nonEmpty(dealId)) fail('INVALID_INPUT', 'deal_id must be a non-empty string.');
  const entries = filterResolvedEntriesForPublication(
    resolution.resolved,
    publicationFilter,
    releaseReceiptId,
    publicationEvaluationTime,
  );
  const cards = entries.map((entry) => projectCard(entry, dealId))
    .sort((left, right) => left.id.localeCompare(right.id));
  const claimIds = cards.map((card) => card.canonical_v2_lineage.claim_revision_ids[0]);
  if (new Set(claimIds).size !== claimIds.length) {
    fail('DUPLICATE_PRODUCT_CLAIM', 'A governed claim can contribute only one review card.');
  }
  const body = { deal_id: dealId, source: NATIVE_SOURCE, cards };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

module.exports = {
  AUTHORITY_STATE,
  FEATURE_KEY,
  NoOtherRepsFraudReviewProjectionError,
  OBSERVED_CLAIMS,
  PROJECTION_SCHEMA,
  projectNoOtherRepsFraudReviewSurfaces,
};
