const { canonicalJson } = require('./canonical-bytes');

const PERSISTED_CANONICAL_OBJECT_ID_FIELDS = Object.freeze({
  excerpts: 'excerpt_id',
  validated_semantic_graphs: 'validated_semantic_graph_id',
  definition_occurrences: 'definition_occurrence_id',
  provisions: 'provision_instance_id',
  components: 'provision_component_id',
  condition_groups: 'condition_group_revision_id',
  claims: 'claim_revision_id',
  relationships: 'relationship_revision_id',
  open_world_candidates: 'candidate_id',
  open_world_candidate_occurrences: 'open_world_candidate_occurrence_id',
  open_world_evidence_references: 'evidence_reference_id',
  open_world_candidate_dispositions: 'final_disposition_id',
  open_world_primitives: 'primitive_id',
  semantic_impact_closures: 'semantic_impact_closure_id',
  reviewed_source_specific_rows:
    'reviewed_source_specific_row_serving_key',
  incomplete_canonical_result_rows:
    'incomplete_result_review_row_serving_key',
});

function withoutClosure(value) {
  const { closure_id: ignored, ...semanticValue } = value;
  return semanticValue;
}

function buildPersistedCanonicalObjectRequests(writeSet) {
  const requests = [];
  for (const [objectKind, identityField] of Object.entries(
    PERSISTED_CANONICAL_OBJECT_ID_FIELDS,
  )) {
    const rows = writeSet?.[objectKind];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const objectId = row?.[identityField];
      if (!/^[a-f0-9]{64}$/.test(objectId || '')) {
        throw new TypeError(
          `Canonical object ${objectKind} has no valid stable identity.`,
        );
      }
      requests.push(Object.freeze({
        input_ordinal: requests.length,
        object_kind: objectKind,
        object_id: objectId,
      }));
    }
  }
  return Object.freeze(requests);
}

function resolvePersistedCanonicalWriteSet({
  writeSet,
  requests,
  storedRows,
}) {
  if (!writeSet || typeof writeSet !== 'object' || Array.isArray(writeSet)) {
    throw new TypeError('Canonical writeSet must be an object.');
  }
  if (writeSet.persisted_object_references !== undefined) {
    throw new TypeError(
      'Repository resolution requires an unresolved canonical writeSet.',
    );
  }
  if (!Array.isArray(requests)
    || !Array.isArray(storedRows)
    || requests.length !== storedRows.length) {
    throw new TypeError(
      'Repository resolution must preserve exact request cardinality.',
    );
  }
  const proposedByKey = new Map();
  for (const request of requests) {
    const identityField =
      PERSISTED_CANONICAL_OBJECT_ID_FIELDS[request.object_kind];
    const proposed = writeSet[request.object_kind]?.find(
      (row) => row?.[identityField] === request.object_id,
    );
    const key = `${request.object_kind}:${request.object_id}`;
    if (!identityField || !proposed || proposedByKey.has(key)) {
      throw new TypeError(
        `Repository resolution request ${key} is missing or duplicated.`,
      );
    }
    proposedByKey.set(key, proposed);
  }

  const retainedKeys = new Set();
  const references = [];
  const retainedCanonicalObjects = [];
  for (const [index, request] of requests.entries()) {
    const stored = storedRows[index];
    if (!stored
      || Number(stored.input_ordinal) !== request.input_ordinal
      || stored.object_kind !== request.object_kind
      || stored.object_id !== request.object_id) {
      throw new TypeError(
        'Repository resolution changed canonical object order or identity.',
      );
    }
    if (stored.canonical_payload == null) continue;
    const key = `${request.object_kind}:${request.object_id}`;
    const proposed = proposedByKey.get(key);
    const storedSemanticValue = withoutClosure(stored.canonical_payload);
    const proposedSemanticValue = withoutClosure(proposed);
    if (canonicalJson(storedSemanticValue)
      !== canonicalJson(proposedSemanticValue)) {
      const changedFields = [...new Set([
        ...Object.keys(storedSemanticValue),
        ...Object.keys(proposedSemanticValue),
      ])].filter(
        (field) => canonicalJson([
          Object.hasOwn(storedSemanticValue, field),
          Object.hasOwn(storedSemanticValue, field)
            ? storedSemanticValue[field]
            : null,
        ]) !== canonicalJson([
          Object.hasOwn(proposedSemanticValue, field),
          Object.hasOwn(proposedSemanticValue, field)
            ? proposedSemanticValue[field]
            : null,
        ]),
      ).sort();
      throw new TypeError(
        `Persisted canonical object ${key} conflicts beyond its closure`
          + ` in fields: ${changedFields.join(', ')}.`,
      );
    }
    if (!/^[a-f0-9]{64}$/.test(stored.closure_id || '')
      || !/^[a-f0-9]{64}$/.test(stored.canonical_payload_digest || '')
      || stored.canonical_payload.closure_id !== stored.closure_id
      || !/^[a-f0-9]{64}$/.test(proposed.closure_id || '')) {
      throw new TypeError(
        `Persisted canonical object ${key} has invalid provenance.`,
      );
    }
    retainedKeys.add(key);
    references.push(Object.freeze({
      schema_version: 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1',
      object_kind: request.object_kind,
      object_id: request.object_id,
      stored_closure_id: stored.closure_id,
      canonical_payload_digest: stored.canonical_payload_digest,
      validation_closure_id: proposed.closure_id,
    }));
    retainedCanonicalObjects.push(Object.freeze({
      object_kind: request.object_kind,
      object_id: request.object_id,
      closure_id: stored.closure_id,
      canonical_payload_digest: stored.canonical_payload_digest,
      canonical_payload: stored.canonical_payload,
    }));
  }

  const resolvedWriteSet = {
    ...writeSet,
    persisted_object_references: references,
  };
  for (const [objectKind, identityField] of Object.entries(
    PERSISTED_CANONICAL_OBJECT_ID_FIELDS,
  )) {
    if (!Array.isArray(writeSet[objectKind])) continue;
    resolvedWriteSet[objectKind] = writeSet[objectKind].filter(
      (row) => !retainedKeys.has(`${objectKind}:${row[identityField]}`),
    );
  }
  return Object.freeze({
    writeSet: Object.freeze(resolvedWriteSet),
    retainedCanonicalObjects: Object.freeze(retainedCanonicalObjects),
    retainedObjectCount: references.length,
  });
}

module.exports = {
  PERSISTED_CANONICAL_OBJECT_ID_FIELDS,
  buildPersistedCanonicalObjectRequests,
  resolvePersistedCanonicalWriteSet,
};
