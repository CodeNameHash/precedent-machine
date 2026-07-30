const assert = require('node:assert/strict');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  CANDIDATE_GRAPH_INPUT_SCHEMA,
  buildProcessCandidateGraph,
} = require('../lib/canonical-v2/process-candidate-graph');

function evidence(label, start = 0) {
  return {
    source_document_identity: `document:${label}`,
    source_revision_id: `revision:${label}`,
    document_hash: sha256Hex(`document:${label}`),
    start_utf8_byte: start,
    end_utf8_byte: start + 4,
    exact_text_digest: sha256Hex(`text:${label}`),
  };
}

function candidate(key, payloadKey, label = key) {
  return {
    schema_version: `PROCESS_${payloadKey === 'semantic_payload' ? 'SEMANTIC' : 'LEXICAL'}_CANDIDATE/V1`,
    candidate_key: key,
    scope_receipt_id: 'scope:one',
    slot_key: 'EXCLUSIVITY_001',
    source_unit_id: `source:${label}`,
    evidence: evidence(label),
    [payloadKey]: { recognised: label },
  };
}

function record(key, label = key) {
  const kind = key.includes('semantic') ? 'SEMANTIC' : 'LEXICAL';
  const payloadKey = kind === 'SEMANTIC' ? 'semantic_payload' : 'lexical_payload';
  return {
    schema_version: `PROCESS_${kind}_OUTCOME/V1`,
    outcome_key: key,
    scope_receipt_id: 'scope:one',
    outcome_kind: key.includes('rejection') ? 'REJECTION' : 'RESIDUAL',
    slot_key: 'EXCLUSIVITY_001',
    source_unit_id: `source:${label}`,
    evidence: evidence(label),
    reason_code: 'UNSUPPORTED_SYNTHETIC_INPUT',
    [payloadKey]: { label },
  };
}

function limits() {
  return {
    max_source_bytes: 4096,
    max_candidate_count: 16,
    max_runtime_ms: 1000,
    max_memory_bytes: 1024 * 1024,
  };
}

function input(overrides = {}) {
  return {
    schema_version: CANDIDATE_GRAPH_INPUT_SCHEMA,
    semantic_enumeration: {
      schema_version: 'PROCESS_SEMANTIC_ENUMERATION/V1',
      scope_receipt_id: 'scope:one',
      candidates: [candidate('same', 'semantic_payload')],
      rejections: [record('semantic-rejection')],
      residuals: [],
      limits: limits(),
    },
    lexical_enumeration: {
      schema_version: 'PROCESS_LEXICAL_ENUMERATION/V1',
      scope_receipt_id: 'scope:one',
      candidates: [candidate('same', 'lexical_payload'), candidate('lexical-only', 'lexical_payload')],
      rejections: [],
      residuals: [record('lexical-residual')],
      limits: limits(),
    },
    limits: limits(),
    ...overrides,
  };
}

test('builds a deterministic graph and retains both enumerators', () => {
  const first = buildProcessCandidateGraph(input());
  const second = buildProcessCandidateGraph(input());

  assert.deepEqual(first, second);
  assert.equal(first.validation_state, 'VALIDATED_PURE_RUNTIME');
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.equal(first.candidate_nodes.length, 3);
  assert.equal(first.retained_records.length, 2);
  assert.deepEqual(first.disagreements.map((item) => item.candidate_key), ['lexical-only']);
  assert.equal(Object.isFrozen(first), true);
});

test('rejects mismatched frozen scope receipts and unsafe bounds', () => {
  const scopeMismatch = input();
  scopeMismatch.lexical_enumeration.scope_receipt_id = 'scope:other';
  for (const candidate of scopeMismatch.lexical_enumeration.candidates) {
    candidate.scope_receipt_id = 'scope:other';
  }
  for (const outcome of [
    ...scopeMismatch.lexical_enumeration.rejections,
    ...scopeMismatch.lexical_enumeration.residuals,
  ]) {
    outcome.scope_receipt_id = 'scope:other';
  }
  assert.throws(
    () => buildProcessCandidateGraph(scopeMismatch),
    { code: 'INVALID_PROCESS_CANDIDATE_GRAPH_INPUT' },
  );

  const overBound = input({ limits: { ...limits(), max_candidate_count: 2 } });
  assert.throws(
    () => buildProcessCandidateGraph(overBound),
    { code: 'INVALID_PROCESS_CANDIDATE_GRAPH_INPUT' },
  );
});

test('rejects duplicate, substituted and hostile source records', () => {
  const duplicate = input();
  duplicate.semantic_enumeration.candidates.push(candidate('same', 'semantic_payload', 'other'));
  assert.throws(
    () => buildProcessCandidateGraph(duplicate),
    { code: 'INVALID_PROCESS_CANDIDATE_ENUMERATION' },
  );

  const hostile = input();
  hostile.lexical_enumeration.candidates[0].evidence.end_utf8_byte = 0;
  assert.throws(
    () => buildProcessCandidateGraph(hostile),
    { code: 'INVALID_PROCESS_CANDIDATE_ENUMERATION' },
  );

  const substituted = input();
  substituted.semantic_enumeration.candidates[0].lexical_payload = {};
  assert.throws(
    () => buildProcessCandidateGraph(substituted),
    { code: 'INVALID_PROCESS_CANDIDATE_ENUMERATION' },
  );
});

test('retains a same-key cross-enumerator source conflict as disagreement', () => {
  const conflicted = input();
  conflicted.lexical_enumeration.candidates[0].source_unit_id = 'source:substituted';
  const graph = buildProcessCandidateGraph(conflicted);

  assert.deepEqual(graph.disagreements, [{
    candidate_key: 'lexical-only',
    semantic_node_indexes: [],
    lexical_node_indexes: [0],
    reason_code: 'ENUMERATOR_MISSING_CANDIDATE',
  }, {
    candidate_key: 'same',
    semantic_node_indexes: [2],
    lexical_node_indexes: [1],
    reason_code: 'CANDIDATE_KEY_CONTEXT_CONFLICT',
  }]);
});
