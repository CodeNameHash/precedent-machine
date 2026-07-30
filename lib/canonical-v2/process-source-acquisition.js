const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const PROCESS_SOURCE_ACQUISITION_INPUT_SCHEMA =
  'PROCESS_SOURCE_ACQUISITION_INPUT/V1';
const PROCESS_SOURCE_ACQUISITION_RECEIPT_SCHEMA =
  'PROCESS_SOURCE_ACQUISITION_RECEIPT/V1';
const SOURCE_CLASSES = new Set([
  'FILING',
  'AMENDMENT',
  'SUPPLEMENT',
  'EXHIBIT',
  'INCORPORATED_REFERENCE',
  'APPROVED_NON_SEC_SOURCE',
]);
const TERMINAL_INTAKE_OUTCOMES = new Set([
  'VERIFIED_INTAKE_RECEIPT',
  'REVIEWED_NON_RECEIPT',
]);
const SHA256_RE = /^[a-f0-9]{64}$/;
const LIMITS = Object.freeze({
  maximum_sources: 128,
  maximum_attempts: 4096,
  maximum_total_bytes: 32 * 1024 * 1024,
  maximum_runtime_ms: 60_000,
  maximum_memory_bytes: 64 * 1024 * 1024,
});

class ProcessSourceAcquisitionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessSourceAcquisitionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessSourceAcquisitionError(code, message, details);
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

function validateLimits(limits) {
  const code = 'INVALID_PROCESS_SOURCE_ACQUISITION_LIMITS';
  requireExactKeys(limits, Object.keys(LIMITS), 'limits', code);
  for (const [key, maximum] of Object.entries(LIMITS)) {
    requireBoundedInteger(limits[key], `limits.${key}`, maximum, code);
  }
  return canonicalClone(limits, 'limits', code);
}

function validateGovernedScope(scope) {
  const code = 'INVALID_PROCESS_SOURCE_ACQUISITION_SCOPE';
  requireExactKeys(scope, [
    'scope_id',
    'scope_digest',
    'manifest_id',
    'expected_source_ids',
    'coverage_limit',
  ], 'governed_scope', code);
  requireText(scope.scope_id, 'governed_scope.scope_id', code);
  requireDigest(scope.scope_digest, 'governed_scope.scope_digest', code);
  requireText(scope.manifest_id, 'governed_scope.manifest_id', code);
  if (!Array.isArray(scope.expected_source_ids)
    || scope.expected_source_ids.length === 0
    || scope.expected_source_ids.length > LIMITS.maximum_sources) {
    fail(code, 'governed_scope.expected_source_ids must be a bounded non-empty array.');
  }
  const ids = new Set();
  for (const sourceId of scope.expected_source_ids) {
    requireText(sourceId, 'governed_scope expected source ID', code);
    if (ids.has(sourceId)) fail(code, 'governed_scope has a duplicate expected source ID.');
    ids.add(sourceId);
  }
  requireExactKeys(scope.coverage_limit, [
    'coverage_limit_id',
    'limitation_codes',
  ], 'governed_scope.coverage_limit', code);
  requireText(scope.coverage_limit.coverage_limit_id,
    'governed_scope.coverage_limit.coverage_limit_id', code);
  if (!Array.isArray(scope.coverage_limit.limitation_codes)
    || scope.coverage_limit.limitation_codes.length > 64) {
    fail(code, 'governed_scope.coverage_limit.limitation_codes must be bounded.');
  }
  const limitationCodes = new Set();
  for (const limitationCode of scope.coverage_limit.limitation_codes) {
    requireText(limitationCode, 'coverage limitation code', code);
    if (limitationCodes.has(limitationCode)) {
      fail(code, 'governed_scope has a duplicate coverage limitation code.');
    }
    limitationCodes.add(limitationCode);
  }
  return canonicalClone(scope, 'governed_scope', code);
}

function validateSource(source, expectedIds) {
  const code = 'INVALID_PROCESS_FROZEN_SOURCE';
  requireExactKeys(source, [
    'source_id',
    'source_class',
    'frozen_snapshot_id',
    'source_text',
    'source_text_digest',
    'source_identity',
    'evidence_history',
    'intake_outcome',
    'attempts_used',
  ], 'frozen source', code);
  requireText(source.source_id, 'frozen source.source_id', code);
  if (!expectedIds.has(source.source_id)) {
    fail('UNMANIFESTED_PROCESS_SOURCE', 'The frozen source is not in the governed scope.', {
      source_id: source.source_id,
    });
  }
  if (!SOURCE_CLASSES.has(source.source_class)) {
    fail(code, 'frozen source.source_class is not governed.');
  }
  requireText(source.frozen_snapshot_id, 'frozen source.frozen_snapshot_id', code);
  requireText(source.source_text, 'frozen source.source_text', code);
  requireDigest(source.source_text_digest, 'frozen source.source_text_digest', code);
  if (sha256Hex(Buffer.from(source.source_text, 'utf8')) !== source.source_text_digest) {
    fail(code, 'frozen source.source_text_digest does not bind the supplied source text.');
  }
  requireExactKeys(source.source_identity, [
    'source_document_identity',
    'source_revision_id',
    'document_hash',
  ], 'frozen source.source_identity', code);
  for (const [key, value] of Object.entries(source.source_identity)) {
    requireDigest(value, `frozen source.source_identity.${key}`, code);
  }
  if (!Array.isArray(source.evidence_history)
    || source.evidence_history.length === 0
    || source.evidence_history.length > 256) {
    fail(code, 'frozen source.evidence_history must be a bounded non-empty array.');
  }
  const evidenceIds = new Set();
  for (const evidence of source.evidence_history) {
    requireExactKeys(evidence, ['evidence_id', 'evidence_digest'],
      'frozen source evidence history item', code);
    requireDigest(evidence.evidence_id, 'frozen source evidence ID', code);
    requireDigest(evidence.evidence_digest, 'frozen source evidence digest', code);
    if (evidenceIds.has(evidence.evidence_id)) {
      fail(code, 'frozen source.evidence_history has a duplicate evidence ID.');
    }
    evidenceIds.add(evidence.evidence_id);
  }
  if (!TERMINAL_INTAKE_OUTCOMES.has(source.intake_outcome)) {
    fail(code, 'frozen source.intake_outcome is not a terminal governed outcome.');
  }
  requireBoundedInteger(source.attempts_used, 'frozen source.attempts_used',
    LIMITS.maximum_attempts, code);
  return canonicalClone(source, 'frozen source', code);
}

function acquireProcessSources(input) {
  const started = process.hrtime.bigint();
  const code = 'INVALID_PROCESS_SOURCE_ACQUISITION_INPUT';
  requireExactKeys(input, [
    'schema_version',
    'governed_scope',
    'frozen_sources',
    'limits',
  ], 'Process source-acquisition input', code);
  if (input.schema_version !== PROCESS_SOURCE_ACQUISITION_INPUT_SCHEMA) {
    fail(code, 'The Process source-acquisition input schema is not supported.');
  }
  const limits = validateLimits(input.limits);
  const governedScope = validateGovernedScope(input.governed_scope);
  if (!Array.isArray(input.frozen_sources)
    || input.frozen_sources.length === 0
    || input.frozen_sources.length > limits.maximum_sources) {
    fail(code, 'frozen_sources must be a bounded non-empty array.');
  }
  const expectedIds = new Set(governedScope.expected_source_ids);
  const seen = new Set();
  let totalBytes = 0;
  let attemptsUsed = 0;
  const intakeOutcomes = input.frozen_sources.map((source) => {
    const valid = validateSource(source, expectedIds);
    if (seen.has(valid.source_id)) {
      fail(code, 'frozen_sources has a duplicate source ID.', { source_id: valid.source_id });
    }
    seen.add(valid.source_id);
    totalBytes += Buffer.byteLength(valid.source_text, 'utf8');
    attemptsUsed += valid.attempts_used;
    return {
      source_id: valid.source_id,
      source_class: valid.source_class,
      frozen_snapshot_id: valid.frozen_snapshot_id,
      source_text_digest: valid.source_text_digest,
      source_identity: valid.source_identity,
      evidence_history: valid.evidence_history,
      intake_outcome: valid.intake_outcome,
      attempts_used: valid.attempts_used,
    };
  });
  if (seen.size !== expectedIds.size) {
    const missing = governedScope.expected_source_ids.filter((id) => !seen.has(id));
    fail('UNRESOLVED_GOVERNED_PROCESS_SOURCE',
      'Every governed expected source must have one terminal intake outcome.', { missing });
  }
  if (attemptsUsed > limits.maximum_attempts) {
    fail('PROCESS_SOURCE_ACQUISITION_ATTEMPT_LIMIT_EXCEEDED',
      'Frozen source attempts exceed the governed limit.');
  }
  if (totalBytes > limits.maximum_total_bytes || totalBytes > limits.maximum_memory_bytes) {
    fail('PROCESS_SOURCE_ACQUISITION_BYTE_LIMIT_EXCEEDED',
      'Frozen source bytes exceed a governed retention limit.');
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (elapsedMs > limits.maximum_runtime_ms) {
    fail('PROCESS_SOURCE_ACQUISITION_RUNTIME_LIMIT_EXCEEDED',
      'Source-acquisition validation exceeded the governed runtime limit.');
  }
  const sourceInventoryDigest = contentId('PROCESS_FROZEN_SOURCE_INVENTORY/V1', intakeOutcomes);
  const body = {
    schema_version: PROCESS_SOURCE_ACQUISITION_RECEIPT_SCHEMA,
    governed_scope_id: governedScope.scope_id,
    governed_scope_digest: governedScope.scope_digest,
    manifest_id: governedScope.manifest_id,
    source_inventory_digest: sourceInventoryDigest,
    intake_outcomes: intakeOutcomes,
    coverage_limit: governedScope.coverage_limit,
    limits,
    authority_state: 'NOT_GRANTED',
  };
  return deepFreeze({
    ...body,
    acquisition_receipt_id: contentId(PROCESS_SOURCE_ACQUISITION_RECEIPT_SCHEMA, body),
  });
}

function validateProcessSourceAcquisitionReceipt(receipt) {
  const code = 'INVALID_PROCESS_SOURCE_ACQUISITION_RECEIPT';
  requireExactKeys(receipt, [
    'schema_version',
    'governed_scope_id',
    'governed_scope_digest',
    'manifest_id',
    'source_inventory_digest',
    'intake_outcomes',
    'coverage_limit',
    'limits',
    'authority_state',
    'acquisition_receipt_id',
  ], 'Process source-acquisition receipt', code);
  if (receipt.schema_version !== PROCESS_SOURCE_ACQUISITION_RECEIPT_SCHEMA
    || receipt.authority_state !== 'NOT_GRANTED') {
    fail(code, 'The Process source-acquisition receipt is not governed.');
  }
  requireDigest(receipt.governed_scope_digest, 'receipt governed scope digest', code);
  requireDigest(receipt.source_inventory_digest, 'receipt source inventory digest', code);
  requireDigest(receipt.acquisition_receipt_id, 'receipt ID', code);
  const expectedInventory = contentId('PROCESS_FROZEN_SOURCE_INVENTORY/V1', receipt.intake_outcomes);
  if (expectedInventory !== receipt.source_inventory_digest) {
    fail(code, 'The receipt source inventory digest does not match its outcomes.');
  }
  const { acquisition_receipt_id: actualReceiptId, ...body } = receipt;
  const expectedReceiptId = contentId(PROCESS_SOURCE_ACQUISITION_RECEIPT_SCHEMA, body);
  if (actualReceiptId !== expectedReceiptId) {
    fail(code, 'The receipt ID does not bind the receipt payload.');
  }
  return deepFreeze(canonicalClone(receipt, 'receipt', code));
}

module.exports = {
  PROCESS_SOURCE_ACQUISITION_INPUT_SCHEMA,
  PROCESS_SOURCE_ACQUISITION_RECEIPT_SCHEMA,
  ProcessSourceAcquisitionError,
  acquireProcessSources,
  validateProcessSourceAcquisitionReceipt,
};
