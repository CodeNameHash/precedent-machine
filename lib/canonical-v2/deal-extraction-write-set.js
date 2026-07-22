const { canonicalJson, contentId } = require('./canonical-bytes');

const COLLECTION_IDENTITIES = Object.freeze({
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

function sourceRows(writeSet) {
  if (writeSet?.source && writeSet?.source_admission) {
    return { sources: [writeSet.source], admissions: [writeSet.source_admission] };
  }
  if (Array.isArray(writeSet?.sources) && Array.isArray(writeSet?.source_admissions)) {
    return { sources: writeSet.sources, admissions: writeSet.source_admissions };
  }
  throw new TypeError('each family write set must carry one complete singular or plural source contract');
}

function assertCompatibleDeal(candidate, authoritative) {
  for (const field of ['deal_key', 'deal_admission_id', 'document_hash']) {
    if (candidate?.[field] !== authoritative?.[field]) {
      throw new TypeError(`family write set conflicts with authoritative deal ${field}`);
    }
  }
  for (const [key, value] of Object.entries(candidate.dimensions || {})) {
    const selected = authoritative.dimensions?.[key];
    if (value == null || (Array.isArray(value) && value.length === 0)) continue;
    if (selected == null || (Array.isArray(selected) && selected.length === 0)
      || canonicalJson(value) !== canonicalJson(selected)) {
      throw new TypeError(`family write set conflicts with authoritative deal dimension ${key}`);
    }
  }
}

function insertExact(map, id, row, label) {
  if (typeof id !== 'string' || !id) throw new TypeError(`${label} has no governed identity`);
  const existing = map.get(id);
  if (existing && canonicalJson(existing) !== canonicalJson(row)) {
    throw new TypeError(`${label} ${id} has conflicting canonical content`);
  }
  if (!existing) map.set(id, row);
}

function objectWithoutClosure(row) {
  const { closure_id: ignored, ...canonicalObject } = row;
  return canonicalObject;
}

function insertCanonicalObject(map, id, row, label) {
  if (typeof id !== 'string' || !id) throw new TypeError(`${label} has no governed identity`);
  if (typeof row?.closure_id !== 'string' || !row.closure_id) {
    throw new TypeError(`${label} ${id} has no publication closure`);
  }
  const existing = map.get(id);
  if (existing && canonicalJson(existing.object) !== canonicalJson(objectWithoutClosure(row))) {
    throw new TypeError(`${label} ${id} has conflicting canonical content`);
  }
  if (!existing) {
    map.set(id, { object: objectWithoutClosure(row), closureIds: new Set([row.closure_id]) });
    return;
  }
  existing.closureIds.add(row.closure_id);
}

function materialiseCanonicalObject({ object, closureIds }, collection, identityField) {
  const orderedClosures = [...closureIds].sort();
  return {
    ...object,
    closure_id: orderedClosures.length === 1
      ? orderedClosures[0]
      : contentId('COMPOSED_OBJECT_PUBLICATION_CLOSURE/V1', {
        object_type: collection,
        object_id: object[identityField],
        contributing_closure_ids: orderedClosures,
      }),
  };
}

function composeDealExtractionWriteSet({ writeSets, deal } = {}) {
  if (!Array.isArray(writeSets) || writeSets.length < 1) {
    throw new TypeError('writeSets must contain at least one family write set');
  }
  if (!deal || typeof deal !== 'object' || Array.isArray(deal)) {
    throw new TypeError('one authoritative deal record is required');
  }

  const sources = new Map();
  const admissions = new Map();
  const collections = Object.fromEntries(
    Object.keys(COLLECTION_IDENTITIES).map((key) => [key, new Map()]),
  );

  for (const writeSet of writeSets) {
    assertCompatibleDeal(writeSet?.deal, deal);
    const admitted = sourceRows(writeSet);
    for (const source of admitted.sources) {
      insertExact(sources, source?.immutable_source_document_id, source, 'immutable source');
    }
    for (const admission of admitted.admissions) {
      insertExact(admissions, admission?.source_admission_manifest_id, admission, 'source admission');
    }
    for (const [collection, identityField] of Object.entries(COLLECTION_IDENTITIES)) {
      const rows = writeSet?.[collection] || [];
      if (!Array.isArray(rows)) throw new TypeError(`family write set ${collection} must be an array`);
      for (const row of rows) {
        insertCanonicalObject(collections[collection], row?.[identityField], row, collection);
      }
    }
  }

  const orderedSources = [...sources.values()].sort((left, right) => (
    left.immutable_source_document_id.localeCompare(right.immutable_source_document_id)
  ));
  const sourceIdSet = new Set(orderedSources.map((source) => source.immutable_source_document_id));
  const orderedAdmissions = [...admissions.values()].sort((left, right) => (
    left.source_ordinal - right.source_ordinal
      || left.source_admission_manifest_id.localeCompare(right.source_admission_manifest_id)
  ));
  if (orderedAdmissions.length !== orderedSources.length
    || orderedAdmissions.some((admission) => !sourceIdSet.has(admission.immutable_source_document_id))
    || new Set(orderedAdmissions.map((admission) => admission.source_ordinal)).size !== orderedAdmissions.length) {
    throw new TypeError('composed source admissions do not cover the immutable source set exactly');
  }

  return Object.freeze({
    sources: Object.freeze(orderedSources),
    source_admissions: Object.freeze(orderedAdmissions),
    deal,
    ...Object.fromEntries(Object.entries(COLLECTION_IDENTITIES).map(([collection, identityField]) => [
      collection,
      Object.freeze([...collections[collection].values()]
        .map((entry) => materialiseCanonicalObject(entry, collection, identityField))
        .sort((left, right) => left[identityField].localeCompare(right[identityField]))),
    ])),
  });
}

module.exports = {
  COLLECTION_IDENTITIES,
  composeDealExtractionWriteSet,
};
