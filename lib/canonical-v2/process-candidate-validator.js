const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  CANDIDATE_GRAPH_INPUT_SCHEMA,
  CANDIDATE_GRAPH_SCHEMA,
  buildProcessCandidateGraph,
} = require('./process-candidate-graph');

const CANDIDATE_VALIDATOR_INPUT_SCHEMA =
  'PROCESS_CANDIDATE_VALIDATOR_INPUT/V1';
const CANDIDATE_VALIDATION_RECEIPT_SCHEMA =
  'PROCESS_CANDIDATE_VALIDATION_RECEIPT/V1';

class ProcessCandidateValidatorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessCandidateValidatorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessCandidateValidatorError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requireExactKeys(value, expected, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} does not have the exact required keys.`, {
      actual,
      expected: required,
    });
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

function validateProcessCandidateGraph(input) {
  const code = 'INVALID_PROCESS_CANDIDATE_VALIDATOR_INPUT';
  requireExactKeys(input, [
    'schema_version',
    'candidate_graph',
    'semantic_enumeration',
    'lexical_enumeration',
  ], 'Process candidate validator input', code);
  if (input.schema_version !== CANDIDATE_VALIDATOR_INPUT_SCHEMA) {
    fail(code, 'Process candidate validator input has the wrong schema version.');
  }
  if (input.candidate_graph?.schema_version !== CANDIDATE_GRAPH_SCHEMA) {
    fail(code, 'Candidate graph has the wrong schema version.');
  }
  const expected = buildProcessCandidateGraph({
    schema_version: CANDIDATE_GRAPH_INPUT_SCHEMA,
    semantic_enumeration: input.semantic_enumeration,
    lexical_enumeration: input.lexical_enumeration,
    limits: input.candidate_graph?.limits,
  });
  const actual = cloneCanonical(input.candidate_graph, 'Candidate graph', code);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, 'Candidate graph does not exactly bind the supplied enumeration outputs.', {
      expected_candidate_graph_id: expected.candidate_graph_id,
      actual_candidate_graph_id: actual.candidate_graph_id,
    });
  }
  const body = {
    candidate_graph_id: expected.candidate_graph_id,
    scope_receipt_id: expected.scope_receipt_id,
    candidate_node_count: expected.candidate_nodes.length,
    retained_record_count: expected.retained_records.length,
    disagreement_count: expected.disagreements.length,
    validation_state: 'VALIDATED_PURE_RUNTIME',
    authority_state: 'NOT_GRANTED',
  };
  return deepFreeze({
    schema_version: CANDIDATE_VALIDATION_RECEIPT_SCHEMA,
    candidate_validation_receipt_id: contentId(
      CANDIDATE_VALIDATION_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  });
}

module.exports = {
  CANDIDATE_VALIDATION_RECEIPT_SCHEMA,
  CANDIDATE_VALIDATOR_INPUT_SCHEMA,
  ProcessCandidateValidatorError,
  validateProcessCandidateGraph,
};
