const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  buildProcessPhrasebookResultIdentity,
} = require('./process-phrasebook-result');
const {
  compileProcessPassageOrder,
  PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
} = require('./process-passage-order');
const {
  compileProcessPhrasebookResultAdmission,
} = require('./process-phrasebook-result-admission');
const {
  MATERIALISATION_RECEIPT_SCHEMA,
} = require('./process-exclusivity-pilot');
const {
  loadSealedMetseraGoldEvidence,
} = require('./metsera-gold-evidence');

const METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA =
  'METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const EXPECTED_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'materialisation_receipt_id',
  'frozen_contract_pair_digest', 'governed_deal_admission_id',
  'controlled_code_registry_binding', 'source_document_bindings',
  'exact_source_slices', 'event_slot_bindings',
  'participant_event_bindings', 'occurrence_slot_bindings',
  'identities', 'revisions', 'source_interval_state',
  'controlled_code_state', 'materialisation_state',
  'external_operation_state', 'authority_state', 'authority_limits',
]);
const AUTHORITY_LIMITS = Object.freeze({
  query: 'NONE', source_read: 'NONE', extraction: 'NONE',
  materialisation: 'NONE', writer: 'NONE', serving: 'NONE',
  release: 'NONE', canonical_write: 'NONE', database_write: 'NONE',
  import: 'NONE', activation: 'NONE', production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera real Process admission: ${message}`);
}

function clone(value) { return JSON.parse(canonicalJson(value)); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(`${label} does not have the exact required fields`);
  }
}
function digest(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) fail(`${label} must be a SHA-256 digest`);
  return value;
}
function receiptBoundId(label, receipt) {
  return contentId(METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA, {
    label,
    materialisation_receipt_id: receipt.materialisation_receipt_id,
  });
}
function releaseBinding(value) {
  exactKeys(value, [
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
  ], 'Candidate release binding');
  Object.entries(value).forEach(([key, item]) => digest(item, `Candidate release ${key}`));
  return clone(value);
}

function validateReceipt(receipt) {
  exactKeys(receipt, EXPECTED_RECEIPT_KEYS, 'Materialisation receipt');
  if (receipt.schema_version !== MATERIALISATION_RECEIPT_SCHEMA
    || receipt.source_interval_state !== 'EXACT_UTF8_INTERVALS_VALIDATED'
    || receipt.controlled_code_state !== 'CLOSED_AND_RECONCILED'
    || receipt.materialisation_state !== 'VALIDATED_SIDECAR_ONLY'
    || receipt.external_operation_state !== 'NOT_PERFORMED'
    || receipt.authority_state !== 'NOT_GRANTED'
    || Object.values(receipt.authority_limits || {}).some((state) => state !== 'NONE')) {
    fail('materialisation receipt state is not an inactive validated sidecar');
  }
  const body = clone(receipt);
  delete body.materialisation_receipt_id;
  if (receipt.materialisation_receipt_id !== contentId(MATERIALISATION_RECEIPT_SCHEMA, body)) {
    fail('materialisation receipt identity was changed');
  }
  const { sourceUniverse, exclusivityGold } = loadSealedMetseraGoldEvidence();
  if (!Array.isArray(receipt.source_document_bindings)
    || receipt.source_document_bindings.length !== sourceUniverse.documents.length) {
    fail('materialisation receipt does not retain the sealed Metsera source universe');
  }
  sourceUniverse.documents.forEach((document, ordinal) => {
    const binding = receipt.source_document_bindings[ordinal];
    if (!binding || binding.document_ordinal !== ordinal
      || binding.document_hash !== document.sha256
      || binding.source_text_digest !== document.sha256
      || binding.citation_identity?.accession_number !== document.accession
      || binding.citation_identity?.form_type !== document.form
      || binding.citation_identity?.filed_on !== document.filedOn
      || binding.citation_identity?.official_url !== document.officialUrl) {
      fail('materialisation receipt substituted a sealed Metsera source');
    }
  });
  const passage = exclusivityGold.passages.find((item) => (
    item.id === 'party-2-august-17-executed-exclusivity'
  ));
  const source = receipt.source_document_bindings.find((item) => (
    item.citation_identity?.accession_number === passage.source.accession
  ));
  const slice = receipt.exact_source_slices?.find((item) => (
    item.source_document_identity === source?.source_document_identity
    && item.start_utf8_byte === passage.interval.byteStart
    && item.end_utf8_byte === passage.interval.byteEnd
    && item.exact_text === passage.verbatimUtf8
    && item.exact_text_digest === passage.verbatimSha256
  ));
  if (!slice) fail('materialisation receipt does not retain the exact sealed narration bytes');
  return { passage, source, slice };
}

function edgeFromMaterial(edge, release, receipt) {
  const body = {
    schema_version: 'PROCESS_EXACT_EVIDENCE_EDGE/V1',
    evidence_role_key: edge.evidence_role_key,
    admitted_source_occurrence_id: edge.admitted_source_occurrence_id,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    document_hash: edge.document_hash,
    document_ordinal: edge.document_ordinal,
    start_utf8_byte: edge.start_utf8_byte,
    end_utf8_byte: edge.end_utf8_byte,
    exact_text_digest: edge.exact_text_digest,
    evidence_validation_receipt_id: receiptBoundId(`evidence:${edge.evidence_edge_id}`, receipt),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return { ...body, evidence_edge_id: contentId(body.schema_version, body) };
}

function externalNarration(material, occurrence, release, receipt) {
  const body = {
    schema_version: 'PROCESS_NARRATION_REVISION/V1',
    process_narration_revision_id: material.process_narration_revision_id,
    process_narration_occurrence: occurrence,
    claim_revision_ids: material.claim_revision_ids,
    evidence_edges: material.evidence_edges.map((edge) => edgeFromMaterial(edge, release, receipt)),
    relationship_revision_ids: material.relationship_revision_ids,
    revision_status: material.revision_status,
    source_backed_attributes: material.source_backed_attributes,
    conflict_state: 'NO_CONFLICT',
    ...release,
    revision_validation_receipt_id: receiptBoundId('narration-validation', receipt),
    validation_state: 'EXTERNALLY_VALIDATED', authority_state: 'NOT_GRANTED',
  };
  body.process_narration_revision_id = contentId(body.schema_version, {
    claim_revision_ids: body.claim_revision_ids,
    evidence_edges: body.evidence_edges,
    process_narration_occurrence_id:
      body.process_narration_occurrence.process_narration_occurrence_id,
    relationship_revision_ids: body.relationship_revision_ids,
    revision_status: body.revision_status,
    source_backed_attributes: body.source_backed_attributes,
  });
  return body;
}
function witnessIdentity(material, identities) {
  return material.process_predicate_witness_identity
    || material.predicate_witness_identity
    || identities.find((item) => (
      item.process_predicate_witness_id === material.process_predicate_witness_id
    ));
}
function externalWitness(material, identities, release, receipt) {
  const identity = witnessIdentity(material, identities);
  if (!identity) fail('materialisation receipt lacks predicate-witness identity');
  const body = {
    schema_version: 'PREDICATE_WITNESS_REVISION/V2',
    predicate_witness_revision_id: material.predicate_witness_revision_id,
    process_predicate_witness_identity: identity,
    applicability_evidence_edges: material.applicability_evidence_edges,
    atomic_response_predicate_key: material.atomic_response_predicate_key,
    atomic_response_predicate_witness_revision_id: material.atomic_response_predicate_witness_revision_id,
    bidder_track_revision_id: material.bidder_track_revision_id,
    complete_scope_evidence_edges: material.complete_scope_evidence_edges,
    complete_scope_identity: material.complete_scope_identity,
    complete_scope_payload: material.complete_scope_payload,
    evidence_edges: material.evidence_edges.map((edge) => edgeFromMaterial(edge, release, receipt)),
    failure_detail: material.failure_detail,
    predicate_key: material.predicate_key, predicate_state: material.predicate_state,
    process_agreement_revision_ids: material.process_agreement_revision_ids,
    process_event_revision_id: material.process_event_revision_id,
    process_participant_revision_ids: material.process_participant_revision_ids,
    process_passage_revision_ids: material.process_passage_revision_ids,
    process_position_revision_ids: material.process_position_revision_ids,
    process_relationship_revision_ids: material.process_relationship_revision_ids,
    source_semantic_kind: material.source_semantic_kind, subject_code: material.subject_code,
    temporal_expression_revision_ids: material.temporal_expression_revision_ids,
    dimension_revision_bindings: material.dimension_revision_bindings.map((binding) => ({
      ...binding,
      evidence_edge_ids: binding.evidence_edge_ids.map((id) => {
        const edge = material.evidence_edges.find((item) => item.evidence_edge_id === id);
        return edgeFromMaterial(edge, release, receipt).evidence_edge_id;
      }),
      external_validation_receipt_id: receiptBoundId(`dimension:${binding.revision_id}`, receipt),
      validation_state: 'EXTERNALLY_VALIDATED', authority_state: 'NOT_GRANTED',
    })),
    ...release,
    revision_validation_receipt_id: receiptBoundId('witness-validation', receipt),
    validation_state: 'EXTERNALLY_VALIDATED', authority_state: 'NOT_GRANTED',
  };
  body.predicate_witness_revision_id = contentId(body.schema_version, {
    applicability_evidence_edges: body.applicability_evidence_edges,
    atomic_response_predicate_key: body.atomic_response_predicate_key,
    atomic_response_predicate_witness_revision_id:
      body.atomic_response_predicate_witness_revision_id,
    bidder_track_revision_id: body.bidder_track_revision_id,
    complete_scope_evidence_edges: body.complete_scope_evidence_edges,
    complete_scope_identity: body.complete_scope_identity,
    complete_scope_payload: body.complete_scope_payload,
    dimension_revision_bindings: body.dimension_revision_bindings,
    evidence_edges: body.evidence_edges, failure_detail: body.failure_detail,
    predicate_key: body.predicate_key, predicate_state: body.predicate_state,
    process_agreement_revision_ids: body.process_agreement_revision_ids,
    process_event_revision_id: body.process_event_revision_id,
    process_participant_revision_ids: body.process_participant_revision_ids,
    process_passage_revision_ids: body.process_passage_revision_ids,
    process_position_revision_ids: body.process_position_revision_ids,
    process_predicate_witness_id:
      body.process_predicate_witness_identity.process_predicate_witness_id,
    process_relationship_revision_ids: body.process_relationship_revision_ids,
    source_semantic_kind: body.source_semantic_kind,
    subject_code: body.subject_code,
    temporal_expression_revision_ids: body.temporal_expression_revision_ids,
  });
  return body;
}

function buildAdmission({ materialisation_receipt, candidate_release_binding, product_query_definition_id }) {
  exactKeys(arguments[0], [
    'materialisation_receipt', 'candidate_release_binding', 'product_query_definition_id',
  ], 'Metsera real Process admission input');
  const receipt = clone(materialisation_receipt);
  const release = releaseBinding(candidate_release_binding);
  digest(product_query_definition_id, 'Product query definition ID');
  const { passage, source, slice } = validateReceipt(receipt);
  const narrations = receipt.revisions?.narration_revisions || [];
  const witnesses = receipt.revisions?.predicate_witness_revisions || [];
  const narrationMaterial = narrations.find((item) => {
    const occurrence = receipt.identities?.narration_occurrences?.find((identity) => (
      identity.process_narration_occurrence_id === item.process_narration_occurrence_id
    ));
    return occurrence?.canonical_source_interval_set?.intervals?.some((interval) => (
      interval.absolute_start === slice.start_utf8_byte
      && interval.absolute_end === slice.end_utf8_byte
    ));
  });
  const witnessMaterial = witnesses.find((item) => (
    item.predicate_key === 'EXCLUSIVITY_GRANTED' && item.predicate_state === 'PRESENT'
    && item.source_semantic_kind === 'GRANT'
  ));
  if (!narrationMaterial || !witnessMaterial) fail('materialisation receipt lacks the sealed exclusivity narration or witness');
  const occurrence = receipt.identities.narration_occurrences.find((item) => (
    item.process_narration_occurrence_id === narrationMaterial.process_narration_occurrence_id
  ));
  const narration = externalNarration(narrationMaterial, occurrence, release, receipt);
  const witness = externalWitness(
    witnessMaterial,
    receipt.identities.predicate_witnesses || [],
    release,
    receipt,
  );
  const result = buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: receipt.frozen_contract_pair_digest,
    governed_deal_admission_id: receipt.governed_deal_admission_id,
    precomputed_process_narration_occurrence_id: narration.process_narration_occurrence.process_narration_occurrence_id,
    exact_evidence_role_slot_key: witness.process_predicate_witness_identity.predicate_evidence_role_slot_key,
    governed_ordinal: witness.process_predicate_witness_identity.governed_ordinal,
  });
  const directEdge = witness.evidence_edges.find((edge) => (
    edge.evidence_role_key === result.exact_evidence_role_slot_key
    && edge.start_utf8_byte === slice.start_utf8_byte && edge.end_utf8_byte === slice.end_utf8_byte
  ));
  if (!directEdge) fail('materialisation witness does not bind the exact narration evidence edge');
  const sourceInterval = {
    admitted_source_occurrence_id: directEdge.admitted_source_occurrence_id,
    document_hash: directEdge.document_hash, document_ordinal: directEdge.document_ordinal,
    start_utf8_byte: directEdge.start_utf8_byte, end_utf8_byte: directEdge.end_utf8_byte,
    exact_text_digest: directEdge.exact_text_digest,
  };
  const detailBody = {
    schema_version: 'PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE/V1',
    process_phrasebook_passage_result_id: result.process_phrasebook_passage_result_id, ...release,
    source_document_identity: source.source_document_identity, source_revision_id: source.source_revision_id,
    source_interval: sourceInterval,
    source_local_narration_id: narration.process_narration_occurrence.process_narration_occurrence_id,
    human_readable_source_label: `Metsera ${source.citation_identity.form_type}, filed ${source.citation_identity.filed_on}, Background of the Merger, event ${passage.date}`,
    exact_detail_action: { stable_id: 'PROCESS_NARRATION_EVIDENCE', version: 1 },
    reference_validation_receipt_id: receiptBoundId('detail-validation', receipt),
    validation_state: 'EXTERNALLY_VALIDATED', object_authorisation_state: 'REQUIRED_BEFORE_USE', execution_authority_state: 'NOT_GRANTED',
  };
  const exact_detail_reference = { ...detailBody, exact_detail_reference_id: contentId(detailBody.schema_version, detailBody) };
  const previewBody = {
    schema_version: 'PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW/V1',
    process_phrasebook_passage_result_id: result.process_phrasebook_passage_result_id, ...release,
    source_document_identity: source.source_document_identity, source_revision_id: source.source_revision_id,
    canonical_text_digest: source.document_hash, exact_source_interval: sourceInterval,
    evidence_role_key: result.exact_evidence_role_slot_key,
    source_local_narration_id: narration.process_narration_occurrence.process_narration_occurrence_id,
    segmentation_projection_id: receiptBoundId('segmentation', receipt), verbatim_text: slice.exact_text,
    verbatim_text_digest: sha256Hex(Buffer.from(slice.exact_text, 'utf8')),
    truncation_state: 'COMPLETE', exact_detail_reference_id: exact_detail_reference.exact_detail_reference_id,
    preview_validation_receipt_id: receiptBoundId('preview-validation', receipt), validation_state: 'EXTERNALLY_VALIDATED', authority_state: 'NOT_GRANTED',
  };
  const matched_passage_preview = { ...previewBody, preview_id: contentId(previewBody.schema_version, previewBody) };
  const orderFactBody = {
    schema_version: PROCESS_PASSAGE_ORDERING_FACT_SCHEMA, result_identity: result,
    selected_narration_occurrence: narration.process_narration_occurrence,
    bidder_track_id: witness.bidder_track_revision_id, narration_treatment: 'SOURCE_LOCAL_PRIMARY_NARRATION',
    candidate_release_manifest_id: release.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: release.candidate_release_manifest_payload_digest,
    external_validation_receipt_id: receiptBoundId('ordering-validation', receipt), validation_state: 'EXTERNALLY_VALIDATED', authority_state: 'NOT_GRANTED',
  };
  const orderingFact = { ...orderFactBody, ordering_fact_id: contentId(PROCESS_PASSAGE_ORDERING_FACT_SCHEMA, orderFactBody) };
  const passage_order_projection = compileProcessPassageOrder({ product_query_definition_id, candidate_release_manifest_id: release.candidate_release_manifest_id, candidate_release_manifest_payload_digest: release.candidate_release_manifest_payload_digest, page_size: 8, ordering_facts: [orderingFact] });
  const lineageBody = {
    schema_version: 'PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE/V1', process_phrasebook_passage_result_id: result.process_phrasebook_passage_result_id, ...release,
    terminal_bindings: [
      { terminal_type: 'PROCESS_NARRATION_REVISION', stable_occurrence_id: narration.process_narration_occurrence.process_narration_occurrence_id, selected_revision_id: narration.process_narration_revision_id, canonical_payload_digest: sha256Hex(Buffer.from(canonicalJson(narration), 'utf8')), evidence_edge_ids: narration.evidence_edges.map((edge) => edge.evidence_edge_id).sort() },
      { terminal_type: 'PREDICATE_WITNESS_REVISION', stable_occurrence_id: witness.process_predicate_witness_identity.process_predicate_witness_id, selected_revision_id: witness.predicate_witness_revision_id, canonical_payload_digest: sha256Hex(Buffer.from(canonicalJson(witness), 'utf8')), evidence_edge_ids: witness.evidence_edges.map((edge) => edge.evidence_edge_id).sort() },
    ], retelling_relationship_revision_ids: narration.relationship_revision_ids,
    predicate_dimension_revision_bindings_digest: sha256Hex(Buffer.from(canonicalJson(witness.dimension_revision_bindings), 'utf8')),
    lineage_validation_receipt_id: receiptBoundId('lineage-validation', receipt), completeness_state: 'COMPLETE', validation_state: 'EXTERNALLY_VALIDATED', authority_state: 'NOT_GRANTED',
  };
  const result_input_lineage = { ...lineageBody, result_input_lineage_id: contentId(lineageBody.schema_version, lineageBody) };
  const membershipBody = {
    schema_version: 'PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP/V1', process_phrasebook_passage_result_id: result.process_phrasebook_passage_result_id, result_identity_payload_digest: result.canonical_payload_digest, process_narration_revision_id: narration.process_narration_revision_id, predicate_witness_revision_id: witness.predicate_witness_revision_id, result_input_lineage_id: result_input_lineage.result_input_lineage_id, matched_passage_preview_id: matched_passage_preview.preview_id, ordering_projection_id: passage_order_projection.ordering_projection_id, exact_detail_reference_id: exact_detail_reference.exact_detail_reference_id, ...release, source_document_identity: source.source_document_identity, membership_validation_receipt_id: receiptBoundId('membership-validation', receipt), membership_state: 'NOT_RELEASE_BOUND', validation_state: 'EXTERNALLY_VALIDATED', authority_state: 'NOT_GRANTED',
  };
  const candidate_release_membership = { ...membershipBody, release_membership_id: contentId(membershipBody.schema_version, membershipBody) };
  const process_admission_input = { result_identity: result, narration_revision: narration, predicate_witness_revision: witness, atomic_response_predicate_witness_revision: null, result_input_lineage, matched_passage_preview, passage_order_projection, candidate_release_membership, exact_detail_reference };
  const process_admission_receipt = compileProcessPhrasebookResultAdmission(process_admission_input);
  const body = { schema_version: METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA, materialisation_receipt_id: receipt.materialisation_receipt_id, materialisation_receipt: receipt, candidate_release_binding: release, product_query_definition_id, process_admission_input, process_admission_receipt, adapter_state: 'VALIDATED_NOT_RELEASE_BOUND', authority_limits: clone(AUTHORITY_LIMITS) };
  return { schema_version: body.schema_version, process_phrasebook_admission_id: contentId(METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA, body), ...body };
}

function compileMetseraExclusivityProcessPhrasebookAdmission(input) {
  return deepFreeze(buildAdmission(clone(input)));
}
function validateMetseraExclusivityProcessPhrasebookAdmission(value) {
  const rebuilt = buildAdmission({ materialisation_receipt: value?.materialisation_receipt, candidate_release_binding: value?.candidate_release_binding, product_query_definition_id: value?.product_query_definition_id });
  if (canonicalJson(value) !== canonicalJson(rebuilt)) fail('real Process admission was changed');
  return true;
}

module.exports = { AUTHORITY_LIMITS, METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA, compileMetseraExclusivityProcessPhrasebookAdmission, validateMetseraExclusivityProcessPhrasebookAdmission };
