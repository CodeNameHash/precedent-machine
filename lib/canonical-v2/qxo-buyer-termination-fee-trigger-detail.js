const { canonicalJson, contentId, utf8ByteLength } = require('./canonical-bytes');
const { buildAdmittedSourceReference } = require('./admitted-semantic-source');
const { validateRelationshipRevisionIdentity } = require('./claims-relationships');
const { validateContractBundle } = require('./contract-bundle');
const { validateSharedServingRow } = require('./shared-serving-row');
const { validateExcerpt } = require('./source-structure');
const {
  triggerPathSchemaForBinding,
  validateTerminationFeeTriggerEffect,
} = require('./termination-fee-trigger-path');

const ACTION_SLOT_KEY = 'TERMINATION_FEE_TRIGGER_EVIDENCE';
const EXPECTED_TRIGGER_COUNT = 6;
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

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the termination-fee trigger detail contract`);
  }
}

function digestObject(domain, value) {
  return contentId(`${domain}_PAYLOAD/V1`, value);
}

function sourceAdmissionPayloadDigest(sourceAdmission) {
  const body = { ...sourceAdmission };
  delete body.source_admission_manifest_id;
  return contentId('SOURCE_ADMISSION_MANIFEST_PAYLOAD/V2', body);
}

function actionDefinition(contractBundle) {
  const action = contractBundle.serving_exact_detail_action_definitions.find(
    (entry) => entry.action_slot_key === ACTION_SLOT_KEY,
  );
  const legacyV1 = action
    && action.action_version === 1
    && action.selection_path_schema === 'RESULT_TERMINATION_FEE_TRIGGER_SET/V1'
    && action.response_schema === 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V1'
    && action.projection_version === 1;
  const governedV2 = action
    && action.action_version === 2
    && action.selection_path_schema === 'RESULT_TERMINATION_FEE_TRIGGER_SET/V2'
    && action.response_schema === 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V2'
    && action.projection_version === 2;
  if (!action
    || action.parent_kind !== 'RESULT_ROW'
    || action.detail_kind !== 'TERMINATION_FEE_TRIGGER_EVIDENCE'
    || (!legacyV1 && !governedV2)
    || action.contextual_cardinality !== 'EXACTLY_ONE'
    || action.comparator !== 'RELATIONSHIP_ORDINAL_THEN_SOURCE_ORDER'
    || action.maximum_references !== 1
    || (action.maximum_encoded_bytes !== 16384
      && !(governedV2 && action.maximum_encoded_bytes === 32768))
    || action.whole_document_permission !== false
    || action.object_authorisation_predicate !== 'PARENT_SELECTED_TERMINATION_FEE_TRIGGER_SET_ONLY'
    || action.route !== 'INLINE_BATCH'
    ) {
    throw new TypeError('the frozen termination-fee trigger evidence action is unavailable');
  }
  return action;
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
    throw new TypeError('admitted source and admission lineage do not close exactly');
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
    throw new TypeError('admitted source, release row and frozen contract do not agree');
  }
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
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    exact_bytes_digest: excerpt.exact_bytes_digest,
    exact_text: excerpt.exact_text,
  };
}

function sourceOrder(left, right) {
  return left.absolute_start - right.absolute_start
    || left.absolute_end - right.absolute_end
    || left.excerpt_id.localeCompare(right.excerpt_id);
}

function triggerProjection(relationship) {
  return {
    relationship_occurrence_id: relationship.relationship_occurrence_id,
    relationship_revision_id: relationship.relationship_revision_id,
    relationship_ordinal: relationship.ordinal,
    target_occurrence_ids: [...relationship.target_occurrence_ids],
    effect: clone(relationship.effect),
    evidence_references: relationship.evidence.map((edge) => ({
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
    })),
  };
}

function validateInputs({
  contractBundle,
  row,
  source,
  sourceAdmission,
  relationships,
  excerpts,
}) {
  validateContractBundle(contractBundle);
  validateSharedServingRow(row);
  validateAdmittedPair({ source, sourceAdmission, row, contractBundle });
  const action = actionDefinition(contractBundle);
  const result = row.canonical_result;
  const component = result?.components?.[0];
  const metricOperationBinding = contractBundle.serving_metric_operation_bindings?.find(
    (binding) => binding.required_claim_definition_key === component?.claim_definition_key
      && binding.concept_key === result?.concept_key,
  ) || null;
  if (row.row_kind !== 'CANONICAL_RESULT'
    || row.source_actions.length !== 0
    || result.source_detail_state.state !== 'UNAVAILABLE'
    || result.components.length !== 1
    || !metricOperationBinding
    || canonicalJson(result.party) !== canonicalJson(metricOperationBinding.payer)) {
    throw new TypeError('termination-fee trigger detail requires one contract-bound base fee result row');
  }
  const triggerPathSchema = metricOperationBinding.trigger_path_schema_key
    ? triggerPathSchemaForBinding(contractBundle, metricOperationBinding)
    : null;
  if (!Array.isArray(relationships)
    || relationships.length < 1
    || relationships.length > (triggerPathSchema?.maximum_paths || EXPECTED_TRIGGER_COUNT)
    || (!triggerPathSchema && relationships.length !== EXPECTED_TRIGGER_COUNT)) {
    throw new TypeError(
      triggerPathSchema
        ? `termination-fee trigger detail requires between 1 and ${triggerPathSchema.maximum_paths} governed relationships`
        : 'legacy termination-fee trigger detail requires exactly six relationships',
    );
  }
  const orderedRelationships = [...relationships].sort((left, right) => (
    left.ordinal - right.ordinal
      || left.relationship_revision_id.localeCompare(right.relationship_revision_id)
  ));
  orderedRelationships.forEach((relationship, ordinal) => {
    validateRelationshipRevisionIdentity(relationship);
    if (relationship.ordinal !== ordinal
      || relationship.relationship_definition_key !== 'TRIGGERED_BY'
      || relationship.state !== 'PRESENT'
      || relationship.effect?.effect_mode !== 'TYPED_LEGAL_EFFECT'
      || relationship.effect?.legal_operation !== metricOperationBinding.legal_operation
      || relationship.target_occurrence_ids.length !== 1
      || relationship.evidence.length < 2) {
      throw new TypeError('termination-fee trigger relationship is incomplete');
    }
    if (triggerPathSchema) {
      validateTerminationFeeTriggerEffect(relationship.effect, {
        binding: metricOperationBinding,
        schema: triggerPathSchema,
      });
    }
  });
  const rowEffects = component.bounded_relationship_effects.map((entry) => ({
    relationship_revision_id: entry.relationship_revision_id,
    relationship_definition_key: entry.relationship_definition_key,
    state: entry.state,
    effect: entry.effect,
  })).sort((left, right) => left.relationship_revision_id.localeCompare(right.relationship_revision_id));
  const suppliedEffects = orderedRelationships.map((relationship) => ({
    relationship_revision_id: relationship.relationship_revision_id,
    relationship_definition_key: relationship.relationship_definition_key,
    state: relationship.state,
    effect: relationship.effect,
  })).sort((left, right) => left.relationship_revision_id.localeCompare(right.relationship_revision_id));
  if (canonicalJson(rowEffects) !== canonicalJson(suppliedEffects)) {
    throw new TypeError('termination-fee trigger set does not match its parent row');
  }
  if (!Array.isArray(excerpts) || excerpts.length < EXPECTED_TRIGGER_COUNT + 1 || excerpts.length > 16) {
    throw new TypeError('termination-fee trigger detail requires a bounded excerpt set');
  }
  const orderedExcerpts = [...excerpts].sort(sourceOrder);
  const excerptsById = new Map();
  orderedExcerpts.forEach((excerpt) => {
    validateExcerpt({ source, excerpt });
    if (excerptsById.has(excerpt.excerpt_id)) {
      throw new TypeError('termination-fee trigger evidence excerpts must be unique');
    }
    excerptsById.set(excerpt.excerpt_id, excerpt);
  });
  const requiredExcerptIds = [...new Set(orderedRelationships.flatMap(
    (relationship) => relationship.evidence.map((edge) => edge.excerpt_id),
  ))].sort();
  if (canonicalJson(requiredExcerptIds) !== canonicalJson([...excerptsById.keys()].sort())) {
    throw new TypeError('termination-fee trigger evidence excerpt closure is incomplete');
  }
  for (const relationship of orderedRelationships) {
    for (const edge of relationship.evidence) {
      const excerpt = excerptsById.get(edge.excerpt_id);
      if (!excerpt
        || edge.document_ordinal !== source.source_ordinal
        || edge.absolute_start !== excerpt.absolute_start
        || edge.absolute_end !== excerpt.absolute_end) {
        throw new TypeError('termination-fee trigger evidence edge is not source-backed');
      }
    }
  }
  return {
    action,
    component,
    orderedRelationships,
    orderedExcerpts,
  };
}

function orderedPath({ source, sourceAdmission, relationships, excerpts }) {
  const path = [];
  for (const relationship of relationships) {
    path.push([
      'RelationshipRevision',
      relationship.relationship_revision_id,
      digestObject('RELATIONSHIP_REVISION', relationship),
    ]);
    for (const evidence of relationship.evidence) {
      path.push([
        'RelationshipEvidence',
        evidence.relationship_evidence_id,
        digestObject('RELATIONSHIP_EVIDENCE', evidence),
      ]);
    }
  }
  for (const excerpt of excerpts) {
    path.push(['Excerpt', excerpt.excerpt_id, digestObject('EXCERPT', excerpt)]);
    const semanticSpan = {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: source.canonical_text_id,
      absolute_start: excerpt.absolute_start,
      absolute_end: excerpt.absolute_end,
      semantic_span_id: excerpt.ordered_component_assignments[0].semantic_span_id,
      exact_bytes_digest: excerpt.exact_bytes_digest,
    };
    path.push([
      'SemanticSpan',
      semanticSpan.semantic_span_id,
      digestObject('SEMANTIC_SPAN', semanticSpan),
    ]);
  }
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
  path.push(
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
  return path.map(([objectType, objectId, objectPayloadDigest], pathOrdinal) => ({
    object_type: objectType,
    object_id: objectId,
    object_payload_digest: objectPayloadDigest,
    path_ordinal: pathOrdinal,
  }));
}

function attachPackage({ row, action, detailPayload, reference, parentEdge }) {
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
    governed_ordinal: 0,
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
  return attachedRow;
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

function buildQxoBuyerTerminationFeeTriggerDetailPackage({
  contract_bundle: contractBundle,
  row,
  source,
  source_admission: sourceAdmission,
  relationships,
  excerpts,
} = {}) {
  const {
    action,
    component,
    orderedRelationships,
    orderedExcerpts,
  } = validateInputs({
    contractBundle,
    row,
    source,
    sourceAdmission,
    relationships,
    excerpts,
  });
  const relationshipSetBody = {
    relationship_revision_ids: orderedRelationships.map((item) => item.relationship_revision_id),
    relationship_effect_digests: orderedRelationships.map(
      (item) => contentId('RELATIONSHIP_EFFECT/V1', item.effect),
    ),
    relationship_evidence_ids: orderedRelationships.flatMap((item) => item.evidence_ids),
  };
  const relationshipSetId = contentId('TERMINATION_FEE_TRIGGER_SET/V1', relationshipSetBody);
  const contextualUseKey = contentId('TERMINATION_FEE_TRIGGER_EVIDENCE_CONTEXT/V1', {
    derived_result_occurrence_id: row.canonical_result.derived_result_occurrence_id,
    component_occurrence_id: component.component_occurrence_id,
    relationship_set_digest: component.relationship_set_digest,
    relationship_set_id: relationshipSetId,
  });
  const lineage = sourceLineage(source, sourceAdmission, contractBundle);
  const responseBody = {
    schema_version: action.response_schema,
    detail_kind: action.detail_kind,
    derived_result_occurrence_id: row.canonical_result.derived_result_occurrence_id,
    component_occurrence_id: component.component_occurrence_id,
    relationship_set_digest: component.relationship_set_digest,
    trigger_count: orderedRelationships.length,
    triggers: orderedRelationships.map(triggerProjection),
    excerpts: orderedExcerpts.map(excerptProjection),
    source_lineage: lineage,
  };
  const encodedByteLength = utf8ByteLength(canonicalJson(responseBody));
  if (encodedByteLength > action.maximum_encoded_bytes) {
    throw new TypeError(`termination-fee trigger detail is ${encodedByteLength} bytes and exceeds its frozen byte bound`);
  }
  const payloadBody = {
    schema_version: 'SERVING_EXACT_DETAIL_PAYLOAD/V1',
    corpus_release_id: row.corpus_release_id,
    action_definition_id: action.action_definition_id,
    detail_kind: action.detail_kind,
    contextual_use_key: contextualUseKey,
    terminal_object_type: 'RELATIONSHIP_SET',
    terminal_object_id: relationshipSetId,
    terminal_object_payload_digest: contentId(
      'TERMINATION_FEE_TRIGGER_SET_PAYLOAD/V1',
      relationshipSetBody,
    ),
    response_schema: action.response_schema,
    response_body: responseBody,
    response_body_digest: contentId('SERVING_EXACT_DETAIL_RESPONSE_BODY/V1', responseBody),
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
    ordered_path: orderedPath({
      source,
      sourceAdmission,
      relationships: orderedRelationships,
      excerpts: orderedExcerpts,
    }),
    source_detail_payload_id: detailPayload.source_detail_payload_id,
    multiplicity_digest: multiplicityDigest,
    governed_ordinal: 0,
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
    governed_ordinal: 0,
  };
  const parentEdge = {
    ...edgeBody,
    parent_edge_id: contentId('RESULT_ROW_SOURCE_DETAIL_EDGE/V1', edgeBody),
    canonical_payload_digest: contentId('RESULT_ROW_SOURCE_DETAIL_EDGE_BODY/V1', edgeBody),
  };
  const attachedRow = attachPackage({
    row,
    action,
    detailPayload,
    reference,
    parentEdge,
  });
  return freeze({
    schema_version: 'EXACT_DETAIL_ATOMIC_PACKAGE/V1',
    row: attachedRow,
    action_definitions: [action],
    detail_payloads: [detailPayload],
    references: [reference],
    parent_edges: [parentEdge],
  });
}

function validateQxoBuyerTerminationFeeTriggerDetailPackage({
  package: candidate,
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  relationships,
  excerpts,
} = {}) {
  requireExactKeys(candidate, PACKAGE_KEYS, 'termination-fee trigger exact-detail package');
  if (candidate.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V1'
    || candidate.action_definitions.length !== 1
    || candidate.detail_payloads.length !== 1
    || candidate.references.length !== 1
    || candidate.parent_edges.length !== 1) {
    throw new TypeError('termination-fee trigger exact-detail package is incomplete');
  }
  const expected = buildQxoBuyerTerminationFeeTriggerDetailPackage({
    contract_bundle: contractBundle,
    row: baseRowFromAttached(candidate.row),
    source,
    source_admission: sourceAdmission,
    relationships,
    excerpts,
  });
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('termination-fee trigger exact-detail identity or source closure mismatch');
  }
  return true;
}

module.exports = {
  ACTION_SLOT_KEY,
  buildQxoBuyerTerminationFeeTriggerDetailPackage,
  validateQxoBuyerTerminationFeeTriggerDetailPackage,
};
