const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  validateExcerpt,
  validateFixtureSourceAdmission,
  validateImmutableSource,
} = require('./source-structure');
const { validateSharedServingRow } = require('./shared-serving-row');
const { validateValidatedDefinitionGraph } = require('./definition-graph');
const { buildAdmittedSourceReference } = require('./admitted-semantic-source');

const WRITE_SET_KEYS = new Set([
  'source',
  'source_admission',
  'sources',
  'source_admissions',
  'deal',
  'excerpts',
  'provisions',
  'components',
  'claims',
  'relationships',
  'validated_semantic_graphs',
  'open_world_candidates',
  'open_world_candidate_occurrences',
  'open_world_evidence_references',
  'open_world_candidate_dispositions',
  'open_world_primitives',
  'semantic_impact_closures',
  'reviewed_source_specific_rows',
]);
const CANONICAL_COLLECTION_KEYS = ['excerpts', 'provisions', 'components', 'claims', 'relationships'];
const SEMANTIC_GRAPH_COLLECTION_KEYS = ['validated_semantic_graphs'];
const OPEN_WORLD_COLLECTION_KEYS = [
  'open_world_candidates',
  'open_world_candidate_occurrences',
  'open_world_evidence_references',
  'open_world_candidate_dispositions',
  'open_world_primitives',
  'semantic_impact_closures',
  'reviewed_source_specific_rows',
];
const COLLECTION_KEYS = [
  ...CANONICAL_COLLECTION_KEYS,
  ...SEMANTIC_GRAPH_COLLECTION_KEYS,
  ...OPEN_WORLD_COLLECTION_KEYS,
];
const ADMITTED_SOURCE_REFERENCE_KEYS = Object.freeze([
  'schema_version',
  'immutable_source_document_id',
  'source_admission_manifest_id',
  'semantic_extraction_input_envelope_id',
  'canonical_text_id',
  'governed_deal_key',
  'deal_admission_id',
  'source_ordinal',
]);
const DEAL_SCOPE_WRITE_SET_KEYS = Object.freeze([
  'source_references',
  'deal',
  ...COLLECTION_KEYS,
]);
const ID_FIELDS = Object.freeze({
  excerpts: 'excerpt_id',
  provisions: 'provision_instance_id',
  components: 'provision_component_id',
  claims: 'claim_revision_id',
  relationships: 'relationship_revision_id',
  validated_semantic_graphs: 'validated_semantic_graph_id',
  open_world_candidates: 'candidate_id',
  open_world_candidate_occurrences: 'open_world_candidate_occurrence_id',
  open_world_evidence_references: 'evidence_reference_id',
  open_world_candidate_dispositions: 'final_disposition_id',
  open_world_primitives: 'primitive_id',
  semantic_impact_closures: 'semantic_impact_closure_id',
  reviewed_source_specific_rows: 'reviewed_source_specific_row_serving_key',
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

function sourceSet(writeSet) {
  const hasSingular = writeSet.source !== undefined || writeSet.source_admission !== undefined;
  const hasPlural = writeSet.sources !== undefined || writeSet.source_admissions !== undefined;
  if (hasSingular === hasPlural) {
    throw new CanonicalValidationError(
      'writeSet must use exactly one complete singular or plural source contract.',
      { path: 'writeSet' },
    );
  }
  if (hasSingular) {
    if (!writeSet.source || !writeSet.source_admission) {
      throw new CanonicalValidationError('writeSet.source and writeSet.source_admission are both required.', {
        path: 'writeSet',
      });
    }
    return { mode: 'SINGULAR', sources: [writeSet.source], admissions: [writeSet.source_admission] };
  }
  const sources = list(writeSet.sources, 'writeSet.sources');
  const admissions = list(writeSet.source_admissions, 'writeSet.source_admissions');
  if (sources.length === 0 || admissions.length === 0 || sources.length !== admissions.length) {
    throw new CanonicalValidationError(
      'writeSet.sources and writeSet.source_admissions must be non-empty arrays of equal length.',
      { path: 'writeSet' },
    );
  }
  return { mode: 'PLURAL', sources, admissions };
}

function contractVocabulary(contractBundle) {
  validateContractBundle(contractBundle);
  return {
    concepts: new Set(contractBundle.concepts.map((entry) => entry.concept_key)),
    components: new Set(contractBundle.component_definitions.map((entry) => entry.component_key)),
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
  const admittedSources = sourceSet(writeSet);
  nonEmptyString(writeSet.deal.deal_key, 'writeSet.deal.deal_key');
  digestId(writeSet.deal.deal_admission_id, 'writeSet.deal.deal_admission_id');
  digestId(writeSet.deal.document_hash, 'writeSet.deal.document_hash');
  const sourceIds = new Set();
  const canonicalTextIds = new Set();
  const sourceOrdinals = new Set();
  const sourceById = new Map();
  for (const [index, source] of admittedSources.sources.entries()) {
    validateImmutableSource(source);
    if (sourceIds.has(source.immutable_source_document_id) || canonicalTextIds.has(source.canonical_text_id)) {
      throw new CanonicalValidationError('writeSet contains a duplicate immutable source identity.', {
        path: `writeSet.sources[${index}]`,
      });
    }
    sourceIds.add(source.immutable_source_document_id);
    canonicalTextIds.add(source.canonical_text_id);
    sourceById.set(source.immutable_source_document_id, source);
  }
  for (const [index, admission] of admittedSources.admissions.entries()) {
    const source = sourceById.get(admission?.immutable_source_document_id);
    if (!source) {
      throw new CanonicalValidationError('source admission does not name an immutable source in this write set.', {
        path: `writeSet.source_admissions[${index}]`,
      });
    }
    if (sourceOrdinals.has(admission.source_ordinal)) {
      throw new CanonicalValidationError('source admissions must have unique governed source ordinals.', {
        path: `writeSet.source_admissions[${index}].source_ordinal`,
      });
    }
    sourceOrdinals.add(admission.source_ordinal);
    validateFixtureSourceAdmission({
      source,
      admission,
      dealKey: writeSet.deal.deal_key,
      dealAdmissionId: writeSet.deal.deal_admission_id,
      contractFingerprint: contractBundle.fingerprint,
    });
  }
  if (!admittedSources.sources.some((source) => writeSet.deal.document_hash === source.document_hash)) {
    throw new CanonicalValidationError('writeSet.deal.document_hash must name an admitted immutable source.', {
      path: 'writeSet.deal.document_hash',
    });
  }
  for (const key of COLLECTION_KEYS) list(writeSet[key], `writeSet.${key}`);
  return {
    ...admittedSources,
    byCanonicalTextId: new Map(admittedSources.sources.map((source) => [source.canonical_text_id, source])),
  };
}

function assertResolvedWriteSetShape(writeSet, admittedSourceContexts) {
  if (!writeSet || typeof writeSet !== 'object' || Array.isArray(writeSet)
    || canonicalJson(Object.keys(writeSet).sort()) !== canonicalJson([...DEAL_SCOPE_WRITE_SET_KEYS].sort())) {
    throw new CanonicalValidationError('DEAL_SCOPE_RUN writeSet fields do not match the reference-only contract.', {
      path: 'writeSet',
    });
  }
  if (!Array.isArray(admittedSourceContexts)
    || admittedSourceContexts.length === 0
    || !Array.isArray(writeSet.source_references)
    || writeSet.source_references.length !== admittedSourceContexts.length) {
    throw new CanonicalValidationError(
      'DEAL_SCOPE_RUN requires one resolved admitted semantic context per source reference.',
      { path: 'writeSet.source_references' },
    );
  }
  if (!writeSet.deal || typeof writeSet.deal !== 'object' || Array.isArray(writeSet.deal)) {
    throw new CanonicalValidationError('writeSet.deal must be an object.', { path: 'writeSet.deal' });
  }
  const dealKey = nonEmptyString(writeSet.deal.deal_key, 'writeSet.deal.deal_key');
  const dealAdmissionId = digestId(
    writeSet.deal.deal_admission_id,
    'writeSet.deal.deal_admission_id',
  );
  const documentHash = digestId(writeSet.deal.document_hash, 'writeSet.deal.document_hash');
  for (const key of COLLECTION_KEYS) list(writeSet[key], `writeSet.${key}`);

  const sourceIds = new Set();
  const canonicalTextIds = new Set();
  const sourceOrdinals = new Set();
  for (const [index, reference] of writeSet.source_references.entries()) {
    const context = admittedSourceContexts[index];
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)
      || canonicalJson(Object.keys(reference).sort())
        !== canonicalJson([...ADMITTED_SOURCE_REFERENCE_KEYS].sort())
      || reference.schema_version !== 'ADMITTED_SOURCE_REFERENCE/V1') {
      throw new CanonicalValidationError('source reference fields do not match the frozen contract.', {
        path: `writeSet.source_references[${index}]`,
      });
    }
    if (!context || context.schema_version !== 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1') {
      throw new CanonicalValidationError('source reference did not resolve to a prevalidated semantic context.', {
        path: `admittedSourceContexts[${index}]`,
      });
    }
    if (canonicalJson(buildAdmittedSourceReference(context)) !== canonicalJson(reference)) {
      throw new CanonicalValidationError('prevalidated semantic context identity does not match its source reference.', {
        path: `admittedSourceContexts[${index}]`,
      });
    }
    for (const field of ADMITTED_SOURCE_REFERENCE_KEYS.slice(1)) {
      if (reference[field] !== context[field]) {
        throw new CanonicalValidationError('resolved semantic context does not match its source reference.', {
          path: `writeSet.source_references[${index}].${field}`,
        });
      }
    }
    if (reference.governed_deal_key !== dealKey
      || reference.deal_admission_id !== dealAdmissionId) {
      throw new CanonicalValidationError('source references must belong to the authoritative deal admission.', {
        path: `writeSet.source_references[${index}]`,
      });
    }
    if (!Number.isInteger(reference.source_ordinal) || reference.source_ordinal < 0
      || sourceOrdinals.has(reference.source_ordinal)) {
      throw new CanonicalValidationError('source references require unique non-negative source ordinals.', {
        path: `writeSet.source_references[${index}].source_ordinal`,
      });
    }
    for (const [value, seen, label] of [
      [reference.immutable_source_document_id, sourceIds, 'immutable source'],
      [reference.canonical_text_id, canonicalTextIds, 'canonical text'],
    ]) {
      digestId(value, `writeSet.source_references[${index}].${label}`);
      if (seen.has(value)) {
        throw new CanonicalValidationError(`writeSet contains a duplicate ${label} identity.`, {
          path: `writeSet.source_references[${index}]`,
        });
      }
      seen.add(value);
    }
    sourceOrdinals.add(reference.source_ordinal);
  }
  if (!admittedSourceContexts.some((source) => source.document_hash === documentHash)) {
    throw new CanonicalValidationError('writeSet.deal.document_hash must name an admitted immutable source.', {
      path: 'writeSet.deal.document_hash',
    });
  }
  return {
    mode: 'REFERENCES',
    sources: admittedSourceContexts,
    sourceReferences: writeSet.source_references,
    byCanonicalTextId: new Map(admittedSourceContexts.map((source) => [
      source.canonical_text_id,
      source,
    ])),
    sourceOrdinalByCanonicalTextId: new Map(admittedSourceContexts.map((source) => [
      source.canonical_text_id,
      source.source_ordinal,
    ])),
  };
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

function canonicalValueAllowed(definition, value) {
  if (Array.isArray(definition.allowed_canonical_values)) {
    return definition.allowed_canonical_values.some(
      (allowed) => canonicalJson(allowed) === canonicalJson(value),
    );
  }
  if (definition.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING') {
    return typeof value === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(value);
  }
  return false;
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
  if (kind === 'components') {
    const payload = pick(row, [
      'schema_version',
      'parent_provision_instance_id',
      'canonical_text_id',
      'absolute_start',
      'absolute_end',
      'component_key',
      'ordinal',
    ]);
    const spanPayload = {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: row.canonical_text_id,
      absolute_start: row.absolute_start,
      absolute_end: row.absolute_end,
    };
    if (row.source_anchor_id !== contentId('SEMANTIC_SPAN/V1', spanPayload)) return null;
    return contentId('PROVISION_COMPONENT/V1', payload);
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
  if (kind === 'components') {
    const componentKey = nonEmptyString(row.component_key, `component ${objectId}.component_key`);
    if (!vocabulary.components.has(componentKey)) {
      residuals.push(residualFor({
        kind, objectId, closureId, reasonCode: 'INVALID_TAXONOMY_CODE', contractKey: componentKey, row,
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
      && (row.canonical_value == null || !canonicalValueAllowed(claimDefinition, row.canonical_value))) {
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
    && (!source
      || row.source_occurrence_id !== source.source_occurrence_id
      || row.canonical_text_id !== source.canonical_text_id
      || row.document_hash !== source.document_hash)) {
    residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'CANONICAL_IDENTITY_MISMATCH', row }));
  }
  if (expectedObjectId(kind, row, source) !== objectId) {
    residuals.push(residualFor({ kind, objectId, closureId, reasonCode: 'CANONICAL_IDENTITY_MISMATCH', row }));
  }
  return residuals;
}

function semanticReferenceResiduals(indexed) {
  const residuals = [];
  const provisions = new Map(indexed
    .filter((entry) => entry.kind === 'provisions')
    .map((entry) => [entry.objectId, entry]));
  const components = new Map(indexed
    .filter((entry) => entry.kind === 'components')
    .map((entry) => [entry.objectId, entry]));
  const occurrences = new Map([...provisions, ...components]);
  const add = (entry) => residuals.push(residualFor({
    kind: entry.kind,
    objectId: entry.objectId,
    closureId: entry.closureId,
    reasonCode: 'SEMANTIC_REFERENCE_UNRESOLVED',
    row: entry.row,
  }));

  for (const entry of indexed) {
    if (entry.kind === 'components') {
      const parent = provisions.get(entry.row.parent_provision_instance_id);
      if (!parent
        || entry.row.canonical_text_id !== parent.row.canonical_text_id
        || entry.row.absolute_start < parent.row.absolute_start
        || entry.row.absolute_end > parent.row.absolute_end) add(entry);
    }
    if (entry.kind === 'claims') {
      const subject = occurrences.get(entry.row.subject_occurrence_id);
      if (!subject) add(entry);
    }
    if (entry.kind === 'relationships') {
      const source = occurrences.get(entry.row.source_occurrence_id);
      const targets = (entry.row.target_occurrence_ids || []).map((id) => occurrences.get(id));
      if (!source
        || targets.some((target) => !target)) add(entry);
    }
  }
  return residuals;
}

function evidenceResiduals(entry, excerptsById, sourceOrdinalByCanonicalTextId) {
  if (!['claims', 'relationships'].includes(entry.kind)) return [];
  const occurrenceId = entry.kind === 'claims'
    ? entry.row.claim_occurrence_id
    : entry.row.relationship_occurrence_id;
  const evidenceIdField = entry.kind === 'claims' ? 'claim_evidence_id' : 'relationship_evidence_id';
  const evidenceDomain = entry.kind === 'claims' ? 'CLAIM_EVIDENCE/V1' : 'RELATIONSHIP_EVIDENCE/V1';
  const evidence = list(entry.row.evidence, `${entry.kind} ${entry.objectId}.evidence`);
  if (entry.kind === 'claims' && entry.row.denominator != null) {
    const lineageIds = list(
      entry.row.denominator.source_lineage_ids,
      `claims ${entry.objectId}.denominator.source_lineage_ids`,
    );
    const derivationEvidenceExcerptIds = new Set(evidence
      .filter((edge) => edge.evidence_role === 'DERIVATION_INPUT')
      .map((edge) => edge.excerpt_id));
    if (lineageIds.length === 0
      || lineageIds.some((id) => !excerptsById.has(id) || !derivationEvidenceExcerptIds.has(id))) {
      return [residualFor({
        kind: entry.kind,
        objectId: entry.objectId,
        closureId: entry.closureId,
        reasonCode: 'EVIDENCE_REFERENCE_UNRESOLVED',
        row: entry.row,
      })];
    }
  }
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
      && edge.document_ordinal === sourceOrdinalByCanonicalTextId.get(excerpt.canonical_text_id)
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

function dependencyResiduals(indexed, initialResiduals) {
  const entriesById = new Map(indexed.map((entry) => [entry.objectId, entry]));
  const quarantinedClosures = new Set(initialResiduals.map((residual) => residual.closure_id));
  const residuals = [];

  function dependencies(entry) {
    if (entry.kind === 'components') {
      return [{ kind: 'SEMANTIC', entry: entriesById.get(entry.row.parent_provision_instance_id) }];
    }
    if (entry.kind === 'claims') {
      return [
        { kind: 'SEMANTIC', entry: entriesById.get(entry.row.subject_occurrence_id) },
        ...(entry.row.evidence || []).map((edge) => ({
          kind: 'EVIDENCE', entry: entriesById.get(edge.excerpt_id),
        })),
      ];
    }
    if (entry.kind === 'relationships') {
      return [
        { kind: 'SEMANTIC', entry: entriesById.get(entry.row.source_occurrence_id) },
        ...(entry.row.target_occurrence_ids || []).map((id) => ({
          kind: 'SEMANTIC', entry: entriesById.get(id),
        })),
        ...(entry.row.evidence || []).map((edge) => ({
          kind: 'EVIDENCE', entry: entriesById.get(edge.excerpt_id),
        })),
      ];
    }
    if (entry.kind === 'open_world_evidence_references') {
      return [{ kind: 'EVIDENCE', entry: entriesById.get(entry.row.excerpt_id) }];
    }
    return [];
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of indexed) {
      if (quarantinedClosures.has(entry.closureId)) continue;
      const blocked = dependencies(entry).find((dependency) => (
        dependency.entry && quarantinedClosures.has(dependency.entry.closureId)
      ));
      if (!blocked) continue;
      const residual = residualFor({
        kind: entry.kind,
        objectId: entry.objectId,
        closureId: entry.closureId,
        reasonCode: blocked.kind === 'EVIDENCE'
          ? 'EVIDENCE_REFERENCE_UNRESOLVED'
          : 'SEMANTIC_REFERENCE_UNRESOLVED',
        row: entry.row,
      });
      residuals.push(residual);
      quarantinedClosures.add(entry.closureId);
      changed = true;
    }
  }
  return residuals;
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

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new CanonicalValidationError(`${label} fields do not match the open-world write contract.`, { path: label });
  }
}

function openWorldGraphResiduals({ indexed, excerptsById, admittedSources }) {
  const openWorldEntries = indexed.filter((entry) => OPEN_WORLD_COLLECTION_KEYS.includes(entry.kind));
  if (openWorldEntries.length === 0) return [];
  const residuals = [];
  const sourceByCanonicalTextId = admittedSources.byCanonicalTextId;
  const byClosure = new Map();
  for (const entry of openWorldEntries) {
    if (!byClosure.has(entry.closureId)) byClosure.set(entry.closureId, []);
    byClosure.get(entry.closureId).push(entry);
  }

  for (const [closureId, entries] of byClosure) {
    try {
      const byKind = Object.fromEntries(OPEN_WORLD_COLLECTION_KEYS.map((kind) => [
        kind,
        entries.filter((entry) => entry.kind === kind),
      ]));
      for (const kind of [
        'open_world_candidates',
        'open_world_candidate_occurrences',
        'open_world_candidate_dispositions',
        'semantic_impact_closures',
        'reviewed_source_specific_rows',
      ]) {
        if (byKind[kind].length !== 1) throw new CanonicalValidationError(`${kind} must contain exactly one closure member.`);
      }
      if (byKind.open_world_evidence_references.length < 1 || byKind.open_world_primitives.length < 1) {
        throw new CanonicalValidationError('open-world evidence and primitive collections must be non-empty.');
      }

      const candidate = byKind.open_world_candidates[0].row;
      exactKeys(candidate, [
        'schema_version', 'candidate_id', 'candidate_kind', 'document_hash',
        'ordered_proposition_evidence_reference_ids', 'observed_party_token_digest',
        'governed_ordinal', 'neutral_proposition_digest', 'closure_id',
      ], 'open_world_candidate');
      if (candidate.schema_version !== 'NOVEL_CONCEPT_CANDIDATE/V1' || candidate.candidate_kind !== 'CONCEPT') {
        throw new CanonicalValidationError('open-world candidate kind is outside the frozen contract.');
      }
      const expectedCandidateId = contentId('NOVEL_CONCEPT_CANDIDATE/V1', {
        schema_version: candidate.schema_version,
        candidate_kind: candidate.candidate_kind,
        document_hash: candidate.document_hash,
        ordered_proposition_evidence_reference_ids: candidate.ordered_proposition_evidence_reference_ids,
        observed_party_token_digest: candidate.observed_party_token_digest,
        governed_ordinal: candidate.governed_ordinal,
        neutral_proposition_digest: candidate.neutral_proposition_digest,
      });
      if (candidate.candidate_id !== expectedCandidateId) throw new CanonicalValidationError('open-world candidate identity mismatch.');

      const occurrence = byKind.open_world_candidate_occurrences[0].row;
      exactKeys(occurrence, [
        'schema_version', 'open_world_candidate_occurrence_id', 'candidate_id', 'candidate_kind',
        'admission_state', 'document_hash', 'ordered_proposition_evidence_reference_ids',
        'observed_party_token_digest', 'governed_ordinal', 'neutral_proposition_digest', 'closure_id',
      ], 'open_world_candidate_occurrence');
      const expectedOccurrenceId = contentId('OPEN_WORLD_CANDIDATE_OCCURRENCE/V1', {
        schema_version: occurrence.schema_version,
        candidate_id: occurrence.candidate_id,
        admission_state: occurrence.admission_state,
        document_hash: occurrence.document_hash,
        ordered_proposition_evidence_reference_ids: occurrence.ordered_proposition_evidence_reference_ids,
        observed_party_token_digest: occurrence.observed_party_token_digest,
        governed_ordinal: occurrence.governed_ordinal,
        neutral_proposition_digest: occurrence.neutral_proposition_digest,
      });
      if (occurrence.candidate_id !== candidate.candidate_id
        || occurrence.candidate_kind !== candidate.candidate_kind
        || occurrence.admission_state !== 'ADMITTED_SEMANTIC'
        || occurrence.document_hash !== candidate.document_hash
        || occurrence.observed_party_token_digest !== candidate.observed_party_token_digest
        || occurrence.governed_ordinal !== candidate.governed_ordinal
        || occurrence.neutral_proposition_digest !== candidate.neutral_proposition_digest
        || canonicalJson(occurrence.ordered_proposition_evidence_reference_ids)
          !== canonicalJson(candidate.ordered_proposition_evidence_reference_ids)
        || occurrence.open_world_candidate_occurrence_id !== expectedOccurrenceId) {
        throw new CanonicalValidationError('open-world candidate occurrence identity mismatch.');
      }

      const evidenceIds = new Set();
      for (const entry of byKind.open_world_evidence_references) {
        const evidence = entry.row;
        exactKeys(evidence, [
          'evidence_reference_id', 'evidence_role', 'excerpt_id', 'semantic_span_id',
          'document_hash', 'absolute_start', 'absolute_end', 'exact_bytes_digest',
          'governed_ordinal', 'open_world_candidate_occurrence_id', 'canonical_text_id', 'closure_id',
        ], 'open_world_evidence_reference');
        const excerpt = excerptsById.get(evidence.excerpt_id);
        const source = sourceByCanonicalTextId.get(evidence.canonical_text_id);
        const evidenceBody = pick(evidence, [
          'evidence_role', 'excerpt_id', 'semantic_span_id', 'document_hash',
          'absolute_start', 'absolute_end', 'exact_bytes_digest', 'governed_ordinal',
        ]);
        if (evidence.evidence_reference_id !== contentId('OPEN_WORLD_EVIDENCE_REFERENCE/V1', evidenceBody)
          || evidence.open_world_candidate_occurrence_id !== occurrence.open_world_candidate_occurrence_id
          || !excerpt
          || !source
          || excerpt.canonical_text_id !== evidence.canonical_text_id
          || excerpt.document_hash !== evidence.document_hash
          || excerpt.absolute_start !== evidence.absolute_start
          || excerpt.absolute_end !== evidence.absolute_end
          || excerpt.exact_bytes_digest !== evidence.exact_bytes_digest
          || excerpt.ordered_component_assignments[0].semantic_span_id !== evidence.semantic_span_id
          || evidenceIds.has(evidence.evidence_reference_id)) {
          throw new CanonicalValidationError('open-world evidence reference does not resolve to admitted exact source.');
        }
        evidenceIds.add(evidence.evidence_reference_id);
      }
      if (canonicalJson(occurrence.ordered_proposition_evidence_reference_ids) !== canonicalJson(
        candidate.ordered_proposition_evidence_reference_ids,
      ) || occurrence.ordered_proposition_evidence_reference_ids.some((id) => !evidenceIds.has(id))) {
        throw new CanonicalValidationError('open-world candidate proposition evidence is incomplete.');
      }

      const disposition = byKind.open_world_candidate_dispositions[0].row;
      exactKeys(disposition, [
        'schema_version', 'open_world_candidate_occurrence_id', 'final_disposition_id',
        'disposition_code', 'review_state', 'reviewed_display_label', 'non_comparable_reason', 'closure_id',
      ], 'open_world_candidate_disposition');
      const expectedDispositionId = contentId('OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1', {
        schema_version: disposition.schema_version,
        open_world_candidate_occurrence_id: disposition.open_world_candidate_occurrence_id,
        disposition_code: disposition.disposition_code,
        review_state: disposition.review_state,
        reviewed_display_label: disposition.reviewed_display_label,
        non_comparable_reason: disposition.non_comparable_reason,
      });
      if (disposition.open_world_candidate_occurrence_id !== occurrence.open_world_candidate_occurrence_id
        || disposition.disposition_code !== 'REVIEWED_SOURCE_SPECIFIC'
        || disposition.review_state !== 'FINAL'
        || disposition.final_disposition_id !== expectedDispositionId) {
        throw new CanonicalValidationError('open-world candidate has no final publishable disposition.');
      }

      const primitiveIds = new Set();
      for (const entry of byKind.open_world_primitives) {
        const primitive = entry.row;
        exactKeys(primitive, [
          'open_world_candidate_occurrence_id', 'primitive_id', 'primitive_kind', 'governed_ordinal',
          'raw_value', 'interpreted_value', 'evidence_reference_ids', 'closure_id',
        ], 'open_world_primitive');
        const primitiveBody = pick(primitive, [
          'primitive_kind', 'governed_ordinal', 'raw_value', 'interpreted_value', 'evidence_reference_ids',
        ]);
        if (primitive.open_world_candidate_occurrence_id !== occurrence.open_world_candidate_occurrence_id
          || primitive.primitive_id !== contentId('OPEN_WORLD_LEGAL_PRIMITIVE/V1', {
            open_world_candidate_occurrence_id: occurrence.open_world_candidate_occurrence_id,
            ...primitiveBody,
          })
          || primitive.evidence_reference_ids.some((id) => !evidenceIds.has(id))
          || primitiveIds.has(primitive.primitive_id)) {
          throw new CanonicalValidationError('open-world primitive identity or evidence mismatch.');
        }
        primitiveIds.add(primitive.primitive_id);
      }

      const impact = byKind.semantic_impact_closures[0].row;
      exactKeys(impact, [
        'schema_version', 'open_world_candidate_occurrence_id', 'semantic_impact_closure_id',
        'impact_value', 'affected_canonical_result_occurrence_ids', 'market_authority', 'closure_id',
      ], 'semantic_impact_closure');
      const expectedImpactId = contentId('SEMANTIC_IMPACT_CLOSURE/V1', {
        schema_version: impact.schema_version,
        open_world_candidate_occurrence_id: impact.open_world_candidate_occurrence_id,
        impact_value: impact.impact_value,
        affected_canonical_result_occurrence_ids: impact.affected_canonical_result_occurrence_ids,
        market_authority: impact.market_authority,
      });
      if (impact.open_world_candidate_occurrence_id !== occurrence.open_world_candidate_occurrence_id
        || impact.impact_value !== 'REVIEW_ONLY_SOURCE_SPECIFIC'
        || impact.market_authority !== 'NO_MARKET_AUTHORITY'
        || impact.affected_canonical_result_occurrence_ids.length !== 0
        || impact.semantic_impact_closure_id !== expectedImpactId) {
        throw new CanonicalValidationError('open-world semantic impact closure is invalid.');
      }

      const rowRecord = byKind.reviewed_source_specific_rows[0].row;
      exactKeys(rowRecord, [
        'reviewed_source_specific_row_serving_key', 'shared_serving_row', 'closure_id',
      ], 'reviewed_source_specific_row');
      validateSharedServingRow(rowRecord.shared_serving_row);
      const servingBody = rowRecord.shared_serving_row.reviewed_source_specific;
      if (rowRecord.reviewed_source_specific_row_serving_key !== rowRecord.shared_serving_row.row_serving_key
        || servingBody.candidate_occurrence.open_world_candidate_occurrence_id !== occurrence.open_world_candidate_occurrence_id
        || servingBody.final_disposition.final_disposition_id !== disposition.final_disposition_id
        || servingBody.semantic_impact_closure.semantic_impact_closure_id !== impact.semantic_impact_closure_id
        || servingBody.primitive_collection.total !== byKind.open_world_primitives.length
        || canonicalJson(servingBody.evidence_references.map((row) => row.evidence_reference_id).sort())
          !== canonicalJson([...evidenceIds].sort())) {
        throw new CanonicalValidationError('reviewed source-specific row does not close over its open-world graph.');
      }
    } catch (error) {
      const payload = {
        closure_id: closureId,
        open_world_objects: entries.map((entry) => ({
          kind: entry.kind,
          object_id: entry.objectId,
          canonical_payload_digest: contentId('OPEN_WORLD_WRITE_OBJECT/V1', entry.row),
        })),
        validation_error: error.message,
      };
      residuals.push(residualFor({
        kind: 'open_world_semantic_closure',
        objectId: closureId,
        closureId,
        reasonCode: 'CANONICAL_IDENTITY_MISMATCH',
        row: payload,
      }));
    }
  }
  return residuals;
}

function semanticGraphResiduals({ indexed, admittedSources }) {
  const graphEntries = indexed.filter((entry) => entry.kind === 'validated_semantic_graphs');
  const residuals = [];
  const entriesByIdentity = new Map();
  for (const entry of graphEntries) {
    if (!entriesByIdentity.has(entry.objectId)) entriesByIdentity.set(entry.objectId, []);
    entriesByIdentity.get(entry.objectId).push(entry);
  }
  for (const entries of entriesByIdentity.values()) {
    if (entries.length < 2) continue;
    for (const entry of entries) {
      residuals.push(residualFor({
        kind: entry.kind,
        objectId: entry.objectId,
        closureId: entry.closureId,
        reasonCode: 'CANONICAL_IDENTITY_MISMATCH',
        row: entry.row,
      }));
    }
  }
  for (const entry of graphEntries) {
    try {
      const source = admittedSources.byCanonicalTextId.get(entry.row.canonical_text_id);
      if (!source) throw new Error('ValidatedSemanticGraph names an unadmitted canonical text');
      validateValidatedDefinitionGraph({ source, graph: entry.row });
    } catch (error) {
      residuals.push(residualFor({
        kind: entry.kind,
        objectId: entry.objectId,
        closureId: entry.closureId,
        reasonCode: 'CANONICAL_IDENTITY_MISMATCH',
        row: {
          ...entry.row,
          validation_error: error.message,
        },
      }));
    }
  }
  return residuals;
}

function validateWithAdmittedSources(writeSet, contractBundle, admittedSources) {
  const vocabulary = contractVocabulary(contractBundle);
  const indexed = [];
  const residualsById = new Map();

  for (const kind of CANONICAL_COLLECTION_KEYS) {
    for (const [index, row] of list(writeSet[kind], `writeSet.${kind}`).entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new CanonicalValidationError(`writeSet.${kind}[${index}] must be an object.`, {
          path: `writeSet.${kind}[${index}]`,
        });
      }
      const objectId = digestId(row[ID_FIELDS[kind]], `writeSet.${kind}[${index}].${ID_FIELDS[kind]}`);
      const closureId = digestId(row.closure_id, `writeSet.${kind}[${index}].closure_id`);
      const source = admittedSources.byCanonicalTextId.get(row.canonical_text_id);
      const found = [
        ...structuralResiduals(kind, row, objectId, closureId, vocabulary, source),
        ...upstreamResiduals(kind, row, objectId, closureId, vocabulary),
      ];
      indexed.push({ kind, row: canonicalise(row), objectId, closureId });
      for (const residual of found) residualsById.set(residual.residual_id, residual);
    }
  }
  for (const kind of SEMANTIC_GRAPH_COLLECTION_KEYS) {
    for (const [index, row] of list(writeSet[kind], `writeSet.${kind}`).entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new CanonicalValidationError(`writeSet.${kind}[${index}] must be an object.`, {
          path: `writeSet.${kind}[${index}]`,
        });
      }
      const objectId = digestId(row[ID_FIELDS[kind]], `writeSet.${kind}[${index}].${ID_FIELDS[kind]}`);
      const closureId = digestId(row.closure_id, `writeSet.${kind}[${index}].closure_id`);
      indexed.push({ kind, row: canonicalise(row), objectId, closureId });
    }
  }
  for (const kind of OPEN_WORLD_COLLECTION_KEYS) {
    for (const [index, row] of list(writeSet[kind], `writeSet.${kind}`).entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new CanonicalValidationError(`writeSet.${kind}[${index}] must be an object.`, {
          path: `writeSet.${kind}[${index}]`,
        });
      }
      const objectId = digestId(row[ID_FIELDS[kind]], `writeSet.${kind}[${index}].${ID_FIELDS[kind]}`);
      const closureId = digestId(row.closure_id, `writeSet.${kind}[${index}].closure_id`);
      indexed.push({ kind, row: canonicalise(row), objectId, closureId });
    }
  }

  const excerptsById = new Map(indexed
    .filter((entry) => entry.kind === 'excerpts')
    .map((entry) => [entry.objectId, entry.row]));
  const sourceOrdinalByCanonicalTextId = admittedSources.sourceOrdinalByCanonicalTextId
    || new Map(admittedSources.admissions.map((admission) => {
      const source = admittedSources.sources.find(
        (row) => row.immutable_source_document_id === admission.immutable_source_document_id,
      );
      return [source.canonical_text_id, admission.source_ordinal];
    }));
  for (const entry of indexed) {
    for (const residual of evidenceResiduals(entry, excerptsById, sourceOrdinalByCanonicalTextId)) {
      residualsById.set(residual.residual_id, residual);
    }
  }
  for (const residual of semanticReferenceResiduals(indexed)) {
    residualsById.set(residual.residual_id, residual);
  }
  for (const residual of openWorldGraphResiduals({ indexed, excerptsById, admittedSources })) {
    residualsById.set(residual.residual_id, residual);
  }
  for (const residual of semanticGraphResiduals({ indexed, admittedSources })) {
    residualsById.set(residual.residual_id, residual);
  }
  for (const residual of dependencyResiduals(indexed, [...residualsById.values()])) {
    residualsById.set(residual.residual_id, residual);
  }

  const residuals = [...residualsById.values()];
  const quarantinedClosureIds = new Set(residuals.map((residual) => residual.closure_id));
  const publishableWriteSet = {
    deal: canonicalise(writeSet.deal),
    ...Object.fromEntries(COLLECTION_KEYS.map((key) => [key, []])),
  };
  if (admittedSources.mode === 'REFERENCES') {
    publishableWriteSet.source_references = canonicalise(admittedSources.sourceReferences);
  } else if (admittedSources.mode === 'SINGULAR') {
    publishableWriteSet.source = canonicalise(admittedSources.sources[0]);
    publishableWriteSet.source_admission = canonicalise(admittedSources.admissions[0]);
  } else {
    publishableWriteSet.sources = canonicalise(admittedSources.sources);
    publishableWriteSet.source_admissions = canonicalise(admittedSources.admissions);
  }
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

function validateCanonicalWriteSet(writeSet, contractBundle) {
  validateContractBundle(contractBundle);
  return validateWithAdmittedSources(
    writeSet,
    contractBundle,
    assertWriteSetShape(writeSet, contractBundle),
  );
}

function validateResolvedCanonicalWriteSet({
  writeSet,
  contractBundle,
  admittedSourceContexts,
} = {}) {
  validateContractBundle(contractBundle);
  return validateWithAdmittedSources(
    writeSet,
    contractBundle,
    assertResolvedWriteSetShape(writeSet, admittedSourceContexts),
  );
}

module.exports = {
  CanonicalValidationError,
  canonicalise,
  validateCanonicalWriteSet,
  validateResolvedCanonicalWriteSet,
};
