const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
  compileProcessPassageOrder,
} = require('./process-passage-order');
const {
  buildProcessPhrasebookResultIdentity,
} = require('./process-phrasebook-result');
const {
  PROCESS_NARRATION_REVISION_SCHEMA,
  PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
  PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
  compileProcessPhrasebookResultAdmission,
} = require('./process-phrasebook-result-admission');
const {
  MATERIALISATION_RECEIPT_SCHEMA,
} = require('./process-exclusivity-pilot');
const {
  METSERA_STAGING_PILOT_SCHEMA,
  SELECTED_PASSAGE_ID,
} = require('./metsera-exclusivity-staging-pilot');

const METSERA_PRODUCT_ADMISSION_SCHEMA =
  'METSERA_EXCLUSIVITY_PRODUCT_ADMISSION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const AUTHORITY_LIMITS = Object.freeze({
  query: 'NONE',
  source_read: 'NONE',
  extraction: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera Product admission: ${message}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function without(value, key) {
  const body = clone(value);
  delete body[key];
  return body;
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(`${label} must be a lower-case SHA-256 digest`);
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(`${label} does not have the exact required fields`);
  }
}

function addContentId(schema, idField, body) {
  return {
    schema_version: body.schema_version,
    [idField]: contentId(schema, body),
    ...body,
  };
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function validatePilotReceipt(pilotReceipt) {
  requireExactKeys(pilotReceipt, [
    'schema_version',
    'selected_passage_id',
    'sealed_source_count',
    'sealed_passage_count',
    'retained_scope_residual_count',
    'acquisition_receipt_id',
    'sec_completeness_receipt_id',
    'scope_receipt_id',
    'candidate_graph_id',
    'candidate_validation_receipt_id',
    'materialisation_receipt_id',
    'pipeline_receipt',
    'authority_limits',
  ], 'Metsera staging-pilot receipt');
  if (
    pilotReceipt.schema_version !== METSERA_STAGING_PILOT_SCHEMA
    || pilotReceipt.selected_passage_id !== SELECTED_PASSAGE_ID
    || pilotReceipt.sealed_source_count !== 9
    || pilotReceipt.sealed_passage_count !== 8
    || pilotReceipt.retained_scope_residual_count !== 7
    || Object.values(pilotReceipt.authority_limits).some(
      (value) => value !== 'NONE',
    )
  ) {
    fail('the sealed staging-pilot receipt is not the admitted pilot');
  }
  const sibling = pilotReceipt.pipeline_receipt?.siblings?.[0];
  const materialisation = sibling
    ?.process_exclusivity_pilot_materialisation_receipt;
  if (
    sibling?.failure !== null
    || materialisation?.schema_version !== MATERIALISATION_RECEIPT_SCHEMA
    || materialisation.materialisation_receipt_id
      !== pilotReceipt.materialisation_receipt_id
    || materialisation.materialisation_state !== 'VALIDATED_SIDECAR_ONLY'
    || materialisation.authority_state !== 'NOT_GRANTED'
    || Object.values(materialisation.authority_limits).some(
      (value) => value !== 'NONE',
    )
    || materialisation.materialisation_receipt_id !== contentId(
      MATERIALISATION_RECEIPT_SCHEMA,
      without(materialisation, 'materialisation_receipt_id'),
    )
  ) {
    fail('the Process materialisation receipt is missing or changed');
  }
  return materialisation;
}

function validateReleaseBinding(binding) {
  requireExactKeys(binding, [
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'product_query_definition_id',
    'validation_receipt_ids',
    'release_state',
    'authority_state',
  ], 'Candidate release binding');
  [
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'product_query_definition_id',
  ].forEach((key) => requireDigest(binding[key], `Release binding ${key}`));
  requireExactKeys(binding.validation_receipt_ids, [
    'narration_revision',
    'predicate_witness_revision',
    'result_input_lineage',
    'preview',
    'ordering_fact',
    'release_membership',
    'exact_detail',
  ], 'Candidate release validation receipts');
  Object.entries(binding.validation_receipt_ids).forEach(([key, value]) => {
    requireDigest(value, `Validation receipt ${key}`);
  });
  if (
    binding.release_state !== 'CANDIDATE_NOT_ACTIVE'
    || binding.authority_state !== 'NOT_GRANTED'
  ) {
    fail('the candidate release binding grants authority');
  }
}

function releaseFields(binding) {
  return {
    candidate_release_manifest_id:
      binding.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      binding.candidate_release_manifest_payload_digest,
    corpus_release_id: binding.corpus_release_id,
  };
}

function selectedMaterialisationValues(materialisation) {
  const occurrence = materialisation.identities?.narration_occurrences?.[0];
  const narration = materialisation.revisions?.narration_revisions?.[0];
  const witnessIdentity =
    materialisation.identities?.predicate_witnesses?.[0];
  const witness =
    materialisation.revisions?.predicate_witness_revisions?.[0];
  const passage = materialisation.revisions?.passage_revisions?.[0];
  const bidderTrack = materialisation.identities?.bidder_tracks?.[0];
  if (
    !occurrence
    || !narration
    || !witnessIdentity
    || !witness
    || !passage
    || !bidderTrack
    || witness.predicate_key !== 'EXCLUSIVITY_GRANTED'
    || witness.predicate_state !== 'PRESENT'
    || witness.source_semantic_kind !== 'GRANT'
    || passage.passage_role_codes.length !== 1
    || passage.passage_role_codes[0] !== 'PROCESS_NARRATION'
    || narration.evidence_edges.length !== 1
    || narration.evidence_edges[0].evidence_role_key
      !== 'EXCLUSIVITY_GRANTED'
    || !witness.evidence_edges.some(
      (edge) => edge.evidence_role_key === 'EXCLUSIVITY_GRANTED',
    )
  ) {
    fail('the selected sidecar is not the exact narration-backed grant');
  }
  return {
    occurrence,
    narration,
    witnessIdentity,
    witness,
    passage,
    bidderTrack,
  };
}

function sourceInterval(edge) {
  return {
    admitted_source_occurrence_id: edge.admitted_source_occurrence_id,
    document_hash: edge.document_hash,
    document_ordinal: edge.document_ordinal,
    start_utf8_byte: edge.start_utf8_byte,
    end_utf8_byte: edge.end_utf8_byte,
    exact_text_digest: edge.exact_text_digest,
  };
}

function buildNarrationRevision(
  selected,
  release,
  validationReceiptId,
) {
  const value = selected.narration;
  return {
    schema_version: PROCESS_NARRATION_REVISION_SCHEMA,
    process_narration_revision_id: value.process_narration_revision_id,
    process_narration_occurrence: selected.occurrence,
    claim_revision_ids: value.claim_revision_ids,
    evidence_edges: value.evidence_edges,
    relationship_revision_ids: value.relationship_revision_ids,
    revision_status: value.revision_status,
    source_backed_attributes: value.source_backed_attributes,
    conflict_state: 'NO_CONFLICT',
    ...release,
    revision_validation_receipt_id: validationReceiptId,
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
}

function witnessIdentityPayload(value) {
  return {
    applicability_evidence_edges: value.applicability_evidence_edges,
    atomic_response_predicate_key: value.atomic_response_predicate_key,
    atomic_response_predicate_witness_revision_id:
      value.atomic_response_predicate_witness_revision_id,
    bidder_track_revision_id: value.bidder_track_revision_id,
    complete_scope_evidence_edges: value.complete_scope_evidence_edges,
    complete_scope_identity: value.complete_scope_identity,
    complete_scope_payload: value.complete_scope_payload,
    dimension_revision_bindings: value.dimension_revision_bindings,
    evidence_edges: value.evidence_edges,
    failure_detail: value.failure_detail,
    predicate_key: value.predicate_key,
    predicate_state: value.predicate_state,
    process_agreement_revision_ids: value.process_agreement_revision_ids,
    process_event_revision_id: value.process_event_revision_id,
    process_participant_revision_ids:
      value.process_participant_revision_ids,
    process_passage_revision_ids: value.process_passage_revision_ids,
    process_position_revision_ids: value.process_position_revision_ids,
    process_predicate_witness_id:
      value.process_predicate_witness_identity
        .process_predicate_witness_id,
    process_relationship_revision_ids:
      value.process_relationship_revision_ids,
    source_semantic_kind: value.source_semantic_kind,
    subject_code: value.subject_code,
    temporal_expression_revision_ids:
      value.temporal_expression_revision_ids,
  };
}

function buildWitnessRevision(
  selected,
  release,
  validationReceiptId,
) {
  const value = selected.witness;
  const body = {
    schema_version: PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
    process_predicate_witness_identity: selected.witnessIdentity,
    applicability_evidence_edges: value.applicability_evidence_edges,
    atomic_response_predicate_key: value.atomic_response_predicate_key,
    atomic_response_predicate_witness_revision_id:
      value.atomic_response_predicate_witness_revision_id,
    bidder_track_revision_id: value.bidder_track_revision_id,
    complete_scope_evidence_edges: value.complete_scope_evidence_edges,
    complete_scope_identity: value.complete_scope_identity,
    complete_scope_payload: value.complete_scope_payload,
    evidence_edges: value.evidence_edges,
    failure_detail: value.failure_detail,
    predicate_key: value.predicate_key,
    predicate_state: value.predicate_state,
    process_agreement_revision_ids: value.process_agreement_revision_ids,
    process_event_revision_id: value.process_event_revision_id,
    process_participant_revision_ids:
      value.process_participant_revision_ids,
    process_passage_revision_ids: value.process_passage_revision_ids,
    process_position_revision_ids: value.process_position_revision_ids,
    process_relationship_revision_ids:
      value.process_relationship_revision_ids,
    source_semantic_kind: value.source_semantic_kind,
    subject_code: value.subject_code,
    temporal_expression_revision_ids:
      value.temporal_expression_revision_ids,
    dimension_revision_bindings: value.dimension_revision_bindings.map(
      (binding) => ({
        ...binding,
        validation_state: 'EXTERNALLY_VALIDATED',
      }),
    ),
    ...release,
    revision_validation_receipt_id: validationReceiptId,
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    predicate_witness_revision_id: contentId(
      PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
      witnessIdentityPayload(body),
    ),
    ...body,
  };
}

function buildLineage(
  resultIdentity,
  narration,
  witness,
  release,
  validationReceiptId,
) {
  const body = {
    schema_version: PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
    process_phrasebook_passage_result_id:
      resultIdentity.process_phrasebook_passage_result_id,
    ...release,
    terminal_bindings: [
      {
        terminal_type: 'PROCESS_NARRATION_REVISION',
        stable_occurrence_id:
          narration.process_narration_occurrence
            .process_narration_occurrence_id,
        selected_revision_id: narration.process_narration_revision_id,
        canonical_payload_digest: payloadDigest(narration),
        evidence_edge_ids: narration.evidence_edges
          .map((edge) => edge.evidence_edge_id)
          .sort(),
      },
      {
        terminal_type: 'PREDICATE_WITNESS_REVISION',
        stable_occurrence_id:
          witness.process_predicate_witness_identity
            .process_predicate_witness_id,
        selected_revision_id: witness.predicate_witness_revision_id,
        canonical_payload_digest: payloadDigest(witness),
        evidence_edge_ids: witness.evidence_edges
          .map((edge) => edge.evidence_edge_id)
          .sort(),
      },
    ],
    retelling_relationship_revision_ids:
      narration.relationship_revision_ids,
    predicate_dimension_revision_bindings_digest:
      payloadDigest(witness.dimension_revision_bindings),
    lineage_validation_receipt_id: validationReceiptId,
    completeness_state: 'COMPLETE',
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
    'result_input_lineage_id',
    body,
  );
}

function buildExactDetail(
  resultIdentity,
  narration,
  edge,
  release,
  validationReceiptId,
) {
  const body = {
    schema_version:
      PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
    process_phrasebook_passage_result_id:
      resultIdentity.process_phrasebook_passage_result_id,
    ...release,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    source_interval: sourceInterval(edge),
    source_local_narration_id:
      narration.process_narration_occurrence
        .process_narration_occurrence_id,
    human_readable_source_label:
      'Metsera DEFM14A, Background of the Merger, 17 August 2025',
    exact_detail_action: {
      stable_id: 'PROCESS_NARRATION_EVIDENCE',
      version: 1,
    },
    reference_validation_receipt_id: validationReceiptId,
    validation_state: 'EXTERNALLY_VALIDATED',
    object_authorisation_state: 'REQUIRED_BEFORE_USE',
    execution_authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
    'exact_detail_reference_id',
    body,
  );
}

function buildPreview(
  resultIdentity,
  narration,
  edge,
  exactDetail,
  selected,
  release,
  validationReceiptId,
) {
  const verbatimText = narration.source_backed_attributes.verbatim_text;
  const body = {
    schema_version: PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
    process_phrasebook_passage_result_id:
      resultIdentity.process_phrasebook_passage_result_id,
    ...release,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    canonical_text_digest: selected.passage.source_text_digest,
    exact_source_interval: sourceInterval(edge),
    evidence_role_key: resultIdentity.exact_evidence_role_slot_key,
    source_local_narration_id:
      narration.process_narration_occurrence
        .process_narration_occurrence_id,
    segmentation_projection_id:
      selected.passage.process_passage_revision_id,
    verbatim_text: verbatimText,
    verbatim_text_digest: sha256Hex(Buffer.from(verbatimText, 'utf8')),
    truncation_state: 'COMPLETE',
    exact_detail_reference_id: exactDetail.exact_detail_reference_id,
    preview_validation_receipt_id: validationReceiptId,
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
    'preview_id',
    body,
  );
}

function bidderTrackId(selected) {
  return selected.bidderTrack.bidder_track_id
    || selected.bidderTrack.process_bidder_track_id
    || selected.bidderTrack.stable_id;
}

function buildOrdering(
  resultIdentity,
  occurrence,
  selected,
  binding,
) {
  const body = {
    schema_version: PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    result_identity: resultIdentity,
    selected_narration_occurrence: occurrence,
    bidder_track_id: requireDigest(
      bidderTrackId(selected),
      'Bidder-track identity',
    ),
    narration_treatment: 'SOURCE_LOCAL_PRIMARY_NARRATION',
    candidate_release_manifest_id:
      binding.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      binding.candidate_release_manifest_payload_digest,
    external_validation_receipt_id:
      binding.validation_receipt_ids.ordering_fact,
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  const fact = addContentId(
    PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    'ordering_fact_id',
    body,
  );
  return compileProcessPassageOrder({
    product_query_definition_id: binding.product_query_definition_id,
    candidate_release_manifest_id:
      binding.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      binding.candidate_release_manifest_payload_digest,
    page_size: 8,
    ordering_facts: [fact],
  });
}

function buildMembership(
  resultIdentity,
  narration,
  witness,
  lineage,
  preview,
  ordering,
  exactDetail,
  release,
  validationReceiptId,
) {
  const body = {
    schema_version:
      PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
    process_phrasebook_passage_result_id:
      resultIdentity.process_phrasebook_passage_result_id,
    result_identity_payload_digest:
      resultIdentity.canonical_payload_digest,
    process_narration_revision_id:
      narration.process_narration_revision_id,
    predicate_witness_revision_id:
      witness.predicate_witness_revision_id,
    result_input_lineage_id: lineage.result_input_lineage_id,
    matched_passage_preview_id: preview.preview_id,
    ordering_projection_id: ordering.ordering_projection_id,
    exact_detail_reference_id: exactDetail.exact_detail_reference_id,
    ...release,
    source_document_identity: preview.source_document_identity,
    membership_validation_receipt_id: validationReceiptId,
    membership_state: 'CANDIDATE_MEMBER',
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
    'release_membership_id',
    body,
  );
}

function buildAdmissionInput(pilotReceipt, binding) {
  const materialisation = validatePilotReceipt(pilotReceipt);
  validateReleaseBinding(binding);
  const selected = selectedMaterialisationValues(materialisation);
  const release = releaseFields(binding);
  const resultIdentity = buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest:
      materialisation.frozen_contract_pair_digest,
    governed_deal_admission_id:
      materialisation.governed_deal_admission_id,
    precomputed_process_narration_occurrence_id:
      selected.occurrence.process_narration_occurrence_id,
    exact_evidence_role_slot_key:
      selected.witnessIdentity.predicate_evidence_role_slot_key,
    governed_ordinal: selected.occurrence.governed_ordinal,
  });
  const narration = buildNarrationRevision(
    selected,
    release,
    binding.validation_receipt_ids.narration_revision,
  );
  const witness = buildWitnessRevision(
    selected,
    release,
    binding.validation_receipt_ids.predicate_witness_revision,
  );
  const lineage = buildLineage(
    resultIdentity,
    narration,
    witness,
    release,
    binding.validation_receipt_ids.result_input_lineage,
  );
  const edge = narration.evidence_edges[0];
  const exactDetail = buildExactDetail(
    resultIdentity,
    narration,
    edge,
    release,
    binding.validation_receipt_ids.exact_detail,
  );
  const preview = buildPreview(
    resultIdentity,
    narration,
    edge,
    exactDetail,
    selected,
    release,
    binding.validation_receipt_ids.preview,
  );
  const ordering = buildOrdering(
    resultIdentity,
    selected.occurrence,
    selected,
    binding,
  );
  const membership = buildMembership(
    resultIdentity,
    narration,
    witness,
    lineage,
    preview,
    ordering,
    exactDetail,
    release,
    binding.validation_receipt_ids.release_membership,
  );
  return {
    result_identity: resultIdentity,
    narration_revision: narration,
    predicate_witness_revision: witness,
    atomic_response_predicate_witness_revision: null,
    result_input_lineage: lineage,
    matched_passage_preview: preview,
    passage_order_projection: ordering,
    candidate_release_membership: membership,
    exact_detail_reference: exactDetail,
  };
}

function buildProductAdmission(pilotReceipt, binding) {
  const admissionInput = buildAdmissionInput(pilotReceipt, binding);
  const admissionReceipt =
    compileProcessPhrasebookResultAdmission(admissionInput);
  const body = {
    schema_version: METSERA_PRODUCT_ADMISSION_SCHEMA,
    materialisation_receipt_id: pilotReceipt.materialisation_receipt_id,
    candidate_release_manifest_id:
      binding.candidate_release_manifest_id,
    corpus_release_id: binding.corpus_release_id,
    admission_input: admissionInput,
    admission_receipt: admissionReceipt,
    source_treatment: 'PROCESS_NARRATION_NOT_ACTUAL_DRAFTING',
    adapter_state: 'VALIDATED_NOT_SERVED',
    authority_limits: AUTHORITY_LIMITS,
  };
  return {
    schema_version: body.schema_version,
    product_admission_adapter_receipt_id: contentId(
      METSERA_PRODUCT_ADMISSION_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compileMetseraExclusivityProductAdmission(
  pilotReceipt,
  candidateReleaseBinding,
) {
  return deepFreeze(buildProductAdmission(
    clone(pilotReceipt),
    clone(candidateReleaseBinding),
  ));
}

function validateMetseraExclusivityProductAdmission(
  value,
  pilotReceipt,
  candidateReleaseBinding,
) {
  const rebuilt = buildProductAdmission(
    clone(pilotReceipt),
    clone(candidateReleaseBinding),
  );
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the Product admission adapter receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_ADMISSION_SCHEMA,
  compileMetseraExclusivityProductAdmission,
  validateMetseraExclusivityProductAdmission,
};
