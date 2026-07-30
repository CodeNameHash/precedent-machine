const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8Slice,
} = require('./canonical-bytes');

const PROCESS_LEXICAL_ENUMERATION_SCHEMA = 'PROCESS_LEXICAL_ENUMERATION/V1';
const PROCESS_LEXICAL_CANDIDATE_SCHEMA = 'PROCESS_LEXICAL_CANDIDATE/V1';
const PROCESS_LEXICAL_OUTCOME_SCHEMA = 'PROCESS_LEXICAL_OUTCOME/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_SOURCE_COUNT = 256;
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_CANDIDATE_COUNT = 4096;
const MAX_DURATION_MS = 60_000;
const MAX_MEMORY_BYTES = 256 * 1024 * 1024;

class ProcessLexicalEnumeratorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessLexicalEnumeratorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessLexicalEnumeratorError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
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

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
}

function requireNonEmptyString(value, label, code) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${label} must be a non-empty string.`);
  }
}

function requireBoundedInteger(value, label, maximum, code) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    fail(code, `${label} must be an integer from 0 through ${maximum}.`);
  }
}

function cloneCanonical(value, label, code) {
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

function compareSourceUnits(left, right) {
  return compareText(left.source_document_identity, right.source_document_identity)
    || compareText(left.source_revision_id, right.source_revision_id)
    || left.start_utf8_byte - right.start_utf8_byte
    || left.end_utf8_byte - right.end_utf8_byte
    || compareText(left.source_unit_id, right.source_unit_id);
}

function compareObservations(left, right) {
  return left.start_utf8_byte - right.start_utf8_byte
    || left.end_utf8_byte - right.end_utf8_byte
    || compareText(left.state, right.state)
    || compareText(left.slot_key || '', right.slot_key || '')
    || compareText(left.evidence_role_key || '', right.evidence_role_key || '')
    || compareText(canonicalJson(left.lexical_payload), canonicalJson(right.lexical_payload));
}

function compareRecords(left, right) {
  return compareText(left.source_unit_id, right.source_unit_id)
    || left.evidence.start_utf8_byte - right.evidence.start_utf8_byte
    || left.evidence.end_utf8_byte - right.evidence.end_utf8_byte
    || compareText(left.slot_key || '', right.slot_key || '')
    || compareText(left.candidate_key || left.outcome_key, right.candidate_key || right.outcome_key);
}

function validateScopeReceipt(scopeReceipt) {
  const code = 'INVALID_PROCESS_LEXICAL_SCOPE_RECEIPT';
  requireExactKeys(scopeReceipt, ['scope_receipt_id', 'slots'], 'scope_receipt', code);
  requireDigest(scopeReceipt.scope_receipt_id, 'scope_receipt.scope_receipt_id', code);
  if (!Array.isArray(scopeReceipt.slots) || scopeReceipt.slots.length === 0) {
    fail(code, 'scope_receipt.slots must be a non-empty array.');
  }
  const slots = scopeReceipt.slots.map((slot, index) => {
    requireExactKeys(slot, [
      'slot_key',
      'deal_id',
      'occurrence_kind',
      'required_evidence_roles',
    ], `scope_receipt.slots[${index}]`, code);
    requireNonEmptyString(slot.slot_key, `scope_receipt.slots[${index}].slot_key`, code);
    requireDigest(slot.deal_id, `scope_receipt.slots[${index}].deal_id`, code);
    requireNonEmptyString(slot.occurrence_kind, `scope_receipt.slots[${index}].occurrence_kind`, code);
    if (!Array.isArray(slot.required_evidence_roles)
      || slot.required_evidence_roles.length === 0
      || slot.required_evidence_roles.some((role) => typeof role !== 'string' || role.length === 0)
      || new Set(slot.required_evidence_roles).size !== slot.required_evidence_roles.length) {
      fail(code, `scope_receipt.slots[${index}].required_evidence_roles must be a non-empty unique string array.`);
    }
    return cloneCanonical(slot, `scope_receipt.slots[${index}]`, code);
  });
  const keys = slots.map((slot) => slot.slot_key);
  if (new Set(keys).size !== keys.length) fail(code, 'scope_receipt slot keys must be unique.');
  return { scope_receipt_id: scopeReceipt.scope_receipt_id, slots };
}

function validateLimits(limits, reportedUsage) {
  const code = 'INVALID_PROCESS_LEXICAL_ENUMERATION_LIMITS';
  requireExactKeys(limits, [
    'max_source_count',
    'max_source_bytes',
    'max_candidate_count',
    'max_duration_ms',
    'max_memory_bytes',
  ], 'limits', code);
  requireBoundedInteger(limits.max_source_count, 'limits.max_source_count', MAX_SOURCE_COUNT, code);
  requireBoundedInteger(limits.max_source_bytes, 'limits.max_source_bytes', MAX_SOURCE_BYTES, code);
  requireBoundedInteger(limits.max_candidate_count, 'limits.max_candidate_count', MAX_CANDIDATE_COUNT, code);
  requireBoundedInteger(limits.max_duration_ms, 'limits.max_duration_ms', MAX_DURATION_MS, code);
  requireBoundedInteger(limits.max_memory_bytes, 'limits.max_memory_bytes', MAX_MEMORY_BYTES, code);
  requireExactKeys(reportedUsage, ['duration_ms', 'memory_bytes'], 'reported_usage', code);
  requireBoundedInteger(reportedUsage.duration_ms, 'reported_usage.duration_ms', MAX_DURATION_MS, code);
  requireBoundedInteger(reportedUsage.memory_bytes, 'reported_usage.memory_bytes', MAX_MEMORY_BYTES, code);
  if (reportedUsage.duration_ms > limits.max_duration_ms
    || reportedUsage.memory_bytes > limits.max_memory_bytes) {
    fail(code, 'reported usage exceeds a caller-provided limit.');
  }
  return {
    ...cloneCanonical(limits, 'limits', code),
    reported_usage: cloneCanonical(reportedUsage, 'reported_usage', code),
  };
}

function validateObservation(observation, unit, slotByKey, index) {
  const code = 'INVALID_PROCESS_LEXICAL_OBSERVATION';
  requireExactKeys(observation, [
    'state',
    'slot_key',
    'evidence_role_key',
    'start_utf8_byte',
    'end_utf8_byte',
    'lexical_payload',
    'reason_code',
  ], `source_units[${index}].lexical_observations`, code);
  if (!['CANDIDATE', 'REJECTED', 'AMBIGUOUS', 'UNSUPPORTED'].includes(observation.state)) {
    fail(code, 'lexical observation state is not supported.');
  }
  if (observation.slot_key !== null) requireNonEmptyString(observation.slot_key, 'lexical observation slot_key', code);
  if (observation.evidence_role_key !== null) requireNonEmptyString(observation.evidence_role_key, 'lexical observation evidence_role_key', code);
  requireBoundedInteger(observation.start_utf8_byte, 'lexical observation start_utf8_byte', unit.end_utf8_byte, code);
  requireBoundedInteger(observation.end_utf8_byte, 'lexical observation end_utf8_byte', unit.end_utf8_byte, code);
  if (observation.start_utf8_byte >= observation.end_utf8_byte
    || observation.start_utf8_byte < unit.start_utf8_byte
    || observation.end_utf8_byte > unit.end_utf8_byte) {
    fail(code, 'lexical observation must be a non-empty interval inside its source unit.');
  }
  requireObject(observation.lexical_payload, 'lexical observation lexical_payload', code);
  if (Object.keys(observation.lexical_payload).length === 0) {
    fail(code, 'lexical observation lexical_payload must not be empty.');
  }
  cloneCanonical(observation.lexical_payload, 'lexical observation lexical_payload', code);
  if (observation.reason_code !== null) requireNonEmptyString(observation.reason_code, 'lexical observation reason_code', code);
  if (observation.state === 'CANDIDATE'
    && (observation.slot_key === null || observation.evidence_role_key === null || observation.reason_code !== null)) {
    fail(code, 'a candidate observation requires a slot, an evidence role and no reason code.');
  }
  if (observation.state !== 'CANDIDATE' && observation.reason_code === null) {
    fail(code, 'a non-candidate observation requires a reason code.');
  }
  const localStart = observation.start_utf8_byte - unit.start_utf8_byte;
  const localEnd = observation.end_utf8_byte - unit.start_utf8_byte;
  let exactText;
  try {
    exactText = utf8Slice(unit.exact_text, localStart, localEnd);
  } catch (error) {
    fail(code, 'lexical observation interval must use UTF-8 code-point boundaries.', {
      cause: error.message,
    });
  }
  const slot = observation.slot_key === null ? null : slotByKey.get(observation.slot_key);
  return {
    ...cloneCanonical(observation, 'lexical observation', code),
    exact_text_digest: sha256Hex(Buffer.from(exactText, 'utf8')),
    mapped_slot: slot || null,
  };
}

function validateSourceUnit(value, index, slotByKey) {
  const code = 'INVALID_PROCESS_LEXICAL_SOURCE_UNIT';
  requireExactKeys(value, [
    'source_unit_id',
    'source_document_identity',
    'source_revision_id',
    'document_hash',
    'start_utf8_byte',
    'end_utf8_byte',
    'exact_text',
    'lexical_observations',
  ], `source_units[${index}]`, code);
  for (const key of [
    'source_unit_id',
    'source_document_identity',
    'source_revision_id',
    'document_hash',
  ]) requireDigest(value[key], `source_units[${index}].${key}`, code);
  requireBoundedInteger(value.start_utf8_byte, `source_units[${index}].start_utf8_byte`, MAX_SOURCE_BYTES, code);
  requireBoundedInteger(value.end_utf8_byte, `source_units[${index}].end_utf8_byte`, MAX_SOURCE_BYTES, code);
  if (value.start_utf8_byte > value.end_utf8_byte || typeof value.exact_text !== 'string') {
    fail(code, `source_units[${index}] has an invalid source interval or exact text.`);
  }
  if (Buffer.byteLength(value.exact_text, 'utf8') !== value.end_utf8_byte - value.start_utf8_byte) {
    fail(code, `source_units[${index}] exact_text byte length does not equal its source interval.`);
  }
  if (!Array.isArray(value.lexical_observations)) {
    fail(code, `source_units[${index}].lexical_observations must be an array.`);
  }
  const unit = cloneCanonical(value, `source_units[${index}]`, code);
  const observations = unit.lexical_observations.map((item) => (
    validateObservation(item, unit, slotByKey, index)
  )).sort(compareObservations);
  return { ...unit, lexical_observations: observations };
}

function evidenceFor(unit, observation) {
  return Object.freeze({
    source_document_identity: unit.source_document_identity,
    source_revision_id: unit.source_revision_id,
    document_hash: unit.document_hash,
    start_utf8_byte: observation.start_utf8_byte,
    end_utf8_byte: observation.end_utf8_byte,
    exact_text_digest: observation.exact_text_digest,
    evidence_role_key: observation.evidence_role_key,
  });
}

function outcomeFor(unit, observation, outcomeKind, reasonCode) {
  const evidence = evidenceFor(unit, observation);
  const body = {
    scope_receipt_id: null,
    outcome_kind: outcomeKind,
    reason_code: reasonCode,
    source_unit_id: unit.source_unit_id,
    slot_key: observation.slot_key,
    evidence,
    lexical_payload: observation.lexical_payload,
  };
  return body;
}

function buildOutcome(scopeReceiptId, unit, observation, outcomeKind, reasonCode) {
  const body = outcomeFor(unit, observation, outcomeKind, reasonCode);
  body.scope_receipt_id = scopeReceiptId;
  return Object.freeze({
    schema_version: PROCESS_LEXICAL_OUTCOME_SCHEMA,
    outcome_key: contentId(PROCESS_LEXICAL_OUTCOME_SCHEMA, body),
    ...body,
  });
}

function enumerateProcessLexicalCandidates(input) {
  const code = 'INVALID_PROCESS_LEXICAL_ENUMERATION_INPUT';
  requireExactKeys(input, [
    'scope_receipt',
    'source_units',
    'limits',
    'reported_usage',
  ], 'input', code);
  const scopeReceipt = validateScopeReceipt(input.scope_receipt);
  const limitState = validateLimits(input.limits, input.reported_usage);
  if (!Array.isArray(input.source_units)) fail(code, 'source_units must be an array.');
  if (input.source_units.length > limitState.max_source_count) {
    fail('PROCESS_LEXICAL_SOURCE_COUNT_LIMIT_EXCEEDED', 'source_units exceeds max_source_count.');
  }
  const slotByKey = new Map(scopeReceipt.slots.map((slot) => [slot.slot_key, slot]));
  const sourceUnits = input.source_units.map((unit, index) => (
    validateSourceUnit(unit, index, slotByKey)
  )).sort(compareSourceUnits);
  const sourceIds = sourceUnits.map((unit) => unit.source_unit_id);
  if (new Set(sourceIds).size !== sourceIds.length) {
    fail('DUPLICATE_PROCESS_LEXICAL_SOURCE_UNIT', 'source_unit_id must be unique.');
  }
  const sourceBytes = sourceUnits.reduce((total, unit) => (
    total + Buffer.byteLength(unit.exact_text, 'utf8')
  ), 0);
  if (sourceBytes > limitState.max_source_bytes) {
    fail('PROCESS_LEXICAL_SOURCE_BYTES_LIMIT_EXCEEDED', 'source bytes exceed max_source_bytes.');
  }

  const candidates = [];
  const rejections = [];
  const residuals = [];
  for (const unit of sourceUnits) {
    for (const observation of unit.lexical_observations) {
      if (observation.state === 'REJECTED') {
        rejections.push(buildOutcome(scopeReceipt.scope_receipt_id, unit, observation, 'REJECTION', observation.reason_code));
        continue;
      }
      if (observation.state === 'AMBIGUOUS' || observation.state === 'UNSUPPORTED') {
        residuals.push(buildOutcome(scopeReceipt.scope_receipt_id, unit, observation, 'RESIDUAL', observation.reason_code));
        continue;
      }
      if (!observation.mapped_slot) {
        residuals.push(buildOutcome(scopeReceipt.scope_receipt_id, unit, observation, 'RESIDUAL', 'UNKNOWN_EXPECTED_OCCURRENCE_SLOT'));
        continue;
      }
      if (!observation.mapped_slot.required_evidence_roles.includes(observation.evidence_role_key)) {
        residuals.push(buildOutcome(scopeReceipt.scope_receipt_id, unit, observation, 'RESIDUAL', 'UNSUPPORTED_EVIDENCE_ROLE_FOR_SLOT'));
        continue;
      }
      const evidence = evidenceFor(unit, observation);
      const body = {
        scope_receipt_id: scopeReceipt.scope_receipt_id,
        slot_key: observation.slot_key,
        source_unit_id: unit.source_unit_id,
        evidence,
        lexical_payload: observation.lexical_payload,
      };
      candidates.push(Object.freeze({
        schema_version: PROCESS_LEXICAL_CANDIDATE_SCHEMA,
        candidate_key: contentId(PROCESS_LEXICAL_CANDIDATE_SCHEMA, body),
        ...body,
      }));
    }
  }
  candidates.sort(compareRecords);
  rejections.sort(compareRecords);
  residuals.sort(compareRecords);
  if (candidates.length > limitState.max_candidate_count) {
    fail('PROCESS_LEXICAL_CANDIDATE_COUNT_LIMIT_EXCEEDED', 'candidates exceed max_candidate_count.');
  }
  const candidateKeys = candidates.map((candidate) => candidate.candidate_key);
  if (new Set(candidateKeys).size !== candidateKeys.length) {
    fail('DUPLICATE_PROCESS_LEXICAL_CANDIDATE', 'equivalent lexical observations must not be silently merged.');
  }
  return deepFreeze({
    schema_version: PROCESS_LEXICAL_ENUMERATION_SCHEMA,
    scope_receipt_id: scopeReceipt.scope_receipt_id,
    candidates,
    rejections,
    residuals,
    limits: Object.freeze({
      ...limitState,
      source_count: sourceUnits.length,
      source_bytes: sourceBytes,
    }),
  });
}

module.exports = {
  MAX_CANDIDATE_COUNT,
  MAX_DURATION_MS,
  MAX_MEMORY_BYTES,
  MAX_SOURCE_BYTES,
  MAX_SOURCE_COUNT,
  PROCESS_LEXICAL_CANDIDATE_SCHEMA,
  PROCESS_LEXICAL_ENUMERATION_SCHEMA,
  PROCESS_LEXICAL_OUTCOME_SCHEMA,
  ProcessLexicalEnumeratorError,
  enumerateProcessLexicalCandidates,
};
