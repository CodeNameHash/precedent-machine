'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');
const {
  REPRESENTATION_TOPIC_CODES_V1,
  REPRESENTATION_TOPIC_REGISTRY_BINDING_V1,
} = require('./contract-bundle');

const PROJECTION_SCHEMA = 'REPRESENTATIONS_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'REPRESENTATIONS_PRODUCT_RECORD/V1';
const OPEN_WORLD_RECORD_SCHEMA = 'REPRESENTATIONS_OPEN_WORLD_PRODUCT_RECORD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';

// PLAN.md Step 2D1 defect 4 (2026-08-07): this used to compare
// provision.schema_version to the single literal 'PROVISION_INSTANCE/V1'.
// Step 4A1 taught the SQL writer a second, legitimate provision kind --
// 'STRUCTURAL_PROVISION_INSTANCE/V1', the partyless shape -- and
// validate-write-set.js's assertStructuralRowShape/expectedObjectId admit
// both. candidate-resolution.js's GENERIC_CLAIM_KEY_RESOLUTION_TABLE gives
// every row that reaches REPRESENTATION_ACCURACY_STANDARD/KNOWLEDGE_
// QUALIFIER a party_field (party_making or condition_obligor), so every
// representation claim resolved today is, and should stay, party-bound;
// `sideForParty(provision.party)` a few lines below still fails closed
// (UNRESOLVED_REPRESENTATION_SIDE) if a claim ever binds to a partyless
// provision instead. Accepting the union here removes a schema-identity trap
// that has nothing to do with the party check this module actually needs,
// without weakening it: 0 resolved entries in the committed
// modiv-representations-20260807-replay run, so this is latent, not
// confirmed, for this family specifically.
const GOVERNED_PROVISION_SCHEMA_VERSIONS = new Set([
  'PROVISION_INSTANCE/V1',
  'STRUCTURAL_PROVISION_INSTANCE/V1',
]);

const ACCURACY_CODES = Object.freeze([
  'MAT_ALL_RESPECTS',
  'MAT_ALL_RESPECTS_DE_MINIMIS',
  'MAT_ALL_MATERIAL',
  'MAT_MAE_QUALIFIED',
]);
const KNOWLEDGE_STANDARDS = Object.freeze(['ACTUAL', 'CONSTRUCTIVE', 'AFTER_INQUIRY']);
const QUALIFIER_POSITIONS = Object.freeze(['CHAPEAU', 'ITEM', 'TRAILING']);
const TOPIC_CLAIM_KEY = 'REPRESENTATION_TOPIC_PRESENT';
const TOPIC_CONCEPTS = Object.freeze(new Set(['REP-T-TOPIC', 'REP-B-TOPIC']));
const EXCLUDED_CONCEPTS = Object.freeze(new Set([
  'REP-T-CONTRACTS',
  'REP-T-MATERIAL-CONTRACTS',
  'REP-B-CONTRACTS',
  'REP-B-MATERIAL-CONTRACTS',
  'REP-T-NOOTHERREPS',
  'REP-B-NOOTHERREPS',
  'REP-T-NONRELIANCE',
  'REP-B-NONRELIANCE',
  'REP-T-INDEPINVEST',
  'REP-B-INDEPINVEST',
  'REP-T-FRAUDCARVEOUT',
  'REP-B-FRAUDCARVEOUT',
]));

const GOVERNED_CLAIMS = Object.freeze({
  REPRESENTATION_ACCURACY_STANDARD: Object.freeze({
    label: 'Representation accuracy standard',
    value_kind: 'ENUM',
    values: ACCURACY_CODES,
  }),
  KNOWLEDGE_QUALIFIER: Object.freeze({
    label: 'Knowledge qualifier',
    value_kind: 'PRESENCE',
    values: Object.freeze([true]),
  }),
  [TOPIC_CLAIM_KEY]: Object.freeze({
    label: 'Representation topic present',
    value_kind: 'ENUM',
    values: REPRESENTATION_TOPIC_CODES_V1,
  }),
});

class RepresentationsProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RepresentationsProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RepresentationsProductProjectionError(code, message, details);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function claimDefinitionKey(entry) {
  return entry?.resolved_claim_definition_key || entry?.claim?.claim_definition_key || null;
}

function sideForParty(party) {
  if (!party || party.role !== 'REPRESENTATION_MAKER' || !nonEmpty(party.value)) return null;
  if (party.capacity === 'TARGET') return 'TARGET';
  if (party.capacity === 'BUYER' || party.capacity === 'BUYER_AFFILIATE') return 'PARENT';
  return null;
}

function expectedSideForConcept(conceptKey) {
  if (conceptKey.startsWith('REP-T-')) return 'TARGET';
  if (conceptKey.startsWith('REP-B-')) return 'PARENT';
  return null;
}

function validateAttachment(attributes) {
  const attachment = attributes.attachment;
  if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)
    || !QUALIFIER_POSITIONS.includes(attachment.position)) {
    fail('INVALID_QUALIFIER_ATTACHMENT', 'A governed qualifier needs an evidenced attachment position.');
  }
  return attachment.position;
}

function validateTopicRegistryBinding(attributes) {
  if (attributes?.topic_registry_version !== REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_version
    || attributes?.topic_registry_digest !== REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_digest) {
    fail('TOPIC_REGISTRY_BINDING_MISMATCH', 'A representation topic must carry the bound registry version and digest.');
  }
}

function dimensionsFor(key, side, party, attributes) {
  if (key === TOPIC_CLAIM_KEY) {
    validateTopicRegistryBinding(attributes);
    return {
      representation_side: side,
      representation_maker: party.value,
      representation_maker_capacity: party.capacity,
      topic_registry_version: REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_version,
      topic_registry_digest: REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_digest,
    };
  }
  const qualifierPosition = validateAttachment(attributes);
  if (key === 'REPRESENTATION_ACCURACY_STANDARD' && qualifierPosition !== 'CHAPEAU') {
    fail('INVALID_QUALIFIER_ATTACHMENT', 'A representation-level accuracy standard must attach at the chapeau.');
  }
  const dimensions = {
    representation_side: side,
    representation_maker: party.value,
    representation_maker_capacity: party.capacity,
    qualifier_position: qualifierPosition,
    qualifier_scope_state: 'POSITION_ONLY_NOT_LEGAL_SCOPE',
  };
  if (key === 'KNOWLEDGE_QUALIFIER' && attributes.knowledge_standard !== undefined) {
    if (!KNOWLEDGE_STANDARDS.includes(attributes.knowledge_standard)) {
      fail('INVALID_KNOWLEDGE_STANDARD', 'The knowledge standard is not governed.');
    }
    dimensions.knowledge_standard = attributes.knowledge_standard;
  }
  return dimensions;
}

function marketValue(key, canonicalValue, dimensions) {
  if (key === TOPIC_CLAIM_KEY) {
    return {
      metric_key: TOPIC_CLAIM_KEY,
      value_dimension: 'CATEGORICAL',
      canonical_unit: 'REPRESENTATION_TOPIC_CODE',
      canonical_value: canonicalValue,
      breakdown: dimensions,
      per_deal_rollup: 'DISTINCT_VALUE_SET',
      weighting: 'DEAL',
    };
  }
  return key === 'REPRESENTATION_ACCURACY_STANDARD'
    ? {
      metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
      value_dimension: 'CATEGORICAL',
      canonical_unit: 'ACCURACY_STANDARD_CODE',
      canonical_value: canonicalValue,
      breakdown: dimensions,
      per_deal_rollup: 'DISTINCT_VALUE_SET',
      weighting: 'DEAL',
    }
    : {
      metric_key: 'REPRESENTATION_KNOWLEDGE_QUALIFIER_PRESENCE',
      value_dimension: 'BOOLEAN_PRESENCE',
      canonical_unit: 'PRESENT_TRUE',
      canonical_value: true,
      breakdown: dimensions,
      per_deal_rollup: 'ANY_TRUE',
      weighting: 'DEAL',
    };
}

function projectEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const key = claimDefinitionKey(entry);
  const definition = GOVERNED_CLAIMS[key];
  if (!definition) {
    fail('UNGOVERNED_CLAIM', 'Only governed representation accuracy, knowledge and topic claims can be projected.', {
      claim_definition_key: key,
    });
  }
  if (!nonEmpty(entry.concept_key) || EXCLUDED_CONCEPTS.has(entry.concept_key)) {
    fail('EXCLUDED_FAMILY_OWNERSHIP', 'Material contracts and no-other-representations claims keep their own owner.');
  }
  if ((key === TOPIC_CLAIM_KEY) !== TOPIC_CONCEPTS.has(entry.concept_key)) {
    fail('TOPIC_CONCEPT_MISMATCH', 'The representation topic claim and topic concept must appear together.');
  }
  const claim = entry.claim;
  if (!claim || claim.state !== 'PRESENT' || claim.claim_definition_key !== key
    || !nonEmpty(claim.claim_revision_id) || !definition.values.includes(claim.canonical_value)
    || !nonEmpty(claim.raw_value) || !Array.isArray(claim.evidence) || claim.evidence.length === 0) {
    fail('INVALID_GOVERNED_CLAIM', 'The claim value does not match its governed definition.');
  }
  const provision = entry.provision_instance;
  if (!provision || !GOVERNED_PROVISION_SCHEMA_VERSIONS.has(provision.schema_version)
    || !nonEmpty(provision.provision_instance_id) || !nonEmpty(claim.subject_occurrence_id)) {
    fail('INVALID_PROVISION_BINDING', 'The claim must bind to its governed representation instance.');
  }
  const side = sideForParty(provision.party);
  if (!side) fail('UNRESOLVED_REPRESENTATION_SIDE', 'The representation maker does not resolve to target or parent.');
  const conceptSide = expectedSideForConcept(entry.concept_key);
  if (conceptSide && conceptSide !== side) {
    fail('SIDE_IDENTITY_MISMATCH', 'The representation concept and maker identify different sides.');
  }
  const dimensions = dimensionsFor(key, side, provision.party, claim.attributes || {});
  if (dimensions.qualifier_position === 'CHAPEAU'
    && claim.subject_occurrence_id !== provision.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'A chapeau qualifier must bind to its representation instance.');
  }
  const fieldKey = side === 'TARGET' ? 'targetRepresentationFact' : 'parentRepresentationFact';
  const productValue = {
    concept_key: entry.concept_key,
    claim_definition_key: key,
    canonical_value: claim.canonical_value,
    dimensions,
  };
  const body = {
    schema_version: RECORD_SCHEMA,
    authority_state: AUTHORITY_STATE,
    owner_family: 'REPRESENTATIONS',
    representation_side: side,
    claim_revision_id: claim.claim_revision_id,
    provision_instance_id: provision.provision_instance_id,
    subject_occurrence_id: claim.subject_occurrence_id,
    evidence: {
      quote: claim.raw_value,
      category: key === TOPIC_CLAIM_KEY ? 'REPRESENTATION_TOPIC' : claim.attributes.qualifier_kind,
      spans: clone(claim.evidence),
    },
    review: {
      section_key: side === 'TARGET' ? 'target-representations' : 'parent-representations',
      row_key: `${side}:${key}`,
      label: definition.label,
      value: claim.canonical_value,
      dimensions,
      source_section_reference: entry.section_reference,
    },
    query: { field_key: fieldKey, value: productValue },
    compare: { field_key: fieldKey, value: productValue },
    market: { metric_version: 1, ...marketValue(key, claim.canonical_value, dimensions) },
  };
  return Object.freeze({ ...body, projection_record_id: contentId(RECORD_SCHEMA, body) });
}

function projectOpenWorldEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_OPEN_WORLD_ENTRY', 'Each open-world representation entry must be an object.');
  }
  const attributes = entry.attributes || {};
  if (attributes.candidate_kind !== 'ATTRIBUTE_OR_QUESTION'
    || !nonEmpty(attributes.observed_category)
    || !nonEmpty(attributes.why_unmapped)
    || !nonEmpty(entry.reason)
    || !nonEmpty(entry.raw_value)
    || !nonEmpty(entry.section_reference)
    || !Array.isArray(entry.evidence)
    || entry.evidence.length === 0) {
    fail(
      'INVALID_OPEN_WORLD_ENTRY',
      'An open-world representation attribute needs its category, exact quote, reason and evidence.',
    );
  }
  const body = {
    schema_version: OPEN_WORLD_RECORD_SCHEMA,
    authority_state: AUTHORITY_STATE,
    owner_family: 'REPRESENTATIONS',
    candidate_kind: attributes.candidate_kind,
    category: attributes.observed_category,
    quote: entry.raw_value,
    evidence: clone(entry.evidence),
    reason: entry.reason,
    why_unmapped: attributes.why_unmapped,
    nearest_concept: attributes.nearest_concept || null,
    source_section_reference: entry.section_reference,
    certification_state: 'BLOCKED_OPEN_WORLD',
    comparison_eligible: false,
  };
  return Object.freeze({
    ...body,
    projection_record_id: contentId(OPEN_WORLD_RECORD_SCHEMA, body),
  });
}

function projectRepresentationClaims({
  resolved_entries: resolvedEntries = [],
  open_world_entries: openWorldEntries = [],
  publication_filter: publicationFilter,
  release_receipt_id: releaseReceiptId,
  publication_evaluation_time: publicationEvaluationTime,
} = {}) {
  const permittedEntries = filterResolvedEntriesForPublication(resolvedEntries, publicationFilter, releaseReceiptId, publicationEvaluationTime);
  if (!Array.isArray(openWorldEntries)
    || (permittedEntries.length === 0 && openWorldEntries.length === 0)) {
    fail('INVALID_INPUT', 'At least one governed or open-world representation entry is required.');
  }
  const records = permittedEntries.map(projectEntry)
    .sort((left, right) => left.projection_record_id.localeCompare(right.projection_record_id));
  const openItems = openWorldEntries.map(projectOpenWorldEntry)
    .sort((left, right) => left.projection_record_id.localeCompare(right.projection_record_id));
  const identities = records.map((record) => canonicalJson([
    record.claim_revision_id,
    record.representation_side,
  ]));
  if (new Set(identities).size !== identities.length) {
    fail('DUPLICATE_PRODUCT_CLAIM', 'A governed claim can contribute only one side-specific product record.');
  }
  const body = {
    schema_version: PROJECTION_SCHEMA,
    authority_state: AUTHORITY_STATE,
    records,
    ...(openItems.length > 0 ? { open_items: openItems } : {}),
  };
  return Object.freeze({ ...body, projection_id: contentId(PROJECTION_SCHEMA, body) });
}

module.exports = {
  ACCURACY_CODES,
  AUTHORITY_STATE,
  GOVERNED_CLAIMS,
  KNOWLEDGE_STANDARDS,
  OPEN_WORLD_RECORD_SCHEMA,
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  RepresentationsProductProjectionError,
  projectRepresentationClaims,
};
