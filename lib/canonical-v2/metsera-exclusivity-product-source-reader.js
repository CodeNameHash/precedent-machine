const processNarrationContract = require(
  '../../contracts/canonical-v2/successor/process/narration/process-narration-occurrence.v1.json',
);
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  buildProductCandidateResultRecord,
} = require('./product-candidate-result-write');
const {
  PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA,
  PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
  PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA,
  compileProductSourceReaderAction,
  validateProductSourceReaderOutcome,
} = require('./product-source-reader-compiler');
const {
  validateProductActiveReleaseResolution,
} = require('./product-rerun-compiler');

const METSERA_PRODUCT_SOURCE_READER_SCHEMA =
  'METSERA_EXCLUSIVITY_PRODUCT_SOURCE_READER/V1';
const SELECTED_SOURCE_ACTION = 'PROCESS_NARRATION_EVIDENCE';
const AUTHORITY_LIMITS = Object.freeze({
  source_read: 'NONE',
  query_execution: 'NONE',
  serving: 'NONE',
  writer: 'NONE',
  database_write: 'NONE',
  release: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera Product source reader: ${message}`);
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

function withId(schema, idKey, body) {
  return {
    schema_version: body.schema_version,
    [idKey]: contentId(schema, body),
    ...body,
  };
}

function exactDetailReference(result, admission, candidateRecord) {
  const processReference =
    admission.admission_input.exact_detail_reference;
  const body = {
    schema_version: PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
    binding_kind: 'PARENT_PRODUCT_RESULT',
    binding_identity: result.product_query_result_identity,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    source_document_identity:
      result.exact_citation.source_document_identity,
    source_evidence_identity:
      result.exact_citation.source_evidence_identity,
    domain_reference_identity:
      processReference.exact_detail_reference_id,
    reference_validation_receipt_id:
      candidateRecord.candidate_product_result_id,
    validation_state: 'EXTERNALLY_VALIDATED',
    execution_authority_state: 'NOT_GRANTED',
  };
  return withId(
    PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
    'exact_detail_reference_id',
    body,
  );
}

function sourceActionAdmission(result, reference) {
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
      stable_id: SELECTED_SOURCE_ACTION,
      version: 1,
      definition_digest: sha256Hex(Buffer.from(
        canonicalJson(processNarrationContract.definition),
        'utf8',
      )),
    },
    admitted_action_types: ['OPEN_SELECTED_SOURCE'],
    parent_exact_detail_reference_id:
      reference.exact_detail_reference_id,
    admission_state: 'RELEASE_ADMITTED',
    execution_authority_state: 'NOT_GRANTED',
  };
  return withId(
    PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA,
    'admission_id',
    body,
  );
}

function ownerBinding(m1Permission) {
  if (
    m1Permission?.vertical_slice_execution !== 'PASS'
    || m1Permission.production_authority !== 'NONE'
  ) {
    fail('the isolated-staging M1 permission is invalid');
  }
  const body = {
    schema_version: PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA,
    actor_principal_id: 'BEN_GOODCHILD',
    object_authorisation_receipt_id:
      m1Permission.m1_acknowledgement_id,
    runtime_authorisation_state: 'REQUIRED_BEFORE_USE',
  };
  return withId(
    PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA,
    'owner_binding_id',
    body,
  );
}

function buildSourceReader(candidateRecord, activeResolution, permission) {
  const rebuilt = buildProductCandidateResultRecord(
    candidateRecord.complete_write_set,
  );
  if (canonicalJson(rebuilt) !== canonicalJson(candidateRecord)) {
    fail('the candidate Product result record was changed');
  }
  validateProductActiveReleaseResolution(activeResolution);
  const writeSet = candidateRecord.complete_write_set;
  const result =
    writeSet.product_row.shared_row_adapter_receipt
      .product_query_result;
  const reference = exactDetailReference(
    result,
    writeSet.product_admission,
    candidateRecord,
  );
  const outcome = compileProductSourceReaderAction({
    product_result: result,
    active_release_resolution: activeResolution,
    domain_source_action_admission:
      sourceActionAdmission(result, reference),
    object_authorisation_binding: ownerBinding(permission),
    action_type: 'OPEN_SELECTED_SOURCE',
    action_input: {
      parent_exact_detail_reference: reference,
    },
  });
  validateProductSourceReaderOutcome(outcome);
  const body = {
    schema_version: METSERA_PRODUCT_SOURCE_READER_SCHEMA,
    candidate_product_result_id:
      candidateRecord.candidate_product_result_id,
    product_query_result_identity:
      result.product_query_result_identity,
    product_source_reader_outcome: outcome,
    source_reader_state: outcome.disposition
      ? 'TYPED_REFUSAL'
      : 'VALIDATED_NOT_EXECUTED',
    authority_limits: AUTHORITY_LIMITS,
  };
  return withId(
    METSERA_PRODUCT_SOURCE_READER_SCHEMA,
    'product_source_reader_receipt_id',
    body,
  );
}

function compileMetseraExclusivityProductSourceReader(
  candidateRecord,
  activeReleaseResolution,
  m1Permission,
) {
  return deepFreeze(buildSourceReader(
    clone(candidateRecord),
    clone(activeReleaseResolution),
    clone(m1Permission),
  ));
}

function validateMetseraExclusivityProductSourceReader(
  value,
  candidateRecord,
  activeReleaseResolution,
  m1Permission,
) {
  const rebuilt = buildSourceReader(
    clone(candidateRecord),
    clone(activeReleaseResolution),
    clone(m1Permission),
  );
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the source-reader receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_SOURCE_READER_SCHEMA,
  SELECTED_SOURCE_ACTION,
  compileMetseraExclusivityProductSourceReader,
  validateMetseraExclusivityProductSourceReader,
};
