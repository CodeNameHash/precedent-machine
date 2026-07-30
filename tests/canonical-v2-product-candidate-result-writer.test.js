const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contract = require(
  '../contracts/canonical-v2/successor/product/query/product-candidate-result-writer.v1.json',
);
const {
  ALLOWED_OPERATIONS,
  InMemoryCanonicalRepository,
} = require('../lib/canonical-v2/canonical-writer');
const {
  PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
  PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
  validateProductCandidateResultWriteSet,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  validateAuthoredProductCandidateWriteInputs,
} = require(
  '../lib/canonical-v2/product-candidate-write-contract-input-validator',
);

const ROOT = path.join(__dirname, '..');

test('registers one staging-only candidate-result writer contract', () => {
  assert.doesNotThrow(
    () => validateAuthoredProductCandidateWriteInputs([{
      object_kind: contract.object_kind,
      canonical_value: contract,
    }]),
  );
  assert.equal(contract.stable_id, 'PRODUCT_CANDIDATE_RESULT_WRITER');
  assert.equal(
    contract.definition.operation_contract.operation,
    'PRODUCT_RESULT_CANDIDATE_RUN',
  );
  assert.equal(
    contract.definition.operation_contract.second_writer_permitted,
    false,
  );
  assert.equal(
    contract.definition.authority_contract.creates_production_authority,
    false,
  );
});

test('fails closed before a partial Product chain can reach the writer', () => {
  assert.throws(
    () => validateProductCandidateResultWriteSet({
      schema_version: PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
    }),
    (error) => error.code === 'INVALID_PRODUCT_CANDIDATE_RESULT_WRITE_SET',
  );
  assert.equal(
    PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
    'PRODUCT_CANDIDATE_RESULT_RECORD/V1',
  );
  assert.equal(
    ALLOWED_OPERATIONS.has('PRODUCT_RESULT_CANDIDATE_RUN'),
    true,
  );
});

test('keeps Product candidate records inside the one canonical repository', async () => {
  const repository = new InMemoryCanonicalRepository();
  const record = {
    schema_version: PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
    candidate_product_result_id: 'a'.repeat(64),
    marker: 'first',
  };
  await repository.transaction(async (transaction) => {
    await transaction.writeProductCandidateResult(record);
  });
  await repository.transaction(async (transaction) => {
    await transaction.writeProductCandidateResult(record);
  });
  assert.deepEqual(repository.snapshot().productCandidateResults, [record]);
  await assert.rejects(
    repository.transaction(async (transaction) => {
      await transaction.writeProductCandidateResult({
        ...record,
        marker: 'conflict',
      });
    }),
    (error) => error.code === 'CANONICAL_IDENTITY_CONFLICT',
  );
});

test('gives SQL the same staging-only operation and immutable table', () => {
  const writerSql = fs.readFileSync(
    path.join(
      ROOT,
      'sql/optionA/step0b-canonical-writer-by-contract.sql',
    ),
    'utf8',
  );
  const foundation = fs.readFileSync(
    path.join(ROOT, 'supabase/canonical-v2-foundation.sql'),
    'utf8',
  );
  for (const source of [writerSql, foundation]) {
    assert.match(source, /PRODUCT_RESULT_CANDIDATE_RUN/);
    assert.match(source, /product_candidate_results/);
  }
  assert.match(
    writerSql,
    /Product candidate-result identity conflict/,
  );
  assert.match(writerSql, /CANDIDATE_NOT_ACTIVE/);
  assert.equal(
    contract.definition.operation_contract.production_permitted,
    false,
  );
});

test('uses the exact bounded phase allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      ROOT,
      '.github/phase-allowlists/wp-product-candidate-result-writer-v1.json',
    ),
    'utf8',
  ));
  assert.equal(
    allowlist.phase,
    'WP-PRODUCT-CANDIDATE-RESULT-WRITER-V1',
  );
  assert.equal(allowlist.allowed.length, 18);
});
