const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  validateExcerpt,
  validateFixtureSourceAdmission,
  validateImmutableSource,
} = require('./source-structure');

const WRITE_SET_KEYS = new Set([
  'source',
  'source_admission',
  'deal',
  'excerpts',
  'provisions',
  'claims',
  'relationships',
]);
const COLLECTION_KEYS = ['excerpts', 'provisions', 'claims', 'relationships'];
const ID_FIELDS = Object.freeze({
  excerpts: 'excerpt_id',
  provisions: 'provision_instance_id',
  claims: 'claim_revision_id',
  relationships: 'relationship_revision_id',
});
const SHA256_RE = /^[a-f0-9]{64}$/;

class CanonicalValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CanonicalValidationError';
    this.code = 'CANONICAL_VALIDATION_ERROR';
    this.details = details;
  }
}

function canonicalise(value) {
  return JSON.parse(canonicalJson(value));
}

function nonEmptyString(value, path) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CanonicalValidationError(`${path} must be a non-empty string.`, { path });
  }
  return value.trim();
}

function digestId(value, path) {
  const id = nonEmptyString(value, path);
  if (!SHA256_RE.test(id)) {
    throw new CanonicalValidationError(`${path} must be a full SHA-256 content ID.`, { path });
  }
  return id;
}

function list(value, path) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new CanonicalValidationError(`${path} must be an array.`, { path });
  return value;
}

function contractVocabulary(contractBundle) {
  validateContractBundle(contractBundle);
  return {
    concepts: new Set(contractBundle.concepts.map((entry) => entry.concept_key)),
    claims: new Map(contractBundle.claim_definitions.map((entry) => [entry.claim_definition_key, entry])),
    relationships: new Map(contractBundle.relationship_definitions.map((entry) => [entry.relationship_key, entry])),
    states: new Set(contractBundle.claim_states),
    residualReasons: new Set(contractBundle.residual_reason_codes),
  };
}

function assertWriteSetShape(writeSet, contractBundle) {
  if (!writeSet || typeof writeSet !== 'object' || Array.isArray(writeSet)) {
    throw new CanonicalValidationError('writeSet must be an object.', { path: 'writeSet' });
  }
  const unknownKeys = Object.keys(writeSet).filter((key) => !WRITE_SET_KEYS.has(key));
  if (unknownKeys.length) {
    throw new CanonicalValidationError('writeSet contains keys outside the fixed contract.', {
      path: 'writeSet',
      unknownKeys: unknownKeys.sort(),
    });
  }
  if (!writeSet.deal || typeof writeSet.deal !== 'object' || Array.isArray(writeSet.deal)) {
    throw new CanonicalValidationError('writeSet.deal must be an object.', { path: 'writeSet.deal' });
  }
  validateImmutableSource(writeSet.source);
  nonEmptyString(writeSet.deal.deal_key, 'writeSet.deal.deal_key');
  digestId(writeSet.deal.deal_admission_id, 'writeSet.deal.deal_admission_id');
  digestId(writeSet.deal.document_hash, 'writeSet.deal.document_hash');
  validateFixtureSourceAdmission({
    source: writeSet.source,
    admission: writeSet.source_admission,
    dealKey: writeSet.deal.deal_key,
    dealAdmissionId: writeSet.deal.deal_admission_id,
    contractFingerprint: contractBundle.fingerprint,
  });
  if (writeSet.deal.document_hash !== writeSet.source.document_hash) {
    throw new CanonicalValidationError('writeSet.deal.document_hash must name the admitted immutable source.', {
      path: 'writeSet.deal.document_hash',
    });
  }
  for (const key of COLLECTION_KEYS) list(writeSet[key], `writeSet.${key}`);
}

function completeScope(scope) {
  if (!scope || scope.coverage_status !== 'COMPLETE' || !SHA256_RE.test(scope.scope_closure_id || '')) return false;
  const required = [...(scope.required_interval_ids || [])].sort();
  const examined = [...(scope.examined_interval_ids || [])].sort();
  return required.length > 0
    && required.every((id) => SHA256_RE.test(id))
    && examined.every((id) => SHA256_RE.test(id))
    && canonicalJson(required) === canonicalJson(examined);
}

function hasAssertedValue(row) {
  return ['raw_value', 'canonical_value', 'unit', 'day_basis', 'denominator']
    .some((key) => row[key] !== undefined && row[key] !== null);
}

function hasTypedStateDetail(row, state) {
  if (state === 'NOT_APPLICABLE') {
    return typeof row.applicability?.rule === 'string'
      && row.applicability.rule.length > 0
      && Array.isArray(row.applicability.source_fact_ids)
      && row.applicability.source_fact_ids.length > 0
      && row.applicability.source_fact_ids.every((id) => SHA256_RE.test(id));
  }
  if (state === 'NOT_EXAMINED') {
    return typeof row.not_examined?.reason === 'string'
      && row.not_examined.reason.length > 0
      && row.not_examined.intended_scope != null;
  }
  if (state === 'FAILED') {
    return typeof row.failure?.failure_code === 'string'
      && row.failure.failure_code.length > 0
      && typeof row.failure.attempted_extractor === 'string'
      && row.failure.attempted_extractor.length > 0;
  }
  return true;
}

function pick(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, row[field]]));
}

function expectedObjectId(kind, row, source) {
  if (kind === 'excerpts') {
    try {
      validateExcerpt({ source, excerpt: row });
      return row.excerpt_id;
    } catch {
      return null;
    }
  }
  if (kind === 'provisions') {
    const payload = pick(row, [
      'schema_version',
      'source_occurrence_id',
      'canonical_text_id',
      'document_hash',
      'absolute_start',
      'absolute_end',
      'concept_key',
      'party',
      'ordinal',
    ]);
    const spanPayload = {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: row.canonical_text_id,
      absolute_start: row.absolute_start,
      absolute_end: row.absolute_end,
    };
    if (row.source_anchor_id !== contentId('SEMANTIC_SPAN/V1', spanPayload)) return null;
    return contentId('PROVISION_INSTANCE/V1', payload);
  }
  if (kind === 'claims') {
    const expectedOccurrenceId = contentId('CLAIM_OCCURRENCE/V1', {
      subject_occurrence_id: row.subject_occurrence_id,
      claim_definition_key: row.claim_definition_key,
      claim_definition_version: row.claim_definition_version,
      ordinal: row.ordinal,
    });
    if (row.claim_occurrence_id !== expectedOccurrenceId) return null;
    const payload = pick(row, [
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
      'attributes',
      'taxonomy_codes',
      'extraction_version',
      'normalisation_version',
      'derivation_version',
    ]);
    return contentId('CLAIM_REVISION/V1', payload);
  }
  const expectedOccurrenceId = contentId('RELATIONSHIP_OCCURRENCE/V1', {
    source_occurrence_id: row.source_occurrence_id,
    relationship_definition_key: row.relationship_definition_key,
    relationship_definition_version: row.relationship_definition_version,
    ordinal: row.ordinal,
  });
  if (row.relationship_occurrence_id !== expectedOccurrenceId) return null;
  const payload = pick(row, [
    'relationship_occurrence_id',
    'source_occurrence_id',
    'relationship_definition_key',
    'relationship_definition_version',
    'ordinal',
    'state',
    'raw_scope',
    'scope',
    'applicability',
    'not_examined',
    'failure',
    'target_occurrence_ids',
    'effect',
    'evidence_ids',
    'attributes',
    'taxonomy_codes',
    'resolver_version',
  ]);
  return contentId('RELATIONSHIP_REVISION/V1', payload);
}

function residualFor({ kind, objectId, closureId, reasonCode, contractKey = null, row, upstream = null }) {
  const payload = {
    source_kind: kind,
    source_object_id: objectId,
    closure_id: closureId,
    reason_code: reasonCode,
    contract_key: contractKey,
    upstream_residual: upstream,
    source_object: canonicalise(row),
  };
  return {
    residual_id: contentId('CANONICAL_RESIDUAL/V1', payload),
    ...payload,
  };
}

function structuralResiduals(kind, row, objectId, closureId, vocabulary, source) {
  const residuals = [];
  if (kind === 'provisions') {
    const conceptKey = nonEmptyString(row.concept_key, `provision ${objectId}.concept_key`);
    if (!vocabulary.concepts.has(conceptKey)) {
      residuals.push(residualFor({
        kind, objectId, closureId, reasonCode: 'INVALID_TAXONOMY_CODE', contractKey: conceptKey, row,
      }));
    }
  }
  if (kind === 'claims') {
    const claimKey = nonEmptyString(row.claim_definition_key, `claim ${objectId}.claim_definition_key`);
    const state = nonEmptyString(row.state, `claim ${objectId}.state`);
    if (!vocabulary.states.has(state)) {
      throw new CanonicalValidationError(`claim ${objectId}.state is outside the frozen contract.`, { objectId, state });
    }
    const claimDefinition = vocabulary.claims.get(claimKey);
    if (!claimDefinition) {
      residuals.push(residualFor({
        kind, objectId, closureId, reasonCode: 'UNKNOWN_ATTRIBUTE', contractKey: claimKey, row,
      }));
    }
    if (state === 'PRESENT' && claimDefinition
      && (row.canonical_value == null
        || !claimDefinition.allowed_canonical_values.some(
          (value) => canonicalJson(value) === canonicalJson(row.canonical_value),
        ))) {
      residuals.push(residualFor({
        kind, objectId, closureId, reasonCode: 'INVALID_CANONICAL_VALUE', contractKey: claimKey, row,
      }));
    }
    if (state === 'PRESENT' && list(row.evidence, `claim ${objectId}.evidence`).length === 0) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'PRESENT_WITHOUT_EVIDENCE', row }));
    }
    if (state === 'ABSENT' && !completeScope(row.scope)) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'ABSENT_WITHOUT_COMPLETE_SCOPE', row }));
    }
    if (state !== 'PRESENT' && hasAssertedValue(row)) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'NON_PRESENT_ASSERTED_VALUE', row }));
    }
    if (!hasTypedStateDetail(row, state)) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'STATE_DETAIL_REQUIRED', row }));
    }
  }
  if (kind === 'relationships') {
    const relationshipKey = nonEmptyString(
      row.relationship_definition_key,
      `relationship ${objectId}.relationship_definition_key`,
    );
    const relationshipDefinition = vocabulary.relationships.get(relationshipKey);
    if (!relationshipDefinition) {
      residuals.push(residualFor({
        kind, objectId, closureId, reasonCode: 'INVALID_TAXONOMY_CODE', contractKey: relationshipKey, row,
      }));
    }
    const state = nonEmptyString(row.state, `relationship ${objectId}.state`);
    if (!vocabulary.states.has(state)) {
      throw new CanonicalValidationError(`relationship ${objectId}.state is outside the frozen contract.`, {
        objectId,
        state,
      });
    }
    if (state === 'PRESENT' && list(row.evidence, `relationship ${objectId}.evidence`).length === 0) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'PRESENT_WITHOUT_EVIDENCE', row }));
    }
    if (state === 'PRESENT' && list(
      row.target_occurrence_ids,
      `relationship ${objectId}.target_occurrence_ids`,
    ).length === 0) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'PRESENT_WITHOUT_RESOLVED_TARGET', row }));
    }
    if (state === 'PRESENT' && row.effect == null) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'PRESENT_WITHOUT_EFFECT', row }));
    }
    if (state === 'ABSENT' && !completeScope(row.scope)) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'ABSENT_WITHOUT_COMPLETE_SCOPE', row }));
    }
    if (state !== 'PRESENT' && ((row.target_occurrence_ids || []).length || row.effect != null)) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'NON_PRESENT_ASSERTED_VALUE', row }));
    }
    if (!hasTypedStateDetail(row, state)) {
      residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'STATE_DETAIL_REQUIRED', row }));
    }
  }
  if (kind === 'provisions'
    && (row.source_occurrence_id !== source.source_occurrence_id
      || row.canonical_text_id !== source.canonical_text_id
      || row.document_hash !== source.document_hash)) {
    residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'CANONICAL_IDENTITY_MISMATCH', row }));
  }
  if (expectedObjectId(kind, row, source) !== objectId) {
    residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'CANONICAL_IDENTITY_MISMATCH', row }));
  }
  return residuals;
}

function evidenceResiduals(entry, excerptsById) {
  if (!['claims', 'relationships'].includes(entry.kind)) return [];
  const occurrenceId = entry.kind === 'claims'
    ? entry.row.claim_occurrence_id
    : entry.row.relationship_occurrence_id;
  const evidenceIdField = entry.kind === 'claims' ? 'claim_evidence_id' : 'relationship_evidence_id';
  const evidenceDomain = entry.kind === 'claims' ? 'CLAIM_EVIDENCE/V1' : 'RELATIONSHIP_EVIDENCE/V1';
  const evidence = list(entry.row.evidence, `${entry.kind} ${entry.objectId}.evidence`);
  const validIds = [];
  for (const [ordinal, edge] of evidence.entries()) {
    const excerpt = excerptsById.get(edge.excerpt_id);
    const expectedEdgeId = contentId(evidenceDomain, {
      occurrence_id: occurrenceId,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      ordinal,
    });
    const valid = excerpt
      && excerpt.closure_id === entry.closureId
      && edge[evidenceIdField] === expectedEdgeId
      && edge.ordinal === ordinal
      && edge.absolute_start === excerpt.absolute_start
      && edge.absolute_end === excerpt.absolute_end;
    if (!valid) {
      return [residualFor({
        kind: entry.kind,
        objectId: entry.objectId,
        closureId: entry.closureId,
        reasonCode: 'EVIDENCE_REFERENCE_UNRESOLVED',
        row: entry.row,
      })];
    }
    validIds.push(expectedEdgeId);
  }
  if (canonicalJson(validIds) !== canonicalJson(entry.row.evidence_ids || [])) {
    return [residualFor({
      kind: entry.kind,
      objectId: entry.objectId,
      closureId: entry.closureId,
      reasonCode: 'EVIDENCE_REFERENCE_UNRESOLVED',
      row: entry.row,
    })];
  }
  return [];
}

function upstreamResiduals(kind, row, objectId, closureId, vocabulary) {
  const retained = list(row.retained_residuals, `${kind} ${objectId}.retained_residuals`);
  if (row.publication_state === 'QUARANTINED' && retained.length === 0) {
    throw new CanonicalValidationError(`${kind} ${objectId} is quarantined without retained residuals.`, { objectId });
  }
  return retained.map((upstream) => {
    const reasonCode = nonEmptyString(upstream.reason, `${kind} ${objectId}.retained_residual.reason`);
    if (!vocabulary.residualReasons.has(reasonCode)) {
      throw new CanonicalValidationError(`retained residual reason ${reasonCode} is outside the frozen contract.`, {
        objectId,
        reasonCode,
      });
    }
    return residualFor({
      kind,
      objectId,
      closureId,
      reasonCode,
      contractKey: upstream.attribute || upstream.dimension || null,
      row,
      upstream,
    });
  });
}

function validateCanonicalWriteSet(writeSet, contractBundle) {
  validateContractBundle(contractBundle);
  assertWriteSetShape(writeSet, contractBundle);
  const vocabulary = contractVocabulary(contractBundle);
  const indexed = [];
  const residualsById = new Map();

  for (const kind of COLLECTION_KEYS) {
    for (const [index, row] of list(writeSet[kind], `writeSet.${kind}`).entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new CanonicalValidationError(`writeSet.${kind}[${index}] must be an object.`, {
          path: `writeSet.${kind}[${index}]`,
        });
      }
      const objectId = digestId(row[ID_FIELDS[kind]], `writeSet.${kind}[${index}].${ID_FIELDS[kind]}`);
      const closureId = digestId(row.closure_id, `writeSet.${kind}[${index}].closure_id`);
      const found = [
        ...structuralResiduals(kind, row, objectId, closureId, vocabulary, writeSet.source),
        ...upstreamResiduals(kind, row, objectId, closureId, vocabulary),
      ];
      indexed.push({ kind, row: canonicalise(row), objectId, closureId });
      for (const residual of found) residualsById.set(residual.residual_id, residual);
    }
  }

  const excerptsById = new Map(indexed
    .filter((entry) => entry.kind === 'excerpts')
    .map((entry) => [entry.objectId, entry.row]));
  for (const entry of indexed) {
    for (const residual of evidenceResiduals(entry, excerptsById)) {
      residualsById.set(residual.residual_id, residual);
    }
  }

  const residuals = [...residualsById.values()];
  const quarantinedClosureIds = new Set(residuals.map((residual) => residual.closure_id));
  const publishableWriteSet = {
    source: canonicalise(writeSet.source),
    source_admission: canonicalise(writeSet.source_admission),
    deal: canonicalise(writeSet.deal),
    excerpts: [],
    provisions: [],
    claims: [],
    relationships: [],
  };
  for (const entry of indexed) {
    if (!quarantinedClosureIds.has(entry.closureId)) publishableWriteSet[entry.kind].push(entry.row);
  }

  const quarantines = [...quarantinedClosureIds].sort().map((closureId) => {
    const affectedObjects = indexed
      .filter((entry) => entry.closureId === closureId)
      .map((entry) => ({ kind: entry.kind, object_id: entry.objectId, source_object: entry.row }));
    const closureResiduals = residuals.filter((residual) => residual.closure_id === closureId);
    const payload = {
      closure_id: closureId,
      affected_objects: affectedObjects,
      residual_ids: closureResiduals.map((entry) => entry.residual_id).sort(),
    };
    return {
      quarantine_id: contentId('CANONICAL_QUARANTINE/V1', payload),
      reason_code: 'UNRESOLVED_RESIDUAL',
      ...payload,
    };
  });

  return {
    accepted: true,
    publishableWriteSet,
    residuals,
    quarantines,
    quarantinedClosureIds: [...quarantinedClosureIds].sort(),
    counts: {
      publishable: COLLECTION_KEYS.reduce((total, key) => total + publishableWriteSet[key].length, 0),
      residuals: residuals.length,
      quarantinedClosures: quarantines.length,
    },
  };
}

module.exports = {
  CanonicalValidationError,
  canonicalise,
  validateCanonicalWriteSet,
};
