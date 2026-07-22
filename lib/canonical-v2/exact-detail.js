const { canonicalJson, contentId, utf8ByteLength } = require('./canonical-bytes');
const { validateClaimRevisionIdentity } = require('./claims-relationships');
const { validateContractBundle } = require('./contract-bundle');
const { validateSharedServingRow } = require('./shared-serving-row');
const {
  validateExcerpt,
  validateFixtureSourceAdmission,
  validateImmutableSource,
} = require('./source-structure');

const ACTION_SLOT_KEY = 'ACCURACY_STANDARD_CLAIM_EVIDENCE';
const GENERAL_ACTION_SLOT_KEY = 'RESULT_COMPONENT_CLAIM_EVIDENCE';
const OPEN_WORLD_ACTION_SLOT_KEY = 'REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE';
const PACKAGE_KEYS = Object.freeze([
  'schema_version',
  'row',
  'action_definitions',
  'detail_payloads',
  'references',
  'parent_edges',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the frozen exact-detail contract`);
  }
}

function digestObject(domain, value) {
  return contentId(`${domain}_PAYLOAD/V1`, value);
}

function exactDetailAction(contractBundle, actionSlotKey) {
  const actions = contractBundle.serving_exact_detail_action_definitions || [];
  const action = actions.find((entry) => entry.action_slot_key === actionSlotKey);
  if (!action) throw new TypeError('the frozen exact-detail action is unavailable');
  return action;
}

function sourcePath({ source, sourceAdmission, excerpt, claim, evidence }) {
  const semanticSpan = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: source.canonical_text_id,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    semantic_span_id: excerpt.ordered_component_assignments[0].semantic_span_id,
    exact_bytes_digest: excerpt.exact_bytes_digest,
  };
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
  return [
    ['ClaimRevision', claim.claim_revision_id, digestObject('CLAIM_REVISION', claim)],
    ['ClaimEvidence', evidence.claim_evidence_id, digestObject('CLAIM_EVIDENCE', evidence)],
    ['Excerpt', excerpt.excerpt_id, digestObject('EXCERPT', excerpt)],
    ['SemanticSpan', semanticSpan.semantic_span_id, digestObject('SEMANTIC_SPAN', semanticSpan)],
    ['CanonicalText', source.canonical_text_id, source.canonical_text_payload_digest],
    ['SourceOccurrence', source.source_occurrence_id, digestObject('SOURCE_OCCURRENCE', sourceOccurrence)],
    [
      'SourceAdmissionManifest',
      sourceAdmission.source_admission_manifest_id,
      sourceAdmission.canonical_payload_digest,
    ],
    ['SourceContent', source.source_content_id, digestObject('SOURCE_CONTENT', sourceContent)],
  ].map(([objectType, objectId, objectPayloadDigest], pathOrdinal) => ({
    object_type: objectType,
    object_id: objectId,
    object_payload_digest: objectPayloadDigest,
    path_ordinal: pathOrdinal,
  }));
}

function validateInputs({
  contract_bundle: contractBundle,
  row,
  source,
  source_admission: sourceAdmission,
  excerpt,
  claim,
  action_slot_key: actionSlotKey,
  evidence_ordinal: evidenceOrdinal,
}) {
  validateContractBundle(contractBundle);
  validateSharedServingRow(row);
  validateImmutableSource(source);
  validateExcerpt({ source, excerpt });
  validateFixtureSourceAdmission({
    source,
    admission: sourceAdmission,
    dealKey: row.governed_deal_key,
    dealAdmissionId: row.deal_admission_id,
    contractFingerprint: contractBundle.fingerprint,
  });
  validateClaimRevisionIdentity(claim);
  if (row.provenance.contract_fingerprint !== contractBundle.fingerprint) {
    throw new TypeError('row is outside the frozen exact-detail contract');
  }
  const component = row.canonical_result.components[0];
  const action = exactDetailAction(contractBundle, actionSlotKey);
  if (!Number.isInteger(evidenceOrdinal) || evidenceOrdinal < 0) {
    throw new TypeError('evidence_ordinal must be a non-negative integer');
  }
  const accuracyOnly = actionSlotKey === ACTION_SLOT_KEY;
  if (component.claim_occurrence_id !== claim.claim_occurrence_id
    || component.claim_revision_id !== claim.claim_revision_id
    || claim.state !== 'PRESENT'
    || !Array.isArray(claim.evidence)
    || claim.evidence.length === 0
    || (accuracyOnly && (
      claim.claim_definition_key !== 'REPRESENTATION_ACCURACY_STANDARD'
      || claim.evidence.length !== 1
      || evidenceOrdinal !== 0
    ))) {
    throw new TypeError('selected result component does not own the governed claim evidence edge');
  }
  const evidence = claim.evidence[evidenceOrdinal];
  if (!evidence) throw new TypeError('selected claim evidence ordinal is unavailable');
  if (evidence.excerpt_id !== excerpt.excerpt_id
    || evidence.absolute_start !== excerpt.absolute_start
    || evidence.absolute_end !== excerpt.absolute_end
    || evidence.document_ordinal !== sourceAdmission.source_ordinal) {
    throw new TypeError('claim evidence and source-backed excerpt do not agree');
  }
  if (row.source_actions.length !== 0
    || row.canonical_result.source_detail_state.state !== 'UNAVAILABLE') {
    throw new TypeError('exact detail may attach only to a validated base row');
  }
  return { action, component, evidence };
}

function buildFixtureClaimEvidenceDetailPackage({
  contract_bundle: contractBundle,
  row,
  source,
  source_admission: sourceAdmission,
  excerpt,
  claim,
  action_slot_key: actionSlotKey = ACTION_SLOT_KEY,
  evidence_ordinal: evidenceOrdinal = 0,
} = {}) {
  const { action, component, evidence } = validateInputs({
    contract_bundle: contractBundle,
    row,
    source,
    source_admission: sourceAdmission,
    excerpt,
    claim,
    action_slot_key: actionSlotKey,
    evidence_ordinal: evidenceOrdinal,
  });
  const governedOrdinal = 0;
  const contextualUseKey = contentId('RESULT_COMPONENT_CLAIM_EVIDENCE_CONTEXT/V1', {
    derived_result_occurrence_id: row.canonical_result.derived_result_occurrence_id,
    component_occurrence_id: component.component_occurrence_id,
    component_slot_key: component.component_slot_key,
    claim_occurrence_id: claim.claim_occurrence_id,
    evidence_ordinal: evidence.ordinal,
  });
  const orderedPath = sourcePath({ source, sourceAdmission, excerpt, claim, evidence });
  const sourceLineage = {
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
  const responseBody = {
    schema_version: action.response_schema,
    detail_kind: action.detail_kind,
    claim_occurrence_id: claim.claim_occurrence_id,
    claim_revision_id: claim.claim_revision_id,
    claim_evidence_id: evidence.claim_evidence_id,
    evidence_role: evidence.evidence_role,
    excerpt: {
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
    },
    source_lineage: sourceLineage,
  };
  const responseBodyDigest = contentId('SERVING_EXACT_DETAIL_RESPONSE_BODY/V1', responseBody);
  const sourceLineageDigest = contentId('SERVING_EXACT_DETAIL_SOURCE_LINEAGE/V1', sourceLineage);
  const encodedByteLength = utf8ByteLength(canonicalJson(responseBody));
  if (encodedByteLength > action.maximum_encoded_bytes) throw new TypeError('exact-detail response exceeds its frozen byte bound');
  const payloadBody = {
    schema_version: 'SERVING_EXACT_DETAIL_PAYLOAD/V1',
    corpus_release_id: row.corpus_release_id,
    action_definition_id: action.action_definition_id,
    detail_kind: action.detail_kind,
    contextual_use_key: contextualUseKey,
    terminal_object_type: 'CLAIM_EVIDENCE',
    terminal_object_id: evidence.claim_evidence_id,
    terminal_object_payload_digest: digestObject('CLAIM_EVIDENCE', evidence),
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

function baseRowFromAttached(row) {
  const body = clone(row);
  delete body.canonical_payload_digest;
  body.source_actions = [];
  const rowBody = body.row_kind === 'CANONICAL_RESULT'
    ? body.canonical_result
    : body.reviewed_source_specific;
  rowBody.source_detail_state = {
    state: 'UNAVAILABLE',
    reason_code: 'EXACT_DETAIL_PROJECTION_NOT_BUILT',
  };
  return {
    ...body,
    canonical_payload_digest: contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body),
  };
}

function openWorldSourcePath({ source, sourceAdmission, row, excerpts }) {
  const body = row.reviewed_source_specific;
  const head = [
    ['OpenWorldCandidateOccurrence', body.candidate_occurrence.open_world_candidate_occurrence_id,
      digestObject('OPEN_WORLD_CANDIDATE_OCCURRENCE', body.candidate_occurrence)],
    ['OpenWorldCandidateFinalDisposition', body.final_disposition.final_disposition_id,
      digestObject('OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION', body.final_disposition)],
    ['SemanticImpactClosure', body.semantic_impact_closure.semantic_impact_closure_id,
      digestObject('SEMANTIC_IMPACT_CLOSURE', body.semantic_impact_closure)],
  ];
  const evidencePath = excerpts.flatMap((excerpt, index) => {
    const evidence = body.evidence_references[index];
    const semanticSpan = {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: source.canonical_text_id,
      absolute_start: excerpt.absolute_start,
      absolute_end: excerpt.absolute_end,
      semantic_span_id: excerpt.ordered_component_assignments[0].semantic_span_id,
      exact_bytes_digest: excerpt.exact_bytes_digest,
    };
    return [
      ['OpenWorldEvidenceReference', evidence.evidence_reference_id,
        digestObject('OPEN_WORLD_EVIDENCE_REFERENCE', evidence)],
      ['Excerpt', excerpt.excerpt_id, digestObject('EXCERPT', excerpt)],
      ['SemanticSpan', semanticSpan.semantic_span_id, digestObject('SEMANTIC_SPAN', semanticSpan)],
    ];
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
  const tail = [
    ['CanonicalText', source.canonical_text_id, source.canonical_text_payload_digest],
    ['SourceOccurrence', source.source_occurrence_id, digestObject('SOURCE_OCCURRENCE', sourceOccurrence)],
    ['SourceAdmissionManifest', sourceAdmission.source_admission_manifest_id, sourceAdmission.canonical_payload_digest],
    ['SourceContent', source.source_content_id, digestObject('SOURCE_CONTENT', sourceContent)],
  ];
  return [...head, ...evidencePath, ...tail].map(
    ([objectType, objectId, objectPayloadDigest], pathOrdinal) => ({
      object_type: objectType,
      object_id: objectId,
      object_payload_digest: objectPayloadDigest,
      path_ordinal: pathOrdinal,
    }),
  );
}

function validateOpenWorldInputs({ contractBundle, row, source, sourceAdmission, excerpts }) {
  validateContractBundle(contractBundle);
  validateSharedServingRow(row);
  validateImmutableSource(source);
  if (row.row_kind !== 'REVIEWED_SOURCE_SPECIFIC') {
    throw new TypeError('open-world exact detail requires a reviewed source-specific row');
  }
  if (!Array.isArray(excerpts) || excerpts.length < 1 || excerpts.length > 16) {
    throw new TypeError('open-world exact detail requires a bounded excerpt set');
  }
  validateFixtureSourceAdmission({
    source,
    admission: sourceAdmission,
    dealKey: row.governed_deal_key,
    dealAdmissionId: row.deal_admission_id,
    contractFingerprint: contractBundle.fingerprint,
  });
  if (row.provenance.contract_fingerprint !== contractBundle.fingerprint
    || row.source_actions.length !== 0
    || row.reviewed_source_specific.source_detail_state.state !== 'UNAVAILABLE') {
    throw new TypeError('open-world exact detail may attach only to its validated base row');
  }
  const evidence = row.reviewed_source_specific.evidence_references;
  if (evidence.length !== excerpts.length) throw new TypeError('open-world evidence closure is incomplete');
  excerpts.forEach((excerpt, index) => {
    validateExcerpt({ source, excerpt });
    const reference = evidence[index];
    if (reference.excerpt_id !== excerpt.excerpt_id
      || reference.semantic_span_id !== excerpt.ordered_component_assignments[0].semantic_span_id
      || reference.document_hash !== source.document_hash
      || reference.absolute_start !== excerpt.absolute_start
      || reference.absolute_end !== excerpt.absolute_end
      || reference.exact_bytes_digest !== excerpt.exact_bytes_digest
      || reference.governed_ordinal !== index) {
      throw new TypeError('open-world evidence reference and exact source excerpt do not agree');
    }
  });
  const action = exactDetailAction(contractBundle, OPEN_WORLD_ACTION_SLOT_KEY);
  if (action.parent_kind !== 'REVIEWED_SOURCE_SPECIFIC_ROW' || action.detail_kind !== 'OPEN_WORLD_EVIDENCE') {
    throw new TypeError('open-world action is outside the frozen exact-detail contract');
  }
  return action;
}

function buildFixtureOpenWorldEvidenceDetailPackage({
  contract_bundle: contractBundle,
  row,
  source,
  source_admission: sourceAdmission,
  excerpts,
} = {}) {
  const action = validateOpenWorldInputs({ contractBundle, row, source, sourceAdmission, excerpts });
  const body = row.reviewed_source_specific;
  const governedOrdinal = 0;
  const contextualUseKey = contentId('REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE_CONTEXT/V1', {
    row_serving_key: row.row_serving_key,
    open_world_candidate_occurrence_id: body.candidate_occurrence.open_world_candidate_occurrence_id,
    final_disposition_id: body.final_disposition.final_disposition_id,
  });
  const orderedPath = openWorldSourcePath({ source, sourceAdmission, row, excerpts });
  const sourceLineage = {
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
  const responseBody = {
    schema_version: action.response_schema,
    detail_kind: action.detail_kind,
    open_world_candidate_occurrence_id: body.candidate_occurrence.open_world_candidate_occurrence_id,
    final_disposition_id: body.final_disposition.final_disposition_id,
    disposition_code: body.final_disposition.disposition_code,
    reviewed_display_label: body.reviewed_display_label,
    non_comparable_reason: body.non_comparable_reason,
    exact_excerpts: excerpts.map((excerpt, index) => ({
      evidence_reference_id: body.evidence_references[index].evidence_reference_id,
      evidence_role: body.evidence_references[index].evidence_role,
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
    })),
    source_lineage: sourceLineage,
  };
  const encodedByteLength = utf8ByteLength(canonicalJson(responseBody));
  if (encodedByteLength > action.maximum_encoded_bytes) throw new TypeError('open-world exact-detail response exceeds its frozen byte bound');
  const payloadBody = {
    schema_version: 'SERVING_EXACT_DETAIL_PAYLOAD/V1',
    corpus_release_id: row.corpus_release_id,
    action_definition_id: action.action_definition_id,
    detail_kind: action.detail_kind,
    contextual_use_key: contextualUseKey,
    terminal_object_type: 'OPEN_WORLD_EVIDENCE_CLOSURE',
    terminal_object_id: body.candidate_occurrence.open_world_candidate_occurrence_id,
    terminal_object_payload_digest: digestObject('REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE', responseBody),
    response_schema: action.response_schema,
    response_body: responseBody,
    response_body_digest: contentId('SERVING_EXACT_DETAIL_RESPONSE_BODY/V1', responseBody),
    source_lineage_digest: contentId('SERVING_EXACT_DETAIL_SOURCE_LINEAGE/V1', sourceLineage),
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
    schema_version: 'REVIEWED_SOURCE_SPECIFIC_ROW_SOURCE_DETAIL_EDGE/V1',
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
    parent_edge_id: contentId('REVIEWED_SOURCE_SPECIFIC_ROW_SOURCE_DETAIL_EDGE/V1', edgeBody),
    canonical_payload_digest: contentId('REVIEWED_SOURCE_SPECIFIC_ROW_SOURCE_DETAIL_EDGE_BODY/V1', edgeBody),
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
  attachedBody.reviewed_source_specific.source_detail_state = {
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

function validateFixtureOpenWorldExactDetailPackage({
  package: candidate,
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  excerpts,
} = {}) {
  requireExactKeys(candidate, PACKAGE_KEYS, 'open-world exact-detail package');
  if (candidate.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V1') throw new TypeError('invalid open-world exact-detail package schema');
  for (const [key, values] of Object.entries({
    action_definitions: candidate.action_definitions,
    detail_payloads: candidate.detail_payloads,
    references: candidate.references,
    parent_edges: candidate.parent_edges,
  })) {
    if (!Array.isArray(values) || values.length !== 1) throw new TypeError(`${key} must contain exactly one governed object`);
  }
  validateSharedServingRow(candidate.row);
  if (candidate.row.row_kind !== 'REVIEWED_SOURCE_SPECIFIC') throw new TypeError('open-world exact detail has the wrong row kind');
  const actionTuple = candidate.row.source_actions[0];
  const reference = candidate.references[0];
  const payload = candidate.detail_payloads[0];
  const edge = candidate.parent_edges[0];
  if (!actionTuple
    || actionTuple.detail_kind !== 'OPEN_WORLD_EVIDENCE'
    || actionTuple.source_detail_reference_id !== reference.source_detail_reference_id
    || actionTuple.source_detail_payload_id !== payload.source_detail_payload_id
    || actionTuple.parent_edge_id !== edge.parent_edge_id
    || edge.parent_row_serving_key !== candidate.row.row_serving_key
    || reference.parent_row_serving_key !== candidate.row.row_serving_key
    || reference.source_detail_payload_id !== payload.source_detail_payload_id) {
    throw new TypeError('open-world exact-detail graph is not atomically closed');
  }
  const expected = buildFixtureOpenWorldEvidenceDetailPackage({
    contract_bundle: contractBundle,
    row: baseRowFromAttached(candidate.row),
    source,
    source_admission: sourceAdmission,
    excerpts,
  });
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('open-world exact-detail identity, path or source lineage mismatch');
  }
  return true;
}

function validateFixtureExactDetailPackage({
  package: candidate,
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  excerpt,
  claim,
  excerpts,
} = {}) {
  if (candidate?.row?.row_kind === 'REVIEWED_SOURCE_SPECIFIC') {
    return validateFixtureOpenWorldExactDetailPackage({
      package: candidate,
      contract_bundle: contractBundle,
      source,
      source_admission: sourceAdmission,
      excerpts,
    });
  }
  requireExactKeys(candidate, PACKAGE_KEYS, 'exact-detail package');
  if (candidate.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V1') throw new TypeError('invalid exact-detail package schema');
  for (const [key, values] of Object.entries({
    action_definitions: candidate.action_definitions,
    detail_payloads: candidate.detail_payloads,
    references: candidate.references,
    parent_edges: candidate.parent_edges,
  })) {
    if (!Array.isArray(values) || values.length !== 1) throw new TypeError(`${key} must contain exactly one governed object`);
  }
  validateSharedServingRow(candidate.row);
  const actionTuple = candidate.row.source_actions[0];
  const reference = candidate.references[0];
  const payload = candidate.detail_payloads[0];
  const edge = candidate.parent_edges[0];
  if (!actionTuple
    || actionTuple.source_detail_reference_id !== reference.source_detail_reference_id
    || actionTuple.source_detail_payload_id !== payload.source_detail_payload_id
    || actionTuple.parent_edge_id !== edge.parent_edge_id
    || edge.parent_row_serving_key !== candidate.row.row_serving_key
    || edge.source_detail_reference_id !== reference.source_detail_reference_id
    || edge.source_detail_payload_id !== payload.source_detail_payload_id
    || reference.parent_row_serving_key !== candidate.row.row_serving_key
    || reference.source_detail_payload_id !== payload.source_detail_payload_id) {
    throw new TypeError('exact-detail row, reference, payload and parent edge are not a closed atomic graph');
  }
  const expected = buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: contractBundle,
    row: baseRowFromAttached(candidate.row),
    source,
    source_admission: sourceAdmission,
    excerpt,
    claim,
    action_slot_key: actionTuple.action_slot_key,
    evidence_ordinal: claim.evidence.findIndex(
      (evidence) => evidence.claim_evidence_id === payload.response_body.claim_evidence_id,
    ),
  });
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('exact-detail package identity, path or source lineage mismatch');
  }
  return true;
}

module.exports = {
  ACTION_SLOT_KEY,
  GENERAL_ACTION_SLOT_KEY,
  OPEN_WORLD_ACTION_SLOT_KEY,
  buildFixtureClaimEvidenceDetailPackage,
  buildFixtureOpenWorldEvidenceDetailPackage,
  validateFixtureExactDetailPackage,
  validateFixtureOpenWorldExactDetailPackage,
};
