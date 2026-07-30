const assert = require('node:assert/strict');
const test = require('node:test');
const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  INPUT_SCHEMA,
  enumerateProcessScope,
} = require('../lib/canonical-v2/process-scope-enumerator');

function digest(label) { return contentId('SYNTHETIC_SCOPE_ENUMERATOR_TEST/V1', { label }); }
function evidence(label, start = 0) {
  return {
    source_document_identity: digest(`${label}:document`),
    source_revision_id: digest(`${label}:revision`),
    document_hash: digest(`${label}:hash`),
    start_utf8_byte: start,
    end_utf8_byte: start + 4,
    exact_text_digest: sha256Hex(Buffer.from(label, 'utf8')),
  };
}
function slot(recordKey, slotKey, start = 0) {
  return {
    record_key: recordKey,
    record_state: 'SLOT',
    slot_key: slotKey,
    deal_id: digest('deal'),
    occurrence_kind: 'EXCLUSIVITY_EVENT',
    required_evidence_roles: ['AGREEMENT_TEXT', 'EVENT_CONTEXT'],
    scope_evidence: [evidence(recordKey, start)],
    residual_code: null,
  };
}
function residual(recordKey, start = 0) {
  return {
    record_key: recordKey,
    record_state: 'RESIDUAL',
    slot_key: null,
    deal_id: digest('deal'),
    occurrence_kind: null,
    required_evidence_roles: null,
    scope_evidence: [evidence(recordKey, start)],
    residual_code: 'UNRESOLVED_SCOPE',
  };
}
function input(overrides = {}) {
  return {
    schema_version: INPUT_SCHEMA,
    governed_deal_admission_id: digest('deal'),
    scope_records: [slot('SLOT_B', 'SLOT_B', 10), slot('SLOT_A', 'SLOT_A', 0), residual('RESIDUAL_A', 20)],
    limits: { max_scope_records: 8, max_slots: 4 },
    ...overrides,
  };
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

test('freezes deterministic expected occurrence slots and retains scope residuals', () => {
  const first = enumerateProcessScope(input());
  const second = enumerateProcessScope(input());
  const reordered = input();
  reordered.scope_records.reverse();
  assert.deepEqual(first, second);
  assert.deepEqual(first, enumerateProcessScope(reordered));
  assert.equal(first.schema_version, 'PROCESS_SCOPE_ENUMERATION/V1');
  assert.deepEqual(first.expected_occurrence_slots.map((slotValue) => slotValue.slot_key), ['SLOT_A', 'SLOT_B']);
  assert.equal(first.residuals[0].record_key, 'RESIDUAL_A');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.expected_occurrence_slots[0].scope_evidence[0]), true);
});

test('preserves source and evidence identity without value extraction', () => {
  const result = enumerateProcessScope(input());
  const frozen = result.expected_occurrence_slots[0];
  assert.deepEqual(frozen.scope_evidence[0], evidence('SLOT_A', 0));
  assert.equal(Object.hasOwn(frozen, 'candidate_value'), false);
  assert.equal(Object.hasOwn(result, 'release_id'), false);
});

test('fails closed for hostile, duplicate, cross-deal, unbounded and malformed records', () => {
  const cases = [
    () => enumerateProcessScope(input({ scope_records: [slot('SLOT_A', 'SLOT_A'), slot('SLOT_B', 'SLOT_A')] })),
    () => enumerateProcessScope(input({ scope_records: [{ ...slot('SLOT_A', 'SLOT_A'), deal_id: digest('other-deal') }] })),
    () => enumerateProcessScope(input({ limits: { max_scope_records: 1, max_slots: 1 } })),
    () => { const changed = clone(input()); changed.scope_records[0].scope_evidence[0].end_utf8_byte = 0; return enumerateProcessScope(changed); },
    () => enumerateProcessScope({ ...input(), writer: 'CANONICAL' }),
  ];
  cases.forEach((run) => assert.throws(run, { name: 'ProcessScopeEnumeratorError' }));
});
