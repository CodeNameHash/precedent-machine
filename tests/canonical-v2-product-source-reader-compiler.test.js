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
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
} = require('../lib/canonical-v2/product-rerun-compiler');
const {
  buildProcessPhrasebookResultIdentity,
} = require('../lib/canonical-v2/process-phrasebook-result');
const {
  ACTION_KEY: PROCESS_RELATED_PASSAGES_ACTION_KEY,
  PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
  PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
  PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
  PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA,
  PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA,
  compileProcessRelatedPassages,
} = require('../lib/canonical-v2/process-related-passages');
const {
  PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA,
  PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
  PRODUCT_PARENT_BOUND_CURSOR_SCHEMA,
  PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA,
  PRODUCT_SOURCE_READER_ACTION_SCHEMA,
  PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA,
  PRODUCT_SOURCE_READER_REFUSAL_SCHEMA,
  adaptProcessRelatedPassagesResponse,
  canonicalProductSourceReaderOutcomeBytes,
  compileProductSourceReaderAction,
  validateProductSourceReaderOutcome,
} = require('../lib/canonical-v2/product-source-reader-compiler');

const DOMAIN_FACTS = Object.freeze({
  AGREEMENT: Object.freeze({
    result_definition: Object.freeze({
      stable_id: 'AGREEMENT_COMPARABLE_RESULT',
      version: 1,
    }),
    field_key: 'seller_termination_fee_percent',
    exact_detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    representation_kind: 'STRUCTURED_RESULT',
  }),
  CVR: Object.freeze({
    result_definition: Object.freeze({
      stable_id: 'CVR_MILESTONE_RESULT',
      version: 1,
    }),
    field_key: 'cvr_milestone_status',
    exact_detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    representation_kind: 'STRUCTURED_RESULT',
  }),
  PROCESS: Object.freeze({
    result_definition: Object.freeze({
      stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      version: 1,
    }),
    field_key: 'process_phase',
    exact_detail_action: 'PARENT_BOUND_PARAGRAPH_CONTEXT',
    representation_kind: 'VERBATIM_TEXT',
  }),
});

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function withIdentity(schema, idKey, body) {
  return {
    schema_version: body.schema_version,
    [idKey]: contentId(schema, body),
    ...body,
  };
}

function processPassageIdentity(label, governedOrdinal) {
  return buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: digest('process-contract-pair'),
    governed_deal_admission_id: digest('process-deal'),
    precomputed_process_narration_occurrence_id:
      digest(`${label}:narration`),
    exact_evidence_role_slot_key: 'DIRECT_PREDICATE_WITNESS',
    governed_ordinal: governedOrdinal,
  });
}

function processRelatedPassagesFixture(result) {
  const parentIdentity = processPassageIdentity('parent', 50);
  const parentBody = {
    schema_version: PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
    parent_product_result_identity:
      result.product_query_result_identity,
    parent_result_identity: parentIdentity,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    source_document_identity:
      result.exact_citation.source_document_identity,
    binding_validation_receipt_id:
      digest('process-parent-binding-receipt'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  const parent = withIdentity(
    PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
    'parent_binding_id',
    parentBody,
  );
  const candidateChildren = [
    ['first', 1, 'SAME_BIDDER_TRACK', 'Same bidder track'],
    ['second', 2, 'SAME_PROCESS_PHASE', 'Same process phase'],
  ].map(([label, ordinal, relationshipKey, relationshipLabel]) => {
    const childIdentity = processPassageIdentity(label, ordinal);
    const childId =
      childIdentity.process_phrasebook_passage_result_id;
    const relationshipBody = {
      schema_version:
        PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA,
      parent_result_id:
        parentIdentity.process_phrasebook_passage_result_id,
      related_result_id: childId,
      relationship_definition_key_and_version: {
        key: relationshipKey,
        version: 1,
      },
      relationship_label: relationshipLabel,
      relationship_validation_receipt_id:
        digest(`process-relationship:${childId}`),
      resolution_state: 'RESOLVED',
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    };
    const relationship = withIdentity(
      PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA,
      'relationship_binding_id',
      relationshipBody,
    );
    const text = `Exact related drafting ${ordinal}.`;
    const previewBody = {
      schema_version: PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
      candidate_release_manifest_id:
        result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        result.candidate_release_manifest_payload_digest,
      source_document_identity:
        result.exact_citation.source_document_identity,
      source_revision_id: digest('process-source-revision'),
      canonical_text_digest: digest('process-canonical-text'),
      exact_source_interval: {
        start_utf8_byte: ordinal * 100,
        end_utf8_byte:
          (ordinal * 100) + Buffer.byteLength(text, 'utf8'),
        exact_text_digest: sha256Hex(Buffer.from(text, 'utf8')),
      },
      evidence_role_key:
        childIdentity.exact_evidence_role_slot_key,
      source_local_narration_id:
        childIdentity.precomputed_process_narration_occurrence_id,
      segmentation_projection_id:
        digest('process-segmentation-projection'),
      verbatim_text: text,
      verbatim_text_digest: sha256Hex(Buffer.from(text, 'utf8')),
      truncation_state: 'COMPLETE',
      preview_validation_receipt_id:
        digest(`process-preview:${childId}`),
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    };
    const preview = withIdentity(
      PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
      'preview_id',
      previewBody,
    );
    const candidateBody = {
      schema_version: PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
      related_result_identity: childIdentity,
      candidate_release_manifest_id:
        result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        result.candidate_release_manifest_payload_digest,
      source_document_identity:
        result.exact_citation.source_document_identity,
      relationship_binding: relationship,
      verbatim_passage_preview: preview,
      exact_detail_reference: exactDetailReference(
        result,
        'RELATED_CHILD_RESULT',
        childId,
        ordinal,
      ),
      candidate_validation_receipt_id:
        digest(`process-candidate:${childId}`),
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    };
    return withIdentity(
      PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
      'candidate_id',
      candidateBody,
    );
  });
  const projectionBody = {
    schema_version: PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA,
    parent_binding_id: parent.parent_binding_id,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    source_document_identity:
      result.exact_citation.source_document_identity,
    candidate_children: candidateChildren,
    projection_validation_receipt_id:
      digest('process-related-projection-receipt'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  const projection = withIdentity(
    PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA,
    'projection_id',
    projectionBody,
  );
  const callerInput = {
    action_key: PROCESS_RELATED_PASSAGES_ACTION_KEY,
    parent_result_id:
      parentIdentity.process_phrasebook_passage_result_id,
  };
  const response = compileProcessRelatedPassages({
    caller_input: callerInput,
    parent_binding: parent,
    release_projection: projection,
  });
  return {
    response,
    validationContext: {
      caller_input: callerInput,
      parent_binding: parent,
      release_projection: projection,
    },
  };
}

function activeRelease(release = 'ONE') {
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
    active_fence_identity: digest(`active-fence:${release}`),
    candidate_release_manifest_id: digest(`release:${release}`),
    candidate_release_manifest_payload_digest:
      digest(`release-payload:${release}`),
    resolution_state: 'FRESH_EXTERNAL_RESOLUTION',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    resolution_id: contentId(
      PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
      body,
    ),
    active_fence_identity: body.active_fence_identity,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    resolution_state: body.resolution_state,
    execution_authority_state: body.execution_authority_state,
  };
}

function productResult(
  domain = 'AGREEMENT',
  release = 'ONE',
  ordinal = 1,
) {
  const facts = DOMAIN_FACTS[domain];
  const payload = facts.representation_kind === 'VERBATIM_TEXT'
    ? `Exact ${domain} source passage ${ordinal}.`
    : {
      canonical_value: `${domain}_VALUE_${ordinal}`,
      state: 'PRESENT',
    };
  const payloadDigest = sha256Hex(
    Buffer.from(canonicalJson(payload), 'utf8'),
  );
  const validationBody = {
    validator_stable_id: `${domain}_RESULT_VALIDATOR`,
    validator_version: 1,
    validated_payload_digest: payloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  const domainValidation = {
    schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
    validator_stable_id: validationBody.validator_stable_id,
    validator_version: validationBody.validator_version,
    validation_receipt_id: contentId(
      PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      validationBody,
    ),
    validated_payload_digest:
      validationBody.validated_payload_digest,
    validation_state: validationBody.validation_state,
  };
  const identityInputs = {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_definition_id:
      digest(`query:${domain}:${release}`),
    approved_pm_data_version_id: digest(`pm-data:${release}`),
    candidate_release_manifest_id: digest(`release:${release}`),
    candidate_release_manifest_payload_digest:
      digest(`release-payload:${release}`),
    domain_key: domain,
    domain_result_definition_stable_id:
      facts.result_definition.stable_id,
    domain_result_definition_version:
      facts.result_definition.version,
    domain_result_identity:
      digest(`domain-result:${domain}:${release}:${ordinal}`),
  };
  const productResultIdentity = contentId(
    PRODUCT_QUERY_RESULT_SCHEMA,
    identityInputs,
  );
  const sourceDocumentIdentity = digest(
    `source-document:${domain}:${ordinal}`,
  );
  const sourceEvidenceIdentity = digest(
    `source-evidence:${domain}:${ordinal}`,
  );
  const citationTargetIdentity = contentId(
    PRODUCT_EXACT_CITATION_SCHEMA,
    {
      product_query_result_identity: productResultIdentity,
      candidate_release_manifest_id:
        identityInputs.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        identityInputs.candidate_release_manifest_payload_digest,
      source_document_identity: sourceDocumentIdentity,
      source_evidence_identity: sourceEvidenceIdentity,
    },
  );
  const exactCitation = {
    schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
    source_document_identity: sourceDocumentIdentity,
    source_evidence_identity: sourceEvidenceIdentity,
    source_representation_kind: facts.representation_kind,
    source_interval: facts.representation_kind === 'VERBATIM_TEXT'
      ? {
        start_utf8_byte: 100 * ordinal,
        end_utf8_byte: (100 * ordinal) + 50,
        exact_text_digest: payloadDigest,
      }
      : null,
    result_component_evidence_identity:
      facts.representation_kind === 'STRUCTURED_RESULT'
        ? digest(`component-evidence:${domain}:${ordinal}`)
        : null,
    source_accession_or_equivalent_identity:
      `ACCESSION-${domain}-${ordinal}`,
    source_filing_type: domain === 'CVR' ? null : 'DEFM14A',
    source_filing_date: domain === 'CVR' ? null : '2026-07-29',
    source_location_label: `Section ${ordinal}.01`,
    human_readable_source_label:
      `${domain} agreement, Section ${ordinal}.01`,
    citation_target_identity: citationTargetIdentity,
  };
  const filterContract = {
    clauses: [{
      field_key: facts.field_key,
      field_version: 1,
      operator: 'EQ',
      value: `${domain}_FILTER`,
    }],
  };
  const coverageContract = {
    coverage_identity: digest(`coverage:${domain}:${release}`),
    covered_set_identity: digest(`covered:${domain}:${release}`),
    exclusions_identity: digest(`exclusions:${domain}:${release}`),
  };
  const requestedFields = [
    {
      field_key: facts.field_key,
      field_version: 1,
    },
    {
      field_key: 'deal_name',
      field_version: 1,
    },
  ];
  return {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_result_identity: productResultIdentity,
    product_query_definition_id:
      identityInputs.product_query_definition_id,
    approved_pm_data_version_id:
      identityInputs.approved_pm_data_version_id,
    candidate_release_manifest_id:
      identityInputs.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      identityInputs.candidate_release_manifest_payload_digest,
    domain_key: domain,
    domain_result_definition: clone(facts.result_definition),
    domain_result_identity:
      identityInputs.domain_result_identity,
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigest,
    domain_result_validation: domainValidation,
    domain_result_source_representation_kind:
      facts.representation_kind,
    exact_citation: exactCitation,
    exact_detail_action: facts.exact_detail_action,
    query_provenance: {
      filter_contract: filterContract,
      filter_contract_digest: sha256Hex(
        Buffer.from(canonicalJson(filterContract), 'utf8'),
      ),
      coverage_contract: coverageContract,
      coverage_contract_digest: sha256Hex(
        Buffer.from(canonicalJson(coverageContract), 'utf8'),
      ),
      requested_field_references: requestedFields,
    },
    result_fields: [
      {
        field_reference: clone(requestedFields[0]),
        value: `${domain}_VALUE_${ordinal}`,
      },
      {
        field_reference: clone(requestedFields[1]),
        value: `${domain} DEAL ${ordinal}`,
      },
    ],
  };
}

function ownerBinding(label = 'reader') {
  const body = {
    schema_version: PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA,
    actor_principal_id: 'BEN_GOODCHILD',
    object_authorisation_receipt_id: digest(`owner:${label}`),
    runtime_authorisation_state: 'REQUIRED_BEFORE_USE',
  };
  return {
    schema_version: body.schema_version,
    owner_binding_id: contentId(
      PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA,
      body,
    ),
    actor_principal_id: body.actor_principal_id,
    object_authorisation_receipt_id:
      body.object_authorisation_receipt_id,
    runtime_authorisation_state:
      body.runtime_authorisation_state,
  };
}

function exactDetailReference(
  result,
  bindingKind = 'PARENT_PRODUCT_RESULT',
  bindingIdentity = result.product_query_result_identity,
  ordinal = 1,
) {
  const body = {
    schema_version: PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
    binding_kind: bindingKind,
    binding_identity: bindingIdentity,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    source_document_identity:
      result.exact_citation.source_document_identity,
    source_evidence_identity: bindingKind === 'PARENT_PRODUCT_RESULT'
      ? result.exact_citation.source_evidence_identity
      : digest(`related-evidence:${ordinal}`),
    domain_reference_identity:
      digest(`domain-reference:${bindingIdentity}:${ordinal}`),
    reference_validation_receipt_id:
      digest(`reference-receipt:${bindingIdentity}:${ordinal}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    exact_detail_reference_id: contentId(
      PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
      body,
    ),
    binding_kind: body.binding_kind,
    binding_identity: body.binding_identity,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    source_document_identity: body.source_document_identity,
    source_evidence_identity: body.source_evidence_identity,
    domain_reference_identity: body.domain_reference_identity,
    reference_validation_receipt_id:
      body.reference_validation_receipt_id,
    validation_state: body.validation_state,
    execution_authority_state: body.execution_authority_state,
  };
}

function sourceActionAdmission(
  result,
  stableId,
  admittedActionTypes,
  parentReference = null,
) {
  const body = {
    schema_version: PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA,
    product_query_result_identity:
      result.product_query_result_identity,
    product_query_definition_id:
      result.product_query_definition_id,
    approved_pm_data_version_id:
      result.approved_pm_data_version_id,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition: clone(result.domain_result_definition),
    domain_result_identity: result.domain_result_identity,
    domain_source_action: {
      stable_id: stableId,
      version: 1,
      definition_digest: digest(`source-action:${stableId}:1`),
    },
    admitted_action_types: admittedActionTypes,
    parent_exact_detail_reference_id:
      parentReference?.exact_detail_reference_id || null,
    admission_state: 'RELEASE_ADMITTED',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    admission_id: contentId(
      PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA,
      body,
    ),
    product_query_result_identity:
      body.product_query_result_identity,
    product_query_definition_id:
      body.product_query_definition_id,
    approved_pm_data_version_id:
      body.approved_pm_data_version_id,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    domain_key: body.domain_key,
    domain_result_definition: body.domain_result_definition,
    domain_result_identity: body.domain_result_identity,
    domain_source_action: body.domain_source_action,
    admitted_action_types: body.admitted_action_types,
    parent_exact_detail_reference_id:
      body.parent_exact_detail_reference_id,
    admission_state: body.admission_state,
    execution_authority_state: body.execution_authority_state,
  };
}

function parentCursor(result, direction, count = 0) {
  const opaqueCursor = `${direction}:${result.product_query_result_identity}`;
  const body = {
    schema_version: PRODUCT_PARENT_BOUND_CURSOR_SCHEMA,
    opaque_cursor: opaqueCursor,
    opaque_cursor_digest:
      sha256Hex(Buffer.from(opaqueCursor, 'utf8')),
    parent_product_result_identity:
      result.product_query_result_identity,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    direction,
    expanded_paragraph_count: count,
    server_issuance_receipt_id:
      digest(`cursor-receipt:${direction}:${count}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    cursor_id: contentId(PRODUCT_PARENT_BOUND_CURSOR_SCHEMA, body),
    opaque_cursor: body.opaque_cursor,
    opaque_cursor_digest: body.opaque_cursor_digest,
    parent_product_result_identity:
      body.parent_product_result_identity,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    direction: body.direction,
    expanded_paragraph_count: body.expanded_paragraph_count,
    server_issuance_receipt_id: body.server_issuance_receipt_id,
    validation_state: body.validation_state,
    execution_authority_state: body.execution_authority_state,
  };
}

function relatedCollection(result, childCount = 2) {
  const children = Array.from({ length: childCount }, (_, index) => {
    const ordinal = index + 1;
    const childIdentity = digest(`related-child:${ordinal}`);
    const text = `Exact related drafting ${ordinal}.`;
    return {
      related_child_result_identity: childIdentity,
      relationship_definition: {
        key: ordinal === 1 ? 'SAME_BIDDER_TRACK' : 'SAME_PROCESS_PHASE',
        version: 1,
      },
      relationship_label:
        ordinal === 1 ? 'Same bidder track' : 'Same process phase',
      verbatim_preview: {
        verbatim_text: text,
        verbatim_text_digest:
          sha256Hex(Buffer.from(text, 'utf8')),
        truncation_state: 'COMPLETE',
      },
      child_exact_detail_reference: exactDetailReference(
        result,
        'RELATED_CHILD_RESULT',
        childIdentity,
        ordinal,
      ),
    };
  });
  const body = {
    schema_version: PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA,
    parent_product_result_identity:
      result.product_query_result_identity,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    source_document_identity:
      result.exact_citation.source_document_identity,
    children,
    projection_validation_receipt_id:
      digest('related-projection-receipt'),
    validation_state: 'EXTERNALLY_VALIDATED',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    collection_id: contentId(
      PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA,
      body,
    ),
    parent_product_result_identity:
      body.parent_product_result_identity,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    source_document_identity: body.source_document_identity,
    children: body.children,
    projection_validation_receipt_id:
      body.projection_validation_receipt_id,
    validation_state: body.validation_state,
    execution_authority_state: body.execution_authority_state,
  };
}

function compile({
  domain = 'AGREEMENT',
  release = 'ONE',
  actionType = 'OPEN_SELECTED_SOURCE',
  stableId,
  actionInput,
  admittedActionTypes = [actionType],
  activeReleaseLabel = release,
} = {}) {
  const result = productResult(domain, release);
  const parentReference = exactDetailReference(result);
  const sourceActionStableId = stableId
    || (
      actionType === 'OPEN_SELECTED_SOURCE'
        ? result.exact_detail_action
        : actionType.startsWith('EXPAND_ONE_PARAGRAPH_')
          ? 'PARENT_BOUND_PARAGRAPH_CONTEXT'
          : 'RELATED_PASSAGE_CHILD_COLLECTION'
    );
  return compileProductSourceReaderAction({
    product_result: result,
    active_release_resolution: activeRelease(activeReleaseLabel),
    domain_source_action_admission: sourceActionAdmission(
      result,
      sourceActionStableId,
      admittedActionTypes,
      parentReference,
    ),
    object_authorisation_binding:
      ownerBinding(`${domain}:${actionType}`),
    action_type: actionType,
    action_input: actionInput || {
      parent_exact_detail_reference: parentReference,
    },
  });
}

test('compiles one immutable Agreement selected-source adapter', () => {
  const outcome = compile();

  assert.equal(outcome.schema_version, PRODUCT_SOURCE_READER_ACTION_SCHEMA);
  assert.equal(outcome.action_type, 'OPEN_SELECTED_SOURCE');
  assert.equal(outcome.delegation_plan.maximum_bounded_serving_queries, 1);
  assert.equal(outcome.delegation_plan.execution_state, 'NOT_EXECUTED');
  assert.equal(outcome.delegation_plan.source_read_state, 'NOT_PERFORMED');
  assert.equal(outcome.delegation_plan.response_state, 'NOT_MATERIALISED');
  assert.equal(outcome.authority_state, 'CANONICAL_ADAPTER_ONLY');
  assertDeepFrozen(outcome);
  assert.equal(validateProductSourceReaderOutcome(outcome), true);
  assert.equal(
    canonicalProductSourceReaderOutcomeBytes(outcome).toString('utf8'),
    canonicalJson(outcome),
  );
});

test('compiles both Process paragraph directions from exact cursors', () => {
  for (const [actionType, direction] of [
    ['EXPAND_ONE_PARAGRAPH_ABOVE', 'ABOVE'],
    ['EXPAND_ONE_PARAGRAPH_BELOW', 'BELOW'],
  ]) {
    const result = productResult('PROCESS');
    const outcome = compileProductSourceReaderAction({
      product_result: result,
      active_release_resolution: activeRelease(),
      domain_source_action_admission: sourceActionAdmission(
        result,
        'PARENT_BOUND_PARAGRAPH_CONTEXT',
        [actionType],
      ),
      object_authorisation_binding: ownerBinding(direction),
      action_type: actionType,
      action_input: {
        server_issued_parent_bound_cursor:
          parentCursor(result, direction, 11),
      },
    });

    assert.equal(outcome.schema_version, PRODUCT_SOURCE_READER_ACTION_SCHEMA);
    assert.equal(outcome.action_type, actionType);
  }
});

test('compiles list and exact-child Process related actions', () => {
  const result = productResult('PROCESS');
  const admission = sourceActionAdmission(
    result,
    'RELATED_PASSAGE_CHILD_COLLECTION',
    ['LIST_RELATED_PASSAGES', 'OPEN_RELATED_SOURCE'],
  );
  const collection = relatedCollection(result);
  const list = compileProductSourceReaderAction({
    product_result: result,
    active_release_resolution: activeRelease(),
    domain_source_action_admission: admission,
    object_authorisation_binding: ownerBinding('list'),
    action_type: 'LIST_RELATED_PASSAGES',
    action_input: {},
  });
  const child = collection.children[0];
  const open = compileProductSourceReaderAction({
    product_result: result,
    active_release_resolution: activeRelease(),
    domain_source_action_admission: admission,
    object_authorisation_binding: ownerBinding('child'),
    action_type: 'OPEN_RELATED_SOURCE',
    action_input: {
      parent_collection_binding: collection,
      related_child_result_identity:
        child.related_child_result_identity,
      child_exact_detail_reference:
        child.child_exact_detail_reference,
    },
  });

  assert.equal(list.schema_version, PRODUCT_SOURCE_READER_ACTION_SCHEMA);
  assert.equal(open.schema_version, PRODUCT_SOURCE_READER_ACTION_SCHEMA);
  assert.equal(open.action_type, 'OPEN_RELATED_SOURCE');
});

test('adapts the checked Process response into the Product collection', () => {
  const result = productResult('PROCESS');
  const fixture = processRelatedPassagesFixture(result);
  const collection = adaptProcessRelatedPassagesResponse({
    product_result: result,
    process_response: fixture.response,
    process_response_validation_context: fixture.validationContext,
  });

  assert.equal(
    collection.schema_version,
    PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA,
  );
  assert.equal(
    collection.parent_product_result_identity,
    result.product_query_result_identity,
  );
  assert.equal(
    collection.projection_validation_receipt_id,
    fixture.response.projection_validation_receipt_id,
  );
  assert.deepEqual(
    collection.children.map((child) => ({
      result: child.related_child_result_identity,
      relationship: child.relationship_definition,
      label: child.relationship_label,
      preview: child.verbatim_preview,
      reference: child.child_exact_detail_reference,
    })),
    fixture.response.children.map((child) => ({
      result: child.related_result_id,
      relationship:
        child.relationship_definition_key_and_version,
      label: child.relationship_label,
      preview: {
        verbatim_text:
          child.verbatim_passage_preview.verbatim_text,
        verbatim_text_digest:
          child.verbatim_passage_preview.verbatim_text_digest,
        truncation_state:
          child.verbatim_passage_preview.truncation_state,
      },
      reference: child.exact_detail_reference,
    })),
  );
  assert.equal(
    Object.hasOwn(collection.children[0].verbatim_preview, 'preview_id'),
    false,
  );
  assertDeepFrozen(collection);

  const child = collection.children[0];
  const outcome = compileProductSourceReaderAction({
    product_result: result,
    active_release_resolution: activeRelease(),
    domain_source_action_admission: sourceActionAdmission(
      result,
      'RELATED_PASSAGE_CHILD_COLLECTION',
      ['OPEN_RELATED_SOURCE'],
    ),
    object_authorisation_binding: ownerBinding('adapted-child'),
    action_type: 'OPEN_RELATED_SOURCE',
    action_input: {
      parent_collection_binding: collection,
      related_child_result_identity:
        child.related_child_result_identity,
      child_exact_detail_reference:
        child.child_exact_detail_reference,
    },
  });
  assert.equal(outcome.action_type, 'OPEN_RELATED_SOURCE');
});

test('rejects a Process response bound to another Product parent', () => {
  const result = productResult('PROCESS');
  const fixture = processRelatedPassagesFixture(result);

  assert.throws(
    () => adaptProcessRelatedPassagesResponse({
      product_result: productResult('PROCESS', 'ONE', 2),
      process_response: fixture.response,
      process_response_validation_context: fixture.validationContext,
    }),
    (error) => (
      error.code === 'INVALID_PRODUCT_PROCESS_RELATED_PASSAGES_RESPONSE'
      && /exact Product parent/.test(error.message)
    ),
  );
});

test('rejects a correctly rehashed forged Process response', () => {
  const result = productResult('PROCESS');
  const fixture = processRelatedPassagesFixture(result);
  const forged = clone(fixture.response);
  forged.children[0].relationship_label = 'Invented relationship';
  const body = clone(forged);
  delete body.response_id;
  forged.response_id = contentId(forged.schema_version, body);

  assert.throws(
    () => adaptProcessRelatedPassagesResponse({
      product_result: result,
      process_response: forged,
      process_response_validation_context: fixture.validationContext,
    }),
    (error) => (
      error.code === 'INVALID_PRODUCT_PROCESS_RELATED_PASSAGES_RESPONSE'
      && /not valid/.test(error.message)
    ),
  );
});

test('admits a later CVR selected-source action through registry data', () => {
  const outcome = compile({
    domain: 'CVR',
    stableId: 'CVR_MILESTONE_SOURCE_DETAIL',
  });

  assert.equal(outcome.parent_product_result.domain_key, 'CVR');
  assert.equal(
    outcome.domain_source_action_admission.domain_source_action.stable_id,
    'CVR_MILESTONE_SOURCE_DETAIL',
  );
});

test('returns typed refusals without changing the Product result', () => {
  const inactive = compile({
    release: 'OLD',
    activeReleaseLabel: 'NEW',
  });
  const unadmitted = compile({
    admittedActionTypes: ['LIST_RELATED_PASSAGES'],
  });
  const processResult = productResult('PROCESS');
  const badCursor = parentCursor(processResult, 'ABOVE');
  badCursor.opaque_cursor_digest = digest('forged-cursor');
  const invalidCursor = compileProductSourceReaderAction({
    product_result: processResult,
    active_release_resolution: activeRelease(),
    domain_source_action_admission: sourceActionAdmission(
      processResult,
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      ['EXPAND_ONE_PARAGRAPH_ABOVE'],
    ),
    object_authorisation_binding: ownerBinding('bad-cursor'),
    action_type: 'EXPAND_ONE_PARAGRAPH_ABOVE',
    action_input: {
      server_issued_parent_bound_cursor: badCursor,
    },
  });

  for (const [outcome, disposition] of [
    [inactive, 'RELEASE_NOT_ACTIVE'],
    [unadmitted, 'SOURCE_ACTION_NOT_ADMITTED'],
    [invalidCursor, 'INVALID_PARENT_BOUND_CURSOR'],
  ]) {
    assert.equal(outcome.schema_version, PRODUCT_SOURCE_READER_REFUSAL_SCHEMA);
    assert.equal(outcome.disposition, disposition);
    assert.equal(outcome.original_result_preserved, true);
    assert.equal(outcome.execution_state, 'NOT_EXECUTED');
    assert.equal(outcome.authority_state, 'NOT_GRANTED');
  }
});

test('binds an unadmitted selected-source refusal to the exact request', () => {
  const result = productResult();
  const admittedReference = exactDetailReference(result);
  const requestedReference = exactDetailReference(
    result,
    'PARENT_PRODUCT_RESULT',
    result.product_query_result_identity,
    2,
  );
  const outcome = compileProductSourceReaderAction({
    product_result: result,
    active_release_resolution: activeRelease(),
    domain_source_action_admission: sourceActionAdmission(
      result,
      result.exact_detail_action,
      ['OPEN_SELECTED_SOURCE'],
      admittedReference,
    ),
    object_authorisation_binding: ownerBinding('unadmitted-reference'),
    action_type: 'OPEN_SELECTED_SOURCE',
    action_input: {
      parent_exact_detail_reference: requestedReference,
    },
  });

  assert.equal(outcome.schema_version, PRODUCT_SOURCE_READER_REFUSAL_SCHEMA);
  assert.equal(outcome.disposition, 'SOURCE_ACTION_NOT_ADMITTED');
  assert.deepEqual(
    outcome.failure_evidence.requested_action_input,
    {
      parent_exact_detail_reference: requestedReference,
    },
  );
});

test('refuses a related child outside the exact parent collection', () => {
  const result = productResult('PROCESS');
  const collection = relatedCollection(result);
  const outsideIdentity = digest('outside-child');
  const outcome = compileProductSourceReaderAction({
    product_result: result,
    active_release_resolution: activeRelease(),
    domain_source_action_admission: sourceActionAdmission(
      result,
      'RELATED_PASSAGE_CHILD_COLLECTION',
      ['OPEN_RELATED_SOURCE'],
    ),
    object_authorisation_binding: ownerBinding('outside-child'),
    action_type: 'OPEN_RELATED_SOURCE',
    action_input: {
      parent_collection_binding: collection,
      related_child_result_identity: outsideIdentity,
      child_exact_detail_reference: exactDetailReference(
        result,
        'RELATED_CHILD_RESULT',
        outsideIdentity,
        99,
      ),
    },
  });

  assert.equal(outcome.schema_version, PRODUCT_SOURCE_READER_REFUSAL_SCHEMA);
  assert.equal(
    outcome.disposition,
    'RELATED_PASSAGE_NOT_IN_PARENT_COLLECTION',
  );
});

test('rejects result, release, admission and reference drift', () => {
  const result = productResult();
  const reference = exactDetailReference(result);
  const admission = sourceActionAdmission(
    result,
    result.exact_detail_action,
    ['OPEN_SELECTED_SOURCE'],
    reference,
  );

  const changedResult = clone(result);
  changedResult.domain_result_identity = digest('changed-result');
  assert.throws(
    () => compileProductSourceReaderAction({
      product_result: changedResult,
      active_release_resolution: activeRelease(),
      domain_source_action_admission: admission,
      object_authorisation_binding: ownerBinding('changed-result'),
      action_type: 'OPEN_SELECTED_SOURCE',
      action_input: {
        parent_exact_detail_reference: reference,
      },
    }),
    { code: 'INVALID_PRODUCT_QUERY_RESULT' },
  );

  const changedAdmission = clone(admission);
  changedAdmission.domain_key = 'PROCESS';
  assert.throws(
    () => compileProductSourceReaderAction({
      product_result: result,
      active_release_resolution: activeRelease(),
      domain_source_action_admission: changedAdmission,
      object_authorisation_binding: ownerBinding('changed-admission'),
      action_type: 'OPEN_SELECTED_SOURCE',
      action_input: {
        parent_exact_detail_reference: reference,
      },
    }),
    { code: 'INVALID_PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION' },
  );

  const changedReference = clone(reference);
  changedReference.source_evidence_identity = digest('changed-evidence');
  assert.throws(
    () => compileProductSourceReaderAction({
      product_result: result,
      active_release_resolution: activeRelease(),
      domain_source_action_admission: admission,
      object_authorisation_binding: ownerBinding('changed-reference'),
      action_type: 'OPEN_SELECTED_SOURCE',
      action_input: {
        parent_exact_detail_reference: changedReference,
      },
    }),
    { code: 'INVALID_PRODUCT_EXACT_DETAIL_REFERENCE' },
  );
});

test('rejects correctly self-rehashed nested authority forgery', () => {
  const outcome = clone(compile());
  outcome.delegation_plan.invented_authority = true;

  assert.throws(
    () => validateProductSourceReaderOutcome(outcome),
    { code: 'INVALID_PRODUCT_SOURCE_READER_ACTION' },
  );
});

test('rejects a correctly self-rehashed false refusal cause', () => {
  const outcome = clone(compile({
    release: 'OLD',
    activeReleaseLabel: 'NEW',
  }));
  outcome.active_release_resolution = activeRelease('OLD');
  const evidenceBody = {
    disposition: outcome.failure_evidence.disposition,
    action_type: outcome.failure_evidence.action_type,
    requested_action_input:
      outcome.failure_evidence.requested_action_input,
  };
  outcome.failure_evidence.failure_evidence_digest = sha256Hex(
    Buffer.from(canonicalJson(evidenceBody), 'utf8'),
  );
  const refusalBody = clone(outcome);
  delete refusalBody.source_reader_refusal_id;
  outcome.source_reader_refusal_id = contentId(
    PRODUCT_SOURCE_READER_REFUSAL_SCHEMA,
    refusalBody,
  );

  assert.throws(
    () => validateProductSourceReaderOutcome(outcome),
    { code: 'INVALID_PRODUCT_SOURCE_READER_REFUSAL' },
  );
});

test('contains no execution, source-read, database or UI path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/product-source-reader-compiler.js',
    ),
    'utf8',
  );

  assert.doesNotMatch(
    source,
    /require\(['"](?:node:)?(?:fs|http|https|net|child_process)['"]\)/,
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|query|execute|render|writeFile|readFile|createClient)\s*\(/,
  );
  assert.doesNotMatch(source, /\b(?:process\.env|supabase|postgres)\b/i);
});
