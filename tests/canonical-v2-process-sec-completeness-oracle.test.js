const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  PROCESS_SEC_COMPLETENESS_ORACLE_INPUT_SCHEMA,
  buildProcessSecCompletenessOracle,
  validateProcessSecCompletenessOracleReceipt,
  reconcileExactProcessSecAccessionMembership,
} = require('../lib/canonical-v2/process-sec-completeness-oracle');

function digest(label) {
  return contentId('SYNTHETIC_PROCESS_SEC_ORACLE_TEST/V1', { label });
}

function record(accessionNumber, overrides = {}) {
  return {
    index_source: 'SEC_FULL_INDEX',
    index_snapshot_id: digest('sec-index-snapshot'),
    accession_number: accessionNumber,
    accession_number_no_dashes: accessionNumber.replaceAll('-', ''),
    issuer_cik: '1840574',
    filing_date: '2025-09-15',
    form_type: 'DEFM14A',
    primary_document: 'defm14a.htm',
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    schema_version: PROCESS_SEC_COMPLETENESS_ORACLE_INPUT_SCHEMA,
    governed_scope: {
      scope_id: 'METSA_SYNTHETIC_SEC_SCOPE',
      scope_digest: digest('scope'),
      issuer_cik: '1840574',
      filing_date_start: '2025-01-01',
      filing_date_end: '2025-12-31',
    },
    sec_index_records: [
      record('0001193125-25-141749'),
      record('0001193125-25-141748'),
    ],
    limits: {
      maximum_records: 8,
      maximum_total_bytes: 4096,
      maximum_runtime_ms: 1000,
      maximum_memory_bytes: 4096,
    },
    ...overrides,
  };
}

function rehashReceipt(receipt) {
  receipt.accession_inventory_digest = contentId('PROCESS_SEC_ACCESSION_INVENTORY/V2', {
    governed_scope: receipt.governed_scope,
    accession_inventory: receipt.accession_inventory,
  });
  const { oracle_receipt_id, ...body } = receipt;
  receipt.oracle_receipt_id = contentId(receipt.schema_version, body);
  return receipt;
}

test('builds a deterministic exact SEC accession inventory without production imports', () => {
  const first = buildProcessSecCompletenessOracle(input());
  const second = buildProcessSecCompletenessOracle(input());
  assert.deepEqual(first, second);
  assert.deepEqual(first.accession_inventory.map((row) => row.accession_number), [
    '0001193125-25-141748',
    '0001193125-25-141749',
  ]);
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.doesNotThrow(() => validateProcessSecCompletenessOracleReceipt(first));

  const source = fs.readFileSync(path.join(
    __dirname,
    '../lib/canonical-v2/process-sec-completeness-oracle.js',
  ), 'utf8');
  assert.equal(source.includes('process-source-acquisition'), false);
});

test('reconciles only validated independent oracle inventories by exact accession membership', () => {
  const left = buildProcessSecCompletenessOracle(input());
  const right = buildProcessSecCompletenessOracle(input({
    sec_index_records: [record('0001193125-25-141748')],
  }));
  const reconciliation = reconcileExactProcessSecAccessionMembership(left, right);
  assert.equal(reconciliation.membership_state, 'MISMATCH');
  assert.deepEqual(reconciliation.missing_accession_numbers, ['0001193125-25-141749']);
  assert.deepEqual(reconciliation.extra_accession_numbers, []);
});

function assertScopeMismatch(right) {
  const left = buildProcessSecCompletenessOracle(input());
  assert.throws(() => reconcileExactProcessSecAccessionMembership(left, right),
    (error) => error.code === 'PROCESS_SEC_SCOPE_MISMATCH');
}

test('rejects exact accession reconciliation with a different governed scope ID', () => {
  assertScopeMismatch(buildProcessSecCompletenessOracle(input({
    governed_scope: { ...input().governed_scope, scope_id: 'OTHER_SCOPE' },
  })));
});

test('rejects exact accession reconciliation with a different governed scope digest', () => {
  assertScopeMismatch(buildProcessSecCompletenessOracle(input({
    governed_scope: { ...input().governed_scope, scope_digest: digest('other-scope') },
  })));
});

test('rejects exact accession reconciliation with a different issuer CIK', () => {
  assertScopeMismatch(buildProcessSecCompletenessOracle(input({
    governed_scope: { ...input().governed_scope, issuer_cik: '1' },
    sec_index_records: [
      record('0001193125-25-141749', { issuer_cik: '1' }),
      record('0001193125-25-141748', { issuer_cik: '1' }),
    ],
  })));
});

test('rejects hostile malformed, duplicate, out-of-scope and tampered inventory input', () => {
  const malformed = input();
  malformed.sec_index_records[0].accession_number = 'not-an-accession';
  assert.throws(() => buildProcessSecCompletenessOracle(malformed),
    (error) => error.code === 'INVALID_PROCESS_SEC_INDEX_RECORD');

  const duplicate = input();
  duplicate.sec_index_records[1] = record('0001193125-25-141749');
  assert.throws(() => buildProcessSecCompletenessOracle(duplicate),
    (error) => error.code === 'DUPLICATE_PROCESS_SEC_ACCESSION');

  const outOfScope = input();
  outOfScope.sec_index_records[0].issuer_cik = '1';
  assert.throws(() => buildProcessSecCompletenessOracle(outOfScope),
    (error) => error.code === 'INVALID_PROCESS_SEC_INDEX_RECORD');

});

function assertRehashedReceiptForgery(field, value) {
  const forged = JSON.parse(JSON.stringify(buildProcessSecCompletenessOracle(input())));
  forged.accession_inventory[0][field] = value;
  rehashReceipt(forged);
  assert.throws(() => validateProcessSecCompletenessOracleReceipt(forged),
    (error) => error.code === 'INVALID_PROCESS_SEC_ORACLE_RECEIPT');
}

test('rejects rehashed receipt forgery of the SEC index source', () => {
  assertRehashedReceiptForgery('index_source', 'UNTRUSTED_SOURCE');
});

test('rejects rehashed receipt forgery of the SEC index snapshot', () => {
  assertRehashedReceiptForgery('index_snapshot_id', 'not-a-digest');
});

test('rejects rehashed receipt forgery of accession binding', () => {
  assertRehashedReceiptForgery('accession_number_no_dashes', 'invalid-accession-binding');
});

test('rejects rehashed receipt forgery of the issuer CIK', () => {
  assertRehashedReceiptForgery('issuer_cik', '1');
});

test('rejects rehashed receipt forgery of the filing date', () => {
  assertRehashedReceiptForgery('filing_date', '2026-01-01');
});

test('rejects rehashed receipt forgery of the form type', () => {
  assertRehashedReceiptForgery('form_type', '');
});

test('rejects rehashed receipt forgery of the primary document', () => {
  assertRehashedReceiptForgery('primary_document', '');
});
