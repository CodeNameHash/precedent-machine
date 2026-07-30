const assert = require('node:assert/strict');
const fs = require('node:fs');
const fixture = require(
  '../__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
);
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PRODUCT_QUERY_RESULT_SERVING_RECORD_SCHEMA,
  buildProductQueryResultServingRecord,
  validateProductQueryResultServingRecord,
} = require('../lib/canonical-v2/product-query-result-serving-record');

function input() {
  return {
    serving_namespace_id: '1'.repeat(64),
    corpus_release_id: '2'.repeat(64),
    candidate_product_result_id: fixture.candidate_product_result_id,
    candidate_product_result_payload_digest: '3'.repeat(64),
    product_query_result: fixture.shared_result,
  };
}

test('projects one exact Process Product result without its large sidecars', () => {
  const value = buildProductQueryResultServingRecord(input());
  assert.equal(
    value.schema_version,
    PRODUCT_QUERY_RESULT_SERVING_RECORD_SCHEMA,
  );
  assert.equal(
    value.product_query_result_identity,
    fixture.product_query_result_identity,
  );
  assert.equal(value.domain_key, 'PROCESS');
  assert.equal(
    value.canonical_payload_digest,
    sha256Hex(Buffer.from(canonicalJson(fixture.shared_result), 'utf8')),
  );
  assert.equal(value.serving_state, 'CANDIDATE_NOT_ACTIVE');
  assert.equal(value.authority_state, 'NOT_GRANTED');
  assert.equal(
    Object.hasOwn(value.canonical_payload, 'complete_write_set'),
    false,
  );
  assert.equal(
    validateProductQueryResultServingRecord(value, input()),
    true,
  );
});

test('is domain-neutral and binds release, result and candidate-record identity', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/product-query-result-serving-record.js',
    ),
    'utf8',
  );
  assert.equal(source.includes("domain_key === 'PROCESS'"), false);
  assert.equal(source.includes("domain_key === 'AGREEMENT'"), false);
  const first = buildProductQueryResultServingRecord(input());
  const changedRelease = input();
  changedRelease.corpus_release_id = '4'.repeat(64);
  const second = buildProductQueryResultServingRecord(changedRelease);
  assert.notEqual(
    first.product_query_result_serving_record_id,
    second.product_query_result_serving_record_id,
  );
});

test('rejects malformed identities and correctly rehashed result drift', () => {
  const malformed = input();
  malformed.candidate_product_result_id = 'short';
  assert.throws(
    () => buildProductQueryResultServingRecord(malformed),
    /full SHA-256/,
  );

  const validInput = input();
  const value = structuredClone(
    buildProductQueryResultServingRecord(validInput),
  );
  value.authority_state = 'GRANTED';
  assert.throws(
    () => validateProductQueryResultServingRecord(value, validInput),
    /changed/,
  );
});
