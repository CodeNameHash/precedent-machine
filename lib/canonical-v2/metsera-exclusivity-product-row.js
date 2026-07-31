const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateProcessPhrasebookResultAdmissionReceipt,
} = require('./process-phrasebook-result-admission');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  compileProductQueryIr,
} = require('./product-query-ir');
const {
  PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
  validatePilotProductAuthorityContext,
} = require('./pilot-product-authority-context');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
} = require('./product-citation-share-compiler');
const {
  PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  requestedFieldProjectionIdentity,
} = require('./product-query-result-compiler');
const {
  PRODUCT_DOMAIN_VALIDATOR,
  compileProcessPhrasebookSharedRowBridge,
} = require('./process-phrasebook-shared-row-bridge');
const METSERA_PRODUCT_ROW_SCHEMA =
  'METSERA_EXCLUSIVITY_PRODUCT_ROW/V1';
const PROCESS_RESULT_DEFINITION = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const AUTHORITY_LIMITS = Object.freeze({
  query_execution: 'NONE',
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
const CHECKED_PROCESS_EVIDENCE_KEYS = Object.freeze([
  'result_identity',
  'narration_revision',
  'predicate_witness_revision',
  'atomic_response_predicate_witness_revision',
  'result_input_lineage',
  'matched_passage_preview',
  'exact_detail_reference',
]);
const CANDIDATE_RELEASE_BINDING_KEYS = Object.freeze([
  'candidate_release_manifest_id',
  'candidate_release_manifest_payload_digest',
  'corpus_release_id',
]);

function fail(message) {
  throw new Error(`Metsera Product row: ${message}`);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
}

function requireExactKeys(value, expected, label) {
  requireObject(value, label);
  if (
    canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) {
    fail(`${label} does not have the exact required fields`);
  }
}

function validateMetseraAdmission(value) {
  requireObject(value, 'Metsera Process admission');
  const {
    METSERA_PRODUCT_ADMISSION_SCHEMA,
  } = require('./metsera-exclusivity-product-admission');
  if (
    value.schema_version !== METSERA_PRODUCT_ADMISSION_SCHEMA
    || value.source_treatment
      !== 'PROCESS_NARRATION_NOT_ACTUAL_DRAFTING'
    || value.adapter_state !== 'VALIDATED_NOT_RELEASE_BOUND'
    || Object.values(value.authority_limits || {}).some(
      (state) => state !== 'NONE',
    )
  ) {
    fail('the Process admission state is invalid');
  }
  const body = clone(value);
  delete body.product_admission_adapter_receipt_id;
  if (
    value.product_admission_adapter_receipt_id !== contentId(
      METSERA_PRODUCT_ADMISSION_SCHEMA,
      body,
    )
  ) {
    fail('the Process admission identity was changed');
  }
  try {
    validateProcessPhrasebookResultAdmissionReceipt(
      value.admission_receipt,
      value.admission_input,
    );
  } catch (error) {
    fail(`the signed Process admission is invalid: ${error.code || error.message}`);
  }
  const witness = value.admission_input.predicate_witness_revision;
  const membership = value.admission_input.candidate_release_membership;
  if (
    witness.predicate_key !== 'EXCLUSIVITY_GRANTED'
    || witness.predicate_state !== 'PRESENT'
    || witness.source_semantic_kind !== 'GRANT'
    || membership.membership_state !== 'NOT_RELEASE_BOUND'
    || membership.candidate_release_manifest_id
      !== value.candidate_release_manifest_id
    || membership.candidate_release_manifest_payload_digest
      !== value.candidate_release_manifest_payload_digest
  ) {
    fail('the admitted Process result does not preserve the pre-write release boundary');
  }
}

function admittedSourceCitation(admission) {
  const preview = admission.admission_input.matched_passage_preview;
  const label = admission.admission_input.exact_detail_reference
    .human_readable_source_label;
  const match = /^Metsera (DEFM14A), filed (\d{4}-\d{2}-\d{2}), Background of the Merger, event (\d{4}-\d{2}-\d{2})$/.exec(label);
  if (
    !match
    || match[2] !== '2025-10-09'
    || match[3] !== '2025-08-17'
    || match[2] === match[3]
  ) {
    fail('the exact Process citation does not preserve admitted filing and event dates');
  }
  return {
    source_document_identity: preview.source_document_identity,
    source_revision_id: preview.source_revision_id,
    form_type: match[1],
    filed_on: match[2],
    issuer_name: 'Metsera',
    source_location_label: 'Background of the Merger',
    event_date: match[3],
  };
}

function authorityBoundContext(admission, authorityContext, authorityInput) {
  requireObject(authorityContext, 'Pilot Product authority context');
  requireObject(authorityInput, 'Pilot Product authority context input');
  try {
    validatePilotProductAuthorityContext(authorityContext, authorityInput);
  } catch (error) {
    fail(`the Pilot Product authority context is invalid: ${error.code || error.message}`);
  }
  if (
    authorityContext.schema_version !== PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA
    || authorityContext.candidate_release_manifest
      ?.candidate_release_manifest_id
      !== admission.candidate_release_manifest_id
    || authorityContext.candidate_release_manifest
      ?.canonical_payload_digest
      !== admission.candidate_release_manifest_payload_digest
  ) {
    fail('the Pilot Product authority context does not bind the admitted candidate release');
  }
  const queryAdmission = authorityContext.product_query_admission_context;
  if (
    !queryAdmission
    || queryAdmission.schema_version !== PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA
    || queryAdmission.candidate_release_manifest_id
      !== admission.candidate_release_manifest_id
    || queryAdmission.candidate_release_manifest_payload_digest
      !== admission.candidate_release_manifest_payload_digest
  ) {
    fail('the exact Product query admission context is absent or cross-release');
  }
  const predicateAdmissions = queryAdmission.predicate_admissions.filter(
    (entry) => (
      entry.domain_key === 'PROCESS'
      && entry.predicate_key === 'EXCLUSIVITY_GRANTED'
      && entry.predicate_version === 1
    ),
  );
  if (
    predicateAdmissions.length !== 1
    || canonicalJson(predicateAdmissions[0].result_definitions)
      !== canonicalJson([PROCESS_RESULT_DEFINITION])
    || canonicalJson(predicateAdmissions[0].evidence_requirement_ids.slice().sort())
      !== canonicalJson(['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'])
  ) {
    fail('the exact Process predicate admission is absent');
  }
  const coverageIdentity = contentId(
    'PILOT_PRODUCT_AUTHORITY_CONTEXT_COVERAGE_ADMISSION/V1',
    {
      approved_pm_data_version_id: authorityContext.approved_pm_data_version_id,
      candidate_release_manifest_id:
        authorityContext.candidate_release_manifest
          .candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        authorityContext.candidate_release_manifest
          .canonical_payload_digest,
      contract_bundle_id:
        authorityContext.canonical_contract_bundle.contract_bundle_id,
      contract_bundle_digest:
        authorityContext.canonical_contract_bundle.contract_bundle_digest,
      domain_key: predicateAdmissions[0].domain_key,
      predicate_key: predicateAdmissions[0].predicate_key,
      predicate_version: predicateAdmissions[0].predicate_version,
    },
  );
  if (!queryAdmission.coverage_identities.includes(coverageIdentity)) {
    fail('the exact Process coverage admission is absent');
  }
  return {
    authority_context: clone(authorityContext),
    coverage_identity: coverageIdentity,
    product_query_admission_context: clone(queryAdmission),
  };
}

function checkedProcessEvidence(input) {
  requireObject(input, 'Checked Process admission evidence');
  const evidence = {};
  for (const key of CHECKED_PROCESS_EVIDENCE_KEYS) {
    if (!(key in input)) {
      fail(`Checked Process admission evidence does not retain ${key}`);
    }
    evidence[key] = input[key];
  }
  return clone(evidence);
}

function queryDefinitionDigest(kind, evidence, authorityContext) {
  return contentId('METSERA_EXCLUSIVITY_PRODUCT_QUERY_DEFINITION/V1', {
    definition_kind: kind,
    checked_process_admission_evidence: {
      process_phrasebook_passage_result_id:
        evidence.result_identity.process_phrasebook_passage_result_id,
      result_identity_payload_digest:
        evidence.result_identity.canonical_payload_digest,
      narration_revision: evidence.narration_revision,
      predicate_witness_revision: evidence.predicate_witness_revision,
      atomic_response_predicate_witness_revision:
        evidence.atomic_response_predicate_witness_revision,
      result_input_lineage: evidence.result_input_lineage,
      matched_passage_preview: evidence.matched_passage_preview,
      exact_detail_reference: evidence.exact_detail_reference,
    },
    pilot_product_authority_context: authorityContext,
    candidate_release: authorityContext.candidate_release_manifest,
  });
}

function queryDefinition(kind, evidence, authorityContext) {
  const definitionInputDigest = queryDefinitionDigest(
    kind,
    evidence,
    authorityContext,
  );
  return {
    definition_id: contentId('METSERA_EXCLUSIVITY_PRODUCT_QUERY_DEFINITION_ID/V1', {
      definition_kind: kind,
      definition_input_digest: definitionInputDigest,
    }),
    payload_digest: contentId(
      'METSERA_EXCLUSIVITY_PRODUCT_QUERY_DEFINITION_PAYLOAD/V1',
      {
        definition_kind: kind,
        definition_input_digest: definitionInputDigest,
      },
    ),
  };
}

function buildProductQueryIr(admission, authority) {
  const evidence = checkedProcessEvidence(admission.admission_input);
  const cohort = queryDefinition(
    'METSERA_EXCLUSIVITY_COHORT',
    evidence,
    authority.authority_context,
  );
  const diversity = queryDefinition(
    'SOURCE_ORDER_DIVERSITY',
    evidence,
    authority.authority_context,
  );
  const coverage = queryDefinition(
    'METSERA_EXCLUSIVITY_COVERAGE',
    evidence,
    authority.authority_context,
  );
  const coveredSet = queryDefinition(
    'METSERA_EXCLUSIVITY_COVERED_SET',
    evidence,
    authority.authority_context,
  );
  const exclusions = queryDefinition(
    'METSERA_EXCLUSIVITY_COVERED_SET_EXCLUSIONS',
    evidence,
    authority.authority_context,
  );
  return compileProductQueryIr({
    admission: authority.product_query_admission_context,
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
        cohort_definition_id: cohort.definition_id,
        cohort_definition_payload_digest: cohort.payload_digest,
      },
      filters: [{
        field_key: 'process_outcome',
        field_version: 1,
        operator: 'EQ',
        value: 'EXCLUSIVITY_GRANTED',
      }],
      sort: [],
      diversity: {
        definition_id: diversity.definition_id,
        payload_digest: diversity.payload_digest,
      },
      requested_columns: [{
        field_key: 'process_outcome',
        field_version: 1,
      }],
      pagination: {
        page_size: 8,
        cursor: null,
      },
      detail_actions: [
        'PARENT_BOUND_PARAGRAPH_CONTEXT',
        'PROCESS_NARRATION_EVIDENCE',
      ],
      coverage: {
        coverage_identity: authority.coverage_identity,
        coverage_payload_digest: coverage.payload_digest,
        covered_set_identity: coveredSet.definition_id,
        exclusions_identity: exclusions.definition_id,
      },
    },
  });
}

function compileMetseraExclusivityProductQueryFromCheckedProcessEvidence(input) {
  requireExactKeys(input, [
    'checked_process_admission_evidence',
    'candidate_release_binding',
    'pilot_product_authority_context',
    'pilot_product_authority_input',
  ], 'Metsera checked Process query input');
  const candidateRelease = input.candidate_release_binding;
  requireExactKeys(
    candidateRelease,
    CANDIDATE_RELEASE_BINDING_KEYS,
    'Candidate release binding',
  );
  requireExactKeys(
    input.checked_process_admission_evidence,
    CHECKED_PROCESS_EVIDENCE_KEYS,
    'Checked Process admission evidence',
  );
  const evidence = checkedProcessEvidence(input.checked_process_admission_evidence);
  const admission = {
    candidate_release_manifest_id:
      candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      candidateRelease.candidate_release_manifest_payload_digest,
    admission_input: evidence,
  };
  const authority = authorityBoundContext(
    admission,
    clone(input.pilot_product_authority_context),
    clone(input.pilot_product_authority_input),
  );
  if (
    authority.authority_context.candidate_release_manifest.corpus_release_id
      !== candidateRelease.corpus_release_id
  ) {
    fail('the exact Product authority context does not bind the candidate corpus release');
  }
  return deepFreeze(buildProductQueryIr(admission, authority));
}

function domainResult(admission) {
  const input = admission.admission_input;
  const payload = input.matched_passage_preview.verbatim_text;
  const payloadDigest = sha256Hex(
    Buffer.from(canonicalJson(payload), 'utf8'),
  );
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
      input.result_identity.process_phrasebook_passage_result_id,
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

function resultFields() {
  return [{
    field_reference: {
      field_key: 'process_outcome',
      field_version: 1,
    },
    value: 'EXCLUSIVITY_GRANTED',
  }];
}

function buildProductAdmissionReceipt(
  admission,
  authority,
  queryIr,
  result,
  fields,
) {
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
    product_query_definition_id: queryIr.query_definition_id,
    approved_pm_data_version_id:
      queryIr.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      queryIr.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      queryIr.release_contract.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition: clone(result.domain_result_definition),
    domain_result_identity: result.domain_result_identity,
    domain_result_payload_digest: result.domain_result_payload_digest,
    domain_validator_admission_identity:
      contentId('METSERA_PRODUCT_DOMAIN_VALIDATOR_ADMISSION/V1', {
        product_admission_adapter_receipt_id:
          admission.product_admission_adapter_receipt_id,
        process_admission_receipt_id:
          admission.admission_receipt.admission_receipt_id,
        process_phrasebook_result_id:
          admission.admission_input.result_identity
            .process_phrasebook_passage_result_id,
        exact_detail_reference_id:
          admission.admission_input.exact_detail_reference
            .exact_detail_reference_id,
        matched_passage_preview_id:
          admission.admission_input.matched_passage_preview.preview_id,
        authority_context_id:
          authority.authority_context.authority_context_id,
        product_query_definition_id: queryIr.query_definition_id,
      }),
    domain_validation_receipt_id:
      result.domain_result_validation.validation_receipt_id,
    query_coverage_identity:
      queryIr.coverage_contract.coverage_identity,
    covered_set_identity:
      queryIr.coverage_contract.covered_set_identity,
    query_cohort_identity:
      queryIr.cohort_contract.cohort_definition_id,
    predicate_evaluation_state: 'PASS',
    cohort_evaluation_state: 'PASS',
    filter_evaluation_state: 'PASS',
    covered_set_membership_state: 'PASS',
    requested_field_projection_identity:
      requestedFieldProjectionIdentity({
        queryIr,
        domainResult: result,
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

function buildMetseraProductRow(admission, authorityContext, authorityInput) {
  validateMetseraAdmission(admission);
  const authority = authorityBoundContext(
    admission,
    authorityContext,
    authorityInput,
  );
  const queryIr = buildProductQueryIr(admission, authority);
  if (
    queryIr.query_definition_id
      !== admission.admission_input.passage_order_projection
        .product_query_definition_id
  ) {
    fail('the Process admission does not bind the exact Product Query IR');
  }
  const fields = resultFields();
  const result = domainResult(admission);
  const sourceCitation = admittedSourceCitation(admission);
  const productAdmissionReceipt = buildProductAdmissionReceipt(
    admission,
    authority,
    queryIr,
    result,
    fields,
  );
  const sharedRowReceipt = compileProcessPhrasebookSharedRowBridge({
    process_admission_input: admission.admission_input,
    process_admission_receipt: admission.admission_receipt,
    product_query_ir: queryIr,
    result_fields: fields,
    product_admission_receipt: productAdmissionReceipt,
    admitted_source_citation: sourceCitation,
  });
  const body = {
    schema_version: METSERA_PRODUCT_ROW_SCHEMA,
    product_admission_adapter_receipt_id:
      admission.product_admission_adapter_receipt_id,
    product_query_ir: queryIr,
    product_result_admission_receipt: productAdmissionReceipt,
    shared_row_adapter_receipt: sharedRowReceipt,
    row_state: 'VALIDATED_NOT_SERVED',
    authority_limits: AUTHORITY_LIMITS,
  };
  return {
    schema_version: body.schema_version,
    product_row_receipt_id: contentId(
      METSERA_PRODUCT_ROW_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compileMetseraExclusivityProductRow(
  productAdmission,
  authorityContext,
  authorityInput,
) {
  const admission = clone(productAdmission);
  validateMetseraAdmission(admission);
  return deepFreeze(buildMetseraProductRow(
    admission,
    clone(authorityContext),
    clone(authorityInput),
  ));
}

function compileMetseraExclusivityProductQuery(
  productAdmission,
  authorityContext,
  authorityInput,
) {
  const admission = clone(productAdmission);
  validateMetseraAdmission(admission);
  const authority = authorityBoundContext(
    admission,
    clone(authorityContext),
    clone(authorityInput),
  );
  return deepFreeze(buildProductQueryIr(admission, authority));
}

function validateMetseraExclusivityProductRow(
  value,
  productAdmission,
  authorityContext,
  authorityInput,
) {
  const rebuilt = buildMetseraProductRow(
    clone(productAdmission),
    clone(authorityContext),
    clone(authorityInput),
  );
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the Product row receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_ROW_SCHEMA,
  compileMetseraExclusivityProductQueryFromCheckedProcessEvidence,
  compileMetseraExclusivityProductQuery,
  compileMetseraExclusivityProductRow,
  admittedSourceCitation,
  validateMetseraExclusivityProductRow,
};
