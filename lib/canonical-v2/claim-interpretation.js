const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');

const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const EVIDENCE_ROLES = Object.freeze([
  'OPERATIVE_TEXT',
  'DEFINITION',
  'EXCEPTION',
  'CROSS_REFERENCE',
  'DERIVATION_INPUT',
]);
const INTERPRETATION_KEYS = Object.freeze([
  'schema_version',
  'claim_occurrence_id',
  'policy_version',
  'clarity_state',
  'primary_interpretation',
  'alternative_interpretations',
  'ambiguity_dimension_codes',
  'evidence_excerpt_ids',
  'lawyer_note_digest',
  'review_provenance',
  'interpretation_payload_id',
]);
const CLAIM_REVISION_V2_KEYS = Object.freeze([
  'schema_version',
  'claim_revision_id',
  'claim_occurrence_id',
  'subject_occurrence_id',
  'claim_definition_key',
  'claim_definition_version',
  'ordinal',
  'state',
  'raw_value',
  'canonical_value',
  'unit',
  'day_basis',
  'denominator',
  'scope',
  'applicability',
  'not_examined',
  'failure',
  'evidence_ids',
  'interpretation_payload_id',
  'attributes',
  'taxonomy_codes',
  'extraction_version',
  'normalisation_version',
  'derivation_version',
  'evidence',
  'publication_state',
  'retained_residuals',
  'quarantine',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...keys].sort());
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    throw new TypeError(`${label} must be a full SHA-256 content ID`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function requireGovernedKey(value, label) {
  if (typeof value !== 'string' || !GOVERNED_KEY_RE.test(value)) {
    throw new TypeError(`${label} must be a governed uppercase key`);
  }
  return value;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function compareEvidence(left, right) {
  for (const field of ['document_ordinal', 'absolute_start', 'absolute_end']) {
    if (left[field] !== right[field]) return left[field] - right[field];
  }
  if (left.evidence_role !== right.evidence_role) {
    return left.evidence_role.localeCompare(right.evidence_role);
  }
  return left.excerpt_id.localeCompare(right.excerpt_id);
}

function normalizeEvidence(evidence, claimOccurrenceId) {
  if (!Array.isArray(evidence) || evidence.length === 0 || evidence.length > 64) {
    throw new TypeError('interpreted present claim evidence must be a bounded non-empty array');
  }
  return freeze([...evidence].map((entry) => {
    if (!EVIDENCE_ROLES.includes(entry.evidence_role)) {
      throw new TypeError('claim evidence role is outside the governed codebook');
    }
    requireDigest(entry.excerpt_id, 'evidence.excerpt_id');
    if (!Number.isSafeInteger(entry.document_ordinal)
      || entry.document_ordinal < 0
      || !Number.isSafeInteger(entry.absolute_start)
      || entry.absolute_start < 0
      || !Number.isSafeInteger(entry.absolute_end)
      || entry.absolute_end <= entry.absolute_start) {
      throw new TypeError('claim evidence requires governed half-open source coordinates');
    }
    return {
      evidence_role: entry.evidence_role,
      excerpt_id: entry.excerpt_id,
      document_ordinal: entry.document_ordinal,
      absolute_start: entry.absolute_start,
      absolute_end: entry.absolute_end,
    };
  }).sort(compareEvidence).map((entry, ordinal) => ({
    schema_version: 'CLAIM_EVIDENCE/V1',
    claim_evidence_id: contentId('CLAIM_EVIDENCE/V1', {
      occurrence_id: claimOccurrenceId,
      evidence_role: entry.evidence_role,
      excerpt_id: entry.excerpt_id,
      ordinal,
    }),
    ...entry,
    ordinal,
  })));
}

function validatePolicy(policy, spec) {
  const clarityRule = policy?.clarity_states?.find(
    (entry) => entry.clarity_state === spec.clarity_state,
  );
  const alternatives = spec.alternative_interpretations;
  const dimensions = spec.ambiguity_dimension_codes;
  const hasPrimary = spec.primary_interpretation != null;
  if (!policy
    || policy.schema_version !== spec.policy_version
    || policy.interpretation_payload_schema !== 'CLAIM_INTERPRETATION/V1'
    || policy.interpretation_payload_content_address_domain
      !== 'CLAIM_INTERPRETATION/V1'
    || policy.referenced_by_claim_revision_schema !== 'CLAIM_REVISION/V2'
    || policy.claim_revision_reference_field !== 'interpretation_payload_id'
    || clarityRule?.canonical_claim_publishable !== true
    || !Array.isArray(alternatives)
    || !Array.isArray(dimensions)
    || !dimensions.every(
      (code) => policy.ambiguity_dimension_codes.includes(code),
    )
    || alternatives.length
      > policy.maximum_alternative_interpretations
    || alternatives.length
      < clarityRule.minimum_alternative_interpretations
    || alternatives.length
      > clarityRule.maximum_alternative_interpretations
    || dimensions.length
      < clarityRule.minimum_ambiguity_dimensions
    || dimensions.length
      > clarityRule.maximum_ambiguity_dimensions
    || spec.evidence_excerpt_ids.length > policy.maximum_evidence_excerpts) {
    throw new TypeError('claim interpretation is outside the frozen policy');
  }
  if ((clarityRule.primary_interpretation_cardinality === 'EXACTLY_ONE'
      && !hasPrimary)
    || (clarityRule.primary_interpretation_cardinality === 'NONE'
      && hasPrimary)) {
    throw new TypeError('claim interpretation primary cardinality violates the frozen policy');
  }
  if (canonicalJson(policy.identity_inputs) !== canonicalJson([
    'claim_occurrence_id',
    'policy_version',
    'clarity_state',
    'primary_interpretation',
    'alternative_interpretations',
    'ambiguity_dimension_codes',
    'evidence_excerpt_ids',
    'lawyer_note_digest',
    'review_provenance',
  ])) {
    throw new TypeError('claim interpretation identity policy has drifted');
  }
}

function buildClaimInterpretation({
  claim_occurrence_id: claimOccurrenceId,
  policy,
  ...spec
} = {}) {
  requireDigest(claimOccurrenceId, 'claim_occurrence_id');
  validatePolicy(policy, spec);
  requireDigest(spec.lawyer_note_digest, 'lawyer_note_digest');
  const evidenceExcerptIds = sortedUnique(spec.evidence_excerpt_ids);
  if (evidenceExcerptIds.length !== spec.evidence_excerpt_ids.length
    || evidenceExcerptIds.some((id) => !SHA256_RE.test(id))) {
    throw new TypeError('interpretation evidence must be a sorted unique content-ID set');
  }
  if (!Array.isArray(spec.alternative_interpretations)
    || !Array.isArray(spec.ambiguity_dimension_codes)
    || new Set(spec.ambiguity_dimension_codes).size
      !== spec.ambiguity_dimension_codes.length
    || spec.primary_interpretation == null
    || spec.review_provenance == null) {
    throw new TypeError('claim interpretation inputs are incomplete');
  }
  const body = {
    claim_occurrence_id: claimOccurrenceId,
    policy_version: spec.policy_version,
    clarity_state: spec.clarity_state,
    primary_interpretation: spec.primary_interpretation,
    alternative_interpretations: spec.alternative_interpretations,
    ambiguity_dimension_codes: spec.ambiguity_dimension_codes,
    evidence_excerpt_ids: evidenceExcerptIds,
    lawyer_note_digest: spec.lawyer_note_digest,
    review_provenance: spec.review_provenance,
  };
  return freeze({
    schema_version: 'CLAIM_INTERPRETATION/V1',
    ...body,
    interpretation_payload_id: contentId('CLAIM_INTERPRETATION/V1', body),
  });
}

function validateClaimInterpretation({
  claim_interpretation: interpretation,
  policy,
} = {}) {
  if (!exactKeys(interpretation, INTERPRETATION_KEYS)
    || interpretation.schema_version !== 'CLAIM_INTERPRETATION/V1') {
    throw new TypeError('claim interpretation fields are outside the closed contract');
  }
  const {
    schema_version: schemaVersion,
    interpretation_payload_id: interpretationPayloadId,
    ...body
  } = interpretation;
  if (schemaVersion !== policy.interpretation_payload_schema
    || interpretationPayloadId !== contentId(
      policy.interpretation_payload_content_address_domain,
      body,
    )) {
    throw new TypeError('claim interpretation identity has drifted');
  }
  validatePolicy(policy, body);
  return true;
}

function buildInterpretedPresentClaimRevision({
  policy,
  interpretation,
  allowed_attributes: allowedAttributes,
  codebooks = {},
  evidence,
  ...input
} = {}) {
  requireDigest(input.subject_occurrence_id, 'subject_occurrence_id');
  requireGovernedKey(input.claim_definition_key, 'claim_definition_key');
  if (!Number.isSafeInteger(input.claim_definition_version)
    || input.claim_definition_version < 1
    || !Number.isSafeInteger(input.ordinal)
    || input.ordinal < 0) {
    throw new TypeError('claim definition version and ordinal must be governed integers');
  }
  requireText(input.extraction_version, 'extraction_version');
  requireText(input.normalisation_version, 'normalisation_version');
  requireText(input.derivation_version, 'derivation_version');
  if (!input.scope || input.scope.coverage_status !== 'COMPLETE'
    || canonicalJson(input.scope.required_interval_ids)
      !== canonicalJson(input.scope.examined_interval_ids)) {
    throw new TypeError('interpreted present claim requires a complete exact scope');
  }
  const unknownAttributes = Object.keys(input.attributes || {})
    .filter((key) => !allowedAttributes.includes(key));
  if (unknownAttributes.length > 0) {
    throw new TypeError(`unknown interpreted claim attributes: ${unknownAttributes.join(', ')}`);
  }
  for (const [dimension, code] of Object.entries(input.taxonomy_codes || {})) {
    if (!Array.isArray(codebooks[dimension])
      || !codebooks[dimension].includes(code)) {
      throw new TypeError(`invalid interpreted claim taxonomy code: ${dimension}`);
    }
  }
  const claimOccurrenceId = contentId('CLAIM_OCCURRENCE/V1', {
    subject_occurrence_id: input.subject_occurrence_id,
    claim_definition_key: input.claim_definition_key,
    claim_definition_version: input.claim_definition_version,
    ordinal: input.ordinal,
  });
  if (interpretation.claim_occurrence_id !== claimOccurrenceId) {
    throw new TypeError('claim interpretation is not bound to the reminted occurrence');
  }
  validateClaimInterpretation({
    claim_interpretation: interpretation,
    policy,
  });
  const normalizedEvidence = normalizeEvidence(evidence, claimOccurrenceId);
  const revisionPayload = {
    claim_occurrence_id: claimOccurrenceId,
    subject_occurrence_id: input.subject_occurrence_id,
    claim_definition_key: input.claim_definition_key,
    claim_definition_version: input.claim_definition_version,
    ordinal: input.ordinal,
    state: 'PRESENT',
    raw_value: input.raw_value,
    canonical_value: input.canonical_value,
    unit: input.unit,
    day_basis: input.day_basis,
    denominator: input.denominator ?? null,
    scope: input.scope,
    applicability: null,
    not_examined: null,
    failure: null,
    evidence_ids: normalizedEvidence.map((entry) => entry.claim_evidence_id),
    interpretation_payload_id: interpretation.interpretation_payload_id,
    attributes: input.attributes || {},
    taxonomy_codes: input.taxonomy_codes || {},
    extraction_version: input.extraction_version,
    normalisation_version: input.normalisation_version,
    derivation_version: input.derivation_version,
  };
  return freeze({
    schema_version: 'CLAIM_REVISION/V2',
    claim_revision_id: contentId('CLAIM_REVISION/V2', revisionPayload),
    ...revisionPayload,
    evidence: normalizedEvidence,
    publication_state: 'VALIDATED',
    retained_residuals: [],
    quarantine: null,
  });
}

function validateInterpretedPresentClaimRevision({
  claim,
  policy,
  interpretation,
  allowed_attributes: allowedAttributes,
  codebooks = {},
  expected_attributes: expectedAttributes,
} = {}) {
  if (!exactKeys(claim, CLAIM_REVISION_V2_KEYS)
    || claim.schema_version !== 'CLAIM_REVISION/V2'
    || claim.state !== 'PRESENT'
    || claim.publication_state !== 'VALIDATED'
    || claim.retained_residuals.length !== 0
    || claim.quarantine !== null
    || claim.interpretation_payload_id
      !== interpretation.interpretation_payload_id
    || interpretation.claim_occurrence_id
      !== claim.claim_occurrence_id) {
    throw new TypeError('interpreted ClaimRevision/V2 is outside the closed contract');
  }
  if (!Array.isArray(allowedAttributes)) {
    throw new TypeError('interpreted ClaimRevision/V2 validation requires an attribute contract');
  }
  const unknownAttributes = Object.keys(claim.attributes)
    .filter((key) => !allowedAttributes.includes(key));
  if (unknownAttributes.length > 0
    || (expectedAttributes != null
      && canonicalJson(claim.attributes)
        !== canonicalJson(expectedAttributes))) {
    throw new TypeError('interpreted ClaimRevision/V2 attributes violate the closed contract');
  }
  for (const [dimension, code] of Object.entries(claim.taxonomy_codes)) {
    if (!Array.isArray(codebooks[dimension])
      || !codebooks[dimension].includes(code)) {
      throw new TypeError('interpreted ClaimRevision/V2 taxonomy violates the closed codebook');
    }
  }
  validateClaimInterpretation({
    claim_interpretation: interpretation,
    policy,
  });
  const expectedOccurrenceId = contentId('CLAIM_OCCURRENCE/V1', {
    subject_occurrence_id: claim.subject_occurrence_id,
    claim_definition_key: claim.claim_definition_key,
    claim_definition_version: claim.claim_definition_version,
    ordinal: claim.ordinal,
  });
  if (claim.claim_occurrence_id !== expectedOccurrenceId) {
    throw new TypeError('interpreted claim occurrence identity has drifted');
  }
  const normalizedEvidence = normalizeEvidence(
    claim.evidence.map((entry) => ({
      evidence_role: entry.evidence_role,
      excerpt_id: entry.excerpt_id,
      document_ordinal: entry.document_ordinal,
      absolute_start: entry.absolute_start,
      absolute_end: entry.absolute_end,
    })),
    claim.claim_occurrence_id,
  );
  if (canonicalJson(normalizedEvidence) !== canonicalJson(claim.evidence)
    || canonicalJson(claim.evidence_ids)
      !== canonicalJson(normalizedEvidence.map(
        (entry) => entry.claim_evidence_id,
      ))) {
    throw new TypeError('interpreted claim evidence identity has drifted');
  }
  const revisionPayload = { ...claim };
  for (const key of [
    'schema_version',
    'claim_revision_id',
    'evidence',
    'publication_state',
    'retained_residuals',
    'quarantine',
  ]) {
    delete revisionPayload[key];
  }
  if (claim.claim_revision_id !== contentId(
    'CLAIM_REVISION/V2',
    revisionPayload,
  )) {
    throw new TypeError('interpreted claim revision identity has drifted');
  }
  return true;
}

module.exports = {
  buildClaimInterpretation,
  buildInterpretedPresentClaimRevision,
  validateClaimInterpretation,
  validateInterpretedPresentClaimRevision,
};
