const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  validateProductQueryResult,
} = require('../lib/canonical-v2/product-citation-share-compiler');
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
