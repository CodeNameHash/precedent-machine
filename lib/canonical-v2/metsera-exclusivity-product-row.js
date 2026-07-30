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
  productFieldCatalogueQueryAdmission,
} = require('./product-field-catalogue');
const {
  buildPilotProductFieldCatalogueManifest,
} = require('./pilot-product-field-catalogue');
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
const {
  METSERA_PRODUCT_ADMISSION_SCHEMA,
} = require('./metsera-exclusivity-product-admission');

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

function validateMetseraAdmission(value) {
  requireObject(value, 'Metsera Process admission');
  if (
    value.schema_version !== METSERA_PRODUCT_ADMISSION_SCHEMA
    || value.source_treatment
      !== 'PROCESS_NARRATION_NOT_ACTUAL_DRAFTING'
    || value.adapter_state !== 'VALIDATED_NOT_SERVED'
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
    || membership.membership_state !== 'CANDIDATE_MEMBER'
    || membership.candidate_release_manifest_id
      !== value.candidate_release_manifest_id
    || membership.corpus_release_id !== value.corpus_release_id
  ) {
    fail('the admitted Process result does not prove the grant and membership');
  }
}

function querySeed(value) {
  requireObject(value, 'Metsera Product query seed');
  const seed = {
    materialisation_receipt_id: value.materialisation_receipt_id,
    candidate_release_manifest_id:
      value.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      value.candidate_release_manifest_payload_digest
      || value.admission_receipt
        ?.candidate_release_manifest_payload_digest,
  };
  for (const [key, digest] of Object.entries(seed)) {
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) {
      fail(`the query seed ${key} is invalid`);
    }
  }
  return seed;
}

function stableId(seed, label) {
  return contentId(METSERA_PRODUCT_ROW_SCHEMA, {
    ...querySeed(seed),
    label,
  });
}

function buildProductQueryIr(seedInput) {
  const seed = querySeed(seedInput);
  const candidateManifestId = seed.candidate_release_manifest_id;
  const candidatePayloadDigest =
    seed.candidate_release_manifest_payload_digest;
  const coverageIdentity = stableId(seed, 'coverage');
  const approvedPmDataVersionId =
    stableId(seed, 'approved-pm-data-version');
  const fieldManifest = buildPilotProductFieldCatalogueManifest({
    approved_pm_data_version_id: approvedPmDataVersionId,
    candidate_release_manifest_id: candidateManifestId,
    candidate_release_manifest_payload_digest:
      candidatePayloadDigest,
  });
  return compileProductQueryIr({
    admission: {
      schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
      approved_pm_data_version_id: approvedPmDataVersionId,
      candidate_release_manifest_id: candidateManifestId,
      candidate_release_manifest_payload_digest:
        candidatePayloadDigest,
      canonical_contract_identity: {
        stable_id: 'CANONICAL_CONTRACT_BUNDLE',
        version: 1,
        payload_digest: stableId(seed, 'canonical-contract'),
      },
      product_field_catalogue:
        productFieldCatalogueQueryAdmission(fieldManifest),
      navigation_catalogue: {
        stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
        catalogue_id: stableId(seed, 'navigation-catalogue'),
        payload_digest:
          stableId(seed, 'navigation-catalogue-payload'),
      },
      predicate_admissions: [{
        domain_key: 'PROCESS',
        predicate_key: 'EXCLUSIVITY_GRANTED',
        predicate_version: 1,
        admission_id: stableId(seed, 'predicate-admission'),
        result_definitions: [clone(PROCESS_RESULT_DEFINITION)],
        evidence_requirement_ids: [
          'EXACT_PASSAGE',
          'EXACT_SOURCE_CITATION',
        ],
      }],
      exact_detail_actions: [
        'PROCESS_NARRATION_EVIDENCE',
        'PARENT_BOUND_PARAGRAPH_CONTEXT',
      ],
      coverage_identities: [coverageIdentity],
      route_budget: {
        maximum_page_size: 12,
      },
    },
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
        cohort_definition_id: stableId(seed, 'metsera-cohort'),
        cohort_definition_payload_digest:
          stableId(seed, 'metsera-cohort-payload'),
      },
      filters: [{
        field_key: 'process_outcome',
        field_version: 1,
        operator: 'EQ',
        value: 'EXCLUSIVITY_GRANTED',
      }],
      sort: [],
      diversity: {
        definition_id: stableId(seed, 'source-order-diversity'),
        payload_digest:
          stableId(seed, 'source-order-diversity-payload'),
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
        'PROCESS_NARRATION_EVIDENCE',
        'PARENT_BOUND_PARAGRAPH_CONTEXT',
      ],
      coverage: {
        coverage_identity: coverageIdentity,
        coverage_payload_digest:
          stableId(seed, 'coverage-payload'),
        covered_set_identity:
          stableId(seed, 'covered-set'),
        exclusions_identity:
          stableId(seed, 'covered-set-exclusions'),
      },
    },
  });
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
      stableId(admission, 'domain-validator-admission'),
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

function buildMetseraProductRow(admission) {
  validateMetseraAdmission(admission);
  const queryIr = buildProductQueryIr(admission);
  if (
    queryIr.query_definition_id
      !== admission.admission_input.passage_order_projection
        .product_query_definition_id
  ) {
    fail('the Process admission does not bind the exact Product Query IR');
  }
  const fields = resultFields();
  const result = domainResult(admission);
  const productAdmissionReceipt = buildProductAdmissionReceipt(
    admission,
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

function compileMetseraExclusivityProductRow(productAdmission) {
  return deepFreeze(buildMetseraProductRow(clone(productAdmission)));
}

function compileMetseraExclusivityProductQuery(seed) {
  return deepFreeze(buildProductQueryIr(clone(seed)));
}

function validateMetseraExclusivityProductRow(value, productAdmission) {
  const rebuilt = buildMetseraProductRow(clone(productAdmission));
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the Product row receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_ROW_SCHEMA,
  compileMetseraExclusivityProductQuery,
  compileMetseraExclusivityProductRow,
  validateMetseraExclusivityProductRow,
};
