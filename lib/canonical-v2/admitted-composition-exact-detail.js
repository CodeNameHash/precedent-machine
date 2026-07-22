const { canonicalJson, contentId, sha256Hex, utf8ByteLength } = require('./canonical-bytes');
const { buildAdmittedSourceReference } = require('./admitted-semantic-source');
const {
  validateClaimRevisionIdentity,
  validateRelationshipRevisionIdentity,
} = require('./claims-relationships');
const { validateContractBundle } = require('./contract-bundle');
const { buildFixtureResultComponent } = require('./serving-projection');
const { validateSharedServingRow } = require('./shared-serving-row');
const { buildSemanticSpan, validateExcerpt } = require('./source-structure');

const ACTION_SLOT_KEY = 'RESULT_COMPOSITION_EVIDENCE';
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
const MAX_SOURCES = 8;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the admitted composition detail contract`);
  }
}

function digestObject(domain, value) {
  return contentId(`${domain}_PAYLOAD/V1`, value);
}

function resultBody(row) {
  if (row?.row_kind === 'CANONICAL_RESULT') return row.canonical_result;
  if (row?.row_kind === 'INCOMPLETE_CANONICAL_RESULT') return row.incomplete_canonical_result;
  throw new TypeError('admitted result-composition detail requires a canonical result row');
}

function componentCompleteness(row, body) {
  return row.row_kind === 'INCOMPLETE_CANONICAL_RESULT'
    ? 'INCOMPLETE'
    : body.result_completeness;
}

function incompleteResultDisposition(row, body) {
  return row.row_kind === 'INCOMPLETE_CANONICAL_RESULT' ? {
    result_completeness: body.result_completeness,
    market_comparability: body.market_comparability,
    governed_reason_codes: clone(body.governed_reason_codes),
  } : {};
}

function sourceAdmissionPayloadDigest(sourceAdmission) {
  const body = { ...sourceAdmission };
  delete body.source_admission_manifest_id;
  return contentId('SOURCE_ADMISSION_MANIFEST_PAYLOAD/V2', body);
}

function validateAdmittedPair({ source, sourceAdmission, row, contractBundle }) {
  buildAdmittedSourceReference(source);
  if (!sourceAdmission || sourceAdmission.schema_version !== 'SOURCE_ADMISSION_MANIFEST/V2') {
    throw new TypeError('an admitted V2 source admission manifest is required');
  }
  const admissionBody = { ...sourceAdmission };
  const admissionId = admissionBody.source_admission_manifest_id;
  delete admissionBody.source_admission_manifest_id;
  if (admissionId !== contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody)
    || admissionId !== source.source_admission_manifest_id
    || sourceAdmission.admission_state !== 'VERIFIED'
    || sourceAdmission.source_kind !== 'ORIGINAL_BYTES'
    || sourceAdmission.immutable_source_document_id !== source.immutable_source_document_id
    || sourceAdmission.source_response_content_id !== source.source_content_id
    || sourceAdmission.canonical_text_id !== source.canonical_text_id
    || sourceAdmission.verification_manifest_id !== source.verification_manifest_id
    || sourceAdmission.blocking_discrepancy_count !== 0
    || sourceAdmission.discrepancy_count !== 0
    || canonicalJson(sourceAdmission.excluded_intervals) !== '[]'
    || canonicalJson(sourceAdmission.conversion_loss_residual_ids) !== '[]'
    || canonicalJson(sourceAdmission.admitted_intervals) !== canonicalJson([{
      start: 0,
      end: source.canonical_text_byte_length,
    }])) {
    throw new TypeError('admitted V2 source and admission lineage do not close exactly');
  }
  const coverageProof = contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
    canonical_text_id: source.canonical_text_id,
    canonical_text_byte_length: source.canonical_text_byte_length,
    source_map_digest: source.source_map_digest,
    admitted_intervals: sourceAdmission.admitted_intervals,
    excluded_intervals: sourceAdmission.excluded_intervals,
    discrepancy_count: sourceAdmission.discrepancy_count,
  });
  if (sourceAdmission.coverage_proof_digest !== coverageProof
    || row.governed_deal_key !== source.governed_deal_key
    || row.deal_admission_id !== source.deal_admission_id
    || row.provenance.contract_fingerprint !== contractBundle.fingerprint) {
    throw new TypeError('admitted V2 source, release row and frozen contract do not agree');
  }
}

function derivedResultRevisionPayload(row) {
  const body = resultBody(row);
  return {
    schema_version: 'DERIVED_RESULT_REVISION/V1',
    derived_result_occurrence_id: body.derived_result_occurrence_id,
    component_revision_ids: body.components.map((item) => item.component_revision_id),
    relationship_set_digests: body.components.map((item) => item.relationship_set_digest),
    result_completeness: body.result_completeness,
    market_comparability: body.market_comparability,
    ...(row.row_kind === 'INCOMPLETE_CANONICAL_RESULT' ? {
      governed_reason_codes: clone(body.governed_reason_codes),
      intersecting_candidates: clone(body.intersecting_candidates),
    } : {}),
  };
}

function sourceLineage(source, sourceAdmission, contractBundle) {
  return {
    source_content_id: source.source_content_id,
    source_occurrence_id: source.source_occurrence_id,
    canonical_text_id: source.canonical_text_id,
    immutable_source_document_id: source.immutable_source_document_id,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    source_admission_manifest_payload_digest: sourceAdmissionPayloadDigest(sourceAdmission),
    deal_admission_id: source.deal_admission_id,
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
      ordinal: edge.ordinal,
    })),
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
    target_occurrence_ids: [...relationship.target_occurrence_ids],
    targets: relationship.target_occurrence_ids.map((id) => targetProjection(targetsById.get(id))),
    effect: clone(relationship.effect),
    evidence_references: relationship.evidence.map((edge) => ({
      relationship_evidence_id: edge.relationship_evidence_id,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      document_ordinal: edge.document_ordinal,
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
    throw new TypeError('admitted result-composition relationship target identity is invalid');
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
  validateAdmittedPair({ source, sourceAdmission, row, contractBundle });
  const body = resultBody(row);
  if (!['CANONICAL_RESULT', 'INCOMPLETE_CANONICAL_RESULT'].includes(row.row_kind)
    || row.source_actions.length !== 0
    || body.source_detail_state.state !== 'UNAVAILABLE') {
    throw new TypeError('admitted result-composition detail requires one validated base row');
  }
  if (!Array.isArray(components)
    || components.length < 1
    || components.length > MAX_COMPONENTS
    || components.length !== body.components.length) {
    throw new TypeError('admitted result-composition detail requires every bounded result component');
  }
  if (!Array.isArray(relationshipTargets)
    || relationshipTargets.length > MAX_RELATIONSHIPS) {
    throw new TypeError('admitted result-composition detail requires bounded relationship targets');
  }
  if (!Array.isArray(excerpts) || excerpts.length < 1 || excerpts.length > MAX_EXCERPTS) {
    throw new TypeError('admitted result-composition detail requires a bounded exact excerpt set');
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
      result_key: body.result_key,
      result_version: body.result_version,
      concept_key: body.concept_key,
      party: body.party,
      value_slot_key: body.components[index].component_slot_key,
      ordinal: body.components[index].governed_ordinal,
      claim: entry.claim,
      relationships: entry.relationships,
      composition_scope_closure_id: entry.component.composition_scope_closure_id,
      completeness: componentCompleteness(row, body),
      comparability: body.market_comparability,
    });
    if (canonicalJson(entry.component) !== canonicalJson(expected)
      || body.components[index].governed_ordinal !== expected.ordinal
      || body.components[index].component_revision_id !== expected.component_revision_id
      || body.components[index].claim_revision_id !== entry.claim.claim_revision_id) {
      throw new TypeError('admitted result-composition component does not close over its row inputs');
    }
    if (entry.claim.state === 'ABSENT') {
      const required = [...entry.claim.scope.required_interval_ids].sort();
      const examined = [...entry.claim.scope.examined_interval_ids].sort();
      if (entry.claim.evidence.length !== 0
        || entry.claim.scope.coverage_status !== 'COMPLETE'
        || required.length < 1
        || canonicalJson(required) !== canonicalJson(examined)) {
        throw new TypeError('ABSENT admitted result component requires exact complete scope closure');
      }
    }
    claims.set(entry.claim.claim_revision_id, entry.claim);
  });

  const orderedRelationships = [...relationships.values()].sort((left, right) => (
    left.relationship_definition_key.localeCompare(right.relationship_definition_key)
      || left.ordinal - right.ordinal
      || left.relationship_revision_id.localeCompare(right.relationship_revision_id)
  ));
  if (orderedRelationships.length > MAX_RELATIONSHIPS) {
    throw new TypeError('admitted result-composition detail requires a bounded relationship set');
  }
  const targetsById = new Map();
  relationshipTargets.forEach((target) => {
    validateTarget(source, target);
    if (targetsById.has(target.provision_component_id)) {
      throw new TypeError('admitted result-composition relationship targets must be unique');
    }
    targetsById.set(target.provision_component_id, target);
  });
  const requiredTargetIds = [...new Set(orderedRelationships.flatMap(
    (relationship) => relationship.target_occurrence_ids,
  ))].sort();
  if (canonicalJson(requiredTargetIds) !== canonicalJson([...targetsById.keys()].sort())) {
    throw new TypeError('admitted result-composition relationship target closure is incomplete');
  }
  const governedTargetOrder = [];
  orderedRelationships.forEach((relationship) => relationship.target_occurrence_ids.forEach((id) => {
    if (!governedTargetOrder.includes(id)) governedTargetOrder.push(id);
  }));
  if (canonicalJson(relationshipTargets.map((target) => target.provision_component_id))
    !== canonicalJson(governedTargetOrder)) {
    throw new TypeError('admitted result-composition relationship targets are not in governed order');
  }
  for (const relationship of orderedRelationships) {
    if (relationship.state !== 'PRESENT'
      || relationship.effect == null
      || relationship.evidence.length < 1
      || relationship.target_occurrence_ids.some((id) => !targetsById.has(id))) {
      throw new TypeError('admitted result-composition relationship is incomplete');
    }
  }

  const orderedExcerpts = [...excerpts].sort(sourceOrder);
  const excerptsById = new Map();
  orderedExcerpts.forEach((excerpt) => {
    validateExcerpt({ source, excerpt });
    if (excerptsById.has(excerpt.excerpt_id)) {
      throw new TypeError('admitted result-composition excerpts must be unique');
    }
    excerptsById.set(excerpt.excerpt_id, excerpt);
  });
  if (canonicalJson(excerpts) !== canonicalJson(orderedExcerpts)) {
    throw new TypeError('admitted result-composition excerpts must be in exact source order');
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
    throw new TypeError('admitted result-composition exact excerpt closure is incomplete or over-broad');
  }
  const allEdges = [
    ...[...claims.values()].flatMap((claim) => claim.evidence),
    ...orderedRelationships.flatMap((relationship) => relationship.evidence),
  ];
  for (const edge of allEdges) {
    const excerpt = excerptsById.get(edge.excerpt_id);
    if (!excerpt
      || edge.document_ordinal !== source.source_ordinal
      || edge.absolute_start !== excerpt.absolute_start
      || edge.absolute_end !== excerpt.absolute_end) {
      throw new TypeError('admitted result-composition evidence and exact excerpt do not agree');
    }
  }
  const action = contractBundle.serving_exact_detail_action_definitions.find(
    (entry) => entry.action_slot_key === ACTION_SLOT_KEY,
  );
  if (!action
    || action.parent_kind !== 'RESULT_ROW'
    || action.detail_kind !== 'RESULT_COMPOSITION_EVIDENCE'
    || action.maximum_references !== 1) {
    throw new TypeError('the frozen admitted result-composition exact-detail action is unavailable');
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
  const body = resultBody(row);
  const nodes = [[
    'DerivedResultRevision',
    body.derived_result_revision_id,
    digestObject('DERIVED_RESULT_REVISION', derivedResultRevisionPayload(row)),
  ]];
  components.forEach((entry) => {
    nodes.push([
      'ResultComponentRevision',
      entry.component.component_revision_id,
      digestObject('RESULT_COMPONENT_REVISION', entry.component),
    ]);
    nodes.push(['ClaimRevision', entry.claim.claim_revision_id, digestObject('CLAIM_REVISION', entry.claim)]);
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
    schema_version: 'SOURCE_CONTENT/V2',
    source_content_id: source.source_content_id,
    source_kind: source.source_kind,
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    byte_length: source.source_byte_length,
    exact_bytes_sha256: source.document_hash,
  };
  nodes.push(
    [
      'CanonicalText',
      source.canonical_text_id,
      contentId('ADMITTED_CANONICAL_TEXT_RUNTIME_PAYLOAD/V1', source.canonical_text),
    ],
    ['SourceOccurrence', source.source_occurrence_id, digestObject('SOURCE_OCCURRENCE', sourceOccurrence)],
    [
      'SourceAdmissionManifest',
      sourceAdmission.source_admission_manifest_id,
      sourceAdmissionPayloadDigest(sourceAdmission),
    ],
    ['SourceContent', source.source_content_id, contentId('SOURCE_CONTENT_PAYLOAD/V2', sourceContent)],
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
  resultBody(body).source_detail_state = {
    state: 'UNAVAILABLE',
    reason_code: 'EXACT_DETAIL_PROJECTION_NOT_BUILT',
  };
  return {
    ...body,
    canonical_payload_digest: contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body),
  };
}

function buildAdmittedResultCompositionDetailPackage({
  contract_bundle: contractBundle,
  row,
  source,
  source_admission: sourceAdmission,
  components,
  relationship_targets: relationshipTargets,
  excerpts,
} = {}) {
  const body = resultBody(row);
  const { action, orderedRelationships, orderedExcerpts, targetsById } = compositionInputs({
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
    derived_result_occurrence_id: body.derived_result_occurrence_id,
    derived_result_revision_id: body.derived_result_revision_id,
    ...incompleteResultDisposition(row, body),
    component_revision_ids: components.map((entry) => entry.component.component_revision_id),
    relationship_revision_ids: orderedRelationships.map((relationship) => relationship.relationship_revision_id),
    excerpt_ids: orderedExcerpts.map((excerpt) => excerpt.excerpt_id),
  });
  const lineage = sourceLineage(source, sourceAdmission, contractBundle);
  const responseBody = {
    schema_version: action.response_schema,
    detail_kind: action.detail_kind,
    derived_result_occurrence_id: body.derived_result_occurrence_id,
    derived_result_revision_id: body.derived_result_revision_id,
    ...incompleteResultDisposition(row, body),
    components: components.map((entry, index) => ({
      governed_ordinal: index,
      component_slot_key: body.components[index].component_slot_key,
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
    throw new TypeError(`admitted result-composition exact-detail response is ${encodedByteLength} bytes and exceeds its frozen byte bound`);
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
    terminal_object_id: body.derived_result_revision_id,
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
  resultBody(attachedBody).source_detail_state = {
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

function validateAdmittedResultCompositionDetailPackage({
  package: candidate,
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  components,
  relationship_targets: relationshipTargets,
  excerpts,
} = {}) {
  requireExactKeys(candidate, PACKAGE_KEYS, 'admitted result-composition exact-detail package');
  if (candidate.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V1'
    || !Array.isArray(candidate.action_definitions) || candidate.action_definitions.length !== 1
    || !Array.isArray(candidate.detail_payloads) || candidate.detail_payloads.length !== 1
    || !Array.isArray(candidate.references) || candidate.references.length !== 1
    || !Array.isArray(candidate.parent_edges) || candidate.parent_edges.length !== 1) {
    throw new TypeError('admitted result-composition exact-detail package is incomplete');
  }
  validateSharedServingRow(candidate.row);
  const actionTuple = candidate.row.source_actions[0];
  const reference = candidate.references[0];
  const payload = candidate.detail_payloads[0];
  const edge = candidate.parent_edges[0];
  if (!actionTuple
    || actionTuple.action_slot_key !== ACTION_SLOT_KEY
    || actionTuple.source_detail_reference_id !== reference.source_detail_reference_id
    || actionTuple.source_detail_payload_id !== payload.source_detail_payload_id
    || actionTuple.parent_edge_id !== edge.parent_edge_id
    || edge.parent_row_serving_key !== candidate.row.row_serving_key
    || edge.source_detail_reference_id !== reference.source_detail_reference_id
    || edge.source_detail_payload_id !== payload.source_detail_payload_id
    || reference.parent_row_serving_key !== candidate.row.row_serving_key
    || reference.source_detail_payload_id !== payload.source_detail_payload_id) {
    throw new TypeError('admitted result-composition exact-detail graph is not atomically closed');
  }
  const expected = buildAdmittedResultCompositionDetailPackage({
    contract_bundle: contractBundle,
    row: baseRowFromAttached(candidate.row),
    source,
    source_admission: sourceAdmission,
    components,
    relationship_targets: relationshipTargets,
    excerpts,
  });
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('admitted result-composition exact-detail identity or source closure mismatch');
  }
  return true;
}

function multiSourceOrder(sourceOrdinalByCanonicalTextId) {
  return (left, right) => (
    sourceOrdinalByCanonicalTextId.get(left.canonical_text_id)
      - sourceOrdinalByCanonicalTextId.get(right.canonical_text_id)
      || sourceOrder(left, right)
  );
}

function validateAdmittedSourceEntries({ sources, row, contractBundle }) {
  if (!Array.isArray(sources) || sources.length < 2 || sources.length > MAX_SOURCES) {
    throw new TypeError(`admitted multi-source detail requires between 2 and ${MAX_SOURCES} sources`);
  }
  const ordinals = [];
  const byOrdinal = new Map();
  const byCanonicalTextId = new Map();
  sources.forEach((entry, index) => {
    requireExactKeys(entry, ['source', 'source_admission'], `sources[${index}]`);
    const source = entry.source;
    validateAdmittedPair({
      source,
      sourceAdmission: entry.source_admission,
      row,
      contractBundle,
    });
    if (byOrdinal.has(source.source_ordinal)
      || byCanonicalTextId.has(source.canonical_text_id)) {
      throw new TypeError('admitted multi-source detail sources must have unique ordinals and canonical texts');
    }
    ordinals.push(source.source_ordinal);
    byOrdinal.set(source.source_ordinal, entry);
    byCanonicalTextId.set(source.canonical_text_id, entry);
  });
  const governedOrdinals = [...ordinals].sort((left, right) => left - right);
  if (canonicalJson(ordinals) !== canonicalJson(governedOrdinals)) {
    throw new TypeError('admitted multi-source detail sources must be in governed source order');
  }
  return { byOrdinal, byCanonicalTextId };
}

function multiSourceCompositionInputs({
  contractBundle,
  row,
  sources,
  components,
  relationshipTargets,
  excerpts,
}) {
  validateContractBundle(contractBundle);
  validateSharedServingRow(row);
  const sourceMaps = validateAdmittedSourceEntries({ sources, row, contractBundle });
  const body = resultBody(row);
  if (!['CANONICAL_RESULT', 'INCOMPLETE_CANONICAL_RESULT'].includes(row.row_kind)
    || row.source_actions.length !== 0
    || body.source_detail_state.state !== 'UNAVAILABLE') {
    throw new TypeError('admitted multi-source detail requires one validated base row');
  }
  if (!Array.isArray(components)
    || components.length < 1
    || components.length > MAX_COMPONENTS
    || components.length !== body.components.length) {
    throw new TypeError('admitted multi-source detail requires every bounded result component');
  }
  if (!Array.isArray(relationshipTargets)
    || relationshipTargets.length > MAX_RELATIONSHIPS) {
    throw new TypeError('admitted multi-source detail requires bounded relationship targets');
  }
  if (!Array.isArray(excerpts) || excerpts.length < 2 || excerpts.length > MAX_EXCERPTS) {
    throw new TypeError('admitted multi-source detail requires a bounded exact excerpt set');
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
      result_key: body.result_key,
      result_version: body.result_version,
      concept_key: body.concept_key,
      party: body.party,
      value_slot_key: body.components[index].component_slot_key,
      ordinal: body.components[index].governed_ordinal,
      claim: entry.claim,
      relationships: entry.relationships,
      composition_scope_closure_id: entry.component.composition_scope_closure_id,
      completeness: componentCompleteness(row, body),
      comparability: body.market_comparability,
    });
    if (canonicalJson(entry.component) !== canonicalJson(expected)
      || body.components[index].governed_ordinal !== expected.ordinal
      || body.components[index].component_revision_id !== expected.component_revision_id
      || body.components[index].claim_revision_id !== entry.claim.claim_revision_id) {
      throw new TypeError('admitted multi-source component does not close over its row inputs');
    }
    if (entry.claim.state === 'ABSENT') {
      const required = [...entry.claim.scope.required_interval_ids].sort();
      const examined = [...entry.claim.scope.examined_interval_ids].sort();
      if (entry.claim.evidence.length !== 0
        || entry.claim.scope.coverage_status !== 'COMPLETE'
        || required.length < 1
        || canonicalJson(required) !== canonicalJson(examined)) {
        throw new TypeError('ABSENT admitted multi-source component requires exact complete scope closure');
      }
    }
    claims.set(entry.claim.claim_revision_id, entry.claim);
  });

  const orderedRelationships = [...relationships.values()].sort((left, right) => (
    left.relationship_definition_key.localeCompare(right.relationship_definition_key)
      || left.ordinal - right.ordinal
      || left.relationship_revision_id.localeCompare(right.relationship_revision_id)
  ));
  if (orderedRelationships.length > MAX_RELATIONSHIPS) {
    throw new TypeError('admitted multi-source detail requires a bounded relationship set');
  }
  const targetsById = new Map();
  relationshipTargets.forEach((target) => {
    const sourceEntry = sourceMaps.byCanonicalTextId.get(target.canonical_text_id);
    if (!sourceEntry) throw new TypeError('admitted multi-source relationship target source is unresolved');
    validateTarget(sourceEntry.source, target);
    if (targetsById.has(target.provision_component_id)) {
      throw new TypeError('admitted multi-source relationship targets must be unique');
    }
    targetsById.set(target.provision_component_id, target);
  });
  const requiredTargetIds = [...new Set(orderedRelationships.flatMap(
    (relationship) => relationship.target_occurrence_ids,
  ))].sort();
  if (canonicalJson(requiredTargetIds) !== canonicalJson([...targetsById.keys()].sort())) {
    throw new TypeError('admitted multi-source relationship target closure is incomplete');
  }
  const governedTargetOrder = [];
  orderedRelationships.forEach((relationship) => relationship.target_occurrence_ids.forEach((id) => {
    if (!governedTargetOrder.includes(id)) governedTargetOrder.push(id);
  }));
  if (canonicalJson(relationshipTargets.map((target) => target.provision_component_id))
    !== canonicalJson(governedTargetOrder)) {
    throw new TypeError('admitted multi-source relationship targets are not in governed order');
  }
  for (const relationship of orderedRelationships) {
    if (relationship.state !== 'PRESENT'
      || relationship.effect == null
      || relationship.evidence.length < 1
      || relationship.target_occurrence_ids.some((id) => !targetsById.has(id))) {
      throw new TypeError('admitted multi-source relationship is incomplete');
    }
  }

  const sourceOrdinalByCanonicalTextId = new Map(sources.map((entry) => [
    entry.source.canonical_text_id,
    entry.source.source_ordinal,
  ]));
  const orderedExcerpts = [...excerpts].sort(multiSourceOrder(sourceOrdinalByCanonicalTextId));
  if (canonicalJson(excerpts) !== canonicalJson(orderedExcerpts)) {
    throw new TypeError('admitted multi-source excerpts must be in governed source and byte order');
  }
  const excerptsById = new Map();
  const excerptSourceOrdinalById = new Map();
  orderedExcerpts.forEach((excerpt) => {
    const sourceEntry = sourceMaps.byCanonicalTextId.get(excerpt.canonical_text_id);
    if (!sourceEntry || sourceEntry.source.document_hash !== excerpt.document_hash) {
      throw new TypeError('admitted multi-source excerpt source lineage is unresolved');
    }
    validateExcerpt({ source: sourceEntry.source, excerpt });
    if (excerptsById.has(excerpt.excerpt_id)) {
      throw new TypeError('admitted multi-source excerpts must be unique');
    }
    excerptsById.set(excerpt.excerpt_id, excerpt);
    excerptSourceOrdinalById.set(excerpt.excerpt_id, sourceEntry.source.source_ordinal);
  });
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
    throw new TypeError('admitted multi-source exact excerpt closure is incomplete or over-broad');
  }
  const allEdges = [
    ...[...claims.values()].flatMap((claim) => claim.evidence),
    ...orderedRelationships.flatMap((relationship) => relationship.evidence),
  ];
  for (const edge of allEdges) {
    const excerpt = excerptsById.get(edge.excerpt_id);
    const sourceEntry = sourceMaps.byOrdinal.get(edge.document_ordinal);
    if (!excerpt
      || !sourceEntry
      || excerptSourceOrdinalById.get(edge.excerpt_id) !== edge.document_ordinal
      || edge.absolute_start !== excerpt.absolute_start
      || edge.absolute_end !== excerpt.absolute_end) {
      throw new TypeError('admitted multi-source evidence and exact excerpt do not agree');
    }
  }
  const usedSourceOrdinals = [...new Set(excerptSourceOrdinalById.values())].sort((left, right) => left - right);
  if (canonicalJson(usedSourceOrdinals) !== canonicalJson([...sourceMaps.byOrdinal.keys()])) {
    throw new TypeError('admitted multi-source detail cannot carry an unused source admission');
  }
  const action = contractBundle.serving_exact_detail_action_definitions.find(
    (entry) => entry.action_slot_key === ACTION_SLOT_KEY,
  );
  if (!action
    || action.parent_kind !== 'RESULT_ROW'
    || action.detail_kind !== 'RESULT_COMPOSITION_EVIDENCE'
    || action.maximum_references !== 1) {
    throw new TypeError('the frozen admitted multi-source exact-detail action is unavailable');
  }
  return {
    action,
    orderedRelationships,
    orderedExcerpts,
    targetsById,
    sourceMaps,
  };
}

function multiSourceCompositionPath({
  row,
  sources,
  components,
  relationships,
  relationshipTargets,
  excerpts,
}) {
  const body = resultBody(row);
  const sourceByCanonicalTextId = new Map(sources.map((entry) => [
    entry.source.canonical_text_id,
    entry.source,
  ]));
  const nodes = [[
    'DerivedResultRevision',
    body.derived_result_revision_id,
    digestObject('DERIVED_RESULT_REVISION', derivedResultRevisionPayload(row)),
  ]];
  components.forEach((entry) => {
    nodes.push([
      'ResultComponentRevision',
      entry.component.component_revision_id,
      digestObject('RESULT_COMPONENT_REVISION', entry.component),
    ]);
    nodes.push(['ClaimRevision', entry.claim.claim_revision_id, digestObject('CLAIM_REVISION', entry.claim)]);
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
    const source = sourceByCanonicalTextId.get(excerpt.canonical_text_id);
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
  sources.forEach(({ source, source_admission: sourceAdmission }) => {
    const sourceOccurrence = {
      schema_version: 'SOURCE_OCCURRENCE/V1',
      source_occurrence_id: source.source_occurrence_id,
      source_occurrence_key: source.source_occurrence_key,
      source_content_id: source.source_content_id,
    };
    const sourceContent = {
      schema_version: 'SOURCE_CONTENT/V2',
      source_content_id: source.source_content_id,
      source_kind: source.source_kind,
      authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
      byte_length: source.source_byte_length,
      exact_bytes_sha256: source.document_hash,
    };
    nodes.push(
      [
        'CanonicalText',
        source.canonical_text_id,
        contentId('ADMITTED_CANONICAL_TEXT_RUNTIME_PAYLOAD/V1', source.canonical_text),
      ],
      ['SourceOccurrence', source.source_occurrence_id, digestObject('SOURCE_OCCURRENCE', sourceOccurrence)],
      [
        'SourceAdmissionManifest',
        sourceAdmission.source_admission_manifest_id,
        sourceAdmissionPayloadDigest(sourceAdmission),
      ],
      ['SourceContent', source.source_content_id, contentId('SOURCE_CONTENT_PAYLOAD/V2', sourceContent)],
    );
  });
  return nodes.map(([objectType, objectId, objectPayloadDigest], pathOrdinal) => ({
    object_type: objectType,
    object_id: objectId,
    object_payload_digest: objectPayloadDigest,
    path_ordinal: pathOrdinal,
  }));
}

function multiSourceExcerptProjection(excerpt, source) {
  return {
    ...excerptProjection(excerpt),
    source_ordinal: source.source_ordinal,
    canonical_text_id: source.canonical_text_id,
    document_hash: source.document_hash,
  };
}

function buildAdmittedMultiSourceResultCompositionDetailPackage({
  contract_bundle: contractBundle,
  row,
  sources,
  components,
  relationship_targets: relationshipTargets,
  excerpts,
} = {}) {
  const body = resultBody(row);
  const {
    action,
    orderedRelationships,
    orderedExcerpts,
    targetsById,
    sourceMaps,
  } = multiSourceCompositionInputs({
    contractBundle,
    row,
    sources,
    components,
    relationshipTargets,
    excerpts,
  });
  const governedOrdinal = 0;
  const sourceLineages = sources.map(({ source, source_admission: sourceAdmission }) => ({
    source_ordinal: source.source_ordinal,
    ...sourceLineage(source, sourceAdmission, contractBundle),
  }));
  const contextualUseKey = contentId('MULTI_SOURCE_RESULT_COMPOSITION_EVIDENCE_CONTEXT/V1', {
    derived_result_occurrence_id: body.derived_result_occurrence_id,
    derived_result_revision_id: body.derived_result_revision_id,
    ...incompleteResultDisposition(row, body),
    component_revision_ids: components.map((entry) => entry.component.component_revision_id),
    relationship_revision_ids: orderedRelationships.map((relationship) => relationship.relationship_revision_id),
    source_admission_manifest_ids: sourceLineages.map((lineage) => lineage.source_admission_manifest_id),
    excerpt_ids: orderedExcerpts.map((excerpt) => excerpt.excerpt_id),
  });
  const responseBody = {
    schema_version: action.response_schema,
    detail_kind: action.detail_kind,
    derived_result_occurrence_id: body.derived_result_occurrence_id,
    derived_result_revision_id: body.derived_result_revision_id,
    ...incompleteResultDisposition(row, body),
    components: components.map((entry, index) => ({
      governed_ordinal: index,
      component_slot_key: body.components[index].component_slot_key,
      component_occurrence_id: entry.component.component_occurrence_id,
      component_revision_id: entry.component.component_revision_id,
      claim: claimProjection(entry.claim),
    })),
    relationships: orderedRelationships.map((relationship) => relationshipProjection(
      relationship,
      targetsById,
    )),
    excerpts: orderedExcerpts.map((excerpt) => multiSourceExcerptProjection(
      excerpt,
      sourceMaps.byCanonicalTextId.get(excerpt.canonical_text_id).source,
    )),
    source_lineages: sourceLineages,
  };
  const responseBodyDigest = contentId('SERVING_EXACT_DETAIL_RESPONSE_BODY/V1', responseBody);
  const encodedByteLength = utf8ByteLength(canonicalJson(responseBody));
  if (encodedByteLength > action.maximum_encoded_bytes) {
    throw new TypeError(`admitted multi-source exact-detail response is ${encodedByteLength} bytes and exceeds its frozen byte bound`);
  }
  const orderedPath = multiSourceCompositionPath({
    row,
    sources,
    components,
    relationships: orderedRelationships,
    relationshipTargets,
    excerpts: orderedExcerpts,
  });
  const sourceLineageDigest = contentId('SERVING_EXACT_DETAIL_MULTI_SOURCE_LINEAGE/V1', {
    source_lineages: sourceLineages,
  });
  const payloadBody = {
    schema_version: 'SERVING_EXACT_DETAIL_PAYLOAD/V1',
    corpus_release_id: row.corpus_release_id,
    action_definition_id: action.action_definition_id,
    detail_kind: action.detail_kind,
    contextual_use_key: contextualUseKey,
    terminal_object_type: 'DERIVED_RESULT_REVISION',
    terminal_object_id: body.derived_result_revision_id,
    terminal_object_payload_digest: digestObject(
      'DERIVED_RESULT_REVISION',
      derivedResultRevisionPayload(row),
    ),
    response_schema: action.response_schema,
    response_body: responseBody,
    response_body_digest: responseBodyDigest,
    source_lineage_digest: sourceLineageDigest,
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
  resultBody(attachedBody).source_detail_state = {
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

function validateAdmittedMultiSourceResultCompositionDetailPackage({
  package: candidate,
  contract_bundle: contractBundle,
  sources,
  components,
  relationship_targets: relationshipTargets,
  excerpts,
} = {}) {
  requireExactKeys(candidate, PACKAGE_KEYS, 'admitted multi-source exact-detail package');
  if (candidate.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V1'
    || !Array.isArray(candidate.action_definitions) || candidate.action_definitions.length !== 1
    || !Array.isArray(candidate.detail_payloads) || candidate.detail_payloads.length !== 1
    || !Array.isArray(candidate.references) || candidate.references.length !== 1
    || !Array.isArray(candidate.parent_edges) || candidate.parent_edges.length !== 1) {
    throw new TypeError('admitted multi-source exact-detail package is incomplete');
  }
  validateSharedServingRow(candidate.row);
  const actionTuple = candidate.row.source_actions[0];
  const reference = candidate.references[0];
  const payload = candidate.detail_payloads[0];
  const edge = candidate.parent_edges[0];
  if (!actionTuple
    || actionTuple.action_slot_key !== ACTION_SLOT_KEY
    || actionTuple.source_detail_reference_id !== reference.source_detail_reference_id
    || actionTuple.source_detail_payload_id !== payload.source_detail_payload_id
    || actionTuple.parent_edge_id !== edge.parent_edge_id
    || edge.parent_row_serving_key !== candidate.row.row_serving_key
    || edge.source_detail_reference_id !== reference.source_detail_reference_id
    || edge.source_detail_payload_id !== payload.source_detail_payload_id
    || reference.parent_row_serving_key !== candidate.row.row_serving_key
    || reference.source_detail_payload_id !== payload.source_detail_payload_id) {
    throw new TypeError('admitted multi-source exact-detail graph is not atomically closed');
  }
  const expected = buildAdmittedMultiSourceResultCompositionDetailPackage({
    contract_bundle: contractBundle,
    row: baseRowFromAttached(candidate.row),
    sources,
    components,
    relationship_targets: relationshipTargets,
    excerpts,
  });
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('admitted multi-source exact-detail identity or source closure mismatch');
  }
  return true;
}

module.exports = {
  ACTION_SLOT_KEY,
  buildAdmittedMultiSourceResultCompositionDetailPackage,
  buildAdmittedResultCompositionDetailPackage,
  validateAdmittedMultiSourceResultCompositionDetailPackage,
  validateAdmittedResultCompositionDetailPackage,
};
