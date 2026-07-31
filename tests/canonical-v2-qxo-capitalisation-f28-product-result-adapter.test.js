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
  PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA,
  compileProductCitationAndShareAction,
  validateProductQueryResult,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_QUERY_IR_SCHEMA,
} = require('../lib/canonical-v2/product-query-ir');
const {
  compileProductResultPresentation,
} = require('../lib/canonical-v2/product-result-presentation-compiler');
const {
  PRODUCT_SAVED_QUERY_OWNER_BINDING_SCHEMA,
  compileProductSavedQueryDefinition,
} = require('../lib/canonical-v2/product-saved-query-compiler');
const {
  compileProductSourceReaderAction,
} = require('../lib/canonical-v2/product-source-reader-compiler');
const {
  PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
} = require('../lib/canonical-v2/product-rerun-compiler');
const {
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
  REQUIRED_SURFACES,
  REQUIRED_VALUE_SLOTS,
  canonicalQxoCapitalisationF28ProductResultAdapterReceiptBytes,
  compileQxoCapitalisationF28ProductResultAdapter,
  validateQxoCapitalisationF28ProductResultAdapterReceipt,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-product-result-adapter',
);
const {
  admissionReceipt,
  buildF28ProductInputs,
  buildProductQueryIr,
  clone,
  domainResult,
} = require(
  './fixtures/canonical-v2/qxo-capitalisation-f28-product-inputs',
);

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(assertDeepFrozen);
}

function asRetiredF27Result(result, { disguised = false } = {}) {
  const retired = clone(result);
  retired.domain_result_definition.version = disguised ? 3 : 2;
  retired.domain_result_payload.schema_version =
    'CAPITALISATION_SHARED_PROVISION_ROW_F27/V1';
  retired.domain_result_payload_digest = sha256Hex(Buffer.from(
    canonicalJson(retired.domain_result_payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: 'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER',
    validator_version: 1,
    validated_payload_digest: retired.domain_result_payload_digest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  retired.domain_result_validation = {
    schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
    ...validationBody,
    validation_receipt_id: contentId(
      PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      validationBody,
    ),
  };
  retired.product_query_result_identity = contentId(
    retired.schema_version,
    {
      schema_version: retired.schema_version,
      product_query_definition_id: retired.product_query_definition_id,
      approved_pm_data_version_id: retired.approved_pm_data_version_id,
      candidate_release_manifest_id:
        retired.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        retired.candidate_release_manifest_payload_digest,
      domain_key: retired.domain_key,
      domain_result_definition_stable_id:
        retired.domain_result_definition.stable_id,
      domain_result_definition_version:
        retired.domain_result_definition.version,
      domain_result_identity: retired.domain_result_identity,
    },
  );
  retired.exact_citation.citation_target_identity = contentId(
    retired.exact_citation.schema_version,
    {
      product_query_result_identity:
        retired.product_query_result_identity,
      candidate_release_manifest_id:
        retired.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        retired.candidate_release_manifest_payload_digest,
      source_document_identity:
        retired.exact_citation.source_document_identity,
      source_evidence_identity:
        retired.exact_citation.source_evidence_identity,
    },
  );
  return retired;
}

function asRetiredF27QueryIr(queryIr) {
  const retired = clone(queryIr);
  retired.semantic_contract.result_definition.version = 2;
  const body = clone(retired);
  delete body.query_definition_id;
  retired.query_definition_id = contentId(PRODUCT_QUERY_IR_SCHEMA, body);
  return retired;
}

function activeRelease(result, stale = false) {
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
    active_fence_identity: contentId('TEST/V1', { value: 'fence' }),
    candidate_release_manifest_id: stale
      ? contentId('TEST/V1', { value: 'stale-manifest' })
      : result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: stale
      ? contentId('TEST/V1', { value: 'stale-payload' })
      : result.candidate_release_manifest_payload_digest,
    resolution_state: 'FRESH_EXTERNAL_RESOLUTION',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    resolution_id: contentId(
      PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
      body,
    ),
    ...body,
  };
}

function actionOwnerBinding() {
  return {
    schema_version: PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA,
    actor_principal_id: 'BEN_GOODCHILD',
    object_authorisation_binding_id:
      contentId('TEST/V1', { value: 'action-owner' }),
    runtime_authorisation_state: 'REQUIRED_BEFORE_USE',
  };
}

test('adapts the exact six-row, fourteen-metric QXO F28 result', () => {
  const input = buildF28ProductInputs();
  const receipt =
    compileQxoCapitalisationF28ProductResultAdapter(input);
  const result = receipt.product_query_result;
  assert.equal(
    receipt.schema_version,
    QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
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
  assert.equal(
    result.domain_result_payload.subrows.flatMap(
      (subrow) => subrow.market_context.metric_results,
    ).length,
    14,
  );
  assert.equal(validateProductQueryResult(result), true);
  assert.equal(
    validateQxoCapitalisationF28ProductResultAdapterReceipt(
      receipt,
      input,
    ),
    true,
  );
  assertDeepFrozen(receipt);
});

test('preserves one exact row across all Product surfaces', () => {
  const input = buildF28ProductInputs();
  const receipt =
    compileQxoCapitalisationF28ProductResultAdapter(input);
  assert.deepEqual(
    Object.keys(receipt.qxo_cross_view_release.surface_bindings),
    REQUIRED_SURFACES,
  );
  for (const surface of REQUIRED_SURFACES) {
    assert.equal(
      canonicalJson(
        receipt.qxo_cross_view_release
          .surface_bindings[surface].provision_row,
      ),
      canonicalJson(receipt.product_query_result.domain_result_payload),
    );
  }
  assert.equal(
    receipt.product_query_result.domain_result_payload
      .generic_no_market_data_authority,
    'FORBIDDEN',
  );
});

test('keeps Product PASS states external and class metrics separate', () => {
  const input = buildF28ProductInputs();
  input.product_admission_receipt = admissionReceipt(
    input.product_query_ir,
    domainResult(input.qxo_cross_view_release),
    input.result_fields,
    'FAIL',
  );
  assert.throws(
    () => compileQxoCapitalisationF28ProductResultAdapter(input),
    (error) => error.code
      === 'INVALID_QXO_F28_PRODUCT_ADAPTER_PRODUCT_INPUT',
  );

  const aggregated = buildF28ProductInputs({
    useLegacyBringDown: true,
  });
  assert.throws(
    () => compileQxoCapitalisationF28ProductResultAdapter(aggregated),
    (error) => error.code
      === 'INVALID_QXO_F28_PRODUCT_ADAPTER_PRODUCT_INPUT',
  );
});

test('rejects changed market terms even after outer release rehash', () => {
  const input = buildF28ProductInputs();
  const changed = clone(input.qxo_cross_view_release);
  changed.provision_row.subrows[0]
    .market_context.metric_results[0].subject_state = 'ABSENT';
  const body = clone(changed);
  delete body.qxo_capitalisation_cross_view_release_f28_id;
  delete body.canonical_payload_digest;
  const {
    contentId,
  } = require('../lib/canonical-v2/canonical-bytes');
  changed.qxo_capitalisation_cross_view_release_f28_id = contentId(
    'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28/V1',
    body,
  );
  changed.canonical_payload_digest = contentId(
    'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28_PAYLOAD/V1',
    body,
  );
  input.qxo_cross_view_release = changed;
  assert.throws(
    () => compileQxoCapitalisationF28ProductResultAdapter(input),
    (error) => error.code === 'INVALID_QXO_F28_PRODUCT_ADAPTER_SOURCE',
  );
});

test('binds deterministic receipt bytes to the full source release', () => {
  const input = buildF28ProductInputs();
  const first =
    compileQxoCapitalisationF28ProductResultAdapter(input);
  const second =
    compileQxoCapitalisationF28ProductResultAdapter(clone(input));
  assert.deepEqual(first, second);
  assert.equal(
    canonicalQxoCapitalisationF28ProductResultAdapterReceiptBytes(
      first,
      input,
    ).toString('utf8'),
    canonicalJson(first),
  );
  assert.deepEqual(
    first.qxo_cross_view_release,
    input.qxo_cross_view_release,
  );
});

test('has no I/O, serving, write, release or activation path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'lib',
      'canonical-v2',
      'qxo-capitalisation-f28-product-result-adapter.js',
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|axios|supabase|postgres|process\.env|writeFile|INSERT|UPDATE|DELETE|activate|production_cutover/i,
  );
});

test('rejects direct and disguised F27 results at every serving selector', () => {
  const current = compileQxoCapitalisationF28ProductResultAdapter(
    buildF28ProductInputs(),
  ).product_query_result;
  for (const retired of [
    asRetiredF27Result(current),
    asRetiredF27Result(current, { disguised: true }),
  ]) {
    assert.throws(
      () => validateProductQueryResult(retired),
      { code: 'RETIRED_QXO_CAPITALISATION_F27_NOT_RELEASE_ADMITTED' },
    );
    assert.throws(
      () => compileProductCitationAndShareAction({
        product_query_result: retired,
      }),
      { code: 'RETIRED_QXO_CAPITALISATION_F27_NOT_RELEASE_ADMITTED' },
    );
    assert.throws(
      () => compileProductSourceReaderAction({
        product_result: retired,
      }),
      { code: 'RETIRED_QXO_CAPITALISATION_F27_NOT_RELEASE_ADMITTED' },
    );
  }
});

test('rejects F27 saved queries and incomplete presentation input', () => {
  const retiredQuery = asRetiredF27QueryIr(
    buildF28ProductInputs().product_query_ir,
  );
  assert.throws(
    () => compileProductSavedQueryDefinition({
      query_ir: retiredQuery,
      release_mode: 'PINNED',
      owner_binding: {
        schema_version: PRODUCT_SAVED_QUERY_OWNER_BINDING_SCHEMA,
        owner_principal_id: 'BEN_GOODCHILD',
        owner_authority_binding_id:
          contentId('TEST/V1', { value: 'saved-owner' }),
        runtime_authorisation_state: 'REQUIRED_BEFORE_USE',
      },
    }),
    { code: 'RETIRED_QXO_CAPITALISATION_F27_NOT_RELEASE_ADMITTED' },
  );
  assert.throws(
    () => compileProductResultPresentation({
      product_query_ir: retiredQuery,
    }),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );
});

test('returns a stale-release refusal for F28 but never serves stale F27', () => {
  const current = compileQxoCapitalisationF28ProductResultAdapter(
    buildF28ProductInputs(),
  ).product_query_result;
  const staleResolution = activeRelease(current, true);
  const refusal = compileProductCitationAndShareAction({
    product_query_result: current,
    active_release_resolution: staleResolution,
    action_kind: 'CITATION',
    object_authorisation_binding: actionOwnerBinding(),
  });
  assert.equal(refusal.disposition, 'RELEASE_NOT_ACTIVE');
  assert.throws(
    () => compileProductCitationAndShareAction({
      product_query_result: asRetiredF27Result(current),
      active_release_resolution: staleResolution,
      action_kind: 'CITATION',
      object_authorisation_binding: actionOwnerBinding(),
    }),
    { code: 'RETIRED_QXO_CAPITALISATION_F27_NOT_RELEASE_ADMITTED' },
  );
});
