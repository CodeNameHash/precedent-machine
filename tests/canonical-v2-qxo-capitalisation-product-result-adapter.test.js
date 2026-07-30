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
  buildF27Inputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f27-inputs');

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

test('adapts the exact QXO F27 row into one Product result', () => {
  const input = fixture();
  const receipt = compileQxoCapitalisationProductResultAdapter(input);
  const result = receipt.product_query_result;

  assert.equal(
    receipt.schema_version,
    QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
  );
  assert.equal(
    result.domain_result_identity,
    input.qxo_cross_view_release.provision_row.provision_row_id,
  );
  assert.deepEqual(
    result.domain_result_payload,
    input.qxo_cross_view_release.provision_row,
  );
  assert.deepEqual(
    result.domain_result_payload.subrows.map(
      (subrow) => subrow.value_slot_key,
    ),
    REQUIRED_VALUE_SLOTS,
  );
  assert.equal(validateProductQueryResult(result), true);
  assert.equal(
    validateQxoCapitalisationProductResultAdapterReceipt(receipt, input),
    true,
  );
  assertDeepFrozen(receipt);
});

test('preserves the exact row and release across all four views', () => {
  const input = fixture();
  const receipt = compileQxoCapitalisationProductResultAdapter(input);
  assert.deepEqual(
    Object.keys(receipt.qxo_cross_view_release.surface_bindings),
    REQUIRED_SURFACES,
  );
  for (const surface of REQUIRED_SURFACES) {
    assert.deepEqual(
      receipt.qxo_cross_view_release.surface_bindings[surface].provision_row,
      receipt.product_query_result.domain_result_payload,
    );
  }
});

test('keeps Product query and membership PASS states external', () => {
  const input = fixture();
  input.product_admission_receipt =
    admissionReceipt(
      input.product_query_ir,
      domainResult(input.qxo_cross_view_release),
      input.result_fields,
      'FAIL',
    );
  assert.throws(
    () => compileQxoCapitalisationProductResultAdapter(input),
    (error) => error.code
      === 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_PRODUCT_INPUT',
  );
});

test('rejects the legacy article-wide bring-down field for class-specific QXO terms', () => {
  const input = fixture();
  input.product_query_ir = productQueryIr(
    input.qxo_cross_view_release,
    { useLegacyBringDown: true },
  );
  input.product_admission_receipt = admissionReceipt(
    input.product_query_ir,
    domainResult(input.qxo_cross_view_release),
    input.result_fields,
  );
  assert.throws(
    () => compileQxoCapitalisationProductResultAdapter(input),
    (error) => error.code
      === 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_PRODUCT_INPUT',
  );
});

test('rejects raw scalar substitutions for shared deal and signing fields', () => {
  for (const [index, raw] of [
    [0, 'deal:qxo-topbuild'],
    [1, '2026-04-18'],
  ]) {
    const input = fixture();
    input.result_fields[index].value = raw;
    assert.throws(
      () => compileQxoCapitalisationProductResultAdapter(input),
      (error) => error.code
        === 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_PRODUCT_INPUT',
    );
  }
});

test('rejects a changed QXO row even when the outer release is rehashed', () => {
  const input = fixture();
  const changed = clone(input.qxo_cross_view_release);
  changed.provision_row.subrows[0].subject.display_value = 'Forged standard';
  const body = clone(changed);
  delete body.qxo_capitalisation_cross_view_release_f27_id;
  delete body.canonical_payload_digest;
  changed.qxo_capitalisation_cross_view_release_f27_id = contentId(
    'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27/V1',
    body,
  );
  changed.canonical_payload_digest = contentId(
    'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27_PAYLOAD/V1',
    body,
  );
  input.qxo_cross_view_release = changed;
  assert.throws(
    () => compileQxoCapitalisationProductResultAdapter(input),
    (error) => error.code === 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_SOURCE',
  );
});

test('keeps structured source composition and Product payload identities separate', () => {
  const input = fixture();
  const result =
    compileQxoCapitalisationProductResultAdapter(input)
      .product_query_result;
  assert.notEqual(
    result.domain_result_payload_digest,
    result.exact_citation.result_component_evidence_identity,
  );
  assert.equal(
    result.exact_citation.source_document_identity,
    input.qxo_cross_view_release.provision_row.document_hash,
  );
  assert.equal(result.exact_detail_action, SELECTED_SOURCE_ACTION);
});

test('canonical receipt bytes are deterministic and bind the full release', () => {
  const input = fixture();
  const first = compileQxoCapitalisationProductResultAdapter(input);
  const second = compileQxoCapitalisationProductResultAdapter(clone(input));
  assert.deepEqual(first, second);
  assert.equal(
    canonicalQxoCapitalisationProductResultAdapterReceiptBytes(
      first,
      input,
    ).toString('utf8'),
    canonicalJson(first),
  );
  assert.deepEqual(first.qxo_cross_view_release, input.qxo_cross_view_release);
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
