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
  buildQxoReviewedCapitalisationF27,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f27');
const {
  buildQxoCapitalisationCrossViewReleaseF27,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-cross-view-release-f27',
);
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  compileProductQueryIr,
} = require('../lib/canonical-v2/product-query-ir');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  validateHistoricalQxoCapitalisationF27ProductQueryResult,
  validateProductQueryResult,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  requestedFieldProjectionIdentity,
} = require('../lib/canonical-v2/product-query-result-compiler');
const {
  QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
  QXO_DOMAIN_VALIDATOR,
  QXO_RESULT_DEFINITION,
  REQUIRED_SURFACES,
  REQUIRED_VALUE_SLOTS,
  SELECTED_SOURCE_ACTION,
  canonicalQxoCapitalisationProductResultAdapterReceiptBytes,
  compileQxoCapitalisationProductResultAdapter,
  validateQxoCapitalisationProductResultAdapterReceipt,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-product-result-adapter',
);
const {
  compileQxoCapitalisationF28ProductResultAdapter,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-product-result-adapter',
);
const {
  buildF27Inputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f27-inputs');
const {
  buildF28ProductInputs,
} = require(
  './fixtures/canonical-v2/qxo-capitalisation-f28-product-inputs',
);

function id(label) {
  return contentId(
    'SYNTHETIC_QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_TEST/V1',
    { label },
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fieldDefinition(fieldKey, valueType) {
  return {
    field_key: fieldKey,
    field_version: 1,
    permitted_result_definitions: [QXO_RESULT_DEFINITION.stable_id],
    filter_scope: 'SAME_AGREEMENT_RESULT',
    multiplicity: 'ZERO_OR_ONE',
    capabilities: {
      display: true,
      filter: true,
      sort: true,
    },
    supported_domains: ['AGREEMENT'],
    permitted_operators:
      valueType === 'DATE' ? ['AFTER', 'BEFORE', 'BETWEEN', 'EQ'] : ['EQ', 'IN'],
    completeness_semantics: 'UNKNOWN_IF_NOT_ADMITTED',
  };
}

function productQueryIr(
  qxoRelease,
  { useLegacyBringDown = false } = {},
) {
  return compileProductQueryIr({
    admission: {
      schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
      approved_pm_data_version_id: id('pm-data-version'),
      candidate_release_manifest_id:
        qxoRelease.manifest.release_manifest_id,
      candidate_release_manifest_payload_digest:
        qxoRelease.manifest.canonical_payload_digest,
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
          ...(useLegacyBringDown
            ? [fieldDefinition('bringDownStandard', 'ENUM')]
            : []),
          fieldDefinition('deal', 'DEAL_REFERENCE'),
          fieldDefinition('signed', 'DATE'),
        ].sort((left, right) => left.field_key.localeCompare(right.field_key)),
      },
      navigation_catalogue: {
        stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
        catalogue_id: id('navigation-catalogue'),
        payload_digest: id('navigation-catalogue-payload'),
      },
      predicate_admissions: [{
        domain_key: 'AGREEMENT',
        predicate_key: 'TARGET_CAPITALISATION_BRING_DOWN',
        predicate_version: 1,
        admission_id: id('predicate-admission'),
        result_definitions: [clone(QXO_RESULT_DEFINITION)],
        evidence_requirement_ids: [
          'EXACT_CLAIM',
          'EXACT_SOURCE_CITATION',
        ],
      }],
      exact_detail_actions: [SELECTED_SOURCE_ACTION],
      coverage_identities: [id('coverage')],
      route_budget: {
        maximum_page_size: 50,
      },
    },
    query: {
      domain_key: 'AGREEMENT',
      predicate_key: 'TARGET_CAPITALISATION_BRING_DOWN',
      predicate_version: 1,
      result_definition: clone(QXO_RESULT_DEFINITION),
      evidence_requirement_ids: [
        'EXACT_CLAIM',
        'EXACT_SOURCE_CITATION',
      ],
      cohort: {
        cohort_definition_id: id('cohort'),
        cohort_definition_payload_digest: id('cohort-payload'),
      },
      filters: [{
        field_key: useLegacyBringDown ? 'bringDownStandard' : 'deal',
        field_version: 1,
        operator: useLegacyBringDown ? 'IN' : 'EQ',
        value: useLegacyBringDown
          ? [
            'MAT_ALL_RESPECTS_DE_MINIMIS',
            'MAT_ALL_MATERIAL',
          ]
          : 'deal:qxo-topbuild',
      }],
      sort: [{
        field_key: 'signed',
        field_version: 1,
        direction: 'DESC',
      }],
      diversity: {
        definition_id: id('diversity'),
        payload_digest: id('diversity-payload'),
      },
      requested_columns: [
        {
          field_key: 'deal',
          field_version: 1,
        },
        {
          field_key: 'signed',
          field_version: 1,
        },
      ],
      pagination: {
        page_size: 12,
        cursor: null,
      },
      detail_actions: [SELECTED_SOURCE_ACTION],
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
        field_key: 'deal',
        field_version: 1,
      },
      value: {
        governed_deal_id: id('qxo-deal'),
      },
    },
    {
      field_reference: {
        field_key: 'signed',
        field_version: 1,
      },
      value: {
        iso_8601_calendar_date: '2026-04-18',
      },
    },
  ];
}

function domainResult(release) {
  const payload = clone(release.provision_row);
  const payloadDigest = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: QXO_DOMAIN_VALIDATOR.stable_id,
    validator_version: QXO_DOMAIN_VALIDATOR.version,
    validated_payload_digest: payloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: 'AGREEMENT',
    domain_result_definition: clone(QXO_RESULT_DEFINITION),
    domain_result_identity: release.provision_row.provision_row_id,
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
    domain_result_source_representation_kind: 'STRUCTURED_RESULT',
  };
}

function admissionReceipt(ir, result, fields, state = 'PASS') {
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition: clone(result.domain_result_definition),
    domain_result_identity: result.domain_result_identity,
    domain_result_payload_digest: result.domain_result_payload_digest,
    domain_validator_admission_identity: id('adapter-admission'),
    domain_validation_receipt_id:
      result.domain_result_validation.validation_receipt_id,
    query_coverage_identity: ir.coverage_contract.coverage_identity,
    covered_set_identity: ir.coverage_contract.covered_set_identity,
    query_cohort_identity: ir.cohort_contract.cohort_definition_id,
    predicate_evaluation_state: state,
    cohort_evaluation_state: 'PASS',
    filter_evaluation_state: 'PASS',
    covered_set_membership_state: 'PASS',
    requested_field_projection_identity:
      requestedFieldProjectionIdentity({
        queryIr: ir,
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

function fixture() {
  const inputs = buildF27Inputs();
  const reviewedGraph = buildQxoReviewedCapitalisationF27(inputs);
  const release = buildQxoCapitalisationCrossViewReleaseF27({
    reviewedGraph,
    sourceContext: inputs.sourceContext,
    parserSourceClosure: inputs.parserSourceClosure,
    contractBundle: inputs.contractBundle,
  });
  const ir = productQueryIr(release);
  const fields = resultFields();
  const result = domainResult(release);
  return {
    qxo_cross_view_release: release,
    reviewed_graph: reviewedGraph,
    source_context: inputs.sourceContext,
    parser_source_closure: inputs.parserSourceClosure,
    contract_bundle: inputs.contractBundle,
    product_query_ir: ir,
    result_fields: fields,
    product_admission_receipt:
      admissionReceipt(ir, result, fields),
  };
}

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(assertDeepFrozen);
}

test('rejects direct F27 Product admission and requires F28', () => {
  assert.throws(
    () => compileQxoCapitalisationProductResultAdapter(fixture()),
    { code: 'QXO_CAPITALISATION_F27_RETIRED_NOT_RELEASE_ADMITTED' },
  );
  assert.doesNotThrow(
    () => compileQxoCapitalisationF28ProductResultAdapter(
      buildF28ProductInputs(),
    ),
  );
});

test('keeps structural F27 validation historical-only', () => {
  const result = clone(
    compileQxoCapitalisationF28ProductResultAdapter(
      buildF28ProductInputs(),
    ).product_query_result,
  );
  result.domain_result_definition.version = 2;
  result.domain_result_payload.schema_version =
    'CAPITALISATION_SHARED_PROVISION_ROW_F27/V1';
  result.domain_result_payload_digest = sha256Hex(Buffer.from(
    canonicalJson(result.domain_result_payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: QXO_DOMAIN_VALIDATOR.stable_id,
    validator_version: QXO_DOMAIN_VALIDATOR.version,
    validated_payload_digest: result.domain_result_payload_digest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  result.domain_result_validation = {
    schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
    ...validationBody,
    validation_receipt_id: contentId(
      PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      validationBody,
    ),
  };
  result.product_query_result_identity = contentId(
    'PRODUCT_QUERY_RESULT/V1',
    {
      schema_version: result.schema_version,
      product_query_definition_id: result.product_query_definition_id,
      approved_pm_data_version_id: result.approved_pm_data_version_id,
      candidate_release_manifest_id:
        result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        result.candidate_release_manifest_payload_digest,
      domain_key: result.domain_key,
      domain_result_definition_stable_id:
        result.domain_result_definition.stable_id,
      domain_result_definition_version:
        result.domain_result_definition.version,
      domain_result_identity: result.domain_result_identity,
    },
  );
  result.exact_citation.citation_target_identity = contentId(
    'PRODUCT_EXACT_CITATION/V1',
    {
      product_query_result_identity:
        result.product_query_result_identity,
      candidate_release_manifest_id:
        result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        result.candidate_release_manifest_payload_digest,
      source_document_identity:
        result.exact_citation.source_document_identity,
      source_evidence_identity:
        result.exact_citation.source_evidence_identity,
    },
  );
  assert.equal(
    validateHistoricalQxoCapitalisationF27ProductQueryResult(result),
    true,
  );
  assert.throws(
    () => validateProductQueryResult(result),
    { code: 'RETIRED_QXO_CAPITALISATION_F27_NOT_RELEASE_ADMITTED' },
  );
});

test('has no I/O, serving, release or activation path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'lib',
      'canonical-v2',
      'qxo-capitalisation-product-result-adapter.js',
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|axios|supabase|postgres|process\.env|writeFile|INSERT|UPDATE|DELETE|activate|production_cutover/i,
  );
});
