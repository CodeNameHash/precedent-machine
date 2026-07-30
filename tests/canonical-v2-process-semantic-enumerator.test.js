const assert = require('node:assert/strict');
const test = require('node:test');
const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { INPUT_SCHEMA, enumerateProcessSemantics } = require('../lib/canonical-v2/process-semantic-enumerator');
const {
  INPUT_SCHEMA: SCOPE_INPUT_SCHEMA,
  enumerateProcessScope,
} = require('../lib/canonical-v2/process-scope-enumerator');

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
function scopeReceipt() {
  const expectedOccurrenceSlots = [frozenSlot('SLOT_A')];
  const body = {
    governed_deal_admission_id: digest('deal'),
    expected_occurrence_slots: expectedOccurrenceSlots,
    residuals: [],
    limits: { max_scope_records: 8, max_slots: 4 },
  };
  return {
    schema_version: 'PROCESS_SCOPE_ENUMERATION/V1',
    scope_receipt_id: contentId('PROCESS_SCOPE_ENUMERATION_RECEIPT/V1', body),
    expected_occurrence_slots: expectedOccurrenceSlots,
    residuals: body.residuals,
    limits: body.limits,
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
  const scope = scopeReceipt();
  return {
    schema_version: INPUT_SCHEMA,
    scope_receipt: scope,
    source_units: [sourceUnit('late', 'CANDIDATE'), sourceUnit('rejected', 'REJECTED'), sourceUnit('early', 'CANDIDATE')],
    limits: { max_source_units: 8, max_candidates: 4 },
    ...overrides,
  };
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

test('enumerates deterministic semantic candidates from caller-provided frozen slots', () => {
  const expectedScopeReceiptId = scopeReceipt().scope_receipt_id;
  const first = enumerateProcessSemantics(input(), expectedScopeReceiptId);
  const second = enumerateProcessSemantics(input(), expectedScopeReceiptId);
  const reordered = input();
  reordered.source_units.reverse();
  assert.deepEqual(first, second);
  assert.deepEqual(first, enumerateProcessSemantics(reordered, expectedScopeReceiptId));
  assert.equal(first.schema_version, 'PROCESS_SEMANTIC_ENUMERATION/V1');
  assert.equal(first.candidates.length, 2);
  assert.deepEqual(first.candidates.map((candidate) => candidate.slot_key), ['SLOT_A', 'SLOT_A']);
  assert.equal(
    first.candidates.some((candidate) => candidate.evidence.start_utf8_byte === 0),
    true,
  );
  assert.equal(first.candidates[0].schema_version, 'PROCESS_SEMANTIC_CANDIDATE/V1');
  assert.equal(first.candidates[0].scope_receipt_id, scopeReceipt().scope_receipt_id);
  assert.equal(first.rejections[0].schema_version, 'PROCESS_SEMANTIC_OUTCOME/V1');
  assert.equal(first.rejections[0].slot_key, null);
  assert.equal(first.rejections[0].semantic_payload, null);
  assert.equal(first.rejections[0].reason_code, 'UNSUPPORTED_SEMANTIC_MATERIAL');
  assert.equal(first.rejections[0].outcome_kind, 'REJECTION');
  assert.equal(Object.isFrozen(first), true);
});

test('preserves exact source intervals and derives candidate identity from exact evidence and payload', () => {
  const expectedScopeReceiptId = scopeReceipt().scope_receipt_id;
  const original = enumerateProcessSemantics(input(), expectedScopeReceiptId).candidates.find(
    (candidate) => candidate.evidence.start_utf8_byte === 0,
  );
  const changed = clone(input());
  changed.source_units[2].semantic_payload.polarity = 'ABSENT';
  const changedCandidate = enumerateProcessSemantics(changed, expectedScopeReceiptId).candidates.find(
    (candidate) => candidate.evidence.start_utf8_byte === 0,
  );
  assert.notEqual(original.candidate_key, changedCandidate.candidate_key);
  assert.deepEqual(original.evidence, evidence('early', 0));
  assert.equal(Object.hasOwn(original, 'release_id'), false);
});

test('binds producer-governed rejected and residual outcomes to the semantic outcome domain', () => {
  const result = enumerateProcessSemantics(input({
    source_units: [
      sourceUnit('rejected', 'REJECTED'),
      sourceUnit('residual', 'RESIDUAL'),
    ],
  }), scopeReceipt().scope_receipt_id);
  for (const outcome of [...result.rejections, ...result.residuals]) {
    const {
      schema_version: schemaVersion,
      outcome_key: outcomeKey,
      ...body
    } = outcome;
    assert.equal(schemaVersion, 'PROCESS_SEMANTIC_OUTCOME/V1');
    assert.equal(outcome.slot_key, null);
    assert.equal(outcome.semantic_payload, null);
    assert.equal(outcomeKey, contentId(schemaVersion, body));
  }
});

test('fails closed for hostile source, duplicate, unbounded, unknown-slot and malformed evidence input', () => {
  const cases = [
    () => enumerateProcessSemantics(
      input({ source_units: [sourceUnit('same', 'CANDIDATE'), sourceUnit('same', 'CANDIDATE')] }),
      scopeReceipt().scope_receipt_id,
    ),
    () => enumerateProcessSemantics(
      input({ limits: { max_source_units: 1, max_candidates: 1 } }),
      scopeReceipt().scope_receipt_id,
    ),
    () => enumerateProcessSemantics(
      input({ source_units: [sourceUnit('unknown', 'CANDIDATE', { slot_key: 'SLOT_UNKNOWN' })] }),
      scopeReceipt().scope_receipt_id,
    ),
    () => {
      const changed = clone(input());
      changed.source_units[0].evidence.end_utf8_byte = 0;
      return enumerateProcessSemantics(changed, scopeReceipt().scope_receipt_id);
    },
    () => enumerateProcessSemantics(
      { ...input(), lexical_enumerator: 'IMPORTED' },
      scopeReceipt().scope_receipt_id,
    ),
  ];
  cases.forEach((run) => assert.throws(run, { name: 'ProcessSemanticEnumeratorError' }));
});

test('rejects mismatched frozen slots and scope receipt identity', () => {
  const changedSlot = clone(input());
  changedSlot.scope_receipt.expected_occurrence_slots[0].occurrence_kind =
    'SUBSTITUTED_EVENT';
  assert.throws(
    () => enumerateProcessSemantics(changedSlot, scopeReceipt().scope_receipt_id),
    { code: 'INVALID_PROCESS_SEMANTIC_SCOPE_RECEIPT' },
  );

  const changedId = clone(input());
  changedId.scope_receipt.scope_receipt_id = digest('substituted-scope-receipt');
  assert.throws(
    () => enumerateProcessSemantics(changedId, scopeReceipt().scope_receipt_id),
    { code: 'INVALID_PROCESS_SEMANTIC_SCOPE_RECEIPT' },
  );
});

test('rejects replacement of a self-rehashed scope receipt and its input-contained expected ID', () => {
  const trusted = scopeReceipt();
  const substituted = clone(trusted);
  substituted.expected_occurrence_slots[0].occurrence_kind =
    'OTHER_EXCLUSIVITY_EVENT';
  substituted.scope_receipt_id = contentId(
    'PROCESS_SCOPE_ENUMERATION_RECEIPT/V1',
    {
      governed_deal_admission_id:
        substituted.expected_occurrence_slots[0].deal_id,
      expected_occurrence_slots: substituted.expected_occurrence_slots,
      residuals: substituted.residuals,
      limits: substituted.limits,
    },
  );
  const hostileInput = input({ scope_receipt: substituted });
  hostileInput.expected_scope_receipt_id = substituted.scope_receipt_id;
  assert.throws(
    () => enumerateProcessSemantics(
      hostileInput,
      trusted.scope_receipt_id,
    ),
    { code: 'INVALID_PROCESS_SEMANTIC_ENUMERATOR_INPUT' },
  );
  delete hostileInput.expected_scope_receipt_id;
  assert.throws(
    () => enumerateProcessSemantics(
      hostileInput,
      trusted.scope_receipt_id,
    ),
    { code: 'INVALID_PROCESS_SEMANTIC_SCOPE_RECEIPT' },
  );
});

test('consumes a producer-valid zero-slot residual scope', () => {
  const base = scopeReceipt();
  const scope = enumerateProcessScope({
    schema_version: SCOPE_INPUT_SCHEMA,
    governed_deal_admission_id: digest('deal'),
    scope_records: [{
      record_key: 'ONLY_RESIDUAL',
      record_state: 'RESIDUAL',
      slot_key: null,
      deal_id: digest('deal'),
      occurrence_kind: null,
      required_evidence_roles: null,
      scope_evidence: base.expected_occurrence_slots[0].scope_evidence,
      residual_code: 'UNRESOLVED_SCOPE',
    }],
    limits: { max_scope_records: 4, max_slots: 4 },
  });
  const result = enumerateProcessSemantics(
    input({
      scope_receipt: scope,
      source_units: [],
    }),
    scope.scope_receipt_id,
  );

  assert.equal(result.scope_receipt_id, scope.scope_receipt_id);
  assert.equal(result.candidates.length, 0);
});
