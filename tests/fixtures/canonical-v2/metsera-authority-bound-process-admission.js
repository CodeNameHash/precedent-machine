const { canonicalJson, contentId, sha256Hex } = require(
  '../../../lib/canonical-v2/canonical-bytes',
);
const {
  buildProcessNarrationOccurrence,
} = require('../../../lib/canonical-v2/process-narration-occurrence');
const {
  PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
  compileProcessPassageOrder,
} = require('../../../lib/canonical-v2/process-passage-order');
const {
  buildProcessPhrasebookResultIdentity,
} = require('../../../lib/canonical-v2/process-phrasebook-result');
const {
  PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
  PROCESS_NARRATION_REVISION_SCHEMA,
  PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
  PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
  compileProcessPhrasebookResultAdmission,
} = require('../../../lib/canonical-v2/process-phrasebook-result-admission');

const TEXT = 'On August 17, 2025, Metsera granted Party 2 exclusivity.';
const START = 400;
const END = START + Buffer.byteLength(TEXT, 'utf8');
const RESULT = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});

function id(label) {
  return contentId(
    'METSERA_AUTHORITY_BOUND_PROCESS_ADMISSION_FIXTURE/V1',
    { label },
  );
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function digest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function identified(schema, field, body) {
  return { schema_version: body.schema_version, [field]: contentId(schema, body), ...body };
}

function release(authorityContext) {
  return {
    candidate_release_manifest_id:
      authorityContext.candidate_release_manifest.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      authorityContext.candidate_release_manifest.canonical_payload_digest,
    corpus_release_id: authorityContext.candidate_release_manifest.corpus_release_id,
  };
}

function interval() {
  return {
    admitted_source_occurrence_id: id('source-occurrence'),
    document_hash: id('document-hash'),
    document_ordinal: 0,
    start_utf8_byte: START,
    end_utf8_byte: END,
    exact_text_digest: sha256Hex(Buffer.from(TEXT, 'utf8')),
  };
}

function sourceEdge() {
  const body = {
    schema_version: PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
    evidence_role_key: 'DIRECT_PREDICATE_WITNESS',
    ...interval(),
    source_document_identity: id('source-document'),
    source_revision_id: id('source-revision'),
    evidence_validation_receipt_id: id('evidence-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return identified(PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA, 'evidence_edge_id', body);
}

function occurrence() {
  const source = interval();
  return buildProcessNarrationOccurrence({
    frozen_contract_pair_digest: id('contract-pair'),
    governed_deal_admission_id: id('metsera-deal'),
    narration_definition_key_and_version: {
      definition_key: 'PROCESS_NARRATION_OCCURRENCE',
      definition_version: 1,
    },
    canonical_source_interval_set: {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      intervals: [{
        admitted_source_occurrence_id: source.admitted_source_occurrence_id,
        document_hash: source.document_hash,
        document_ordinal: source.document_ordinal,
        absolute_start: source.start_utf8_byte,
        absolute_end: source.end_utf8_byte,
        exact_bytes_digest: source.exact_text_digest,
      }],
    },
    governed_ordinal: 3,
  });
}

function resultIdentity(narrationOccurrence) {
  return buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: id('contract-pair'),
    governed_deal_admission_id: id('metsera-deal'),
    precomputed_process_narration_occurrence_id:
      narrationOccurrence.process_narration_occurrence_id,
    exact_evidence_role_slot_key: 'DIRECT_PREDICATE_WITNESS',
    governed_ordinal: 3,
  });
}

function narrationRevision(narrationOccurrence, edge, candidateRelease) {
  const identity = {
    claim_revision_ids: [id('claim-revision')],
    evidence_edges: [edge],
    process_narration_occurrence_id:
      narrationOccurrence.process_narration_occurrence_id,
    relationship_revision_ids: [],
    revision_status: 'PRESENT',
    source_backed_attributes: { drafting_class: 'EXCLUSIVITY_GRANT' },
  };
  return {
    schema_version: PROCESS_NARRATION_REVISION_SCHEMA,
    process_narration_revision_id: contentId(PROCESS_NARRATION_REVISION_SCHEMA, identity),
    process_narration_occurrence: narrationOccurrence,
    claim_revision_ids: identity.claim_revision_ids,
    evidence_edges: identity.evidence_edges,
    relationship_revision_ids: identity.relationship_revision_ids,
    revision_status: identity.revision_status,
    source_backed_attributes: identity.source_backed_attributes,
    conflict_state: 'NO_CONFLICT',
    ...candidateRelease,
    revision_validation_receipt_id: id('narration-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
}

function witnessIdentity(result, ordinal, predicateKey) {
  const identity = {
    frozen_contract_pair_digest: id('contract-pair'),
    governed_deal_admission_id: id('metsera-deal'),
    process_narration_occurrence_id:
      result.precomputed_process_narration_occurrence_id,
    predicate_definition_key_and_version: {
      key: predicateKey,
      version: 1,
    },
    predicate_evidence_role_slot_key: result.exact_evidence_role_slot_key,
    governed_ordinal: ordinal,
  };
  return {
    ...identity,
    process_predicate_witness_id: contentId('PROCESS_PREDICATE_WITNESS/V1', identity),
  };
}

function witnessRevision(result, edge, candidateRelease) {
  const identity = witnessIdentity(result, 3, 'EXCLUSIVITY_GRANTED');
  const bindings = [
    'BIDDER_TRACK_REVISION',
    'PROCESS_EVENT_REVISION',
    'PROCESS_PASSAGE_REVISION',
  ].map((terminalType) => ({
    terminal_type: terminalType,
    revision_id: id(`${terminalType}:revision`),
    evidence_edge_ids: [edge.evidence_edge_id],
    external_validation_receipt_id: id(`${terminalType}:validation`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  })).sort((left, right) => left.terminal_type.localeCompare(right.terminal_type));
  const values = Object.fromEntries(bindings.map((binding) => [
    binding.terminal_type,
    binding.revision_id,
  ]));
  const body = {
    applicability_evidence_edges: [],
    atomic_response_predicate_key: null,
    atomic_response_predicate_witness_revision_id: null,
    bidder_track_revision_id: values.BIDDER_TRACK_REVISION,
    complete_scope_evidence_edges: [],
    complete_scope_identity: null,
    complete_scope_payload: null,
    dimension_revision_bindings: bindings,
    evidence_edges: [edge],
    failure_detail: null,
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_state: 'PRESENT',
    process_agreement_revision_ids: [],
    process_event_revision_id: values.PROCESS_EVENT_REVISION,
    process_participant_revision_ids: [],
    process_passage_revision_ids: [values.PROCESS_PASSAGE_REVISION],
    process_position_revision_ids: [],
    process_predicate_witness_id: identity.process_predicate_witness_id,
    process_relationship_revision_ids: [],
    source_semantic_kind: 'GRANT',
    subject_code: 'NEGOTIATION_EXCLUSIVITY',
    temporal_expression_revision_ids: [],
  };
  return {
    witness: {
      schema_version: PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
      predicate_witness_revision_id: contentId(
        PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
        body,
      ),
      process_predicate_witness_identity: identity,
      ...withoutWitnessId(body),
      ...candidateRelease,
      revision_validation_receipt_id: id('witness-validation'),
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    },
    atomic: null,
  };
}

function withoutWitnessId(value) {
  const { process_predicate_witness_id: ignored, ...rest } = value;
  return rest;
}

function lineage(result, narration, witness, candidateRelease) {
  const body = {
    schema_version: PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
    process_phrasebook_passage_result_id: result.process_phrasebook_passage_result_id,
    ...candidateRelease,
    terminal_bindings: [
      {
        terminal_type: 'PROCESS_NARRATION_REVISION',
        stable_occurrence_id:
          narration.process_narration_occurrence.process_narration_occurrence_id,
        selected_revision_id: narration.process_narration_revision_id,
        canonical_payload_digest: digest(narration),
        evidence_edge_ids: [narration.evidence_edges[0].evidence_edge_id],
      },
      {
        terminal_type: 'PREDICATE_WITNESS_REVISION',
        stable_occurrence_id:
          witness.process_predicate_witness_identity.process_predicate_witness_id,
        selected_revision_id: witness.predicate_witness_revision_id,
        canonical_payload_digest: digest(witness),
        evidence_edge_ids: [witness.evidence_edges[0].evidence_edge_id],
      },
    ],
    retelling_relationship_revision_ids: [],
    predicate_dimension_revision_bindings_digest:
      digest(witness.dimension_revision_bindings),
    lineage_validation_receipt_id: id('lineage-validation'),
    completeness_state: 'COMPLETE',
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return identified(PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA, 'result_input_lineage_id', body);
}

function detail(result, narration, edge, candidateRelease) {
  const body = {
    schema_version: PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
    process_phrasebook_passage_result_id: result.process_phrasebook_passage_result_id,
    ...candidateRelease,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    source_interval: interval(),
    source_local_narration_id:
      narration.process_narration_occurrence.process_narration_occurrence_id,
    human_readable_source_label:
      'Metsera DEFM14A, filed 2025-10-09, Background of the Merger, event 2025-08-17',
    exact_detail_action: { stable_id: 'PROCESS_NARRATION_EVIDENCE', version: 1 },
    reference_validation_receipt_id: id('detail-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    object_authorisation_state: 'REQUIRED_BEFORE_USE',
    execution_authority_state: 'NOT_GRANTED',
  };
  return identified(
    PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
    'exact_detail_reference_id',
    body,
  );
}

function preview(result, narration, edge, exactDetail, candidateRelease) {
  const body = {
    schema_version: PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
    process_phrasebook_passage_result_id: result.process_phrasebook_passage_result_id,
    ...candidateRelease,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    canonical_text_digest: id('canonical-document-text'),
    exact_source_interval: interval(),
    evidence_role_key: result.exact_evidence_role_slot_key,
    source_local_narration_id:
      narration.process_narration_occurrence.process_narration_occurrence_id,
    segmentation_projection_id: id('segmentation-projection'),
    verbatim_text: TEXT,
    verbatim_text_digest: sha256Hex(Buffer.from(TEXT, 'utf8')),
    truncation_state: 'COMPLETE',
    exact_detail_reference_id: exactDetail.exact_detail_reference_id,
    preview_validation_receipt_id: id('preview-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return identified(PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA, 'preview_id', body);
}

function order(result, narrationOccurrence, queryDefinitionId, candidateRelease) {
  const body = {
    schema_version: PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    result_identity: result,
    selected_narration_occurrence: narrationOccurrence,
    bidder_track_id: id('bidder-track'),
    narration_treatment: 'SOURCE_LOCAL_PRIMARY_NARRATION',
    candidate_release_manifest_id: candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      candidateRelease.candidate_release_manifest_payload_digest,
    external_validation_receipt_id: id('ordering-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  const fact = identified(PROCESS_PASSAGE_ORDERING_FACT_SCHEMA, 'ordering_fact_id', body);
  return compileProcessPassageOrder({
    product_query_definition_id: queryDefinitionId,
    candidate_release_manifest_id: candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      candidateRelease.candidate_release_manifest_payload_digest,
    page_size: 8,
    ordering_facts: [fact],
  });
}

function membership(result, narration, witness, inputLineage, matchedPreview, ordering, exactDetail, candidateRelease) {
  const body = {
    schema_version: PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
    process_phrasebook_passage_result_id: result.process_phrasebook_passage_result_id,
    result_identity_payload_digest: result.canonical_payload_digest,
    process_narration_revision_id: narration.process_narration_revision_id,
    predicate_witness_revision_id: witness.predicate_witness_revision_id,
    result_input_lineage_id: inputLineage.result_input_lineage_id,
    matched_passage_preview_id: matchedPreview.preview_id,
    ordering_projection_id: ordering.ordering_projection_id,
    exact_detail_reference_id: exactDetail.exact_detail_reference_id,
    ...candidateRelease,
    source_document_identity: matchedPreview.source_document_identity,
    membership_validation_receipt_id: id('membership-validation'),
    membership_state: 'NOT_RELEASE_BOUND',
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return identified(
    PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
    'release_membership_id',
    body,
  );
}

function buildMetseraAuthorityBoundProcessAdmission({
  authority_context: authorityContext,
  product_query_definition_id: queryDefinitionId,
}) {
  const candidateRelease = release(authorityContext);
  const narrationOccurrence = occurrence();
  const result = resultIdentity(narrationOccurrence);
  const edge = sourceEdge();
  const narration = narrationRevision(narrationOccurrence, edge, candidateRelease);
  const witnesses = witnessRevision(result, edge, candidateRelease);
  const inputLineage = lineage(result, narration, witnesses.witness, candidateRelease);
  const exactDetail = detail(result, narration, edge, candidateRelease);
  const matchedPreview = preview(result, narration, edge, exactDetail, candidateRelease);
  const ordering = order(result, narrationOccurrence, queryDefinitionId, candidateRelease);
  const candidateMembership = membership(
    result,
    narration,
    witnesses.witness,
    inputLineage,
    matchedPreview,
    ordering,
    exactDetail,
    candidateRelease,
  );
  const process_admission_input = {
    result_identity: result,
    narration_revision: narration,
    predicate_witness_revision: witnesses.witness,
    atomic_response_predicate_witness_revision: witnesses.atomic,
    result_input_lineage: inputLineage,
    matched_passage_preview: matchedPreview,
    passage_order_projection: ordering,
    candidate_release_membership: candidateMembership,
    exact_detail_reference: exactDetail,
  };
  return {
    process_admission_input,
    process_admission_receipt:
      compileProcessPhrasebookResultAdmission(process_admission_input),
  };
}

module.exports = { buildMetseraAuthorityBoundProcessAdmission };
