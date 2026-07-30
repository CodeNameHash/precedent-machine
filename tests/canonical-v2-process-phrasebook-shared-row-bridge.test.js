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
  PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
  PROCESS_NARRATION_REVISION_SCHEMA,
  PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
  PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
  compileProcessPhrasebookResultAdmission,
} = require(
  '../lib/canonical-v2/process-phrasebook-result-admission',
);
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  compileProductQueryIr,
} = require('../lib/canonical-v2/product-query-ir');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  validateProductQueryResult,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  requestedFieldProjectionIdentity,
} = require('../lib/canonical-v2/product-query-result-compiler');
const {
  CONTEXT_ACTION,
  PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
  PRODUCT_DOMAIN_VALIDATOR,
  SELECTED_SOURCE_ACTION,
  canonicalProcessPhrasebookSharedRowBridgeReceiptBytes,
  compileProcessPhrasebookSharedRowBridge,
  validateProcessPhrasebookSharedRowBridgeReceipt,
} = require(
  '../lib/canonical-v2/process-phrasebook-shared-row-bridge',
);
const adapterContract = require(
  '../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
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
const PROCESS_RESULT_DEFINITION = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});

function id(label) {
  return contentId(
    'SYNTHETIC_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_TEST/V1',
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

function resultIdentity(occurrence) {
  return buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: DEAL,
    precomputed_process_narration_occurrence_id:
      occurrence.process_narration_occurrence_id,
    exact_evidence_role_slot_key: 'DIRECT_PREDICATE_WITNESS',
    governed_ordinal: 3,
  });
}

function evidenceEdge() {
  const body = {
    schema_version: PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
    evidence_role_key: 'DIRECT_PREDICATE_WITNESS',
    ...sourceInterval(),
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

function narrationRevision(occurrence, edge, relationships) {
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

function witnessIdentity(result) {
  const identity = {
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: DEAL,
    process_narration_occurrence_id:
      result.precomputed_process_narration_occurrence_id,
    predicate_definition_key_and_version: {
      key: 'EXCLUSIVITY_ACTUAL_DRAFTING',
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

function witnessRevision(result, edge) {
  const witness = witnessIdentity(result);
  const bidderTrack = id('bidder-track-revision');
  const passage = id('process-passage-revision');
  const dimensionRevisionBindings = [
    {
      terminal_type: 'BIDDER_TRACK_REVISION',
      revision_id: bidderTrack,
      evidence_edge_ids: [edge.evidence_edge_id],
      external_validation_receipt_id: id('track-validation'),
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    },
    {
      terminal_type: 'PROCESS_PASSAGE_REVISION',
      revision_id: passage,
      evidence_edge_ids: [edge.evidence_edge_id],
      external_validation_receipt_id: id('passage-validation'),
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    },
  ];
  const revisionIdentity = {
    applicability_evidence_edges: [],
    atomic_response_predicate_key: null,
    atomic_response_predicate_witness_revision_id: null,
    bidder_track_revision_id: bidderTrack,
    complete_scope_evidence_edges: [],
    complete_scope_identity: null,
    complete_scope_payload: null,
    dimension_revision_bindings: dimensionRevisionBindings,
    evidence_edges: [edge],
    failure_detail: null,
    predicate_key: 'EXCLUSIVITY_ACTUAL_DRAFTING',
    predicate_state: 'PRESENT',
    process_agreement_revision_ids: [],
    process_event_revision_id: null,
    process_participant_revision_ids: [],
    process_passage_revision_ids: [passage],
    process_position_revision_ids: [],
    process_predicate_witness_id:
      witness.process_predicate_witness_id,
    process_relationship_revision_ids: [],
    source_semantic_kind: 'ACTUAL_DRAFTING',
    subject_code: 'NEGOTIATION_EXCLUSIVITY',
    temporal_expression_revision_ids: [],
  };
  return {
    schema_version: PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
    predicate_witness_revision_id: contentId(
      PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
      revisionIdentity,
    ),
    process_predicate_witness_identity: witness,
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
    complete_scope_payload: revisionIdentity.complete_scope_payload,
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

function resultLineage(result, narration, witness) {
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
        evidence_edge_ids: [narration.evidence_edges[0].evidence_edge_id],
      },
      {
        terminal_type: 'PREDICATE_WITNESS_REVISION',
        stable_occurrence_id:
          witness.process_predicate_witness_identity
            .process_predicate_witness_id,
        selected_revision_id: witness.predicate_witness_revision_id,
        canonical_payload_digest: digest(witness),
        evidence_edge_ids: [witness.evidence_edges[0].evidence_edge_id],
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

function exactDetail(result, narration, edge) {
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
      stable_id: SELECTED_SOURCE_ACTION,
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

function preview(result, narration, edge, detail) {
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
    exact_detail_reference_id: detail.exact_detail_reference_id,
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

function orderingProjection(result, occurrence) {
  const factBody = {
    schema_version: PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    result_identity: result,
    selected_narration_occurrence: occurrence,
    bidder_track_id: id('bidder-track'),
    narration_treatment: 'SOURCE_LOCAL_PRIMARY_NARRATION',
    candidate_release_manifest_id:
      RELEASE.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      RELEASE.candidate_release_manifest_payload_digest,
    external_validation_receipt_id: id('ordering-validation'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  const fact = addContentId(
    PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    'ordering_fact_id',
    factBody,
  );
  return compileProcessPassageOrder({
    product_query_definition_id: id('process-query'),
    candidate_release_manifest_id:
      RELEASE.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      RELEASE.candidate_release_manifest_payload_digest,
    page_size: 8,
    ordering_facts: [fact],
  });
}

function releaseMembership(
  result,
  narration,
  witness,
  lineage,
  matchedPreview,
  ordering,
  detail,
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
    matched_passage_preview_id: matchedPreview.preview_id,
    ordering_projection_id: ordering.ordering_projection_id,
    exact_detail_reference_id: detail.exact_detail_reference_id,
    ...RELEASE,
    source_document_identity: matchedPreview.source_document_identity,
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

function processFixture(relationships = []) {
  const occurrence = narrationOccurrence();
  const result = resultIdentity(occurrence);
  const edge = evidenceEdge();
  const narration = narrationRevision(occurrence, edge, relationships);
  const witness = witnessRevision(result, edge);
  const lineage = resultLineage(result, narration, witness);
  const detail = exactDetail(result, narration, edge);
  const matchedPreview = preview(result, narration, edge, detail);
  const ordering = orderingProjection(result, occurrence);
  const membership = releaseMembership(
    result,
    narration,
    witness,
    lineage,
    matchedPreview,
    ordering,
    detail,
  );
  const input = {
    result_identity: result,
    narration_revision: narration,
    predicate_witness_revision: witness,
    atomic_response_predicate_witness_revision: null,
    result_input_lineage: lineage,
    matched_passage_preview: matchedPreview,
    passage_order_projection: ordering,
    candidate_release_membership: membership,
    exact_detail_reference: detail,
  };
  return {
    input,
    receipt: compileProcessPhrasebookResultAdmission(input),
  };
}

function fieldDefinition(fieldKey) {
  return {
    field_key: fieldKey,
    field_version: 1,
    permitted_result_definitions: [
      PROCESS_RESULT_DEFINITION.stable_id,
    ],
    filter_scope: 'SAME_DEAL',
    multiplicity: 'ZERO_OR_ONE',
    capabilities: {
      display: true,
      filter: true,
      sort: true,
    },
    supported_domains: ['PROCESS'],
    permitted_operators: ['EQ'],
    completeness_semantics: 'UNKNOWN_IF_NOT_ADMITTED',
  };
}

function productQueryIr(actions = [
  SELECTED_SOURCE_ACTION,
  CONTEXT_ACTION,
]) {
  const admission = {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: id('pm-data-version'),
    candidate_release_manifest_id:
      RELEASE.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      RELEASE.candidate_release_manifest_payload_digest,
    canonical_contract_identity: {
      stable_id: 'CANONICAL_CONTRACT_BUNDLE',
      version: 1,
      payload_digest: id('canonical-contract'),
    },
    product_field_catalogue: {
      stable_id: 'PRODUCT_FIELD_CATALOGUE',
      manifest_id: id('field-catalogue'),
      payload_digest: id('field-catalogue-payload'),
      field_definitions: [
        fieldDefinition('process_phase'),
        fieldDefinition('sector'),
      ],
    },
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: id('navigation-catalogue'),
      payload_digest: id('navigation-catalogue-payload'),
    },
    predicate_admissions: [{
      domain_key: 'PROCESS',
      predicate_key: 'EXCLUSIVITY_GRANTED',
      predicate_version: 1,
      admission_id: id('predicate-admission'),
      result_definitions: [clone(PROCESS_RESULT_DEFINITION)],
      evidence_requirement_ids: [
        'EXACT_PASSAGE',
        'EXACT_SOURCE_CITATION',
      ],
    }],
    exact_detail_actions: [...actions],
    coverage_identities: [id('coverage')],
    route_budget: {
      maximum_page_size: 50,
    },
  };
  return compileProductQueryIr({
    admission,
    query: {
      domain_key: 'PROCESS',
      predicate_key: 'EXCLUSIVITY_GRANTED',
      predicate_version: 1,
      result_definition: clone(PROCESS_RESULT_DEFINITION),
      evidence_requirement_ids: [
        'EXACT_PASSAGE',
        'EXACT_SOURCE_CITATION',
      ],
      cohort: {
        cohort_definition_id: id('cohort'),
        cohort_definition_payload_digest: id('cohort-payload'),
      },
      filters: [{
        field_key: 'process_phase',
        field_version: 1,
        operator: 'EQ',
        value: 'PRE_SIGNING',
      }],
      sort: [{
        field_key: 'sector',
        field_version: 1,
        direction: 'ASC',
      }],
      diversity: {
        definition_id: id('diversity'),
        payload_digest: id('diversity-payload'),
      },
      requested_columns: [
        {
          field_key: 'sector',
          field_version: 1,
        },
        {
          field_key: 'process_phase',
          field_version: 1,
        },
      ],
      pagination: {
        page_size: 12,
        cursor: null,
      },
      detail_actions: [...actions],
      coverage: {
        coverage_identity: id('coverage'),
        coverage_payload_digest: id('coverage-payload'),
        covered_set_identity: id('covered-set'),
        exclusions_identity: id('exclusions'),
      },
    },
  });
}

function resultFields() {
  return [
    {
      field_reference: {
        field_key: 'sector',
        field_version: 1,
      },
      value: 'BIOPHARMA',
    },
    {
      field_reference: {
        field_key: 'process_phase',
        field_version: 1,
      },
      value: 'PRE_SIGNING',
    },
  ];
}

function domainResultForAdmission(processInput) {
  const payload = processInput.matched_passage_preview.verbatim_text;
  const payloadDigest = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: PRODUCT_DOMAIN_VALIDATOR.stable_id,
    validator_version: PRODUCT_DOMAIN_VALIDATOR.version,
    validated_payload_digest: payloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: 'PROCESS',
    domain_result_definition: clone(PROCESS_RESULT_DEFINITION),
    domain_result_identity:
      processInput.result_identity.process_phrasebook_passage_result_id,
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigest,
    domain_result_validation: {
      schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      ...validationBody,
      validation_receipt_id: contentId(
        PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
        validationBody,
      ),
    },
    domain_result_source_representation_kind: 'VERBATIM_TEXT',
  };
}

function productAdmissionReceipt(ir, domainResult, fields, states = {}) {
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: domainResult.domain_key,
    domain_result_definition: clone(domainResult.domain_result_definition),
    domain_result_identity: domainResult.domain_result_identity,
    domain_result_payload_digest:
      domainResult.domain_result_payload_digest,
    domain_validator_admission_identity:
      id(states.validatorAdmission || 'adapter-admission'),
    domain_validation_receipt_id:
      domainResult.domain_result_validation.validation_receipt_id,
    query_coverage_identity: ir.coverage_contract.coverage_identity,
    covered_set_identity: ir.coverage_contract.covered_set_identity,
    query_cohort_identity: ir.cohort_contract.cohort_definition_id,
    predicate_evaluation_state: states.predicate || 'PASS',
    cohort_evaluation_state: states.cohort || 'PASS',
    filter_evaluation_state: states.filter || 'PASS',
    covered_set_membership_state: states.covered || 'PASS',
    requested_field_projection_identity:
      requestedFieldProjectionIdentity({
        queryIr: ir,
        domainResult,
        resultFields: fields,
      }),
    admission_state: PRODUCT_QUERY_RESULT_ADMISSION_STATE,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    admission_receipt_id: contentId(
      PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  };
}

function bridgeFixture({
  relationships = [],
  actions,
  states,
} = {}) {
  const process = processFixture(relationships);
  const ir = productQueryIr(actions);
  const fields = resultFields();
  const domainResult = domainResultForAdmission(process.input);
  return {
    process_admission_input: process.input,
    process_admission_receipt: process.receipt,
    product_query_ir: ir,
    result_fields: fields,
    product_admission_receipt:
      productAdmissionReceipt(ir, domainResult, fields, states),
  };
}

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(assertDeepFrozen);
}

function rehashProductAdmissionReceipt(receipt) {
  const body = clone(receipt);
  delete body.admission_receipt_id;
  receipt.admission_receipt_id = contentId(
    PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
    body,
  );
}

function rehashAdapterReceipt(receipt) {
  receipt.adapter_receipt_id = contentId(
    PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
    {
      process_admission_receipt: receipt.process_admission_receipt,
      product_query_result: receipt.product_query_result,
    },
  );
}

test('bridges one admitted Metsera passage into the existing Product row', () => {
  const input = bridgeFixture();
  const first = compileProcessPhrasebookSharedRowBridge(input);
  const second = compileProcessPhrasebookSharedRowBridge(input);
  const product = first.product_query_result;
  const processPreview =
    input.process_admission_input.matched_passage_preview;

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(
    first.schema_version,
    PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
  );
  assert.equal(first.adapter_state, 'VALIDATED_NOT_MATERIALISED');
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.deepEqual(
    first.process_admission_receipt,
    input.process_admission_receipt,
  );
  assert.equal(product.domain_result_payload, TEXT);
  assert.equal(
    product.domain_result_identity,
    input.process_admission_input.result_identity
      .process_phrasebook_passage_result_id,
  );
  assert.equal(product.exact_detail_action, SELECTED_SOURCE_ACTION);
  assert.equal(
    product.exact_citation.source_evidence_identity,
    processPreview.preview_id,
  );
  assert.equal(validateProductQueryResult(product), true);
  assert.equal(
    validateProcessPhrasebookSharedRowBridgeReceipt(first, input),
    true,
  );
  assert.deepEqual(
    canonicalProcessPhrasebookSharedRowBridgeReceiptBytes(first, input),
    Buffer.from(canonicalJson(first), 'utf8'),
  );
});

test('retains separate raw UTF-8 and Product canonical JSON digests', () => {
  const input = bridgeFixture();
  const product =
    compileProcessPhrasebookSharedRowBridge(input).product_query_result;
  const rawDigest = sha256Hex(Buffer.from(TEXT, 'utf8'));
  const productDigest = sha256Hex(Buffer.from(
    canonicalJson(TEXT),
    'utf8',
  ));

  assert.notEqual(rawDigest, productDigest);
  assert.equal(
    input.process_admission_receipt.verbatim_text_digest,
    rawDigest,
  );
  assert.equal(
    product.exact_citation.source_interval.exact_text_digest,
    rawDigest,
  );
  assert.equal(product.domain_result_payload_digest, productDigest);
});

test('does not mutate any external checked input', () => {
  const input = bridgeFixture();
  const before = clone(input);

  compileProcessPhrasebookSharedRowBridge(input);

  assert.deepEqual(input, before);
});

test('rejects Process identity, preview and receipt substitution', () => {
  const wrongIdentity = bridgeFixture();
  wrongIdentity.process_admission_input.result_identity =
    clone(wrongIdentity.process_admission_input.result_identity);
  wrongIdentity.process_admission_input.result_identity
    .process_phrasebook_passage_result_id = id('wrong-result');
  assert.throws(
    () => compileProcessPhrasebookSharedRowBridge(wrongIdentity),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PROCESS_BINDING',
    },
  );

  const rewritten = bridgeFixture();
  rewritten.process_admission_input.matched_passage_preview =
    clone(rewritten.process_admission_input.matched_passage_preview);
  rewritten.process_admission_input.matched_passage_preview
    .verbatim_text = 'A rewritten summary.';
  assert.throws(
    () => compileProcessPhrasebookSharedRowBridge(rewritten),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PROCESS_BINDING',
    },
  );

  const wrongReceipt = bridgeFixture();
  wrongReceipt.process_admission_receipt =
    clone(wrongReceipt.process_admission_receipt);
  wrongReceipt.process_admission_receipt.result_input_lineage_id =
    id('wrong-lineage');
  assert.throws(
    () => compileProcessPhrasebookSharedRowBridge(wrongReceipt),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PROCESS_BINDING',
    },
  );
});

test('binds the exact candidate release across Process and Product', () => {
  const input = bridgeFixture();
  input.product_query_ir = clone(input.product_query_ir);
  input.product_query_ir.release_contract
    .candidate_release_manifest_id = id('wrong-release');

  assert.throws(
    () => compileProcessPhrasebookSharedRowBridge(input),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_RELEASE_BINDING',
    },
  );
});

test('requires selected-source and context actions to remain distinct', () => {
  for (const actions of [
    [SELECTED_SOURCE_ACTION],
    [CONTEXT_ACTION],
  ]) {
    const input = bridgeFixture({ actions });
    assert.throws(
      () => compileProcessPhrasebookSharedRowBridge(input),
      {
        code:
          'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PRODUCT_INPUT',
      },
    );
  }
});

test('does not manufacture Product PASS states', () => {
  for (const state of [
    'predicate',
    'cohort',
    'filter',
    'covered',
  ]) {
    const input = bridgeFixture({
      states: { [state]: 'FAIL' },
    });
    assert.throws(
      () => compileProcessPhrasebookSharedRowBridge(input),
      {
        code:
          'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PRODUCT_INPUT',
      },
      state,
    );
  }
});

test('rejects changed requested fields and Product admission', () => {
  const missingField = bridgeFixture();
  missingField.result_fields.pop();
  assert.throws(
    () => compileProcessPhrasebookSharedRowBridge(missingField),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PRODUCT_INPUT',
    },
  );

  const changedAdmission = bridgeFixture();
  changedAdmission.product_admission_receipt =
    clone(changedAdmission.product_admission_receipt);
  changedAdmission.product_admission_receipt
    .requested_field_projection_identity = id('wrong-projection');
  rehashProductAdmissionReceipt(
    changedAdmission.product_admission_receipt,
  );
  assert.throws(
    () => compileProcessPhrasebookSharedRowBridge(changedAdmission),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PRODUCT_INPUT',
    },
  );
});

test('keeps full lineage in the sidecar identity', () => {
  const first = compileProcessPhrasebookSharedRowBridge(
    bridgeFixture(),
  );
  const second = compileProcessPhrasebookSharedRowBridge(
    bridgeFixture({
      relationships: [id('retelling-relationship')],
    }),
  );

  assert.deepEqual(
    first.product_query_result,
    second.product_query_result,
  );
  assert.notEqual(
    first.process_admission_receipt.process_narration_revision_id,
    second.process_admission_receipt.process_narration_revision_id,
  );
  assert.notEqual(first.adapter_receipt_id, second.adapter_receipt_id);
});

test('does not put rank or context execution into the Product row', () => {
  const receipt = compileProcessPhrasebookSharedRowBridge(
    bridgeFixture(),
  );
  const product = receipt.product_query_result;

  assert.equal(Object.hasOwn(product, 'rank'), false);
  assert.equal(Object.hasOwn(product, 'ordering_ordinal'), false);
  assert.equal(Object.hasOwn(product, 'context_action'), false);
  assert.equal(
    receipt.process_admission_receipt.ordering_projection_state,
    'BOUND_GOVERNED',
  );
});

test('rejects a correctly rehashed sidecar forgery', () => {
  const input = bridgeFixture();
  const receipt = clone(
    compileProcessPhrasebookSharedRowBridge(input),
  );
  receipt.adapter_state = 'MATERIALISED';
  rehashAdapterReceipt(receipt);

  assert.throws(
    () => validateProcessPhrasebookSharedRowBridgeReceipt(
      receipt,
      input,
    ),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_RECEIPT',
    },
  );
});

test('fails closed when the signed adapter contract changes', () => {
  const input = bridgeFixture();
  const original =
    adapterContract.definition.action_mapping
      .adapter_can_collapse_or_relabel_actions;
  adapterContract.definition.action_mapping
    .adapter_can_collapse_or_relabel_actions = true;
  try {
    assert.throws(
      () => compileProcessPhrasebookSharedRowBridge(input),
      {
        code:
          'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_CONTRACT_BINDING',
      },
    );
  } finally {
    adapterContract.definition.action_mapping
      .adapter_can_collapse_or_relabel_actions = original;
  }
});

test('contains no I/O, serving, writer or database path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/process-phrasebook-shared-row-bridge.js',
    ),
    'utf8',
  );
  for (const forbidden of [
    "require('node:fs')",
    "require('fs')",
    'fetch(',
    'child_process',
    'process.env',
    'serving-client',
    'supabase',
  ]) {
    assert.equal(source.includes(forbidden), false);
  }
});
