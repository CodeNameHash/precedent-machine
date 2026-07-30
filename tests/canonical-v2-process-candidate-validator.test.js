const assert = require('node:assert/strict');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  CANDIDATE_GRAPH_INPUT_SCHEMA,
  buildProcessCandidateGraph,
} = require('../lib/canonical-v2/process-candidate-graph');
const {
  CANDIDATE_VALIDATOR_INPUT_SCHEMA,
  validateProcessCandidateGraph,
} = require('../lib/canonical-v2/process-candidate-validator');

function limits() {
  return {
    max_source_bytes: 4096,
    max_candidate_count: 16,
    max_runtime_ms: 1000,
    max_memory_bytes: 1024 * 1024,
  };
}

function evidence(label) {
  return {
    source_document_identity: `document:${label}`,
    source_revision_id: `revision:${label}`,
    document_hash: sha256Hex(`document:${label}`),
    start_utf8_byte: 0,
    end_utf8_byte: 4,
    exact_text_digest: sha256Hex(`text:${label}`),
  };
}

function enumeration(schema, payloadKey) {
  return {
    schema_version: schema,
    scope_receipt_id: 'scope:one',
    candidates: [{
      schema_version: `PROCESS_${payloadKey === 'semantic_payload' ? 'SEMANTIC' : 'LEXICAL'}_CANDIDATE/V1`,
      candidate_key: 'candidate:one',
      scope_receipt_id: 'scope:one',
      slot_key: 'slot:one',
      source_unit_id: 'source:one',
      evidence: evidence('one'),
      [payloadKey]: { value: 'one' },
    }],
    rejections: [],
    residuals: [],
    limits: limits(),
  };
}

function input() {
  const semantic_enumeration = enumeration(
    'PROCESS_SEMANTIC_ENUMERATION/V1',
    'semantic_payload',
  );
  const lexical_enumeration = enumeration(
    'PROCESS_LEXICAL_ENUMERATION/V1',
    'lexical_payload',
  );
  const candidate_graph = buildProcessCandidateGraph({
    schema_version: CANDIDATE_GRAPH_INPUT_SCHEMA,
    semantic_enumeration,
    lexical_enumeration,
    limits: limits(),
  });
  return {
    schema_version: CANDIDATE_VALIDATOR_INPUT_SCHEMA,
    candidate_graph,
    semantic_enumeration,
    lexical_enumeration,
  };
}

test('returns one deterministic non-authoritative validation receipt', () => {
  const first = validateProcessCandidateGraph(input());
  const second = validateProcessCandidateGraph(input());

  assert.deepEqual(first, second);
  assert.equal(first.validation_state, 'VALIDATED_PURE_RUNTIME');
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.equal(first.candidate_node_count, 2);
  assert.equal(Object.isFrozen(first), true);
});

test('rejects a substituted graph node and stale graph identity', () => {
  const changedNode = input();
  changedNode.candidate_graph = JSON.parse(JSON.stringify(changedNode.candidate_graph));
  changedNode.candidate_graph.candidate_nodes[0].source_unit_id = 'source:substituted';
  assert.throws(
    () => validateProcessCandidateGraph(changedNode),
    { code: 'INVALID_PROCESS_CANDIDATE_VALIDATOR_INPUT' },
  );

  const staleId = input();
  staleId.candidate_graph = JSON.parse(JSON.stringify(staleId.candidate_graph));
  staleId.candidate_graph.candidate_graph_id = 'stale';
  assert.throws(
    () => validateProcessCandidateGraph(staleId),
    { code: 'INVALID_PROCESS_CANDIDATE_VALIDATOR_INPUT' },
  );
});

test('rejects graph additions and hostile enumerator material', () => {
  const added = input();
  added.candidate_graph = JSON.parse(JSON.stringify(added.candidate_graph));
  added.candidate_graph.unapproved = true;
  assert.throws(
    () => validateProcessCandidateGraph(added),
    { code: 'INVALID_PROCESS_CANDIDATE_VALIDATOR_INPUT' },
  );

  const hostile = input();
  hostile.lexical_enumeration.candidates[0].evidence.start_utf8_byte = -1;
  assert.throws(
    () => validateProcessCandidateGraph(hostile),
    { code: 'INVALID_PROCESS_CANDIDATE_ENUMERATION' },
  );
});
