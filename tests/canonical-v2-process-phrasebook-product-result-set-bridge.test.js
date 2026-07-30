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
  CURRENT_PM_BASELINE_FIELD_KEYS,
  buildProductFieldCatalogueManifest,
  productFieldCatalogueQueryAdmission,
  sourceRegistryPayloadDigest,
} = require('../lib/canonical-v2/product-field-catalogue');
const {
  buildProcessNarrationOccurrence,
} = require('../lib/canonical-v2/process-narration-occurrence');
const {
  PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
  PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
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
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  requestedFieldProjectionIdentity,
} = require('../lib/canonical-v2/product-query-result-compiler');
const {
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
  PROCESS_ORDERING_VALIDATOR_STABLE_ID,
  PROCESS_ORDERING_VALIDATOR_VERSION,
  compileProductResultSlotFailure,
} = require('../lib/canonical-v2/product-query-result-set-compiler');
const {
  validateProductResultPresentation,
} = require('../lib/canonical-v2/product-result-presentation-compiler');
const {
  CONTEXT_ACTION,
  PRODUCT_DOMAIN_VALIDATOR,
  SELECTED_SOURCE_ACTION,
  compileProcessPhrasebookSharedRowBridge,
} = require(
  '../lib/canonical-v2/process-phrasebook-shared-row-bridge',
);
const {
  PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT_SCHEMA,
  canonicalProcessPhrasebookProductResultSetBridgeReceiptBytes,
  compileProcessPhrasebookProductResultPresentation,
  compileProcessPhrasebookProductResultSetBridge,
  validateProcessPhrasebookProductResultSetBridgeReceipt,
} = require(
  '../lib/canonical-v2/process-phrasebook-product-result-set-bridge',
);

const CONTRACT_ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const PROCESS_RESULT_DEFINITION = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const CONTRACT_PAIR = id('contract-pair');
const DEAL = id('metsera-deal');
const GROUP_LABELS = Object.freeze({
  DEAL_IDENTITY: 'Deal identity',
  CHRONOLOGY: 'Deal and date',
  PARTIES: 'Parties',
  TRANSACTION_STRUCTURE: 'Transaction structure',
  ECONOMICS: 'Consideration and value',
  CLASSIFICATIONS: 'Sector and classifications',
  PROFESSIONALS: 'Law firms, lawyers and advisers',
  PROCESS_EVENT: 'Process event',
  PROCESS_PARTIES_AND_TRACKS: 'Parties and bidder tracks',
  PROCESS_TIMING: 'Process timing',
  PROCESS_SOURCE_AND_CERTIFICATION: 'Source and certification',
});
const GROUP_ORDER = Object.freeze(Object.keys(GROUP_LABELS));
const RESULT_DEFINITIONS = Object.freeze([
  'AGREEMENT_COMPARABLE_RESULT',
  'CVR_MILESTONE_RESULT',
  'PROCESS_EXCLUSIVITY_EVENT_RESULT',
  'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
]);

function id(label) {
  return contentId(
    'SYNTHETIC_PROCESS_RESULT_SET_BRIDGE_TEST/V1',
    { label },
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function addContentId(schema, idField, body) {
  return {
    schema_version: body.schema_version,
    [idField]: contentId(schema, body),
    ...body,
  };
}

function loadContract(relativePath) {
  return JSON.parse(fs.readFileSync(
    path.join(CONTRACT_ROOT, relativePath),
    'utf8',
  ));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function identity(stableId, version = 1) {
  return {
    stable_id: stableId,
    version,
    payload_digest: digest(`${stableId}:${version}`),
  };
}

function capabilities(source) {
  return {
    display: source.display,
    filter: source.filter,
    sort: source.sort,
    group: source.group,
    export: true,
  };
}

function sharedCompleteness(field) {
  if (field.multiplicity === 'MANY') {
    return 'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE';
  }
  return field.missing_state_behaviour;
}

function sharedSourceField(field, sourceCatalogue) {
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    label: field.label,
    field_group: field.field_group,
    value_type: field.value_type,
    control_type: field.control_type,
    supported_domains: [...field.permitted_domains].sort(),
    source_permitted_result_definitions: [],
    capabilities: capabilities(field.capabilities),
    permitted_operators: [...field.permitted_operators].sort(),
    filter_scope: field.filter_scope,
    multiplicity: field.multiplicity,
    completeness_semantics: sharedCompleteness(field),
    source_requirement: field.source_detail_action,
    derivation_requirement: 'CANONICAL_SHARED_FACT_PROJECTION_ONLY',
    unavailable_reason: field.unavailable_request_result,
    value_vocabulary_required: field.value_type === 'ENUM',
    source_binding: {
      source_stable_id: sourceCatalogue.stable_id,
      source_schema_version: sourceCatalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function processSourceField(field, sourceCatalogue) {
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    label: field.label,
    field_group: field.field_group,
    value_type: field.value_type,
    control_type: field.control_type,
    supported_domains: ['PROCESS'],
    source_permitted_result_definitions: [
      ...field.permitted_result_definitions,
    ].sort(),
    capabilities: capabilities(field.capabilities),
    permitted_operators: [...field.permitted_operators].sort(),
    filter_scope: field.filter_scope,
    multiplicity: field.multiplicity,
    completeness_semantics: field.completeness_semantics,
    source_requirement: field.source_requirement,
    derivation_requirement: field.derivation_requirement,
    unavailable_reason: field.unavailable_reason,
    value_vocabulary_required:
      typeof field.required_value_registry === 'string',
    source_binding: {
      source_stable_id: sourceCatalogue.stable_id,
      source_schema_version: sourceCatalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function sourceRegistry() {
  const shared = loadContract(
    'shared/field-definitions/shared-deal-field-catalogue.v1.json',
  );
  const process = loadContract(
    'process/fields/process-field-definition-catalogue.v1.json',
  );
  const sourceBindings = [
    {
      source_stable_id: process.stable_id,
      source_schema_version: process.schema_version,
      source_payload_digest: payloadDigest(process),
      source_field_count: process.definition.field_definitions.length,
    },
    {
      source_stable_id: shared.stable_id,
      source_schema_version: shared.schema_version,
      source_payload_digest: payloadDigest(shared),
      source_field_count: shared.field_definitions.length,
    },
  ].sort((left, right) => compareText(
    `${left.source_stable_id}\0${left.source_schema_version}`,
    `${right.source_stable_id}\0${right.source_schema_version}`,
  ));
  const fields = [
    ...shared.field_definitions.map(
      (field) => sharedSourceField(field, shared),
    ),
    ...process.definition.field_definitions.map(
      (field) => processSourceField(field, process),
    ),
  ].sort((left, right) => compareText(
    `${left.field_key}\0${left.field_version}`,
    `${right.field_key}\0${right.field_version}`,
  ));
  const registry = {
    schema_version: 'PRODUCT_FIELD_SOURCE_REGISTRY/V1',
    stable_id: 'PRODUCT_FIELD_SOURCE_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id: digest('approved-pm-data-version'),
    source_bindings: sourceBindings,
    field_groups: GROUP_ORDER.map((fieldGroupKey, index) => ({
      field_group_key: fieldGroupKey,
      label: GROUP_LABELS[fieldGroupKey],
      sort_ordinal: index + 1,
    })),
    field_definitions: fields,
    source_exclusions: [],
    current_pm_baseline_field_keys: [...CURRENT_PM_BASELINE_FIELD_KEYS],
    enumeration_certification: {
      independent_enumeration_id: digest('field-enumeration'),
      inclusion_exclusion_reconciliation_id:
        digest('field-reconciliation'),
    },
    canonical_payload_digest: null,
  };
  registry.canonical_payload_digest = sourceRegistryPayloadDigest(registry);
  return registry;
}

function sourceRegistryAdmission(registry) {
  return {
    stable_id: registry.stable_id,
    registry_version: registry.registry_version,
    approved_pm_data_version_id: registry.approved_pm_data_version_id,
    canonical_payload_digest: registry.canonical_payload_digest,
    enumeration_certification: clone(registry.enumeration_certification),
  };
}

function fieldAdmission(field) {
  const permittedResultDefinitions =
    field.source_permitted_result_definitions.length > 0
      ? [...field.source_permitted_result_definitions]
      : [...RESULT_DEFINITIONS];
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    supported_domains: [...field.supported_domains],
    permitted_result_definitions: permittedResultDefinitions.sort(),
    capabilities: clone(field.capabilities),
    permitted_operators: [...field.permitted_operators],
    value_vocabulary: field.value_vocabulary_required
      ? identity(`${field.field_key.toUpperCase()}_VALUE_REGISTRY`)
      : null,
    certification_identity:
      identity(`${field.field_key.toUpperCase()}_FIELD_CERTIFICATION`),
  };
}

function productFieldManifest() {
  const registry = sourceRegistry();
  return buildProductFieldCatalogueManifest({
    source_registry: registry,
    release_admission: {
      schema_version: 'PRODUCT_FIELD_RELEASE_ADMISSION/V1',
      approved_pm_data_version_id: registry.approved_pm_data_version_id,
      candidate_release_manifest_id:
        digest('candidate-release-manifest'),
      candidate_release_manifest_payload_digest:
        digest('candidate-release-manifest-payload'),
      source_registry_admission: sourceRegistryAdmission(registry),
      catalogue_generator_identity:
        identity('PRODUCT_FIELD_CATALOGUE_GENERATOR'),
      shared_deal_fact_specification_identity:
        identity('SHARED_DEAL_FACT_SPECIFICATION'),
      process_specification_identity:
        identity('PROCESS_INTELLIGENCE_SPECIFICATION'),
      field_admissions: registry.field_definitions.map(fieldAdmission),
      field_exclusions: [],
      previous_catalogue_identity: null,
    },
  });
}

function queryAdmission(manifest) {
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: manifest.approved_pm_data_version_id,
    candidate_release_manifest_id:
      manifest.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      manifest.candidate_release_manifest_payload_digest,
    canonical_contract_identity:
      identity('CANONICAL_CONTRACT_BUNDLE'),
    product_field_catalogue:
      productFieldCatalogueQueryAdmission(manifest),
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('navigation-catalogue'),
      payload_digest: digest('navigation-payload'),
    },
    predicate_admissions: [{
      domain_key: 'PROCESS',
      predicate_key: 'EXCLUSIVITY_GRANTED',
      predicate_version: 1,
      admission_id: digest('process-predicate-admission'),
      result_definitions: [clone(PROCESS_RESULT_DEFINITION)],
      evidence_requirement_ids: [
        'EXACT_PASSAGE',
        'EXACT_SOURCE_CITATION',
      ],
    }],
    exact_detail_actions: [
      SELECTED_SOURCE_ACTION,
      CONTEXT_ACTION,
    ],
    coverage_identities: [digest('coverage:PROCESS')],
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function productQueryIr(manifest) {
  return compileProductQueryIr({
    admission: queryAdmission(manifest),
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
        cohort_definition_id: digest('cohort:PROCESS'),
        cohort_definition_payload_digest:
          digest('cohort-payload:PROCESS'),
      },
      filters: [{
        field_key: 'process_phase',
        field_version: 1,
        operator: 'EQ',
        value: 'PRE_SIGNING',
      }],
      sort: [{
        field_key: 'deal',
        field_version: 1,
        direction: 'ASC',
      }],
      diversity: {
        definition_id: digest('diversity:PROCESS'),
        payload_digest: digest('diversity-payload:PROCESS'),
      },
      requested_columns: [
        'deal',
        'law_firm',
        'process_phase',
        'structure',
        'value',
      ].map((fieldKey) => ({
        field_key: fieldKey,
        field_version: 1,
      })),
      pagination: {
        page_size: 12,
        cursor: null,
      },
      detail_actions: [
        SELECTED_SOURCE_ACTION,
        CONTEXT_ACTION,
      ],
      coverage: {
        coverage_identity: digest('coverage:PROCESS'),
        coverage_payload_digest:
          digest('coverage-payload:PROCESS'),
        covered_set_identity: digest('covered:PROCESS'),
        exclusions_identity: digest('exclusions:PROCESS'),
      },
    },
  });
}

function sourceText(ordinal) {
  return ordinal === 1
    ? 'On September 12, 2025, Metsera agreed to negotiate exclusively with Pfizer.'
    : `Exact Metsera exclusivity precedent passage ${ordinal}.`;
}

function sourceInterval(ordinal) {
  const text = sourceText(ordinal);
  const start = ordinal * 1000;
  return {
    admitted_source_occurrence_id: id(`source-occurrence:${ordinal}`),
    document_hash: id('metsera-document-hash'),
    document_ordinal: 0,
    start_utf8_byte: start,
    end_utf8_byte: start + Buffer.byteLength(text, 'utf8'),
    exact_text_digest: sha256Hex(Buffer.from(text, 'utf8')),
  };
}

function narrationOccurrence(ordinal) {
  const interval = sourceInterval(ordinal);
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
    governed_ordinal: ordinal,
  });
}

function resultIdentity(occurrence, ordinal) {
  return buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: DEAL,
    precomputed_process_narration_occurrence_id:
      occurrence.process_narration_occurrence_id,
    exact_evidence_role_slot_key: 'DIRECT_PREDICATE_WITNESS',
    governed_ordinal: ordinal,
  });
}

function evidenceEdge(ordinal, release) {
  const body = {
    schema_version: PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
    evidence_role_key: 'DIRECT_PREDICATE_WITNESS',
    ...sourceInterval(ordinal),
    source_document_identity: id('metsera-source-document'),
    source_revision_id: id('metsera-source-revision'),
    evidence_validation_receipt_id:
      id(`evidence-validation:${ordinal}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
    'evidence_edge_id',
    body,
  );
}

function narrationRevision(
  occurrence,
  edge,
  ordinal,
  release,
) {
  const identityBody = {
    claim_revision_ids: [id(`claim-revision:${ordinal}`)],
    evidence_edges: [edge],
    process_narration_occurrence_id:
      occurrence.process_narration_occurrence_id,
    relationship_revision_ids: [],
    revision_status: 'PRESENT',
    source_backed_attributes: {
      drafting_class: 'EXCLUSIVITY_EXPRESS_GRANT',
    },
  };
  return {
    schema_version: PROCESS_NARRATION_REVISION_SCHEMA,
    process_narration_revision_id: contentId(
      PROCESS_NARRATION_REVISION_SCHEMA,
      identityBody,
    ),
    process_narration_occurrence: occurrence,
    claim_revision_ids: identityBody.claim_revision_ids,
    evidence_edges: identityBody.evidence_edges,
    relationship_revision_ids: identityBody.relationship_revision_ids,
    revision_status: identityBody.revision_status,
    source_backed_attributes: identityBody.source_backed_attributes,
    conflict_state: 'NO_CONFLICT',
    ...release,
    revision_validation_receipt_id:
      id(`narration-validation:${ordinal}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
}

function witnessRevision(result, edge, ordinal, release) {
  const witnessIdentityBody = {
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
    governed_ordinal: ordinal,
  };
  const witness = {
    ...witnessIdentityBody,
    process_predicate_witness_id: contentId(
      'PROCESS_PREDICATE_WITNESS/V1',
      witnessIdentityBody,
    ),
  };
  const bidderTrack = id(`bidder-track-revision:${ordinal}`);
  const passage = id(`process-passage-revision:${ordinal}`);
  const revisionIdentity = {
    bidder_track_revision_id: bidderTrack,
    evidence_edges: [edge],
    predicate_key: 'EXCLUSIVITY_ACTUAL_DRAFTING',
    predicate_state: 'PRESENT',
    process_agreement_revision_ids: [],
    process_event_revision_id: null,
    process_participant_revision_ids: [],
    process_passage_revision_ids: [passage],
    process_position_revision_ids: [],
    process_predicate_witness_id: witness.process_predicate_witness_id,
    process_relationship_revision_ids: [],
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
    bidder_track_revision_id: revisionIdentity.bidder_track_revision_id,
    evidence_edges: revisionIdentity.evidence_edges,
    predicate_key: revisionIdentity.predicate_key,
    predicate_state: revisionIdentity.predicate_state,
    process_agreement_revision_ids: [],
    process_event_revision_id: null,
    process_participant_revision_ids: [],
    process_passage_revision_ids:
      revisionIdentity.process_passage_revision_ids,
    process_position_revision_ids: [],
    process_relationship_revision_ids: [],
    subject_code: revisionIdentity.subject_code,
    temporal_expression_revision_ids: [],
    dimension_revision_bindings: [
      {
        terminal_type: 'BIDDER_TRACK_REVISION',
        revision_id: bidderTrack,
        evidence_edge_ids: [edge.evidence_edge_id],
        external_validation_receipt_id:
          id(`track-validation:${ordinal}`),
        validation_state: 'EXTERNALLY_VALIDATED',
        authority_state: 'NOT_GRANTED',
      },
      {
        terminal_type: 'PROCESS_PASSAGE_REVISION',
        revision_id: passage,
        evidence_edge_ids: [edge.evidence_edge_id],
        external_validation_receipt_id:
          id(`passage-validation:${ordinal}`),
        validation_state: 'EXTERNALLY_VALIDATED',
        authority_state: 'NOT_GRANTED',
      },
    ],
    ...release,
    revision_validation_receipt_id:
      id(`witness-validation:${ordinal}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
}

function resultLineage(result, narration, witness, ordinal, release) {
  const body = {
    schema_version: PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
    process_phrasebook_passage_result_id:
      result.process_phrasebook_passage_result_id,
    ...release,
    terminal_bindings: [
      {
        terminal_type: 'PROCESS_NARRATION_REVISION',
        stable_occurrence_id:
          narration.process_narration_occurrence
            .process_narration_occurrence_id,
        selected_revision_id: narration.process_narration_revision_id,
        canonical_payload_digest: payloadDigest(narration),
        evidence_edge_ids: [narration.evidence_edges[0].evidence_edge_id],
      },
      {
        terminal_type: 'PREDICATE_WITNESS_REVISION',
        stable_occurrence_id:
          witness.process_predicate_witness_identity
            .process_predicate_witness_id,
        selected_revision_id: witness.predicate_witness_revision_id,
        canonical_payload_digest: payloadDigest(witness),
        evidence_edge_ids: [witness.evidence_edges[0].evidence_edge_id],
      },
    ],
    retelling_relationship_revision_ids: [],
    predicate_dimension_revision_bindings_digest:
      payloadDigest(witness.dimension_revision_bindings),
    lineage_validation_receipt_id:
      id(`lineage-validation:${ordinal}`),
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

function exactDetail(result, narration, edge, ordinal, release) {
  const body = {
    schema_version:
      PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
    process_phrasebook_passage_result_id:
      result.process_phrasebook_passage_result_id,
    ...release,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    source_interval: sourceInterval(ordinal),
    source_local_narration_id:
      narration.process_narration_occurrence
        .process_narration_occurrence_id,
    human_readable_source_label:
      `Metsera proxy, Background, passage ${ordinal}`,
    exact_detail_action: {
      stable_id: SELECTED_SOURCE_ACTION,
      version: 1,
    },
    reference_validation_receipt_id:
      id(`detail-validation:${ordinal}`),
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

function preview(
  result,
  narration,
  edge,
  detail,
  ordinal,
  release,
) {
  const text = sourceText(ordinal);
  const body = {
    schema_version: PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
    process_phrasebook_passage_result_id:
      result.process_phrasebook_passage_result_id,
    ...release,
    source_document_identity: edge.source_document_identity,
    source_revision_id: edge.source_revision_id,
    canonical_text_digest: id('metsera-canonical-document-text'),
    exact_source_interval: sourceInterval(ordinal),
    evidence_role_key: result.exact_evidence_role_slot_key,
    source_local_narration_id:
      narration.process_narration_occurrence
        .process_narration_occurrence_id,
    segmentation_projection_id:
      id(`segmentation-projection:${ordinal}`),
    verbatim_text: text,
    verbatim_text_digest: sha256Hex(Buffer.from(text, 'utf8')),
    truncation_state: 'COMPLETE',
    exact_detail_reference_id: detail.exact_detail_reference_id,
    preview_validation_receipt_id:
      id(`preview-validation:${ordinal}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return addContentId(
    PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
    'preview_id',
    body,
  );
}

function processCore(ordinal, release) {
  const occurrence = narrationOccurrence(ordinal);
  const result = resultIdentity(occurrence, ordinal);
  const edge = evidenceEdge(ordinal, release);
  const narration = narrationRevision(
    occurrence,
    edge,
    ordinal,
    release,
  );
  const witness = witnessRevision(result, edge, ordinal, release);
  const lineage = resultLineage(
    result,
    narration,
    witness,
    ordinal,
    release,
  );
  const detail = exactDetail(
    result,
    narration,
    edge,
    ordinal,
    release,
  );
  const matchedPreview = preview(
    result,
    narration,
    edge,
    detail,
    ordinal,
    release,
  );
  return {
    ordinal,
    occurrence,
    result,
    narration,
    witness,
    lineage,
    detail,
    matchedPreview,
  };
}

function orderingProjection(cores, ir, release) {
  const facts = cores.map((core) => {
    const body = {
      schema_version: PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
      result_identity: core.result,
      selected_narration_occurrence: core.occurrence,
      bidder_track_id: id(`bidder-track:${core.ordinal}`),
      narration_treatment: 'SOURCE_LOCAL_PRIMARY_NARRATION',
      candidate_release_manifest_id:
        release.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        release.candidate_release_manifest_payload_digest,
      external_validation_receipt_id:
        id(`ordering-validation:${core.ordinal}`),
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    };
    return addContentId(
      PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
      'ordering_fact_id',
      body,
    );
  });
  return compileProcessPassageOrder({
    product_query_definition_id: ir.query_definition_id,
    candidate_release_manifest_id:
      release.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      release.candidate_release_manifest_payload_digest,
    page_size: ir.pagination_contract.page_size,
    ordering_facts: [...facts].reverse(),
  });
}

function releaseMembership(core, ordering, release) {
  const body = {
    schema_version:
      PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
    process_phrasebook_passage_result_id:
      core.result.process_phrasebook_passage_result_id,
    result_identity_payload_digest: core.result.canonical_payload_digest,
    process_narration_revision_id:
      core.narration.process_narration_revision_id,
    predicate_witness_revision_id:
      core.witness.predicate_witness_revision_id,
    result_input_lineage_id: core.lineage.result_input_lineage_id,
    matched_passage_preview_id: core.matchedPreview.preview_id,
    ordering_projection_id: ordering.ordering_projection_id,
    exact_detail_reference_id: core.detail.exact_detail_reference_id,
    ...release,
    source_document_identity:
      core.matchedPreview.source_document_identity,
    membership_validation_receipt_id:
      id(`membership-validation:${core.ordinal}`),
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

function processAdmission(core, ordering, release) {
  const input = {
    result_identity: core.result,
    narration_revision: core.narration,
    predicate_witness_revision: core.witness,
    result_input_lineage: core.lineage,
    matched_passage_preview: core.matchedPreview,
    passage_order_projection: ordering,
    candidate_release_membership:
      releaseMembership(core, ordering, release),
    exact_detail_reference: core.detail,
  };
  return {
    input,
    receipt: compileProcessPhrasebookResultAdmission(input),
  };
}

function resultValues(ordinal) {
  return {
    deal: ordinal === 1 ? 'Metsera, Inc.' : `Metsera process ${ordinal}`,
    law_firm: [{
      firm_name: 'Goodwin Procter LLP',
      represented_party: 'TARGET',
      role: 'LEGAL_COUNSEL',
      source_identity: digest(`law-firm-source:${ordinal}`),
    }],
    process_phase: 'PRE_SIGNING',
    structure: 'MERGER',
    value: {
      amount: 4700000000,
      currency: 'USD',
      basis: 'EQUITY_VALUE',
      source_identity: digest(`press-release:${ordinal}`),
    },
  };
}

function resultFields(ir, ordinal) {
  const values = resultValues(ordinal);
  return ir.presentation_contract.requested_columns.map((reference) => ({
    field_reference: clone(reference),
    value: clone(values[reference.field_key]),
  }));
}

function domainResultForAdmission(processInput) {
  const payload = processInput.matched_passage_preview.verbatim_text;
  const payloadDigestValue = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: PRODUCT_DOMAIN_VALIDATOR.stable_id,
    validator_version: PRODUCT_DOMAIN_VALIDATOR.version,
    validated_payload_digest: payloadDigestValue,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: 'PROCESS',
    domain_result_definition: clone(PROCESS_RESULT_DEFINITION),
    domain_result_identity:
      processInput.result_identity.process_phrasebook_passage_result_id,
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigestValue,
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

function productAdmissionReceipt(ir, domainResult, fields, ordinal) {
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
      id(`adapter-admission:${ordinal}`),
    domain_validation_receipt_id:
      domainResult.domain_result_validation.validation_receipt_id,
    query_coverage_identity: ir.coverage_contract.coverage_identity,
    covered_set_identity: ir.coverage_contract.covered_set_identity,
    query_cohort_identity: ir.cohort_contract.cohort_definition_id,
    predicate_evaluation_state: 'PASS',
    cohort_evaluation_state: 'PASS',
    filter_evaluation_state: 'PASS',
    covered_set_membership_state: 'PASS',
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

function adapterMember(process, ir, ordinal) {
  const fields = resultFields(ir, ordinal);
  const domainResult = domainResultForAdmission(process.input);
  const singleResultAdapterInput = {
    process_admission_input: process.input,
    process_admission_receipt: process.receipt,
    product_query_ir: ir,
    result_fields: fields,
    product_admission_receipt:
      productAdmissionReceipt(ir, domainResult, fields, ordinal),
  };
  return {
    single_result_adapter_input: singleResultAdapterInput,
    single_result_adapter_receipt:
      compileProcessPhrasebookSharedRowBridge(singleResultAdapterInput),
  };
}

function coverageCertification(ir) {
  return {
    coverage_certification_identity:
      digest('process-coverage-certification'),
    query_coverage_identity: ir.coverage_contract.coverage_identity,
    covered_set_identity: ir.coverage_contract.covered_set_identity,
    coverage_certification_state: 'CERTIFIED_COMPLETE',
    covered_deal_count: 12,
    excluded_deal_count: 2,
    operational_state: 'COMPLETE',
  };
}

function orderingReceipt(ir, ordering, members, failures) {
  const byDomainResult = new Map([
    ...members.map((member) => [
      member.single_result_adapter_receipt.product_query_result
        .domain_result_identity,
      member.single_result_adapter_receipt.product_query_result
        .product_query_result_identity,
    ]),
    ...failures.map((failure) => [
      failure.failed_domain_result_identity,
      failure.failure_identity,
    ]),
  ]);
  const projectedSlots = ordering.ordered_result_ids.map(
    (resultId) => byDomainResult.get(resultId),
  );
  const emittedCount = ordering.first_page_result_ids.length;
  const allSlotIds = [
    ...members.map(
      (member) => member.single_result_adapter_receipt
        .product_query_result.product_query_result_identity,
    ),
    ...failures.map((failure) => failure.failure_identity),
  ];
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: 'PROCESS',
    complete_candidate_slot_identities: allSlotIds.sort(),
    ordered_slot_identities: projectedSlots.slice(0, emittedCount),
    excluded_slot_identities: projectedSlots.slice(emittedCount),
    ordering_validator_stable_id:
      PROCESS_ORDERING_VALIDATOR_STABLE_ID,
    ordering_validator_version:
      PROCESS_ORDERING_VALIDATOR_VERSION,
    domain_ordering_projection_schema_version:
      PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
    domain_ordering_projection_identity:
      ordering.ordering_projection_id,
    domain_ordering_projection_payload_digest:
      ordering.canonical_payload_digest,
    external_validation_receipt_id:
      digest('process-ordering-external-validation'),
    validation_state:
      PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    ordering_receipt_id: contentId(
      PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  };
}

function fixture({
  count = 14,
  failedOrdinal = null,
} = {}) {
  const manifest = productFieldManifest();
  const ir = productQueryIr(manifest);
  const release = {
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    corpus_release_id: digest('metsera-corpus-release'),
  };
  const cores = Array.from(
    { length: count },
    (_, index) => processCore(index + 1, release),
  );
  const ordering = orderingProjection(cores, ir, release);
  const members = [];
  const failures = [];
  for (const core of cores) {
    if (core.ordinal === failedOrdinal) {
      failures.push(compileProductResultSlotFailure({
        disposition: `INVALID_METSERA_RESULT_${core.ordinal}`,
        failed_domain_result_identity:
          core.result.process_phrasebook_passage_result_id,
      }));
      continue;
    }
    members.push(adapterMember(
      processAdmission(core, ordering, release),
      ir,
      core.ordinal,
    ));
  }
  return {
    manifest,
    ir,
    input: {
      valid_adapter_members: [...members].reverse(),
      external_failed_slots: failures,
      product_query_ir: ir,
      domain_ordering_projection: ordering,
      ordering_receipt:
        orderingReceipt(ir, ordering, members, failures),
      coverage_certification: coverageCertification(ir),
    },
  };
}

function understoodQuestion() {
  return {
    domain_key: 'PROCESS',
    topic_key: 'DEAL_PROTECTION_PROCESS',
    pattern_key: 'EXCLUSIVITY_GRANTED',
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    label: 'Exclusivity granted',
  };
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

test('preserves 12 governed Metsera results and excludes the next page', () => {
  const { input } = fixture();
  const first = compileProcessPhrasebookProductResultSetBridge(input);
  const second = compileProcessPhrasebookProductResultSetBridge(
    clone(input),
  );

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(
    first.schema_version,
    PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT_SCHEMA,
  );
  assert.equal(first.valid_adapter_members.length, 14);
  assert.equal(first.product_result_set.ordered_result_slots.length, 12);
  assert.equal(
    first.product_result_set.query_execution_summary
      .excluded_result_count,
    2,
  );
  assert.deepEqual(
    first.product_result_set.ordered_result_slots.map(
      (slot) => slot.product_query_result.domain_result_identity,
    ),
    input.domain_ordering_projection.first_page_result_ids,
  );
  assert.equal(
    first.product_result_set.ordered_result_slots[0]
      .product_query_result.exact_detail_action,
    SELECTED_SOURCE_ACTION,
  );
  assert.equal(
    first.product_result_set.ordered_result_slots[0]
      .product_query_result.exact_citation.source_interval
      .exact_text_digest,
    sha256Hex(Buffer.from(sourceText(1), 'utf8')),
  );
  assert.equal(
    validateProcessPhrasebookProductResultSetBridgeReceipt(first),
    true,
  );
  assert.deepEqual(
    canonicalProcessPhrasebookProductResultSetBridgeReceiptBytes(first),
    Buffer.from(canonicalJson(first), 'utf8'),
  );
});

test('retains one external typed failure in governed order', () => {
  const { input } = fixture({
    count: 8,
    failedOrdinal: 3,
  });
  const output = compileProcessPhrasebookProductResultSetBridge(input);
  const failed = output.product_result_set.ordered_result_slots[2];

  assert.equal(output.valid_adapter_members.length, 7);
  assert.equal(output.external_failed_slots.length, 1);
  assert.equal(failed.slot_state, 'UNAVAILABLE');
  assert.deepEqual(failed.failure, output.external_failed_slots[0]);
  assert.equal(
    failed.failure.failed_domain_result_identity,
    input.domain_ordering_projection.first_page_result_ids[2],
  );
  assert.equal(
    output.product_result_set.query_execution_summary.failed_result_count,
    1,
  );
});

test('returns every available result when fewer than eight exist', () => {
  const output = compileProcessPhrasebookProductResultSetBridge(
    fixture({ count: 3 }).input,
  );

  assert.equal(output.product_result_set.ordered_result_slots.length, 3);
  assert.equal(
    output.product_result_set.query_execution_summary.valid_result_count,
    3,
  );
  assert.equal(
    output.product_result_set.query_execution_summary
      .excluded_result_count,
    0,
  );
});

test('hands only exact result-set output to Product presentation', () => {
  const { input, ir, manifest } = fixture({ count: 8 });
  const receipt =
    compileProcessPhrasebookProductResultSetBridge(input);
  const output = compileProcessPhrasebookProductResultPresentation({
    validated_result_set_adapter_receipt: receipt,
    product_query_ir: ir,
    product_field_catalogue_manifest: manifest,
    understood_legal_question: understoodQuestion(),
  });
  const presentation = output.product_result_presentation;

  assert.deepEqual(output.result_set_adapter_receipt, receipt);
  assert.equal(validateProductResultPresentation(presentation), true);
  assert.equal(presentation.result_slots.length, 8);
  assert.equal(presentation.result_slots[0].exact_content, sourceText(1));
  assert.equal(
    presentation.result_slots[0].exact_detail_action,
    SELECTED_SOURCE_ACTION,
  );
  assert.deepEqual(
    presentation.result_slots[0].exact_citation,
    receipt.product_result_set.ordered_result_slots[0]
      .product_query_result.exact_citation,
  );
  assert.equal(
    presentation.result_slots[0].action_targets
      .some((action) => action.action_kind === 'COPY_EXACT_PASSAGE'),
    true,
  );
  assert.equal(
    Object.hasOwn(
      presentation,
      'valid_adapter_members',
    ),
    false,
  );
});

test('rejects changed members, duplicates, stale queries and mixed failures', () => {
  const changedMember = fixture({ count: 3 });
  changedMember.input = clone(changedMember.input);
  changedMember.input.valid_adapter_members[0]
    .single_result_adapter_receipt.product_query_result
    .domain_result_payload = 'Rewritten.';
  assert.throws(
    () => compileProcessPhrasebookProductResultSetBridge(
      changedMember.input,
    ),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_VALID_MEMBER',
    },
  );

  const duplicate = fixture({ count: 3 });
  duplicate.input.valid_adapter_members[1] =
    clone(duplicate.input.valid_adapter_members[0]);
  assert.throws(
    () => compileProcessPhrasebookProductResultSetBridge(duplicate.input),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_VALID_MEMBER',
    },
  );

  const staleQuery = fixture({ count: 3 });
  staleQuery.input.product_query_ir = clone(staleQuery.input.product_query_ir);
  staleQuery.input.product_query_ir.query_definition_id =
    digest('stale-query');
  assert.throws(
    () => compileProcessPhrasebookProductResultSetBridge(staleQuery.input),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_QUERY_ORDER_BINDING',
    },
  );

  const mixed = fixture({ count: 3 });
  const validId = mixed.input.valid_adapter_members[0]
    .single_result_adapter_receipt.product_query_result
    .domain_result_identity;
  mixed.input.external_failed_slots.push(
    compileProductResultSlotFailure({
      disposition: 'INVALID_MIXED_RESULT',
      failed_domain_result_identity: validId,
    }),
  );
  assert.throws(
    () => compileProcessPhrasebookProductResultSetBridge(mixed.input),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_CANDIDATE_PARTITION',
    },
  );
});

test('rejects a changed receipt and presentation query', () => {
  const { input, ir, manifest } = fixture({ count: 3 });
  const receipt = clone(
    compileProcessPhrasebookProductResultSetBridge(input),
  );
  receipt.product_result_set.ordered_result_slots.reverse();
  assert.throws(
    () => validateProcessPhrasebookProductResultSetBridgeReceipt(receipt),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_RECEIPT',
    },
  );

  const validReceipt =
    compileProcessPhrasebookProductResultSetBridge(input);
  const changedQuery = clone(ir);
  changedQuery.query_definition_id = digest('another-query');
  assert.throws(
    () => compileProcessPhrasebookProductResultPresentation({
      validated_result_set_adapter_receipt: validReceipt,
      product_query_ir: changedQuery,
      product_field_catalogue_manifest: manifest,
      understood_legal_question: understoodQuestion(),
    }),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_PRESENTATION_INPUT',
    },
  );
});

test('does not mutate any external checked input', () => {
  const { input } = fixture({ count: 3 });
  const before = clone(input);

  compileProcessPhrasebookProductResultSetBridge(input);

  assert.deepEqual(input, before);
});

test('contains no external operation or independent result architecture', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/process-phrasebook-product-result-set-bridge.js',
    ),
    'utf8',
  );
  for (const prohibited of [
    'fetch(',
    'XMLHttpRequest',
    'supabase',
    'openai',
    'anthropic',
    'readFile',
    'writeFile',
    'child_process',
    'http.',
    'https.',
  ]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
  assert.equal(
    source.includes('compileProductQueryResultSet'),
    true,
  );
  assert.equal(
    source.includes('compileProductResultPresentation'),
    true,
  );
});

test('uses one exact three-file canonical-work-start allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/'
        + 'wp-process-phrasebook-product-result-set-bridge-v1.json',
    ),
    'utf8',
  ));

  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/'
      + 'wp-process-phrasebook-product-result-set-bridge-v1.json',
    'lib/canonical-v2/process-phrasebook-product-result-set-bridge.js',
    'tests/canonical-v2-process-phrasebook-product-result-set-bridge.test.js',
  ]);
});
