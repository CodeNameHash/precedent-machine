const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');

const INPUT_SCHEMA = 'PROCESS_SEMANTIC_ENUMERATOR_INPUT/V1';
const OUTPUT_SCHEMA = 'PROCESS_SEMANTIC_ENUMERATION/V1';
const CANDIDATE_DOMAIN = 'PROCESS_SEMANTIC_CANDIDATE/V1';
const OUTCOME_DOMAIN = 'PROCESS_SEMANTIC_OUTCOME/V1';
const CANDIDATE_SCHEMA = 'PROCESS_SEMANTIC_CANDIDATE/V1';
const OUTCOME_SCHEMA = 'PROCESS_SEMANTIC_OUTCOME/V1';
const SCOPE_SCHEMA = 'PROCESS_SCOPE_ENUMERATION/V1';
const SCOPE_RECEIPT_DOMAIN = 'PROCESS_SCOPE_ENUMERATION_RECEIPT/V1';
const MAX_SOURCE_UNITS = 4096;
const MAX_SEMANTIC_PAYLOAD_BYTES = 65536;

class ProcessSemanticEnumeratorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessSemanticEnumeratorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ProcessSemanticEnumeratorError(code, message, details);
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
    fail(code, `${label} does not have the exact required keys.`, { actual, expected });
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

function validateEvidence(value, label, code, requireRole = false) {
  const keys = [
    'source_document_identity', 'source_revision_id', 'document_hash',
    'start_utf8_byte', 'end_utf8_byte', 'exact_text_digest',
  ];
  if (requireRole) keys.push('evidence_role_key');
  requireExactKeys(value, keys, label, code);
  for (const key of [
    'source_document_identity', 'source_revision_id', 'document_hash', 'exact_text_digest',
  ]) requireDigest(value[key], `${label} ${key}`, code);
  if (!Number.isSafeInteger(value.start_utf8_byte) || value.start_utf8_byte < 0
    || !Number.isSafeInteger(value.end_utf8_byte)
    || value.end_utf8_byte <= value.start_utf8_byte) {
    fail(code, `${label} has an invalid UTF-8 interval.`);
  }
  if (requireRole) requireKey(value.evidence_role_key, `${label} evidence role`, code);
  return value;
}

function validateFrozenSlots(values) {
  const code = 'INVALID_PROCESS_SEMANTIC_FROZEN_SLOTS';
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_SOURCE_UNITS) {
    fail(code, 'Frozen slots must be a bounded non-empty array.');
  }
  values.forEach((value, index) => {
    requireExactKeys(value, [
      'slot_key', 'deal_id', 'occurrence_kind', 'required_evidence_roles', 'scope_evidence',
    ], `Frozen slot ${index}`, code);
    requireKey(value.slot_key, `Frozen slot ${index} key`, code);
    requireDigest(value.deal_id, `Frozen slot ${index} deal ID`, code);
    requireKey(value.occurrence_kind, `Frozen slot ${index} occurrence kind`, code);
    if (!Array.isArray(value.required_evidence_roles) || value.required_evidence_roles.length < 1
      || value.required_evidence_roles.length > 32) {
      fail(code, `Frozen slot ${index} must retain required evidence roles.`);
    }
    value.required_evidence_roles.forEach((role, roleIndex) => (
      requireKey(role, `Frozen slot ${index} evidence role ${roleIndex}`, code)
    ));
    if (new Set(value.required_evidence_roles).size !== value.required_evidence_roles.length) {
      fail(code, `Frozen slot ${index} evidence roles must be unique.`);
    }
    if (!Array.isArray(value.scope_evidence) || value.scope_evidence.length < 1
      || value.scope_evidence.length > 64) {
      fail(code, `Frozen slot ${index} must retain bounded scope evidence.`);
    }
    value.scope_evidence.forEach((evidence, evidenceIndex) => (
      validateEvidence(evidence, `Frozen slot ${index} evidence ${evidenceIndex}`, code)
    ));
  });
  const keys = values.map((value) => value.slot_key);
  if (new Set(keys).size !== keys.length) {
    fail(code, 'Frozen slots must have unique keys.');
  }
  return new Set(keys);
}

function validateScopeReceipt(value) {
  const code = 'INVALID_PROCESS_SEMANTIC_SCOPE_RECEIPT';
  requireExactKeys(value, [
    'schema_version', 'scope_receipt_id', 'expected_occurrence_slots',
    'residuals', 'limits',
  ], 'Semantic scope receipt', code);
  if (value.schema_version !== SCOPE_SCHEMA) {
    fail(code, 'Semantic scope receipt schema is not supported.');
  }
  requireDigest(value.scope_receipt_id, 'Semantic scope receipt ID', code);
  requireExactKeys(value.limits, ['max_scope_records', 'max_slots'],
    'Semantic scope receipt limits', code);
  for (const key of ['max_scope_records', 'max_slots']) {
    if (!Number.isSafeInteger(value.limits[key]) || value.limits[key] < 1
      || value.limits[key] > MAX_SOURCE_UNITS) {
      fail(code, `Semantic scope receipt limit ${key} is invalid.`);
    }
  }
  if (!Array.isArray(value.expected_occurrence_slots)
    || value.expected_occurrence_slots.length > value.limits.max_slots) {
    fail(code, 'Semantic scope receipt slots exceed the governed limit.');
  }
  const slotKeys = validateFrozenSlots(value.expected_occurrence_slots);
  if (!Array.isArray(value.residuals)
    || value.expected_occurrence_slots.length + value.residuals.length
      > value.limits.max_scope_records) {
    fail(code, 'Semantic scope receipt records exceed the governed limit.');
  }
  for (const [index, residual] of value.residuals.entries()) {
    requireExactKeys(residual, [
      'record_key', 'residual_code', 'deal_id', 'scope_evidence',
    ], `Semantic scope residual ${index}`, code);
    requireKey(residual.record_key, `Semantic scope residual ${index} key`, code);
    requireKey(residual.residual_code,
      `Semantic scope residual ${index} code`, code);
    requireDigest(residual.deal_id, `Semantic scope residual ${index} deal`, code);
    if (!Array.isArray(residual.scope_evidence)
      || residual.scope_evidence.length < 1
      || residual.scope_evidence.length > 64) {
      fail(code, `Semantic scope residual ${index} evidence is invalid.`);
    }
    residual.scope_evidence.forEach((evidence, evidenceIndex) => (
      validateEvidence(evidence,
        `Semantic scope residual ${index} evidence ${evidenceIndex}`, code)
    ));
  }
  const dealIds = new Set([
    ...value.expected_occurrence_slots.map((slot) => slot.deal_id),
    ...value.residuals.map((residual) => residual.deal_id),
  ]);
  if (dealIds.size !== 1) {
    fail(code, 'Semantic scope receipt must bind one governed deal.');
  }
  const expectedReceiptId = contentId(SCOPE_RECEIPT_DOMAIN, {
    governed_deal_admission_id: [...dealIds][0],
    expected_occurrence_slots: value.expected_occurrence_slots,
    residuals: value.residuals,
    limits: value.limits,
  });
  if (value.scope_receipt_id !== expectedReceiptId) {
    fail(code, 'Semantic scope receipt ID does not bind its validated payload.');
  }
  return {
    scope_receipt_id: value.scope_receipt_id,
    slot_keys: slotKeys,
  };
}

function validateSemanticPayload(value, label, code) {
  requireObject(value, label, code);
  if (Object.keys(value).length === 0) fail(code, `${label} cannot be empty.`);
  let bytes;
  try {
    bytes = Buffer.byteLength(canonicalJson(value), 'utf8');
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, { cause: error.message });
  }
  if (bytes > MAX_SEMANTIC_PAYLOAD_BYTES) fail(code, `${label} exceeds the payload limit.`);
  return value;
}

function validateSourceUnit(value, slotKeys, index) {
  const code = 'INVALID_PROCESS_SEMANTIC_SOURCE_UNIT';
  requireExactKeys(value, [
    'source_unit_id', 'unit_state', 'slot_key', 'evidence', 'semantic_payload', 'disposition_code',
  ], `Semantic source unit ${index}`, code);
  requireDigest(value.source_unit_id, `Semantic source unit ${index} ID`, code);
  validateEvidence(value.evidence, `Semantic source unit ${index} evidence`, code, true);
  if (!['CANDIDATE', 'REJECTED', 'RESIDUAL'].includes(value.unit_state)) {
    fail(code, `Semantic source unit ${index} has an unsupported state.`);
  }
  if (value.unit_state === 'CANDIDATE') {
    requireKey(value.slot_key, `Semantic source unit ${index} slot key`, code);
    if (!slotKeys.has(value.slot_key)) fail(code, `Semantic source unit ${index} references an unknown frozen slot.`);
    validateSemanticPayload(value.semantic_payload, `Semantic source unit ${index} payload`, code);
    if (value.disposition_code !== null) fail(code, `Semantic source unit ${index} candidate has a disposition code.`);
  } else {
    if (value.slot_key !== null || value.semantic_payload !== null) {
      fail(code, `Semantic source unit ${index} non-candidate must not claim semantic content.`);
    }
    requireKey(value.disposition_code, `Semantic source unit ${index} disposition code`, code);
  }
  return value;
}

function validateInput(input) {
  const code = 'INVALID_PROCESS_SEMANTIC_ENUMERATOR_INPUT';
  requireExactKeys(input, [
    'schema_version', 'scope_receipt', 'source_units', 'limits',
  ], 'Semantic enumeration input', code);
  if (input.schema_version !== INPUT_SCHEMA) fail(code, 'Semantic enumeration input schema is not supported.');
  requireExactKeys(input.limits, ['max_source_units', 'max_candidates'], 'Semantic limits', code);
  for (const key of ['max_source_units', 'max_candidates']) {
    if (!Number.isSafeInteger(input.limits[key]) || input.limits[key] < 1
      || input.limits[key] > MAX_SOURCE_UNITS) fail(code, `Semantic limit ${key} is invalid.`);
  }
  const scope = validateScopeReceipt(input.scope_receipt);
  const slotKeys = scope.slot_keys;
  if (!Array.isArray(input.source_units) || input.source_units.length < 1
    || input.source_units.length > input.limits.max_source_units) {
    fail(code, 'Semantic source units must be a bounded non-empty array.');
  }
  input.source_units.forEach((value, index) => validateSourceUnit(value, slotKeys, index));
  const sourceUnitIds = input.source_units.map((value) => value.source_unit_id);
  if (new Set(sourceUnitIds).size !== sourceUnitIds.length) fail(code, 'Semantic source unit IDs must be unique.');
  const candidateCount = input.source_units.filter((value) => value.unit_state === 'CANDIDATE').length;
  if (candidateCount > input.limits.max_candidates) fail(code, 'Semantic candidates exceed the input limit.');
  return { ...input, scope_receipt_id: scope.scope_receipt_id };
}

function compareCandidates(left, right) {
  return compareText(left.slot_key, right.slot_key)
    || compareEvidence(left.evidence, right.evidence)
    || compareText(left.candidate_key, right.candidate_key);
}

function compareDisposition(left, right) {
  return compareEvidence(left.evidence, right.evidence)
    || compareText(left.source_unit_id, right.source_unit_id);
}

function buildOutcome(scopeReceiptId, unit, outcomeKind) {
  const payload = {
    outcome_kind: outcomeKind,
    scope_receipt_id: scopeReceiptId,
    reason_code: unit.disposition_code,
    source_unit_id: unit.source_unit_id,
    slot_key: unit.slot_key,
    evidence: unit.evidence,
    semantic_payload: unit.semantic_payload,
  };
  return {
    schema_version: OUTCOME_SCHEMA,
    outcome_key: contentId(OUTCOME_DOMAIN, payload),
    ...payload,
  };
}

function enumerateProcessSemantics(input) {
  const value = validateInput(clone(input, 'Semantic enumeration input', 'INVALID_PROCESS_SEMANTIC_ENUMERATOR_INPUT'));
  const candidates = value.source_units.filter((unit) => unit.unit_state === 'CANDIDATE')
    .map((unit) => {
      const candidatePayload = {
        slot_key: unit.slot_key,
        source_unit_id: unit.source_unit_id,
        evidence: unit.evidence,
        semantic_payload: unit.semantic_payload,
      };
      return {
        schema_version: CANDIDATE_SCHEMA,
        candidate_key: contentId(CANDIDATE_DOMAIN, candidatePayload),
        scope_receipt_id: value.scope_receipt_id,
        ...candidatePayload,
      };
    }).sort(compareCandidates);
  if (new Set(candidates.map((candidate) => candidate.candidate_key)).size !== candidates.length) {
    fail('DUPLICATE_PROCESS_SEMANTIC_CANDIDATE', 'Semantic candidate identity is duplicated.');
  }
  const rejections = value.source_units.filter((unit) => unit.unit_state === 'REJECTED')
    .map((unit) => buildOutcome(value.scope_receipt_id, unit, 'REJECTION'))
    .sort(compareDisposition);
  const residuals = value.source_units.filter((unit) => unit.unit_state === 'RESIDUAL')
    .map((unit) => buildOutcome(value.scope_receipt_id, unit, 'RESIDUAL'))
    .sort(compareDisposition);
  return deepFreeze({
    schema_version: OUTPUT_SCHEMA,
    scope_receipt_id: value.scope_receipt_id,
    candidates,
    rejections,
    residuals,
    limits: value.limits,
  });
}

module.exports = {
  INPUT_SCHEMA,
  OUTPUT_SCHEMA,
  CANDIDATE_SCHEMA,
  OUTCOME_SCHEMA,
  ProcessSemanticEnumeratorError,
  enumerateProcessSemantics,
  validateProcessSemanticEnumerationInput: validateInput,
};
