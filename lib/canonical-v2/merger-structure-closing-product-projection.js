'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');

const PROJECTION_SCHEMA = 'CANONICAL_V2_MERGER_STRUCTURE_CLOSING_PRODUCT_PROJECTION/V1';
const CARD_SCHEMA = 'CANONICAL_V2_MERGER_STRUCTURE_CLOSING_PRODUCT_CARD/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const OWNER_FAMILY = 'MERGER_STRUCTURE_CLOSING';
const CONCEPT_KEY = 'MERGER-STRUCTURE';
const PROVISION_SCHEMAS = new Set([
  'PROVISION_INSTANCE/V1',
  'STRUCTURAL_PROVISION_INSTANCE/V1',
]);

const FEATURE_BY_ASSERTION_KIND = Object.freeze({
  ACTIONS: 'closingActions',
  BOARD_DESIGNATION: 'buyerBoardDesignation',
  CLOSING_LOCATION: 'closingLocation',
  CLOSING_TIMING: 'closingTiming',
  DIRECTORS: 'directorsAtEffectiveTime',
  EFFECTIVE_TIME: 'clause',
  EFFECTS: 'effectsOfMergerReference',
  SHORT_FORM_251H: 'section251h',
});

const TITLE_BY_ASSERTION_KIND = Object.freeze({
  ACTIONS: 'Closing actions',
  BOARD_DESIGNATION: 'Board designation',
  CLOSING_LOCATION: 'Closing location',
  CLOSING_TIMING: 'Closing timing',
  DIRECTORS: 'Directors and officers at close',
  EFFECTIVE_TIME: 'Effective time',
  EFFECTS: 'Effects of merger',
  SHORT_FORM_251H: 'DGCL 251(h) or short-form merger',
});

class MergerStructureClosingProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'MergerStructureClosingProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new MergerStructureClosingProductProjectionError(code, message, details);
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

function claimDefinitionKey(entry) {
  return entry?.resolved_claim_definition_key || entry?.claim?.claim_definition_key || null;
}

function validateCommon(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const definitionKey = claimDefinitionKey(entry);
  if (!['MERGER_STRUCTURE_MECHANIC_PRESENT', 'MERGER_TRANSACTION_STEP'].includes(definitionKey)) {
    fail('UNGOVERNED_STRUCTURE_CLAIM', 'The projection has no approved review route for this claim.', {
      claim_definition_key: definitionKey,
    });
  }
  if (entry.concept_key !== CONCEPT_KEY) {
    fail('CONCEPT_OWNERSHIP_MISMATCH', 'The claim is attached to the wrong governed concept.');
  }
  const claim = entry.claim;
  if (!claim || claim.claim_definition_key !== definitionKey || claim.state !== 'PRESENT'
    || claim.canonical_value !== true || !nonEmpty(claim.claim_revision_id)
    || !nonEmpty(claim.raw_value) || !Array.isArray(claim.evidence) || claim.evidence.length === 0) {
    fail('INVALID_GOVERNED_CLAIM', 'The structure claim does not match its governed definition.', {
      claim_definition_key: definitionKey,
    });
  }
  const provision = entry.provision_instance;
  if (!provision || !PROVISION_SCHEMAS.has(provision.schema_version)
    || !nonEmpty(provision.provision_instance_id)
    || claim.subject_occurrence_id !== provision.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'The claim must bind to its governed provision instance.');
  }
  return { claim, definitionKey, provision };
}

function transactionStep(claim) {
  const attributes = claim.attributes || {};
  if (!Number.isInteger(Number(attributes.step_order)) || Number(attributes.step_order) < 1
    || !['MERGER', 'SUBSEQUENT_MERGER', 'TENDER_OFFER', 'BACK_END_MERGER'].includes(attributes.step_kind)
    || !['SEQUENTIAL', 'PARALLEL'].includes(attributes.concurrency)) {
    fail('INVALID_TRANSACTION_STEP', 'The transaction step does not contain governed step attributes.', {
      claim_revision_id: claim.claim_revision_id,
    });
  }
  return {
    step_order: Number(attributes.step_order),
    step_kind: attributes.step_kind,
    disappearing_entity: attributes.disappearing_entity || null,
    surviving_entity: attributes.surviving_entity || null,
    parent_entity: attributes.parent_entity || null,
    concurrency: attributes.concurrency,
  };
}

function projectedFeature(definitionKey, claim) {
  if (definitionKey === 'MERGER_TRANSACTION_STEP') {
    return { featureKey: 'transactionSteps', value: [transactionStep(claim)], title: 'Transaction step' };
  }
  const assertionKind = claim.attributes?.assertion_kind;
  const featureKey = FEATURE_BY_ASSERTION_KIND[assertionKind];
  if (!featureKey) {
    fail('UNMAPPED_STRUCTURE_ASSERTION', 'The governed assertion has no approved Review V2 row.', {
      claim_revision_id: claim.claim_revision_id,
      assertion_kind: assertionKind || null,
    });
  }
  return { featureKey, value: claim.raw_value, title: TITLE_BY_ASSERTION_KIND[assertionKind] };
}

function projectCard(entry, dealId) {
  const { claim, definitionKey, provision } = validateCommon(entry);
  const projected = projectedFeature(definitionKey, claim);
  const features = freeze({ [projected.featureKey]: clone(projected.value) });
  const identity = {
    claim_revision_id: claim.claim_revision_id,
    feature_key: projected.featureKey,
    provision_instance_id: provision.provision_instance_id,
  };
  return freeze({
    id: contentId(CARD_SCHEMA, identity),
    deal_id: dealId,
    provision_instance_id: provision.provision_instance_id,
    excerpt_id: claim.evidence[0]?.excerpt_id || `native:${claim.claim_revision_id}`,
    type: 'STRUCTURE_MECHANICS',
    provision_type: 'STRUCTURE_MECHANICS',
    provision_subtype: CONCEPT_KEY,
    section_ref: entry.section_reference,
    short_title: projected.title,
    primary_quote: claim.raw_value,
    region_full_text: claim.raw_value,
    full_text: claim.raw_value,
    features,
    ai_metadata: freeze({ features }),
    canonical_v2_lineage: freeze({
      source: NATIVE_SOURCE,
      owner_family: OWNER_FAMILY,
      claim_revision_ids: [claim.claim_revision_id],
      claim_definition_keys: [definitionKey],
      feature_claim_revision_ids: {
        [projected.featureKey]: [claim.claim_revision_id],
      },
    }),
  });
}

function projectMergerStructureClosingProductSurfaces({
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
  const identities = cards.map((card) => card.canonical_v2_lineage.claim_revision_ids[0]);
  if (new Set(identities).size !== identities.length) {
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
  FEATURE_BY_ASSERTION_KIND,
  MergerStructureClosingProductProjectionError,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
  projectMergerStructureClosingProductSurfaces,
};
