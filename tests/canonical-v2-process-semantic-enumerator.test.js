const assert = require('node:assert/strict');
const test = require('node:test');
const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { INPUT_SCHEMA, enumerateProcessSemantics } = require('../lib/canonical-v2/process-semantic-enumerator');

function digest(label) { return contentId('SYNTHETIC_SEMANTIC_ENUMERATOR_TEST/V1', { label }); }
function evidence(label, start = 0, role = 'AGREEMENT_TEXT') {
  return {
    source_document_identity: digest(`${label}:document`),
    source_revision_id: digest(`${label}:revision`),
    document_hash: digest(`${label}:hash`),
    start_utf8_byte: start,
    end_utf8_byte: start + 5,
    exact_text_digest: sha256Hex(Buffer.from(label, 'utf8')),
    evidence_role_key: role,
  };
}
function frozenSlot(key) {
  return {
    slot_key: key,
    deal_id: digest('deal'),
    occurrence_kind: 'EXCLUSIVITY_EVENT',
    required_evidence_roles: ['AGREEMENT_TEXT'],
    scope_evidence: [Object.fromEntries(Object.entries(evidence(`${key}:scope`)).filter(([field]) => field !== 'evidence_role_key'))],
  };
}
function sourceUnit(label, state, overrides = {}) {
  const candidate = state === 'CANDIDATE';
  return {
    source_unit_id: digest(label),
    unit_state: state,
    slot_key: candidate ? 'SLOT_A' : null,
    evidence: evidence(label, label === 'early' ? 0 : 10),
    semantic_payload: candidate ? { predicate_key: 'RESTRICTED_ACTION', polarity: 'PRESENT' } : null,
    disposition_code: candidate ? null : 'UNSUPPORTED_SEMANTIC_MATERIAL',
    ...overrides,
  };
}
function input(overrides = {}) {
  return {
    schema_version: INPUT_SCHEMA,
    scope_receipt_id: digest('scope-receipt'),
    frozen_slots: [frozenSlot('SLOT_A')],
    source_units: [sourceUnit('late', 'CANDIDATE'), sourceUnit('rejected', 'REJECTED'), sourceUnit('early', 'CANDIDATE')],
    limits: { max_source_units: 8, max_candidates: 4 },
    ...overrides,
  };
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

test('enumerates deterministic semantic candidates from caller-provided frozen slots', () => {
  const first = enumerateProcessSemantics(input());
  const second = enumerateProcessSemantics(input());
  const reordered = input();
  reordered.source_units.reverse();
  assert.deepEqual(first, second);
  assert.deepEqual(first, enumerateProcessSemantics(reordered));
  assert.equal(first.schema_version, 'PROCESS_SEMANTIC_ENUMERATION/V1');
  assert.equal(first.candidates.length, 2);
  assert.deepEqual(first.candidates.map((candidate) => candidate.slot_key), ['SLOT_A', 'SLOT_A']);
  assert.equal(
    first.candidates.some((candidate) => candidate.evidence.start_utf8_byte === 0),
    true,
  );
  assert.equal(first.candidates[0].schema_version, 'PROCESS_SEMANTIC_CANDIDATE/V1');
  assert.equal(first.candidates[0].scope_receipt_id, digest('scope-receipt'));
  assert.equal(first.rejections[0].reason_code, 'UNSUPPORTED_SEMANTIC_MATERIAL');
  assert.equal(first.rejections[0].outcome_kind, 'REJECTION');
  assert.equal(Object.isFrozen(first), true);
});

test('preserves exact source intervals and derives candidate identity from exact evidence and payload', () => {
  const original = enumerateProcessSemantics(input()).candidates.find(
    (candidate) => candidate.evidence.start_utf8_byte === 0,
  );
  const changed = clone(input());
  changed.source_units[2].semantic_payload.polarity = 'ABSENT';
  const changedCandidate = enumerateProcessSemantics(changed).candidates.find(
    (candidate) => candidate.evidence.start_utf8_byte === 0,
  );
  assert.notEqual(original.candidate_key, changedCandidate.candidate_key);
  assert.deepEqual(original.evidence, evidence('early', 0));
  assert.equal(Object.hasOwn(original, 'release_id'), false);
});

test('fails closed for hostile source, duplicate, unbounded, unknown-slot and malformed evidence input', () => {
  const cases = [
    () => enumerateProcessSemantics(input({ source_units: [sourceUnit('same', 'CANDIDATE'), sourceUnit('same', 'CANDIDATE')] })),
    () => enumerateProcessSemantics(input({ limits: { max_source_units: 1, max_candidates: 1 } })),
    () => enumerateProcessSemantics(input({ source_units: [sourceUnit('unknown', 'CANDIDATE', { slot_key: 'SLOT_UNKNOWN' })] })),
    () => { const changed = clone(input()); changed.source_units[0].evidence.end_utf8_byte = 0; return enumerateProcessSemantics(changed); },
    () => enumerateProcessSemantics({ ...input(), lexical_enumerator: 'IMPORTED' }),
  ];
  cases.forEach((run) => assert.throws(run, { name: 'ProcessSemanticEnumeratorError' }));
});
