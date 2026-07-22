const { canonicalJson, contentId, utf8ByteLength } = require('./canonical-bytes');
const {
  validateClaimRevisionIdentity,
  validateRelationshipRevisionIdentity,
} = require('./claims-relationships');
const { validateContractBundle } = require('./contract-bundle');
const { buildFixtureResultComponent } = require('./serving-projection');
const { validateSharedServingRow } = require('./shared-serving-row');
const {
  buildSemanticSpan,
  validateExcerpt,
  validateFixtureSourceAdmission,
  validateImmutableSource,
} = require('./source-structure');

const COMPOSITION_ACTION_SLOT_KEY = 'RESULT_COMPOSITION_EVIDENCE';
const PACKAGE_KEYS = Object.freeze([
  'schema_version',
  'row',
  'action_definitions',
  'detail_payloads',
  'references',
  'parent_edges',
]);
const MAX_COMPONENTS = 16;
const MAX_RELATIONSHIPS = 16;
const MAX_EXCERPTS = 64;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the result-composition detail contract`);
  }
}

function digestObject(domain, value) {
  return contentId(`${domain}_PAYLOAD/V1`, value);
}

function derivedResultRevisionPayload(row) {
  return {
    schema_version: 'DERIVED_RESULT_REVISION/V1',
    derived_result_occurrence_id: row.canonical_result.derived_result_occurrence_id,
    component_revision_ids: row.canonical_result.components.map((item) => item.component_revision_id),
    relationship_set_digests: row.canonical_result.components.map((item) => item.relationship_set_digest),
    result_completeness: row.canonical_result.result_completeness,
    market_comparability: row.canonical_result.market_comparability,
  };
}

function sourceLineage(source, sourceAdmission, contractBundle) {
  return {
    source_content_id: source.source_content_id,
    source_occurrence_id: source.source_occurrence_id,
    canonical_text_id: source.canonical_text_id,
    immutable_source_document_id: source.immutable_source_document_id,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    source_admission_manifest_payload_digest: sourceAdmission.canonical_payload_digest,
    deal_admission_id: sourceAdmission.deal_admission_id,
    document_hash: source.document_hash,
    source_byte_length: source.source_byte_length,
    contract_fingerprint: contractBundle.fingerprint,
  };
}

function excerptProjection(excerpt) {
  return {
    excerpt_id: excerpt.excerpt_id,
    excerpt_definition_id: excerpt.excerpt_definition_id,
    excerpt_definition_payload_digest: excerpt.excerpt_definition_payload_digest,
    excerpt_definition_key: excerpt.excerpt_definition_key,
    excerpt_definition_version: excerpt.excerpt_definition_version,
    excerpt_purpose: excerpt.excerpt_purpose,
    transformation_or_redaction_version: excerpt.transformation_or_redaction_version,
    ordered_component_assignments: clone(excerpt.ordered_component_assignments),
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    exact_bytes_digest: excerpt.exact_bytes_digest,
    exact_text: excerpt.exact_text,
  };
}

function claimProjection(claim) {
  return {
    claim_occurrence_id: claim.claim_occurrence_id,
    claim_revision_id: claim.claim_revision_id,
    claim_definition_key: claim.claim_definition_key,
    claim_definition_version: claim.claim_definition_version,
    state: claim.state,
    raw_value: claim.raw_value,
    canonical_value: claim.canonical_value,
    unit: claim.unit,
    day_basis: claim.day_basis,
    denominator: clone(claim.denominator),
    scope: clone(claim.scope),
    evidence_references: claim.evidence.map((edge) => ({
      claim_evidence_id: edge.claim_evidence_id,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      document_ordinal: edge.document_ordinal,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
      ordinal: edge.ordinal,
    })),
    scope_excerpt_ids: claim.state === 'ABSENT'
      ? [...claim.scope.required_interval_ids]
      : [],
  };
}

function targetProjection(target) {
  return {
    provision_component_id: target.provision_component_id,
    parent_provision_instance_id: target.parent_provision_instance_id,
    source_anchor_id: target.source_anchor_id,
    canonical_text_id: target.canonical_text_id,
    absolute_start: target.absolute_start,
    absolute_end: target.absolute_end,
    component_key: target.component_key,
    ordinal: target.ordinal,
  };
}

function relationshipProjection(relationship, targetsById) {
  return {
    relationship_occurrence_id: relationship.relationship_occurrence_id,
    relationship_revision_id: relationship.relationship_revision_id,
    relationship_definition_key: relationship.relationship_definition_key,
    relationship_definition_version: relationship.relationship_definition_version,
    state: relationship.state,
    raw_scope: relationship.raw_scope,
    target_occurrence_ids: [...relationship.target_occurrence_ids],
    targets: relationship.target_occurrence_ids.map((id) => targetProjection(targetsById.get(id))),
    effect: clone(relationship.effect),
    scope: clone(relationship.scope),
    evidence_references: relationship.evidence.map((edge) => ({
      relationship_evidence_id: edge.relationship_evidence_id,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      document_ordinal: edge.document_ordinal,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
      ordinal: edge.ordinal,
    })),
  };
}

function validateTarget(source, target) {
  requireExactKeys(target, [
    'schema_version',
    'parent_provision_instance_id',
    'canonical_text_id',
    'absolute_start',
    'absolute_end',
    'component_key',
    'ordinal',
    'source_anchor_id',
    'provision_component_id',
  ], 'relationship target');
  const span = buildSemanticSpan(source, target.absolute_start, target.absolute_end);
  const payload = {
    schema_version: 'PROVISION_COMPONENT/V1',
    parent_provision_instance_id: target.parent_provision_instance_id,
    canonical_text_id: target.canonical_text_id,
    absolute_start: target.absolute_start,
    absolute_end: target.absolute_end,
    component_key: target.component_key,
    ordinal: target.ordinal,
  };
  if (target.schema_version !== 'PROVISION_COMPONENT/V1'
    || target.canonical_text_id !== source.canonical_text_id
    || target.source_anchor_id !== span.semantic_span_id
    || target.provision_component_id !== contentId('PROVISION_COMPONENT/V1', payload)) {
    throw new TypeError('result-composition relationship target identity is invalid');
  }
}

function sourceOrder(left, right) {
  return left.absolute_start - right.absolute_start
    || left.absolute_end - right.absolute_end
    || left.excerpt_id.localeCompare(right.excerpt_id);
}

function compositionInputs({
  contractBundle,
  row,
  source,
  sourceAdmission,
  components,
  relationshipTargets,
  excerpts,
}) {
  validateContractBundle(contractBundle);
  validateSharedServingRow(row);
  validateImmutableSource(source);
  validateFixtureSourceAdmission({
    source,
    admission: sourceAdmission,
    dealKey: row.governed_deal_key,
    dealAdmissionId: row.deal_admission_id,
    contractFingerprint: contractBundle.fingerprint,
  });
  if (row.row_kind !== 'CANONICAL_RESULT'
    || row.provenance.contract_fingerprint !== contractBundle.fingerprint
    || row.source_actions.length !== 0
    || row.canonical_result.source_detail_state.state !== 'UNAVAILABLE') {
    throw new TypeError('result-composition detail may attach only to its validated base row');
  }
  if (!Array.isArray(components)
    || components.length < 1
    || components.length > MAX_COMPONENTS
    || components.length !== row.canonical_result.components.length) {
    throw new TypeError('result-composition detail requires every bounded result component');
  }
  if (!Array.isArray(relationshipTargets)
    || relationshipTargets.length < 1
    || relationshipTargets.length > MAX_RELATIONSHIPS) {
    throw new TypeError('result-composition detail requires bounded relationship targets');
  }
  if (!Array.isArray(excerpts) || excerpts.length < 1 || excerpts.length > MAX_EXCERPTS) {
    throw new TypeError('result-composition detail requires a bounded exact excerpt set');
  }

  const claims = new Map();
  const relationships = new Map();
  components.forEach((entry, index) => {
    requireExactKeys(entry, ['component', 'claim', 'relationships'], `components[${index}]`);
    validateClaimRevisionIdentity(entry.claim);
    if (!Array.isArray(entry.relationships)) throw new TypeError('component relationships must be an array');
    entry.relationships.forEach((relationship) => {
      validateRelationshipRevisionIdentity(relationship);
      relationships.set(relationship.relationship_revision_id, relationship);
    });
    const expected = buildFixtureResultComponent({
      deal_admission_id: row.deal_admission_id,
      result_key: row.canonical_result.result_key,
      result_version: row.canonical_result.result_version,
      concept_key: row.canonical_result.concept_key,
      party: row.canonical_result.party,
      value_slot_key: row.canonical_result.components[index].component_slot_key,
      ordinal: index,
      claim: entry.claim,
      relationships: entry.relationships,
      composition_scope_closure_id: entry.component.composition_scope_closure_id,
      completeness: row.canonical_result.result_completeness,
      comparability: row.canonical_result.market_comparability,
    });
    if (canonicalJson(entry.component) !== canonicalJson(expected)
      || row.canonical_result.components[index].governed_ordinal !== index
      || row.canonical_result.components[index].component_revision_id !== expected.component_revision_id
      || row.canonical_result.components[index].claim_revision_id !== entry.claim.claim_revision_id) {
      throw new TypeError('result-composition component does not close over its row and canonical inputs');
    }
    if (entry.claim.state === 'ABSENT') {
      const required = [...entry.claim.scope.required_interval_ids].sort();
      const examined = [...entry.claim.scope.examined_interval_ids].sort();
      if (entry.claim.evidence.length !== 0
        || entry.claim.scope.coverage_status !== 'COMPLETE'
        || required.length < 1
        || canonicalJson(required) !== canonicalJson(examined)) {
        throw new TypeError('ABSENT result component requires exact complete scope closure');
      }
    }
    claims.set(entry.claim.claim_revision_id, entry.claim);
  });

  const orderedRelationships = [...relationships.values()].sort((left, right) => (
    left.relationship_definition_key.localeCompare(right.relationship_definition_key)
      || left.ordinal - right.ordinal
      || left.relationship_revision_id.localeCompare(right.relationship_revision_id)
  ));
  if (orderedRelationships.length < 1 || orderedRelationships.length > MAX_RELATIONSHIPS) {
    throw new TypeError('result-composition detail requires a bounded relationship set');
  }
  const targetsById = new Map();
  relationshipTargets.forEach((target) => {
    validateTarget(source, target);
    if (targetsById.has(target.provision_component_id)) {
      throw new TypeError('result-composition relationship targets must be unique');
    }
    targetsById.set(target.provision_component_id, target);
  });
  const requiredTargetIds = [...new Set(orderedRelationships.flatMap(
    (relationship) => relationship.target_occurrence_ids,
  ))].sort();
  if (canonicalJson(requiredTargetIds) !== canonicalJson([...targetsById.keys()].sort())) {
    throw new TypeError('result-composition relationship target closure is incomplete');
  }
  const governedTargetOrder = [];
  orderedRelationships.forEach((relationship) => relationship.target_occurrence_ids.forEach((id) => {
    if (!governedTargetOrder.includes(id)) governedTargetOrder.push(id);
  }));
  if (canonicalJson(relationshipTargets.map((target) => target.provision_component_id))
    !== canonicalJson(governedTargetOrder)) {
    throw new TypeError('result-composition relationship targets are not in governed order');
  }
  for (const relationship of orderedRelationships) {
    if (relationship.state !== 'PRESENT'
      || relationship.effect == null
      || relationship.evidence.length < 1
      || relationship.target_occurrence_ids.some((id) => !targetsById.has(id))) {
      throw new TypeError('result-composition relationship effect, targets or evidence are incomplete');
    }
  }

  const orderedExcerpts = [...excerpts].sort(sourceOrder);
  const excerptsById = new Map();
  orderedExcerpts.forEach((excerpt) => {
    validateExcerpt({ source, excerpt });
    if (excerptsById.has(excerpt.excerpt_id)) {
      throw new TypeError('result-composition excerpts must be unique');
    }
    excerptsById.set(excerpt.excerpt_id, excerpt);
  });
  if (canonicalJson(excerpts) !== canonicalJson(orderedExcerpts)) {
    throw new TypeError('result-composition excerpts must be in exact source order');
  }
  const requiredExcerptIds = new Set();
  for (const claim of claims.values()) {
    claim.evidence.forEach((edge) => requiredExcerptIds.add(edge.excerpt_id));
    if (claim.state === 'ABSENT') {
      claim.scope.required_interval_ids.forEach((id) => requiredExcerptIds.add(id));
      claim.scope.examined_interval_ids.forEach((id) => requiredExcerptIds.add(id));
    }
  }
  orderedRelationships.forEach((relationship) => {
    relationship.evidence.forEach((edge) => requiredExcerptIds.add(edge.excerpt_id));
  });
  if (canonicalJson([...requiredExcerptIds].sort()) !== canonicalJson([...excerptsById.keys()].sort())) {
    throw new TypeError('result-composition exact excerpt closure is incomplete or over-broad');
  }
  const allEdges = [
    ...[...claims.values()].flatMap((claim) => claim.evidence),
    ...orderedRelationships.flatMap((relationship) => relationship.evidence),
  ];
  for (const edge of allEdges) {
    const excerpt = excerptsById.get(edge.excerpt_id);
    if (!excerpt
      || edge.document_ordinal !== sourceAdmission.source_ordinal
      || edge.absolute_start !== excerpt.absolute_start
      || edge.absolute_end !== excerpt.absolute_end) {
      throw new TypeError('result-composition evidence and exact excerpt do not agree');
    }
  }
  const action = contractBundle.serving_exact_detail_action_definitions.find(
    (entry) => entry.action_slot_key === COMPOSITION_ACTION_SLOT_KEY,
  );
  if (!action
    || action.parent_kind !== 'RESULT_ROW'
    || action.detail_kind !== 'RESULT_COMPOSITION_EVIDENCE'
    || action.maximum_references !== 1) {
    throw new TypeError('the frozen result-composition exact-detail action is unavailable');
  }
  return { action, orderedRelationships, orderedExcerpts, targetsById };
}

function compositionSourcePath({
  row,
  source,
  sourceAdmission,
  components,
  relationships,
  relationshipTargets,
  excerpts,
}) {
  const nodes = [[
    'DerivedResultRevision',
    row.canonical_result.derived_result_revision_id,
    digestObject('DERIVED_RESULT_REVISION', derivedResultRevisionPayload(row)),
  ]];
  components.forEach((entry) => {
    nodes.push([
      'ResultComponentRevision',
      entry.component.component_revision_id,
      digestObject('RESULT_COMPONENT_REVISION', entry.component),
    ]);
    nodes.push([
      'ClaimRevision',
      entry.claim.claim_revision_id,
      digestObject('CLAIM_REVISION', entry.claim),
    ]);
    entry.claim.evidence.forEach((edge) => nodes.push([
      'ClaimEvidence',
      edge.claim_evidence_id,
      digestObject('CLAIM_EVIDENCE', edge),
    ]));
  });
  relationships.forEach((relationship) => {
    nodes.push([
      'RelationshipRevision',
      relationship.relationship_revision_id,
      digestObject('RELATIONSHIP_REVISION', relationship),
    ]);
    relationship.evidence.forEach((edge) => nodes.push([
      'RelationshipEvidence',
      edge.relationship_evidence_id,
      digestObject('RELATIONSHIP_EVIDENCE', edge),
    ]));
  });
  relationshipTargets.forEach((target) => nodes.push([
    'ProvisionComponent',
    target.provision_component_id,
    digestObject('PROVISION_COMPONENT', target),
  ]));
  excerpts.forEach((excerpt) => {
    nodes.push(['Excerpt', excerpt.excerpt_id, digestObject('EXCERPT', excerpt)]);
    const semanticSpan = {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: source.canonical_text_id,
      absolute_start: excerpt.absolute_start,
      absolute_end: excerpt.absolute_end,
      semantic_span_id: excerpt.ordered_component_assignments[0].semantic_span_id,
      exact_bytes_digest: excerpt.exact_bytes_digest,
    };
    nodes.push(['SemanticSpan', semanticSpan.semantic_span_id, digestObject('SEMANTIC_SPAN', semanticSpan)]);
  });
  const sourceOccurrence = {
    schema_version: 'SOURCE_OCCURRENCE/V1',
    source_occurrence_id: source.source_occurrence_id,
    source_occurrence_key: source.source_occurrence_key,
    source_content_id: source.source_content_id,
  };
  const sourceContent = {
    schema_version: 'SOURCE_CONTENT/V1',
    source_content_id: source.source_content_id,
    source_kind: source.source_kind,
    byte_length: source.source_byte_length,
    exact_bytes_sha256: source.document_hash,
  };
  nodes.push(
    ['CanonicalText', source.canonical_text_id, source.canonical_text_payload_digest],
    ['SourceOccurrence', source.source_occurrence_id, digestObject('SOURCE_OCCURRENCE', sourceOccurrence)],
    ['SourceAdmissionManifest', sourceAdmission.source_admission_manifest_id, sourceAdmission.canonical_payload_digest],
    ['SourceContent', source.source_content_id, digestObject('SOURCE_CONTENT', sourceContent)],
  );
  return nodes.map(([objectType, objectId, objectPayloadDigest], pathOrdinal) => ({
    object_type: objectType,
    object_id: objectId,
    object_payload_digest: objectPayloadDigest,
    path_ordinal: pathOrdinal,
  }));
}

function baseRowFromAttached(row) {
  const body = clone(row);
  delete body.canonical_payload_digest;
  body.source_actions = [];
  body.canonical_result.source_detail_state = {
    state: 'UNAVAILABLE',
    reason_code: 'EXACT_DETAIL_PROJECTION_NOT_BUILT',
  };
  return {
    ...body,
    canonical_payload_digest: contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body),
  };
}

function buildFixtureResultCompositionDetailPackage({
  contract_bundle: contractBundle,
  row,
  source,
  source_admission: sourceAdmission,
  components,
  relationship_targets: relationshipTargets,
  excerpts,
} = {}) {
  const {
    action,
    orderedRelationships,
    orderedExcerpts,
    targetsById,
  } = compositionInputs({
    contractBundle,
    row,
    source,
    sourceAdmission,
    components,
    relationshipTargets,
    excerpts,
  });
  const governedOrdinal = 0;
  const contextualUseKey = contentId('RESULT_COMPOSITION_EVIDENCE_CONTEXT/V1', {
    derived_result_occurrence_id: row.canonical_result.derived_result_occurrence_id,
    derived_result_revision_id: row.canonical_result.derived_result_revision_id,
    component_revision_ids: components.map((entry) => entry.component.component_revision_id),
    relationship_revision_ids: orderedRelationships.map((relationship) => relationship.relationship_revision_id),
    excerpt_ids: orderedExcerpts.map((excerpt) => excerpt.excerpt_id),
  });
  const lineage = sourceLineage(source, sourceAdmission, contractBundle);
  const responseBody = {
    schema_version: action.response_schema,
    detail_kind: action.detail_kind,
    derived_result_occurrence_id: row.canonical_result.derived_result_occurrence_id,
    derived_result_revision_id: row.canonical_result.derived_result_revision_id,
    components: components.map((entry, index) => ({
      governed_ordinal: index,
      component_slot_key: row.canonical_result.components[index].component_slot_key,
      component_occurrence_id: entry.component.component_occurrence_id,
      component_revision_id: entry.component.component_revision_id,
      claim: claimProjection(entry.claim),
    })),
    relationships: orderedRelationships.map((relationship) => relationshipProjection(
      relationship,
      targetsById,
    )),
    excerpts: orderedExcerpts.map(excerptProjection),
    source_lineage: lineage,
  };
  const responseBodyDigest = contentId('SERVING_EXACT_DETAIL_RESPONSE_BODY/V1', responseBody);
  const encodedByteLength = utf8ByteLength(canonicalJson(responseBody));
  if (encodedByteLength > action.maximum_encoded_bytes) {
    throw new TypeError('result-composition exact-detail response exceeds its frozen byte bound');
  }
  const orderedPath = compositionSourcePath({
    row,
    source,
    sourceAdmission,
    components,
    relationships: orderedRelationships,
    relationshipTargets,
    excerpts: orderedExcerpts,
  });
  const payloadBody = {
    schema_version: 'SERVING_EXACT_DETAIL_PAYLOAD/V1',
    corpus_release_id: row.corpus_release_id,
    action_definition_id: action.action_definition_id,
    detail_kind: action.detail_kind,
    contextual_use_key: contextualUseKey,
    terminal_object_type: 'DERIVED_RESULT_REVISION',
    terminal_object_id: row.canonical_result.derived_result_revision_id,
    terminal_object_payload_digest: digestObject(
      'DERIVED_RESULT_REVISION',
      derivedResultRevisionPayload(row),
    ),
    response_schema: action.response_schema,
    response_body: responseBody,
    response_body_digest: responseBodyDigest,
    source_lineage_digest: contentId('SERVING_EXACT_DETAIL_SOURCE_LINEAGE/V1', lineage),
    encoded_byte_length: encodedByteLength,
    projection_version: action.projection_version,
  };
  const detailPayload = {
    ...payloadBody,
    source_detail_payload_id: contentId('SERVING_EXACT_DETAIL_PAYLOAD/V1', payloadBody),
    canonical_payload_digest: contentId('SERVING_EXACT_DETAIL_PAYLOAD_BODY/V1', payloadBody),
  };
  const multiplicityDigest = contentId('SERVING_EXACT_DETAIL_MULTIPLICITY/V1', {
    contextual_use_keys: [contextualUseKey],
    contextual_cardinality: action.contextual_cardinality,
    duplicate_policy: action.duplicate_policy,
  });
  const referenceBody = {
    schema_version: 'SERVING_EXACT_DETAIL_REFERENCE/V1',
    corpus_release_id: row.corpus_release_id,
    parent_row_serving_key: row.row_serving_key,
    action_slot_key: action.action_slot_key,
    action_version: action.action_version,
    action_definition_id: action.action_definition_id,
    selection_path_schema: action.selection_path_schema,
    contextual_use_key: contextualUseKey,
    ordered_path: orderedPath,
    source_detail_payload_id: detailPayload.source_detail_payload_id,
    multiplicity_digest: multiplicityDigest,
    governed_ordinal: governedOrdinal,
  };
  const reference = {
    ...referenceBody,
    source_detail_reference_id: contentId('SERVING_EXACT_DETAIL_REFERENCE/V1', referenceBody),
    canonical_payload_digest: contentId('SERVING_EXACT_DETAIL_REFERENCE_BODY/V1', referenceBody),
  };
  const edgeBody = {
    schema_version: 'RESULT_ROW_SOURCE_DETAIL_EDGE/V1',
    corpus_release_id: row.corpus_release_id,
    parent_kind: action.parent_kind,
    parent_row_serving_key: row.row_serving_key,
    action_slot_key: action.action_slot_key,
    action_definition_id: action.action_definition_id,
    source_detail_reference_id: reference.source_detail_reference_id,
    source_detail_payload_id: detailPayload.source_detail_payload_id,
    governed_ordinal: governedOrdinal,
  };
  const parentEdge = {
    ...edgeBody,
    parent_edge_id: contentId('RESULT_ROW_SOURCE_DETAIL_EDGE/V1', edgeBody),
    canonical_payload_digest: contentId('RESULT_ROW_SOURCE_DETAIL_EDGE_BODY/V1', edgeBody),
  };
  const attachedBody = clone(row);
  delete attachedBody.canonical_payload_digest;
  attachedBody.source_actions = [{
    action_slot_key: action.action_slot_key,
    action_version: action.action_version,
    action_definition_id: action.action_definition_id,
    action_definition_payload_digest: action.action_definition_payload_digest,
    detail_kind: action.detail_kind,
    source_detail_reference_id: reference.source_detail_reference_id,
    source_detail_payload_id: detailPayload.source_detail_payload_id,
    parent_edge_id: parentEdge.parent_edge_id,
    governed_ordinal: governedOrdinal,
  }];
  attachedBody.canonical_result.source_detail_state = {
    state: 'AVAILABLE',
    reason_code: 'EXACT_DETAIL_CERTIFIED',
  };
  const attachedRow = {
    ...attachedBody,
    canonical_payload_digest: contentId('SHARED_SERVING_ROW_PAYLOAD/V1', attachedBody),
  };
  validateSharedServingRow(attachedRow);
  return Object.freeze({
    schema_version: 'EXACT_DETAIL_ATOMIC_PACKAGE/V1',
    row: Object.freeze(attachedRow),
    action_definitions: Object.freeze([action]),
    detail_payloads: Object.freeze([Object.freeze(detailPayload)]),
    references: Object.freeze([Object.freeze(reference)]),
    parent_edges: Object.freeze([Object.freeze(parentEdge)]),
  });
}

function validateFixtureResultCompositionDetailPackage({
  package: candidate,
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  components,
  relationship_targets: relationshipTargets,
  excerpts,
} = {}) {
  requireExactKeys(candidate, PACKAGE_KEYS, 'result-composition exact-detail package');
  if (candidate.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V1') {
    throw new TypeError('invalid result-composition exact-detail package schema');
  }
  for (const [key, values] of Object.entries({
    action_definitions: candidate.action_definitions,
    detail_payloads: candidate.detail_payloads,
    references: candidate.references,
    parent_edges: candidate.parent_edges,
  })) {
    if (!Array.isArray(values) || values.length !== 1) {
      throw new TypeError(`${key} must contain exactly one governed result-composition object`);
    }
  }
  validateSharedServingRow(candidate.row);
  const actionTuple = candidate.row.source_actions[0];
  const reference = candidate.references[0];
  const payload = candidate.detail_payloads[0];
  const edge = candidate.parent_edges[0];
  if (!actionTuple
    || actionTuple.action_slot_key !== COMPOSITION_ACTION_SLOT_KEY
    || actionTuple.source_detail_reference_id !== reference.source_detail_reference_id
    || actionTuple.source_detail_payload_id !== payload.source_detail_payload_id
    || actionTuple.parent_edge_id !== edge.parent_edge_id
    || edge.parent_row_serving_key !== candidate.row.row_serving_key
    || edge.source_detail_reference_id !== reference.source_detail_reference_id
    || edge.source_detail_payload_id !== payload.source_detail_payload_id
    || reference.parent_row_serving_key !== candidate.row.row_serving_key
    || reference.source_detail_payload_id !== payload.source_detail_payload_id) {
    throw new TypeError('result-composition exact-detail graph is not atomically closed');
  }
  const expected = buildFixtureResultCompositionDetailPackage({
    contract_bundle: contractBundle,
    row: baseRowFromAttached(candidate.row),
    source,
    source_admission: sourceAdmission,
    components,
    relationship_targets: relationshipTargets,
    excerpts,
  });
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('result-composition exact-detail identity, source closure or ordering mismatch');
  }
  return true;
}

module.exports = {
  COMPOSITION_ACTION_SLOT_KEY,
  buildFixtureResultCompositionDetailPackage,
  validateFixtureResultCompositionDetailPackage,
};
