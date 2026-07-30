const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');

const INPUT_SCHEMA = 'PROCESS_SCOPE_ENUMERATOR_INPUT/V1';
const OUTPUT_SCHEMA = 'PROCESS_SCOPE_ENUMERATION/V1';
const RECEIPT_DOMAIN = 'PROCESS_SCOPE_ENUMERATION_RECEIPT/V1';
const MAX_SCOPE_RECORDS = 1024;
const MAX_EVIDENCE_PER_RECORD = 64;

class ProcessScopeEnumeratorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessScopeEnumeratorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ProcessScopeEnumeratorError(code, message, details);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
}

function requireExactKeys(value, keys, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} does not have the exact required keys.`, {
      actual,
      expected,
    });
  }
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
}

function requireKey(value, label, code) {
  if (typeof value !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{0,127}$/.test(value)) {
    fail(code, `${label} must be a bounded governed key.`);
  }
}

function clone(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, { cause: error.message });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function compareEvidence(left, right) {
  return compareText(left.source_document_identity, right.source_document_identity)
    || compareText(left.source_revision_id, right.source_revision_id)
    || left.start_utf8_byte - right.start_utf8_byte
    || left.end_utf8_byte - right.end_utf8_byte
    || compareText(left.exact_text_digest, right.exact_text_digest);
}

function validateEvidence(value, index) {
  const code = 'INVALID_PROCESS_SCOPE_EVIDENCE';
  requireExactKeys(value, [
    'source_document_identity', 'source_revision_id', 'document_hash',
    'start_utf8_byte', 'end_utf8_byte', 'exact_text_digest',
  ], `Scope evidence ${index}`, code);
  for (const key of [
    'source_document_identity', 'source_revision_id', 'document_hash',
    'exact_text_digest',
  ]) requireDigest(value[key], `Scope evidence ${index} ${key}`, code);
  if (!Number.isSafeInteger(value.start_utf8_byte) || value.start_utf8_byte < 0
    || !Number.isSafeInteger(value.end_utf8_byte)
    || value.end_utf8_byte <= value.start_utf8_byte) {
    fail(code, `Scope evidence ${index} has an invalid UTF-8 interval.`);
  }
  return value;
}

function validateEvidenceSet(values) {
  const code = 'INVALID_PROCESS_SCOPE_EVIDENCE';
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_EVIDENCE_PER_RECORD) {
    fail(code, 'Scope evidence must be a bounded non-empty array.');
  }
  values.forEach(validateEvidence);
  const sorted = [...values].sort(compareEvidence);
  const identities = values.map((value) => canonicalJson(value));
  if (canonicalJson(values) !== canonicalJson(sorted) || new Set(identities).size !== identities.length) {
    fail(code, 'Scope evidence must be ordered and unique.');
  }
  return values;
}

function validateRoles(values, label, code) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 32) {
    fail(code, `${label} must be a bounded non-empty array.`);
  }
  values.forEach((value, index) => requireKey(value, `${label} ${index}`, code));
  const sorted = [...values].sort(compareText);
  if (canonicalJson(values) !== canonicalJson(sorted)
    || new Set(values).size !== values.length) {
    fail(code, `${label} must be ordered and unique.`);
  }
  return values;
}

function validateRecord(value, dealId, index) {
  const code = 'INVALID_PROCESS_SCOPE_RECORD';
  requireExactKeys(value, [
    'record_key', 'record_state', 'slot_key', 'deal_id', 'occurrence_kind',
    'required_evidence_roles', 'scope_evidence', 'residual_code',
  ], `Scope record ${index}`, code);
  requireKey(value.record_key, `Scope record ${index} key`, code);
  if (!['SLOT', 'RESIDUAL'].includes(value.record_state)) {
    fail(code, `Scope record ${index} has an unsupported state.`);
  }
  if (value.deal_id !== dealId) {
    fail(code, `Scope record ${index} is not in the governed deal.`);
  }
  requireDigest(value.deal_id, `Scope record ${index} deal ID`, code);
  validateEvidenceSet(value.scope_evidence);
  if (value.record_state === 'SLOT') {
    requireKey(value.slot_key, `Scope record ${index} slot key`, code);
    requireKey(value.occurrence_kind, `Scope record ${index} occurrence kind`, code);
    validateRoles(value.required_evidence_roles, `Scope record ${index} evidence roles`, code);
    if (value.residual_code !== null) fail(code, `Scope record ${index} slot has a residual code.`);
  } else if (value.slot_key !== null || value.occurrence_kind !== null
    || value.required_evidence_roles !== null) {
    fail(code, `Scope record ${index} residual must not define an occurrence slot.`);
  } else {
    requireKey(value.residual_code, `Scope record ${index} residual code`, code);
  }
  return value;
}

function validateInput(input) {
  const code = 'INVALID_PROCESS_SCOPE_ENUMERATOR_INPUT';
  requireExactKeys(input, [
    'schema_version', 'governed_deal_admission_id', 'scope_records', 'limits',
  ], 'Scope enumeration input', code);
  if (input.schema_version !== INPUT_SCHEMA) fail(code, 'Scope enumeration input schema is not supported.');
  requireDigest(input.governed_deal_admission_id, 'Governed deal admission ID', code);
  requireExactKeys(input.limits, ['max_scope_records', 'max_slots'], 'Scope limits', code);
  for (const key of ['max_scope_records', 'max_slots']) {
    if (!Number.isSafeInteger(input.limits[key]) || input.limits[key] < 1
      || input.limits[key] > MAX_SCOPE_RECORDS) {
      fail(code, `Scope limit ${key} is invalid.`);
    }
  }
  if (!Array.isArray(input.scope_records) || input.scope_records.length < 1
    || input.scope_records.length > input.limits.max_scope_records) {
    fail(code, 'Scope records must be a bounded non-empty array.');
  }
  input.scope_records.forEach((value, index) => (
    validateRecord(value, input.governed_deal_admission_id, index)
  ));
  const recordKeys = input.scope_records.map((value) => value.record_key);
  if (new Set(recordKeys).size !== recordKeys.length) fail(code, 'Scope record keys must be unique.');
  const slotKeys = input.scope_records.filter((value) => value.record_state === 'SLOT')
    .map((value) => value.slot_key);
  if (slotKeys.length > input.limits.max_slots || new Set(slotKeys).size !== slotKeys.length) {
    fail(code, 'Expected occurrence slots must be bounded and unique.');
  }
  return input;
}

function enumerateProcessScope(input) {
  const value = validateInput(clone(input, 'Scope enumeration input', 'INVALID_PROCESS_SCOPE_ENUMERATOR_INPUT'));
  const expectedOccurrenceSlots = value.scope_records
    .filter((record) => record.record_state === 'SLOT')
    .map((record) => ({
      slot_key: record.slot_key,
      deal_id: record.deal_id,
      occurrence_kind: record.occurrence_kind,
      required_evidence_roles: record.required_evidence_roles,
      scope_evidence: record.scope_evidence,
    }))
    .sort((left, right) => compareText(left.slot_key, right.slot_key));
  const residuals = value.scope_records
    .filter((record) => record.record_state === 'RESIDUAL')
    .map((record) => ({
      record_key: record.record_key,
      residual_code: record.residual_code,
      deal_id: record.deal_id,
      scope_evidence: record.scope_evidence,
    }))
    .sort((left, right) => compareText(left.record_key, right.record_key));
  const receiptPayload = {
    governed_deal_admission_id: value.governed_deal_admission_id,
    expected_occurrence_slots: expectedOccurrenceSlots,
    residuals,
    limits: value.limits,
  };
  return deepFreeze({
    schema_version: OUTPUT_SCHEMA,
    scope_receipt_id: contentId(RECEIPT_DOMAIN, receiptPayload),
    expected_occurrence_slots: expectedOccurrenceSlots,
    residuals,
    limits: value.limits,
  });
}

module.exports = {
  INPUT_SCHEMA,
  OUTPUT_SCHEMA,
  ProcessScopeEnumeratorError,
  enumerateProcessScope,
  validateProcessScopeEnumerationInput: validateInput,
};
