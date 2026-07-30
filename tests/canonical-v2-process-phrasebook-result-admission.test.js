const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProcessNarrationOccurrence,
} = require('../lib/canonical-v2/process-narration-occurrence');
const {
  PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
  compileProcessPassageOrder,
} = require('../lib/canonical-v2/process-passage-order');
const {
  buildProcessPhrasebookResultIdentity,
} = require('../lib/canonical-v2/process-phrasebook-result');
const {
  AUTHORITY_LIMITS,
  PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
  PROCESS_NARRATION_REVISION_SCHEMA,
  PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
  PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
  canonicalProcessPhrasebookResultAdmissionReceiptBytes,
  compileProcessPhrasebookResultAdmission,
  validateProcessPhrasebookResultAdmissionReceipt,
} = require(
  '../lib/canonical-v2/process-phrasebook-result-admission',
);
const resultContract = require(
  '../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
);
const predicateCatalogueContract = require(
  '../contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v2.json',
);

const TEXT =
  'On April 24, 2025, Metsera declined to grant exclusivity.';
const START = 400;
const END = START + Buffer.byteLength(TEXT, 'utf8');
const CONTRACT_PAIR = id('contract-pair');
const DEAL = id('metsera-deal');
const RELEASE = Object.freeze({
  candidate_release_manifest_id: id('candidate-release'),
  candidate_release_manifest_payload_digest: id('candidate-payload'),
  corpus_release_id: id('corpus-release'),
});

function id(label) {
  return contentId(
    'SYNTHETIC_PROCESS_PHRASEBOOK_RESULT_ADMISSION_TEST/V1',
    { label },
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function addContentId(schema, idField, body) {
  return {
    schema_version: body.schema_version,
    [idField]: contentId(schema, body),
    ...body,
  };
}

function sourceInterval() {
  return {
    admitted_source_occurrence_id: id('source-occurrence'),
    document_hash: id('document-hash'),
    document_ordinal: 0,
    start_utf8_byte: START,
    end_utf8_byte: END,
    exact_text_digest: sha256Hex(Buffer.from(TEXT, 'utf8')),
  };
}

function narrationOccurrence() {
  const interval = sourceInterval();
  return buildProcessNarrationOccurrence({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: DEAL,
    narration_definition_key_and_version: {
      definition_key: 'PROCESS_NARRATION_OCCURRENCE',
      definition_version: 1,
    },
    canonical_source_interval_set: {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      intervals: [{
        admitted_source_occurrence_id:
          interval.admitted_source_occurrence_id,
        document_hash: interval.document_hash,
        document_ordinal: interval.document_ordinal,
        absolute_start: interval.start_utf8_byte,
        absolute_end: interval.end_utf8_byte,
        exact_bytes_digest: interval.exact_text_digest,
      }],
    },
    governed_ordinal: 3,
  });
}

function resultIdentity(occurrence = narrationOccurrence()) {
  return buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: DEAL,
    precomputed_process_narration_occurrence_id:
      occurrence.process_narration_occurrence_id,
    exact_evidence_role_slot_key: 'DIRECT_PREDICATE_WITNESS',
    governed_ordinal: 3,
  });
}

function evidenceEdge(
  evidenceRole = 'DIRECT_PREDICATE_WITNESS',
) {
  const interval = sourceInterval();
  const body = {
    schema_version: PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
    evidence_role_key: evidenceRole,
    ...interval,
    source_document_identity: id('source-document'),
    source_revision_id: id('source-revision'),
    evidence_validation_receipt_id: id('evidence-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
    'evidence_edge_id',
    body,
  );
}

function narrationRevision(occurrence, edge, relationships = []) {
  const identity = {
    claim_revision_ids: [id('claim-revision')],
    evidence_edges: [edge],
    process_narration_occurrence_id:
      occurrence.process_narration_occurrence_id,
    relationship_revision_ids: relationships,
    revision_status: 'PRESENT',
    source_backed_attributes: {
      drafting_class: 'EXCLUSIVITY_EXPRESS_REFUSAL',
    },
  };
  return {
    schema_version: PROCESS_NARRATION_REVISION_SCHEMA,
    process_narration_revision_id: contentId(
      PROCESS_NARRATION_REVISION_SCHEMA,
      identity,
    ),
    process_narration_occurrence: occurrence,
    claim_revision_ids: identity.claim_revision_ids,
    evidence_edges: identity.evidence_edges,
    relationship_revision_ids: identity.relationship_revision_ids,
    revision_status: identity.revision_status,
    source_backed_attributes: identity.source_backed_attributes,
    conflict_state: 'NO_CONFLICT',
    ...RELEASE,
    revision_validation_receipt_id: id('narration-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
}

function predicateWitnessIdentity(
  result,
  predicateKey = 'EXCLUSIVITY_ACTUAL_DRAFTING',
) {
  const identity = {
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: DEAL,
    process_narration_occurrence_id:
      result.precomputed_process_narration_occurrence_id,
    predicate_definition_key_and_version: {
      key: predicateKey,
      version: 1,
    },
    predicate_evidence_role_slot_key:
      result.exact_evidence_role_slot_key,
    governed_ordinal: result.governed_ordinal,
  };
  return {
    ...identity,
    process_predicate_witness_id: contentId(
      'PROCESS_PREDICATE_WITNESS/V1',
      identity,
    ),
  };
}

function predicateWitnessRevision(
  result,
  edge,
  predicateKey = 'EXCLUSIVITY_ACTUAL_DRAFTING',
) {
  const witnessIdentity = predicateWitnessIdentity(result, predicateKey);
  const successorDefinition = predicateCatalogueContract.definition
    .successor_predicate_definition_contract.definitions.find(
      (definition) => definition.predicate_key === predicateKey,
    );
  const dimensionValues = {
    bidder_track_revision_id: null,
    process_agreement_revision_ids: [],
    process_event_revision_id: null,
    process_participant_revision_ids: [],
    process_passage_revision_ids: [],
    process_position_revision_ids: [],
    process_relationship_revision_ids: [],
    temporal_expression_revision_ids: [],
  };
  const dimensionRevisionBindings = [];
  const addDimension = (terminalType) => {
    const revisionId = id(`${terminalType}:revision`);
    const field = {
      BIDDER_TRACK_REVISION: 'bidder_track_revision_id',
      PROCESS_AGREEMENT_REVISION: 'process_agreement_revision_ids',
      PROCESS_EVENT_REVISION: 'process_event_revision_id',
      PROCESS_PARTICIPANT_REVISION: 'process_participant_revision_ids',
      PROCESS_PASSAGE_REVISION: 'process_passage_revision_ids',
      PROCESS_POSITION_REVISION: 'process_position_revision_ids',
      PROCESS_RELATIONSHIP_REVISION: 'process_relationship_revision_ids',
      TEMPORAL_EXPRESSION_REVISION: 'temporal_expression_revision_ids',
    }[terminalType];
    if (field.endsWith('_ids')) {
      dimensionValues[field].push(revisionId);
    } else {
      dimensionValues[field] = revisionId;
    }
    dimensionRevisionBindings.push({
      terminal_type: terminalType,
      revision_id: revisionId,
      evidence_edge_ids: [edge.evidence_edge_id],
      external_validation_receipt_id: id(`${terminalType}:validation`),
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    });
  };
  const requiredFamilies = successorDefinition
    ? successorDefinition.machine_rule.required_typed_link_families
    : [
      { terminal_type: 'BIDDER_TRACK_REVISION' },
      { terminal_type: 'PROCESS_PASSAGE_REVISION' },
    ];
  requiredFamilies.forEach(
    (family) => addDimension(family.terminal_type),
  );
  dimensionRevisionBindings.sort((left, right) => (
    left.terminal_type.localeCompare(right.terminal_type)
    || left.revision_id.localeCompare(right.revision_id)
  ));
  const revisionIdentity = {
    applicability_evidence_edges: [],
    atomic_response_predicate_key: null,
    atomic_response_predicate_witness_revision_id: null,
    bidder_track_revision_id:
      dimensionValues.bidder_track_revision_id,
    complete_scope_evidence_edges: [],
    complete_scope_identity: null,
    dimension_revision_bindings: dimensionRevisionBindings,
    evidence_edges: [edge],
    failure_detail: null,
    predicate_key: predicateKey,
    predicate_state: 'PRESENT',
    process_agreement_revision_ids:
      dimensionValues.process_agreement_revision_ids,
    process_event_revision_id:
      dimensionValues.process_event_revision_id,
    process_participant_revision_ids:
      dimensionValues.process_participant_revision_ids,
    process_passage_revision_ids:
      dimensionValues.process_passage_revision_ids,
    process_position_revision_ids:
      dimensionValues.process_position_revision_ids,
    process_predicate_witness_id:
      witnessIdentity.process_predicate_witness_id,
    process_relationship_revision_ids:
      dimensionValues.process_relationship_revision_ids,
    source_semantic_kind:
      successorDefinition?.machine_rule.semantic_kind
      || 'ACTUAL_DRAFTING',
    subject_code: 'NEGOTIATION_EXCLUSIVITY',
    temporal_expression_revision_ids:
      dimensionValues.temporal_expression_revision_ids,
  };
  return {
    schema_version: PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
    predicate_witness_revision_id: contentId(
      PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
      revisionIdentity,
    ),
    process_predicate_witness_identity: witnessIdentity,
    applicability_evidence_edges:
      revisionIdentity.applicability_evidence_edges,
    atomic_response_predicate_key:
      revisionIdentity.atomic_response_predicate_key,
    atomic_response_predicate_witness_revision_id:
      revisionIdentity.atomic_response_predicate_witness_revision_id,
    bidder_track_revision_id: revisionIdentity.bidder_track_revision_id,
    complete_scope_evidence_edges:
      revisionIdentity.complete_scope_evidence_edges,
    complete_scope_identity: revisionIdentity.complete_scope_identity,
    evidence_edges: revisionIdentity.evidence_edges,
    failure_detail: revisionIdentity.failure_detail,
    predicate_key: revisionIdentity.predicate_key,
    predicate_state: revisionIdentity.predicate_state,
    process_agreement_revision_ids:
      revisionIdentity.process_agreement_revision_ids,
    process_event_revision_id:
      revisionIdentity.process_event_revision_id,
    process_participant_revision_ids:
      revisionIdentity.process_participant_revision_ids,
    process_passage_revision_ids:
      revisionIdentity.process_passage_revision_ids,
    process_position_revision_ids:
      revisionIdentity.process_position_revision_ids,
    process_relationship_revision_ids:
      revisionIdentity.process_relationship_revision_ids,
    source_semantic_kind: revisionIdentity.source_semantic_kind,
    subject_code: revisionIdentity.subject_code,
    temporal_expression_revision_ids:
      revisionIdentity.temporal_expression_revision_ids,
    dimension_revision_bindings: dimensionRevisionBindings,
    ...RELEASE,
    revision_validation_receipt_id: id('witness-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
}

function resultInputLineage(result, narration, witness) {
  const body = {
    schema_version: PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
    process_phrasebook_passage_result_id:
      result.process_phrasebook_passage_result_id,
    ...RELEASE,
    terminal_bindings: [
      {
        terminal_type: 'PROCESS_NARRATION_REVISION',
        stable_occurrence_id:
          narration.process_narration_occurrence
            .process_narration_occurrence_id,
        selected_revision_id: narration.process_narration_revision_id,
        canonical_payload_digest: digest(narration),
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
        canonical_payload_digest: digest(witness),
        evidence_edge_ids: witness.evidence_edges
          .map((edge) => edge.evidence_edge_id)
          .sort(),
      },
    ],
    retelling_relationship_revision_ids:
      narration.relationship_revision_ids,
    predicate_dimension_revision_bindings_digest:
      digest(witness.dimension_revision_bindings),
    lineage_validation_receipt_id: id('lineage-validation'),
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

function exactDetailReference(result, narration, edge) {
  const body = {
    schema_version:
      PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
    process_phrasebook_passage_result_id:
      result.process_phrasebook_passage_result_id,
    ...RELEASE,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    source_interval: sourceInterval(),
    source_local_narration_id:
      narration.process_narration_occurrence
        .process_narration_occurrence_id,
    human_readable_source_label: 'Metsera proxy, Background',
    exact_detail_action: {
      stable_id: 'PROCESS_NARRATION_EVIDENCE',
      version: 1,
    },
    reference_validation_receipt_id: id('detail-validation'),
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

function matchedPassagePreview(result, narration, edge, exactDetail) {
  const body = {
    schema_version: PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
    process_phrasebook_passage_result_id:
      result.process_phrasebook_passage_result_id,
    ...RELEASE,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    canonical_text_digest: id('canonical-document-text'),
    exact_source_interval: sourceInterval(),
    evidence_role_key: result.exact_evidence_role_slot_key,
    source_local_narration_id:
      narration.process_narration_occurrence
        .process_narration_occurrence_id,
    segmentation_projection_id: id('segmentation-projection'),
    verbatim_text: TEXT,
    verbatim_text_digest: sha256Hex(Buffer.from(TEXT, 'utf8')),
    truncation_state: 'COMPLETE',
    exact_detail_reference_id:
      exactDetail.exact_detail_reference_id,
    preview_validation_receipt_id: id('preview-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
    'preview_id',
    body,
  );
}

function orderingFact(result, occurrence, narrationTreatment) {
  const body = {
    schema_version: PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    result_identity: result,
    selected_narration_occurrence: occurrence,
    bidder_track_id: id('bidder-track'),
    narration_treatment: narrationTreatment,
    candidate_release_manifest_id:
      RELEASE.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      RELEASE.candidate_release_manifest_payload_digest,
    external_validation_receipt_id: id('ordering-fact-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    'ordering_fact_id',
    body,
  );
}

function orderingProjection(
  result,
  occurrence,
  narrationTreatment = 'SOURCE_LOCAL_PRIMARY_NARRATION',
) {
  return compileProcessPassageOrder({
    product_query_definition_id: id('product-query'),
    candidate_release_manifest_id:
      RELEASE.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      RELEASE.candidate_release_manifest_payload_digest,
    page_size: 8,
    ordering_facts: [
      orderingFact(result, occurrence, narrationTreatment),
    ],
  });
}

function releaseMembership(
  result,
  narration,
  witness,
  lineage,
  preview,
  ordering,
  exactDetail,
) {
  const body = {
    schema_version:
      PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
    process_phrasebook_passage_result_id:
      result.process_phrasebook_passage_result_id,
    result_identity_payload_digest: result.canonical_payload_digest,
    process_narration_revision_id:
      narration.process_narration_revision_id,
    predicate_witness_revision_id:
      witness.predicate_witness_revision_id,
    result_input_lineage_id: lineage.result_input_lineage_id,
    matched_passage_preview_id: preview.preview_id,
    ordering_projection_id: ordering.ordering_projection_id,
    exact_detail_reference_id:
      exactDetail.exact_detail_reference_id,
    ...RELEASE,
    source_document_identity: preview.source_document_identity,
    membership_validation_receipt_id: id('membership-validation'),
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

function fixture({
  relationships = [],
  narrationTreatment = 'SOURCE_LOCAL_PRIMARY_NARRATION',
  evidenceRole = 'DIRECT_PREDICATE_WITNESS',
  predicateKey = 'EXCLUSIVITY_ACTUAL_DRAFTING',
} = {}) {
  const occurrence = narrationOccurrence();
  const result = resultIdentity(occurrence);
  const edge = evidenceEdge(evidenceRole);
  const narration = narrationRevision(occurrence, edge, relationships);
  const witness = predicateWitnessRevision(result, edge, predicateKey);
  const lineage = resultInputLineage(result, narration, witness);
  const exactDetail = exactDetailReference(result, narration, edge);
  const preview = matchedPassagePreview(
    result,
    narration,
    edge,
    exactDetail,
  );
  const ordering = orderingProjection(
    result,
    occurrence,
    narrationTreatment,
  );
  const membership = releaseMembership(
    result,
    narration,
    witness,
    lineage,
    preview,
    ordering,
    exactDetail,
  );
  return {
    result_identity: result,
    narration_revision: narration,
    predicate_witness_revision: witness,
    result_input_lineage: lineage,
    matched_passage_preview: preview,
    passage_order_projection: ordering,
    candidate_release_membership: membership,
    exact_detail_reference: exactDetail,
  };
}

function rehashPredicateWitnessRevision(witness) {
  const identity = {
    applicability_evidence_edges: witness.applicability_evidence_edges,
    atomic_response_predicate_key:
      witness.atomic_response_predicate_key,
    atomic_response_predicate_witness_revision_id:
      witness.atomic_response_predicate_witness_revision_id,
    bidder_track_revision_id: witness.bidder_track_revision_id,
    complete_scope_evidence_edges:
      witness.complete_scope_evidence_edges,
    complete_scope_identity: witness.complete_scope_identity,
    dimension_revision_bindings: witness.dimension_revision_bindings,
    evidence_edges: witness.evidence_edges,
    failure_detail: witness.failure_detail,
    predicate_key: witness.predicate_key,
    predicate_state: witness.predicate_state,
    process_agreement_revision_ids:
      witness.process_agreement_revision_ids,
    process_event_revision_id: witness.process_event_revision_id,
    process_participant_revision_ids:
      witness.process_participant_revision_ids,
    process_passage_revision_ids: witness.process_passage_revision_ids,
    process_position_revision_ids:
      witness.process_position_revision_ids,
    process_predicate_witness_id:
      witness.process_predicate_witness_identity
        .process_predicate_witness_id,
    process_relationship_revision_ids:
      witness.process_relationship_revision_ids,
    source_semantic_kind: witness.source_semantic_kind,
    subject_code: witness.subject_code,
    temporal_expression_revision_ids:
      witness.temporal_expression_revision_ids,
  };
  witness.predicate_witness_revision_id = contentId(
    PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
    identity,
  );
}

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(assertDeepFrozen);
}

function rehashFullRecord(value, idField, schema) {
  const body = clone(value);
  delete body[idField];
  value[idField] = contentId(schema, body);
}

test('admits one exact result without materialising or serving it', () => {
  const input = fixture();
  const first = compileProcessPhrasebookResultAdmission(input);
  const second = compileProcessPhrasebookResultAdmission(input);

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(
    first.schema_version,
    PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA,
  );
  assert.equal(first.admission_state, 'VALIDATED_NOT_MATERIALISED');
  assert.equal(first.serving_state, 'NOT_SERVED');
  assert.equal(first.matched_passage_preview_state, 'BOUND_VERBATIM');
  assert.equal(first.result_input_lineage_state, 'COMPLETE');
  assert.deepEqual(first.authority_limits, AUTHORITY_LIMITS);
  assert.deepEqual(
    Object.values(first.authority_limits),
    Object.values(first.authority_limits).map(() => 'NONE'),
  );
  assert.equal(
    validateProcessPhrasebookResultAdmissionReceipt(first, input),
    true,
  );
  assert.deepEqual(
    canonicalProcessPhrasebookResultAdmissionReceiptBytes(first, input),
    Buffer.from(canonicalJson(first), 'utf8'),
  );
});

test('admits successor predicates under their exact machine rule', () => {
  const input = fixture({
    predicateKey: 'EXCLUSIVITY_NOTICE_REQUIREMENT',
  });

  const receipt = compileProcessPhrasebookResultAdmission(input);
  assert.equal(
    receipt.predicate_witness_revision_id,
    input.predicate_witness_revision.predicate_witness_revision_id,
  );
});

test('rejects non-present witnesses from a passage-result admission', () => {
  for (const predicateState of [
    'ABSENT',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'FAILED',
  ]) {
    const input = fixture();
    input.predicate_witness_revision.predicate_state = predicateState;
    assert.throws(
      () => compileProcessPhrasebookResultAdmission(input),
      { code: 'INVALID_PROCESS_PREDICATE_WITNESS_REVISION' },
    );
  }
});

test('admits only a response union that retains an atomic response binding', () => {
  const input = fixture({
    predicateKey: 'EXCLUSIVITY_RESPONSE_ANY',
  });
  const witness = input.predicate_witness_revision;
  witness.atomic_response_predicate_key = 'EXCLUSIVITY_GRANTED';
  witness.atomic_response_predicate_witness_revision_id =
    id('admitted-atomic-grant-witness-revision');
  witness.source_semantic_kind = 'GRANT';
  rehashPredicateWitnessRevision(witness);
  input.result_input_lineage = resultInputLineage(
    input.result_identity,
    input.narration_revision,
    witness,
  );
  input.candidate_release_membership = releaseMembership(
    input.result_identity,
    input.narration_revision,
    witness,
    input.result_input_lineage,
    input.matched_passage_preview,
    input.passage_order_projection,
    input.exact_detail_reference,
  );

  assert.doesNotThrow(
    () => compileProcessPhrasebookResultAdmission(input),
  );
  witness.source_semantic_kind = 'EXPRESS_REFUSAL';
  rehashPredicateWitnessRevision(witness);
  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_PREDICATE_WITNESS_REVISION' },
  );
});

test('fails closed when a successor machine rule changes', () => {
  const rule = predicateCatalogueContract.definition
    .successor_predicate_definition_contract.definitions[0].machine_rule;
  const original = rule.semantic_kind;
  rule.semantic_kind = 'NOTICE_REQUIREMENT';
  try {
    assert.throws(
      () => compileProcessPhrasebookResultAdmission(fixture()),
      {
        code:
          'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_CONTRACT_BINDING',
      },
    );
  } finally {
    rule.semantic_kind = original;
  }
});

test('rejects narration revision and exact source-interval drift', () => {
  const input = clone(fixture());
  input.narration_revision.process_narration_occurrence
    .canonical_source_interval_set.intervals[0].absolute_start += 1;

  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_NARRATION_REVISION' },
  );
});

test('rejects a predicate witness bound to the wrong narration', () => {
  const input = fixture();
  input.predicate_witness_revision.process_predicate_witness_identity
    .process_narration_occurrence_id = id('wrong-narration');

  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_PREDICATE_WITNESS_IDENTITY' },
  );
});

test('rejects actual drafting without a Process passage revision', () => {
  const input = fixture();
  const witness = input.predicate_witness_revision;
  witness.process_passage_revision_ids = [];
  witness.dimension_revision_bindings =
    witness.dimension_revision_bindings.filter(
      (binding) => binding.terminal_type !== 'PROCESS_PASSAGE_REVISION',
    );
  const identity = {
    bidder_track_revision_id: witness.bidder_track_revision_id,
    evidence_edges: witness.evidence_edges,
    predicate_key: witness.predicate_key,
    predicate_state: witness.predicate_state,
    process_agreement_revision_ids:
      witness.process_agreement_revision_ids,
    process_event_revision_id: witness.process_event_revision_id,
    process_participant_revision_ids:
      witness.process_participant_revision_ids,
    process_passage_revision_ids: witness.process_passage_revision_ids,
    process_position_revision_ids:
      witness.process_position_revision_ids,
    process_predicate_witness_id:
      witness.process_predicate_witness_identity
        .process_predicate_witness_id,
    process_relationship_revision_ids:
      witness.process_relationship_revision_ids,
    subject_code: witness.subject_code,
    temporal_expression_revision_ids:
      witness.temporal_expression_revision_ids,
  };
  witness.predicate_witness_revision_id = contentId(
    PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
    identity,
  );

  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_PREDICATE_WITNESS_REVISION' },
  );
});

test('rejects missing dimension evidence and incomplete terminals', () => {
  const noDimension = fixture();
  noDimension.predicate_witness_revision
    .dimension_revision_bindings[1].evidence_edge_ids = [];
  assert.throws(
    () => compileProcessPhrasebookResultAdmission(noDimension),
    { code: 'INVALID_PROCESS_PREDICATE_WITNESS_REVISION' },
  );

  const noTerminal = fixture();
  noTerminal.result_input_lineage.terminal_bindings.pop();
  rehashFullRecord(
    noTerminal.result_input_lineage,
    'result_input_lineage_id',
    PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
  );
  assert.throws(
    () => compileProcessPhrasebookResultAdmission(noTerminal),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE' },
  );
});

test('rejects rewritten or blank inline drafting', () => {
  for (const rewrittenText of [
    'Metsera agreed to exclusivity.',
    '',
  ]) {
    const input = fixture();
    const preview = input.matched_passage_preview;
    preview.verbatim_text = rewrittenText;
    preview.verbatim_text_digest = sha256Hex(
      Buffer.from(rewrittenText, 'utf8'),
    );
    rehashFullRecord(
      preview,
      'preview_id',
      PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
    );
    assert.throws(
      () => compileProcessPhrasebookResultAdmission(input),
      { code: 'INVALID_PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW' },
    );
  }
});

test('rejects evidence-role laundering into a direct witness', () => {
  const input = fixture({ evidenceRole: 'CONTEXTUAL_EVIDENCE' });

  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_PREDICATE_WITNESS_REVISION' },
  );
});

test('rejects a forged exact-detail source reference', () => {
  const input = fixture();
  input.exact_detail_reference.source_document_identity =
    id('forged-document');
  rehashFullRecord(
    input.exact_detail_reference,
    'exact_detail_reference_id',
    PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
  );
  input.matched_passage_preview.exact_detail_reference_id =
    input.exact_detail_reference.exact_detail_reference_id;
  rehashFullRecord(
    input.matched_passage_preview,
    'preview_id',
    PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
  );

  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW' },
  );
});

test('rejects an ordering projection for a different exact result', () => {
  const input = fixture();
  const otherOccurrence = buildProcessNarrationOccurrence({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: DEAL,
    narration_definition_key_and_version: {
      definition_key: 'PROCESS_NARRATION_OCCURRENCE',
      definition_version: 1,
    },
    canonical_source_interval_set: {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      intervals: [{
        admitted_source_occurrence_id: id('other-source-occurrence'),
        document_hash: id('other-document'),
        document_ordinal: 1,
        absolute_start: 900,
        absolute_end: 920,
        exact_bytes_digest: id('other-text'),
      }],
    },
    governed_ordinal: 3,
  });
  const otherResult = resultIdentity(otherOccurrence);
  input.passage_order_projection = orderingProjection(
    otherResult,
    otherOccurrence,
  );

  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_ORDERING_BINDING' },
  );
});

test('rejects a later retelling with no relationship revision', () => {
  const input = fixture({ narrationTreatment: 'LATER_RETELLING' });

  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_ORDERING_BINDING' },
  );
});

test('accepts a later retelling only when its relationship is retained', () => {
  const input = fixture({
    relationships: [id('retelling-relationship-revision')],
    narrationTreatment: 'LATER_RETELLING',
  });

  assert.equal(
    compileProcessPhrasebookResultAdmission(input)
      .ordering_projection_state,
    'BOUND_GOVERNED',
  );
});

test('rejects stale or incomplete candidate-release membership', () => {
  const input = fixture();
  input.candidate_release_membership.matched_passage_preview_id =
    id('stale-preview');
  rehashFullRecord(
    input.candidate_release_membership,
    'release_membership_id',
    PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
  );

  assert.throws(
    () => compileProcessPhrasebookResultAdmission(input),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP' },
  );
});

test('rejects a correctly rehashed receipt forgery', () => {
  const input = fixture();
  const receipt = clone(compileProcessPhrasebookResultAdmission(input));
  receipt.admission_state = 'MATERIALISED';
  rehashFullRecord(
    receipt,
    'admission_receipt_id',
    PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA,
  );

  assert.throws(
    () => validateProcessPhrasebookResultAdmissionReceipt(receipt, input),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT' },
  );
});

test('fails closed when the signed result-lineage contract changes', () => {
  const input = fixture();
  const terminals =
    resultContract.definition.lineage_contract.required_terminal_types;
  const original = terminals[1];
  terminals[1] = 'FORGED_TERMINAL';
  try {
    assert.throws(
      () => compileProcessPhrasebookResultAdmission(input),
      {
        code:
          'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_CONTRACT_BINDING',
      },
    );
  } finally {
    terminals[1] = original;
  }
});

test('contains no I/O path and grants no downstream authority', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/process-phrasebook-result-admission.js',
    ),
    'utf8',
  );
  for (const forbidden of [
    "require('node:fs')",
    "require('fs')",
    'fetch(',
    'child_process',
    'process.env',
  ]) {
    assert.equal(source.includes(forbidden), false);
  }
  assert.deepEqual(
    Object.values(AUTHORITY_LIMITS),
    Object.values(AUTHORITY_LIMITS).map(() => 'NONE'),
  );
});
