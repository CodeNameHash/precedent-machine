const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');

const CANDIDATE_GRAPH_INPUT_SCHEMA = 'PROCESS_CANDIDATE_GRAPH_INPUT/V1';
const CANDIDATE_GRAPH_SCHEMA = 'PROCESS_CANDIDATE_GRAPH/V1';
const SEMANTIC_ENUMERATION_SCHEMA = 'PROCESS_SEMANTIC_ENUMERATION/V1';
const LEXICAL_ENUMERATION_SCHEMA = 'PROCESS_LEXICAL_ENUMERATION/V1';
const MAX_CANDIDATES = 4096;
const MAX_RECORDS = 8192;

class ProcessCandidateGraphError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessCandidateGraphError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessCandidateGraphError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
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

function requireNonEmptyString(value, label, code) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${label} must be a non-empty string.`);
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

function compareCandidateNode(left, right) {
  return compareText(left.candidate_key, right.candidate_key)
    || compareText(left.enumerator_kind, right.enumerator_kind)
    || compareText(left.source_unit_id, right.source_unit_id);
}

function candidateContext(candidate) {
  return {
    slot_key: candidate.slot_key,
    source_unit_id: candidate.source_unit_id,
    evidence: candidate.evidence,
  };
}

function validateEvidence(evidence, label, code) {
  requireObject(evidence, `${label} evidence`, code);
  const expected = [
    'source_document_identity',
    'source_revision_id',
    'document_hash',
    'start_utf8_byte',
    'end_utf8_byte',
    'exact_text_digest',
  ];
  if (Object.hasOwn(evidence, 'evidence_role_key')) {
    expected.push('evidence_role_key');
  }
  if (Object.hasOwn(evidence, 'scope_evidence')) {
    expected.push('scope_evidence');
  }
  requireExactKeys(evidence, expected, `${label} evidence`, code);
  for (const key of [
    'source_document_identity',
    'source_revision_id',
    'document_hash',
    'exact_text_digest',
  ]) {
    requireNonEmptyString(evidence[key], `${label} evidence ${key}`, code);
  }
  if (!Number.isSafeInteger(evidence.start_utf8_byte)
    || !Number.isSafeInteger(evidence.end_utf8_byte)
    || evidence.start_utf8_byte < 0
    || evidence.end_utf8_byte <= evidence.start_utf8_byte) {
    fail(code, `${label} evidence must have a valid half-open UTF-8 interval.`);
  }
  if (Object.hasOwn(evidence, 'evidence_role_key')) {
    requireNonEmptyString(evidence.evidence_role_key, `${label} evidence role`, code);
  }
  if (Object.hasOwn(evidence, 'scope_evidence')) {
    validateScopeEvidence(evidence.scope_evidence, `${label} scope evidence`, code);
  }
}

function validateScopeEvidence(values, label, code) {
  if (!Array.isArray(values) || values.length === 0 || values.length > 64) {
    fail(code, `${label} must be a bounded non-empty array.`);
  }
  const seen = new Set();
  for (const [index, value] of values.entries()) {
    requireExactKeys(value, [
      'source_document_identity',
      'source_revision_id',
      'document_hash',
      'start_utf8_byte',
      'end_utf8_byte',
      'exact_text_digest',
    ], `${label} ${index}`, code);
    validateEvidence(value, `${label} ${index}`, code);
    const fingerprint = canonicalJson(value);
    if (seen.has(fingerprint)) fail(code, `${label} contains duplicate evidence.`);
    seen.add(fingerprint);
  }
}

function validateCandidate(candidate, kind, index) {
  const code = 'INVALID_PROCESS_CANDIDATE_ENUMERATION';
  const payloadKey = kind === 'SEMANTIC' ? 'semantic_payload' : 'lexical_payload';
  requireExactKeys(candidate, [
    'schema_version',
    'candidate_key',
    'scope_receipt_id',
    'slot_key',
    'source_unit_id',
    'evidence',
    payloadKey,
  ], `${kind} candidate ${index}`, code);
  if (candidate.schema_version !== `PROCESS_${kind}_CANDIDATE/V1`) {
    fail(code, `${kind} candidate ${index} has the wrong schema version.`);
  }
  for (const key of ['candidate_key', 'scope_receipt_id', 'slot_key', 'source_unit_id']) {
    requireNonEmptyString(candidate[key], `${kind} candidate ${index} ${key}`, code);
  }
  validateEvidence(candidate.evidence, `${kind} candidate ${index}`, code);
  requireObject(candidate[payloadKey], `${kind} candidate ${index} payload`, code);
  if (Object.keys(candidate[payloadKey]).length === 0) {
    fail(code, `${kind} candidate ${index} payload cannot be empty.`);
  }
  cloneCanonical(candidate[payloadKey], `${kind} candidate ${index} payload`, code);
  return cloneCanonical(candidate, `${kind} candidate ${index}`, code);
}

function validateRecord(record, kind, category, index) {
  const code = 'INVALID_PROCESS_CANDIDATE_ENUMERATION';
  const payloadKey = kind === 'SEMANTIC' ? 'semantic_payload' : 'lexical_payload';
  const semanticNonCandidate = kind === 'SEMANTIC';
  const scopeResidual = kind === 'LEXICAL'
    && category === 'residuals'
    && record?.outcome_kind === 'SCOPE_RESIDUAL';
  const expected = [
    'schema_version',
    'outcome_key',
    'scope_receipt_id',
    'outcome_kind',
    'reason_code',
    'slot_key',
    'source_unit_id',
    'evidence',
    payloadKey,
  ];
  if (scopeResidual) expected.push('scope_evidence');
  requireExactKeys(record, [
    ...expected,
  ], `${kind} ${category} ${index}`, code);
  if (record.schema_version !== `PROCESS_${kind}_OUTCOME/V1`
    || (!scopeResidual && record.outcome_kind !== (
      category === 'rejections' ? 'REJECTION' : 'RESIDUAL'
    ))) {
    fail(code, `${kind} ${category} ${index} has the wrong outcome identity.`);
  }
  for (const key of ['outcome_key', 'scope_receipt_id', 'source_unit_id', 'reason_code']) {
    requireNonEmptyString(record[key], `${kind} ${category} ${index} ${key}`, code);
  }
  if (scopeResidual) {
    if (record.slot_key !== null || record.evidence !== null || record[payloadKey] !== null) {
      fail(code, `${kind} scope residual ${index} cannot fabricate a candidate source record.`);
    }
    validateScopeEvidence(record.scope_evidence, `${kind} scope residual ${index}`, code);
  } else if (semanticNonCandidate) {
    if (record.slot_key !== null || record[payloadKey] !== null) {
      fail(code, `${kind} ${category} ${index} cannot fabricate a candidate slot or payload.`);
    }
    validateEvidence(record.evidence, `${kind} ${category} ${index}`, code);
  } else {
    if (kind === 'SEMANTIC') {
      if (record.slot_key !== null || record[payloadKey] !== null) {
        fail(code, `${kind} ${category} ${index} must retain producer-governed null semantic fields.`);
      }
    } else if (record.slot_key !== null) {
      requireNonEmptyString(record.slot_key, `${kind} ${category} ${index} slot key`, code);
    }
    validateEvidence(record.evidence, `${kind} ${category} ${index}`, code);
    if (kind === 'LEXICAL') {
      cloneCanonical(record[payloadKey], `${kind} ${category} ${index} payload`, code);
    }
  }
  const checked = cloneCanonical(record, `${kind} ${category} ${index}`, code);
  const body = {
    scope_receipt_id: checked.scope_receipt_id,
    outcome_kind: checked.outcome_kind,
    reason_code: checked.reason_code,
    source_unit_id: checked.source_unit_id,
    slot_key: checked.slot_key,
    evidence: checked.evidence,
    [payloadKey]: checked[payloadKey],
  };
  if (scopeResidual) body.scope_evidence = checked.scope_evidence;
  const expectedOutcomeKey = contentId(`PROCESS_${kind}_OUTCOME/V1`, body);
  if (checked.outcome_key !== expectedOutcomeKey) {
    fail(code, `${kind} ${category} ${index} outcome key does not bind its exact governed body.`);
  }
  return checked;
}

function validateLimits(limits, kind) {
  const code = 'INVALID_PROCESS_CANDIDATE_ENUMERATION';
  requireObject(limits, `${kind} limits`, code);
  if (Object.keys(limits).length === 0) {
    fail(code, `${kind} limits cannot be empty.`);
  }
  cloneCanonical(limits, `${kind} limits`, code);
}

function validateEnumeration(enumeration, kind) {
  const code = 'INVALID_PROCESS_CANDIDATE_ENUMERATION';
  requireObject(enumeration, `${kind} enumeration`, code);
  const expectedSchema = kind === 'SEMANTIC'
    ? SEMANTIC_ENUMERATION_SCHEMA
    : LEXICAL_ENUMERATION_SCHEMA;
  if (enumeration.schema_version !== expectedSchema) {
    fail(code, `${kind} enumeration has the wrong schema version.`);
  }
  requireNonEmptyString(enumeration.scope_receipt_id, `${kind} scope receipt ID`, code);
  for (const category of ['candidates', 'rejections', 'residuals']) {
    if (!Array.isArray(enumeration[category])) {
      fail(code, `${kind} ${category} must be an array.`);
    }
  }
  validateLimits(enumeration.limits, kind);
  if (enumeration.candidates.length > MAX_CANDIDATES
    || enumeration.rejections.length + enumeration.residuals.length > MAX_RECORDS) {
    fail(code, `${kind} enumeration exceeds the graph safety bound.`);
  }
  const candidateKeys = new Set();
  const recordKeys = new Set();
  const candidates = enumeration.candidates.map((candidate, index) => {
    const checked = validateCandidate(candidate, kind, index);
    if (checked.scope_receipt_id !== enumeration.scope_receipt_id) {
      fail(code, `${kind} candidate ${index} has a stale scope receipt.`);
    }
    if (candidateKeys.has(checked.candidate_key)) {
      fail(code, `${kind} enumeration has duplicate candidate keys.`);
    }
    candidateKeys.add(checked.candidate_key);
    return checked;
  });
  const records = {};
  for (const category of ['rejections', 'residuals']) {
    records[category] = enumeration[category].map((record, index) => {
      const checked = validateRecord(record, kind, category, index);
      if (checked.scope_receipt_id !== enumeration.scope_receipt_id) {
        fail(code, `${kind} ${category} ${index} has a stale scope receipt.`);
      }
      if (recordKeys.has(checked.outcome_key)) {
        fail(code, `${kind} enumeration has duplicate rejection or residual keys.`);
      }
      recordKeys.add(checked.outcome_key);
      return checked;
    });
  }
  return {
    scope_receipt_id: enumeration.scope_receipt_id,
    candidates,
    rejections: records.rejections,
    residuals: records.residuals,
    limits: cloneCanonical(enumeration.limits, `${kind} limits`, code),
  };
}

function buildProcessCandidateGraph(input) {
  const code = 'INVALID_PROCESS_CANDIDATE_GRAPH_INPUT';
  requireExactKeys(input, [
    'schema_version',
    'semantic_enumeration',
    'lexical_enumeration',
    'limits',
  ], 'Process candidate graph input', code);
  if (input.schema_version !== CANDIDATE_GRAPH_INPUT_SCHEMA) {
    fail(code, 'Process candidate graph input has the wrong schema version.');
  }
  const semantic = validateEnumeration(input.semantic_enumeration, 'SEMANTIC');
  const lexical = validateEnumeration(input.lexical_enumeration, 'LEXICAL');
  if (semantic.scope_receipt_id !== lexical.scope_receipt_id) {
    fail(code, 'Semantic and lexical enumerations must use the same frozen scope receipt.');
  }
  requireExactKeys(input.limits, [
    'max_source_bytes',
    'max_candidate_count',
    'max_runtime_ms',
    'max_memory_bytes',
  ], 'Graph limits', code);
  for (const key of Object.keys(input.limits)) {
    if (!Number.isSafeInteger(input.limits[key]) || input.limits[key] <= 0) {
      fail(code, `Graph limit ${key} must be a positive safe integer.`);
    }
  }
  const totalCandidates = semantic.candidates.length + lexical.candidates.length;
  if (totalCandidates > input.limits.max_candidate_count
    || totalCandidates > MAX_CANDIDATES) {
    fail(code, 'Candidate graph exceeds its candidate safety bound.');
  }
  const candidateNodes = [
    ...semantic.candidates.map((candidate) => ({
      enumerator_kind: 'SEMANTIC',
      ...candidate,
    })),
    ...lexical.candidates.map((candidate) => ({
      enumerator_kind: 'LEXICAL',
      ...candidate,
    })),
  ].sort(compareCandidateNode);
  const groups = new Map();
  for (const [nodeIndex, candidate] of candidateNodes.entries()) {
    const group = groups.get(candidate.candidate_key) || {
      candidate_key: candidate.candidate_key,
      semantic_node_indexes: [],
      lexical_node_indexes: [],
    };
    group[`${candidate.enumerator_kind.toLowerCase()}_node_indexes`]
      .push(nodeIndex);
    groups.set(candidate.candidate_key, group);
  }
  const disagreements = [...groups.values()]
    .map((group) => {
      if (group.semantic_node_indexes.length === 0
        || group.lexical_node_indexes.length === 0) {
        return { ...group, reason_code: 'ENUMERATOR_MISSING_CANDIDATE' };
      }
      const contexts = [
        ...group.semantic_node_indexes,
        ...group.lexical_node_indexes,
      ].map((nodeIndex) => candidateContext(candidateNodes[nodeIndex]));
      if (!contexts.every((context) => (
        canonicalJson(context) === canonicalJson(contexts[0])
      ))) {
        return { ...group, reason_code: 'CANDIDATE_KEY_CONTEXT_CONFLICT' };
      }
      return null;
    })
    .filter(Boolean)
    .sort((left, right) => compareText(left.candidate_key, right.candidate_key));
  const retainedRecords = [
    ...semantic.rejections.map((record) => ({ enumerator_kind: 'SEMANTIC', record_kind: 'REJECTION', ...record })),
    ...semantic.residuals.map((record) => ({ enumerator_kind: 'SEMANTIC', record_kind: 'RESIDUAL', ...record })),
    ...lexical.rejections.map((record) => ({ enumerator_kind: 'LEXICAL', record_kind: 'REJECTION', ...record })),
    ...lexical.residuals.map((record) => ({ enumerator_kind: 'LEXICAL', record_kind: 'RESIDUAL', ...record })),
  ].sort((left, right) => compareText(left.outcome_key, right.outcome_key)
    || compareText(left.enumerator_kind, right.enumerator_kind));
  const body = {
    scope_receipt_id: semantic.scope_receipt_id,
    candidate_nodes: candidateNodes,
    retained_records: retainedRecords,
    disagreements,
    limits: cloneCanonical(input.limits, 'Graph limits', code),
    validation_state: 'VALIDATED_PURE_RUNTIME',
    authority_state: 'NOT_GRANTED',
  };
  const output = {
    schema_version: CANDIDATE_GRAPH_SCHEMA,
    candidate_graph_id: contentId(CANDIDATE_GRAPH_SCHEMA, body),
    ...body,
  };
  return deepFreeze(output);
}

module.exports = {
  CANDIDATE_GRAPH_INPUT_SCHEMA,
  CANDIDATE_GRAPH_SCHEMA,
  LEXICAL_ENUMERATION_SCHEMA,
  MAX_CANDIDATES,
  MAX_RECORDS,
  ProcessCandidateGraphError,
  SEMANTIC_ENUMERATION_SCHEMA,
  buildProcessCandidateGraph,
  validateEnumeration,
};
