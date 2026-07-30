const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');

const PROCESS_SEC_COMPLETENESS_ORACLE_INPUT_SCHEMA =
  'PROCESS_SEC_COMPLETENESS_ORACLE_INPUT/V1';
const PROCESS_SEC_COMPLETENESS_ORACLE_RECEIPT_SCHEMA =
  'PROCESS_SEC_COMPLETENESS_ORACLE_RECEIPT/V1';
const SEC_INDEX_SOURCES = new Set(['SEC_DAILY_INDEX', 'SEC_FULL_INDEX']);
const ACCESSION_RE = /^\d{10}-\d{2}-\d{6}$/;
const CIK_RE = /^\d{1,10}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const LIMITS = Object.freeze({
  maximum_records: 32768,
  maximum_total_bytes: 16 * 1024 * 1024,
  maximum_runtime_ms: 60_000,
  maximum_memory_bytes: 32 * 1024 * 1024,
});

class ProcessSecCompletenessOracleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessSecCompletenessOracleError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessSecCompletenessOracleError(code, message, details);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be a plain object.`);
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} does not have the exact required keys.`, {
      actual,
      expected: required,
    });
  }
}

function requireText(value, label, code) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${label} must be a non-empty string.`);
  }
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 digest.`);
  }
}

function requireBoundedInteger(value, label, maximum, code) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    fail(code, `${label} must be an integer from 1 through ${maximum}.`);
  }
}

function canonicalClone(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} must be canonical JSON.`, { cause: error.message });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function validateLimits(limits) {
  const code = 'INVALID_PROCESS_SEC_ORACLE_LIMITS';
  requireExactKeys(limits, Object.keys(LIMITS), 'limits', code);
  for (const [key, maximum] of Object.entries(LIMITS)) {
    requireBoundedInteger(limits[key], `limits.${key}`, maximum, code);
  }
  return canonicalClone(limits, 'limits', code);
}

function validateScope(scope) {
  const code = 'INVALID_PROCESS_SEC_ORACLE_SCOPE';
  requireExactKeys(scope, [
    'scope_id',
    'scope_digest',
    'issuer_cik',
    'filing_date_start',
    'filing_date_end',
  ], 'governed_scope', code);
  requireText(scope.scope_id, 'governed_scope.scope_id', code);
  requireDigest(scope.scope_digest, 'governed_scope.scope_digest', code);
  if (typeof scope.issuer_cik !== 'string' || !CIK_RE.test(scope.issuer_cik)) {
    fail(code, 'governed_scope.issuer_cik must be an SEC CIK.');
  }
  if (!DATE_RE.test(scope.filing_date_start) || !DATE_RE.test(scope.filing_date_end)
    || scope.filing_date_start > scope.filing_date_end) {
    fail(code, 'governed_scope filing dates are invalid.');
  }
  return canonicalClone(scope, 'governed_scope', code);
}

function validateRecord(record, scope) {
  const code = 'INVALID_PROCESS_SEC_INDEX_RECORD';
  requireExactKeys(record, [
    'index_source',
    'index_snapshot_id',
    'accession_number',
    'accession_number_no_dashes',
    'issuer_cik',
    'filing_date',
    'form_type',
    'primary_document',
  ], 'SEC index record', code);
  if (!SEC_INDEX_SOURCES.has(record.index_source)) {
    fail(code, 'SEC index record.index_source is not governed.');
  }
  requireDigest(record.index_snapshot_id, 'SEC index record.index_snapshot_id', code);
  if (!ACCESSION_RE.test(record.accession_number)) {
    fail(code, 'SEC index record.accession_number is malformed.');
  }
  if (record.accession_number_no_dashes
    !== record.accession_number.replaceAll('-', '')) {
    fail(code, 'SEC index record.accession_number_no_dashes does not bind the accession.');
  }
  if (record.issuer_cik !== scope.issuer_cik || !CIK_RE.test(record.issuer_cik)) {
    fail(code, 'SEC index record.issuer_cik is outside the governed issuer.');
  }
  if (!DATE_RE.test(record.filing_date)
    || record.filing_date < scope.filing_date_start
    || record.filing_date > scope.filing_date_end) {
    fail(code, 'SEC index record.filing_date is outside the governed scope.');
  }
  requireText(record.form_type, 'SEC index record.form_type', code);
  requireText(record.primary_document, 'SEC index record.primary_document', code);
  return canonicalClone(record, 'SEC index record', code);
}

function validateOracleInput(input) {
  const code = 'INVALID_PROCESS_SEC_ORACLE_INPUT';
  requireExactKeys(input, [
    'schema_version',
    'governed_scope',
    'sec_index_records',
    'limits',
  ], 'Process SEC completeness-oracle input', code);
  if (input.schema_version !== PROCESS_SEC_COMPLETENESS_ORACLE_INPUT_SCHEMA) {
    fail(code, 'The Process SEC completeness-oracle input schema is not supported.');
  }
  const limits = validateLimits(input.limits);
  const governedScope = validateScope(input.governed_scope);
  if (!Array.isArray(input.sec_index_records)
    || input.sec_index_records.length === 0
    || input.sec_index_records.length > limits.maximum_records) {
    fail(code, 'sec_index_records must be a bounded non-empty array.');
  }
  const accessions = new Set();
  let totalBytes = 0;
  const records = input.sec_index_records.map((record) => {
    const valid = validateRecord(record, governedScope);
    if (accessions.has(valid.accession_number)) {
      fail('DUPLICATE_PROCESS_SEC_ACCESSION',
        'The SEC index input has a duplicate accession number.', {
          accession_number: valid.accession_number,
        });
    }
    accessions.add(valid.accession_number);
    totalBytes += Buffer.byteLength(canonicalJson(valid), 'utf8');
    return valid;
  });
  if (totalBytes > limits.maximum_total_bytes || totalBytes > limits.maximum_memory_bytes) {
    fail('PROCESS_SEC_ORACLE_BYTE_LIMIT_EXCEEDED',
      'SEC index input exceeds a governed resource limit.');
  }
  records.sort((left, right) => compareText(left.accession_number, right.accession_number));
  return { governedScope, limits, records };
}

function buildProcessSecCompletenessOracle(input) {
  const started = process.hrtime.bigint();
  const { governedScope, limits, records } = validateOracleInput(input);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (elapsedMs > limits.maximum_runtime_ms) {
    fail('PROCESS_SEC_ORACLE_RUNTIME_LIMIT_EXCEEDED',
      'SEC completeness-oracle validation exceeded the governed runtime limit.');
  }
  const accessionInventoryDigest = contentId(
    'PROCESS_SEC_ACCESSION_INVENTORY/V1',
    records,
  );
  const body = {
    schema_version: PROCESS_SEC_COMPLETENESS_ORACLE_RECEIPT_SCHEMA,
    governed_scope_id: governedScope.scope_id,
    governed_scope_digest: governedScope.scope_digest,
    issuer_cik: governedScope.issuer_cik,
    accession_inventory: records,
    accession_inventory_digest: accessionInventoryDigest,
    limits,
    authority_state: 'NOT_GRANTED',
  };
  return deepFreeze({
    ...body,
    oracle_receipt_id: contentId(PROCESS_SEC_COMPLETENESS_ORACLE_RECEIPT_SCHEMA, body),
  });
}

function validateProcessSecCompletenessOracleReceipt(receipt) {
  const code = 'INVALID_PROCESS_SEC_ORACLE_RECEIPT';
  requireExactKeys(receipt, [
    'schema_version',
    'governed_scope_id',
    'governed_scope_digest',
    'issuer_cik',
    'accession_inventory',
    'accession_inventory_digest',
    'limits',
    'authority_state',
    'oracle_receipt_id',
  ], 'Process SEC completeness-oracle receipt', code);
  if (receipt.schema_version !== PROCESS_SEC_COMPLETENESS_ORACLE_RECEIPT_SCHEMA
    || receipt.authority_state !== 'NOT_GRANTED'
    || !CIK_RE.test(receipt.issuer_cik)) {
    fail(code, 'The Process SEC completeness-oracle receipt is not governed.');
  }
  requireDigest(receipt.governed_scope_digest, 'receipt governed scope digest', code);
  requireDigest(receipt.accession_inventory_digest, 'receipt inventory digest', code);
  requireDigest(receipt.oracle_receipt_id, 'receipt ID', code);
  const accessions = new Set();
  let previousAccession = null;
  for (const record of receipt.accession_inventory) {
    if (!isPlainObject(record) || !ACCESSION_RE.test(record.accession_number)) {
      fail(code, 'The receipt has a malformed accession inventory record.');
    }
    if (accessions.has(record.accession_number)
      || (previousAccession !== null
        && compareText(previousAccession, record.accession_number) >= 0)) {
      fail(code, 'The receipt accession inventory is not unique canonical order.');
    }
    accessions.add(record.accession_number);
    previousAccession = record.accession_number;
  }
  const expectedInventory = contentId(
    'PROCESS_SEC_ACCESSION_INVENTORY/V1',
    receipt.accession_inventory,
  );
  if (expectedInventory !== receipt.accession_inventory_digest) {
    fail(code, 'The receipt inventory digest does not bind its accession inventory.');
  }
  const { oracle_receipt_id: actualReceiptId, ...body } = receipt;
  const expectedReceiptId = contentId(PROCESS_SEC_COMPLETENESS_ORACLE_RECEIPT_SCHEMA, body);
  if (actualReceiptId !== expectedReceiptId) {
    fail(code, 'The receipt ID does not bind the receipt payload.');
  }
  return deepFreeze(canonicalClone(receipt, 'receipt', code));
}

function reconcileExactProcessSecAccessionMembership(leftReceipt, rightReceipt) {
  const left = validateProcessSecCompletenessOracleReceipt(leftReceipt);
  const right = validateProcessSecCompletenessOracleReceipt(rightReceipt);
  const leftAccessions = new Set(left.accession_inventory.map((record) => record.accession_number));
  const rightAccessions = new Set(right.accession_inventory.map((record) => record.accession_number));
  const missing_accession_numbers = [...leftAccessions]
    .filter((accession) => !rightAccessions.has(accession))
    .sort(compareText);
  const extra_accession_numbers = [...rightAccessions]
    .filter((accession) => !leftAccessions.has(accession))
    .sort(compareText);
  const body = {
    schema_version: 'PROCESS_SEC_EXACT_ACCESSION_RECONCILIATION/V1',
    left_oracle_receipt_id: left.oracle_receipt_id,
    right_oracle_receipt_id: right.oracle_receipt_id,
    membership_state: missing_accession_numbers.length === 0
      && extra_accession_numbers.length === 0 ? 'EXACT_MATCH' : 'MISMATCH',
    missing_accession_numbers,
    extra_accession_numbers,
  };
  return deepFreeze({
    ...body,
    reconciliation_id: contentId('PROCESS_SEC_EXACT_ACCESSION_RECONCILIATION/V1', body),
  });
}

module.exports = {
  PROCESS_SEC_COMPLETENESS_ORACLE_INPUT_SCHEMA,
  PROCESS_SEC_COMPLETENESS_ORACLE_RECEIPT_SCHEMA,
  ProcessSecCompletenessOracleError,
  buildProcessSecCompletenessOracle,
  validateProcessSecCompletenessOracleReceipt,
  reconcileExactProcessSecAccessionMembership,
};
