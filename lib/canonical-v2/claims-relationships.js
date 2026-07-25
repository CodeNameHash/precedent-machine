const { canonicalJson, contentId } = require('./canonical-bytes');

const CLAIM_STATES = Object.freeze(['PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED']);
const RELATIONSHIP_STATES = CLAIM_STATES;
const EVIDENCE_ROLES = Object.freeze(['OPERATIVE_TEXT', 'DEFINITION', 'EXCEPTION', 'CROSS_REFERENCE', 'DERIVATION_INPUT']);
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const EVIDENCE_KEYS = Object.freeze([
  'schema_version',
  'evidence_role',
  'excerpt_id',
  'document_ordinal',
  'absolute_start',
  'absolute_end',
  'ordinal',
]);

function requireContentId(value, label) {
  if (!SHA256_RE.test(value || '')) throw new TypeError(`${label} must be a full SHA-256 content ID`);
}

function requireSafeInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${label} must be a safe integer no smaller than ${minimum}`);
  }
}

function requireGovernedKey(value, label) {
  if (typeof value !== 'string' || !GOVERNED_KEY_RE.test(value)) {
    throw new TypeError(`${label} must be a governed uppercase key`);
  }
}

function requireGovernedVersion(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function governedVersion(value, label) {
  if (value == null) return 'foundation/v1';
  return requireGovernedVersion(value, label);
}

function compareEvidence(a, b) {
  const fields = ['document_ordinal', 'absolute_start', 'absolute_end'];
  for (const field of fields) {
    if (a[field] !== b[field]) return a[field] - b[field];
  }
  if (a.evidence_role !== b.evidence_role) {
    return a.evidence_role.localeCompare(b.evidence_role);
  }
  return a.excerpt_id.localeCompare(b.excerpt_id);
}

function normalizeEvidence(evidence, occurrenceId, kind) {
  return [...(evidence || [])]
    .map((item) => {
      if (!EVIDENCE_ROLES.includes(item.evidence_role) || !item.excerpt_id) {
        throw new TypeError('evidence requires a governed role and excerpt_id');
      }
      requireContentId(item.excerpt_id, 'excerpt_id');
      if (!Number.isSafeInteger(item.document_ordinal) || item.document_ordinal < 0
        || !Number.isSafeInteger(item.absolute_start) || item.absolute_start < 0
        || !Number.isSafeInteger(item.absolute_end) || item.absolute_end <= item.absolute_start) {
        throw new TypeError('evidence requires governed document and half-open source order');
      }
      return { ...item };
    })
    .sort(compareEvidence)
    .map((item, ordinal) => {
      return Object.freeze({
        schema_version: `${kind.toUpperCase()}_EVIDENCE/V1`,
        [`${kind}_evidence_id`]: contentId(`${kind.toUpperCase()}_EVIDENCE/V1`, {
          occurrence_id: occurrenceId,
          evidence_role: item.evidence_role,
          excerpt_id: item.excerpt_id,
          ordinal,
        }),
        ...item,
        ordinal,
      });
    });
}

function residualsFor({ attributes = {}, allowedAttributes = [], taxonomyCodes = {}, codebooks = {} }) {
  const residuals = [];
  for (const [attribute, rawValue] of Object.entries(attributes)) {
    if (!allowedAttributes.includes(attribute)) {
      residuals.push({ reason: 'UNKNOWN_ATTRIBUTE', attribute, raw_value: rawValue });
    }
  }
  for (const [dimension, code] of Object.entries(taxonomyCodes)) {
    if (!Array.isArray(codebooks[dimension]) || !codebooks[dimension].includes(code)) {
      residuals.push({ reason: 'INVALID_TAXONOMY_CODE', dimension, raw_value: code });
    }
  }
  return residuals;
}

function hasAssertedValue(input) {
  return ['raw_value', 'canonical_value', 'unit', 'day_basis', 'denominator']
    .some((key) => input[key] !== undefined && input[key] !== null);
}

function completeScope(scope) {
  if (!scope || scope.coverage_status !== 'COMPLETE' || !SHA256_RE.test(scope.scope_closure_id || '')) return false;
  const required = [...(scope.required_interval_ids || [])].sort();
  const examined = [...(scope.examined_interval_ids || [])].sort();
  return required.length > 0
    && required.every((id) => SHA256_RE.test(id))
    && examined.every((id) => SHA256_RE.test(id))
    && JSON.stringify(required) === JSON.stringify(examined);
}

function hasTypedStateDetail(input, state) {
  if (state === 'NOT_APPLICABLE') {
    return typeof input.applicability?.rule === 'string'
      && input.applicability.rule.length > 0
      && Array.isArray(input.applicability.source_fact_ids)
      && input.applicability.source_fact_ids.length > 0
      && input.applicability.source_fact_ids.every((id) => SHA256_RE.test(id));
  }
  if (state === 'NOT_EXAMINED') {
    return typeof input.not_examined?.reason === 'string'
      && input.not_examined.reason.length > 0
      && input.not_examined.intended_scope != null;
  }
  if (state === 'FAILED') {
    return typeof input.failure?.failure_code === 'string'
      && input.failure.failure_code.length > 0
      && typeof input.failure.attempted_extractor === 'string'
      && input.failure.attempted_extractor.length > 0;
  }
  return true;
}

function finish(objectType, stableId, payload, residuals) {
  const retained = residuals.map((residual, ordinal) => Object.freeze({
    schema_version: 'RETAINED_RESIDUAL/V1',
    retained_residual_id: contentId('RETAINED_RESIDUAL/V1', { objectType, stableId, ordinal, residual }),
    affected_object_type: objectType,
    affected_object_id: stableId,
    ...residual,
  }));
  const quarantined = retained.length > 0;
  return Object.freeze({
    ...payload,
    publication_state: quarantined ? 'QUARANTINED' : 'VALIDATED',
    retained_residuals: Object.freeze(retained),
    quarantine: quarantined ? Object.freeze({
      affected_object_type: objectType,
      affected_object_id: stableId,
      reason_codes: Object.freeze([...new Set(retained.map((item) => item.reason))]),
    }) : null,
  });
}

function buildClaimRevision(input) {
  if (!CLAIM_STATES.includes(input.state)) throw new TypeError(`invalid claim state: ${input.state}`);
  if (!input.subject_occurrence_id || !input.claim_definition_key) {
    throw new TypeError('subject_occurrence_id and claim_definition_key are required');
  }
  requireContentId(input.subject_occurrence_id, 'subject_occurrence_id');
  requireGovernedKey(input.claim_definition_key, 'claim_definition_key');
  const claimDefinitionVersion = input.claim_definition_version ?? 1;
  const ordinal = input.ordinal ?? 0;
  const extractionVersion = governedVersion(input.extraction_version, 'extraction_version');
  const normalisationVersion = governedVersion(input.normalisation_version, 'normalisation_version');
  const derivationVersion = governedVersion(input.derivation_version, 'derivation_version');
  requireSafeInteger(claimDefinitionVersion, 'claim_definition_version', 1);
  requireSafeInteger(ordinal, 'claim ordinal');
  const claimOccurrenceId = contentId('CLAIM_OCCURRENCE/V1', {
    subject_occurrence_id: input.subject_occurrence_id,
    claim_definition_key: input.claim_definition_key,
    claim_definition_version: claimDefinitionVersion,
    ordinal,
  });
  const evidence = normalizeEvidence(input.evidence, claimOccurrenceId, 'claim');
  const residuals = residualsFor({
    attributes: input.attributes,
    allowedAttributes: input.allowed_attributes,
    taxonomyCodes: input.taxonomy_codes,
    codebooks: input.codebooks,
  });
  if (input.state === 'PRESENT' && evidence.length === 0) residuals.push({ reason: 'PRESENT_WITHOUT_EVIDENCE' });
  if (input.state === 'ABSENT' && !completeScope(input.scope)) residuals.push({ reason: 'ABSENT_WITHOUT_COMPLETE_SCOPE' });
  if (input.state !== 'PRESENT' && hasAssertedValue(input)) residuals.push({ reason: 'NON_PRESENT_ASSERTED_VALUE' });
  if (!hasTypedStateDetail(input, input.state)) residuals.push({ reason: 'STATE_DETAIL_REQUIRED' });
  const revisionPayload = {
    claim_occurrence_id: claimOccurrenceId,
    subject_occurrence_id: input.subject_occurrence_id,
    claim_definition_key: input.claim_definition_key,
    claim_definition_version: claimDefinitionVersion,
    ordinal,
    state: input.state,
    raw_value: input.state === 'PRESENT' ? input.raw_value ?? null : null,
    canonical_value: input.state === 'PRESENT' ? input.canonical_value ?? null : null,
    unit: input.state === 'PRESENT' ? input.unit ?? null : null,
    day_basis: input.state === 'PRESENT' ? input.day_basis ?? null : null,
    denominator: input.state === 'PRESENT' ? input.denominator ?? null : null,
    scope: input.scope || null,
    applicability: input.applicability || null,
    not_examined: input.not_examined || null,
    failure: input.failure || null,
    evidence_ids: evidence.map((item) => item.claim_evidence_id),
    attributes: input.attributes || {},
    taxonomy_codes: input.taxonomy_codes || {},
    extraction_version: extractionVersion,
    normalisation_version: normalisationVersion,
    derivation_version: derivationVersion,
  };
  const claimRevisionId = contentId('CLAIM_REVISION/V1', revisionPayload);
  return finish('ClaimRevision', claimRevisionId, {
    schema_version: 'CLAIM_REVISION/V1',
    claim_revision_id: claimRevisionId,
    ...revisionPayload,
    evidence,
  }, residuals);
}

function buildRelationshipRevision(input) {
  if (!RELATIONSHIP_STATES.includes(input.state)) throw new TypeError(`invalid relationship state: ${input.state}`);
  if (!input.source_occurrence_id || !input.relationship_definition_key) {
    throw new TypeError('source_occurrence_id and relationship_definition_key are required');
  }
  requireContentId(input.source_occurrence_id, 'source_occurrence_id');
  for (const targetId of input.target_occurrence_ids || []) requireContentId(targetId, 'target_occurrence_id');
  const relationshipOccurrenceId = contentId('RELATIONSHIP_OCCURRENCE/V1', {
    source_occurrence_id: input.source_occurrence_id,
    relationship_definition_key: input.relationship_definition_key,
    relationship_definition_version: input.relationship_definition_version || 1,
    ordinal: input.ordinal || 0,
  });
  const evidence = normalizeEvidence(input.evidence, relationshipOccurrenceId, 'relationship');
  const residuals = residualsFor({
    attributes: input.attributes,
    allowedAttributes: input.allowed_attributes,
    taxonomyCodes: input.taxonomy_codes,
    codebooks: input.codebooks,
  });
  if (input.state === 'PRESENT' && evidence.length === 0) residuals.push({ reason: 'PRESENT_WITHOUT_EVIDENCE' });
  if (input.state === 'PRESENT' && !(input.target_occurrence_ids || []).length) residuals.push({ reason: 'PRESENT_WITHOUT_RESOLVED_TARGET' });
  if (input.state === 'PRESENT' && input.effect == null) residuals.push({ reason: 'PRESENT_WITHOUT_EFFECT' });
  if (input.state === 'ABSENT' && !completeScope(input.scope)) residuals.push({ reason: 'ABSENT_WITHOUT_COMPLETE_SCOPE' });
  if (input.state !== 'PRESENT' && ((input.target_occurrence_ids || []).length || input.effect != null)) {
    residuals.push({ reason: 'NON_PRESENT_ASSERTED_VALUE' });
  }
  if (!hasTypedStateDetail(input, input.state)) residuals.push({ reason: 'STATE_DETAIL_REQUIRED' });
  const revisionPayload = {
    relationship_occurrence_id: relationshipOccurrenceId,
    source_occurrence_id: input.source_occurrence_id,
    relationship_definition_key: input.relationship_definition_key,
    relationship_definition_version: input.relationship_definition_version || 1,
    ordinal: input.ordinal || 0,
    state: input.state,
    raw_scope: input.raw_scope || null,
    scope: input.scope || null,
    applicability: input.applicability || null,
    not_examined: input.not_examined || null,
    failure: input.failure || null,
    target_occurrence_ids: [...(input.target_occurrence_ids || [])],
    effect: input.effect || null,
    evidence_ids: evidence.map((item) => item.relationship_evidence_id),
    attributes: input.attributes || {},
    taxonomy_codes: input.taxonomy_codes || {},
    resolver_version: input.resolver_version || 'foundation/v1',
  };
  const relationshipRevisionId = contentId('RELATIONSHIP_REVISION/V1', revisionPayload);
  return finish('RelationshipRevision', relationshipRevisionId, {
    schema_version: 'RELATIONSHIP_REVISION/V1',
    relationship_revision_id: relationshipRevisionId,
    ...revisionPayload,
    evidence,
  }, residuals);
}

function validateEvidenceIdentity(row, kind) {
  const occurrenceId = kind === 'claim' ? row.claim_occurrence_id : row.relationship_occurrence_id;
  const edgeIdField = `${kind}_evidence_id`;
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const canonicalOrder = [...evidence].sort(compareEvidence);
  if (canonicalOrder.some((edge, index) => edge !== evidence[index])) {
    throw new TypeError(`${kind} evidence is not in canonical source order`);
  }
  const expectedIds = evidence.map((edge, ordinal) => {
    requireContentId(edge.excerpt_id, 'excerpt_id');
    const expectedKeys = [...EVIDENCE_KEYS, edgeIdField].sort();
    if (edge.ordinal !== ordinal
      || edge.schema_version !== `${kind.toUpperCase()}_EVIDENCE/V1`
      || !EVIDENCE_ROLES.includes(edge.evidence_role)
      || canonicalJson(Object.keys(edge).sort()) !== canonicalJson(expectedKeys)
      || !Number.isSafeInteger(edge.document_ordinal)
      || !Number.isSafeInteger(edge.absolute_start)
      || !Number.isSafeInteger(edge.absolute_end)
      || edge.absolute_start < 0
      || edge.absolute_end <= edge.absolute_start) {
      throw new TypeError(`${kind} evidence is not in canonical source order`);
    }
    const expected = contentId(`${kind.toUpperCase()}_EVIDENCE/V1`, {
      occurrence_id: occurrenceId,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      ordinal,
    });
    if (edge[edgeIdField] !== expected) throw new TypeError(`${kind} evidence identity mismatch`);
    return expected;
  });
  if (canonicalJson(row.evidence_ids || []) !== canonicalJson(expectedIds)) {
    throw new TypeError(`${kind} evidence set mismatch`);
  }
}

function validateClaimRevisionIdentity(row) {
  if (!row || row.schema_version !== 'CLAIM_REVISION/V1' || !CLAIM_STATES.includes(row.state)) {
    throw new TypeError('invalid ClaimRevision');
  }
  requireContentId(row.subject_occurrence_id, 'subject_occurrence_id');
  requireGovernedKey(row.claim_definition_key, 'claim_definition_key');
  requireSafeInteger(row.claim_definition_version, 'claim_definition_version', 1);
  requireSafeInteger(row.ordinal, 'claim ordinal');
  requireGovernedVersion(row.extraction_version, 'extraction_version');
  requireGovernedVersion(row.normalisation_version, 'normalisation_version');
  requireGovernedVersion(row.derivation_version, 'derivation_version');
  const expectedOccurrenceId = contentId('CLAIM_OCCURRENCE/V1', {
    subject_occurrence_id: row.subject_occurrence_id,
    claim_definition_key: row.claim_definition_key,
    claim_definition_version: row.claim_definition_version,
    ordinal: row.ordinal,
  });
  if (row.claim_occurrence_id !== expectedOccurrenceId) throw new TypeError('claim occurrence identity mismatch');
  validateEvidenceIdentity(row, 'claim');
  const revisionPayload = {
    claim_occurrence_id: row.claim_occurrence_id,
    subject_occurrence_id: row.subject_occurrence_id,
    claim_definition_key: row.claim_definition_key,
    claim_definition_version: row.claim_definition_version,
    ordinal: row.ordinal,
    state: row.state,
    raw_value: row.raw_value,
    canonical_value: row.canonical_value,
    unit: row.unit,
    day_basis: row.day_basis,
    denominator: row.denominator,
    scope: row.scope,
    applicability: row.applicability,
    not_examined: row.not_examined,
    failure: row.failure,
    evidence_ids: row.evidence_ids,
    attributes: row.attributes,
    taxonomy_codes: row.taxonomy_codes,
    extraction_version: row.extraction_version,
    normalisation_version: row.normalisation_version,
    derivation_version: row.derivation_version,
  };
  if (row.claim_revision_id !== contentId('CLAIM_REVISION/V1', revisionPayload)) {
    throw new TypeError('claim revision identity mismatch');
  }
  if (row.publication_state !== 'VALIDATED' || (row.retained_residuals || []).length || row.quarantine != null) {
    throw new TypeError('claim revision is not validated for publication');
  }
  if (row.state === 'PRESENT' && row.evidence.length === 0) throw new TypeError('present claim requires evidence');
  if (row.state === 'ABSENT' && !completeScope(row.scope)) throw new TypeError('absent claim requires complete scope');
  if (row.state !== 'PRESENT' && hasAssertedValue(row)) throw new TypeError('non-present claim asserts a value');
  if (!hasTypedStateDetail(row, row.state)) throw new TypeError('claim state detail is incomplete');
  return true;
}

function validateRelationshipRevisionIdentity(row) {
  if (!row || row.schema_version !== 'RELATIONSHIP_REVISION/V1' || !RELATIONSHIP_STATES.includes(row.state)) {
    throw new TypeError('invalid RelationshipRevision');
  }
  requireContentId(row.source_occurrence_id, 'source_occurrence_id');
  for (const targetId of row.target_occurrence_ids || []) requireContentId(targetId, 'target_occurrence_id');
  const expectedOccurrenceId = contentId('RELATIONSHIP_OCCURRENCE/V1', {
    source_occurrence_id: row.source_occurrence_id,
    relationship_definition_key: row.relationship_definition_key,
    relationship_definition_version: row.relationship_definition_version,
    ordinal: row.ordinal,
  });
  if (row.relationship_occurrence_id !== expectedOccurrenceId) throw new TypeError('relationship occurrence identity mismatch');
  validateEvidenceIdentity(row, 'relationship');
  const revisionPayload = {
    relationship_occurrence_id: row.relationship_occurrence_id,
    source_occurrence_id: row.source_occurrence_id,
    relationship_definition_key: row.relationship_definition_key,
    relationship_definition_version: row.relationship_definition_version,
    ordinal: row.ordinal,
    state: row.state,
    raw_scope: row.raw_scope,
    scope: row.scope,
    applicability: row.applicability,
    not_examined: row.not_examined,
    failure: row.failure,
    target_occurrence_ids: row.target_occurrence_ids,
    effect: row.effect,
    evidence_ids: row.evidence_ids,
    attributes: row.attributes,
    taxonomy_codes: row.taxonomy_codes,
    resolver_version: row.resolver_version,
  };
  if (row.relationship_revision_id !== contentId('RELATIONSHIP_REVISION/V1', revisionPayload)) {
    throw new TypeError('relationship revision identity mismatch');
  }
  if (row.publication_state !== 'VALIDATED' || (row.retained_residuals || []).length || row.quarantine != null) {
    throw new TypeError('relationship revision is not validated for publication');
  }
  if (row.state === 'PRESENT' && (!row.evidence.length || !(row.target_occurrence_ids || []).length || row.effect == null)) {
    throw new TypeError('present relationship is incomplete');
  }
  if (row.state === 'ABSENT' && !completeScope(row.scope)) throw new TypeError('absent relationship requires complete scope');
  if (row.state !== 'PRESENT' && ((row.target_occurrence_ids || []).length || row.effect != null)) {
    throw new TypeError('non-present relationship asserts an effect');
  }
  if (!hasTypedStateDetail(row, row.state)) throw new TypeError('relationship state detail is incomplete');
  return true;
}

module.exports = {
  CLAIM_STATES,
  RELATIONSHIP_STATES,
  EVIDENCE_ROLES,
  buildClaimRevision,
  buildRelationshipRevision,
  validateClaimRevisionIdentity,
  validateRelationshipRevisionIdentity,
};
