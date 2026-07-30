const assert = require('node:assert/strict');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  CANDIDATE_GRAPH_INPUT_SCHEMA,
  buildProcessCandidateGraph,
} = require('../lib/canonical-v2/process-candidate-graph');
const {
  INPUT_SCHEMA: SCOPE_INPUT_SCHEMA,
  enumerateProcessScope,
} = require('../lib/canonical-v2/process-scope-enumerator');
const {
  INPUT_SCHEMA: SEMANTIC_INPUT_SCHEMA,
  enumerateProcessSemantics,
} = require('../lib/canonical-v2/process-semantic-enumerator');
const {
  enumerateProcessLexicalCandidates,
} = require('../lib/canonical-v2/process-lexical-enumerator');

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

test('accepts the actual frozen scope, semantic and lexical pure-runtime chain', () => {
  const digest = (label) => contentId('P7_GRAPH_CHAIN_TEST/V1', { label });
  const scopeEvidence = {
    source_document_identity: digest('scope-document'),
    source_revision_id: digest('scope-revision'),
    document_hash: digest('scope-hash'),
    start_utf8_byte: 0,
    end_utf8_byte: 5,
    exact_text_digest: sha256Hex('scope'),
  };
  const scope = enumerateProcessScope({
    schema_version: SCOPE_INPUT_SCHEMA,
    governed_deal_admission_id: digest('deal'),
    scope_records: [{
      record_key: 'SLOT_001',
      record_state: 'SLOT',
      slot_key: 'SLOT_001',
      deal_id: digest('deal'),
      occurrence_kind: 'EXCLUSIVITY_EVENT',
      required_evidence_roles: ['AGREEMENT_TEXT'],
      scope_evidence: [scopeEvidence],
      residual_code: null,
    }, {
      record_key: 'SCOPE_RESIDUAL_001',
      record_state: 'RESIDUAL',
      slot_key: null,
      deal_id: digest('deal'),
      occurrence_kind: null,
      required_evidence_roles: null,
      scope_evidence: [scopeEvidence],
      residual_code: 'UNRESOLVED_SCOPE',
    }],
    limits: { max_scope_records: 4, max_slots: 2 },
  });
  const semantic = enumerateProcessSemantics({
    schema_version: SEMANTIC_INPUT_SCHEMA,
    scope_receipt_id: scope.scope_receipt_id,
    frozen_slots: scope.expected_occurrence_slots,
    source_units: [{
      source_unit_id: digest('semantic-unit'),
      unit_state: 'CANDIDATE',
      slot_key: 'SLOT_001',
      evidence: {
        source_document_identity: digest('semantic-document'),
        source_revision_id: digest('semantic-revision'),
        document_hash: digest('semantic-hash'),
        start_utf8_byte: 0,
        end_utf8_byte: 5,
        exact_text_digest: sha256Hex('value'),
        evidence_role_key: 'AGREEMENT_TEXT',
      },
      semantic_payload: { predicate_key: 'RESTRICTED_ACTION', polarity: 'PRESENT' },
      disposition_code: null,
    }],
    limits: { max_source_units: 2, max_candidates: 2 },
  });
  const text = 'value';
  const lexical = enumerateProcessLexicalCandidates({
    scope_receipt: scope,
    source_units: [{
      source_unit_id: digest('lexical-unit'),
      source_document_identity: digest('lexical-document'),
      source_revision_id: digest('lexical-revision'),
      document_hash: digest('lexical-hash'),
      start_utf8_byte: 0,
      end_utf8_byte: Buffer.byteLength(text, 'utf8'),
      exact_text: text,
      lexical_observations: [{
        state: 'CANDIDATE',
        slot_key: 'SLOT_001',
        evidence_role_key: 'AGREEMENT_TEXT',
        start_utf8_byte: 0,
        end_utf8_byte: Buffer.byteLength(text, 'utf8'),
        lexical_payload: { token: text },
        reason_code: null,
      }],
    }],
    limits: {
      max_source_count: 2,
      max_source_bytes: 32,
      max_candidate_count: 2,
      max_duration_ms: 100,
      max_memory_bytes: 1024,
    },
    reported_usage: { duration_ms: 1, memory_bytes: 128 },
  });
  const graph = buildProcessCandidateGraph({
    schema_version: CANDIDATE_GRAPH_INPUT_SCHEMA,
    semantic_enumeration: semantic,
    lexical_enumeration: lexical,
    limits: limits(),
  });

  assert.equal(graph.scope_receipt_id, scope.scope_receipt_id);
  assert.equal(graph.candidate_nodes.length, 2);
  assert.equal(graph.retained_records.length, 1);
  assert.equal(graph.retained_records[0].outcome_kind, 'SCOPE_RESIDUAL');
});
