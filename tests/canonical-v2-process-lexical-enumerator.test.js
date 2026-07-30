const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  PROCESS_LEXICAL_ENUMERATION_SCHEMA,
  enumerateProcessLexicalCandidates,
} = require('../lib/canonical-v2/process-lexical-enumerator');

function digest(label) {
  return contentId('SYNTHETIC_PROCESS_LEXICAL_ENUMERATOR_TEST/V1', { label });
}

function scopeReceipt() {
  const scopeEvidence = [{
    source_document_identity: digest('scope-document'),
    source_revision_id: digest('scope-revision'),
    document_hash: digest('scope-document-hash'),
    start_utf8_byte: 10,
    end_utf8_byte: 20,
    exact_text_digest: digest('scope-exact-text'),
  }];
  return {
    schema_version: 'PROCESS_SCOPE_ENUMERATION/V1',
    scope_receipt_id: digest('scope-receipt'),
    expected_occurrence_slots: [{
      slot_key: 'EXCLUSIVITY_001',
      deal_id: digest('deal'),
      occurrence_kind: 'EXCLUSIVITY_DISCUSSION',
      required_evidence_roles: ['PRIMARY_TEXT'],
      scope_evidence: scopeEvidence,
    }],
    residuals: [{
      record_key: 'OUT_OF_SCOPE_001',
      residual_code: 'OUT_OF_SCOPE_OCCURRENCE',
      deal_id: digest('deal'),
      scope_evidence: scopeEvidence,
    }],
    limits: { max_scope_records: 8, max_slots: 4 },
  };
}

function sourceUnit(overrides = {}) {
  const exactText = 'The Company shall not solicit other offers.';
  return {
    source_unit_id: digest('unit'),
    source_document_identity: digest('document'),
    source_revision_id: digest('revision'),
    document_hash: sha256Hex(Buffer.from('synthetic document', 'utf8')),
    start_utf8_byte: 100,
    end_utf8_byte: 100 + Buffer.byteLength(exactText, 'utf8'),
    exact_text: exactText,
    lexical_observations: [{
      state: 'CANDIDATE',
      slot_key: 'EXCLUSIVITY_001',
      evidence_role_key: 'PRIMARY_TEXT',
      start_utf8_byte: 104,
      end_utf8_byte: 111,
      lexical_payload: { token: 'Company', matcher: 'CAPITALISED_TOKEN' },
      reason_code: null,
    }],
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    scope_receipt: scopeReceipt(),
    source_units: [sourceUnit()],
    limits: {
      max_source_count: 4,
      max_source_bytes: 4096,
      max_candidate_count: 8,
      max_duration_ms: 1000,
      max_memory_bytes: 4096,
    },
    reported_usage: { duration_ms: 12, memory_bytes: 512 },
    ...overrides,
  };
}

test('enumerates deterministic lexical candidates with exact source evidence', () => {
  const first = enumerateProcessLexicalCandidates(input());
  const second = enumerateProcessLexicalCandidates(input());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, PROCESS_LEXICAL_ENUMERATION_SCHEMA);
  assert.equal(first.candidates.length, 1);
  assert.equal(first.rejections.length, 0);
  assert.equal(first.residuals.length, 1);
  assert.equal(first.candidates[0].slot_key, 'EXCLUSIVITY_001');
  assert.equal(first.candidates[0].source_unit_id, digest('unit'));
  assert.equal(first.candidates[0].evidence.start_utf8_byte, 104);
  assert.equal(first.candidates[0].evidence.end_utf8_byte, 111);
  assert.equal(first.candidates[0].evidence.exact_text_digest, sha256Hex('Company'));
  assert.deepEqual(first.candidates[0].evidence.scope_evidence, scopeReceipt()
    .expected_occurrence_slots[0].scope_evidence);
  assert.deepEqual(first.candidates[0].lexical_payload, {
    matcher: 'CAPITALISED_TOKEN', token: 'Company',
  });
  assert.equal(Object.isFrozen(first), true);
});

test('retains rejected, ambiguous, unsupported and unmapped lexical records', () => {
  const base = sourceUnit();
  base.lexical_observations = [
    {
      state: 'REJECTED', slot_key: 'EXCLUSIVITY_001', evidence_role_key: 'PRIMARY_TEXT',
      start_utf8_byte: 104, end_utf8_byte: 111,
      lexical_payload: { token: 'Company' }, reason_code: 'NEGATED_MATCH',
    },
    {
      state: 'AMBIGUOUS', slot_key: null, evidence_role_key: null,
      start_utf8_byte: 104, end_utf8_byte: 111,
      lexical_payload: { token: 'Company' }, reason_code: 'MULTIPLE_POSSIBLE_SLOTS',
    },
    {
      state: 'UNSUPPORTED', slot_key: 'EXCLUSIVITY_001', evidence_role_key: 'PRIMARY_TEXT',
      start_utf8_byte: 104, end_utf8_byte: 111,
      lexical_payload: { token: 'Company' }, reason_code: 'UNSUPPORTED_LEXICAL_FORM',
    },
    {
      state: 'CANDIDATE', slot_key: 'UNKNOWN_SLOT', evidence_role_key: 'PRIMARY_TEXT',
      start_utf8_byte: 104, end_utf8_byte: 111,
      lexical_payload: { token: 'Company' }, reason_code: null,
    },
  ];
  const result = enumerateProcessLexicalCandidates(input({ source_units: [base] }));

  assert.equal(result.candidates.length, 0);
  assert.equal(result.rejections.length, 1);
  assert.equal(result.rejections[0].reason_code, 'NEGATED_MATCH');
  assert.deepEqual(result.residuals.map((item) => item.reason_code).sort(), [
    'MULTIPLE_POSSIBLE_SLOTS',
    'OUT_OF_SCOPE_OCCURRENCE',
    'UNKNOWN_EXPECTED_OCCURRENCE_SLOT',
    'UNSUPPORTED_LEXICAL_FORM',
  ]);
  assert.ok(result.residuals.filter((item) => item.outcome_kind === 'RESIDUAL').every(
    (item) => item.evidence.exact_text_digest === sha256Hex('Company'),
  ));
});

test('fails closed for hostile source records, duplicate candidates and reported limits', () => {
  const malformedInterval = sourceUnit();
  malformedInterval.lexical_observations[0].start_utf8_byte = 99;
  assert.throws(
    () => enumerateProcessLexicalCandidates(input({ source_units: [malformedInterval] })),
    { code: 'INVALID_PROCESS_LEXICAL_OBSERVATION' },
  );

  const duplicate = sourceUnit();
  duplicate.lexical_observations.push({ ...duplicate.lexical_observations[0] });
  assert.throws(
    () => enumerateProcessLexicalCandidates(input({ source_units: [duplicate] })),
    { code: 'DUPLICATE_PROCESS_LEXICAL_CANDIDATE' },
  );

  assert.throws(
    () => enumerateProcessLexicalCandidates(input({
      reported_usage: { duration_ms: 1001, memory_bytes: 512 },
    })),
    { code: 'INVALID_PROCESS_LEXICAL_ENUMERATION_LIMITS' },
  );
});

test('rejects duplicate scope residual record keys', () => {
  const duplicateReceipt = scopeReceipt();
  duplicateReceipt.residuals.push({ ...duplicateReceipt.residuals[0] });
  assert.throws(
    () => enumerateProcessLexicalCandidates(input({ scope_receipt: duplicateReceipt })),
    { code: 'INVALID_PROCESS_LEXICAL_SCOPE_RECEIPT' },
  );
});

test('rejects scope residual record keys outside canonical UTF-8 order', () => {
  const reorderedReceipt = scopeReceipt();
  reorderedReceipt.residuals = [
    { ...reorderedReceipt.residuals[0], record_key: '\u00c5_RESIDUAL' },
    { ...reorderedReceipt.residuals[0], record_key: 'Z_RESIDUAL' },
  ];
  assert.throws(
    () => enumerateProcessLexicalCandidates(input({ scope_receipt: reorderedReceipt })),
    { code: 'INVALID_PROCESS_LEXICAL_SCOPE_RECEIPT' },
  );
});

test('has no source acquisition, semantic enumeration or authority imports', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(
    require.resolve('../lib/canonical-v2/process-lexical-enumerator'),
    'utf8',
  );
  assert.doesNotMatch(source, /require\(['"](?:fs|http|https|child_process|\.\/process-source-acquisition|\.\/process-semantic-enumerator)/);
  assert.doesNotMatch(source, /canonical-writer|database|serving|release|activation|production/i);
});
